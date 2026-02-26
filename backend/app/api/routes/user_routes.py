"""
Rutas de Usuarios
Endpoints para operaciones CRUD de usuarios y autenticación
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.user_schema import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserLogin,
    Token,
    LoginResponse,
    TwoFAVerifyRequest,
    UserMeUpdate,
    ChangePasswordRequest,
    TwoFAToggleRequest,
    OperationResult,
    UserEmpresaSwitch,
)
from app.services.user_service import UserService
from app.services.recaptcha_service import RecaptchaService
from app.core.security import get_current_active_user
from app.models.user import User
from sqlalchemy.orm import Session

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    """
    Registrar un nuevo usuario
    """
    return UserService.create_user(db, user)


@router.post("/login", response_model=LoginResponse)
async def login(
    credentials: UserLogin,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Login paso 1: valida credenciales y reCAPTCHA v3.
    - Si 2FA activado: retorna temp_token y requires_2fa=True
    - Si no: retorna access_token y requires_2fa=False
    """
    # Validar reCAPTCHA Enterprise si está configurado
    if credentials.recaptcha_token:
        client_ip = request.client.host if request.client else None
        recaptcha_result = await RecaptchaService.verify_token(
            credentials.recaptcha_token,
            remote_ip=client_ip,
            recaptcha_action="login"
        )
        
        if not RecaptchaService.is_valid(recaptcha_result, min_score=0.5):
            reasons = recaptcha_result.get("reasons", [])
            detail_msg = "Verificación de reCAPTCHA fallida. Por favor, intenta nuevamente."
            if reasons:
                detail_msg += f" Razones: {', '.join(reasons)}"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=detail_msg
            )
    
    result = UserService.start_login(db, credentials.username, credentials.password)

    user = result.get("user") if result else None
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario inactivo"
        )

    if result.get("requires_2fa"):
        return {"requires_2fa": True, "temp_token": result.get("temp_token")}
    else:
        return {"requires_2fa": False, "access_token": result.get("access_token")}


@router.post("/2fa/verify", response_model=Token)
def verify_2fa(
    payload: TwoFAVerifyRequest,
    db: Session = Depends(get_db)
):
    """
    Login paso 2: verifica TOTP usando temp_token y retorna access_token JWT
    """
    token = UserService.verify_2fa_and_issue_token(db, payload.temp_token, payload.code)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Código 2FA inválido o token expirado")
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtener información del usuario actual
    """
    return current_user


@router.put("/me", response_model=UserResponse)
def update_current_user_info(
    payload: UserMeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Actualiza información del usuario actual (perfil, contactos, dirección)
    """
    updated = UserService.update_current_user(db, current_user, payload)
    return updated


@router.put("/me/password", response_model=OperationResult)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok = UserService.change_password(db, current_user, payload)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contraseña actual incorrecta")
    return {"success": True, "detail": "Contraseña actualizada"}


@router.post("/me/2fa/toggle", response_model=OperationResult)
def toggle_two_factor(
    payload: TwoFAToggleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    ok = UserService.toggle_two_factor(db, current_user, payload)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código 2FA inválido")
    return {"success": True, "detail": "Estado de 2FA actualizado"}


@router.post("/me/empresa", response_model=UserResponse)
def set_active_empresa(
    payload: UserEmpresaSwitch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Actualiza la empresa activa del usuario autenticado.
    """
    updated = UserService.set_active_empresa(db, current_user, payload.empresa_id)
    return updated


@router.get("/me/2fa/otpauth")
def get_otpauth_uri(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Asegurar secreto disponible
    UserService.ensure_user_totp_secret(db, current_user)
    uri = UserService.get_totp_uri(current_user)
    return {"otpauth_url": uri}


@router.get("", response_model=List[UserResponse])
def get_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtener lista de usuarios (requiere autenticación)
    """
    users = UserService.get_users(db, skip=skip, limit=limit)
    return users


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtener usuario por ID (requiere autenticación)
    """
    user = UserService.get_user_by_id(db, user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Actualizar usuario (requiere autenticación)
    Permite actualizar: email, username, full_name, password, is_active, empresa_id, rol_id, perfil, contactos, dirección
    """
    user = UserService.update_user(db, user_id, user_update)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Eliminar usuario (requiere autenticación)
    """
    if not UserService.delete_user(db, user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    return None

