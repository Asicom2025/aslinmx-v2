"""
Rutas API para gestión de siniestros
"""
import logging
from collections import defaultdict
from typing import Dict, List, Optional, Set, Tuple
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.core.permisos import (
    assert_permiso_actualizar_siniestro,
    require_permiso,
)
from app.models.user import User
from app.schemas.legal_schema import (
    SiniestroCreate, SiniestroUpdate, SiniestroResponse,
)
from app.services.legal_service import SiniestroService
from app.services.email_service import EmailService
from app.services.auditoria_service import AuditoriaService
from app.services.siniestro_acceso_service import (
    usuario_puede_ver_siniestro,
    usuario_puede_editar_siniestro,
    usuario_puede_eliminar_siniestro,
)
from app.models.legal import SiniestroUsuario

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/siniestros", tags=["Siniestros"])


def _usuarios_asignados_por_siniestro(db: Session, siniestro_ids: List[UUID]) -> Dict[UUID, List[UUID]]:
    """Abogados asignados activos por siniestro_id (principal primero, luego por fecha)."""
    if not siniestro_ids:
        return {}
    rows = (
        db.query(SiniestroUsuario)
        .filter(
            SiniestroUsuario.siniestro_id.in_(siniestro_ids),
            SiniestroUsuario.activo.is_(True),
            SiniestroUsuario.eliminado.is_(False),
        )
        .order_by(
            SiniestroUsuario.es_principal.desc(),
            SiniestroUsuario.creado_en.asc(),
        )
        .all()
    )
    m: Dict[UUID, List[UUID]] = defaultdict(list)
    seen: Set[Tuple[UUID, UUID]] = set()
    for r in rows:
        key = (r.siniestro_id, r.usuario_id)
        if key in seen:
            continue
        seen.add(key)
        m[r.siniestro_id].append(r.usuario_id)
    return dict(m)


# ===== SINIESTROS =====
@router.get("", response_model=List[SiniestroResponse])
def list_siniestros(
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    sin_filtrar_activo: bool = Query(
        False,
        description="Si true, no filtra por activo/inactivo. Tiene prioridad sobre activo (p. ej. listado “Todos” o búsqueda global).",
    ),
    estado_id: Optional[UUID] = Query(None, description="Filtrar por estado de siniestro"),
    proveniente_id: Optional[UUID] = Query(None, description="Filtrar por proveniente"),
    area_id: Optional[UUID] = Query(None, description="Filtrar por área principal"),
    usuario_asignado: Optional[UUID] = Query(None, description="Filtrar por usuario asignado"),
    prioridad: Optional[str] = Query(None, description="Filtrar por prioridad (baja, media, alta, critica)"),
    calificacion_id: Optional[UUID] = Query(None, description="Filtrar por calificación"),
    asegurado_estado: Optional[str] = Query(None, description="Filtrar por estado geográfico del asegurado (texto legado)"),
    asegurado_geo_estado_id: Optional[UUID] = Query(
        None,
        description="Filtrar por geo_estados.id del asegurado (prioritario sobre asegurado_estado)",
    ),
    fecha_registro_mes: Optional[str] = Query(None, description="Filtrar por mes de registro en formato YYYY-MM"),
    busqueda_id: Optional[str] = Query(None, description="Buscar por ID/numero_reporte (ej. 102-001-25 o 10200125)"),
    numero_siniestro: Optional[str] = Query(None, description="Buscar por número de siniestro (texto libre)"),
    numero_reporte: Optional[str] = Query(None, description="Buscar por número de reporte (texto libre, ilike)"),
    tercero: Optional[str] = Query(None, description="Buscar por nombre de tercero (texto libre, ilike)"),
    anio: Optional[str] = Query(
        None,
        description="Año de fecha_registro/fecha_siniestro: 4 dígitos (2025) o 2 (25)",
    ),
    asegurado_nombre: Optional[str] = Query(None, description="Buscar por nombre del asegurado"),
    skip: int = Query(0, ge=0, description="Número de registros a saltar"),
    limit: int = Query(1000, ge=1, le=10000, description="Número máximo de registros a retornar"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("siniestros", "read")),
):
    """
    Lista todos los siniestros con filtros opcionales.
    Búsqueda: busqueda_id (formato 102-001-25), numero_siniestro, numero_reporte, tercero, anio, asegurado_nombre.
    """
    rows = SiniestroService.list(
        db=db,
        empresa_id=current_user.empresa_id,
        activo=activo,
        sin_filtrar_activo=sin_filtrar_activo,
        estado_id=estado_id,
        proveniente_id=proveniente_id,
        area_id=area_id,
        usuario_asignado=usuario_asignado,
        prioridad=prioridad,
        calificacion_id=calificacion_id,
        asegurado_estado=asegurado_estado,
        asegurado_geo_estado_id=asegurado_geo_estado_id,
        fecha_registro_mes=fecha_registro_mes,
        busqueda_id=busqueda_id,
        numero_siniestro_q=numero_siniestro,
        numero_reporte=numero_reporte,
        tercero=tercero,
        anio_busqueda=anio,
        asegurado_nombre=asegurado_nombre,
        skip=skip,
        limit=limit,
        current_user=current_user,
    )
    if not rows:
        return []
    asignados_map = _usuarios_asignados_por_siniestro(db, [r.id for r in rows])
    out: List[SiniestroResponse] = []
    for s in rows:
        dumped = SiniestroResponse.model_validate(s).model_dump()
        dumped["usuarios_asignados_ids"] = asignados_map.get(s.id, [])
        out.append(SiniestroResponse(**dumped))
    return out


@router.get("/{siniestro_id}", response_model=SiniestroResponse)
def get_siniestro(
    siniestro_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("siniestros", "read")),
):
    """
    Obtiene un siniestro por ID.
    Valida que pertenezca a la empresa del usuario.
    """
    if not usuario_puede_ver_siniestro(db, current_user, current_user.empresa_id, siniestro_id):
        raise HTTPException(status_code=404, detail="Siniestro no encontrado")
    siniestro = SiniestroService.get_by_id(db, siniestro_id, current_user.empresa_id)
    if not siniestro:
        raise HTTPException(status_code=404, detail="Siniestro no encontrado")
    puede_editar = usuario_puede_editar_siniestro(
        db, current_user, current_user.empresa_id, siniestro_id
    )
    ids_map = _usuarios_asignados_por_siniestro(db, [siniestro.id])
    dumped = SiniestroResponse.model_validate(siniestro).model_dump()
    dumped["puede_editar_expediente"] = puede_editar
    dumped["usuarios_asignados_ids"] = ids_map.get(siniestro.id, [])
    return SiniestroResponse(**dumped)


@router.post("", response_model=SiniestroResponse, status_code=status.HTTP_201_CREATED)
def create_siniestro(
    payload: SiniestroCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("siniestros", "create")),
):
    """
    Crea un nuevo siniestro.
    numero_siniestro y numero_reporte pueden repetirse (p. ej. S/N, N/A).
    El campo creado_por se establece automáticamente con el usuario actual.
    """
    try:
        siniestro = SiniestroService.create(db, current_user.empresa_id, payload, current_user.id)
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
                registro_id=None,
                descripcion=f"Error al crear siniestro: {str(e)}",
                datos_nuevos={"error": str(e), "tipo": type(e).__name__},
            )
        except Exception:
            pass
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
    current_user: User = Depends(get_current_active_user),
):
    """
    Actualiza un siniestro existente.
    Valida que pertenezca a la empresa del usuario.
    Permisos: siniestros.update para cambios generales; solo estado_id requiere editar_status;
    solo calificacion_id requiere editar_calificacion; solo polizas requiere editar_poliza;
    solo descripcion_hechos requiere editar_descripcion_de_hechos;
    solo prioridad requiere editar_prioridad;
    esas claves pueden combinarse entre sí sin update.
    Además exige poder editar el expediente según nivel (áreas / asignación).
    Si se actualiza descripcion_hechos, crea una nueva versión automáticamente.
    """
    campos = set(payload.model_dump(exclude_unset=True).keys())
    assert_permiso_actualizar_siniestro(db, current_user, campos)

    # Cualquier actualización persiste en el expediente: exige la misma regla de edición
    # (nivel 2 por áreas, nivel 3 por asignación, etc.), además de ver + permisos granulares.
    if not usuario_puede_ver_siniestro(db, current_user, current_user.empresa_id, siniestro_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Siniestro no encontrado",
        )
    if not usuario_puede_editar_siniestro(db, current_user, current_user.empresa_id, siniestro_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso para editar este siniestro según su nivel o asignación",
        )
    try:
        siniestro = SiniestroService.update(db, siniestro_id, current_user.empresa_id, payload, current_user.id)
        if not siniestro:
            raise HTTPException(status_code=404, detail="Siniestro no encontrado")
        return siniestro
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
                descripcion=f"Error al actualizar siniestro: {str(e)}",
                datos_nuevos={"error": str(e), "tipo": type(e).__name__},
            )
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar siniestro: {str(e)}"
        )


@router.delete("/{siniestro_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_siniestro(
    siniestro_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("siniestros", "delete")),
):
    """
    Elimina lógicamente un siniestro (soft delete).
    No elimina físicamente para mantener historial.
    """
    if not usuario_puede_eliminar_siniestro(db, current_user, current_user.empresa_id, siniestro_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso para eliminar este siniestro según su nivel o asignación",
        )
    ok = SiniestroService.delete(db, siniestro_id, current_user.empresa_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Siniestro no encontrado")
    return None

