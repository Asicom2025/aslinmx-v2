"""
Schemas para configuración del sistema
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

from app.schemas.user_schema import UserResponse

# ========== SMTP ==========
class ConfiguracionSMTPBase(BaseModel):
    nombre: str = Field(..., max_length=100)
    servidor: str = Field(..., max_length=255)
    puerto: int = Field(587, ge=1, le=65535)
    usuario: str = Field(..., max_length=255)
    password: str
    usar_tls: bool = True
    usar_ssl: bool = False
    remitente_nombre: Optional[str] = Field(None, max_length=255)
    remitente_email: EmailStr


class ConfiguracionSMTPCreate(ConfiguracionSMTPBase):
    pass


class ConfiguracionSMTPUpdate(BaseModel):
    nombre: Optional[str] = Field(None, max_length=100)
    servidor: Optional[str] = Field(None, max_length=255)
    puerto: Optional[int] = Field(None, ge=1, le=65535)
    usuario: Optional[str] = Field(None, max_length=255)
    password: Optional[str] = None
    usar_tls: Optional[bool] = None
    usar_ssl: Optional[bool] = None
    remitente_nombre: Optional[str] = Field(None, max_length=255)
    remitente_email: Optional[EmailStr] = None
    activo: Optional[bool] = None


class ConfiguracionSMTPResponse(ConfiguracionSMTPBase):
    id: UUID
    empresa_id: UUID
    activo: bool
    creado_en: datetime
    actualizado_en: Optional[datetime]
    creado_por: Optional[UUID]

    class Config:
        from_attributes = True


class TestSMTPRequest(BaseModel):
    configuracion_smtp_id: UUID
    destinatario: EmailStr
    asunto: Optional[str] = "Prueba de configuración SMTP"
    mensaje: Optional[str] = "Este es un correo de prueba"


# ========== Plantillas de Correo ==========
class PlantillaCorreoBase(BaseModel):
    nombre: str = Field(..., max_length=100)
    asunto: str = Field(..., max_length=255)
    cuerpo_html: str
    cuerpo_texto: Optional[str] = None
    variables_disponibles: Optional[List[str]] = None


class PlantillaCorreoCreate(PlantillaCorreoBase):
    pass


class PlantillaCorreoUpdate(BaseModel):
    nombre: Optional[str] = Field(None, max_length=100)
    asunto: Optional[str] = Field(None, max_length=255)
    cuerpo_html: Optional[str] = None
    cuerpo_texto: Optional[str] = None
    variables_disponibles: Optional[List[str]] = None
    activo: Optional[bool] = None


class PlantillaCorreoResponse(PlantillaCorreoBase):
    id: UUID
    empresa_id: UUID
    activo: bool
    creado_en: datetime
    actualizado_en: Optional[datetime]

    class Config:
        from_attributes = True


class EnviarCorreoRequest(BaseModel):
    configuracion_smtp_id: UUID
    plantilla_id: Optional[UUID] = None
    destinatarios: List[EmailStr]
    asunto: Optional[str] = None  # Si no se proporciona, usa el de la plantilla
    cuerpo_html: Optional[str] = None  # Si no se proporciona, usa el de la plantilla
    variables: Optional[Dict[str, Any]] = None  # Variables para reemplazar en la plantilla
    adjuntos: Optional[List[str]] = None  # URLs o rutas de archivos adjuntos


class EnviarArchivoCorreoRequest(BaseModel):
    """Envío de correo usando plantilla 'Te envían un archivo'. Si documento_id es un informe (tiene plantilla), se adjunta el PDF."""
    siniestro_id: UUID
    configuracion_smtp_id: UUID
    destinatarios: List[EmailStr]
    mensaje: str  # textMail: mensaje que coloca el usuario
    documento_id: Optional[UUID] = None  # Si es informe (tiene plantilla), se adjunta PDF
    # Permite enviar varios documentos en el mismo correo.
    # Para cada documento se intentará generar el PDF; si no es informe, se adjunta el archivo original.
    documentos_ids: Optional[List[UUID]] = None
    tipo_documento_nombre: Optional[str] = None  # c1
    categoria_nombre: Optional[str] = None  # c2
    # c3 se puede dejar vacío o usar para otro dato si se desea


# ========== Auditoría ==========
class AuditoriaResponse(BaseModel):
    id: UUID
    empresa_id: Optional[UUID]
    usuario_id: Optional[UUID]
    usuario: Optional[UserResponse] = None
    accion: str
    modulo: str
    tabla: str
    registro_id: Optional[UUID]
    datos_anteriores: Optional[Dict[str, Any]]
    datos_nuevos: Optional[Dict[str, Any]]
    ip_address: Optional[str]
    user_agent: Optional[str]
    descripcion: Optional[str]
    creado_en: datetime

    class Config:
        from_attributes = True


class AuditoriaFiltros(BaseModel):
    empresa_id: Optional[UUID] = None
    usuario_id: Optional[UUID] = None
    accion: Optional[str] = None
    modulo: Optional[str] = None
    tabla: Optional[str] = None
    fecha_desde: Optional[datetime] = None
    fecha_hasta: Optional[datetime] = None
    limit: int = Field(100, ge=1, le=1000)
    offset: int = Field(0, ge=0)


# ========== Configuración de Reportes ==========
class ConfiguracionReporteBase(BaseModel):
    nombre: str = Field(..., max_length=100)
    modulo: str = Field(..., max_length=100)
    filtros: Optional[Dict[str, Any]] = None
    columnas: Optional[List[str]] = None
    ordenamiento: Optional[Dict[str, str]] = None  # {"campo": "asc|desc"}
    agrupaciones: Optional[List[str]] = None
    formato_exportacion: str = Field("excel", pattern="^(excel|csv|pdf)$")
    programado: bool = False
    frecuencia: Optional[str] = Field(None, pattern="^(diario|semanal|mensual)$")
    hora_envio: Optional[str] = None  # HH:MM
    destinatarios: Optional[List[EmailStr]] = None


class ConfiguracionReporteCreate(ConfiguracionReporteBase):
    pass


class ConfiguracionReporteUpdate(BaseModel):
    nombre: Optional[str] = Field(None, max_length=100)
    filtros: Optional[Dict[str, Any]] = None
    columnas: Optional[List[str]] = None
    ordenamiento: Optional[Dict[str, str]] = None
    agrupaciones: Optional[List[str]] = None
    formato_exportacion: Optional[str] = Field(None, pattern="^(excel|csv|pdf)$")
    programado: Optional[bool] = None
    frecuencia: Optional[str] = Field(None, pattern="^(diario|semanal|mensual)$")
    hora_envio: Optional[str] = None
    destinatarios: Optional[List[EmailStr]] = None
    activo: Optional[bool] = None


class ConfiguracionReporteResponse(ConfiguracionReporteBase):
    id: UUID
    empresa_id: UUID
    usuario_id: UUID
    activo: bool
    creado_en: datetime
    actualizado_en: Optional[datetime]

    class Config:
        from_attributes = True


# ========== Historial de Correos ==========
class HistorialCorreoResponse(BaseModel):
    id: UUID
    empresa_id: UUID
    configuracion_smtp_id: Optional[UUID]
    plantilla_id: Optional[UUID]
    destinatario: str
    asunto: str
    estado: str
    error: Optional[str]
    enviado_en: datetime
    leido_en: Optional[datetime]

    class Config:
        from_attributes = True


class HistorialCorreoFiltros(BaseModel):
    empresa_id: Optional[UUID] = None
    configuracion_smtp_id: Optional[UUID] = None
    destinatario: Optional[str] = None
    estado: Optional[str] = None
    fecha_desde: Optional[datetime] = None
    fecha_hasta: Optional[datetime] = None
    limit: int = Field(100, ge=1, le=1000)
    offset: int = Field(0, ge=0)




