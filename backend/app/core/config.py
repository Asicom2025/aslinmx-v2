"""
Configuración central de la aplicación
Maneja variables de entorno y configuraciones globales
"""

from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    """Configuración de la aplicación usando Pydantic"""
    
    # Base de datos
    DATABASE_URL: str = "postgresql://aslin_user:aslin_password@db:5432/aslin_db"
    
    # Seguridad JWT
    SECRET_KEY: str = "09d25e094faa6caa6bd32b168903878692e209d09d25e094faa6caa6bd32b168903878692e209d0"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    # 2FA
    TOTP_ISSUER: str = "Aslin 2.0"
    
    # reCAPTCHA Enterprise v3
    GOOGLE_CLOUD_PROJECT_ID: Optional[str] = None
    RECAPTCHA_KEY: Optional[str] = None  # Clave del sitio reCAPTCHA Enterprise
    RECAPTCHA_SITE_KEY: Optional[str] = None  # Mantener para compatibilidad con frontend
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://0.0.0.0:3000",
        "http://frontend:3000"
    ]
    
    # Configuración del servidor
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    DEBUG: bool = False

    # URL del frontend (para enlaces en correos, ej. ver siniestro)
    FRONTEND_URL: str = "http://localhost:3000"
    BASE_URL: str = "http://localhost:3000"  # URL base para correos (enlaces, assets). Si no se define en .env, usa FRONTEND_URL
    BACKEND_URL: str = "http://localhost:8000"  # URL base del API (para enlaces de descarga en correos)
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

