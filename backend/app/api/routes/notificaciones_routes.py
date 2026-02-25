"""
Rutas API para notificaciones
"""
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.schemas.legal_schema import (
    NotificacionCreate, NotificacionUpdate, NotificacionResponse,
)
from app.services.legal_service import NotificacionService

router = APIRouter(prefix="/notificaciones", tags=["Notificaciones"])


@router.get("", response_model=List[NotificacionResponse])
def list_notificaciones(
    leida: Optional[bool] = Query(None, description="Filtrar por estado leída"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Lista notificaciones del usuario actual"""
    return NotificacionService.list(
        db=db,
        usuario_id=current_user.id,
        leida=leida,
        tipo=tipo,
        skip=skip,
        limit=limit
    )


@router.get("/{notificacion_id}", response_model=NotificacionResponse)
def get_notificacion(
    notificacion_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Obtiene una notificación por ID"""
    notificacion = NotificacionService.get_by_id(db, notificacion_id, current_user.id)
    if not notificacion:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    return notificacion


@router.post("", response_model=NotificacionResponse, status_code=status.HTTP_201_CREATED)
def create_notificacion(
    payload: NotificacionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Crea una nueva notificación"""
    return NotificacionService.create(db, payload)


@router.put("/{notificacion_id}", response_model=NotificacionResponse)
def update_notificacion(
    notificacion_id: UUID,
    payload: NotificacionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Actualiza una notificación existente"""
    notificacion = NotificacionService.update(db, notificacion_id, current_user.id, payload)
    if not notificacion:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    return notificacion


@router.post("/{notificacion_id}/marcar-leida", response_model=NotificacionResponse)
def marcar_notificacion_leida(
    notificacion_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Marca una notificación como leída"""
    ok = NotificacionService.marcar_leida(db, notificacion_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    notificacion = NotificacionService.get_by_id(db, notificacion_id, current_user.id)
    return notificacion


@router.post("/marcar-todas-leidas", status_code=status.HTTP_200_OK)
def marcar_todas_leidas(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Marca todas las notificaciones del usuario como leídas"""
    count = NotificacionService.marcar_todas_leidas(db, current_user.id)
    return {"marcadas": count}


@router.delete("/{notificacion_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notificacion(
    notificacion_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Elimina una notificación"""
    ok = NotificacionService.delete(db, notificacion_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    return None

