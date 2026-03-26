"""
Rutas para generación de PDFs
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.core.security import get_current_user
from app.core.permisos import require_permiso
from app.schemas.pdf_schema import (
    PDFGenerateRequest,
    PDFGenerateFromTemplateRequest,
    PDFResponse,
    PageSize,
    PageOrientation,
)
from app.services.pdf_service import PDFService
from app.services.legal_service import (
    PlantillaDocumentoService,
    RespuestaFormularioService,
    SiniestroService,
    AseguradoService,
)
from app.services.empresa_service import EmpresaService
from app.models.user import User
from app.models.legal import Area, Proveniente, SiniestroArea, Institucion, Autoridad, EstadoSiniestro
from typing import Optional, Any, Dict, Tuple
from datetime import datetime as dt
from uuid import UUID as PyUUID
import re
import io
import base64
import logging
from pypdf import PdfReader, PdfWriter

logger = logging.getLogger(__name__)

router = APIRouter()

# Altura reservada para el header repetido por página (running header).
PDF_HEADER_MARGIN_TOP = "6cm"


def _get_siniestro_asegurado_variables(
    db: Session, siniestro_id: PyUUID, empresa_id: Optional[PyUUID]
) -> Dict[str, Any]:
    """
    Variables para PDF desde siniestro y asegurado (header y cuerpo).
    - numero_poliza, numero_siniestro: del siniestro
    - lugar_ocurrido: dirección del asegurado (ciudad, estado)
    - fecha_reporte, hora_fecha_reporte: de fecha_registro
    - fecha_asignacion, hora_fecha_asignacion: de fecha_siniestro (expandidos por _expand_datetime_variables)
    """
    out = {}
    if not empresa_id:
        return out
    siniestro = SiniestroService.get_by_id(db, siniestro_id, empresa_id)
    if not siniestro:
        return out
    out["numero_poliza"] = (siniestro.numero_poliza or "").strip()
    out["numero_siniestro"] = (siniestro.numero_siniestro or "").strip()

    # Unificación de fechas:
    # - La app asume que fecha_captura == fecha_registro
    # - Y que fecha_reporte deriva de fecha_registro
    # En algunos casos tempranos puede venir vacío fecha_registro,
    # así que hacemos fallback a fecha_siniestro y formateamos como DD/MM/YYYY.
    fecha_reg = getattr(siniestro, "fecha_registro", None) or getattr(
        siniestro, "fecha_siniestro", None
    )
    out["fecha_reporte"] = _fecha_pdf_corta(fecha_reg)

    # Si se requiere hora en plantillas, la devolvemos desde fecha_reg.
    # (Si no hay valor, queda como cadena vacía).
    if isinstance(fecha_reg, dt):
        out["hora_fecha_reporte"] = fecha_reg.strftime("%H:%M:%S")
    else:
        out["hora_fecha_reporte"] = ""

    # `fecha_asignacion` vive en la relación siniestro-área.
    # Si existen múltiples áreas, usamos la más reciente.
    area_asig = (
        db.query(SiniestroArea)
        .filter(
            SiniestroArea.siniestro_id == siniestro_id,
            SiniestroArea.activo == True,  # noqa: E712
        )
        .order_by(SiniestroArea.fecha_asignacion.desc())
        .first()
    )
    out["fecha_asignacion"] = getattr(area_asig, "fecha_asignacion", None)
    autoridad_nombre = ""
    if getattr(siniestro, "autoridad_id", None):
        autoridad = (
            db.query(Institucion)
            .filter(Institucion.id == siniestro.autoridad_id)
            .first()
        )
        if not autoridad:
            autoridad = (
                db.query(Autoridad)
                .filter(Autoridad.id == siniestro.autoridad_id)
                .first()
            )
        if autoridad and getattr(autoridad, "nombre", None):
            autoridad_nombre = str(autoridad.nombre).strip()

    if getattr(siniestro, "asegurado_id", None):
        asegurado = AseguradoService.get_by_id(db, siniestro.asegurado_id, empresa_id)
        if asegurado:
            direccion = getattr(asegurado, "direccion", None) if hasattr(asegurado, "direccion") else None
            if direccion and str(direccion).strip():
                out["lugar_ocurrido"] = str(direccion).strip()
            else:
                partes = [getattr(asegurado, "ciudad", None), getattr(asegurado, "estado", None)]
                partes = [p for p in partes if p and str(p).strip()]
                out["lugar_ocurrido"] = ", ".join(partes) if partes else ""
    # Compatibilidad con plantillas que usan {{radicado_en}}
    out["radicado_en"] = autoridad_nombre

    # Estado del siniestro
    if getattr(siniestro, "estado_id", None):
        estado_row = (
            db.query(EstadoSiniestro)
            .filter(EstadoSiniestro.id == siniestro.estado_id)
            .first()
        )
        out["estado_siniestro"] = (
            str(estado_row.nombre).strip()
            if estado_row and getattr(estado_row, "nombre", None)
            else ""
        )
    else:
        out["estado_siniestro"] = ""

    # Fecha del siniestro
    fecha_sin = getattr(siniestro, "fecha_siniestro", None)
    out["fecha_siniestro"] = _fecha_pdf_corta(fecha_sin)

    return out


def _fecha_pdf_corta(val: Any) -> str:
    """DD/MM/YYYY — misma idea que getVariablesForPdf en el frontend."""
    if val is None:
        return ""
    if isinstance(val, dt):
        d = val
    else:
        try:
            s = str(val).strip().replace("Z", "+00:00").replace("z", "+00:00")
            if not s:
                return ""
            d = dt.fromisoformat(s)
        except (ValueError, TypeError):
            return ""
    return f"{d.day:02d}/{d.month:02d}/{d.year}"


def _variables_plantilla_alineadas_frontend(
    db: Session,
    doc: Any,
    siniestro: Any,
    current_user: User,
    empresa_id: Optional[PyUUID],
) -> Dict[str, Any]:
    """
    Claves equivalentes a getVariablesForPdf (frontend app/siniestros/[id]/page.tsx)
    para reemplazar {{variable}} al generar PDF en servidor (adjunto de correo, etc.).
    """
    out: Dict[str, Any] = {}
    if not siniestro:
        return out

    hoy = dt.now()

    nombre_asegurado = ""
    autoridad_nombre = ""
    if getattr(siniestro, "autoridad_id", None):
        autoridad = (
            db.query(Institucion)
            .filter(Institucion.id == siniestro.autoridad_id)
            .first()
        )
        if not autoridad:
            autoridad = (
                db.query(Autoridad)
                .filter(Autoridad.id == siniestro.autoridad_id)
                .first()
            )
        if autoridad and getattr(autoridad, "nombre", None):
            autoridad_nombre = str(autoridad.nombre).strip()

    if getattr(siniestro, "asegurado_id", None) and empresa_id:
        aseg = AseguradoService.get_by_id(db, siniestro.asegurado_id, empresa_id)
        if aseg:
            parts = [
                getattr(aseg, "nombre", None),
                getattr(aseg, "apellido_paterno", None),
                getattr(aseg, "apellido_materno", None),
            ]
            nombre_asegurado = " ".join(
                str(p).strip() for p in parts if p and str(p).strip()
            ).strip()

    area_nombre = ""
    if getattr(doc, "area_id", None):
        area_row = db.query(Area).filter(Area.id == doc.area_id).first()
        if area_row and getattr(area_row, "nombre", None):
            area_nombre = str(area_row.nombre).strip()

    autor = ""
    try:
        u = (
            db.query(User)
            .options(joinedload(User.perfil))
            .filter(User.id == current_user.id)
            .first()
        )
        if u:
            fn = u.full_name
            autor = (fn or "").strip() if fn else (u.correo or "").strip()
    except Exception:
        autor = (getattr(current_user, "correo", None) or "").strip()

    codigo_prov = ""
    if getattr(siniestro, "proveniente_id", None):
        prov = (
            db.query(Proveniente)
            .filter(Proveniente.id == siniestro.proveniente_id)
            .first()
        )
        if prov and prov.codigo:
            codigo_prov = str(prov.codigo).strip()

    sc = (getattr(siniestro, "codigo", None) or "").strip()
    consecutivo = sc.zfill(3)[:3] if sc else ""
    fecha_ref = getattr(siniestro, "fecha_registro", None) or getattr(
        siniestro, "fecha_siniestro", None
    )
    anualidad = ""
    if fecha_ref is not None and hasattr(fecha_ref, "year"):
        try:
            anualidad = str(int(fecha_ref.year) % 100).zfill(2)
        except (TypeError, ValueError):
            pass

    id_formato = ""
    if codigo_prov and consecutivo and anualidad:
        id_formato = f"{codigo_prov}-{consecutivo}-{anualidad}"

    creado_src = (
        getattr(doc, "creado_en", None)
        or getattr(siniestro, "fecha_registro", None)
        or getattr(siniestro, "creado_en", None)
    )
    creado_en = _fecha_pdf_corta(creado_src)

    nr = getattr(siniestro, "numero_reporte", None)
    ns = getattr(siniestro, "numero_siniestro", None)
    np = getattr(siniestro, "numero_poliza", None)

    # Fecha asignación: preferimos la relación exacta por área del documento.
    fecha_asig_src = None
    if getattr(doc, "area_id", None) is not None and getattr(siniestro, "id", None) is not None:
        area_asig = (
            db.query(SiniestroArea)
            .filter(
                SiniestroArea.siniestro_id == siniestro.id,
                SiniestroArea.area_id == doc.area_id,
                SiniestroArea.activo == True,  # noqa: E712
            )
            .order_by(SiniestroArea.fecha_asignacion.desc())
            .first()
        )
        fecha_asig_src = getattr(area_asig, "fecha_asignacion", None)
    if fecha_asig_src is None:
        area_asig = (
            db.query(SiniestroArea)
            .filter(
                SiniestroArea.siniestro_id == siniestro.id,
                SiniestroArea.activo == True,  # noqa: E712
            )
            .order_by(SiniestroArea.fecha_asignacion.desc())
            .first()
        )
        fecha_asig_src = getattr(area_asig, "fecha_asignacion", None)

    # Estado del siniestro (nombre legible)
    estado_nombre = ""
    if getattr(siniestro, "estado_id", None):
        estado_row = (
            db.query(EstadoSiniestro)
            .filter(EstadoSiniestro.id == siniestro.estado_id)
            .first()
        )
        if estado_row and getattr(estado_row, "nombre", None):
            estado_nombre = str(estado_row.nombre).strip()

    out.update(
        {
            "creado_en": creado_en,
            "creado_por": autor,
            "id": id_formato,
            "asegurado": nombre_asegurado,
            "nombre_asegurado": nombre_asegurado,
            "area": area_nombre,
            "radicado_en": autoridad_nombre,
            "fecha_registro": creado_en,
            "autor": autor,
            # Se deja como datetime para que _expand_datetime_variables
            # genere automáticamente:
            # - fecha_asignacion (DD/MM/YYYY)
            # - hora_fecha_asignacion (HH:mm:ss)
            "fecha_asignacion": fecha_asig_src,
            "fecha_siniestro": getattr(siniestro, "fecha_siniestro", None),
            "fecha": _fecha_pdf_corta(hoy),
            "numero_reporte": (str(nr).strip() if nr is not None else ""),
            "numero_siniestro": (str(ns).strip() if ns is not None else ""),
            "numero_poliza": (str(np).strip() if np is not None else ""),
            "estado_siniestro": estado_nombre,
        }
    )
    return out


def _parse_datetime(value: Any) -> Optional[dt]:
    """Intenta parsear un valor como datetime (ISO o 'YYYY-MM-DD HH:MM:SS'). Retorna None si no es datetime."""
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    # ISO: 2025-02-12T14:00:23 o 2025-02-12T14:00:23.123Z
    if "T" in s:
        try:
            return dt.fromisoformat(s.replace("Z", "+00:00").replace("z", "+00:00"))
        except (ValueError, TypeError):
            pass
    # Sin T: 2025-02-12 14:00:23 o 2025-02-12
    if re.match(r"^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$", s):
        try:
            return dt.fromisoformat(s)
        except (ValueError, TypeError):
            pass
    return None


def _expand_datetime_variables(variables: dict) -> dict:
    """
    Expande variables que son datetime en dos variables para el PDF:
    - clave -> fecha en formato corto DD/MM/YYYY (ej: 12/02/2025)
    - hora_<clave> -> hora en 24h HH:mm:ss (ej: 14:00:23)
    Así en la plantilla se puede usar {{fecha_1ra_atencion}} y {{hora_fecha_1ra_atencion}}.
    """
    out = {}
    for k, v in variables.items():
        parsed = _parse_datetime(v)
        if parsed is not None:
            out[k] = parsed.strftime("%d/%m/%Y")
            out[f"hora_{k}"] = parsed.strftime("%H:%M:%S")
        else:
            out[k] = v
    return out


def _format_currency_value(value: Any) -> str:
    """Formatea un valor numérico como moneda: 10,000,000.00"""
    if value is None:
        return ""
    if isinstance(value, (int, float)):
        return f"{value:,.2f}"
    s = str(value).strip().replace(",", "")
    if not s:
        return ""
    try:
        num = float(s)
        return f"{num:,.2f}"
    except (ValueError, TypeError):
        return str(value)


def _format_currency_variables(variables: dict, plantilla: Any) -> dict:
    """
    Formatea en el diccionario de variables los valores de campos tipo 'currency'
    de la plantilla (campos_formulario), para que en el PDF se vean como 10,000,000.00.
    """
    if not plantilla or not getattr(plantilla, "campos_formulario", None):
        return variables
    campos = plantilla.campos_formulario or []
    currency_keys = {c.get("clave") for c in campos if c.get("tipo") == "currency"}
    if not currency_keys:
        return variables
    out = dict(variables)
    for k in currency_keys:
        if k in out and out[k] is not None and str(out[k]).strip() != "":
            out[k] = _format_currency_value(out[k])
    return out


def _get_empresa_logo_url(db: Session, user: User) -> Optional[str]:
    """Obtiene la URL del logo de la empresa del usuario (activa o primera disponible)."""
    empresa_id = getattr(user, "empresa_id", None)
    if empresa_id is None and getattr(user, "usuario_empresas", None):
        # Usuario multiempresa: usar la primera empresa asociada
        ue_list = list(user.usuario_empresas)
        if ue_list:
            empresa_id = getattr(ue_list[0], "empresa_id", None)
    if not empresa_id:
        return None
    empresa = EmpresaService.get_empresa_by_id(db, str(empresa_id))
    if not empresa or not getattr(empresa, "logo_url", None):
        return None
    logo = empresa.logo_url
    return logo.strip() if isinstance(logo, str) else None


def _get_logo_for_header(db: Session, user: User, header_plantilla=None) -> Optional[str]:
    """
    Obtiene la URL del logo a usar: prioriza el logo del header (plantilla),
    si no tiene usa el logo de la empresa del usuario.
    """
    # 1. Logo personalizado del header/plantilla
    if header_plantilla and getattr(header_plantilla, "logo_url", None):
        logo = header_plantilla.logo_url
        if logo and isinstance(logo, str) and logo.strip():
            return logo.strip()
    # 2. Fallback: logo de la empresa
    return _get_empresa_logo_url(db, user)


def _build_header_html_with_logo(
    db: Session,
    header_contenido: str,
    user: User,
    header_plantilla=None,
) -> str:
    """
    Construye el HTML del header inyectando el logo.
    Prioridad: logo_url del header (plantilla) > logo de la empresa.
    Si header_contenido contiene {{logo}}, se reemplaza por la etiqueta img.
    Si no hay placeholder pero hay logo, se antepone un bloque con el logo.
    """
    logo_url = _get_logo_for_header(db, user, header_plantilla)
    if not logo_url:
        return header_contenido
    img_tag = f'<img src="{logo_url}" alt="Logo" style="max-height: 120px; max-width: 320px; object-fit: contain;" />'
    if "{{logo}}" in header_contenido:
        return header_contenido.replace("{{logo}}", img_tag)
    # Logo y contenido del header en la misma línea (flex: logo izquierda, contenido derecha)
    return (
        '<div style="display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 0.5rem;">'
        f'<div style="flex-shrink: 0;">{img_tag}</div>'
        f'<div style="flex: 1; min-width: 0;">{header_contenido}</div>'
        "</div>"
    )


def _prepend_logo_if_empresa_has_one(db: Session, html_content: str, user: User) -> str:
    """Si la empresa tiene logo y el contenido no incluye ya el placeholder {{logo}}, antepone el logo."""
    logo_url = _get_empresa_logo_url(db, user)
    if not logo_url:
        return html_content
    img_tag = f'<img src="{logo_url}" alt="Logo" style="max-height: 120px; max-width: 320px; object-fit: contain;" />'
    block = f'<div class="header-logo" style="margin-bottom: 0.5rem;">{img_tag}</div>\n'
    if block.strip() in html_content or "{{logo}}" in html_content:
        return html_content
    return block + html_content


def _build_html_for_one_plantilla(db: Session, plantilla, user: User) -> str:
    """
    Construye el HTML de una plantilla: header (con logo) + contenido.
    La plantilla debe tener .header_plantilla_id y .contenido.
    Usa logo del header si tiene logo_url, sino logo de la empresa.
    """
    html = ""
    if getattr(plantilla, "header_plantilla_id", None):
        header = PlantillaDocumentoService.get_by_id(db, plantilla_id=plantilla.header_plantilla_id)
        if header and getattr(header, "activo", True) and getattr(header, "contenido", None):
            html += _build_header_html_with_logo(db, header.contenido, user, header_plantilla=header) + "\n"
    html += getattr(plantilla, "contenido", "") or ""
    if not getattr(plantilla, "header_plantilla_id", None):
        html = _prepend_logo_if_empresa_has_one(db, html, user)
    return html


def _build_full_html_from_plantilla(
    db: Session, plantilla, user: User, *, include_continuacion: bool = True, header_on_every_page: bool = True
) -> str:
    """
    Construye el HTML completo de una plantilla y, si tiene plantilla_continuacion_id,
    añade salto de página y la segunda plantilla.
    Si header_on_every_page es True, el header de la primera plantilla se repite en todas las páginas.
    """
    header_html = ""
    if getattr(plantilla, "header_plantilla_id", None):
        header_pl = PlantillaDocumentoService.get_by_id(db, plantilla_id=plantilla.header_plantilla_id)
        if header_pl and getattr(header_pl, "activo", True) and getattr(header_pl, "contenido", None):
            header_html = _build_header_html_with_logo(db, header_pl.contenido, user, header_plantilla=header_pl) + "\n"
    body_first = getattr(plantilla, "contenido", "") or ""
    if not getattr(plantilla, "header_plantilla_id", None):
        body_first = _prepend_logo_if_empresa_has_one(db, body_first, user)

    if header_on_every_page and header_html:
        parts = [_wrap_header_for_all_pages(header_html, body_first)]
    else:
        parts = [header_html + body_first] if header_html else [body_first]

    if include_continuacion and getattr(plantilla, "plantilla_continuacion_id", None):
        segunda = PlantillaDocumentoService.get_by_id(db, plantilla_id=plantilla.plantilla_continuacion_id)
        if segunda and getattr(segunda, "activo", True) and getattr(segunda, "contenido", None):
            parts.append('<div style="page-break-before: always;"></div>')
            parts.append(_build_html_for_one_plantilla(db, segunda, user))
    return "\n".join(parts)


def _empresa_id_from_user(user: User) -> Optional[PyUUID]:
    """Obtiene empresa_id del usuario (o primera empresa si es multi-empresa)."""
    eid = getattr(user, "empresa_id", None)
    if eid is not None:
        return PyUUID(str(eid)) if eid else None
    if getattr(user, "usuario_empresas", None):
        ue_list = list(user.usuario_empresas)
        if ue_list:
            eid = getattr(ue_list[0], "empresa_id", None)
            return PyUUID(str(eid)) if eid else None
    return None


def _wrap_header_for_all_pages(header_html: str, body_html: str) -> str:
    """
    Envuelve el header con running elements de WeasyPrint.
    Esto evita solapamiento en páginas 2+ porque el motor reserva el top margin
    en cada página renderizada.
    """
    header_page_style = (
        "<style>"
        "@page withRunningHeader {"
        f"  margin-top: {PDF_HEADER_MARGIN_TOP};"
        "  @top-center { content: element(pdfHeader); }"
        "}"
        ".pdf-page-header-running { position: running(pdfHeader); }"
        ".pdf-page-header-running { line-height: 1.2; }"
        ".pdf-page-header-running p { margin: 0; }"
        ".pdf-page-header-running table { margin: 0; }"
        ".pdf-with-running-header { page: withRunningHeader; }"
        "</style>"
    )
    header_block = (
        f'<div class="pdf-page-header-running" style="background: white;">'
        f"{header_html.strip()}</div>"
    )
    body_block = f'<div class="pdf-with-running-header">{body_html}</div>'
    return header_page_style + "\n" + header_block + "\n" + body_block


def _get_plantilla_header_and_body(
    db: Session, plantilla, user: User, *, body_override: Optional[str] = None
) -> tuple:
    """
    Devuelve (header_html, body_html) para una plantilla.
    Si body_override se indica, se usa como cuerpo en lugar de plantilla.contenido.
    """
    header_html = ""
    if getattr(plantilla, "header_plantilla_id", None):
        header_pl = PlantillaDocumentoService.get_by_id(db, plantilla_id=plantilla.header_plantilla_id)
        if header_pl and getattr(header_pl, "activo", True) and getattr(header_pl, "contenido", None):
            header_html = _build_header_html_with_logo(db, header_pl.contenido, user, header_plantilla=header_pl) + "\n"
    body = body_override if body_override is not None else (getattr(plantilla, "contenido", "") or "")
    if not getattr(plantilla, "header_plantilla_id", None) and body:
        body = _prepend_logo_if_empresa_has_one(db, body, user)
    return (header_html, body)


def _build_section_html(
    db: Session, plantilla, user: User, *, body_override: Optional[str] = None
) -> str:
    """
    Construye el HTML de una sola sección (una plantilla) con su header aplicado solo a esa sección.
    El header se repite solo en las páginas que genere este HTML (al renderizar este bloque a PDF por separado).
    """
    header_html, body_html = _get_plantilla_header_and_body(db, plantilla, user, body_override=body_override)
    if header_html and body_html:
        return _wrap_header_for_all_pages(header_html, body_html)
    if header_html:
        return _wrap_header_for_all_pages(header_html, "")
    return body_html


def _merge_pdfs(pdf_bytes_list: list) -> bytes:
    """Fusiona varios PDF en uno solo, en orden (usa PdfWriter de pypdf)."""
    if not pdf_bytes_list:
        return b""
    if len(pdf_bytes_list) == 1:
        return pdf_bytes_list[0]
    writer = PdfWriter()
    for pdf_bytes in pdf_bytes_list:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        writer.append(reader)
    out = io.BytesIO()
    writer.write(out)
    writer.close()
    return out.getvalue()


def _try_pdf_from_document_contenido(
    db: Session,
    doc: Any,
    current_user: User,
    plantilla: Any,
    pdf_opts: Dict[str, Any],
) -> Optional[Tuple[bytes, str]]:
    """
    Misma lógica que POST /pdf/generate con html_content del documento guardado:
    header de plantilla, continuación, variables. Así el PDF del correo coincide con la app.
    """
    if not doc or not getattr(doc, "contenido", None) or not str(doc.contenido).strip():
        return None
    if not plantilla or not getattr(plantilla, "activo", True):
        return None
    try:
        segunda = None
        if getattr(plantilla, "plantilla_continuacion_id", None):
            seg = PlantillaDocumentoService.get_by_id(
                db, plantilla_id=plantilla.plantilla_continuacion_id
            )
            if seg and getattr(seg, "activo", True) and getattr(seg, "contenido", None):
                segunda = seg
        if segunda:
            html1 = _build_section_html(
                db, plantilla, current_user, body_override=doc.contenido
            )
            html2 = _build_section_html(db, segunda, current_user)
            pdf1 = PDFService.generate_pdf(html_content=html1, **pdf_opts)
            pdf2 = PDFService.generate_pdf(html_content=html2, **pdf_opts)
            pdf_bytes = _merge_pdfs([pdf1, pdf2])
        else:
            header_html = ""
            if plantilla.header_plantilla_id:
                header = PlantillaDocumentoService.get_by_id(
                    db, plantilla_id=plantilla.header_plantilla_id
                )
                if header and header.activo and header.contenido:
                    header_html = (
                        _build_header_html_with_logo(
                            db, header.contenido, current_user, header_plantilla=header
                        )
                        + "\n"
                    )
            body_content = doc.contenido
            if header_html:
                html_content = _wrap_header_for_all_pages(header_html, body_content)
            else:
                html_content = body_content
            if not plantilla.header_plantilla_id:
                html_content = _prepend_logo_if_empresa_has_one(
                    db, html_content, current_user
                )
            pdf_bytes = PDFService.generate_pdf(html_content=html_content, **pdf_opts)
        base_name = (
            doc.nombre_archivo or getattr(plantilla, "nombre", None) or "documento"
        ).strip()
        if not base_name.lower().endswith(".pdf"):
            base_name += ".pdf"
        return (pdf_bytes, base_name)
    except Exception as exc:
        logger.warning(
            "PDF desde contenido del documento %s falló: %s",
            getattr(doc, "id", None),
            exc,
        )
        return None


@router.post("/generate", response_model=PDFResponse)
async def generate_pdf(
    request: PDFGenerateRequest,
    current_user: User = Depends(require_permiso("siniestros", "generar_pdf")),
    db: Session = Depends(get_db)
):
    """
    Genera un PDF desde HTML personalizado.
    Si se envía plantilla_id, se antepone el header de la plantilla (con logo) al contenido.
    El header se repite en todas las páginas.
    """
    html_content = request.html_content
    merged_variables = dict(request.variables or {})

    # Variables desde siniestro/asegurado (numero_poliza, lugar_ocurrido, fecha_reporte, fecha_asignacion, numero_siniestro)
    if getattr(request, "siniestro_id", None):
        try:
            sid = PyUUID(str(request.siniestro_id))
            empresa_id = _empresa_id_from_user(current_user)
            siniestro_vars = _get_siniestro_asegurado_variables(db, sid, empresa_id)
            merged_variables = {**siniestro_vars, **merged_variables}
        except (ValueError, TypeError):
            pass

    if getattr(request, "plantilla_id", None):
        plantilla = PlantillaDocumentoService.get_by_id(db, plantilla_id=request.plantilla_id)
        if plantilla:
            if getattr(request, "siniestro_id", None):
                respuesta = RespuestaFormularioService.get_or_none(
                    db,
                    plantilla_id=PyUUID(request.plantilla_id),
                    siniestro_id=PyUUID(request.siniestro_id),
                )
                if respuesta and respuesta.valores:
                    merged_variables = {**respuesta.valores, **merged_variables}
            merged_variables = _expand_datetime_variables(merged_variables)
            merged_variables = _format_currency_variables(merged_variables, plantilla)
            pdf_opts = dict(
                page_size=request.page_size,
                orientation=request.orientation,
                margin_top=request.margin_top or "1cm",
                margin_bottom=request.margin_bottom or "1cm",
                margin_left=request.margin_left or "1cm",
                margin_right=request.margin_right or "1cm",
                custom_css=request.custom_css,
                variables=merged_variables or None,
            )
            segunda = None
            if getattr(plantilla, "plantilla_continuacion_id", None):
                seg = PlantillaDocumentoService.get_by_id(db, plantilla_id=plantilla.plantilla_continuacion_id)
                if seg and getattr(seg, "activo", True) and getattr(seg, "contenido", None):
                    segunda = seg
            if segunda:
                html1 = _build_section_html(db, plantilla, current_user, body_override=request.html_content)
                html2 = _build_section_html(db, segunda, current_user)
                pdf1 = PDFService.generate_pdf(html_content=html1, **pdf_opts)
                pdf2 = PDFService.generate_pdf(html_content=html2, **pdf_opts)
                pdf_bytes = _merge_pdfs([pdf1, pdf2])
                pdf_base64 = base64.b64encode(pdf_bytes).decode("utf-8")
                filename = request.filename or "documento"
                if not filename.endswith('.pdf'):
                    filename += '.pdf'
                return PDFResponse(
                    success=True,
                    message="PDF generado exitosamente",
                    pdf_base64=pdf_base64,
                    filename=filename
                )
            header_html = ""
            if plantilla.header_plantilla_id:
                header = PlantillaDocumentoService.get_by_id(db, plantilla_id=plantilla.header_plantilla_id)
                if header and header.activo and header.contenido:
                    header_html = _build_header_html_with_logo(db, header.contenido, current_user, header_plantilla=header) + "\n"
            body_content = request.html_content
            if header_html:
                html_content = _wrap_header_for_all_pages(header_html, body_content)
            else:
                html_content = body_content
            if not plantilla.header_plantilla_id:
                html_content = _prepend_logo_if_empresa_has_one(db, html_content, current_user)
    merged_variables = _expand_datetime_variables(merged_variables)
    if getattr(request, "plantilla_id", None):
        plantilla = PlantillaDocumentoService.get_by_id(db, plantilla_id=request.plantilla_id)
        if plantilla:
            merged_variables = _format_currency_variables(merged_variables, plantilla)
    try:
        pdf_base64 = PDFService.generate_pdf_base64(
            html_content=html_content,
            page_size=request.page_size,
            orientation=request.orientation,
            margin_top=request.margin_top or "1cm",
            margin_bottom=request.margin_bottom or "1cm",
            margin_left=request.margin_left or "1cm",
            margin_right=request.margin_right or "1cm",
            custom_css=request.custom_css,
            variables=merged_variables or None
        )
        
        filename = request.filename or "documento"
        if not filename.endswith('.pdf'):
            filename += '.pdf'
        
        return PDFResponse(
            success=True,
            message="PDF generado exitosamente",
            pdf_base64=pdf_base64,
            filename=filename
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al generar PDF: {str(e)}"
        )


@router.post("/generate-from-template", response_model=PDFResponse)
async def generate_pdf_from_template(
    request: PDFGenerateFromTemplateRequest,
    current_user: User = Depends(require_permiso("siniestros", "generar_pdf")),
    db: Session = Depends(get_db)
):
    """
    Genera un PDF desde una plantilla de documento guardada
    
    - **plantilla_id**: ID de la plantilla de documento a usar
    - **variables**: Variables para reemplazar en la plantilla
    - **page_size**: Tamaño de página
    - **orientation**: Orientación
    """
    try:
        # Obtener la plantilla de documento
        plantilla = PlantillaDocumentoService.get_by_id(db, plantilla_id=request.plantilla_id)
        
        if not plantilla:
            raise HTTPException(
                status_code=404,
                detail="Plantilla de documento no encontrada"
            )
        
        if not plantilla.activo:
            raise HTTPException(
                status_code=400,
                detail="La plantilla de documento está inactiva"
            )
        
        if not plantilla.contenido:
            raise HTTPException(
                status_code=400,
                detail="La plantilla de documento no tiene contenido"
            )

        # Variables: siniestro/asegurado + formulario + request
        merged_variables: dict = dict(request.variables or {})
        if request.siniestro_id:
            try:
                sid = PyUUID(str(request.siniestro_id))
                empresa_id = _empresa_id_from_user(current_user)
                siniestro_vars = _get_siniestro_asegurado_variables(db, sid, empresa_id)
                merged_variables = {**siniestro_vars, **merged_variables}
            except (ValueError, TypeError):
                pass
            respuesta = RespuestaFormularioService.get_or_none(
                db,
                plantilla_id=PyUUID(str(request.plantilla_id)),
                siniestro_id=PyUUID(str(request.siniestro_id)),
            )
            if respuesta and respuesta.valores:
                merged_variables = {**respuesta.valores, **merged_variables}

        merged_variables = _expand_datetime_variables(merged_variables)
        merged_variables = _format_currency_variables(merged_variables, plantilla)

        pdf_opts = dict(
            page_size=request.page_size,
            orientation=request.orientation,
            margin_top=request.margin_top or "1cm",
            margin_bottom=request.margin_bottom or "1cm",
            margin_left=request.margin_left or "1cm",
            margin_right=request.margin_right or "1cm",
            custom_css=request.custom_css,
            variables=merged_variables or None,
        )

        # Si hay plantilla de continuación, cada plantilla lleva su propio header solo en sus páginas (evitar que se encimen)
        segunda = None
        if getattr(plantilla, "plantilla_continuacion_id", None):
            seg = PlantillaDocumentoService.get_by_id(db, plantilla_id=plantilla.plantilla_continuacion_id)
            if seg and getattr(seg, "activo", True) and getattr(seg, "contenido", None):
                segunda = seg

        if segunda:
            html1 = _build_section_html(db, plantilla, current_user)
            html2 = _build_section_html(db, segunda, current_user)
            pdf1 = PDFService.generate_pdf(html_content=html1, **pdf_opts)
            pdf2 = PDFService.generate_pdf(html_content=html2, **pdf_opts)
            pdf_bytes = _merge_pdfs([pdf1, pdf2])
            pdf_base64 = base64.b64encode(pdf_bytes).decode("utf-8")
        else:
            html_content = _build_full_html_from_plantilla(db, plantilla, current_user, header_on_every_page=True)
            pdf_base64 = PDFService.generate_pdf_base64(html_content=html_content, **pdf_opts)

        filename = request.filename or plantilla.nombre or "documento"
        if not filename.endswith('.pdf'):
            filename += '.pdf'
        
        return PDFResponse(
            success=True,
            message="PDF generado exitosamente desde plantilla",
            pdf_base64=pdf_base64,
            filename=filename
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al generar PDF desde plantilla: {str(e)}"
        )


@router.post("/download")
async def download_pdf(
    request: PDFGenerateRequest,
    current_user: User = Depends(require_permiso("siniestros", "generar_pdf")),
    db: Session = Depends(get_db)
):
    """
    Genera y descarga un PDF directamente.
    Si se envía plantilla_id, se antepone el header de la plantilla (con logo); el header se repite en todas las páginas.
    """
    merged_variables = dict(request.variables or {})
    if getattr(request, "siniestro_id", None):
        try:
            sid = PyUUID(str(request.siniestro_id))
            empresa_id = _empresa_id_from_user(current_user)
            siniestro_vars = _get_siniestro_asegurado_variables(db, sid, empresa_id)
            merged_variables = {**siniestro_vars, **merged_variables}
        except (ValueError, TypeError):
            pass

    html_content = request.html_content
    if getattr(request, "plantilla_id", None):
        plantilla = PlantillaDocumentoService.get_by_id(db, plantilla_id=request.plantilla_id)
        if plantilla:
            if getattr(request, "siniestro_id", None):
                respuesta = RespuestaFormularioService.get_or_none(
                    db,
                    plantilla_id=PyUUID(request.plantilla_id),
                    siniestro_id=PyUUID(request.siniestro_id),
                )
                if respuesta and respuesta.valores:
                    merged_variables = {**respuesta.valores, **merged_variables}
            merged_variables = _expand_datetime_variables(merged_variables)
            merged_variables = _format_currency_variables(merged_variables, plantilla)
            pdf_opts = dict(
                page_size=request.page_size,
                orientation=request.orientation,
                margin_top=request.margin_top or "1cm",
                margin_bottom=request.margin_bottom or "1cm",
                margin_left=request.margin_left or "1cm",
                margin_right=request.margin_right or "1cm",
                custom_css=request.custom_css,
                variables=merged_variables,
            )
            segunda = None
            if getattr(plantilla, "plantilla_continuacion_id", None):
                seg = PlantillaDocumentoService.get_by_id(db, plantilla_id=plantilla.plantilla_continuacion_id)
                if seg and getattr(seg, "activo", True) and getattr(seg, "contenido", None):
                    segunda = seg
            if segunda:
                html1 = _build_section_html(db, plantilla, current_user, body_override=request.html_content)
                html2 = _build_section_html(db, segunda, current_user)
                pdf1 = PDFService.generate_pdf(html_content=html1, **pdf_opts)
                pdf2 = PDFService.generate_pdf(html_content=html2, **pdf_opts)
                pdf_bytes = _merge_pdfs([pdf1, pdf2])
                filename = request.filename or "documento"
                if not filename.endswith('.pdf'):
                    filename += '.pdf'
                return StreamingResponse(
                    io.BytesIO(pdf_bytes),
                    media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'}
                )
            header_html = ""
            if plantilla.header_plantilla_id:
                header = PlantillaDocumentoService.get_by_id(db, plantilla_id=plantilla.header_plantilla_id)
                if header and header.activo and header.contenido:
                    header_html = _build_header_html_with_logo(db, header.contenido, current_user, header_plantilla=header) + "\n"
            body_content = request.html_content
            if header_html:
                html_content = _wrap_header_for_all_pages(header_html, body_content)
            else:
                html_content = body_content
            if not plantilla.header_plantilla_id:
                html_content = _prepend_logo_if_empresa_has_one(db, html_content, current_user)
    merged_variables = _expand_datetime_variables(merged_variables)
    if getattr(request, "plantilla_id", None):
        plantilla = PlantillaDocumentoService.get_by_id(db, plantilla_id=request.plantilla_id)
        if plantilla:
            merged_variables = _format_currency_variables(merged_variables, plantilla)
    try:
        pdf_bytes = PDFService.generate_pdf(
            html_content=html_content,
            page_size=request.page_size,
            orientation=request.orientation,
            margin_top=request.margin_top or "1cm",
            margin_bottom=request.margin_bottom or "1cm",
            margin_left=request.margin_left or "1cm",
            margin_right=request.margin_right or "1cm",
            custom_css=request.custom_css,
            variables=merged_variables
        )
        filename = request.filename or "documento"
        if not filename.endswith('.pdf'):
            filename += '.pdf'
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al generar PDF: {str(e)}"
        )


@router.post("/download-from-template")
async def download_pdf_from_template(
    request: PDFGenerateFromTemplateRequest,
    current_user: User = Depends(require_permiso("siniestros", "generar_pdf")),
    db: Session = Depends(get_db)
):
    """
    Genera y descarga un PDF desde una plantilla de documento
    
    Retorna el PDF como archivo descargable
    """
    try:
        # Obtener la plantilla
        plantilla = PlantillaDocumentoService.get_by_id(db, plantilla_id=request.plantilla_id)
        
        if not plantilla:
            raise HTTPException(
                status_code=404,
                detail="Plantilla de documento no encontrada"
            )
        
        if not plantilla.activo:
            raise HTTPException(
                status_code=400,
                detail="La plantilla de documento está inactiva"
            )
        
        if not plantilla.contenido:
            raise HTTPException(
                status_code=400,
                detail="La plantilla de documento no tiene contenido"
            )

        merged_variables = dict(request.variables or {})
        if request.siniestro_id:
            try:
                sid = PyUUID(str(request.siniestro_id))
                empresa_id = _empresa_id_from_user(current_user)
                siniestro_vars = _get_siniestro_asegurado_variables(db, sid, empresa_id)
                merged_variables = {**siniestro_vars, **merged_variables}
            except (ValueError, TypeError):
                pass
            respuesta = RespuestaFormularioService.get_or_none(
                db,
                plantilla_id=PyUUID(str(request.plantilla_id)),
                siniestro_id=PyUUID(str(request.siniestro_id)),
            )
            if respuesta and respuesta.valores:
                merged_variables = {**respuesta.valores, **merged_variables}
        merged_variables = _expand_datetime_variables(merged_variables)
        merged_variables = _format_currency_variables(merged_variables, plantilla)

        pdf_opts = dict(
            page_size=request.page_size,
            orientation=request.orientation,
            margin_top=request.margin_top or "1cm",
            margin_bottom=request.margin_bottom or "1cm",
            margin_left=request.margin_left or "1cm",
            margin_right=request.margin_right or "1cm",
            custom_css=request.custom_css,
            variables=merged_variables,
        )

        segunda = None
        if getattr(plantilla, "plantilla_continuacion_id", None):
            seg = PlantillaDocumentoService.get_by_id(db, plantilla_id=plantilla.plantilla_continuacion_id)
            if seg and getattr(seg, "activo", True) and getattr(seg, "contenido", None):
                segunda = seg

        if segunda:
            html1 = _build_section_html(db, plantilla, current_user)
            html2 = _build_section_html(db, segunda, current_user)
            pdf1 = PDFService.generate_pdf(html_content=html1, **pdf_opts)
            pdf2 = PDFService.generate_pdf(html_content=html2, **pdf_opts)
            pdf_bytes = _merge_pdfs([pdf1, pdf2])
        else:
            html_content = _build_full_html_from_plantilla(db, plantilla, current_user, header_on_every_page=True)
            pdf_bytes = PDFService.generate_pdf(html_content=html_content, **pdf_opts)

        filename = request.filename or plantilla.nombre or "documento"
        if not filename.endswith('.pdf'):
            filename += '.pdf'

        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al generar PDF desde plantilla: {str(e)}"
        )


def generar_pdf_bytes_para_documento(
    db: Session,
    documento_id: PyUUID,
    current_user: User,
) -> Optional[Tuple[bytes, str]]:
    """
    Genera el PDF de un informe para adjuntar en correo u otros usos.
    Retorna (bytes_pdf, nombre_archivo) o None.

    Prioridad:
    1) HTML guardado en documento.contenido (igual que la vista previa en el frontend).
    2) Generación solo desde la plantilla en catálogo (si el documento aún no tiene cuerpo guardado).
    """
    from app.services.legal_service import DocumentoService

    doc = DocumentoService.get_by_id(db, documento_id)
    if not doc or not getattr(doc, "plantilla_documento_id", None):
        return None
    plantilla = PlantillaDocumentoService.get_by_id(
        db, plantilla_id=doc.plantilla_documento_id
    )
    if not plantilla or not getattr(plantilla, "activo", True):
        return None

    siniestro_id = doc.siniestro_id
    merged_variables: Dict[str, Any] = {}
    empresa_id = _empresa_id_from_user(current_user)
    siniestro = (
        SiniestroService.get_by_id(db, siniestro_id, empresa_id)
        if empresa_id
        else None
    )
    siniestro_vars = _get_siniestro_asegurado_variables(db, siniestro_id, empresa_id)
    merged_variables = {**siniestro_vars}
    respuesta = RespuestaFormularioService.get_or_none(
        db,
        plantilla_id=doc.plantilla_documento_id,
        siniestro_id=siniestro_id,
    )
    if respuesta and respuesta.valores:
        merged_variables = {**merged_variables, **respuesta.valores}
    merged_variables = _expand_datetime_variables(merged_variables)
    merged_variables = _format_currency_variables(merged_variables, plantilla)
    # Tras expandir fechas y moneda: mismas claves que getVariablesForPdf (frontend) para {{variable}}
    merged_variables = {
        **merged_variables,
        **_variables_plantilla_alineadas_frontend(
            db, doc, siniestro, current_user, empresa_id
        ),
    }
    pdf_opts = dict(
        page_size=PageSize.A4,
        orientation=PageOrientation.PORTRAIT,
        margin_top="1cm",
        margin_bottom="1cm",
        margin_left="1cm",
        margin_right="1cm",
        variables=merged_variables,
    )

    # 1) Informe editado: el cuerpo vive en documento.contenido (no exigir plantilla.contenido).
    from_contenido = _try_pdf_from_document_contenido(
        db, doc, current_user, plantilla, pdf_opts
    )
    if from_contenido:
        return from_contenido

    # 2) Fallback: armar solo desde plantilla (p. ej. documento nuevo sin guardar cuerpo).
    if not getattr(plantilla, "contenido", None) or not str(plantilla.contenido).strip():
        logger.warning(
            "Sin PDF para documento %s: no hay contenido en documento ni cuerpo en plantilla",
            documento_id,
        )
        return None

    segunda = None
    if getattr(plantilla, "plantilla_continuacion_id", None):
        seg = PlantillaDocumentoService.get_by_id(
            db, plantilla_id=plantilla.plantilla_continuacion_id
        )
        if seg and getattr(seg, "activo", True) and getattr(seg, "contenido", None):
            segunda = seg
    try:
        if segunda:
            html1 = _build_section_html(db, plantilla, current_user)
            html2 = _build_section_html(db, segunda, current_user)
            pdf1 = PDFService.generate_pdf(html_content=html1, **pdf_opts)
            pdf2 = PDFService.generate_pdf(html_content=html2, **pdf_opts)
            pdf_bytes = _merge_pdfs([pdf1, pdf2])
        else:
            html_content = _build_full_html_from_plantilla(
                db, plantilla, current_user, header_on_every_page=True
            )
            pdf_bytes = PDFService.generate_pdf(html_content=html_content, **pdf_opts)
        base_name = (
            doc.nombre_archivo or getattr(plantilla, "nombre", None) or "documento"
        ).strip()
        if not base_name.lower().endswith(".pdf"):
            base_name += ".pdf"
        return (pdf_bytes, base_name)
    except Exception as exc:
        logger.exception("generar_pdf_bytes_para_documento (plantilla): %s", exc)
        return None

