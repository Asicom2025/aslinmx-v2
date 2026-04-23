"""
Alcance de datos por nivel de rol para siniestros (áreas, asignación, involucración).
"""

from typing import Optional
from uuid import UUID

from sqlalchemy import false as sql_false, or_
from sqlalchemy.orm import Session

from app.core.nivel_acceso import get_nivel_rol, usuario_bypass_areas
from app.models.legal import Siniestro, SiniestroArea, SiniestroUsuario


def subquery_siniestros_visibles(
    db: Session,
    user,
    empresa_id: UUID,
):
    """
    Subconsulta de IDs de siniestros visibles para el usuario según nivel.
    None = sin restricción adicional (nivel 0–1).
    """
    nivel = get_nivel_rol(db, user)
    if usuario_bypass_areas(db, user):
        return None

    base_empresa = (Siniestro.empresa_id == empresa_id) & (Siniestro.eliminado == False)

    if nivel in (2, 3):
        area_ids = [a.id for a in getattr(user, "areas", []) or []]
        if not area_ids:
            return db.query(Siniestro.id).filter(sql_false())
        return (
            db.query(SiniestroArea.siniestro_id)
            .join(Siniestro, Siniestro.id == SiniestroArea.siniestro_id)
            .filter(
                base_empresa,
                SiniestroArea.area_id.in_(area_ids),
                SiniestroArea.activo == True,
                SiniestroArea.eliminado == False,
            )
            .distinct()
        )

    if nivel == 4:
        return db.query(Siniestro.id).filter(
            base_empresa,
            or_(
                Siniestro.creado_por == user.id,
                Siniestro.id.in_(
                    db.query(SiniestroUsuario.siniestro_id).filter(
                        SiniestroUsuario.usuario_id == user.id,
                        SiniestroUsuario.activo == True,
                        SiniestroUsuario.eliminado == False,
                    )
                ),
            ),
        )

    return db.query(Siniestro.id).filter(sql_false())


def usuario_puede_ver_siniestro(
    db: Session,
    user,
    empresa_id: Optional[UUID],
    siniestro_id: UUID,
) -> bool:
    if not empresa_id:
        return False
    exists = (
        db.query(Siniestro.id)
        .filter(
            Siniestro.id == siniestro_id,
            Siniestro.empresa_id == empresa_id,
            Siniestro.eliminado == False,
        )
        .first()
    )
    if not exists:
        return False

    sub = subquery_siniestros_visibles(db, user, empresa_id)
    if sub is None:
        return True

    ok = (
        db.query(Siniestro.id)
        .filter(
            Siniestro.id == siniestro_id,
            Siniestro.id.in_(sub),
        )
        .first()
    )
    return ok is not None


def usuario_puede_editar_siniestro(db: Session, user, empresa_id: Optional[UUID], siniestro_id: UUID) -> bool:
    """
    Nivel 4: solo lectura de siniestros (sin edición).
    Nivel 3: solo si está asignado como responsable principal en el siniestro.
    """
    if not usuario_puede_ver_siniestro(db, user, empresa_id, siniestro_id):
        return False
    nivel = get_nivel_rol(db, user)
    if nivel <= 2:
        return True
    if nivel >= 4:
        return False
    # nivel == 3
    principal = (
        db.query(SiniestroUsuario)
        .filter(
            SiniestroUsuario.siniestro_id == siniestro_id,
            SiniestroUsuario.usuario_id == user.id,
            SiniestroUsuario.activo == True,
            SiniestroUsuario.eliminado == False,
            SiniestroUsuario.es_principal == True,
        )
        .first()
    )
    return principal is not None


def usuario_puede_eliminar_siniestro(db: Session, user, empresa_id: Optional[UUID], siniestro_id: UUID) -> bool:
    """Misma regla que editar (nivel 3–4 restringido)."""
    return usuario_puede_editar_siniestro(db, user, empresa_id, siniestro_id)
