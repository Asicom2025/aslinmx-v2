"""
Rutas para generación de PDFs
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import get_current_user
from app.schemas.pdf_schema import (
    PDFGenerateRequest,
    PDFGenerateFromTemplateRequest,
    PDFResponse
)
from app.services.pdf_service import PDFService
from app.services.legal_service import PlantillaDocumentoService
from app.services.empresa_service import EmpresaService
from app.models.user import User
from typing import Optional
import io

router = APIRouter()


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


def _build_header_html_with_logo(
    db: Session,
    header_contenido: str,
    user: User,
) -> str:
    """
    Construye el HTML del header inyectando el logo de la empresa (previamente cargado en configuración).
    Si header_contenido contiene el placeholder {{logo}}, se reemplaza por la etiqueta img.
    Si no hay placeholder pero hay logo, se antepone un bloque con el logo.
    """
    logo_url = _get_empresa_logo_url(db, user)
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
    """
    html = ""
    if getattr(plantilla, "header_plantilla_id", None):
        header = PlantillaDocumentoService.get_by_id(db, plantilla_id=plantilla.header_plantilla_id)
        if header and getattr(header, "activo", True) and getattr(header, "contenido", None):
            html += _build_header_html_with_logo(db, header.contenido, user) + "\n"
    html += getattr(plantilla, "contenido", "") or ""
    if not getattr(plantilla, "header_plantilla_id", None):
        html = _prepend_logo_if_empresa_has_one(db, html, user)
    return html


def _build_full_html_from_plantilla(
    db: Session, plantilla, user: User, *, include_continuacion: bool = True
) -> str:
    """
    Construye el HTML completo de una plantilla y, si tiene plantilla_continuacion_id,
    añade salto de página y la segunda plantilla (cada una con su header).
    """
    parts = [_build_html_for_one_plantilla(db, plantilla, user)]
    if include_continuacion and getattr(plantilla, "plantilla_continuacion_id", None):
        segunda = PlantillaDocumentoService.get_by_id(db, plantilla_id=plantilla.plantilla_continuacion_id)
        if segunda and getattr(segunda, "activo", True) and getattr(segunda, "contenido", None):
            parts.append('<div style="page-break-before: always;"></div>')
            parts.append(_build_html_for_one_plantilla(db, segunda, user))
    return "\n".join(parts)


@router.post("/generate", response_model=PDFResponse)
async def generate_pdf(
    request: PDFGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Genera un PDF desde HTML personalizado.
    Si se envía plantilla_id, se antepone el header de la plantilla (con logo) al contenido.
    """
    html_content = request.html_content
    if getattr(request, "plantilla_id", None):
        plantilla = PlantillaDocumentoService.get_by_id(db, plantilla_id=request.plantilla_id)
        if plantilla:
            header_html = ""
            if plantilla.header_plantilla_id:
                header = PlantillaDocumentoService.get_by_id(db, plantilla_id=plantilla.header_plantilla_id)
                if header and header.activo and header.contenido:
                    header_html = _build_header_html_with_logo(db, header.contenido, current_user) + "\n"
            html_content = header_html + request.html_content
            if not plantilla.header_plantilla_id:
                html_content = _prepend_logo_if_empresa_has_one(db, html_content, current_user)
            if getattr(plantilla, "plantilla_continuacion_id", None):
                segunda = PlantillaDocumentoService.get_by_id(db, plantilla_id=plantilla.plantilla_continuacion_id)
                if segunda and getattr(segunda, "activo", True) and getattr(segunda, "contenido", None):
                    html_content += '\n<div style="page-break-before: always;"></div>\n'
                    html_content += _build_html_for_one_plantilla(db, segunda, current_user)
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
            variables=request.variables
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
    current_user: User = Depends(get_current_user),
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
        
        # Una plantilla o dos (continuación): cada una con su header; se concatenan en un solo PDF
        html_content = _build_full_html_from_plantilla(db, plantilla, current_user)
        
        # Generar PDF desde la plantilla
        pdf_base64 = PDFService.generate_pdf_base64(
            html_content=html_content,
            page_size=request.page_size,
            orientation=request.orientation,
            margin_top=request.margin_top or "1cm",
            margin_bottom=request.margin_bottom or "1cm",
            margin_left=request.margin_left or "1cm",
            margin_right=request.margin_right or "1cm",
            custom_css=request.custom_css,
            variables=request.variables
        )
        
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Genera y descarga un PDF directamente.
    Si se envía plantilla_id, se antepone el header de la plantilla (con logo) al contenido.
    """
    html_content = request.html_content
    if getattr(request, "plantilla_id", None):
        plantilla = PlantillaDocumentoService.get_by_id(db, plantilla_id=request.plantilla_id)
        if plantilla:
            header_html = ""
            if plantilla.header_plantilla_id:
                header = PlantillaDocumentoService.get_by_id(db, plantilla_id=plantilla.header_plantilla_id)
                if header and header.activo and header.contenido:
                    header_html = _build_header_html_with_logo(db, header.contenido, current_user) + "\n"
            html_content = header_html + request.html_content
            if not plantilla.header_plantilla_id:
                html_content = _prepend_logo_if_empresa_has_one(db, html_content, current_user)
            if getattr(plantilla, "plantilla_continuacion_id", None):
                segunda = PlantillaDocumentoService.get_by_id(db, plantilla_id=plantilla.plantilla_continuacion_id)
                if segunda and getattr(segunda, "activo", True) and getattr(segunda, "contenido", None):
                    html_content += '\n<div style="page-break-before: always;"></div>\n'
                    html_content += _build_html_for_one_plantilla(db, segunda, current_user)
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
            variables=request.variables
        )
        
        filename = request.filename or "documento"
        if not filename.endswith('.pdf'):
            filename += '.pdf'
        
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al generar PDF: {str(e)}"
        )


@router.post("/download-from-template")
async def download_pdf_from_template(
    request: PDFGenerateFromTemplateRequest,
    current_user: User = Depends(get_current_user),
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
        
        # Una plantilla o dos (continuación): cada una con su header
        html_content = _build_full_html_from_plantilla(db, plantilla, current_user)
        
        # Generar PDF
        pdf_bytes = PDFService.generate_pdf(
            html_content=html_content,
            page_size=request.page_size,
            orientation=request.orientation,
            margin_top=request.margin_top or "1cm",
            margin_bottom=request.margin_bottom or "1cm",
            margin_left=request.margin_left or "1cm",
            margin_right=request.margin_right or "1cm",
            custom_css=request.custom_css,
            variables=request.variables
        )
        
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

