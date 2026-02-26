"""
Servicio de Usuarios
Lógica de negocio para gestión de usuarios
"""

from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import (
    User,
    Usuario2FA,
    UsuarioPerfil,
    UsuarioContactos,
    UsuarioDireccion,
    Empresa,
)
from app.schemas.user_schema import (
    UserCreate,
    UserUpdate,
    UserMeUpdate,
    ChangePasswordRequest,
    TwoFAToggleRequest,
)
from app.core.security import (
    get_password_hash,
    verify_password,
    generate_totp_secret,
    verify_totp_code,
    create_access_token,
    create_temp_token,
    decode_access_token,
)
from app.core.config import settings
import pyotp


class UserService:
    """Servicio para operaciones CRUD de usuarios"""
    
    @staticmethod
    def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
        """Obtiene un usuario por ID"""
        return db.query(User).filter(User.id == user_id).first()
    
    @staticmethod
    def get_user_by_email(db: Session, email: str) -> Optional[User]:
        """Obtiene un usuario por email"""
        return db.query(User).filter(User.email == email).first()
    
    @staticmethod
    def get_user_by_username(db: Session, username: str) -> Optional[User]:
        """Compat: no existe username, usamos correo igualado"""
        return db.query(User).filter(User.email == username).first()
    
    @staticmethod
    def get_users(
        db: Session,
        skip: int = 0,
        limit: int = 100
    ) -> List[User]:
        """Obtiene lista de usuarios con paginación"""
        return db.query(User).offset(skip).limit(limit).all()
    
    @staticmethod
    def create_user(db: Session, user: UserCreate) -> User:
        """
        Crea un nuevo usuario
        
        Args:
            db: Sesión de base de datos
            user: Datos del usuario a crear
        
        Returns:
            Usuario creado
        
        Raises:
            HTTPException: Si el email o username ya existe
        """
        # Verificar si el email ya existe
        if UserService.get_user_by_email(db, user.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El email ya está registrado"
            )
        
        # Crear usuario (username y full_name se ignoran o se mapean a correo/perfil)
        hashed_password = get_password_hash(user.password)
        db_user = User(
            email=user.email,
            hashed_password=hashed_password,
            is_active=user.is_active if user.is_active is not None else True,
            rol_id=user.rol_id,
        )
        
        db.add(db_user)
        db.commit()
        db.refresh(db_user)

        empresa_ids = []
        if getattr(user, "empresa_ids", None):
            empresa_ids = list(dict.fromkeys(user.empresa_ids))  # remover duplicados
        elif getattr(user, "empresa_id", None):
            empresa_ids = [user.empresa_id]  # compatibilidad

        if empresa_ids:
            UserService.sync_user_empresas(db, db_user, empresa_ids)
            db.commit()
            db.refresh(db_user)

        # Crear perfil opcional si viene full_name
        if getattr(user, "full_name", None):
            try:
                nombre = user.full_name
                if nombre:
                    perfil = UsuarioPerfil(
                        usuario_id=db_user.id,
                        nombre=nombre,
                        apellido_paterno="",
                        apellido_materno="",
                    )
                    db.add(perfil)
                    db.commit()
            except Exception:
                pass
        return db_user

    @staticmethod
    def ensure_user_totp_secret(db: Session, user: User) -> User:
        """Genera y persiste un secreto TOTP en la tabla usuario_2fa si no existe."""
        record = user.dosfa
        if record is None:
            record = Usuario2FA(
                usuario_id=user.id,
                habilitado=True,
                secreto=generate_totp_secret(),
            )
            db.add(record)
            db.commit()
        elif not record.secreto:
            record.secreto = generate_totp_secret()
            record.habilitado = True
            db.add(record)
            db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def start_login(db: Session, username: str, password: str) -> dict:
        """
        Paso 1 de login: valida credenciales. Si 2FA está habilitado, retorna temp_token.
        Si no, retorna access_token final.
        """
        user = UserService.get_user_by_username(db, username) or UserService.get_user_by_email(db, username)
        if not user or not verify_password(password, user.hashed_password):
            return {"user": None}

        if user.two_factor_enabled:
            # Asegurar que tenga secreto TOTP
            UserService.ensure_user_totp_secret(db, user)
            temp_token = create_temp_token({"sub": str(user.id)})
            return {"requires_2fa": True, "temp_token": temp_token, "user": user}
        else:
            access_token = create_access_token({"sub": str(user.id)})
            return {"requires_2fa": False, "access_token": access_token, "user": user}

    @staticmethod
    def verify_2fa_and_issue_token(db: Session, temp_token: str, code: str) -> Optional[str]:
        """Verifica TOTP usando temp_token y emite access_token final."""
        payload = decode_access_token(temp_token)
        if not payload or payload.get("purpose") != "pre_2fa":
            return None
        user_id = str(payload.get("sub"))
        user = UserService.get_user_by_id(db, user_id)
        if not user or not user.two_factor_enabled or not user.two_factor_secret:
            return None
        if not verify_totp_code(user.two_factor_secret, code):
            return None
        return create_access_token({"sub": str(user.id)})
    
    @staticmethod
    def sync_user_empresas(db: Session, db_user: User, empresa_ids: Optional[List[UUID]]) -> None:
        """
        Sincroniza las empresas asociadas a un usuario.
        """
        if empresa_ids is None:
            return

        empresa_ids = list(dict.fromkeys(empresa_ids))
        if empresa_ids:
            empresas = db.query(Empresa).filter(Empresa.id.in_(empresa_ids)).all()
        else:
            empresas = []

        db_user.empresas = empresas
        db_user.empresa_id = empresas[0].id if empresas else None
        db_user.multiempresa = len(empresas) > 1
        db.add(db_user)
        db.flush()

    @staticmethod
    def set_active_empresa(db: Session, db_user: User, empresa_id: UUID) -> User:
        empresa_id_str = str(empresa_id)
        pertenece = any(str(emp.id) == empresa_id_str for emp in db_user.empresas)
        if not pertenece:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="El usuario no tiene asignada esta empresa",
            )
        db_user.empresa_id = empresa_id
        db_user.multiempresa = len(db_user.empresas) > 1
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user

    @staticmethod
    def update_user(
        db: Session,
        user_id: str,
        user_update: UserUpdate
    ) -> Optional[User]:
        """
        Actualiza un usuario existente
        
        Args:
            db: Sesión de base de datos
            user_id: ID del usuario a actualizar
            user_update: Datos a actualizar
        
        Returns:
            Usuario actualizado o None si no existe
        """
        db_user = UserService.get_user_by_id(db, user_id)
        
        if not db_user:
            return None
        
        # Actualizar campos básicos (full_name es propiedad de solo lectura, se actualiza vía perfil)
        update_data = user_update.model_dump(
            exclude_unset=True,
            exclude={"password", "empresa_id", "empresa_ids", "rol_id", "perfil", "contactos", "direccion", "full_name"},
        )
        
        if user_update.password is not None:
            update_data["hashed_password"] = get_password_hash(user_update.password)
        
        # Actualizar rol
        if user_update.rol_id is not None:
            db_user.rol_id = user_update.rol_id

        # Sincronizar empresas
        empresa_ids: Optional[List[str]] = None
        if user_update.empresa_ids is not None:
            empresa_ids = [str(emp_id) for emp_id in user_update.empresa_ids]
        elif user_update.empresa_id is not None:
            empresa_ids = [str(user_update.empresa_id)]

        if empresa_ids is not None:
            UserService.sync_user_empresas(db, db_user, empresa_ids)
            db.refresh(db_user)
        
        # Actualizar campos básicos
        for field, value in update_data.items():
            if hasattr(db_user, field):
                setattr(db_user, field, value)
        
        # Perfil
        if user_update.perfil is not None:
            perfil = db_user.perfil
            if perfil is None:
                perfil = UsuarioPerfil(
                    usuario_id=db_user.id,
                    nombre=user_update.perfil.nombre or "",
                    apellido_paterno=user_update.perfil.apellido_paterno or "",
                    apellido_materno=user_update.perfil.apellido_materno or "",
                    titulo=user_update.perfil.titulo,
                    cedula_profesional=user_update.perfil.cedula_profesional,
                    foto_de_perfil=getattr(user_update.perfil, "foto_de_perfil", None),
                    firma=getattr(user_update.perfil, "firma", None),
                    firma_digital=getattr(user_update.perfil, "firma_digital", None),
                )
                db.add(perfil)
            else:
                for k, v in user_update.perfil.model_dump(exclude_unset=True).items():
                    setattr(perfil, k, v)
        
        # Contactos
        if user_update.contactos is not None:
            contactos = db_user.contactos
            if contactos is None:
                contactos = UsuarioContactos(
                    usuario_id=db_user.id,
                    telefono=user_update.contactos.telefono,
                    celular=user_update.contactos.celular,
                )
                db.add(contactos)
            else:
                for k, v in user_update.contactos.model_dump(exclude_unset=True).items():
                    setattr(contactos, k, v)
        
        # Dirección
        if user_update.direccion is not None:
            direccion = db_user.direccion
            if direccion is None:
                direccion = UsuarioDireccion(
                    usuario_id=db_user.id,
                    direccion=user_update.direccion.direccion,
                    ciudad=user_update.direccion.ciudad,
                    estado=user_update.direccion.estado,
                    codigo_postal=user_update.direccion.codigo_postal,
                    pais=user_update.direccion.pais,
                )
                db.add(direccion)
            else:
                for k, v in user_update.direccion.model_dump(exclude_unset=True).items():
                    setattr(direccion, k, v)
        
        db.commit()
        db.refresh(db_user)
        
        return db_user
    
    @staticmethod
    def delete_user(db: Session, user_id: str) -> bool:
        """
        Elimina un usuario
        
        Args:
            db: Sesión de base de datos
            user_id: ID del usuario a eliminar
        
        Returns:
            True si se eliminó, False si no existe
        """
        db_user = UserService.get_user_by_id(db, user_id)
        
        if not db_user:
            return False
        
        db.delete(db_user)
        db.commit()
        
        return True

    @staticmethod
    def get_totp_uri(current_user: User) -> str:
        """Genera otpauth URI para configurar TOTP en apps de autenticación."""
        # Asegurar secreto
        # Nota: no se habilita automáticamente; solo se expone el URI
        secret = current_user.two_factor_secret
        if not secret:
            # Generar y almacenar un secreto si no existe
            # Reutilizamos ensure_user_totp_secret, que crea registro y secreto
            # usando la sesión de base de datos
            raise RuntimeError("Se requiere sesión de BD para generar secreto")
        totp = pyotp.TOTP(secret)
        issuer = settings.TOTP_ISSUER
        label = f"{issuer}:{current_user.email}"
        return totp.provisioning_uri(name=label, issuer_name=issuer)
    
    @staticmethod
    def authenticate_user(
        db: Session,
        username: str,
        password: str
    ) -> Optional[User]:
        """
        Autentica un usuario
        
        Args:
            db: Sesión de base de datos
            username: Nombre de usuario o email
            password: Contraseña
        
        Returns:
            Usuario si las credenciales son correctas, None en caso contrario
        """
        user = UserService.get_user_by_username(db, username)
        
        if not user:
            user = UserService.get_user_by_email(db, username)
        
        if not user:
            return None
        
        if not verify_password(password, user.hashed_password):
            return None
        
        return user

    @staticmethod
    def update_current_user(
        db: Session,
        current_user: User,
        payload: UserMeUpdate,
    ) -> User:
        """Actualiza perfil, contactos y dirección del usuario actual.

        Crea los registros relacionados si no existen."""
        # Perfil
        if payload.perfil is not None:
            perfil = current_user.perfil
            if perfil is None:
                perfil = UsuarioPerfil(
                    usuario_id=current_user.id,
                    nombre=payload.perfil.nombre or "",
                    apellido_paterno=payload.perfil.apellido_paterno or "",
                    apellido_materno=payload.perfil.apellido_materno or "",
                    titulo=payload.perfil.titulo,
                    cedula_profesional=payload.perfil.cedula_profesional,
                )
                db.add(perfil)
            else:
                for k, v in payload.perfil.model_dump(exclude_unset=True).items():
                    setattr(perfil, k, v)

        # Contactos
        if payload.contactos is not None:
            contactos = current_user.contactos
            if contactos is None:
                contactos = UsuarioContactos(
                    usuario_id=current_user.id,
                    telefono=payload.contactos.telefono,
                    celular=payload.contactos.celular,
                )
                db.add(contactos)
            else:
                for k, v in payload.contactos.model_dump(exclude_unset=True).items():
                    setattr(contactos, k, v)

        # Dirección
        if payload.direccion is not None:
            direccion = current_user.direccion
            if direccion is None:
                direccion = UsuarioDireccion(
                    usuario_id=current_user.id,
                    direccion=payload.direccion.direccion,
                    ciudad=payload.direccion.ciudad,
                    estado=payload.direccion.estado,
                    codigo_postal=payload.direccion.codigo_postal,
                    pais=payload.direccion.pais,
                )
                db.add(direccion)
            else:
                for k, v in payload.direccion.model_dump(exclude_unset=True).items():
                    setattr(direccion, k, v)

        db.add(current_user)
        db.commit()
        db.refresh(current_user)
        return current_user

    @staticmethod
    def change_password(
        db: Session,
        current_user: User,
        payload: ChangePasswordRequest,
    ) -> bool:
        if not verify_password(payload.current_password, current_user.hashed_password):
            return False
        current_user.hashed_password = get_password_hash(payload.new_password)
        db.add(current_user)
        db.commit()
        return True

    @staticmethod
    def toggle_two_factor(
        db: Session,
        current_user: User,
        payload: TwoFAToggleRequest,
    ) -> bool:
        # Asegurar registro 2FA
        UserService.ensure_user_totp_secret(db, current_user)
        record = current_user.dosfa
        if payload.enable:
            # Al habilitar, si se requiere código, validarlo con el secreto actual
            if payload.code:
                if not verify_totp_code(record.secreto, payload.code):
                    return False
            record.habilitado = True
        else:
            # Deshabilitar sin requerir código (se puede exigir en futuro)
            record.habilitado = False
        db.add(record)
        db.commit()
        db.refresh(current_user)
        return True

