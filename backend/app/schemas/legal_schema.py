"""
Schemas para catálogos legales
Define los modelos Pydantic para validación y serialización
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal, List, Dict, Any
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal


# ===== ÁREAS =====
class AreaBase(BaseModel):
    """Schema base de área"""
    nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: Optional[str] = None
    codigo: Optional[str] = Field(None, max_length=20)
    activo: bool = True


class AreaCreate(AreaBase):
    """Schema para crear área"""
    usuario_id: Optional[UUID] = None  # Jefe de área (opcional)


class AreaUpdate(BaseModel):
    """Schema para actualizar área"""
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    descripcion: Optional[str] = None
    codigo: Optional[str] = Field(None, max_length=20)
    activo: Optional[bool] = None
    usuario_id: Optional[UUID] = None  # Jefe de área (opcional)


class AreaResponse(AreaBase):
    """Schema de respuesta de área"""
    id: UUID
    empresa_id: UUID
    usuario_id: Optional[UUID] = None  # Jefe de área
    creado_en: datetime
    actualizado_en: datetime
    eliminado_en: Optional[datetime] = None
    jefe_nombre: Optional[str] = None  # Nombre del jefe (para mostrar en UI)

    class Config:
        from_attributes = True



# ===== ESTADOS DE SINIESTRO =====
class EstadoSiniestroBase(BaseModel):
    """Schema base de estado de siniestro"""
    nombre: str = Field(..., min_length=1, max_length=50)
    descripcion: Optional[str] = None
    color: str = Field("#007bff", max_length=7)
    orden: int = Field(0, ge=0)
    activo: bool = True


class EstadoSiniestroCreate(EstadoSiniestroBase):
    """Schema para crear estado de siniestro"""
    pass


class EstadoSiniestroUpdate(BaseModel):
    """Schema para actualizar estado de siniestro"""
    nombre: Optional[str] = Field(None, min_length=1, max_length=50)
    descripcion: Optional[str] = None
    color: Optional[str] = Field(None, max_length=7)
    orden: Optional[int] = Field(None, ge=0)
    activo: Optional[bool] = None


class EstadoSiniestroResponse(EstadoSiniestroBase):
    """Schema de respuesta de estado de siniestro"""
    id: UUID
    empresa_id: UUID
    creado_en: datetime
    actualizado_en: datetime
    eliminado_en: Optional[datetime] = None

    class Config:
        from_attributes = True


# ===== CALIFICACIONES DE SINIESTRO =====
class CalificacionSiniestroBase(BaseModel):
    """Schema base de calificación de siniestro"""
    nombre: str = Field(..., min_length=1, max_length=50)
    descripcion: Optional[str] = None
    color: str = Field("#475569", max_length=7)
    orden: int = Field(0, ge=0)
    activo: bool = True


class CalificacionSiniestroCreate(CalificacionSiniestroBase):
    """Schema para crear calificación de siniestro"""
    pass


class CalificacionSiniestroUpdate(BaseModel):
    """Schema para actualizar calificación de siniestro"""
    nombre: Optional[str] = Field(None, min_length=1, max_length=50)
    descripcion: Optional[str] = None
    color: Optional[str] = Field(None, max_length=7)
    orden: Optional[int] = Field(None, ge=0)
    activo: Optional[bool] = None


class CalificacionSiniestroResponse(CalificacionSiniestroBase):
    """Schema de respuesta de calificación de siniestro"""
    id: UUID
    empresa_id: UUID
    creado_en: datetime
    actualizado_en: datetime
    eliminado_en: Optional[datetime] = None

    class Config:
        from_attributes = True


# ===== ENTIDADES =====
class EntidadBase(BaseModel):
    """Schema base de entidad"""
    nombre: str = Field(..., min_length=1, max_length=200)
    codigo: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    telefono: Optional[str] = Field(None, max_length=20)
    direccion: Optional[str] = None
    contacto_principal: Optional[str] = Field(None, max_length=200)
    observaciones: Optional[str] = None
    es_institucion: bool = False
    es_autoridad: bool = False
    es_organo: bool = False
    activo: bool = True


class EntidadCreate(EntidadBase):
    """Schema para crear entidad"""
    pass


class EntidadUpdate(BaseModel):
    """Schema para actualizar entidad"""
    nombre: Optional[str] = Field(None, min_length=1, max_length=200)
    codigo: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    telefono: Optional[str] = Field(None, max_length=20)
    direccion: Optional[str] = None
    contacto_principal: Optional[str] = Field(None, max_length=200)
    observaciones: Optional[str] = None
    es_institucion: Optional[bool] = None
    es_autoridad: Optional[bool] = None
    es_organo: Optional[bool] = None
    activo: Optional[bool] = None


class EntidadResponse(EntidadBase):
    """Schema de respuesta de entidad"""
    id: UUID
    empresa_id: UUID
    creado_en: datetime
    actualizado_en: datetime
    eliminado_en: Optional[datetime] = None

    class Config:
        from_attributes = True


# ===== INSTITUCIONES =====
class InstitucionBase(BaseModel):
    """Schema base de institución"""
    nombre: str = Field(..., min_length=1, max_length=500)
    codigo: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    activo: bool = True


class InstitucionCreate(InstitucionBase):
    """Schema para crear institución"""
    pass


class InstitucionUpdate(BaseModel):
    """Schema para actualizar institución"""
    nombre: Optional[str] = Field(None, min_length=1, max_length=500)
    codigo: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    activo: Optional[bool] = None


class InstitucionResponse(InstitucionBase):
    """Schema de respuesta de institución"""
    id: UUID
    empresa_id: UUID
    creado_en: datetime
    actualizado_en: datetime
    eliminado_en: Optional[datetime] = None

    class Config:
        from_attributes = True


# ===== AUTORIDADES =====
class AutoridadBase(BaseModel):
    """Schema base de autoridad"""
    nombre: str = Field(..., min_length=1, max_length=500)
    codigo: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    activo: bool = True


class AutoridadCreate(AutoridadBase):
    """Schema para crear autoridad"""
    pass


class AutoridadUpdate(BaseModel):
    """Schema para actualizar autoridad"""
    nombre: Optional[str] = Field(None, min_length=1, max_length=200)
    codigo: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    activo: Optional[bool] = None


class AutoridadResponse(AutoridadBase):
    """Schema de respuesta de autoridad"""
    id: UUID
    empresa_id: UUID
    creado_en: datetime
    actualizado_en: datetime
    eliminado_en: Optional[datetime] = None

    class Config:
        from_attributes = True


# ===== ASEGURADOS =====
class AseguradoBase(BaseModel):
    """Schema base de asegurado (public.asegurados)"""
    nombre: str = Field(..., min_length=1, max_length=100)
    apellido_paterno: Optional[str] = Field(None, max_length=150)
    apellido_materno: Optional[str] = Field(None, max_length=150)
    telefono: Optional[str] = Field(None, max_length=20)
    tel_oficina: Optional[str] = Field(None, max_length=20)
    tel_casa: Optional[str] = Field(None, max_length=20)
    ciudad: Optional[str] = Field(None, max_length=100)
    estado: Optional[str] = Field(None, max_length=100)
    empresa: Optional[str] = Field(None, max_length=50)
    correo: Optional[str] = Field(None, max_length=100)
    activo: bool = True


class AseguradoCreate(AseguradoBase):
    """Schema para crear asegurado.

    timerst_list es opcional: si no se envía, el servidor genera un identificador único.
    El correo va en correo, no en timerst_list.
    """
    timerst_list: Optional[str] = Field(None, min_length=1, max_length=100)


class AseguradoUpdate(BaseModel):
    """Schema para actualizar asegurado"""
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    apellido_paterno: Optional[str] = Field(None, max_length=150)
    apellido_materno: Optional[str] = Field(None, max_length=150)
    telefono: Optional[str] = Field(None, max_length=20)
    tel_oficina: Optional[str] = Field(None, max_length=20)
    tel_casa: Optional[str] = Field(None, max_length=20)
    ciudad: Optional[str] = Field(None, max_length=100)
    estado: Optional[str] = Field(None, max_length=100)
    empresa: Optional[str] = Field(None, max_length=50)
    correo: Optional[str] = Field(None, max_length=100)
    timerst_list: Optional[str] = Field(None, min_length=1, max_length=100)
    activo: Optional[bool] = None


class AseguradoResponse(AseguradoBase):
    """Schema de respuesta de asegurado"""
    id: UUID
    timerst_list: str = Field(..., min_length=1, max_length=100)
    creado_en: datetime
    actualizado_en: datetime
    eliminado_en: Optional[datetime] = None

    class Config:
        from_attributes = True


# ===== PROVENIENTES =====
class ProvenienteBase(BaseModel):
    """Schema base de proveniente"""
    nombre: str = Field(..., min_length=1, max_length=200)
    codigo: Optional[str] = Field(None, max_length=50)
    telefono: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    direccion: Optional[str] = None
    contacto_principal: Optional[str] = Field(None, max_length=100)
    observaciones: Optional[str] = None
    activo: bool = True


class ProvenienteCreate(ProvenienteBase):
    """Schema para crear proveniente"""
    pass


class ProvenienteUpdate(BaseModel):
    """Schema para actualizar proveniente"""
    nombre: Optional[str] = Field(None, min_length=1, max_length=200)
    codigo: Optional[str] = Field(None, max_length=50)
    telefono: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    direccion: Optional[str] = None
    contacto_principal: Optional[str] = Field(None, max_length=100)
    observaciones: Optional[str] = None
    activo: Optional[bool] = None


class ProvenienteContactoBase(BaseModel):
    """Schema base de contacto de proveniente"""
    nombre: str = Field(..., min_length=1, max_length=200)
    correo: str = Field(..., min_length=1, max_length=255)
    activo: bool = True


class ProvenienteContactoCreate(ProvenienteContactoBase):
    """Schema para crear contacto de proveniente"""
    pass


class ProvenienteContactoResponse(ProvenienteContactoBase):
    """Schema de respuesta de contacto de proveniente"""
    id: UUID
    proveniente_id: UUID
    creado_en: datetime
    actualizado_en: datetime
    eliminado_en: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProvenienteResponse(ProvenienteBase):
    """Schema de respuesta de proveniente"""
    id: UUID
    empresa_id: UUID
    contactos: List[ProvenienteContactoResponse] = Field(default_factory=list)
    creado_en: datetime
    actualizado_en: datetime
    eliminado_en: Optional[datetime] = None

    class Config:
        from_attributes = True


# ===== TIPOS DE DOCUMENTO =====
class TiposDocumentoBase(BaseModel):
    """Schema base de tipo de documento"""
    nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: Optional[str] = None
    plantilla: Optional[str] = None
    formato: Optional[str] = Field(None, max_length=50)
    tipo: Literal["pdf", "editor", "imagen"] = "editor"
    activo: bool = True


class TiposDocumentoCreate(TiposDocumentoBase):
    """Schema para crear tipo de documento"""
    pass


class TiposDocumentoUpdate(BaseModel):
    """Schema para actualizar tipo de documento"""
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    descripcion: Optional[str] = None
    plantilla: Optional[str] = None
    formato: Optional[str] = Field(None, max_length=50)
    tipo: Optional[Literal["pdf", "editor", "imagen"]] = None
    activo: Optional[bool] = None


class TiposDocumentoResponse(TiposDocumentoBase):
    """Schema de respuesta de tipo de documento"""
    id: UUID
    creado_en: datetime
    actualizado_en: datetime
    eliminado_en: Optional[datetime] = None

    class Config:
        from_attributes = True


# ===== CATEGORÍAS DE DOCUMENTO =====
class CategoriaDocumentoBase(BaseModel):
    """Schema base de categoría de documento"""
    nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: Optional[str] = None
    activo: bool = True


class CategoriaDocumentoCreate(CategoriaDocumentoBase):
    """Schema para crear categoría de documento"""
    tipo_documento_id: UUID


class CategoriaDocumentoUpdate(BaseModel):
    """Schema para actualizar categoría de documento"""
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    descripcion: Optional[str] = None
    activo: Optional[bool] = None


class CategoriaDocumentoResponse(CategoriaDocumentoBase):
    """Schema de respuesta de categoría de documento"""
    id: UUID
    tipo_documento_id: UUID
    creado_en: datetime
    actualizado_en: datetime
    eliminado_en: Optional[datetime] = None

    class Config:
        from_attributes = True


# ===== CAMPOS DE FORMULARIO PERSONALIZADO =====
TipoCampoFormulario = Literal[
    "text",
    "number",
    "currency",
    "date",
    "datetime",
    "email",
    "tel",
    "textarea",
    "html",
    "select",
]
TamañoCampoFormulario = Literal["full", "half", "third"]

class CampoFormulario(BaseModel):
    """Definición de un campo del formulario personalizado de una plantilla"""
    clave: str = Field(..., description="Nombre clave único para el campo (usado como variable en el HTML)")
    tipo: TipoCampoFormulario = Field("text", description="Tipo de dato del campo")
    titulo: str = Field(..., description="Etiqueta visible del campo")
    placeholder: Optional[str] = None
    tamano: TamañoCampoFormulario = Field("full", description="Ancho del campo en la cuadrícula")
    requerido: bool = False
    opciones: Optional[List[str]] = Field(None, description="Solo para tipo 'select': lista de opciones")
    orden: int = Field(0, description="Orden de aparición en el formulario")


# ===== PLANTILLAS DE DOCUMENTO =====
class PlantillaDocumentoBase(BaseModel):
    """Schema base de plantilla de documento"""
    nombre: str = Field(..., min_length=1, max_length=200)
    descripcion: Optional[str] = None
    contenido: Optional[str] = None  # Contenido HTML de la plantilla
    formato: Optional[str] = Field(None, max_length=50)
    logo_url: Optional[str] = None  # URL o base64 del logo de la plantilla
    campos_formulario: Optional[List[CampoFormulario]] = None  # Definición de campos del formulario personalizado
    activo: bool = True


class PlantillaDocumentoCreate(PlantillaDocumentoBase):
    """Schema para crear plantilla de documento"""
    tipo_documento_id: UUID
    categoria_id: Optional[UUID] = None  # Opcional
    header_plantilla_id: Optional[UUID] = None  # Header opcional (auto-referencia)
    plantilla_continuacion_id: Optional[UUID] = None  # Segunda sección: otra plantilla (concatenada en el mismo PDF)


class PlantillaDocumentoUpdate(BaseModel):
    """Schema para actualizar plantilla de documento"""
    nombre: Optional[str] = Field(None, min_length=1, max_length=200)
    descripcion: Optional[str] = None
    contenido: Optional[str] = None
    formato: Optional[str] = Field(None, max_length=50)
    logo_url: Optional[str] = None  # URL o base64 del logo de la plantilla
    campos_formulario: Optional[List[CampoFormulario]] = None
    categoria_id: Optional[UUID] = None
    header_plantilla_id: Optional[UUID] = None  # Header opcional (auto-referencia)
    plantilla_continuacion_id: Optional[UUID] = None  # Segunda sección
    activo: Optional[bool] = None


class PlantillaDocumentoResponse(PlantillaDocumentoBase):
    """Schema de respuesta de plantilla de documento"""
    id: UUID
    tipo_documento_id: UUID
    categoria_id: Optional[UUID] = None
    header_plantilla_id: Optional[UUID] = None
    plantilla_continuacion_id: Optional[UUID] = None
    creado_en: datetime
    actualizado_en: datetime
    eliminado_en: Optional[datetime] = None

    class Config:
        from_attributes = True


class PlantillaDocumentoConHeaderResponse(PlantillaDocumentoResponse):
    """Schema de respuesta de plantilla con datos del header expandidos"""
    header_plantilla: Optional[PlantillaDocumentoResponse] = None


# ===== RESPUESTAS FORMULARIO PLANTILLA =====
class RespuestaFormularioCreate(BaseModel):
    """Schema para crear/actualizar respuesta de formulario de plantilla"""
    plantilla_id: UUID
    siniestro_id: UUID
    area_id: Optional[UUID] = None
    valores: Dict[str, Any] = Field(default_factory=dict, description="Mapa clave→valor de los campos del formulario")


class RespuestaFormularioUpdate(BaseModel):
    """Schema para actualizar parcialmente los valores de una respuesta"""
    area_id: Optional[UUID] = None
    valores: Dict[str, Any]


class RespuestaFormularioResponse(BaseModel):
    """Schema de respuesta"""
    id: UUID
    plantilla_id: UUID
    siniestro_id: UUID
    area_id: Optional[UUID] = None
    usuario_id: Optional[UUID] = None
    valores: Dict[str, Any]
    creado_en: datetime
    actualizado_en: datetime

    class Config:
        from_attributes = True

    class Config:
        from_attributes = True


# ===== SINIESTROS =====
class SiniestroPolizaBase(BaseModel):
    """Schema base de póliza relacionada a un siniestro"""
    numero_poliza: Optional[str] = Field(None, max_length=100)
    deducible: Decimal = Field(Decimal("0.00"), ge=0)
    reserva: Decimal = Field(Decimal("0.00"), ge=0)
    coaseguro: Decimal = Field(Decimal("0.00"), ge=0)
    suma_asegurada: Decimal = Field(Decimal("0.00"), ge=0)
    es_principal: bool = False
    orden: int = Field(0, ge=0)


class SiniestroPolizaPayload(BaseModel):
    """Schema de entrada para sincronizar pólizas dentro de un siniestro"""
    id: Optional[UUID] = None
    numero_poliza: Optional[str] = Field(None, max_length=100)
    deducible: Decimal = Field(Decimal("0.00"), ge=0)
    reserva: Decimal = Field(Decimal("0.00"), ge=0)
    coaseguro: Decimal = Field(Decimal("0.00"), ge=0)
    suma_asegurada: Decimal = Field(Decimal("0.00"), ge=0)
    es_principal: bool = False
    orden: Optional[int] = Field(None, ge=0)


class SiniestroPolizaCreate(SiniestroPolizaBase):
    """Schema para crear póliza relacionada"""
    siniestro_id: UUID


class SiniestroPolizaUpdate(BaseModel):
    """Schema para actualizar póliza relacionada"""
    numero_poliza: Optional[str] = Field(None, max_length=100)
    deducible: Optional[Decimal] = Field(None, ge=0)
    reserva: Optional[Decimal] = Field(None, ge=0)
    coaseguro: Optional[Decimal] = Field(None, ge=0)
    suma_asegurada: Optional[Decimal] = Field(None, ge=0)
    es_principal: Optional[bool] = None
    orden: Optional[int] = Field(None, ge=0)


class SiniestroPolizaResponse(SiniestroPolizaBase):
    """Schema de respuesta de póliza relacionada"""
    id: UUID
    siniestro_id: UUID
    creado_en: datetime
    actualizado_en: datetime

    class Config:
        from_attributes = True


class SiniestroBase(BaseModel):
    """Schema base de siniestro"""
    numero_siniestro: Optional[str] = Field(None, max_length=50)
    fecha_siniestro: Optional[datetime] = None
    fecha_reporte: Optional[datetime] = None
    fecha_asignacion: Optional[datetime] = None
    ubicacion: Optional[str] = None
    tipo_intervencion: Optional[str] = None
    tercero: Optional[str] = None
    nicho: Optional[str] = Field(None, max_length=200)
    materia: Optional[str] = Field(None, max_length=200)
    expediente: Optional[str] = Field(None, max_length=200)
    descripcion_hechos: Optional[str] = Field(None, min_length=1)  # Opcional, se maneja en versiones

    # Datos de póliza(s): solo en `siniestro_polizas` vía esta lista
    polizas: List[SiniestroPolizaPayload] = Field(default_factory=list)
    
    # Usuario asegurado (rol asegurado)
    asegurado_id: Optional[UUID] = None
    
    # Estado del siniestro
    estado_id: Optional[UUID] = None
    
    # Instituciones involucradas (OBLIGATORIAS)
    institucion_id: UUID = Field(..., description="ID de la institución involucrada")
    autoridad_id: UUID = Field(..., description="ID de la autoridad involucrada")
    
    # Proveniente y código
    proveniente_id: Optional[UUID] = None
    numero_reporte: Optional[str] = Field(None, max_length=100)
    
    # Calificación
    calificacion_id: Optional[UUID] = None
    
    # Forma de contacto
    forma_contacto: Optional[Literal["correo", "telefono", "directa", "N/A"]] = None
    
    # Campos adicionales
    prioridad: Literal["baja", "media", "alta", "critica"] = "media"
    observaciones: Optional[str] = None
    activo: bool = True

    @field_validator("numero_siniestro", "numero_reporte", mode="before")
    @classmethod
    def normalizar_numero_opcionales(cls, v):
        """Permite S/N, N/A, etc.; cadena vacía o solo espacios → None."""
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return v
    
    @field_validator('proveniente_id', 'asegurado_id', 'estado_id', 'calificacion_id', mode='before')
    @classmethod
    def convert_empty_string_to_none(cls, v):
        """Convierte strings vacíos a None para campos UUID opcionales"""
        if v == "" or v == "null" or v == "undefined":
            return None
        return v
    
    @field_validator('institucion_id', 'autoridad_id', mode='before')
    @classmethod
    def validate_required_uuids(cls, v):
        """Valida que institucion_id y autoridad_id no sean vacíos (son obligatorios)"""
        if v == "" or v == "null" or v == "undefined" or v is None:
            raise ValueError("institucion_id y autoridad_id son obligatorios")
        return v


class SiniestroCreate(SiniestroBase):
    """Schema para crear siniestro"""
    # `fecha_registro` y `fecha_reporte`: reporte al asegurador; si no viene `fecha_reporte`, el backend la iguala a `fecha_registro`.
    fecha_registro: Optional[datetime] = None
    codigo: Optional[str] = Field(
        None,
        max_length=50,
        description="Consecutivo del ID (ej. 622). Único por proveniente y año de fecha de reporte. Vacío = autogenerado.",
    )

    @field_validator("codigo", mode="before")
    @classmethod
    def strip_codigo_create(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return v


class SiniestroUpdate(BaseModel):
    """Schema para actualizar siniestro"""
    numero_siniestro: Optional[str] = Field(None, max_length=50)
    fecha_siniestro: Optional[datetime] = None
    fecha_reporte: Optional[datetime] = None
    fecha_asignacion: Optional[datetime] = None
    fecha_registro: Optional[datetime] = None
    ubicacion: Optional[str] = None
    tipo_intervencion: Optional[str] = None
    tercero: Optional[str] = None
    nicho: Optional[str] = Field(None, max_length=200)
    materia: Optional[str] = Field(None, max_length=200)
    expediente: Optional[str] = Field(None, max_length=200)
    descripcion_hechos: Optional[str] = Field(None, min_length=1)

    polizas: Optional[List[SiniestroPolizaPayload]] = None
    
    # Usuario asegurado (rol asegurado)
    asegurado_id: Optional[UUID] = None
    
    # Estado del siniestro
    estado_id: Optional[UUID] = None
    
    # Instituciones involucradas
    institucion_id: Optional[UUID] = None
    autoridad_id: Optional[UUID] = None
    
    # Proveniente y código
    proveniente_id: Optional[UUID] = None
    numero_reporte: Optional[str] = Field(None, max_length=100)
    codigo: Optional[str] = Field(
        None,
        max_length=50,
        description="Consecutivo del ID; único por proveniente y año (fecha de reporte).",
    )
    
    # Calificación
    calificacion_id: Optional[UUID] = None
    
    # Forma de contacto
    forma_contacto: Optional[Literal["correo", "telefono", "directa", "N/A"]] = None
    
    # Campos adicionales
    prioridad: Optional[Literal["baja", "media", "alta", "critica"]] = None
    observaciones: Optional[str] = None
    activo: Optional[bool] = None

    @field_validator("codigo", mode="before")
    @classmethod
    def strip_codigo_update(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return v

    @field_validator("numero_siniestro", "numero_reporte", mode="before")
    @classmethod
    def normalizar_numero_opcionales_update(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return v
    
    @field_validator('institucion_id', 'autoridad_id', 'proveniente_id', 'asegurado_id', 'estado_id', 'calificacion_id', mode='before')
    @classmethod
    def convert_empty_string_to_none(cls, v):
        """Convierte strings vacíos a None para campos UUID opcionales"""
        if v == "" or v == "null" or v == "undefined":
            return None
        return v


class SiniestroResponse(SiniestroBase):
    """Schema de respuesta de siniestro"""
    id: UUID
    empresa_id: UUID
    creado_por: Optional[UUID] = None
    asegurado_id: Optional[UUID] = None
    codigo: Optional[str] = None  # Código generado automáticamente
    anualidad: Optional[int] = None  # Año calendario (ej. 2026); lo asigna el backend
    fecha_registro: Optional[datetime] = None
    polizas: List[SiniestroPolizaResponse] = Field(default_factory=list)
    eliminado: bool
    creado_en: datetime
    actualizado_en: datetime
    eliminado_en: Optional[datetime] = None
    id_formato: Optional[str] = None  # ID legible: proveniente-consecutivo-año (ej. 102-001-26)
    # Rellenado en servicio (no es columna en `siniestros`): nombre completo del asegurado
    asegurado_nombre: Optional[str] = Field(None, max_length=600)
    # Solo en GET detalle: si el usuario actual puede mutar expediente (documentos, bitácora, etc.)
    puede_editar_expediente: Optional[bool] = Field(
        default=None,
        description="Capacidad de edición del expediente para el usuario autenticado (detalle).",
    )

    class Config:
        from_attributes = True


# ===== BITÁCORA DE ACTIVIDADES =====
class BitacoraActividadBase(BaseModel):
    """Schema base de bitácora de actividad"""
    tipo_actividad: Literal["documento", "llamada", "reunion", "inspeccion", "otro"]
    descripcion: str = Field(..., min_length=1)
    horas_trabajadas: Decimal = Field(Decimal("0.00"), ge=0, le=24)
    fecha_actividad: datetime
    documento_adjunto: Optional[str] = Field(None, max_length=255)
    comentarios: Optional[str] = None
    verificado: bool = False


class BitacoraActividadCreate(BitacoraActividadBase):
    """Schema para crear actividad en bitácora"""
    siniestro_id: UUID
    usuario_id: Optional[UUID] = None  # Se toma del usuario actual si no se especifica
    area_id: Optional[UUID] = None  # Área específica de la actividad
    flujo_trabajo_id: Optional[UUID] = None  # Flujo de trabajo específico de la actividad


class BitacoraActividadUpdate(BaseModel):
    """Schema para actualizar actividad en bitácora"""
    tipo_actividad: Optional[Literal["documento", "llamada", "reunion", "inspeccion", "otro"]] = None
    descripcion: Optional[str] = Field(None, min_length=1)
    horas_trabajadas: Optional[Decimal] = Field(None, ge=0, le=24)
    fecha_actividad: Optional[datetime] = None
    documento_adjunto: Optional[str] = Field(None, max_length=255)
    comentarios: Optional[str] = None
    verificado: Optional[bool] = None
    area_id: Optional[UUID] = None
    flujo_trabajo_id: Optional[UUID] = None


class BitacoraActividadResponse(BitacoraActividadBase):
    """Schema de respuesta de actividad en bitácora"""
    id: UUID
    siniestro_id: UUID
    usuario_id: UUID
    area_id: Optional[UUID] = None
    flujo_trabajo_id: Optional[UUID] = None
    creado_en: datetime

    class Config:
        from_attributes = True


# ===== DOCUMENTOS =====
class DocumentoBase(BaseModel):
    """Schema base de documento"""
    nombre_archivo: str = Field(..., min_length=1, max_length=255)
    ruta_archivo: Optional[str] = Field(None, max_length=500)
    contenido: Optional[str] = None  # Contenido HTML del documento editado
    tamaño_archivo: Optional[int] = None
    tipo_mime: Optional[str] = Field(None, max_length=100)
    descripcion: Optional[str] = None
    fecha_documento: Optional[date] = None
    es_principal: bool = False
    es_adicional: bool = False
    activo: bool = True


class DocumentoStorageMetadataResponse(BaseModel):
    id: UUID
    provider: str
    storage_path: str
    bucket_name: Optional[str] = None
    object_key: Optional[str] = None
    original_filename: str
    mime_type: Optional[str] = None
    size_bytes: Optional[int] = None
    etag: Optional[str] = None
    sha256: Optional[str] = None
    creado_en: datetime

    class Config:
        from_attributes = True


class DocumentoCreate(DocumentoBase):
    """Schema para crear documento"""
    siniestro_id: UUID
    tipo_documento_id: Optional[UUID] = None
    etapa_flujo_id: Optional[UUID] = None
    plantilla_documento_id: Optional[UUID] = None
    area_id: Optional[UUID] = None  # Área específica del documento
    flujo_trabajo_id: Optional[UUID] = None  # Flujo de trabajo específico del documento
    requisito_documento_id: Optional[UUID] = None  # Requisito documental que origina este documento
    storage_object_id: Optional[UUID] = None
    usuario_subio: Optional[UUID] = None
    version: int = 1
    # Campos para bitácora al crear documento (carga de informe)
    horas_trabajadas_bitacora: Optional[Decimal] = Field(None, ge=0, le=24)
    comentarios_bitacora: Optional[str] = None


class DocumentoUpdate(BaseModel):
    """Schema para actualizar documento"""
    nombre_archivo: Optional[str] = Field(None, min_length=1, max_length=255)
    ruta_archivo: Optional[str] = Field(None, max_length=500)
    contenido: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_documento: Optional[date] = None
    es_principal: Optional[bool] = None
    es_adicional: Optional[bool] = None
    tipo_documento_id: Optional[UUID] = None
    etapa_flujo_id: Optional[UUID] = None
    plantilla_documento_id: Optional[UUID] = None
    area_id: Optional[UUID] = None
    flujo_trabajo_id: Optional[UUID] = None
    requisito_documento_id: Optional[UUID] = None  # Requisito documental asociado
    storage_object_id: Optional[UUID] = None
    activo: Optional[bool] = None
    # Campos para bitácora al actualizar documento (actualización de informe)
    horas_trabajadas_bitacora: Optional[Decimal] = Field(None, ge=0, le=24)
    comentarios_bitacora: Optional[str] = None


class DocumentoResponse(DocumentoBase):
    """Schema de respuesta de documento"""
    id: UUID
    siniestro_id: UUID
    tipo_documento_id: Optional[UUID] = None
    etapa_flujo_id: Optional[UUID] = None
    plantilla_documento_id: Optional[UUID] = None
    area_id: Optional[UUID] = None
    flujo_trabajo_id: Optional[UUID] = None
    requisito_documento_id: Optional[UUID] = None
    storage_object_id: Optional[UUID] = None
    usuario_subio: Optional[UUID] = None
    version: int
    eliminado: bool
    creado_en: datetime
    actualizado_en: datetime
    eliminado_en: Optional[datetime] = None
    plantilla_tiene_continuacion: Optional[bool] = None  # True si la plantilla tiene segunda parte con formulario
    # Nombre de categoría (vía requisito documental o plantilla asociada)
    categoria_documento_nombre: Optional[str] = None
    storage_object: Optional[DocumentoStorageMetadataResponse] = None
    archivo_url: Optional[str] = None
    archivo_url_expira_en: Optional[int] = None

    class Config:
        from_attributes = True


# ===== NOTIFICACIONES =====
class NotificacionBase(BaseModel):
    """Schema base de notificación"""
    tipo: Literal["plazo_vencido", "cambio_estado", "asignacion", "recordatorio", "general"]
    titulo: str = Field(..., min_length=1, max_length=200)
    mensaje: str = Field(..., min_length=1)
    fecha_vencimiento: Optional[datetime] = None


class NotificacionCreate(NotificacionBase):
    """Schema para crear notificación"""
    usuario_id: UUID
    siniestro_id: Optional[UUID] = None


class NotificacionUpdate(BaseModel):
    """Schema para actualizar notificación"""
    leida: Optional[bool] = None
    titulo: Optional[str] = Field(None, min_length=1, max_length=200)
    mensaje: Optional[str] = Field(None, min_length=1)
    fecha_vencimiento: Optional[datetime] = None


class NotificacionResponse(NotificacionBase):
    """Schema de respuesta de notificación"""
    id: UUID
    usuario_id: UUID
    siniestro_id: Optional[UUID] = None
    leida: bool
    creado_en: datetime

    class Config:
        from_attributes = True


# ===== EVIDENCIAS FOTOGRÁFICAS =====
class EvidenciaFotograficaBase(BaseModel):
    """Schema base de evidencia fotográfica"""
    nombre_archivo: str = Field(..., min_length=1, max_length=255)
    ruta_archivo: str = Field(..., min_length=1, max_length=500)
    tamaño_archivo: Optional[int] = None
    tipo_mime: Optional[str] = Field(None, max_length=100)
    latitud: Optional[Decimal] = None
    longitud: Optional[Decimal] = None
    fecha_toma: Optional[datetime] = None
    descripcion: Optional[str] = None
    activo: bool = True


class EvidenciaFotograficaCreate(EvidenciaFotograficaBase):
    """Schema para crear evidencia fotográfica"""
    siniestro_id: UUID
    usuario_subio: Optional[UUID] = None


class EvidenciaFotograficaUpdate(BaseModel):
    """Schema para actualizar evidencia fotográfica"""
    nombre_archivo: Optional[str] = Field(None, min_length=1, max_length=255)
    descripcion: Optional[str] = None
    latitud: Optional[Decimal] = None
    longitud: Optional[Decimal] = None
    fecha_toma: Optional[datetime] = None
    activo: Optional[bool] = None


class EvidenciaFotograficaResponse(EvidenciaFotograficaBase):
    """Schema de respuesta de evidencia fotográfica"""
    id: UUID
    siniestro_id: UUID
    usuario_subio: Optional[UUID] = None
    eliminado: bool
    creado_en: datetime
    eliminado_en: Optional[datetime] = None

    class Config:
        from_attributes = True


# ===== RELACIONES SINIESTRO-USUARIO (INVOLUCRADOS / ABOGADOS) =====
class SiniestroUsuarioBase(BaseModel):
    """Schema base: involucrados del siniestro son abogados asignados."""
    es_principal: bool = False
    observaciones: Optional[str] = None
    activo: bool = True


class SiniestroUsuarioCreate(SiniestroUsuarioBase):
    """Schema para crear relación siniestro-usuario"""
    siniestro_id: UUID
    usuario_id: UUID


class SiniestroUsuarioUpdate(BaseModel):
    """Schema para actualizar relación siniestro-usuario"""
    es_principal: Optional[bool] = None
    observaciones: Optional[str] = None
    activo: Optional[bool] = None


class SiniestroUsuarioResponse(SiniestroUsuarioBase):
    """Schema de respuesta de relación siniestro-usuario"""
    id: UUID
    siniestro_id: UUID
    usuario_id: UUID
    eliminado: bool = False
    creado_en: datetime
    actualizado_en: datetime
    eliminado_en: Optional[datetime] = None

    class Config:
        from_attributes = True


# ===== RELACIONES SINIESTRO-ÁREA =====
class SiniestroAreaBase(BaseModel):
    """Schema base de relación siniestro-área"""
    fecha_asignacion: Optional[datetime] = None
    observaciones: Optional[str] = None
    activo: bool = True


class SiniestroAreaCreateBody(SiniestroAreaBase):
    """Schema para el body de la petición (sin siniestro_id, viene en la URL)"""
    area_id: UUID


class SiniestroAreaCreate(SiniestroAreaBase):
    """Schema para crear relación siniestro-área (completo, con siniestro_id)"""
    siniestro_id: UUID
    area_id: UUID


class SiniestroAreaUpdate(BaseModel):
    """Schema para actualizar relación siniestro-área"""
    fecha_asignacion: Optional[datetime] = None
    observaciones: Optional[str] = None
    activo: Optional[bool] = None
    abogado_principal_informe_id: Optional[UUID] = None


class SiniestroAreaResponse(SiniestroAreaBase):
    """Schema de respuesta de relación siniestro-área"""
    id: UUID
    siniestro_id: UUID
    area_id: UUID
    abogado_principal_informe_id: Optional[UUID] = None
    fecha_asignacion: datetime
    eliminado: bool = False
    creado_en: datetime
    actualizado_en: datetime
    eliminado_en: Optional[datetime] = None

    class Config:
        from_attributes = True


# ===== VERSIONES DE DESCRIPCIÓN DE HECHOS =====
class VersionesDescripcionHechosBase(BaseModel):
    """Schema base de versión de descripción de hechos"""
    descripcion_html: str = Field(..., min_length=1)
    observaciones: Optional[str] = None


class VersionesDescripcionHechosCreate(VersionesDescripcionHechosBase):
    """Schema para crear versión de descripción de hechos.

    `siniestro_id` es opcional en el cuerpo JSON: en
    `POST /siniestros/{siniestro_id}/versiones-descripcion` la ruta lo asigna desde el path.
    """

    siniestro_id: Optional[UUID] = None


class VersionesDescripcionHechosUpdate(BaseModel):
    """Schema para actualizar versión de descripción de hechos"""
    observaciones: Optional[str] = None


class VersionesDescripcionHechosResponse(VersionesDescripcionHechosBase):
    """Schema de respuesta de versión de descripción de hechos"""
    id: UUID
    siniestro_id: UUID
    version: int
    es_actual: bool
    creado_por: UUID
    creado_en: datetime
    actualizado_en: datetime

    class Config:
        from_attributes = True
