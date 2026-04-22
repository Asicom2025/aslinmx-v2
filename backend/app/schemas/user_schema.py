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
    nombre: Optional[str] = None
    apellido_paterno: Optional[str] = None
    apellido_materno: Optional[str] = None
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

    class Config:
        from_attributes = True


class RolResponse(BaseModel):
    id: UUID
    nombre: str
    descripcion: Optional[str] = None
    nivel: Optional[int] = None

    class Config:
        from_attributes = True


class UsuarioPerfilResponse(BaseModel):
    foto_de_perfil: Optional[str] = None
    nombre: Optional[str] = None
    apellido_paterno: Optional[str] = None
    apellido_materno: Optional[str] = None
    titulo: Optional[str] = None
    cedula_profesional: Optional[str] = None
    firma: Optional[str] = None  # Firma física (imagen)
    firma_digital: Optional[str] = None  # Imagen que se adjunta al enviar correos por la plataforma

    class Config:
        from_attributes = True


class UsuarioPerfilListResponse(BaseModel):
    """
    Perfil en listados GET /users: solo datos de texto para nombres en tablas/selects.
    Omite foto/firma (suelen ser rutas largas o r2://); ahí estaba el costo al inlinkear desde storage.
    """

    nombre: Optional[str] = None
    apellido_paterno: Optional[str] = None
    apellido_materno: Optional[str] = None
    titulo: Optional[str] = None
    cedula_profesional: Optional[str] = None

    class Config:
        from_attributes = True


class UsuarioContactosResponse(BaseModel):
    telefono: Optional[str] = None
    celular: Optional[str] = None

    class Config:
        from_attributes = True


class UsuarioDireccionResponse(BaseModel):
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    estado: Optional[str] = None
    codigo_postal: Optional[str] = None
    pais: Optional[str] = None

    class Config:
        from_attributes = True


class PermisoItem(BaseModel):
    """Un permiso (módulo + acción) para el usuario actual"""
    modulo: str
    accion: str


class AreaSummary(BaseModel):
    """Resumen de área para listados (ej. áreas del usuario)"""
    id: UUID
    nombre: str

    class Config:
        from_attributes = True


class ImpersonatedByBrief(BaseModel):
    """Usuario real (desarrollador) cuando la sesión es por impersonación."""
    id: UUID
    email: Optional[str] = None


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
    # Permisos del rol del usuario (modulo_tecnico, accion_tecnico)
    permisos: Optional[List[PermisoItem]] = None
    # Áreas asignadas al usuario (multiárea)
    areas: Optional[List[AreaSummary]] = None
    # Info de seguridad
    two_factor_enabled: Optional[bool] = None
    two_factor_verified_at: Optional[datetime] = None
    # Sesión iniciada como otro usuario (solo JWT con claim imp)
    impersonated_by: Optional[ImpersonatedByBrief] = None

    class Config:
        from_attributes = True


class UserListItemResponse(UserBase):
    """
    Listado de usuarios: sin contactos/dirección/permisos para evitar carga y N+1.
    El perfil no incluye foto ni firmas (suelen existir solo en firma/firma_digital y disparaban lecturas a storage).
    """
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    empresa: Optional[EmpresaResponse] = None
    empresas: Optional[List[EmpresaResponse]] = None
    rol: Optional[RolResponse] = None
    perfil: Optional[UsuarioPerfilListResponse] = None
    areas: Optional[List[AreaSummary]] = None
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


class MobileLoginResponse(BaseModel):
    """Respuesta de login para cliente móvil con refresh explícito."""
    requires_2fa: bool
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    temp_token: Optional[str] = None


class TwoFAVerifyRequest(BaseModel):
    """Solicitud de verificación 2FA (TOTP)"""
    code: str = Field(..., min_length=6, max_length=8)
    temp_token: str


class Token(BaseModel):
    """Schema de token de acceso"""
    access_token: str
    token_type: str = "bearer"


class MobileToken(Token):
    """Par de tokens para cliente móvil."""
    refresh_token: str


class MobileRefreshRequest(BaseModel):
    """Solicitud de renovación para cliente móvil."""
    refresh_token: str = Field(..., min_length=20)


class TokenData(BaseModel):
    """Schema de datos del token"""
    user_id: Optional[str] = None


# Actualizaciones para /users/me
class UsuarioPerfilUpdate(BaseModel):
    foto_de_perfil: Optional[str] = None
    nombre: Optional[str] = None
    apellido_paterno: Optional[str] = None
    apellido_materno: Optional[str] = None
    titulo: Optional[str] = None
    cedula_profesional: Optional[str] = None
    firma: Optional[str] = None
    firma_digital: Optional[str] = None


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
    nombre: Optional[str] = None
    apellido_paterno: Optional[str] = None
    apellido_materno: Optional[str] = None
    password: Optional[str] = Field(None, min_length=6, max_length=100)
    is_active: Optional[bool] = None
    two_factor_enabled: Optional[bool] = None
    empresa_id: Optional[UUID] = None
    empresa_ids: Optional[List[UUID]] = None
    rol_id: Optional[UUID] = None
    area_ids: Optional[List[UUID]] = None  # Áreas asignadas al usuario (multiárea)
    perfil: Optional[UsuarioPerfilUpdate] = None
    contactos: Optional[UsuarioContactosUpdate] = None
    direccion: Optional[UsuarioDireccionUpdate] = None


class UserEmpresaSwitch(BaseModel):
    empresa_id: UUID


class UserMeUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido_paterno: Optional[str] = None
    apellido_materno: Optional[str] = None
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


class GeneratedPasswordResponse(BaseModel):
    """Solo nivel 0: contraseña nueva en claro (mostrar una vez al operador)."""
    success: bool = True
    detail: str = "Contraseña generada y guardada"
    password_plain: str


class ImpersonationAcceptRequest(BaseModel):
    """Canje del token de impersonación por sesión del usuario objetivo."""
    token: str = Field(..., min_length=20)


class ImpersonationTokenResponse(BaseModel):
    """Token de un paso para canjear en /users/impersonate/accept"""
    impersonation_token: str
    expires_in_minutes: int
