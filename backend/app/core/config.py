"""
Configuración central de la aplicación
Maneja variables de entorno y configuraciones globales
"""

from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    """Configuración de la aplicación usando Pydantic"""
    
    # Base de datos
    # Debe venir SIEMPRE del .env (no exponer credenciales en código)
    DATABASE_URL: str
    
    # Seguridad JWT
    # SECRET_KEY y tiempos de expiración deben configurarse en .env
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    # Token de un solo paso para iniciar sesión como otro usuario (solo nivel 0)
    IMPERSONATION_TOKEN_EXPIRE_MINUTES: int = 120
    # Refresh token (JWT) para renovar sesión sin re-login
    # Default: 7 días
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    REFRESH_TOKEN_COOKIE_NAME: str = "refresh_token"
    # 2FA
    TOTP_ISSUER: str = "Aslin 2.0"
    
    # reCAPTCHA Enterprise v3
    GOOGLE_CLOUD_PROJECT_ID: Optional[str] = None
    RECAPTCHA_KEY: Optional[str] = None  # Clave del sitio reCAPTCHA Enterprise
    RECAPTCHA_SITE_KEY: Optional[str] = None  # Mantener para compatibilidad con frontend
    
    # CORS: debe venir del .env (lista o string separado por comas)
    CORS_ORIGINS: List[str]
    
    # Configuración del servidor (host/puerto/debug) también desde .env
    BACKEND_HOST: str
    BACKEND_PORT: int
    DEBUG: bool

    # URL del frontend / backend (OBLIGATORIAS en entorno real).
    # Deben venir del .env; aquí no se fijan valores concretos.
    # - FRONTEND_URL y BACKEND_URL son obligatorias (si faltan, Pydantic levantará error al iniciar).
    # - BASE_URL es opcional y, si falta, se usa FRONTEND_URL a nivel de uso (no aquí).
    FRONTEND_URL: str  # ej: https://app.midominio.com
    BASE_URL: Optional[str] = None  # URL base para correos (enlaces, assets). Si es None, se usará FRONTEND_URL.
    BACKEND_URL: str  # ej: https://api.midominio.com
    # Rutas de assets para plantillas de correo (servidos por el frontend en /assets/...)
    EMAIL_LOGO_PATH: str = "/assets/logos/logo_dx-legal.png"
    EMAIL_FILE_ICON_PATH: str = "/assets/icons/file2.png"

    # Migración documental legacy
    LEGACY_DOCUMENTS_ENABLED: bool = True
    LEGACY_DOCUMENTS_ROOT: Optional[str] = None
    LEGACY_DOCUMENTS_PATH_TEMPLATE: str = "{old_id}"
    LEGACY_DOCUMENTS_SESSION_MINUTES: int = 30
    LEGACY_DOCUMENTS_REMOTE_TIMEOUT_SECONDS: int = 30

    # Storage de archivos
    STORAGE_PROVIDER: str = "local"  # local, r2, auto
    UPLOAD_DIR: str = "uploads"
    STORAGE_LOCAL_ROOT: Optional[str] = None
    STORAGE_SIGNED_URL_TTL_SECONDS: int = 900
    STORAGE_VALIDATE_ON_STARTUP: bool = True
    STORAGE_RECONCILE_SAMPLE_LIMIT: int = 25

    # Cloudflare R2 (S3-compatible)
    R2_ACCOUNT_ID: Optional[str] = None
    R2_ACCESS_KEY_ID: Optional[str] = None
    R2_SECRET_ACCESS_KEY: Optional[str] = None
    R2_BUCKET_NAME: Optional[str] = None
    R2_ENDPOINT_URL: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Convertir CORS_ORIGINS de string a lista si es necesario
        if isinstance(self.CORS_ORIGINS, str):
            self.CORS_ORIGINS = [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


# Instancia global de configuración
settings = Settings()

