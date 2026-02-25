"""
Esquemas para el sistema de flujos de trabajo configurables
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


# ==========================================================
# ESQUEMAS DE FLUJOS DE TRABAJO
# ==========================================================

class FlujoTrabajoBase(BaseModel):
    """Schema base de flujo de trabajo"""
    nombre: str = Field(..., min_length=1, max_length=100, description="Nombre del flujo")
    descripcion: Optional[str] = Field(None, description="Descripción del flujo")
    area_id: Optional[UUID] = Field(None, description="ID del área (NULL para flujo general de empresa)")
    activo: bool = Field(True, description="Si el flujo está activo")
    es_predeterminado: bool = Field(False, description="Si es el flujo predeterminado para la empresa/área")


class FlujoTrabajoCreate(FlujoTrabajoBase):
    """Schema para crear un flujo de trabajo"""
    pass


class FlujoTrabajoUpdate(BaseModel):
    """Schema para actualizar un flujo de trabajo"""
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    descripcion: Optional[str] = None
    area_id: Optional[UUID] = None
    activo: Optional[bool] = None
    es_predeterminado: Optional[bool] = None


class DocumentoRelacionado(BaseModel):
    """Información básica de documento relacionado"""
    id: UUID
    nombre: str

    class Config:
        from_attributes = True


class EtapaFlujoSimple(BaseModel):
    """Etapa simple para respuesta"""
    id: UUID
    nombre: str
    descripcion: Optional[str] = None
    orden: int
    es_obligatoria: bool
    permite_omision: bool = False
    inhabilita_siguiente: bool
    activo: bool
    tipo_documento_principal_id: Optional[UUID] = None
    categoria_documento_id: Optional[UUID] = None
    plantilla_documento_id: Optional[UUID] = None
    tipo_documento_principal: Optional[DocumentoRelacionado] = None
    categoria_documento: Optional[DocumentoRelacionado] = None
    plantilla_documento: Optional[DocumentoRelacionado] = None

    class Config:
        from_attributes = True


class FlujoTrabajoResponse(FlujoTrabajoBase):
    """Schema de respuesta de flujo de trabajo"""
    id: UUID
    empresa_id: UUID
    creado_en: datetime
    actualizado_en: datetime
    eliminado_en: Optional[datetime] = None
    etapas: Optional[List[EtapaFlujoSimple]] = []

    class Config:
        from_attributes = True


# ==========================================================
# ESQUEMAS DE ETAPAS
# ==========================================================

class EtapaFlujoBase(BaseModel):
    """Schema base de etapa"""
    nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: Optional[str] = None
    orden: int = Field(..., ge=1, description="Orden de la etapa en el flujo")
    es_obligatoria: bool = Field(True, description="Si la etapa es obligatoria")
    permite_omision: bool = Field(False, description="Si se puede omitir la etapa")
    tipo_documento_principal_id: Optional[UUID] = Field(None, description="ID del tipo de documento principal requerido")
    categoria_documento_id: Optional[UUID] = Field(None, description="ID de la categoría de documento específica")
    plantilla_documento_id: Optional[UUID] = Field(None, description="ID de la plantilla de documento específica")
    inhabilita_siguiente: bool = Field(False, description="Si bloquea la siguiente etapa si no está completa")
    activo: bool = Field(True)


class EtapaFlujoCreate(EtapaFlujoBase):
    """Schema para crear una etapa"""
    flujo_trabajo_id: Optional[UUID] = Field(None, description="ID del flujo al que pertenece (se asigna desde la ruta)")


class EtapaFlujoUpdate(BaseModel):
    """Schema para actualizar una etapa"""
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    descripcion: Optional[str] = None
    orden: Optional[int] = Field(None, ge=1)
    es_obligatoria: Optional[bool] = None
    permite_omision: Optional[bool] = None
    tipo_documento_principal_id: Optional[UUID] = None
    categoria_documento_id: Optional[UUID] = None
    plantilla_documento_id: Optional[UUID] = None
    inhabilita_siguiente: Optional[bool] = None
    activo: Optional[bool] = None


class EtapaFlujoResponse(EtapaFlujoBase):
    """Schema de respuesta de etapa"""
    id: UUID
    flujo_trabajo_id: UUID
    creado_en: datetime
    actualizado_en: datetime
    eliminado_en: Optional[datetime] = None
    tipo_documento_principal: Optional[DocumentoRelacionado] = None
    categoria_documento: Optional[DocumentoRelacionado] = None
    plantilla_documento: Optional[DocumentoRelacionado] = None

    class Config:
        from_attributes = True


# ==========================================================
# ESQUEMAS DE SINIESTRO ETAPAS
# ==========================================================

class SiniestroEtapaBase(BaseModel):
    """Schema base de etapa de siniestro"""
    estado: str = Field("pendiente", description="Estado de la etapa: pendiente, en_proceso, completada, omitida, bloqueada")
    observaciones: Optional[str] = None
    documento_principal_id: Optional[UUID] = None


class SiniestroEtapaResponse(SiniestroEtapaBase):
    """Schema de respuesta de etapa de siniestro"""
    id: UUID
    siniestro_id: UUID
    etapa_flujo_id: UUID
    fecha_inicio: datetime
    fecha_completada: Optional[datetime] = None
    fecha_vencimiento: Optional[datetime] = None
    completado_por: Optional[UUID] = None
    creado_en: datetime
    actualizado_en: datetime
    etapa: Optional[EtapaFlujoResponse] = None  # Información de la etapa

    class Config:
        from_attributes = True


class CompletarEtapaRequest(BaseModel):
    """Request para completar una etapa"""
    documento_principal_id: Optional[UUID] = Field(None, description="ID del documento principal si existe")
    observaciones: Optional[str] = None


class AvanzarEtapaRequest(BaseModel):
    """Request para avanzar a la siguiente etapa"""
    pass


class OrdenEtapa(BaseModel):
    """Orden de una etapa"""
    etapa_id: UUID
    orden: int


class ReordenarEtapasRequest(BaseModel):
    """Request para reordenar etapas"""
    ordenes: List[OrdenEtapa] = Field(..., description="Lista de etapas con su nuevo orden")


# ==========================================================
# ESQUEMAS DE INICIALIZACIÓN
# ==========================================================

class InicializarEtapasRequest(BaseModel):
    """Request para inicializar etapas de un siniestro"""
    flujo_trabajo_id: Optional[UUID] = Field(None, description="ID del flujo a usar (NULL para usar el predeterminado)")


# ==========================================================
# ESQUEMAS DE RESPUESTA COMPUESTA
# ==========================================================

class FlujoCompletoResponse(FlujoTrabajoResponse):
    """Flujo con todas sus etapas completas"""
    etapas: List[EtapaFlujoResponse] = []

    class Config:
        from_attributes = True


class SiniestroFlujoResponse(BaseModel):
    """Flujo completo de un siniestro con estado de etapas"""
    flujo: FlujoTrabajoResponse
    etapas: List[SiniestroEtapaResponse]

    class Config:
        from_attributes = True

