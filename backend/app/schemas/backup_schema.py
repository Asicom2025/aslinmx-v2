"""
Schemas para sistema de backup y restore
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID
from decimal import Decimal


class BackupResponse(BaseModel):
    id: UUID
    empresa_id: UUID
    nombre_archivo: str
    ruta_archivo: str
    tamano_bytes: Optional[Decimal]
    tipo: str
    estado: str
    error: Optional[str]
    creado_por: Optional[UUID]
    creado_en: datetime
    programado: bool

    class Config:
        from_attributes = True


class BackupCreate(BaseModel):
    tipo: str = Field("completo", pattern="^(completo|incremental|solo_datos)$")
    nombre_archivo: Optional[str] = None


class RestoreRequest(BaseModel):
    backup_id: UUID
    confirmar: bool = Field(..., description="Debe ser True para confirmar el restore")


class ConfiguracionBackupBase(BaseModel):
    activo: bool = True
    frecuencia: str = Field(..., pattern="^(diario|semanal|mensual)$")
    hora: str = Field(..., pattern="^([0-1][0-9]|2[0-3]):[0-5][0-9]$")  # HH:MM
    dia_semana: Optional[int] = Field(None, ge=0, le=6)  # 0-6 (Lunes-Domingo)
    dia_mes: Optional[int] = Field(None, ge=1, le=31)
    tipo: str = Field("completo", pattern="^(completo|incremental)$")
    retener_dias: int = Field(30, ge=1, le=365)
    ruta_destino: Optional[str] = None
    notificar: bool = True
    email_notificacion: Optional[str] = None


class ConfiguracionBackupCreate(ConfiguracionBackupBase):
    pass


class ConfiguracionBackupUpdate(BaseModel):
    activo: Optional[bool] = None
    frecuencia: Optional[str] = Field(None, pattern="^(diario|semanal|mensual)$")
    hora: Optional[str] = Field(None, pattern="^([0-1][0-9]|2[0-3]):[0-5][0-9]$")
    dia_semana: Optional[int] = Field(None, ge=0, le=6)
    dia_mes: Optional[int] = Field(None, ge=1, le=31)
    tipo: Optional[str] = Field(None, pattern="^(completo|incremental)$")
    retener_dias: Optional[int] = Field(None, ge=1, le=365)
    ruta_destino: Optional[str] = None
    notificar: Optional[bool] = None
    email_notificacion: Optional[str] = None


class ConfiguracionBackupResponse(ConfiguracionBackupBase):
    id: UUID
    empresa_id: UUID
    ultimo_backup: Optional[datetime]
    proximo_backup: Optional[datetime]
    creado_en: datetime
    actualizado_en: Optional[datetime]

    class Config:
        from_attributes = True




