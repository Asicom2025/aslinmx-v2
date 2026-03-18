"""
Rutas API para bitácora de actividades
"""
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.core.permisos import require_permiso
from app.models.user import User
from app.schemas.legal_schema import (
    BitacoraActividadCreate, BitacoraActividadUpdate, BitacoraActividadResponse,
)
from app.services.legal_service import BitacoraActividadService
from app.services.auditoria_service import AuditoriaService
from app.models.legal import Siniestro

router = APIRouter(prefix="/bitacora", tags=["Bitácora"])


@router.get("/siniestros/{siniestro_id}", response_model=List[BitacoraActividadResponse])
def list_bitacora_siniestro(
    siniestro_id: UUID,
    usuario_id: Optional[UUID] = Query(None, description="Filtrar por usuario"),
    tipo_actividad: Optional[str] = Query(None, description="Filtrar por tipo de actividad"),
    area_id: Optional[UUID] = Query(None, description="Filtrar por área"),
    flujo_trabajo_id: Optional[UUID] = Query(None, description="Filtrar por flujo de trabajo"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("siniestros", "ver_bitacora")),
):
    """Lista actividades de bitácora de un siniestro, opcionalmente filtradas por área y flujo"""
    return BitacoraActividadService.list(
        db=db,
        siniestro_id=siniestro_id,
        usuario_id=usuario_id,
        tipo_actividad=tipo_actividad,
        area_id=area_id,
        flujo_trabajo_id=flujo_trabajo_id,
        skip=skip,
        limit=limit
    )


@router.get("/{actividad_id}", response_model=BitacoraActividadResponse)
def get_bitacora_actividad(
    actividad_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Obtiene una actividad de bitácora por ID"""
    actividad = BitacoraActividadService.get_by_id(db, actividad_id)
    if not actividad:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    return actividad


@router.post("", response_model=BitacoraActividadResponse, status_code=status.HTTP_201_CREATED)
def create_bitacora_actividad(
    payload: BitacoraActividadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Crea una nueva actividad en bitácora"""
    # Si no se especifica usuario_id, usar el usuario actual
    if not payload.usuario_id:
        payload.usuario_id = current_user.id

    actividad = BitacoraActividadService.create(db, payload)

    # Auditoría: actividad bitácora creada
    siniestro_obj = db.query(Siniestro).filter(Siniestro.id == actividad.siniestro_id).first()
    empresa_id = siniestro_obj.empresa_id if siniestro_obj else current_user.empresa_id
    AuditoriaService.registrar_accion(
        db=db,
        usuario_id=current_user.id,
        empresa_id=empresa_id,
        accion="bitacora_creada",
        modulo="siniestros",
        tabla="siniestros",
        registro_id=actividad.siniestro_id,
        descripcion=f"Actividad en bitácora: {actividad.descripcion[:80]}{'...' if len(actividad.descripcion or '') > 80 else ''}",
        datos_nuevos={"tipo_actividad": actividad.tipo_actividad, "actividad_id": str(actividad.id)},
    )

    return actividad


@router.put("/{actividad_id}", response_model=BitacoraActividadResponse)
def update_bitacora_actividad(
    actividad_id: UUID,
    payload: BitacoraActividadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Actualiza una actividad de bitácora"""
    actividad = BitacoraActividadService.update(db, actividad_id, payload)
    if not actividad:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")

    # Auditoría: actividad bitácora actualizada
    siniestro_obj = db.query(Siniestro).filter(Siniestro.id == actividad.siniestro_id).first()
    empresa_id = siniestro_obj.empresa_id if siniestro_obj else current_user.empresa_id
    AuditoriaService.registrar_accion(
        db=db,
        usuario_id=current_user.id,
        empresa_id=empresa_id,
        accion="bitacora_actualizada",
        modulo="siniestros",
        tabla="siniestros",
        registro_id=actividad.siniestro_id,
        descripcion=f"Actividad en bitácora actualizada: {actividad.descripcion[:80]}{'...' if len(actividad.descripcion or '') > 80 else ''}",
        datos_nuevos={"tipo_actividad": actividad.tipo_actividad, "actividad_id": str(actividad.id)},
    )

    return actividad


@router.delete("/{actividad_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bitacora_actividad(
    actividad_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Elimina una actividad de bitácora"""
    ok = BitacoraActividadService.delete(db, actividad_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    return None

