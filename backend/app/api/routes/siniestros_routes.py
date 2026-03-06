"""
Rutas API para gestión de siniestros
"""
import logging
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.core.permisos import require_permiso
from app.models.user import User
from app.schemas.legal_schema import (
    SiniestroCreate, SiniestroUpdate, SiniestroResponse,
)
from app.services.legal_service import SiniestroService
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)

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
    current_user: User = Depends(require_permiso("siniestros", "leer")),
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
    current_user: User = Depends(require_permiso("siniestros", "crear")),
):
    """
    Crea un nuevo siniestro.
    Valida que el número de siniestro sea único por empresa.
    El campo creado_por se establece automáticamente con el usuario actual.
    """
    try:
        siniestro = SiniestroService.create(db, current_user.empresa_id, payload, current_user.id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear siniestro: {str(e)}"
        )

    # Enviar correo de notificación (plantilla nuevo_id) al creador, sin fallar la petición si falla el envío
    try:
        destinatarios = [current_user.email] if getattr(current_user, "email", None) else []
        if not destinatarios and getattr(current_user, "correo", None):
            destinatarios = [current_user.correo]
        if destinatarios:
            ok, err = EmailService.enviar_notificacion_nuevo_siniestro(
                db, siniestro, current_user, destinatarios
            )
            if not ok:
                logger.warning("Correo de nuevo siniestro no enviado: %s", err)
    except Exception as e:
        logger.exception("Error al enviar correo de nuevo siniestro: %s", e)

    return siniestro


@router.put("/{siniestro_id}", response_model=SiniestroResponse)
def update_siniestro(
    siniestro_id: UUID,
    payload: SiniestroUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("siniestros", "actualizar")),
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
    current_user: User = Depends(require_permiso("siniestros", "eliminar")),
):
    """
    Elimina lógicamente un siniestro (soft delete).
    No elimina físicamente para mantener historial.
    """
    ok = SiniestroService.delete(db, siniestro_id, current_user.empresa_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Siniestro no encontrado")
    return None

