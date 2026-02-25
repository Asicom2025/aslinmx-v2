"""
Schemas para generación de PDFs
Define los modelos Pydantic para validación y serialización
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from enum import Enum


class PageSize(str, Enum):
    """Tamaños de página estándar"""
    A4 = "A4"
    LETTER = "Letter"
    LEGAL = "Legal"
    A3 = "A3"
    A5 = "A5"


class PageOrientation(str, Enum):
    """Orientación de página"""
    PORTRAIT = "portrait"
    LANDSCAPE = "landscape"


class PDFGenerateRequest(BaseModel):
    """Schema para generar PDF desde HTML"""
    html_content: str = Field(..., min_length=1, description="Contenido HTML a convertir a PDF")
    plantilla_id: Optional[str] = Field(None, description="ID de plantilla asociada: si se envía, se antepone header+logo al contenido")
    page_size: PageSize = Field(PageSize.A4, description="Tamaño de página")
    orientation: PageOrientation = Field(PageOrientation.PORTRAIT, description="Orientación de página")
    margin_top: Optional[str] = Field("1cm", description="Margen superior (ej: '1cm', '20px')")
    margin_bottom: Optional[str] = Field("1cm", description="Margen inferior")
    margin_left: Optional[str] = Field("1cm", description="Margen izquierdo")
    margin_right: Optional[str] = Field("1cm", description="Margen derecho")
    custom_css: Optional[str] = Field(None, description="CSS adicional para aplicar al HTML")
    variables: Optional[Dict[str, Any]] = Field(None, description="Variables para reemplazar en el HTML (ej: {{nombre}})")
    filename: Optional[str] = Field(None, max_length=255, description="Nombre del archivo PDF (sin extensión)")


class PDFGenerateFromTemplateRequest(BaseModel):
    """Schema para generar PDF desde una plantilla"""
    plantilla_id: str = Field(..., description="ID de la plantilla de documento a usar")
    variables: Optional[Dict[str, Any]] = Field(None, description="Variables para reemplazar en la plantilla (opcional)")
    page_size: PageSize = Field(PageSize.A4, description="Tamaño de página")
    orientation: PageOrientation = Field(PageOrientation.PORTRAIT, description="Orientación de página")
    margin_top: Optional[str] = Field("1cm", description="Margen superior")
    margin_bottom: Optional[str] = Field("1cm", description="Margen inferior")
    margin_left: Optional[str] = Field("1cm", description="Margen izquierdo")
    margin_right: Optional[str] = Field("1cm", description="Margen derecho")
    custom_css: Optional[str] = Field(None, description="CSS adicional")
    filename: Optional[str] = Field(None, max_length=255, description="Nombre del archivo PDF")


class PDFResponse(BaseModel):
    """Schema de respuesta de PDF generado"""
    success: bool
    message: str
    pdf_base64: Optional[str] = None
    filename: Optional[str] = None

