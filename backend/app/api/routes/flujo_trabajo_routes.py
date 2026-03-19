"""
Rutas API para gestión de flujos de trabajo configurables
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.session import get_db
from app.models.user import User
from app.core.security import get_current_active_user
from app.schemas.flujo_trabajo_schema import (
    FlujoTrabajoCreate,
    FlujoTrabajoUpdate,
    FlujoTrabajoResponse,
    FlujoCompletoResponse,
    EtapaFlujoCreate,
    EtapaFlujoUpdate,
    EtapaFlujoResponse,
    SiniestroEtapaResponse,
    CompletarEtapaRequest,
    AvanzarEtapaRequest,
    InicializarEtapasRequest,
    ReordenarEtapasRequest,
)
from app.services.flujo_trabajo_service import (
    FlujoTrabajoService,
    EtapaFlujoService,
    SiniestroEtapaService,
)
from app.services.auditoria_service import AuditoriaService
import logging
from app.models.flujo_trabajo import EtapaFlujo

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=List[FlujoTrabajoResponse])
def listar_flujos(
    area_id: Optional[str] = Query(None, description="Filtrar por área (NULL o 'null' para flujos generales)"),
    activo: Optional[bool] = Query(True, description="Filtrar por estado activo"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Lista todos los flujos de trabajo de la empresa del usuario"""
    if not current_user.empresa_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario no tiene empresa asignada"
        )

    # Manejar area_id cuando viene como string "null" o None
    # "null" significa filtrar solo flujos generales (area_id IS NULL)
    # None significa traer todos los flujos
    # Un UUID significa filtrar por esa área específica
    area_id_uuid: Optional[UUID] = None
    solo_generales: bool = False
    
    if area_id:
        if area_id.lower() == "null":
            solo_generales = True
        else:
            try:
                area_id_uuid = UUID(area_id)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="area_id debe ser un UUID válido o 'null'"
                )

    flujos = FlujoTrabajoService.get_flujos_by_empresa(
        db=db,
        empresa_id=current_user.empresa_id,
        area_id=area_id_uuid,
        solo_generales=solo_generales,
        activo=activo
    )

    return flujos


@router.get("/predeterminado", response_model=FlujoTrabajoResponse)
def obtener_flujo_predeterminado(
    area_id: Optional[UUID] = Query(None, description="ID del área (opcional)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtiene el flujo predeterminado para la empresa/área"""
    if not current_user.empresa_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario no tiene empresa asignada"
        )

    flujo = FlujoTrabajoService.get_flujo_predeterminado(
        db=db,
        empresa_id=current_user.empresa_id,
        area_id=area_id
    )

    if not flujo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe un flujo predeterminado configurado"
        )

    return flujo


@router.get("/{flujo_id}", response_model=FlujoCompletoResponse)
def obtener_flujo(
    flujo_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtiene un flujo de trabajo con todas sus etapas"""
    if not current_user.empresa_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario no tiene empresa asignada"
        )

    # get_flujo_by_id ya carga las etapas con eager loading
    flujo = FlujoTrabajoService.get_flujo_by_id(db, flujo_id, include_etapas=True)

    if not flujo or flujo.empresa_id != current_user.empresa_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flujo de trabajo no encontrado"
        )

    return flujo


@router.post("", response_model=FlujoTrabajoResponse, status_code=status.HTTP_201_CREATED)
def crear_flujo(
    flujo: FlujoTrabajoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Crea un nuevo flujo de trabajo"""
    if not current_user.empresa_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario no tiene empresa asignada"
        )

    nuevo_flujo = FlujoTrabajoService.create_flujo(
        db=db,
        empresa_id=current_user.empresa_id,
        flujo=flujo
    )

    return nuevo_flujo


@router.put("/{flujo_id}", response_model=FlujoTrabajoResponse)
def actualizar_flujo(
    flujo_id: UUID,
    flujo_update: FlujoTrabajoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Actualiza un flujo de trabajo"""
    if not current_user.empresa_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario no tiene empresa asignada"
        )

    flujo = FlujoTrabajoService.update_flujo(
        db=db,
        flujo_id=flujo_id,
        empresa_id=current_user.empresa_id,
        flujo_update=flujo_update
    )

    if not flujo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flujo de trabajo no encontrado"
        )

    return flujo


@router.delete("/{flujo_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_flujo(
    flujo_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Elimina (soft delete) un flujo de trabajo"""
    if not current_user.empresa_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario no tiene empresa asignada"
        )

    if not FlujoTrabajoService.delete_flujo(db, flujo_id, current_user.empresa_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flujo de trabajo no encontrado"
        )

    return None


@router.get("/{flujo_id}/etapas", response_model=List[EtapaFlujoResponse])
def listar_etapas(
    flujo_id: UUID,
    activo: Optional[bool] = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Lista todas las etapas de un flujo"""
    flujo = FlujoTrabajoService.get_flujo_by_id(db, flujo_id)

    if not flujo or flujo.empresa_id != current_user.empresa_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flujo de trabajo no encontrado"
        )

    etapas = EtapaFlujoService.get_etapas_by_flujo(db, flujo_id, activo)
    return etapas


@router.post("/{flujo_id}/etapas", response_model=EtapaFlujoResponse, status_code=status.HTTP_201_CREATED)
def crear_etapa(
    flujo_id: UUID,
    etapa: EtapaFlujoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Crea una nueva etapa en un flujo"""
    flujo = FlujoTrabajoService.get_flujo_by_id(db, flujo_id)

    if not flujo or flujo.empresa_id != current_user.empresa_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flujo de trabajo no encontrado"
        )

    etapa.flujo_trabajo_id = flujo_id
    nueva_etapa = EtapaFlujoService.create_etapa(db, etapa)
    return nueva_etapa


@router.put("/etapas/{etapa_id}", response_model=EtapaFlujoResponse)
def actualizar_etapa(
    etapa_id: UUID,
    etapa_update: EtapaFlujoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Actualiza una etapa"""
    etapa = EtapaFlujoService.get_etapa_by_id(db, etapa_id)

    if not etapa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Etapa no encontrada"
        )

    flujo = FlujoTrabajoService.get_flujo_by_id(db, etapa.flujo_trabajo_id)
    if not flujo or flujo.empresa_id != current_user.empresa_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso para actualizar esta etapa"
        )

    etapa_actualizada = EtapaFlujoService.update_etapa(db, etapa_id, etapa_update)

    if not etapa_actualizada:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Etapa no encontrada"
        )

    return etapa_actualizada


@router.delete("/etapas/{etapa_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_etapa(
    etapa_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Elimina (soft delete) una etapa"""
    # Importante: consultar la etapa aunque ya esté soft-eliminada.
    # EtapaFlujoService.delete_etapa() ya es idempotente, pero este endpoint validaba
    # contra get_etapa_by_id() (que filtra eliminado_en IS NULL), provocando "Etapa no encontrada"
    # si había un doble delete o un estado de UI desactualizado.
    etapa = db.query(EtapaFlujo).filter(EtapaFlujo.id == etapa_id).first()

    if not etapa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Etapa no encontrada"
        )

    flujo = FlujoTrabajoService.get_flujo_by_id(db, etapa.flujo_trabajo_id)
    if not flujo or flujo.empresa_id != current_user.empresa_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso para eliminar esta etapa"
        )

    # Si ya está eliminada, devolver éxito (idempotente)
    if etapa.eliminado_en is not None:
        return None

    if not EtapaFlujoService.delete_etapa(db, etapa_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Etapa no encontrada"
        )

    return None


@router.delete("/{flujo_id}/etapas/{etapa_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_etapa_por_flujo(
    flujo_id: UUID,
    etapa_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Elimina (soft delete) una etapa asegurando que pertenece al flujo indicado.
    Esto evita que por un ID incorrecto se borre una etapa de otro flujo.
    """
    etapa = db.query(EtapaFlujo).filter(EtapaFlujo.id == etapa_id).first()
    if not etapa or str(etapa.flujo_trabajo_id) != str(flujo_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Etapa no encontrada",
        )

    flujo = FlujoTrabajoService.get_flujo_by_id(db, flujo_id, include_etapas=False)
    if not flujo or flujo.empresa_id != current_user.empresa_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso para eliminar esta etapa",
        )

    # Idempotencia: si ya estaba eliminada, devolvemos éxito
    if etapa.eliminado_en is not None:
        return None

    if not EtapaFlujoService.delete_etapa(db, etapa_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Etapa no encontrada",
        )

    return None


@router.post("/{flujo_id}/etapas/reordenar", status_code=status.HTTP_200_OK)
def reordenar_etapas(
    flujo_id: UUID,
    request: ReordenarEtapasRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Reordena las etapas de un flujo"""
    flujo = FlujoTrabajoService.get_flujo_by_id(db, flujo_id)

    if not flujo or flujo.empresa_id != current_user.empresa_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flujo de trabajo no encontrado"
        )

    EtapaFlujoService.reordenar_etapas(db, flujo_id, request.ordenes)
    return {"success": True, "detail": "Etapas reordenadas correctamente"}


@router.post("/siniestros/{siniestro_id}/inicializar", status_code=status.HTTP_201_CREATED)
def inicializar_etapas_siniestro(
    siniestro_id: UUID,
    request: InicializarEtapasRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Inicializa las etapas de un siniestro usando el flujo predeterminado"""
    success = SiniestroEtapaService.inicializar_etapas_siniestro(
        db=db,
        siniestro_id=siniestro_id,
        flujo_trabajo_id=request.flujo_trabajo_id
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error al inicializar etapas"
        )

    return {"success": True, "detail": "Etapas inicializadas correctamente"}


@router.get("/siniestros/{siniestro_id}/etapas", response_model=List[SiniestroEtapaResponse])
def obtener_etapas_siniestro(
    siniestro_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtiene todas las etapas de un siniestro"""
    etapas = SiniestroEtapaService.get_etapas_by_siniestro(db, siniestro_id)
    return etapas


@router.post("/siniestros/{siniestro_id}/etapas/{etapa_flujo_id}/completar", response_model=SiniestroEtapaResponse)
def completar_etapa_siniestro(
    siniestro_id: UUID,
    etapa_flujo_id: UUID,
    request: CompletarEtapaRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Completa una etapa de un siniestro"""
    try:
        etapa = SiniestroEtapaService.completar_etapa(
            db=db,
            siniestro_id=siniestro_id,
            etapa_flujo_id=etapa_flujo_id,
            usuario_id=current_user.id,
            request=request
        )
        return etapa
    except HTTPException:
        raise
    except Exception as e:
        try:
            AuditoriaService.registrar_accion(
                db=db,
                usuario_id=current_user.id,
                empresa_id=current_user.empresa_id,
                accion="error",
                modulo="siniestros",
                tabla="siniestros",
                registro_id=siniestro_id,
                descripcion="Error al completar etapa de flujo",
                datos_nuevos={"error": str(e), "tipo": type(e).__name__},
            )
        except Exception:
            logger.exception("No se pudo registrar error en auditoría")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al completar etapa: {str(e)}"
        )


@router.post("/siniestros/{siniestro_id}/avanzar", status_code=status.HTTP_200_OK)
def avanzar_etapa_siniestro(
    siniestro_id: UUID,
    request: AvanzarEtapaRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Avanza a la siguiente etapa del siniestro"""
    try:
        SiniestroEtapaService.avanzar_etapa(
            db=db,
            siniestro_id=siniestro_id,
            usuario_id=current_user.id
        )
        return {"success": True, "detail": "Etapa avanzada correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        try:
            AuditoriaService.registrar_accion(
                db=db,
                usuario_id=current_user.id,
                empresa_id=current_user.empresa_id,
                accion="error",
                modulo="siniestros",
                tabla="siniestros",
                registro_id=siniestro_id,
                descripcion="Error al avanzar etapa de flujo",
                datos_nuevos={"error": str(e), "tipo": type(e).__name__},
            )
        except Exception:
            logger.exception("No se pudo registrar error en auditoría")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al avanzar etapa: {str(e)}"
        )

