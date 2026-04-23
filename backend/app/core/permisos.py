"""
Dependencia para validar permisos por módulo y acción.
Si el usuario no tiene el permiso, se lanza HTTP 403.
"""

from typing import Set, Tuple

from uuid import UUID
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.permiso import Modulo, Accion, RolPermiso
from app.core.nivel_acceso import usuario_bypass_permisos

# Re-export para compatibilidad con imports existentes
from app.core.nivel_acceso import ROL_SUPER_ADMIN_ID  # noqa: F401


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


CAMPOS_GRANULARES_ACTUALIZACION_SINIESTRO = frozenset(
    {"estado_id", "calificacion_id", "polizas", "descripcion_hechos"}
)


def assert_permiso_actualizar_siniestro(
    db: Session,
    current_user: User,
    campos: Set[str],
) -> None:
    """
    Permisos para PUT /siniestros/{id} según los campos enviados (model_dump exclude_unset).
    - Cualquier campo distinto de estado_id, calificacion_id, polizas o descripcion_hechos exige siniestros.update.
    - estado_id exige siniestros.update o siniestros.editar_status.
    - calificacion_id exige siniestros.update o siniestros.editar_calificacion.
    - polizas exige siniestros.update o siniestros.editar_poliza.
    - descripcion_hechos exige siniestros.update o siniestros.editar_descripcion_de_hechos.
    """
    if not campos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay campos para actualizar",
        )
    if not current_user.rol_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene un rol asignado",
        )
    if usuario_bypass_permisos(db, current_user):
        return

    rid = current_user.rol_id
    if _tiene_permiso(db, rid, "siniestros", "update"):
        return

    otros = campos - CAMPOS_GRANULARES_ACTUALIZACION_SINIESTRO
    if otros:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso siniestros.update para modificar otros campos del siniestro",
        )

    if "estado_id" in campos and not _tiene_permiso(db, rid, "siniestros", "editar_status"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso siniestros.editar_status",
        )
    if "calificacion_id" in campos and not _tiene_permiso(db, rid, "siniestros", "editar_calificacion"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso siniestros.editar_calificacion",
        )
    if "polizas" in campos and not _tiene_permiso(db, rid, "siniestros", "editar_poliza"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso siniestros.editar_poliza",
        )
    if "descripcion_hechos" in campos and not _tiene_permiso(
        db, rid, "siniestros", "editar_descripcion_de_hechos"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso siniestros.editar_descripcion_de_hechos",
        )


def require_permiso(modulo_tecnico: str, accion_tecnico: str):
    """
    Dependencia que exige que el usuario actual tenga el permiso (módulo, acción).
    Bypass: roles.nivel == 0 (SuperAdmin desarrollador) o UUID SuperAdmin legacy.
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
        if usuario_bypass_permisos(db, current_user):
            return current_user
        if not _tiene_permiso(db, current_user.rol_id, modulo_tecnico, accion_tecnico):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No tiene permiso: {modulo_tecnico}.{accion_tecnico}",
            )
        return current_user

    return _check


def require_any_permiso(*reqs: Tuple[str, str]):
    """
    Exige que el usuario tenga al menos uno de los permisos listados (modulo, accion).
    Misma regla de bypass que require_permiso.
    """

    if not reqs:
        raise ValueError("require_any_permiso requiere al menos un par (modulo, accion)")

    def _check(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db),
    ) -> User:
        if not current_user.rol_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene un rol asignado",
            )
        if usuario_bypass_permisos(db, current_user):
            return current_user
        for modulo_tecnico, accion_tecnico in reqs:
            if _tiene_permiso(db, current_user.rol_id, modulo_tecnico, accion_tecnico):
                return current_user
        opciones = ", ".join(f"{m}.{a}" for m, a in reqs)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No tiene permiso. Se requiere uno de: {opciones}",
        )

    return _check
