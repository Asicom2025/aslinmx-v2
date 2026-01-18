"""
Schemas de Usuario
Define los modelos Pydantic para validación y serialización
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class UserBase(BaseModel):
    """Schema base de usuario"""
    email: EmailStr
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    full_name: Optional[str] = None
    # Campos adicionales de conveniencia
    multiempresa: Optional[bool] = None
    ultimo_acceso: Optional[datetime] = None
    empresa_ids: Optional[List[UUID]] = None


class UserCreate(UserBase):
    """Schema para crear usuario"""
    password: str = Field(..., min_length=6, max_length=100)
    empresa_ids: Optional[List[UUID]] = None
    rol_id: Optional[UUID] = None
    is_active: Optional[bool] = True


class EmpresaResponse(BaseModel):
    id: UUID
    nombre: str
    alias: Optional[str] = None
    logo_url: Optional[str] = None
    color_principal: Optional[str] = None
    color_secundario: Optional[str] = None
    color_terciario: Optional[str] = None
    dominio: Optional[str] = None
    activo: Optional[bool] = None


class RolResponse(BaseModel):
    id: UUID
    nombre: str
    descripcion: Optional[str] = None
    nivel: Optional[int] = None


class UsuarioPerfilResponse(BaseModel):
    nombre: Optional[str] = None
    apellido_paterno: Optional[str] = None
    apellido_materno: Optional[str] = None
    titulo: Optional[str] = None
    cedula_profesional: Optional[str] = None


class UsuarioContactosResponse(BaseModel):
    telefono: Optional[str] = None
    celular: Optional[str] = None


class UsuarioDireccionResponse(BaseModel):
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    estado: Optional[str] = None
    codigo_postal: Optional[str] = None
    pais: Optional[str] = None


class UserResponse(UserBase):
    """Schema de respuesta de usuario"""
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    empresa: Optional[EmpresaResponse] = None
    empresas: Optional[List[EmpresaResponse]] = None
    rol: Optional[RolResponse] = None
    perfil: Optional[UsuarioPerfilResponse] = None
    contactos: Optional[UsuarioContactosResponse] = None
    direccion: Optional[UsuarioDireccionResponse] = None
    # Info de seguridad
    two_factor_enabled: Optional[bool] = None
    two_factor_verified_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    """Schema para login"""
    username: str
    password: str
    recaptcha_token: Optional[str] = None  # Token de reCAPTCHA v3


class LoginResponse(BaseModel):
    """Respuesta del login con soporte para 2FA"""
    requires_2fa: bool
    access_token: Optional[str] = None
    temp_token: Optional[str] = None  # token temporal previo a 2FA


class TwoFAVerifyRequest(BaseModel):
    """Solicitud de verificación 2FA (TOTP)"""
    code: str = Field(..., min_length=6, max_length=8)
    temp_token: str


class Token(BaseModel):
    """Schema de token de acceso"""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Schema de datos del token"""
    user_id: Optional[str] = None


# Actualizaciones para /users/me
class UsuarioPerfilUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido_paterno: Optional[str] = None
    apellido_materno: Optional[str] = None
    titulo: Optional[str] = None
    cedula_profesional: Optional[str] = None


class UsuarioContactosUpdate(BaseModel):
    telefono: Optional[str] = None
    celular: Optional[str] = None


class UsuarioDireccionUpdate(BaseModel):
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    estado: Optional[str] = None
    codigo_postal: Optional[str] = None
    pais: Optional[str] = None


class UserUpdate(BaseModel):
    """Schema para actualizar usuario"""
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    full_name: Optional[str] = None
    password: Optional[str] = Field(None, min_length=6, max_length=100)
    is_active: Optional[bool] = None
    empresa_id: Optional[UUID] = None
    empresa_ids: Optional[List[UUID]] = None
    rol_id: Optional[UUID] = None
    perfil: Optional[UsuarioPerfilUpdate] = None
    contactos: Optional[UsuarioContactosUpdate] = None
    direccion: Optional[UsuarioDireccionUpdate] = None


class UserEmpresaSwitch(BaseModel):
    empresa_id: UUID


class UserMeUpdate(BaseModel):
    perfil: Optional[UsuarioPerfilUpdate] = None
    contactos: Optional[UsuarioContactosUpdate] = None
    direccion: Optional[UsuarioDireccionUpdate] = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=6, max_length=100)
    new_password: str = Field(..., min_length=6, max_length=100)


class TwoFAToggleRequest(BaseModel):
    enable: bool
    code: Optional[str] = Field(None, min_length=6, max_length=8)


class OperationResult(BaseModel):
    success: bool
    detail: Optional[str] = None
