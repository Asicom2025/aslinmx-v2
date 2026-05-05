"""Schemas del catálogo geográfico (geo_*)."""

from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class GeoPaisResponse(BaseModel):
    id: UUID
    codigo_iso: str = Field(..., max_length=3)
    nombre: str
    activo: bool

    class Config:
        from_attributes = True


class GeoEstadoResponse(BaseModel):
    id: UUID
    pais_id: UUID
    nombre: str
    codigo_oficial: Optional[str] = None
    activo: bool

    class Config:
        from_attributes = True


class GeoMunicipioResponse(BaseModel):
    id: UUID
    estado_id: UUID
    nombre: str
    activo: bool

    class Config:
        from_attributes = True


class GooglePlaceDetailsResponse(BaseModel):
    """Respuesta mínima de normalización (opcional, si hay clave de servidor)."""

    place_id: str
    formatted_address: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    raw_types: Optional[List[str]] = None
