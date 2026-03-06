"""
Dependencia para validar permisos por módulo y acción.
Si el usuario no tiene el permiso, se lanza HTTP 403.
"""

from uuid import UUID
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.permiso import Modulo, Accion, RolPermiso

# Rol Super Admin: tiene todos los permisos sin validar en BD
ROL_SUPER_ADMIN_ID = UUID("1a87598e-f122-4519-971b-99ed3a96481f")


def _tiene_permiso(db: Session, rol_id: UUID, modulo_tecnico: str, accion_tecnico: str) -> bool:
    """Comprueba si el rol tiene el permiso (modulo_tecnico, accion_tecnico)."""
    existe = (
        db.query(RolPermiso)
        .join(Modulo, RolPermiso.modulo_id == Modulo.id)
        .join(Accion, RolPermiso.accion_id == Accion.id)
        .filter(
            RolPermiso.rol_id == rol_id,
            RolPermiso.activo == True,
            Modulo.nombre_tecnico == modulo_tecnico,
            Modulo.activo == True,
            Modulo.eliminado_en.is_(None),
            Accion.nombre_tecnico == accion_tecnico,
            Accion.activo == True,
        )
        .first()
    )
    return existe is not None


def require_permiso(modulo_tecnico: str, accion_tecnico: str):
    """
    Dependencia que exige que el usuario actual tenga el permiso (módulo, acción).
    El rol Super Admin (1a87598e-f122-4519-971b-99ed3a96481f) siempre tiene acceso.
    """

    def _check(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db),
    ) -> User:
        if not current_user.rol_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene un rol asignado",
            )
        if current_user.rol_id == ROL_SUPER_ADMIN_ID:
            return current_user
        if not _tiene_permiso(db, current_user.rol_id, modulo_tecnico, accion_tecnico):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No tiene permiso: {modulo_tecnico}.{accion_tecnico}",
            )
        return current_user

    return _check
