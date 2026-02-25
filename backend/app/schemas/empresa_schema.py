"""
Schemas de Empresa
Define los modelos Pydantic para validación y serialización
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class EmpresaBase(BaseModel):
    """Schema base de empresa"""
    nombre: str = Field(..., min_length=1, max_length=150)
    alias: Optional[str] = Field(None, max_length=100)
    logo_url: Optional[str] = None
    color_principal: Optional[str] = Field(None, max_length=20)
    color_secundario: Optional[str] = Field(None, max_length=20)
    color_terciario: Optional[str] = Field(None, max_length=20)
    dominio: Optional[str] = Field(None, max_length=150)


class EmpresaCreate(EmpresaBase):
    """Schema para crear empresa"""
    activo: Optional[bool] = True


class EmpresaUpdate(BaseModel):
    """Schema para actualizar empresa"""
    nombre: Optional[str] = Field(None, min_length=1, max_length=150)
    alias: Optional[str] = Field(None, max_length=100)
    logo_url: Optional[str] = None
    color_principal: Optional[str] = Field(None, max_length=20)
    color_secundario: Optional[str] = Field(None, max_length=20)
    color_terciario: Optional[str] = Field(None, max_length=20)
    dominio: Optional[str] = Field(None, max_length=150)
    activo: Optional[bool] = None


class EmpresaResponse(EmpresaBase):
    """Schema de respuesta de empresa"""
    id: UUID
    activo: Optional[bool] = True
    creado_en: Optional[datetime] = None
    actualizado_en: Optional[datetime] = None
    eliminado_en: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        populate_by_name = True

