"""
Jerarquía de roles por nivel (roles.nivel) y utilidades de bypass SuperAdmin.
- Nivel 0: desarrollador / SuperAdmin (acceso total a permisos vía bypass).
- Nivel 1: administradores (sin filtro de alcance en datos; permisos por rol_permisos).
- Nivel 2–4: alcance restringido en siniestros (ver siniestro_acceso_service).
"""

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import Rol

# Coincide con el bypass histórico por UUID en require_permiso
ROL_SUPER_ADMIN_ID = UUID("1a87598e-f122-4519-971b-99ed3a96481f")

NIVEL_SUPERADMIN = 0
NIVEL_ADMIN = 1


def get_nivel_rol(db: Session, user) -> int:
    """
    Devuelve roles.nivel del usuario o 99 si no hay rol (sin acceso por nivel).
    """
    if getattr(user, "rol", None) is not None and user.rol.nivel is not None:
        return int(user.rol.nivel)
    if not getattr(user, "rol_id", None):
        return 99
    rol = db.query(Rol).filter(Rol.id == user.rol_id).first()
    if rol is None or rol.nivel is None:
        return 99
    return int(rol.nivel)


def usuario_bypass_permisos(db: Session, user) -> bool:
    """
    True si el usuario no debe validarse contra rol_permisos (nivel 0 o UUID SuperAdmin legacy).
    """
    if getattr(user, "rol_id", None) and user.rol_id == ROL_SUPER_ADMIN_ID:
        return True
    return get_nivel_rol(db, user) == NIVEL_SUPERADMIN


def solo_superadmin_por_nivel(db: Session, user) -> bool:
    """True solo si roles.nivel == 0 (p. ej. impersonación)."""
    return get_nivel_rol(db, user) == NIVEL_SUPERADMIN


def usuario_bypass_areas(db: Session, user) -> bool:
    """
    True si el usuario no debe depender de asignaciones de áreas.
    Regla: niveles 0 y 1.
    """
    return get_nivel_rol(db, user) <= NIVEL_ADMIN
