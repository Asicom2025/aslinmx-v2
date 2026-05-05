"""
Rutas para generación de PDFs
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.core.permisos import require_permiso
from app.schemas.pdf_schema import (
    PDFGenerateRequest,
    PDFGenerateFromTemplateRequest,
    PDFResponse,
    PageSize,
    PageOrientation,
)
from app.schemas.storage_schema import GeneratedFileAccessResponse
from app.services.generated_file_service import (
    ArchivoGeneradoService,
    build_generated_file_access_payload,
)
from app.services.storage_service import format_siniestro_id_legible
from app.services.storage_service import get_storage_service
from app.services.pdf_service import PDFService
from app.services.legal_service import (
    PlantillaDocumentoService,
    RespuestaFormularioService,
    SiniestroService,
    AseguradoService,
)
from app.services.empresa_service import EmpresaService
from app.models.user import User
from app.models.geo_models import GeoEstado, GeoMunicipio
from app.models.legal import (
    Area,
    Proveniente,
    SiniestroArea,
    SiniestroUsuario,
    Institucion,
    Autoridad,
    EstadoSiniestro,
    RespuestaFormularioPlantilla,
    CalificacionSiniestro,
)
from typing import Optional, Any, Dict, Tuple
from datetime import datetime as dt
from uuid import UUID as PyUUID
import os
import re
import io
import base64
import html
import logging
from urllib.parse import unquote_plus
from pathlib import Path
from pypdf import PdfReader, PdfWriter

logger = logging.getLogger(__name__)

router = APIRouter()

# Espacio reservado en @page para el running header (logo hasta 120px + texto/tablas).
# Menos de ~4cm suele solapar el cuerpo con el encabezado en WeasyPrint.
PDF_HEADER_MARGIN_TOP = "4.8cm"

_PDF_IMAGE_VAR_KEYS = {"firma", "firma_digital", "foto_de_perfil"}
_PDF_MIME_BY_EXT = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
}


def _pdf_debug_html_enabled() -> bool:
    """Activa trazas del HTML enviado a WeasyPrint: export PDF_DEBUG_HTML=1 (o true/yes/on)."""
    v = (os.environ.get("PDF_DEBUG_HTML") or "").strip().lower()
    return v in ("1", "true", "yes", "on")


def _pdf_debug_log_html(tag: str, html: Optional[str], max_chars: int = 12000) -> None:
    """Escribe en log (WARNING) un fragmento del HTML; solo si PDF_DEBUG_HTML está activo."""
    if not _pdf_debug_html_enabled():
        return
    s = html if html is not None else ""
    tail = "..." if len(s) > max_chars else ""
    logger.warning(
        "PDF_DEBUG_HTML [%s] length=%s\n%s%s",
        tag,
        len(s),
        s[:max_chars],
        tail,
    )


def _maybe_storage_path_to_data_url(raw_value: str) -> Optional[str]:
    raw = (raw_value or "").strip()
    if not raw:
        return None
    if raw.startswith("data:") or raw.startswith("http://") or raw.startswith("https://"):
        return raw
    if not (raw.startswith("r2://") or "/" in raw):
        return raw
    try:
        content = get_storage_service().get_bytes(raw)
    except Exception:
        return raw
    ext = raw.rsplit(".", 1)[-1].lower() if "." in raw else ""
    mime = _PDF_MIME_BY_EXT.get(ext, "image/png")
    return f"data:{mime};base64,{base64.b64encode(content).decode('utf-8')}"


def _perfil_firma_src_for_pdf_img(raw_value: Optional[str]) -> str:
    """
    Convierte perfil.firma (data URL, http(s), clave R2 u objeto con /, o base64 plano)
    a un src usable en <img> dentro del HTML del PDF.
    """
    raw = (raw_value or "").strip()
    if not raw:
        return ""
    if raw.startswith("data:") or raw.startswith("http://") or raw.startswith("https://"):
        return raw
    converted = _maybe_storage_path_to_data_url(raw)
    if isinstance(converted, str) and (
        converted.startswith("data:") or converted.startswith("http://") or converted.startswith("https://")
    ):
        return converted
    if raw.startswith("r2://") or "/" in raw:
        return ""
    return f"data:image/png;base64,{raw}"


def _normalize_pdf_image_variables(variables: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(variables or {})
    for key in _PDF_IMAGE_VAR_KEYS:
        value = out.get(key)
        if isinstance(value, str) and value.strip():
            out[key] = _maybe_storage_path_to_data_url(value)
    return out


def _decode_possible_urlencoded_textarea_value(value: Any) -> Any:
    """
    Decodifica textos potencialmente codificados con urlencode/urlencode_plus
    (legado PHP), sin afectar valores normales.
    """
    if value is None or not isinstance(value, str):
        return value
    trimmed = value.strip()
    if not trimmed or "%" not in trimmed:
        return value
    decoded = trimmed
    for _ in range(2):
        candidate = unquote_plus(decoded)
        if candidate == decoded:
            break
        decoded = candidate
    # Aceptar decodificación solo si realmente hubo cambio.
    if decoded != trimmed:
        return decoded
    return value


def _normalize_textarea_variables(
    variables: Dict[str, Any],
    plantilla: Any,
) -> Dict[str, Any]:
    """
    Normaliza campos tipo textarea y html (texto enriquecido) del formulario de plantilla.
    """
    if not plantilla or not getattr(plantilla, "campos_formulario", None):
        return dict(variables or {})
    campos = plantilla.campos_formulario or []
    textarea_keys = {
        c.get("clave")
        for c in campos
        if c.get("tipo") in ("textarea", "html")
    }
    if not textarea_keys:
        return dict(variables or {})
    out = dict(variables or {})
    for key in textarea_keys:
        if key in out:
            out[key] = _decode_possible_urlencoded_textarea_value(out.get(key))
    return out


def _get_poliza_principal(siniestro: Any) -> Optional[Any]:
    polizas = sorted(
        list(getattr(siniestro, "polizas", []) or []),
        key=lambda poliza: (
            0 if getattr(poliza, "es_principal", False) else 1,
            getattr(poliza, "orden", 0) or 0,
            getattr(poliza, "creado_en", None),
        ),
    )
    return polizas[0] if polizas else None


def _id_legible_para_plantillas(db: Session, siniestro: Any) -> str:
    """ID legible del expediente ({{id}}, {{ID}}) — mismo criterio que el frontend."""
    if not siniestro:
        return ""
    raw_id_fmt = (getattr(siniestro, "id_formato", None) or "").strip()
    if raw_id_fmt:
        return raw_id_fmt
    codigo_prov = ""
    if getattr(siniestro, "proveniente_id", None):
        prov = (
            db.query(Proveniente)
            .filter(Proveniente.id == siniestro.proveniente_id)
            .first()
        )
        if prov and getattr(prov, "codigo", None):
            codigo_prov = str(prov.codigo).strip()
    sc = (getattr(siniestro, "codigo", None) or "").strip()
    return (
        format_siniestro_id_legible(
            codigo_prov,
            sc,
            anualidad_column=getattr(siniestro, "anualidad", None),
            fecha_registro=getattr(siniestro, "fecha_registro", None),
            fecha_siniestro=getattr(siniestro, "fecha_siniestro", None),
        )
        or ""
    )


def _nombre_calificacion_siniestro(
    db: Session, empresa_id: Optional[PyUUID], calificacion_id: Any
) -> str:
    """Nombre de la calificación asignada ({{calificacion}})."""
    if not empresa_id or not calificacion_id:
        return ""
    try:
        cid = (
            calificacion_id
            if isinstance(calificacion_id, PyUUID)
            else PyUUID(str(calificacion_id))
        )
    except (ValueError, TypeError):
        return ""
    row = (
        db.query(CalificacionSiniestro)
        .filter(
            CalificacionSiniestro.id == cid,
            CalificacionSiniestro.empresa_id == empresa_id,
        )
        .first()
    )
    if row and getattr(row, "nombre", None):
        return str(row.nombre).strip()
    return ""


def _merge_aliases_plantilla_estandar(
    db: Session,
    siniestro: Any,
    empresa_id: Optional[PyUUID],
    out: Dict[str, Any],
) -> None:
    """
    Alias y claves adicionales usadas en plantillas / informes / PDF:
    {{ID}}, {{numero_de_reporte}}, {{numero_de_siniestro}}, {{calificacion}},
    {{poliza_principal_numero}} (refuerzo si faltara).
    """
    if not siniestro:
        return
    ileg = _id_legible_para_plantillas(db, siniestro)
    out["id"] = ileg
    out["ID"] = ileg
    out["numero_de_reporte"] = str(getattr(siniestro, "numero_reporte", None) or "").strip()
    out["numero_de_siniestro"] = str(getattr(siniestro, "numero_siniestro", None) or "").strip()
    out["calificacion"] = _nombre_calificacion_siniestro(
        db, empresa_id, getattr(siniestro, "calificacion_id", None)
    )
    pp = _get_poliza_principal(siniestro)
    np = (getattr(pp, "numero_poliza", None) or "").strip() if pp else ""
    if np:
        out["poliza_principal_numero"] = np


def _informe_variables_catalogo_extendido(
    db: Session,
    siniestro: Any,
    empresa_id: Optional[PyUUID],
) -> Dict[str, str]:
    """
    Variables {{...}} estándar para informes / plantillas (alineadas con el detalle de siniestro):
    poliza_principal_numero, institucion, tercero, autoridad, celular, correo_electrónico (+ alias ASCII).
    """
    out: Dict[str, str] = {}
    if not siniestro:
        return out

    poliza_principal = _get_poliza_principal(siniestro)
    np = (
        (getattr(poliza_principal, "numero_poliza", None) or "").strip()
        if poliza_principal
        else ""
    )
    out["poliza_principal_numero"] = np

    tv = getattr(siniestro, "tercero", None)
    out["tercero"] = str(tv).strip() if tv is not None and str(tv).strip() else ""

    inst_nombre = ""
    if getattr(siniestro, "institucion_id", None):
        inst = (
            db.query(Institucion)
            .filter(Institucion.id == siniestro.institucion_id)
            .first()
        )
        if inst and getattr(inst, "nombre", None):
            inst_nombre = str(inst.nombre).strip()
    out["institucion"] = inst_nombre

    aut_nombre = ""
    if getattr(siniestro, "autoridad_id", None):
        aut = (
            db.query(Institucion)
            .filter(Institucion.id == siniestro.autoridad_id)
            .first()
        )
        if not aut:
            aut = (
                db.query(Autoridad)
                .filter(Autoridad.id == siniestro.autoridad_id)
                .first()
            )
        if aut and getattr(aut, "nombre", None):
            aut_nombre = str(aut.nombre).strip()
    out["autoridad"] = aut_nombre

    cel = ""
    corr = ""
    if empresa_id and getattr(siniestro, "asegurado_id", None):
        aseg = AseguradoService.get_by_id(db, siniestro.asegurado_id, empresa_id)
        if aseg:
            cel = (
                (getattr(aseg, "telefono", None) or "").strip()
                or (getattr(aseg, "tel_oficina", None) or "").strip()
                or (getattr(aseg, "tel_casa", None) or "").strip()
            )
            corr = (getattr(aseg, "correo", None) or "").strip()
    out["celular"] = cel
    out["correo_electrónico"] = corr
    out["correo_electronico"] = corr
    return out


# Tabla completa (table/tbody). table-layout:auto + salto de línea para títulos largos.
# Alineado con frontend/calificacionTablaPlaceholders.ts
_CALIF_TABLE_CLASS = "calificaciones-siniestro-dinamica"
_CALIF_TABLE_STYLE = (
    "width:100%;max-width:100%;border-collapse:collapse;table-layout:auto;"
    "margin:0.75em 0;border:1px solid #000;"
)
_CALIF_HEADER_BG = "#7de8ff"
_CALIF_TD_HEADER_BASE = (
    "border:1px solid #000;padding:10px 8px;text-align:center;"
    "font-weight:bold;text-transform:uppercase;vertical-align:middle;box-sizing:border-box;"
    "white-space:normal;word-break:break-word;overflow-wrap:anywhere;line-height:1.35;"
    f"min-width:4.75rem;background-color:{_CALIF_HEADER_BG};color:#333;"
)
_CALIF_TD_DATA_BASE = (
    "border:1px solid #000;padding:10px 8px;text-align:center;font-size:13px;"
    "vertical-align:middle;box-sizing:border-box;white-space:normal;"
    "min-width:4.75rem;line-height:1.4;background-color:#fff;color:#333;"
)


def _calif_header_font_px(n: int) -> int:
    if n > 8:
        return 9
    if n > 5:
        return 10
    return 11


def _merge_calificacion_placeholders(
    db: Session,
    empresa_id: Optional[PyUUID],
    calificacion_siniestro_id: Any,
) -> Dict[str, str]:
    """
    Catálogo: una celda por calificación no eliminada (orden + nombre).
    (X) solo en la columna cuyo id coincide con la calificación del siniestro.
    {{calificaciones_tabla_dos_filas_html}} inserta **tabla completa** (table/tbody/2 tr).
    Preferir solo ese placeholder (funciona aunque quede dentro de un &lt;p&gt; del editor).

    {{calificaciones_headers_html}} / {{calificaciones_marcas_html}} = solo &lt;td&gt;…
    (úsalos solo dentro de un &lt;tr&gt; de **tu** tabla; si no, el texto se concatena).
    """
    out: Dict[str, str] = {}
    sid: Optional[PyUUID] = None
    if calificacion_siniestro_id is not None:
        try:
            sid = (
                calificacion_siniestro_id
                if isinstance(calificacion_siniestro_id, PyUUID)
                else PyUUID(str(calificacion_siniestro_id))
            )
        except (ValueError, TypeError):
            sid = None

    headers: list[str] = []
    marks: list[str] = []
    rows: list = []
    if empresa_id:
        rows = (
            db.query(CalificacionSiniestro)
            .filter(
                CalificacionSiniestro.empresa_id == empresa_id,
                CalificacionSiniestro.eliminado_en.is_(None),
            )
            .order_by(
                CalificacionSiniestro.orden.asc(),
                CalificacionSiniestro.nombre.asc(),
            )
            .all()
        )
    n = len(rows)
    fpx = _calif_header_font_px(n)
    for cal in rows:
        nombre_raw = str(cal.nombre or "").strip().upper()
        nombre = html.escape(nombre_raw)
        st_h = f"{_CALIF_TD_HEADER_BASE}font-size:{fpx}px;"
        headers.append(
            f'<td class="header-cell text-center" colspan="1" style="{st_h}">{nombre}</td>'
        )
        mark = "(X)" if sid and cal.id == sid else ""
        st_d = _CALIF_TD_DATA_BASE
        marks.append(
            f'<td class="data-cell text-center" colspan="1" style="{st_d}">{mark}</td>'
        )
    h_inner = "".join(headers)
    m_inner = "".join(marks)
    out["calificaciones_headers_html"] = h_inner
    out["calificaciones_marcas_html"] = m_inner
    inner_rows = f"<tr>\n{h_inner}\n</tr>\n<tr>\n{m_inner}\n</tr>"
    if n == 0:
        out["calificaciones_tabla_dos_filas_html"] = ""
    else:
        out["calificaciones_tabla_dos_filas_html"] = (
            f'<table lang="es" class="{_CALIF_TABLE_CLASS}" style="{_CALIF_TABLE_STYLE}">'
            f"<tbody>{inner_rows}</tbody></table>"
        )
    return out


def _get_siniestro_asegurado_variables(
    db: Session, siniestro_id: PyUUID, empresa_id: Optional[PyUUID]
) -> Dict[str, Any]:
    """
    Variables para PDF desde siniestro y asegurado (header y cuerpo).
    - numero_poliza, numero_siniestro: del siniestro
    - poliza_principal_numero, institucion, tercero, autoridad, celular,
      correo_electrónico / correo_electronico: catálogo extendido (informes)
    - lugar_ocurrido: dirección del asegurado (ciudad, estado)
    - fecha_reporte, hora_fecha_reporte: de `fecha_reporte` / `fecha_registro` / `fecha_siniestro`
    - fecha_asignacion: de `siniestros.fecha_asignacion` o relación `siniestro_areas`
    """
    out = {}
    if not empresa_id:
        return out
    siniestro = SiniestroService.get_by_id(db, siniestro_id, empresa_id)
    if not siniestro:
        return out
    poliza_principal = _get_poliza_principal(siniestro)
    out["numero_poliza"] = (
        (getattr(poliza_principal, "numero_poliza", None) or "").strip()
        if poliza_principal
        else ""
    )
    out["numero_siniestro"] = (siniestro.numero_siniestro or "").strip()

    # fecha_reporte (columna) → fecha_registro → fecha_siniestro
    fecha_reg = (
        getattr(siniestro, "fecha_reporte", None)
        or getattr(siniestro, "fecha_registro", None)
        or getattr(siniestro, "fecha_siniestro", None)
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
            SiniestroArea.eliminado == False,  # noqa: E712
        )
        .order_by(SiniestroArea.fecha_asignacion.desc())
        .first()
    )
    out["fecha_asignacion"] = getattr(siniestro, "fecha_asignacion", None) or getattr(
        area_asig, "fecha_asignacion", None
    )
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
                ciudad_nom = None
                estado_nom = None
                if getattr(asegurado, "municipio_id", None):
                    gm = (
                        db.query(GeoMunicipio)
                        .filter(GeoMunicipio.id == asegurado.municipio_id)
                        .first()
                    )
                    if gm and getattr(gm, "nombre", None):
                        ciudad_nom = str(gm.nombre).strip()
                if getattr(asegurado, "estado_geografico_id", None):
                    ge = (
                        db.query(GeoEstado)
                        .filter(GeoEstado.id == asegurado.estado_geografico_id)
                        .first()
                    )
                    if ge and getattr(ge, "nombre", None):
                        estado_nom = str(ge.nombre).strip()
                if not estado_nom and getattr(asegurado, "municipio_id", None):
                    gm2 = (
                        db.query(GeoMunicipio)
                        .filter(GeoMunicipio.id == asegurado.municipio_id)
                        .first()
                    )
                    if gm2 and getattr(gm2, "estado_id", None):
                        ge2 = (
                            db.query(GeoEstado)
                            .filter(GeoEstado.id == gm2.estado_id)
                            .first()
                        )
                        if ge2 and getattr(ge2, "nombre", None):
                            estado_nom = str(ge2.nombre).strip()
                partes = [ciudad_nom, estado_nom]
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

    out.update(
        _merge_calificacion_placeholders(
            db, empresa_id, getattr(siniestro, "calificacion_id", None)
        )
    )
    out.update(_informe_variables_catalogo_extendido(db, siniestro, empresa_id))
    _merge_aliases_plantilla_estandar(db, siniestro, empresa_id, out)

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

    # Nombre y firma: por área (siniestro_areas.abogado_principal_informe_id) según el ámbito
    # del documento; si no hay, tercero es_principal (legado); si no, quien subió el doc o usuario actual.
    vars_user_id = None
    if getattr(doc, "area_id", None) and getattr(siniestro, "id", None) is not None:
        sa_firma = (
            db.query(SiniestroArea)
            .filter(
                SiniestroArea.siniestro_id == siniestro.id,
                SiniestroArea.area_id == doc.area_id,
                SiniestroArea.activo == True,  # noqa: E712
                SiniestroArea.eliminado == False,  # noqa: E712
            )
            .order_by(SiniestroArea.fecha_asignacion.desc())
            .first()
        )
        if sa_firma and getattr(sa_firma, "abogado_principal_informe_id", None):
            vars_user_id = sa_firma.abogado_principal_informe_id
    if vars_user_id is None:
        principal_ab = (
            db.query(SiniestroUsuario)
            .filter(
                SiniestroUsuario.siniestro_id == siniestro.id,
                SiniestroUsuario.es_principal == True,  # noqa: E712
                SiniestroUsuario.activo == True,  # noqa: E712
                SiniestroUsuario.eliminado == False,  # noqa: E712
            )
            .first()
        )
        if principal_ab and getattr(principal_ab, "usuario_id", None):
            vars_user_id = principal_ab.usuario_id
    if vars_user_id is None:
        vars_user_id = (
            getattr(doc, "usuario_subio", None) or getattr(current_user, "id", None)
        )

    autor = ""
    u = None
    try:
        u = (
            db.query(User)
            .options(joinedload(User.perfil))
            .filter(User.id == vars_user_id)
            .first()
        )
        if u:
            fn = u.full_name
            autor = (fn or "").strip() if fn else (u.correo or "").strip()
    except Exception:
        autor = (getattr(current_user, "correo", None) or "").strip()

    firma_html = "---"
    try:
        if u and getattr(u, "perfil", None):
            src = _perfil_firma_src_for_pdf_img(getattr(u.perfil, "firma", None))
            if src:
                firma_html = (
                    '<img src="'
                    + src.replace('"', "&quot;")
                    + '" alt="Firma" class="pdf-firma" style="width:60px;max-width:60px;height:auto;"/>'
                )
    except Exception:
        firma_html = "---"

    id_formato = _id_legible_para_plantillas(db, siniestro)

    creado_src = (
        getattr(doc, "creado_en", None)
        or getattr(siniestro, "fecha_registro", None)
        or getattr(siniestro, "creado_en", None)
    )
    creado_en = _fecha_pdf_corta(creado_src)

    nr = getattr(siniestro, "numero_reporte", None)
    ns = getattr(siniestro, "numero_siniestro", None)
    poliza_principal = _get_poliza_principal(siniestro)
    np = getattr(poliza_principal, "numero_poliza", None) if poliza_principal else None

    # Fecha asignación: preferimos la relación exacta por área del documento.
    fecha_asig_src = None
    if getattr(doc, "area_id", None) is not None and getattr(siniestro, "id", None) is not None:
        area_asig = (
            db.query(SiniestroArea)
            .filter(
                SiniestroArea.siniestro_id == siniestro.id,
                SiniestroArea.area_id == doc.area_id,
                SiniestroArea.activo == True,  # noqa: E712
                SiniestroArea.eliminado == False,  # noqa: E712
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
                SiniestroArea.eliminado == False,  # noqa: E712
            )
            .order_by(SiniestroArea.fecha_asignacion.desc())
            .first()
        )
        fecha_asig_src = getattr(area_asig, "fecha_asignacion", None)
    if fecha_asig_src is None:
        fecha_asig_src = getattr(siniestro, "fecha_asignacion", None)

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
            "firmado_por": firma_html,
            "firma_fisica": firma_html,
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
    out.update(
        _merge_calificacion_placeholders(
            db, empresa_id, getattr(siniestro, "calificacion_id", None)
        )
    )
    out.update(_informe_variables_catalogo_extendido(db, siniestro, empresa_id))
    _merge_aliases_plantilla_estandar(db, siniestro, empresa_id, out)
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
    """Formatea un valor numérico como moneda para PDF: $10,000,000.00"""
    if value is None:
        return ""
    if isinstance(value, (int, float)):
        return f"${value:,.2f}"
    s = str(value).strip()
    if not s:
        return ""
    s_num = s.lstrip("$").strip().replace(",", "").replace(" ", "")
    if not s_num:
        return ""
    try:
        num = float(s_num)
        return f"${num:,.2f}"
    except (ValueError, TypeError):
        return s if s.startswith("$") else f"${s}"


def _campo_es_moneda(campo: dict) -> bool:
    t = str((campo or {}).get("tipo") or "").strip().lower()
    return t in ("currency", "moneda")


def _format_currency_variables(variables: dict, plantilla: Any) -> dict:
    """
    Formatea en el diccionario de variables los valores de campos tipo moneda
    (campos_formulario: tipo 'currency' o 'moneda'), para el PDF: $10,000,000.00
    """
    if not plantilla or not getattr(plantilla, "campos_formulario", None):
        return variables
    campos = plantilla.campos_formulario or []
    currency_keys = {c.get("clave") for c in campos if _campo_es_moneda(c)}
    if not currency_keys:
        return variables
    out = dict(variables)
    for k in currency_keys:
        if k in out and out[k] is not None and str(out[k]).strip() != "":
            out[k] = _format_currency_value(out[k])
    return out


def _resolve_pdf_default_logo_uri() -> Optional[str]:
    """
    Logo por defecto en PDFs (frontend/assets/logos/logo_large_black.png, fondo transparente).
    Prioridad: PNG en app/static, PNG en monorepo frontend, luego SVG legacy en las mismas rutas.
    """
    app_dir = Path(__file__).resolve().parents[2]  # .../app
    candidates = (
        app_dir / "static" / "assets" / "logos" / "logo_large_black.png",
        app_dir.parent.parent / "frontend" / "assets" / "logos" / "logo_large_black.png",
        app_dir / "static" / "assets" / "logos" / "logo_large_black.svg",
        app_dir.parent.parent / "frontend" / "assets" / "logos" / "logo_large_black.svg",
    )
    for candidate in candidates:
        try:
            if candidate.is_file():
                return candidate.resolve().as_uri()
        except OSError:
            continue
    return None


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
    luego el logo de la empresa del usuario, y por último el logo por defecto (logo_large_black.png).
    """
    # 1. Logo personalizado del header/plantilla
    if header_plantilla and getattr(header_plantilla, "logo_url", None):
        logo = header_plantilla.logo_url
        if logo and isinstance(logo, str) and logo.strip():
            return logo.strip()
    # 2. Logo de la empresa
    empresa_logo = _get_empresa_logo_url(db, user)
    if empresa_logo:
        return empresa_logo
    # 3. Fallback global PDF (sustituye ausencia de logo en empresa/header)
    return _resolve_pdf_default_logo_uri()


def _build_header_html_with_logo(
    db: Session,
    header_contenido: str,
    user: User,
    header_plantilla=None,
) -> str:
    logo_url = _get_logo_for_header(db, user, header_plantilla)
    if not logo_url:
        return header_contenido

    img_tag = (
        f'<img src="{logo_url}" alt="Logo" '
        'style="display: block; max-height: 120px; max-width: 360px; '
        'object-fit: contain; margin: 0;" />'
    )

    if "{{logo}}" in header_contenido:
        logo_block = (
            '<div style="display: block; width: 100%; text-align: left; '
            'margin: 0 0 0.5rem 0;">'
            f"{img_tag}"
            "</div>"
        )
        return header_contenido.replace("{{logo}}", logo_block)

    return (
        '<div style="display: flex; justify-content: flex-start; '
        'align-items: flex-start; width: 100%; text-align: left; '
        'gap: 1rem; margin-bottom: 0.5rem;">'
        f'<div style="flex: 0 0 auto;">{img_tag}</div>'
        f'<div style="flex: 1; min-width: 0;">{header_contenido}</div>'
        "</div>"
    )

def _prepend_logo_if_empresa_has_one(db: Session, html_content: str, user: User) -> str:
    """
    Si el contenido no incluye ya el logo, antepone uno: logo de empresa si existe;
    si no, logo por defecto (logo_large_black.png).
    """
    logo_url = _get_empresa_logo_url(db, user) or _resolve_pdf_default_logo_uri()
    if not logo_url:
        return html_content
    img_tag = f'<img src="{logo_url}" alt="Logo" style="display: block; max-height: 120px; max-width: 320px; object-fit: contain; margin: 0;" />'
    block = f'<div class="header-logo" style="display: block; width: 100%; text-align: left; margin: 0.35rem 0 0.5rem 0;">{img_tag}</div>\n'
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


def _persist_generated_pdf_response(
    *,
    db: Session,
    request: Request,
    current_user: User,
    pdf_bytes: bytes,
    filename: str,
    source_kind: str,
    siniestro_id: Optional[str] = None,
    plantilla_id: Optional[str] = None,
    metadata_json: Optional[Dict[str, Any]] = None,
) -> GeneratedFileAccessResponse:
    empresa_id = _empresa_id_from_user(current_user)
    if not empresa_id:
        raise HTTPException(status_code=400, detail="No se pudo resolver la empresa activa del usuario.")

    siniestro_uuid = None
    if siniestro_id:
        try:
            siniestro_uuid = PyUUID(str(siniestro_id))
        except (ValueError, TypeError):
            siniestro_uuid = None

    plantilla_uuid = None
    if plantilla_id:
        try:
            plantilla_uuid = PyUUID(str(plantilla_id))
        except (ValueError, TypeError):
            plantilla_uuid = None

    try:
        archivo_generado = ArchivoGeneradoService.persist_bytes(
            db,
            empresa_id=empresa_id,
            filename=filename,
            data=pdf_bytes,
            content_type="application/pdf",
            tipo_origen=source_kind,
            formato="pdf",
            generado_por=current_user.id,
            category="pdf",
            modulo="documentos",
            siniestro_id=siniestro_uuid,
            plantilla_documento_id=plantilla_uuid,
            metadata_json=metadata_json or {},
        )
        return GeneratedFileAccessResponse(
            **build_generated_file_access_payload(archivo_generado, request)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo persistir el PDF generado: {exc}",
        ) from exc


def _wrap_header_for_all_pages(header_html: str, body_html: str) -> str:
    header_page_style = (
        "<style>"
        "@page withRunningHeader {"
        f"  margin-top: {PDF_HEADER_MARGIN_TOP};"
        "  @top-center {"
        "    content: element(pdfHeader);"
        "    width: 100%;"
        "    vertical-align: top;"
        "    padding: 3mm 6mm 0 6mm;"
        "    box-sizing: border-box;"
        "  }"
        "}"
        ".pdf-page-header-running {"
        "  position: running(pdfHeader);"
        "  width: 100%;"
        "  max-width: 100%;"
        "  box-sizing: border-box;"
        "  text-align: left;"
        "  line-height: 1.2;"
        "  padding: 2mm 0 1mm 0;"
        "}"
        ".pdf-page-header-running p { margin: 0; }"
        ".pdf-page-header-running table { margin: 0; }"
        ".pdf-page-header-running td, .pdf-page-header-running th { border: none !important; padding: 0; }"
        ".pdf-with-running-header { page: withRunningHeader; }"
        "</style>"
    )
    header_block = (
        '<div class="pdf-page-header-running" '
        'style="background: white; width: 100%; text-align: left; box-sizing: border-box;">'
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


def _respuesta_formulario_valores_para_pdf(
    db: Session,
    *,
    plantilla_id: PyUUID,
    siniestro_id: PyUUID,
    doc_area_id: Optional[PyUUID],
) -> Dict[str, Any]:
    """
    Misma resolución que el detalle de siniestro al armar variables del PDF:
    prioriza la respuesta guardada con el area_id del documento; si no hay,
    la de área global (NULL); si aún no hay y solo existe un registro para
    esa plantilla+siniestro, úsalo (documento sin area_id pero formulario
    guardado con pestaña de área activa).
    """
    if doc_area_id is not None:
        r = RespuestaFormularioService.get_or_none(
            db,
            plantilla_id=plantilla_id,
            siniestro_id=siniestro_id,
            area_id=doc_area_id,
        )
        if r and r.valores:
            return dict(r.valores)

    r = RespuestaFormularioService.get_or_none(
        db,
        plantilla_id=plantilla_id,
        siniestro_id=siniestro_id,
        area_id=None,
    )
    if r and r.valores:
        return dict(r.valores)

    todas = (
        db.query(RespuestaFormularioPlantilla)
        .filter(
            RespuestaFormularioPlantilla.plantilla_id == plantilla_id,
            RespuestaFormularioPlantilla.siniestro_id == siniestro_id,
        )
        .all()
    )
    if len(todas) == 1 and todas[0].valores:
        return dict(todas[0].valores)
    return {}


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
        document_body_html = _normalize_pdf_html_content(doc.contenido)
        segunda = None
        if getattr(plantilla, "plantilla_continuacion_id", None):
            seg = PlantillaDocumentoService.get_by_id(
                db, plantilla_id=plantilla.plantilla_continuacion_id
            )
            if seg and getattr(seg, "activo", True) and getattr(seg, "contenido", None):
                segunda = seg
        if segunda:
            html1 = _build_section_html(
                db, plantilla, current_user, body_override=document_body_html
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
            body_content = document_body_html
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

# esta adaptacion se hizo para la migracion desde app aslin.mx y php url_encode 
def _normalize_pdf_html_content(html_value: Any) -> str:
    """
    Normaliza contenido HTML para PDF.
    Soporta HTML plano y HTML codificado con urlencode/urlencode_plus desde PHP.
    """
    raw = "" if html_value is None else str(html_value)
    if not raw:
        return ""

    trimmed = raw.strip()
    if not trimmed:
        return ""

    # Caso normal: ya es HTML visible.
    if "<" in trimmed and ">" in trimmed:
        return raw

    # Heurística: tags HTML codificados (%3Cdiv%3E, %3Cp%3E, etc.).
    looks_encoded_html = bool(
        re.search(r"%3C\s*/?\s*[a-zA-Z][a-zA-Z0-9:-]*", trimmed, flags=re.IGNORECASE)
    )
    if not looks_encoded_html:
        return raw

    # Tolerar una codificación doble (%253C...%253E).
    decoded = trimmed
    for _ in range(2):
        candidate = unquote_plus(decoded)
        if candidate == decoded:
            break
        decoded = candidate

    # Solo aceptar la decodificación si realmente produce HTML.
    if "<" in decoded and ">" in decoded:
        return decoded

    return raw


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
    html_content = _normalize_pdf_html_content(request.html_content)
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
                    form_vals = {k: v for k, v in respuesta.valores.items() if v is not None and str(v).strip()}
                    merged_variables = {**merged_variables, **form_vals}
            merged_variables = _normalize_textarea_variables(merged_variables, plantilla)
            merged_variables = _expand_datetime_variables(merged_variables)
            merged_variables = _format_currency_variables(merged_variables, plantilla)
            merged_variables = _normalize_pdf_image_variables(merged_variables)
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
                html1 = _build_section_html(db, plantilla, current_user, body_override=html_content)
                html2 = _build_section_html(db, segunda, current_user)
                _pdf_debug_log_html("generate_pdf_continuacion_seccion_1", html1)
                _pdf_debug_log_html("generate_pdf_continuacion_seccion_2", html2)
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
            body_content = html_content
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
    merged_variables = _normalize_pdf_image_variables(merged_variables)
    _pdf_debug_log_html("generate_pdf_html_final_antes_weasyprint", html_content)
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
                form_vals = {k: v for k, v in respuesta.valores.items() if v is not None and str(v).strip()}
                merged_variables = {**merged_variables, **form_vals}

        merged_variables = _normalize_textarea_variables(merged_variables, plantilla)
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


@router.post("/download", response_model=GeneratedFileAccessResponse)
async def download_pdf(
    http_request: Request,
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

    html_content = _normalize_pdf_html_content(request.html_content)
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
                    form_vals = {k: v for k, v in respuesta.valores.items() if v is not None and str(v).strip()}
                    merged_variables = {**merged_variables, **form_vals}
            merged_variables = _normalize_textarea_variables(merged_variables, plantilla)
            merged_variables = _expand_datetime_variables(merged_variables)
            merged_variables = _format_currency_variables(merged_variables, plantilla)
            merged_variables = _normalize_pdf_image_variables(merged_variables)
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
                html1 = _build_section_html(db, plantilla, current_user, body_override=html_content)
                html2 = _build_section_html(db, segunda, current_user)
                pdf1 = PDFService.generate_pdf(html_content=html1, **pdf_opts)
                pdf2 = PDFService.generate_pdf(html_content=html2, **pdf_opts)
                pdf_bytes = _merge_pdfs([pdf1, pdf2])
                filename = request.filename or "documento"
                if not filename.endswith('.pdf'):
                    filename += '.pdf'
                return _persist_generated_pdf_response(
                    db=db,
                    request=http_request,
                    current_user=current_user,
                    pdf_bytes=pdf_bytes,
                    filename=filename,
                    source_kind="pdf_download",
                    siniestro_id=request.siniestro_id,
                    plantilla_id=request.plantilla_id,
                    metadata_json={"mode": "download", "has_continuacion": True},
                )
            header_html = ""
            if plantilla.header_plantilla_id:
                header = PlantillaDocumentoService.get_by_id(db, plantilla_id=plantilla.header_plantilla_id)
                if header and header.activo and header.contenido:
                    header_html = _build_header_html_with_logo(db, header.contenido, current_user, header_plantilla=header) + "\n"
            body_content = html_content
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
    merged_variables = _normalize_pdf_image_variables(merged_variables)
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
        return _persist_generated_pdf_response(
            db=db,
            request=http_request,
            current_user=current_user,
            pdf_bytes=pdf_bytes,
            filename=filename,
            source_kind="pdf_download",
            siniestro_id=request.siniestro_id,
            plantilla_id=request.plantilla_id,
            metadata_json={"mode": "download", "has_continuacion": False},
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al generar PDF: {str(e)}"
        )


@router.post("/download-from-template", response_model=GeneratedFileAccessResponse)
async def download_pdf_from_template(
    http_request: Request,
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
                form_vals = {k: v for k, v in respuesta.valores.items() if v is not None and str(v).strip()}
                merged_variables = {**merged_variables, **form_vals}
        merged_variables = _normalize_textarea_variables(merged_variables, plantilla)
        merged_variables = _expand_datetime_variables(merged_variables)
        merged_variables = _format_currency_variables(merged_variables, plantilla)
        merged_variables = _normalize_pdf_image_variables(merged_variables)

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

        return _persist_generated_pdf_response(
            db=db,
            request=http_request,
            current_user=current_user,
            pdf_bytes=pdf_bytes,
            filename=filename,
            source_kind="pdf_download_from_template",
            siniestro_id=request.siniestro_id,
            plantilla_id=request.plantilla_id,
            metadata_json={"mode": "download_from_template", "has_continuacion": bool(segunda)},
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
    doc_area_id = getattr(doc, "area_id", None)
    rf_vals = _respuesta_formulario_valores_para_pdf(
        db,
        plantilla_id=doc.plantilla_documento_id,
        siniestro_id=siniestro_id,
        doc_area_id=doc_area_id,
    )
    if rf_vals:
        merged_variables = {**merged_variables, **rf_vals}
    merged_variables = _normalize_textarea_variables(merged_variables, plantilla)
    merged_variables = _expand_datetime_variables(merged_variables)
    merged_variables = _format_currency_variables(merged_variables, plantilla)
    merged_variables = _normalize_pdf_image_variables(merged_variables)
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

