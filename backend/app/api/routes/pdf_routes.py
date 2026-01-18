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
from app.services.legal_service import TiposDocumentoService
from app.models.user import User
from typing import Optional
import io

router = APIRouter()


@router.post("/generate", response_model=PDFResponse)
async def generate_pdf(
    request: PDFGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Genera un PDF desde HTML personalizado
    
    - **html_content**: Contenido HTML a convertir
    - **page_size**: Tamaño de página (A4, Letter, etc.)
    - **orientation**: Orientación (portrait, landscape)
    - **margins**: Márgenes personalizados
    - **custom_css**: CSS adicional
    - **variables**: Variables para reemplazar en el HTML
    """
    try:
        pdf_base64 = PDFService.generate_pdf_base64(
            html_content=request.html_content,
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
    Genera un PDF desde una tipo de documento guardada
    
    - **tipo_documento_id**: ID del tipo de documento a usar
    - **variables**: Variables para reemplazar en el tipo de documento
    - **page_size**: Tamaño de página
    - **orientation**: Orientación
    """
    try:
        # Obtener el tipo de documento
        tipo_documento = TiposDocumentoService.get_by_id(db, tipo_documento_id=request.tipo_documento_id)
        
        if not tipo_documento:
            raise HTTPException(
                status_code=404,
                detail="Tipo de documento no encontrada"
            )
        
        if not tipo_documento.activo:
            raise HTTPException(
                status_code=400,
                detail="El tipo de documento está inactiva"
            )
        
        if not tipo_documento.plantilla:
            raise HTTPException(
                status_code=400,
                detail="El tipo de documento no tiene contenido"
            )
        
        # Generar PDF desde el tipo de documento
        pdf_base64 = PDFService.generate_pdf_base64(
            html_content=tipo_documento.plantilla,
            page_size=request.page_size,
            orientation=request.orientation,
            margin_top=request.margin_top or "1cm",
            margin_bottom=request.margin_bottom or "1cm",
            margin_left=request.margin_left or "1cm",
            margin_right=request.margin_right or "1cm",
            custom_css=request.custom_css,
            variables=request.variables
        )
        
        filename = request.filename or tipo_documento.nombre or "documento"
        if not filename.endswith('.pdf'):
            filename += '.pdf'
        
        return PDFResponse(
            success=True,
            message="PDF generado exitosamente desde tipo de documento",
            pdf_base64=pdf_base64,
            filename=filename
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al generar PDF desde tipo de documento: {str(e)}"
        )


@router.post("/download")
async def download_pdf(
    request: PDFGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Genera y descarga un PDF directamente
    
    Retorna el PDF como archivo descargable
    """
    try:
        pdf_bytes = PDFService.generate_pdf(
            html_content=request.html_content,
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
    Genera y descarga un PDF desde un tipo de documento
    
    Retorna el PDF como archivo descargable
    """
    try:
        # Obtener la plantilla
        tipo_documento = TiposDocumentoService.get_by_id(db, tipo_documento_id=request.tipo_documento_id)
        
        if not tipo_documento:
            raise HTTPException(
                status_code=404,
                detail="Tipo de documento no encontrada"
            )
        
        if not tipo_documento.activo:
            raise HTTPException(
                status_code=400,
                detail="El tipo de documento está inactiva"
            )
        
        if not tipo_documento.plantilla:
            raise HTTPException(
                status_code=400,
                detail="El tipo de documento no tiene contenido"
            )
        
        # Generar PDF
        pdf_bytes = PDFService.generate_pdf(
            html_content=tipo_documento.plantilla,
            page_size=request.page_size,
            orientation=request.orientation,
            margin_top=request.margin_top or "1cm",
            margin_bottom=request.margin_bottom or "1cm",
            margin_left=request.margin_left or "1cm",
            margin_right=request.margin_right or "1cm",
            custom_css=request.custom_css,
            variables=request.variables
        )
        
        filename = request.filename or tipo_documento.nombre or "documento"
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
            detail=f"Error al generar PDF desde tipo de documento: {str(e)}"
        )

