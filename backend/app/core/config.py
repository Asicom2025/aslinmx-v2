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

