"""
Rutas API para versiones de descripción de hechos
"""
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.core.permisos import require_permiso
from app.models.user import User
from app.schemas.legal_schema import (
    VersionesDescripcionHechosCreate,
    VersionesDescripcionHechosUpdate,
    VersionesDescripcionHechosResponse,
)
from app.services.legal_service import VersionesDescripcionHechosService, SiniestroService
from app.services.siniestro_acceso_service import usuario_puede_ver_siniestro

router = APIRouter(prefix="/siniestros", tags=["Siniestros - Versiones Descripción"])


def _assert_siniestro_visible(
    db: Session,
    current_user: User,
    siniestro_id: UUID,
) -> None:
    if not usuario_puede_ver_siniestro(
        db, current_user, current_user.empresa_id, siniestro_id
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Siniestro no encontrado",
        )


def _assert_version_visible(
    db: Session,
    current_user: User,
    version_id: UUID,
):
    version = VersionesDescripcionHechosService.get_by_id(db, version_id)
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Versión no encontrada",
        )
    siniestro = SiniestroService.get_by_id(
        db, version.siniestro_id, current_user.empresa_id
    )
    if not siniestro:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Versión no encontrada",
        )
    _assert_siniestro_visible(db, current_user, version.siniestro_id)
    return version


# ===== VERSIONES DE DESCRIPCIÓN DE HECHOS =====
@router.get(
    "/{siniestro_id}/versiones-descripcion",
    response_model=List[VersionesDescripcionHechosResponse],
)
def list_versiones_descripcion(
    siniestro_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("siniestros", "read")),
):
    """Lista todas las versiones de descripción de hechos de un siniestro"""
    _assert_siniestro_visible(db, current_user, siniestro_id)
    return VersionesDescripcionHechosService.list(db, siniestro_id)


@router.get(
    "/{siniestro_id}/versiones-descripcion/actual",
    response_model=VersionesDescripcionHechosResponse,
)
def get_version_actual(
    siniestro_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("siniestros", "read")),
):
    """Obtiene la versión actual de la descripción de hechos"""
    _assert_siniestro_visible(db, current_user, siniestro_id)
    version = VersionesDescripcionHechosService.get_actual(db, siniestro_id)
    if not version:
        raise HTTPException(
            status_code=404, detail="No existe versión actual de la descripción"
        )
    return version


@router.get(
    "/versiones-descripcion/{version_id}",
    response_model=VersionesDescripcionHechosResponse,
)
def get_version_descripcion(
    version_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("siniestros", "read")),
):
    """Obtiene una versión específica por ID"""
    version = _assert_version_visible(db, current_user, version_id)
    return version


@router.post(
    "/{siniestro_id}/versiones-descripcion",
    response_model=VersionesDescripcionHechosResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_version_descripcion(
    siniestro_id: UUID,
    payload: VersionesDescripcionHechosCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permiso("siniestros", "editar_descripcion_de_hechos")
    ),
):
    """Crea una nueva versión de descripción de hechos"""
    _assert_siniestro_visible(db, current_user, siniestro_id)
    payload.siniestro_id = siniestro_id
    try:
        return VersionesDescripcionHechosService.create(
            db, payload, current_user.id
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear versión: {str(e)}",
        )


@router.put(
    "/versiones-descripcion/{version_id}",
    response_model=VersionesDescripcionHechosResponse,
)
def update_version_descripcion(
    version_id: UUID,
    payload: VersionesDescripcionHechosUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permiso("siniestros", "editar_descripcion_de_hechos")
    ),
):
    """Actualiza una versión existente (solo observaciones)"""
    _assert_version_visible(db, current_user, version_id)
    version = VersionesDescripcionHechosService.update(db, version_id, payload)
    if not version:
        raise HTTPException(status_code=404, detail="Versión no encontrada")
    return version


@router.post(
    "/versiones-descripcion/{version_id}/restaurar",
    response_model=VersionesDescripcionHechosResponse,
    status_code=status.HTTP_201_CREATED,
)
def restaurar_version_descripcion(
    version_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permiso("siniestros", "editar_descripcion_de_hechos")
    ),
):
    """Restaura una versión anterior creando una nueva versión con su contenido"""
    _assert_version_visible(db, current_user, version_id)
    try:
        version = VersionesDescripcionHechosService.restaurar_version(
            db, version_id, current_user.id
        )
        if not version:
            raise HTTPException(status_code=404, detail="Versión no encontrada")
        return version
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al restaurar versión: {str(e)}",
        )


@router.delete(
    "/versiones-descripcion/{version_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_version_descripcion(
    version_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permiso("siniestros", "editar_descripcion_de_hechos")
    ),
):
    """Elimina una versión de descripción de hechos (no permite eliminar la actual)"""
    _assert_version_visible(db, current_user, version_id)
    try:
        ok = VersionesDescripcionHechosService.delete(db, version_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Versión no encontrada")
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar versión: {str(e)}",
        )
