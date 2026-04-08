"""
Esquemas ligeros para clasificar archivos legacy sin cambiar la estructura actual.
"""

from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


LegacyMigrationStatus = Literal["pendiente", "en_progreso", "completado", "sin_archivos", "error_lectura"]
LegacyFileStatus = Literal["pendiente", "clasificado"]


class LegacyClassificationSummary(BaseModel):
    flujo_trabajo_id: Optional[UUID] = None
    flujo_trabajo_nombre: Optional[str] = None
    etapa_flujo_id: Optional[UUID] = None
    etapa_flujo_nombre: Optional[str] = None
    tipo_documento_id: Optional[UUID] = None
    tipo_documento_nombre: Optional[str] = None
    categoria_documento_id: Optional[UUID] = None
    categoria_documento_nombre: Optional[str] = None
    documento_id: Optional[UUID] = None


class LegacyDetectedFileResponse(BaseModel):
    id: str
    legacy_source_ref: str
    legacy_file_id: str
    legacy_timerst: Optional[str] = None
    legacy_url: str
    nombre_archivo: str
    extension: Optional[str] = None
    size_bytes: Optional[int] = None
    fecha_archivo: Optional[datetime] = None
    tipo_mime: Optional[str] = None
    legacy_version: Optional[str] = None
    legacy_area_id: Optional[UUID] = None
    legacy_etapa: Optional[str] = None
    estado_revision: LegacyFileStatus
    previewable: bool
    clasificacion: Optional[LegacyClassificationSummary] = None


class LegacyMigrationContextResponse(BaseModel):
    estado: LegacyMigrationStatus
    requiere_modal: bool
    legacy_folder_path_ref: Optional[str] = None
    legacy_source_ref: Optional[str] = None
    total_archivos: int
    total_resueltos: int
    total_pendientes: int
    ultimo_escaneo_en: Optional[datetime] = None


class LegacyDestinationRequirementResponse(BaseModel):
    id: UUID
    nombre_documento: str
    tipo_documento_id: Optional[UUID] = None
    tipo_documento_nombre: Optional[str] = None


class LegacyDestinationTypeResponse(BaseModel):
    id: UUID
    nombre: str
    requisitos: List[LegacyDestinationRequirementResponse] = Field(default_factory=list)


class LegacyDestinationStageResponse(BaseModel):
    id: UUID
    nombre: str
    orden: int
    tipos_documento: List[LegacyDestinationTypeResponse] = Field(default_factory=list)


class LegacyDestinationCategoryResponse(BaseModel):
    id: Optional[UUID] = None
    clave: str
    nombre: str
    synthetic: bool = False
    etapas: List[LegacyDestinationStageResponse] = Field(default_factory=list)


class LegacyDestinationFlowResponse(BaseModel):
    id: UUID
    nombre: str
    area_id: Optional[UUID] = None
    area_nombre: Optional[str] = None
    categorias: List[LegacyDestinationCategoryResponse] = Field(default_factory=list)


class LegacyDestinationsResponse(BaseModel):
    flujos: List[LegacyDestinationFlowResponse] = Field(default_factory=list)


class LegacyFinalizeItemRequest(BaseModel):
    legacy_file_id: str = Field(..., min_length=1, max_length=50)
    flujo_trabajo_id: Optional[UUID] = None
    categoria_documento_id: Optional[UUID] = None
    etapa_flujo_id: Optional[UUID] = None
    tipo_documento_id: UUID
    requisito_documento_id: Optional[UUID] = None

    @model_validator(mode="after")
    def flujo_etapa_consistentes(self):
        """Puede omitirse flujo y etapa (solo catálogo), enviarse flujo sin etapa (vincular flujo sin etapa)
        o flujo y etapa juntos (destino en flujo)."""
        tiene_flujo = self.flujo_trabajo_id is not None
        tiene_etapa = self.etapa_flujo_id is not None
        if tiene_etapa and not tiene_flujo:
            raise ValueError("etapa_flujo_id requiere flujo_trabajo_id.")
        if self.requisito_documento_id is not None and (not tiene_flujo or not tiene_etapa):
            raise ValueError("requisito_documento_id solo aplica cuando se indica flujo y etapa.")
        return self


class LegacyFinalizeRequest(BaseModel):
    items: List[LegacyFinalizeItemRequest] = Field(default_factory=list)


class LegacyFinalizeResponse(BaseModel):
    documentos_creados: int
    total_solicitado: int
    total_archivos_pendientes: int
