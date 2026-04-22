"""
Rutas para auditoría y logs del sistema
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from uuid import UUID

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.config_schema import (
    AuditoriaResponse,
    AuditoriaResumenResponse,
    AuditoriaFiltros,
)
from app.services.auditoria_service import AuditoriaService
from app.services.export_service import ExportService
import io

router = APIRouter()


@router.get("/fila/{auditoria_id}", response_model=AuditoriaResponse)
async def obtener_auditoria_detalle(
    auditoria_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    max_payload_chars: int = 200_000,
):
    """Un registro con JSON (datos_anteriores / datos_nuevos) para el detalle en UI."""
    r = AuditoriaService.obtener_auditoria_por_id(
        db=db,
        auditoria_id=auditoria_id,
        empresa_id=current_user.empresa_id,
        max_payload_chars=max_payload_chars,
    )
    if not r:
        raise HTTPException(status_code=404, detail="Registro de auditoría no encontrado")
    return r


@router.get("", response_model=List[AuditoriaResumenResponse])
async def listar_auditoria(
    filtros: AuditoriaFiltros = Depends(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lista registros de auditoría (sin columnas JSONB para rendimiento)."""
    return AuditoriaService.obtener_auditoria(
        db=db,
        empresa_id=current_user.empresa_id if filtros.empresa_id is None else filtros.empresa_id,
        usuario_id=filtros.usuario_id,
        accion=filtros.accion,
        modulo=filtros.modulo,
        tabla=filtros.tabla,
        fecha_desde=filtros.fecha_desde,
        fecha_hasta=filtros.fecha_hasta,
        limit=filtros.limit,
        offset=filtros.offset,
        max_payload_chars=filtros.max_payload_chars,
        incluir_json_payloads=False,
    )


@router.get("/registro/{tabla}/{registro_id}", response_model=List[AuditoriaResponse])
async def obtener_historial_registro(
    tabla: str,
    registro_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtiene el historial completo de cambios de un registro específico"""
    historial = AuditoriaService.obtener_historial_registro(
        db=db,
        tabla=tabla,
        registro_id=registro_id,
        empresa_id=current_user.empresa_id
    )
    return historial


@router.get("/exportar/excel")
async def exportar_auditoria_excel(
    filtros: AuditoriaFiltros = Depends(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Exporta registros de auditoría a Excel"""
    registros = AuditoriaService.obtener_auditoria(
        db=db,
        empresa_id=current_user.empresa_id if filtros.empresa_id is None else filtros.empresa_id,
        usuario_id=filtros.usuario_id,
        accion=filtros.accion,
        modulo=filtros.modulo,
        tabla=filtros.tabla,
        fecha_desde=filtros.fecha_desde,
        fecha_hasta=filtros.fecha_hasta,
        limit=10000,  # Límite alto para exportación
        offset=0,
        max_payload_chars=100000,
        incluir_json_payloads=False,
    )

    # Convertir a diccionarios
    datos = []
    for registro in registros:
        datos.append({
            "id": str(registro.id),
            "usuario": registro.usuario.correo if registro.usuario else None,
            "accion": registro.accion,
            "modulo": registro.modulo,
            "tabla": registro.tabla,
            "registro_id": str(registro.registro_id) if registro.registro_id else None,
            "ip_address": registro.ip_address,
            "descripcion": registro.descripcion,
            "creado_en": registro.creado_en.isoformat() if registro.creado_en else None
        })

    archivo_bytes = ExportService.export_to_excel(
        datos=datos,
        nombre_hoja="Auditoría",
        titulo="Log de Auditoría del Sistema"
    )

    nombre_archivo = f"auditoria_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

    return StreamingResponse(
        io.BytesIO(archivo_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo}"'
        }
    )


@router.get("/estadisticas")
async def obtener_estadisticas_auditoria(
    fecha_desde: Optional[datetime] = Query(None),
    fecha_hasta: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtiene estadísticas de auditoría"""
    from sqlalchemy import func
    from app.models.config import Auditoria

    query = db.query(Auditoria).filter(
        Auditoria.empresa_id == current_user.empresa_id
    )

    if fecha_desde:
        query = query.filter(Auditoria.creado_en >= fecha_desde)
    if fecha_hasta:
        query = query.filter(Auditoria.creado_en <= fecha_hasta)

    total_acciones = query.count()

    # Acciones por tipo
    acciones_por_tipo = db.query(
        Auditoria.accion,
        func.count(Auditoria.id).label("cantidad")
    ).filter(
        Auditoria.empresa_id == current_user.empresa_id
    )
    if fecha_desde:
        acciones_por_tipo = acciones_por_tipo.filter(Auditoria.creado_en >= fecha_desde)
    if fecha_hasta:
        acciones_por_tipo = acciones_por_tipo.filter(Auditoria.creado_en <= fecha_hasta)
    acciones_por_tipo = acciones_por_tipo.group_by(Auditoria.accion).all()

    # Acciones por módulo
    acciones_por_modulo = db.query(
        Auditoria.modulo,
        func.count(Auditoria.id).label("cantidad")
    ).filter(
        Auditoria.empresa_id == current_user.empresa_id
    )
    if fecha_desde:
        acciones_por_modulo = acciones_por_modulo.filter(Auditoria.creado_en >= fecha_desde)
    if fecha_hasta:
        acciones_por_modulo = acciones_por_modulo.filter(Auditoria.creado_en <= fecha_hasta)
    acciones_por_modulo = acciones_por_modulo.group_by(Auditoria.modulo).all()

    return {
        "total_acciones": total_acciones,
        "acciones_por_tipo": [
            {"accion": accion, "cantidad": cantidad}
            for accion, cantidad in acciones_por_tipo
        ],
        "acciones_por_modulo": [
            {"modulo": modulo, "cantidad": cantidad}
            for modulo, cantidad in acciones_por_modulo
        ]
    }




