"""
Rutas API para estadísticas del dashboard
"""
from typing import Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session, aliased
from sqlalchemy import func, and_, or_, nullslast, cast, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.exc import SQLAlchemyError
import logging

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.core.permisos import require_permiso
from app.models.user import User
from app.services.siniestro_acceso_service import subquery_siniestros_visibles
from app.models.legal import (
    Siniestro,
    EstadoSiniestro,
    Area,
    BitacoraActividad,
    Notificacion,
    SiniestroArea,
    Asegurado,
)
from app.models.flujo_trabajo import SiniestroEtapa
from app.models.geo_models import GeoEstado, GeoMunicipio
from app.utils.estado_normalization import normalizar_nombre_estado

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("dashboard", "read")),
):
    """
    Obtiene estadísticas generales para el dashboard
    """
    try:
        empresa_id = current_user.empresa_id
        
        if not empresa_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuario no tiene empresa asignada"
            )

        alcance = subquery_siniestros_visibles(db, current_user, empresa_id)

        # Total de siniestros
        try:
            q_tot = db.query(func.count(Siniestro.id)).filter(
                Siniestro.empresa_id == empresa_id,
                Siniestro.eliminado == False,
                Siniestro.activo == True,
            )
            if alcance is not None:
                q_tot = q_tot.filter(Siniestro.id.in_(alcance))
            total_siniestros = q_tot.scalar() or 0
        except Exception as e:
            db.rollback()
            logger.warning(f"Error al obtener total de siniestros: {str(e)}")
            total_siniestros = 0

        # Siniestros activos
        try:
            q_act = db.query(func.count(Siniestro.id)).filter(
                Siniestro.empresa_id == empresa_id,
                Siniestro.eliminado == False,
                Siniestro.activo == True
            )
            if alcance is not None:
                q_act = q_act.filter(Siniestro.id.in_(alcance))
            siniestros_activos = q_act.scalar() or 0
        except Exception as e:
            db.rollback()
            logger.warning(f"Error al obtener siniestros activos: {str(e)}")
            siniestros_activos = 0

        # Siniestros por estado geográfico del asegurado (catálogo geo vía FK o municipio).
        try:
            GeoEstadoMun = aliased(GeoEstado)
            nombre_grupo = func.coalesce(GeoEstado.nombre, GeoEstadoMun.nombre, "Sin estado")
            q_geo = (
                db.query(
                    nombre_grupo.label("nombre_grupo"),
                    func.min(
                        func.coalesce(
                            cast(Asegurado.estado_geografico_id, String),
                            cast(GeoMunicipio.estado_id, String),
                        )
                    ).label("geo_id"),
                    func.count(Siniestro.id).label("count"),
                )
                .join(Siniestro, Siniestro.asegurado_id == Asegurado.id)
                .outerjoin(GeoEstado, GeoEstado.id == Asegurado.estado_geografico_id)
                .outerjoin(GeoMunicipio, GeoMunicipio.id == Asegurado.municipio_id)
                .outerjoin(GeoEstadoMun, GeoEstadoMun.id == GeoMunicipio.estado_id)
                .filter(
                    Siniestro.empresa_id == empresa_id,
                    Siniestro.eliminado == False,
                    Siniestro.activo == True,
                    or_(
                        Asegurado.estado_geografico_id.isnot(None),
                        Asegurado.municipio_id.isnot(None),
                    ),
                )
            )
            if alcance is not None:
                q_geo = q_geo.filter(Siniestro.id.in_(alcance))
            siniestros_por_estado_raw = q_geo.group_by(nombre_grupo).all()

            estados_out: Dict[str, Dict[str, Any]] = {}
            for nombre_grupo, geo_id, cantidad in siniestros_por_estado_raw:
                ng = (nombre_grupo or "").strip() or "Sin estado"
                key = f"geo:{geo_id}" if geo_id else f"txt:{normalizar_nombre_estado(ng)}"
                display = ng if geo_id else normalizar_nombre_estado(ng)
                if key not in estados_out:
                    estados_out[key] = {
                        "nombre": display,
                        "cantidad": 0,
                        "geo_estado_id": str(geo_id) if geo_id else None,
                    }
                estados_out[key]["cantidad"] += int(cantidad or 0)
            siniestros_por_estado = list(estados_out.values())
        except Exception as e:
            db.rollback()
            logger.warning(f"Error al obtener siniestros por estado geográfico: {str(e)}")
            siniestros_por_estado = []

        # Siniestros por prioridad
        try:
            q_pri = db.query(
                Siniestro.prioridad,
                func.count(Siniestro.id).label('count')
            ).filter(
                Siniestro.empresa_id == empresa_id,
                Siniestro.eliminado == False,
                Siniestro.activo == True,
            )
            if alcance is not None:
                q_pri = q_pri.filter(Siniestro.id.in_(alcance))
            siniestros_por_prioridad = q_pri.group_by(Siniestro.prioridad).all()
        except Exception as e:
            db.rollback()
            logger.warning(f"Error al obtener siniestros por prioridad: {str(e)}")
            siniestros_por_prioridad = []

        # Siniestros por área (usando la relación siniestro_areas)
        try:
            q_area = db.query(
                Area.nombre,
                func.count(func.distinct(Siniestro.id)).label('count')
            ).join(
                SiniestroArea, SiniestroArea.area_id == Area.id
            ).join(
                Siniestro, Siniestro.id == SiniestroArea.siniestro_id
            ).filter(
                Siniestro.empresa_id == empresa_id,
                Siniestro.eliminado == False,
                Siniestro.activo == True,
                SiniestroArea.activo == True,
                SiniestroArea.eliminado == False,
            )
            if alcance is not None:
                q_area = q_area.filter(Siniestro.id.in_(alcance))
            siniestros_por_area = q_area.group_by(Area.nombre).limit(10).all()
        except Exception as e:
            db.rollback()
            logger.warning(f"Error al obtener siniestros por área: {str(e)}")
            siniestros_por_area = []

        # Siniestros críticos (prioridad crítica)
        try:
            q_crit = db.query(func.count(Siniestro.id)).filter(
                Siniestro.empresa_id == empresa_id,
                Siniestro.eliminado == False,
                Siniestro.activo == True,
                Siniestro.prioridad == 'critica'
            )
            if alcance is not None:
                q_crit = q_crit.filter(Siniestro.id.in_(alcance))
            siniestros_criticos = q_crit.scalar() or 0
        except Exception as e:
            db.rollback()
            logger.warning(f"Error al obtener siniestros críticos: {str(e)}")
            siniestros_criticos = 0

        # Notificaciones no leídas del usuario
        try:
            notificaciones_no_leidas = db.query(func.count(Notificacion.id)).filter(
                Notificacion.usuario_id == current_user.id,
                Notificacion.leida == False
            ).scalar() or 0
        except Exception as e:
            db.rollback()
            logger.warning(f"Error al obtener notificaciones no leídas: {str(e)}")
            notificaciones_no_leidas = 0

        # Actividades recientes (últimas 24 horas)
        from datetime import datetime, timedelta, timezone
        try:
            # Usar timezone-aware datetime para PostgreSQL
            desde = datetime.now(timezone.utc) - timedelta(hours=24)
            actividades_recientes = db.query(func.count(BitacoraActividad.id)).filter(
                BitacoraActividad.fecha_actividad >= desde
            ).scalar() or 0
        except Exception as e:
            db.rollback()
            logger.warning(f"Error al obtener actividades recientes: {str(e)}")
            actividades_recientes = 0

        return {
            "total_siniestros": total_siniestros or 0,
            "siniestros_activos": siniestros_activos or 0,
            "siniestros_criticos": siniestros_criticos or 0,
            "notificaciones_no_leidas": notificaciones_no_leidas or 0,
            "actividades_recientes": actividades_recientes or 0,
            "siniestros_por_estado": [
                {
                    "nombre": item["nombre"],
                    "cantidad": item["cantidad"],
                    "geo_estado_id": item.get("geo_estado_id"),
                }
                for item in siniestros_por_estado
            ],
            "siniestros_por_prioridad": [
                {"prioridad": prioridad, "cantidad": cantidad} 
                for prioridad, cantidad in siniestros_por_prioridad
            ],
            "siniestros_por_area": [
                {"nombre": nombre, "cantidad": cantidad} 
                for nombre, cantidad in siniestros_por_area
            ],
        }
    except SQLAlchemyError as e:
        logger.error(f"Error de base de datos en get_dashboard_stats: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de base de datos: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error inesperado en get_dashboard_stats: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado: {str(e)}"
        )


@router.get("/recent-siniestros")
def get_recent_siniestros(
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("dashboard", "ver_siniestros_recientes")),
):
    """
    Obtiene los siniestros más recientes
    """
    try:
        empresa_id = current_user.empresa_id
        
        if not empresa_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuario no tiene empresa asignada"
            )
        
        # Obtener siniestros recientes
        q_rec = db.query(Siniestro).filter(
            Siniestro.empresa_id == empresa_id,
            Siniestro.eliminado == False,
            Siniestro.activo == True,
        )
        alcance = subquery_siniestros_visibles(db, current_user, empresa_id)
        if alcance is not None:
            q_rec = q_rec.filter(Siniestro.id.in_(alcance))
        siniestros = q_rec.order_by(nullslast(Siniestro.fecha_registro.desc())).limit(limit).all()

        # Obtener IDs de siniestros para buscar áreas
        siniestro_ids = [s.id for s in siniestros]
        
        # Obtener la primera área activa de cada siniestro en una sola consulta
        areas_map = {}
        if siniestro_ids:
            areas_query = db.query(
                SiniestroArea.siniestro_id,
                SiniestroArea.area_id
            ).filter(
                SiniestroArea.siniestro_id.in_(siniestro_ids),
                SiniestroArea.activo == True,
                SiniestroArea.eliminado == False,
            ).order_by(SiniestroArea.creado_en).all()
            
            # Crear mapa de siniestro_id -> primera area_id
            for siniestro_id, area_id in areas_query:
                if siniestro_id not in areas_map:
                    areas_map[siniestro_id] = area_id

        return [
            {
                "id": str(s.id),
                "numero_siniestro": s.numero_siniestro,
                "fecha_siniestro": s.fecha_siniestro.isoformat() if s.fecha_siniestro else None,
                "prioridad": s.prioridad,
                "estado_id": str(s.estado_id) if s.estado_id else None,
                "area_principal_id": str(areas_map.get(s.id)) if s.id in areas_map else None,
            }
            for s in siniestros
        ]
    except SQLAlchemyError as e:
        logger.error(f"Error de base de datos en get_recent_siniestros: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener siniestros recientes"
        )
    except Exception as e:
        logger.error(f"Error inesperado en get_recent_siniestros: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener siniestros recientes"
        )


@router.get("/siniestros-by-month")
def get_siniestros_by_month(
    months: int = Query(6, ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("dashboard", "ver_grafica_por_mes")),
):
    """
    Obtiene la cantidad de siniestros por mes
    """
    from datetime import datetime, timedelta
    from sqlalchemy import extract
    
    empresa_id = current_user.empresa_id
    fecha_limite = datetime.utcnow() - timedelta(days=30 * months)

    alcance = subquery_siniestros_visibles(db, current_user, empresa_id)
    q_mes = db.query(
        extract('year', Siniestro.fecha_registro).label('year'),
        extract('month', Siniestro.fecha_registro).label('month'),
        func.count(Siniestro.id).label('count')
    ).filter(
        Siniestro.empresa_id == empresa_id,
        Siniestro.eliminado == False,
        Siniestro.activo == True,
        Siniestro.fecha_registro.isnot(None),
        Siniestro.fecha_registro >= fecha_limite
    )
    if alcance is not None:
        q_mes = q_mes.filter(Siniestro.id.in_(alcance))
    siniestros = q_mes.group_by(
        extract('year', Siniestro.fecha_registro),
        extract('month', Siniestro.fecha_registro)
    ).order_by(
        extract('year', Siniestro.fecha_registro).desc(),
        extract('month', Siniestro.fecha_registro).desc()
    ).all()

    return [
        {
            "mes": f"{int(year)}-{int(month):02d}",
            "cantidad": int(count)
        }
        for year, month, count in siniestros
    ]

