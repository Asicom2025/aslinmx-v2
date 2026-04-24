"""
Alcance de datos por nivel de rol para siniestros (áreas, asignación, involucración).

Visibilidad (listado / ver detalle):
- Niveles 0–1: toda la empresa (sin subconsulta).
- Niveles 2–3: todos los siniestros de la empresa (sin filtrar por áreas del usuario).
- Nivel 4: solo creados por el usuario o con asignación activa en SiniestroUsuario.

Edición / eliminación / mutaciones de expediente:
- Niveles 0–1: si puede ver, puede editar.
- Nivel 2: siniestros “del área” del usuario: intersección con áreas en `siniestro_areas`,
  o bien documentos/bitácora/flujo de trabajo del expediente cuyo `area_id` esté en las áreas del usuario.
- Nivel 3: solo si tiene asignación activa al siniestro (SiniestroUsuario, cualquier rol en el caso).
- Nivel 4: sin edición (solo lectura donde aplique ver).
"""

from typing import Optional
from uuid import UUID

from sqlalchemy import false as sql_false, or_
from sqlalchemy.orm import Session

from app.core.nivel_acceso import get_nivel_rol, usuario_bypass_areas
from app.models.legal import (
    BitacoraActividad,
    Documento,
    Siniestro,
    SiniestroArea,
    SiniestroUsuario,
)
from app.models.flujo_trabajo import FlujoTrabajo
from app.models.user import UsuarioArea

MSG_EXPEDIENTE_SOLO_LECTURA = (
    "No tiene permiso para modificar este expediente (solo consulta)."
)


def _area_ids_usuario(db: Session, user) -> list[UUID]:
    """IDs de áreas del usuario (relación cargada o tabla `usuario_areas`)."""
    rel = getattr(user, "areas", None) or []
    if rel:
        return [a.id for a in rel]
    return [
        row[0]
        for row in db.query(UsuarioArea.area_id).filter(UsuarioArea.usuario_id == user.id).all()
        if row[0] is not None
    ]


def _usuario_comparte_area_con_siniestro(
    db: Session, user, siniestro_id: UUID
) -> bool:
    """
    True si el expediente está vinculado a alguna de las áreas del usuario
    (tabla siniestro-áreas, documentos, bitácora o flujo de trabajo por área).
    """
    area_ids = _area_ids_usuario(db, user)
    if not area_ids:
        return False

    if (
        db.query(SiniestroArea.id)
        .filter(
            SiniestroArea.siniestro_id == siniestro_id,
            SiniestroArea.area_id.in_(area_ids),
            SiniestroArea.activo == True,
            SiniestroArea.eliminado == False,
        )
        .first()
        is not None
    ):
        return True

    if (
        db.query(Documento.id)
        .filter(
            Documento.siniestro_id == siniestro_id,
            Documento.area_id.isnot(None),
            Documento.area_id.in_(area_ids),
            Documento.activo == True,
            Documento.eliminado == False,
        )
        .first()
        is not None
    ):
        return True

    if (
        db.query(BitacoraActividad.id)
        .filter(
            BitacoraActividad.siniestro_id == siniestro_id,
            BitacoraActividad.area_id.isnot(None),
            BitacoraActividad.area_id.in_(area_ids),
        )
        .first()
        is not None
    ):
        return True

    # Documentos ligados a un flujo cuya área coincide (flujos por área)
    if (
        db.query(Documento.id)
        .join(FlujoTrabajo, FlujoTrabajo.id == Documento.flujo_trabajo_id)
        .filter(
            Documento.siniestro_id == siniestro_id,
            Documento.flujo_trabajo_id.isnot(None),
            Documento.activo == True,
            Documento.eliminado == False,
            FlujoTrabajo.area_id.isnot(None),
            FlujoTrabajo.area_id.in_(area_ids),
            FlujoTrabajo.eliminado_en.is_(None),
        )
        .first()
        is not None
    ):
        return True

    return False


def _usuario_asignado_a_siniestro(db: Session, user_id: UUID, siniestro_id: UUID) -> bool:
    return (
        db.query(SiniestroUsuario.id)
        .filter(
            SiniestroUsuario.siniestro_id == siniestro_id,
            SiniestroUsuario.usuario_id == user_id,
            SiniestroUsuario.activo == True,
            SiniestroUsuario.eliminado == False,
        )
        .first()
        is not None
    )


def subquery_siniestros_visibles(
    db: Session,
    user,
    empresa_id: UUID,
):
    """
    Subconsulta de IDs de siniestros visibles para el usuario según nivel.
    None = sin restricción adicional por esta subconsulta (toda la empresa para ese usuario).
    """
    nivel = get_nivel_rol(db, user)
    if usuario_bypass_areas(db, user):
        return None

    base_empresa = (Siniestro.empresa_id == empresa_id) & (Siniestro.eliminado == False)

    if nivel in (2, 3):
        # Ver todos los siniestros de la empresa; el filtro por área/asignación aplica solo en edición.
        return None

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
    Nivel 4: sin edición de expediente.
    Nivel 3: solo si está asignado al siniestro (involucrado activo).
    Nivel 2: si el expediente está asociado a alguna de las áreas del usuario
    (siniestro_areas, documentos, bitácora o flujo por área).
    Niveles 0–1: si puede ver, puede editar.
    """
    if not usuario_puede_ver_siniestro(db, user, empresa_id, siniestro_id):
        return False
    nivel = get_nivel_rol(db, user)
    if nivel <= 1:
        return True
    if nivel >= 4:
        return False
    if nivel == 2:
        return _usuario_comparte_area_con_siniestro(db, user, siniestro_id)
    # nivel == 3
    return _usuario_asignado_a_siniestro(db, user.id, siniestro_id)


def usuario_puede_eliminar_siniestro(db: Session, user, empresa_id: Optional[UUID], siniestro_id: UUID) -> bool:
    """Misma regla que editar (nivel 3–4 restringido)."""
    return usuario_puede_editar_siniestro(db, user, empresa_id, siniestro_id)
