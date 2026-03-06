"""
Rutas para generación de PDFs
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import get_current_user
from app.core.permisos import require_permiso
from app.schemas.pdf_schema import (
    PDFGenerateRequest,
    PDFGenerateFromTemplateRequest,
    PDFResponse
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
from typing import Optional, Any, Dict, Tuple
from datetime import datetime as dt
from uuid import UUID as PyUUID
import re
import io
import base64
from pypdf import PdfReader, PdfWriter

router = APIRouter()

# Altura reservada para el header fijo (repetido en todas las páginas)
PDF_HEADER_MARGIN_TOP = "3.5cm"


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
    out["fecha_reporte"] = getattr(siniestro, "fecha_registro", None)
    out["fecha_asignacion"] = getattr(siniestro, "fecha_siniestro", None)
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
    """Envuelve el header en un bloque fijo (repetido en todas las páginas) y el cuerpo con margen superior."""
    header_block = (
        f'<div class="pdf-page-header" style="position: fixed; top: 0; left: 0; right: 0; z-index: 1; background: white;">'
        f"{header_html.strip()}</div>"
    )
    body_block = f'<div class="pdf-body-content" style="margin-top: {PDF_HEADER_MARGIN_TOP};">{body_html}</div>'
    return header_block + "\n" + body_block


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
    Genera el PDF de un documento que tiene plantilla (informe).
    Retorna (bytes, nombre_archivo) o None si el documento no es un informe o falla la generación.
    """
    from app.services.legal_service import DocumentoService

    doc = DocumentoService.get_by_id(db, documento_id)
    if not doc or not getattr(doc, "plantilla_documento_id", None):
        return None
    plantilla = PlantillaDocumentoService.get_by_id(db, plantilla_id=doc.plantilla_documento_id)
    if not plantilla or not getattr(plantilla, "activo", True) or not getattr(plantilla, "contenido", None):
        return None
    siniestro_id = doc.siniestro_id
    merged_variables = {}
    empresa_id = _empresa_id_from_user(current_user)
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
    pdf_opts = dict(
        page_size="A4",
        margin_top="1cm",
        margin_bottom="1cm",
        margin_left="1cm",
        margin_right="1cm",
        variables=merged_variables,
    )
    segunda = None
    if getattr(plantilla, "plantilla_continuacion_id", None):
        seg = PlantillaDocumentoService.get_by_id(db, plantilla_id=plantilla.plantilla_continuacion_id)
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
            html_content = _build_full_html_from_plantilla(db, plantilla, current_user, header_on_every_page=True)
            pdf_bytes = PDFService.generate_pdf(html_content=html_content, **pdf_opts)
        base_name = (doc.nombre_archivo or getattr(plantilla, "nombre", None) or "documento").strip()
        if not base_name.lower().endswith(".pdf"):
            base_name += ".pdf"
        return (pdf_bytes, base_name)
    except Exception:
        return None

