"""
Rutas API para relaciones de siniestros (involucrados y áreas adicionales)
"""
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.schemas.legal_schema import (
    SiniestroUsuarioCreate, SiniestroUsuarioUpdate, SiniestroUsuarioResponse,
    SiniestroAreaCreate, SiniestroAreaCreateBody, SiniestroAreaUpdate, SiniestroAreaResponse,
)
from app.services.legal_service import SiniestroUsuarioService, SiniestroAreaService

router = APIRouter(prefix="/siniestros", tags=["Siniestros - Relaciones"])


# ===== INVOLUCRADOS (SINIESTRO-USUARIOS) =====
@router.get("/{siniestro_id}/involucrados", response_model=List[SiniestroUsuarioResponse])
def list_involucrados(
    siniestro_id: UUID,
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Lista involucrados de un siniestro"""
    return SiniestroUsuarioService.list(db, siniestro_id, activo)


@router.post("/{siniestro_id}/involucrados", response_model=SiniestroUsuarioResponse, status_code=status.HTTP_201_CREATED)
def add_involucrado(
    siniestro_id: UUID,
    payload: SiniestroUsuarioCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Agrega un involucrado a un siniestro"""
    # Asegurar que el siniestro_id coincida con la URL
    payload.siniestro_id = siniestro_id
    try:
        return SiniestroUsuarioService.create(db, payload)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al agregar involucrado: {str(e)}"
        )


@router.put("/involucrados/{relacion_id}", response_model=SiniestroUsuarioResponse)
def update_involucrado(
    relacion_id: UUID,
    payload: SiniestroUsuarioUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Actualiza un involucrado"""
    relacion = SiniestroUsuarioService.update(db, relacion_id, payload)
    if not relacion:
        raise HTTPException(status_code=404, detail="Involucrado no encontrado")
    return relacion


@router.delete("/involucrados/{relacion_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_involucrado(
    relacion_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Elimina un involucrado de un siniestro"""
    ok = SiniestroUsuarioService.delete(db, relacion_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Involucrado no encontrado")
    return None


# ===== ÁREAS ADICIONALES (SINIESTRO-ÁREAS) =====
@router.get("/{siniestro_id}/areas-adicionales", response_model=List[SiniestroAreaResponse])
def list_areas_adicionales(
    siniestro_id: UUID,
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Lista áreas adicionales de un siniestro"""
    return SiniestroAreaService.list(db, siniestro_id, activo)


@router.post("/{siniestro_id}/areas-adicionales", response_model=SiniestroAreaResponse, status_code=status.HTTP_201_CREATED)
def add_area_adicional(
    siniestro_id: UUID,
    payload: SiniestroAreaCreateBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Agrega un área adicional a un siniestro"""
    # Crear un nuevo payload con el siniestro_id de la URL
    # El siniestro_id viene en la URL, no en el body
    from app.schemas.legal_schema import SiniestroAreaCreate
    payload_dict = payload.model_dump()
    payload_dict['siniestro_id'] = siniestro_id  # Asignar el siniestro_id de la URL
    payload_with_siniestro = SiniestroAreaCreate(**payload_dict)
    
    try:
        return SiniestroAreaService.create(db, payload_with_siniestro)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al agregar área: {str(e)}"
        )


@router.put("/areas-adicionales/{relacion_id}", response_model=SiniestroAreaResponse)
def update_area_adicional(
    relacion_id: UUID,
    payload: SiniestroAreaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Actualiza un área adicional"""
    relacion = SiniestroAreaService.update(db, relacion_id, payload)
    if not relacion:
        raise HTTPException(status_code=404, detail="Área adicional no encontrada")
    return relacion


@router.delete("/areas-adicionales/{relacion_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_area_adicional(
    relacion_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Elimina un área adicional de un siniestro"""
    ok = SiniestroAreaService.delete(db, relacion_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Área adicional no encontrada")
    return None

