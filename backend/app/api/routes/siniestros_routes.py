"""
Rutas API para gestión de siniestros
"""
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.schemas.legal_schema import (
    SiniestroCreate, SiniestroUpdate, SiniestroResponse,
)
from app.services.legal_service import SiniestroService

router = APIRouter(prefix="/siniestros", tags=["Siniestros"])


# ===== SINIESTROS =====
@router.get("", response_model=List[SiniestroResponse])
def list_siniestros(
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    estado_id: Optional[UUID] = Query(None, description="Filtrar por estado de siniestro"),
    area_id: Optional[UUID] = Query(None, description="Filtrar por área principal"),
    usuario_asignado: Optional[UUID] = Query(None, description="Filtrar por usuario asignado"),
    prioridad: Optional[str] = Query(None, description="Filtrar por prioridad (baja, media, alta, critica)"),
    skip: int = Query(0, ge=0, description="Número de registros a saltar"),
    limit: int = Query(1000, ge=1, le=10000, description="Número máximo de registros a retornar"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Lista todos los siniestros con filtros opcionales.
    Permite filtrar por estado, área, usuario asignado, prioridad y activo.
    """
    return SiniestroService.list(
        db=db,
        empresa_id=current_user.empresa_id,
        activo=activo,
        estado_id=estado_id,
        area_id=area_id,
        usuario_asignado=usuario_asignado,
        prioridad=prioridad,
        skip=skip,
        limit=limit
    )


@router.get("/{siniestro_id}", response_model=SiniestroResponse)
def get_siniestro(
    siniestro_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Obtiene un siniestro por ID.
    Valida que pertenezca a la empresa del usuario.
    """
    siniestro = SiniestroService.get_by_id(db, siniestro_id, current_user.empresa_id)
    if not siniestro:
        raise HTTPException(status_code=404, detail="Siniestro no encontrado")
    return siniestro


@router.post("", response_model=SiniestroResponse, status_code=status.HTTP_201_CREATED)
def create_siniestro(
    payload: SiniestroCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Crea un nuevo siniestro.
    Valida que el número de siniestro sea único por empresa.
    El campo creado_por se establece automáticamente con el usuario actual.
    """
    try:
        return SiniestroService.create(db, current_user.empresa_id, payload, current_user.id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear siniestro: {str(e)}"
        )


@router.put("/{siniestro_id}", response_model=SiniestroResponse)
def update_siniestro(
    siniestro_id: UUID,
    payload: SiniestroUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Actualiza un siniestro existente.
    Valida que pertenezca a la empresa del usuario.
    Si se actualiza descripcion_hechos, crea una nueva versión automáticamente.
    """
    try:
        siniestro = SiniestroService.update(db, siniestro_id, current_user.empresa_id, payload, current_user.id)
        if not siniestro:
            raise HTTPException(status_code=404, detail="Siniestro no encontrado")
        return siniestro
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar siniestro: {str(e)}"
        )


@router.delete("/{siniestro_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_siniestro(
    siniestro_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Elimina lógicamente un siniestro (soft delete).
    No elimina físicamente para mantener historial.
    """
    ok = SiniestroService.delete(db, siniestro_id, current_user.empresa_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Siniestro no encontrado")
    return None

