"""
Rutas API para documentos
"""
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.schemas.legal_schema import (
    DocumentoCreate, DocumentoUpdate, DocumentoResponse,
)
from app.services.legal_service import DocumentoService

router = APIRouter(prefix="/documentos", tags=["Documentos"])


@router.get("/siniestros/{siniestro_id}", response_model=List[DocumentoResponse])
def list_documentos_siniestro(
    siniestro_id: UUID,
    tipo_documento_id: Optional[UUID] = Query(None, description="Filtrar por tipo de documento"),
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    area_id: Optional[UUID] = Query(None, description="Filtrar por área"),
    flujo_trabajo_id: Optional[UUID] = Query(None, description="Filtrar por flujo de trabajo"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Lista documentos de un siniestro, opcionalmente filtrados por área y flujo"""
    return DocumentoService.list(
        db=db,
        siniestro_id=siniestro_id,
        tipo_documento_id=tipo_documento_id,
        activo=activo,
        area_id=area_id,
        flujo_trabajo_id=flujo_trabajo_id,
        skip=skip,
        limit=limit
    )


@router.get("/{documento_id}", response_model=DocumentoResponse)
def get_documento(
    documento_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Obtiene un documento por ID"""
    documento = DocumentoService.get_by_id(db, documento_id)
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return documento


@router.post("", response_model=DocumentoResponse, status_code=status.HTTP_201_CREATED)
def create_documento(
    payload: DocumentoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Crea un nuevo documento"""
    # Si no se especifica usuario_subio, usar el usuario actual
    if not payload.usuario_subio:
        payload.usuario_subio = current_user.id
    
    return DocumentoService.create(db, payload)


@router.put("/{documento_id}", response_model=DocumentoResponse)
def update_documento(
    documento_id: UUID,
    payload: DocumentoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Actualiza un documento existente"""
    documento = DocumentoService.update(db, documento_id, payload)
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return documento


@router.delete("/{documento_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_documento(
    documento_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Elimina lógicamente un documento"""
    ok = DocumentoService.delete(db, documento_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return None

