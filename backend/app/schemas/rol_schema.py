"""
Schemas de Rol
Define los modelos Pydantic para validación y serialización
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class RolBase(BaseModel):
    """Schema base de rol"""
    nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: Optional[str] = None
    nivel: Optional[int] = Field(None, ge=1, le=10)


class RolCreate(RolBase):
    """Schema para crear rol"""
    activo: Optional[bool] = True


class RolUpdate(BaseModel):
    """Schema para actualizar rol"""
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    descripcion: Optional[str] = None
    nivel: Optional[int] = Field(None, ge=1, le=10)
    activo: Optional[bool] = None


class RolResponse(RolBase):
    """Schema de respuesta de rol"""
    id: UUID
    activo: Optional[bool] = True
    creado_en: Optional[datetime] = None
    actualizado_en: Optional[datetime] = None
    eliminado_en: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        populate_by_name = True

