"""
Schemas de Permisos
Define los modelos Pydantic para validación y serialización
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


# =========================
# MÓDULOS
# =========================

class ModuloBase(BaseModel):
    """Schema base de módulo"""
    nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: Optional[str] = None
    nombre_tecnico: str = Field(..., min_length=1, max_length=100)
    icono: Optional[str] = Field(None, max_length=100)
    ruta: Optional[str] = Field(None, max_length=150)
    orden: Optional[int] = Field(0, ge=0)


class ModuloCreate(ModuloBase):
    """Schema para crear módulo"""
    activo: Optional[bool] = True


class ModuloUpdate(BaseModel):
    """Schema para actualizar módulo"""
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    descripcion: Optional[str] = None
    nombre_tecnico: Optional[str] = Field(None, min_length=1, max_length=100)
    icono: Optional[str] = Field(None, max_length=100)
    ruta: Optional[str] = Field(None, max_length=150)
    orden: Optional[int] = Field(None, ge=0)
    activo: Optional[bool] = None


class ModuloResponse(ModuloBase):
    """Schema de respuesta de módulo"""
    id: UUID
    activo: Optional[bool] = True
    creado_en: Optional[datetime] = None
    actualizado_en: Optional[datetime] = None
    eliminado_en: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        populate_by_name = True


# =========================
# ACCIONES
# =========================

class AccionBase(BaseModel):
    """Schema base de acción"""
    nombre: str = Field(..., min_length=1, max_length=50)
    descripcion: Optional[str] = None
    nombre_tecnico: str = Field(..., min_length=1, max_length=50)


class AccionCreate(AccionBase):
    """Schema para crear acción"""
    activo: Optional[bool] = True


class AccionResponse(AccionBase):
    """Schema de respuesta de acción"""
    id: UUID
    activo: Optional[bool] = True
    creado_en: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        populate_by_name = True


# =========================
# PERMISOS DE ROL
# =========================

class RolPermisoBase(BaseModel):
    """Schema base de permiso de rol"""
    rol_id: UUID
    modulo_id: UUID
    accion_id: UUID


class RolPermisoCreate(RolPermisoBase):
    """Schema para crear permiso de rol"""
    activo: Optional[bool] = True


class RolPermisoUpdate(BaseModel):
    """Schema para actualizar permiso de rol"""
    activo: Optional[bool] = None


class RolPermisoResponse(RolPermisoBase):
    """Schema de respuesta de permiso de rol"""
    id: UUID
    activo: Optional[bool] = True
    creado_en: Optional[datetime] = None
    creado_por: Optional[UUID] = None
    
    # Información relacionada
    modulo: Optional[ModuloResponse] = None
    accion: Optional[AccionResponse] = None
    
    class Config:
        from_attributes = True
        populate_by_name = True


# =========================
# ESQUEMAS PARA CONFIGURACIÓN
# =========================

class PermisoConfig(BaseModel):
    """Schema para configuración de permisos"""
    modulo_id: UUID
    modulo_nombre: str
    accion_id: UUID
    accion_nombre: str
    accion_tecnica: str
    tiene_permiso: bool


class RolPermisosConfigResponse(BaseModel):
    """Schema de respuesta con configuración de permisos de un rol"""
    rol_id: UUID
    rol_nombre: str
    permisos: List[PermisoConfig]
    
    class Config:
        from_attributes = True


class RolPermisosBulkUpdate(BaseModel):
    """Schema para actualizar múltiples permisos a la vez"""
    permisos: List[RolPermisoCreate]  # Lista de permisos a asignar
    eliminar_otros: Optional[bool] = False  # Si True, elimina los permisos no incluidos

