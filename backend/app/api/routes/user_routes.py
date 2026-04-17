"""
Rutas de Usuarios
Endpoints para operaciones CRUD de usuarios y autenticación
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse
import uuid as uuid_lib

from app.db.session import get_db
from app.services.permiso_service import RolPermisoService
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
    ImpersonationAcceptRequest,
    ImpersonationTokenResponse,
)
from app.services.user_service import UserService
from app.services.recaptcha_service import RecaptchaService
from app.core.security import (
    get_current_active_user,
    create_refresh_token,
    decode_access_token,
    create_access_token,
    is_refresh_token,
    create_impersonation_exchange_token,
)
from app.core.permisos import require_permiso
from app.core.nivel_acceso import solo_superadmin_por_nivel, usuario_bypass_permisos
from app.models.user import User
from app.models.permiso import Modulo, Accion
from app.core.config import settings
from app.services.auditoria_service import AuditoriaService

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
        access_token = result.get("access_token")
        # Emitir refresh token en cookie httpOnly para poder renovar sesión
        refresh_token = create_refresh_token({"sub": str(user.id)})
        response = JSONResponse({"requires_2fa": False, "access_token": access_token})
        response.set_cookie(
            key=settings.REFRESH_TOKEN_COOKIE_NAME,
            value=refresh_token,
            httponly=True,
            secure=request.url.scheme == "https",
            samesite="lax",
            max_age=settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
            path="/",
        )
        return response


@router.post("/2fa/verify", response_model=Token)
def verify_2fa(
    payload: TwoFAVerifyRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Login paso 2: verifica TOTP usando temp_token y retorna access_token JWT
    """
    token = UserService.verify_2fa_and_issue_token(db, payload.temp_token, payload.code)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Código 2FA inválido o token expirado")

    # Crear refresh token desde el temp_token (sub)
    temp_payload = decode_access_token(payload.temp_token)
    user_id = temp_payload.get("sub") if temp_payload else None
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Temp token inválido o expirado")

    refresh_token = create_refresh_token({"sub": str(user_id)})
    response = JSONResponse({"access_token": token, "token_type": "bearer"})
    response.set_cookie(
        key=settings.REFRESH_TOKEN_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    return response


@router.post("/refresh", response_model=Token)
def refresh_access_token(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Renueva el access token usando refresh_token en cookie httpOnly.
    """
    refresh_token = request.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión expirada",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not is_refresh_token(refresh_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(refresh_token) or {}
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_uuid = uuid_lib.UUID(str(sub))
    except Exception:
        user_uuid = sub  # fallback

    user = db.query(User).filter(User.id == user_uuid).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión expirada",
            headers={"WWW-Authenticate": "Bearer"},
        )

    imp = payload.get("imp")
    access_payload = {"sub": str(user.id)}
    if imp:
        access_payload["imp"] = imp
    new_access_token = create_access_token(access_payload)
    refresh_payload = {"sub": str(user.id)}
    if imp:
        refresh_payload["imp"] = imp
    new_refresh_token = create_refresh_token(refresh_payload)

    response = JSONResponse({"access_token": new_access_token, "token_type": "bearer"})
    response.set_cookie(
        key=settings.REFRESH_TOKEN_COOKIE_NAME,
        value=new_refresh_token,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    return response


@router.post("/logout")
def logout_session(
    request: Request,
):
    """
    Cierra la sesión limpiando refresh_token en cookie (no invalida tokens ya emitidos).
    """
    response = JSONResponse({"success": True})
    response.delete_cookie(settings.REFRESH_TOKEN_COOKIE_NAME, path="/")
    return response


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Obtener información del usuario actual, incluyendo permisos de su rol.
    """
    list(current_user.areas)  # forzar carga de áreas (multiárea)
    # JWT añade impersonated_by como UUID en el objeto User; no es columna ORM.
    # Si se valida antes de quitarlo, Pydantic espera ImpersonatedByBrief y falla.
    imp_id = getattr(current_user, "impersonated_by", None)
    if hasattr(current_user, "impersonated_by"):
        try:
            delattr(current_user, "impersonated_by")
        except AttributeError:
            pass
    data = UserResponse.model_validate(current_user).model_dump()
    if usuario_bypass_permisos(db, current_user):
        rows = (
            db.query(Modulo.nombre_tecnico, Accion.nombre_tecnico)
            .join(Accion, Accion.modulo_id == Modulo.id)
            .filter(
                Modulo.activo == True,
                Modulo.eliminado_en.is_(None),
                Accion.activo == True,
            )
            .all()
        )
        data["permisos"] = [{"modulo": r[0], "accion": r[1]} for r in rows]
    elif current_user.rol_id:
        data["permisos"] = RolPermisoService.get_permisos_por_rol_nombres(db, str(current_user.rol_id))
    else:
        data["permisos"] = []
    data["areas"] = [{"id": str(a.id), "nombre": a.nombre} for a in current_user.areas]

    data["impersonated_by"] = None
    if imp_id:
        actor = db.query(User).filter(User.id == imp_id).first()
        if actor:
            data["impersonated_by"] = {"id": actor.id, "email": actor.correo}
    return data


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


@router.post("/impersonate/accept", response_model=Token)
def accept_impersonation(
    payload: ImpersonationAcceptRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Canjea el token de impersonación por una sesión del usuario objetivo (access + refresh).
    No requiere Authorization: el cuerpo trae el token de un solo uso.
    """
    p = decode_access_token(payload.token)
    if not p or p.get("purpose") != "impersonate_exchange":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de impersonación inválido o expirado",
        )
    actor_id = p.get("act")
    target_id = p.get("sub")
    if not actor_id or not target_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de impersonación inválido")

    try:
        actor_uuid = uuid_lib.UUID(str(actor_id))
        target_uuid = uuid_lib.UUID(str(target_id))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de impersonación inválido")

    actor = db.query(User).filter(User.id == actor_uuid).first()
    if not actor or not actor.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión inválida")
    if not solo_superadmin_por_nivel(db, actor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el rol nivel 0 puede completar la impersonación",
        )

    target = db.query(User).filter(User.id == target_uuid).first()
    if not target or not target.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario objetivo no encontrado")

    access_token = create_access_token({"sub": str(target.id), "imp": str(actor.id)})
    refresh_token = create_refresh_token({"sub": str(target.id), "imp": str(actor.id)})

    try:
        AuditoriaService.registrar_accion(
            db=db,
            usuario_id=actor.id,
            empresa_id=actor.empresa_id,
            accion="impersonate",
            modulo="usuarios",
            tabla="usuarios",
            registro_id=target.id,
            descripcion=f"Impersonación: {actor.correo} → {target.correo}",
            ip_address=request.client.host if request.client else None,
        )
    except Exception:
        pass

    response = JSONResponse({"access_token": access_token, "token_type": "bearer"})
    response.set_cookie(
        key=settings.REFRESH_TOKEN_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    return response


@router.post("/{user_id}/impersonate", response_model=ImpersonationTokenResponse)
def issue_impersonation_token(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("usuarios", "read")),
):
    """
    Genera un token de un solo paso para iniciar sesión como el usuario indicado.
    Solo roles con nivel 0 (desarrollador / SuperAdmin).
    """
    if not solo_superadmin_por_nivel(db, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el rol nivel 0 puede generar acceso como otro usuario",
        )
    target = UserService.get_user_by_id(db, user_id)
    if not target or not target.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    if str(target.id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puede generar impersonación hacia su propio usuario",
        )

    token = create_impersonation_exchange_token(str(current_user.id), str(target.id))
    try:
        AuditoriaService.registrar_accion(
            db=db,
            usuario_id=current_user.id,
            empresa_id=current_user.empresa_id,
            accion="impersonate_token",
            modulo="usuarios",
            tabla="usuarios",
            registro_id=target.id,
            descripcion=f"Token de impersonación emitido hacia {target.correo}",
            ip_address=request.client.host if request.client else None,
        )
    except Exception:
        pass

    return ImpersonationTokenResponse(
        impersonation_token=token,
        expires_in_minutes=settings.IMPERSONATION_TOKEN_EXPIRE_MINUTES,
    )


@router.get("", response_model=List[UserResponse])
def get_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("usuarios", "read")),
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
    current_user: User = Depends(require_permiso("usuarios", "read")),
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
    list(user.areas)  # forzar carga de áreas (multiárea) para la respuesta
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("usuarios", "update")),
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
    current_user: User = Depends(require_permiso("usuarios", "delete")),
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

