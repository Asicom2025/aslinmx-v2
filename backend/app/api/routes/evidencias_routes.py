"""
Rutas API para evidencias fotográficas
"""
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.schemas.legal_schema import (
    EvidenciaFotograficaCreate, EvidenciaFotograficaUpdate, EvidenciaFotograficaResponse,
)
from app.services.legal_service import EvidenciaFotograficaService

router = APIRouter(prefix="/evidencias", tags=["Evidencias"])


@router.get("/siniestros/{siniestro_id}", response_model=List[EvidenciaFotograficaResponse])
def list_evidencias_siniestro(
    siniestro_id: UUID,
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Lista evidencias fotográficas de un siniestro"""
    return EvidenciaFotograficaService.list(
        db=db,
        siniestro_id=siniestro_id,
        activo=activo,
        skip=skip,
        limit=limit
    )


@router.get("/{evidencia_id}", response_model=EvidenciaFotograficaResponse)
def get_evidencia(
    evidencia_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Obtiene una evidencia fotográfica por ID"""
    evidencia = EvidenciaFotograficaService.get_by_id(db, evidencia_id)
    if not evidencia:
        raise HTTPException(status_code=404, detail="Evidencia no encontrada")
    return evidencia


@router.post("", response_model=EvidenciaFotograficaResponse, status_code=status.HTTP_201_CREATED)
def create_evidencia(
    payload: EvidenciaFotograficaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Crea una nueva evidencia fotográfica"""
    # Si no se especifica usuario_subio, usar el usuario actual
    if not payload.usuario_subio:
        payload.usuario_subio = current_user.id
    
    return EvidenciaFotograficaService.create(db, payload)


@router.put("/{evidencia_id}", response_model=EvidenciaFotograficaResponse)
def update_evidencia(
    evidencia_id: UUID,
    payload: EvidenciaFotograficaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Actualiza una evidencia fotográfica existente"""
    evidencia = EvidenciaFotograficaService.update(db, evidencia_id, payload)
    if not evidencia:
        raise HTTPException(status_code=404, detail="Evidencia no encontrada")
    return evidencia


@router.delete("/{evidencia_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_evidencia(
    evidencia_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Elimina lógicamente una evidencia fotográfica"""
    ok = EvidenciaFotograficaService.delete(db, evidencia_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Evidencia no encontrada")
    return None

