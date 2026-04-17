"""
Módulo de seguridad
Maneja autenticación, hashing de contraseñas y JWT
"""

from datetime import datetime, timedelta
from typing import Optional
import pyotp
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
import uuid
from app.db.session import get_db
from app.models.user import User

# Contexto para hashing de contraseñas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/users/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si la contraseña coincide con el hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Genera hash de la contraseña"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Crea un token JWT
    
    Args:
        data: Datos a incluir en el token
        expires_delta: Tiempo de expiración opcional
    
    Returns:
        Token JWT codificado
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """
    Crea un refresh token JWT para renovar sesión.
    Se usa con cookie httpOnly y valida purpose='refresh'.
    """
    expires_delta = timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    payload = data.copy()
    payload.update({"purpose": "refresh"})
    return create_access_token(payload, expires_delta=expires_delta)


def is_refresh_token(token: str) -> bool:
    """Valida que el JWT tenga purpose='refresh'."""
    payload = decode_access_token(token)
    return bool(payload and payload.get("purpose") == "refresh")


def create_temp_token(data: dict = None, expires_minutes: int = 5) -> str:
    """
    Crea un token temporal previo a la verificación 2FA.
    """
    base = data.copy() if isinstance(data, dict) else {}
    base.update({"purpose": "pre_2fa"})
    return create_access_token(base, timedelta(minutes=expires_minutes))


def is_temp_token(token: str) -> bool:
    payload = decode_access_token(token)
    return bool(payload and payload.get("purpose") == "pre_2fa")


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def verify_totp_code(secret: str, code: str) -> bool:
    """Verifica un código TOTP (con ventana de tolerancia)."""
    if not secret:
        return False
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decodifica un token JWT
    
    Args:
        token: Token JWT a decodificar
    
    Returns:
        Payload del token o None si es inválido
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def create_impersonation_exchange_token(actor_id: str, target_user_id: str) -> str:
    """
    Token de corta duración para canjear por sesión del usuario objetivo.
    Solo debe emitirse a usuarios con roles.nivel == 0.
    """
    return create_access_token(
        {
            "sub": target_user_id,
            "act": actor_id,
            "purpose": "impersonate_exchange",
        },
        expires_delta=timedelta(minutes=settings.IMPERSONATION_TOKEN_EXPIRE_MINUTES),
    )


def is_impersonation_exchange_token(token: str) -> bool:
    payload = decode_access_token(token)
    return bool(payload and payload.get("purpose") == "impersonate_exchange")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Obtiene el usuario actual desde el token JWT
    
    Args:
        token: Token JWT
        db: Sesión de base de datos
    
    Returns:
        Usuario autenticado
    
    Raises:
        HTTPException: Si el token es inválido o el usuario no existe
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    
    if payload is None:
        raise credentials_exception

    # No usar el token de canje de impersonación como Bearer de API
    if payload.get("purpose") == "impersonate_exchange":
        raise credentials_exception
    
    user_id: str = payload.get("sub")
    
    if user_id is None:
        raise credentials_exception
    
    # IDs ahora son UUID
    try:
        user_uuid = uuid.UUID(user_id)
    except Exception:
        user_uuid = user_id  # fallback por si ya viene como UUID
    user = db.query(User).filter(User.id == user_uuid).first()
    
    if user is None:
        raise credentials_exception

    # Sesión como otro usuario: claim opcional "imp" = UUID del actor (desarrollador)
    imp = payload.get("imp")
    if imp:
        try:
            setattr(user, "impersonated_by", uuid.UUID(str(imp)))
        except Exception:
            setattr(user, "impersonated_by", None)
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Verifica que el usuario actual esté activo
    
    Args:
        current_user: Usuario actual
    
    Returns:
        Usuario activo
    
    Raises:
        HTTPException: Si el usuario está inactivo
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario inactivo"
        )
    
    return current_user

