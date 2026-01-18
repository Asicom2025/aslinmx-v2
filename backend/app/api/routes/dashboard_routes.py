"""
Rutas API para estadísticas del dashboard
"""
from typing import Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.exc import SQLAlchemyError
import logging

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.legal import Siniestro, EstadoSiniestro, Area, BitacoraActividad, Notificacion
from app.models.flujo_trabajo import SiniestroEtapa

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
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

        # Total de siniestros
        total_siniestros = db.query(func.count(Siniestro.id)).filter(
            Siniestro.empresa_id == empresa_id,
            Siniestro.eliminado == False
        ).scalar()

        # Siniestros activos
        siniestros_activos = db.query(func.count(Siniestro.id)).filter(
            Siniestro.empresa_id == empresa_id,
            Siniestro.eliminado == False,
            Siniestro.activo == True
        ).scalar()

        # Siniestros por estado
        siniestros_por_estado = db.query(
            EstadoSiniestro.nombre,
            func.count(Siniestro.id).label('count')
        ).join(
            Siniestro, Siniestro.estado_id == EstadoSiniestro.id
        ).filter(
            Siniestro.empresa_id == empresa_id,
            Siniestro.eliminado == False
        ).group_by(EstadoSiniestro.nombre).all()

        # Siniestros por prioridad
        siniestros_por_prioridad = db.query(
            Siniestro.prioridad,
            func.count(Siniestro.id).label('count')
        ).filter(
            Siniestro.empresa_id == empresa_id,
            Siniestro.eliminado == False
        ).group_by(Siniestro.prioridad).all()

        # Siniestros por área principal
        siniestros_por_area = db.query(
            Area.nombre,
            func.count(Siniestro.id).label('count')
        ).join(
            Siniestro, Siniestro.area_principal_id == Area.id
        ).filter(
            Siniestro.empresa_id == empresa_id,
            Siniestro.eliminado == False
        ).group_by(Area.nombre).limit(10).all()

        # Siniestros críticos (prioridad crítica)
        siniestros_criticos = db.query(func.count(Siniestro.id)).filter(
            Siniestro.empresa_id == empresa_id,
            Siniestro.eliminado == False,
            Siniestro.prioridad == 'critica'
        ).scalar()

        # Notificaciones no leídas del usuario
        notificaciones_no_leidas = db.query(func.count(Notificacion.id)).filter(
            Notificacion.usuario_id == current_user.id,
            Notificacion.leida == False
        ).scalar()

        # Actividades recientes (últimas 24 horas)
        from datetime import datetime, timedelta
        desde = datetime.utcnow() - timedelta(hours=24)
        actividades_recientes = db.query(func.count(BitacoraActividad.id)).filter(
            BitacoraActividad.fecha_actividad >= desde
        ).scalar()

        return {
            "total_siniestros": total_siniestros or 0,
            "siniestros_activos": siniestros_activos or 0,
            "siniestros_criticos": siniestros_criticos or 0,
            "notificaciones_no_leidas": notificaciones_no_leidas or 0,
            "actividades_recientes": actividades_recientes or 0,
            "siniestros_por_estado": [
                {"nombre": nombre, "cantidad": cantidad} 
                for nombre, cantidad in siniestros_por_estado
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
        logger.error(f"Error de base de datos en get_dashboard_stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener estadísticas del dashboard"
        )
    except Exception as e:
        logger.error(f"Error inesperado en get_dashboard_stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener estadísticas del dashboard"
        )


@router.get("/recent-siniestros")
def get_recent_siniestros(
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
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
        
        siniestros = db.query(Siniestro).filter(
            Siniestro.empresa_id == empresa_id,
            Siniestro.eliminado == False
        ).order_by(Siniestro.fecha_registro.desc()).limit(limit).all()

        return [
            {
                "id": str(s.id),
                "numero_siniestro": s.numero_siniestro,
                "fecha_siniestro": s.fecha_siniestro.isoformat() if s.fecha_siniestro else None,
                "prioridad": s.prioridad,
                "estado_id": str(s.estado_id) if s.estado_id else None,
                "area_principal_id": str(s.area_principal_id) if s.area_principal_id else None,
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
    current_user: User = Depends(get_current_active_user),
):
    """
    Obtiene la cantidad de siniestros por mes
    """
    from datetime import datetime, timedelta
    from sqlalchemy import extract
    
    empresa_id = current_user.empresa_id
    fecha_limite = datetime.utcnow() - timedelta(days=30 * months)
    
    siniestros = db.query(
        extract('year', Siniestro.fecha_registro).label('year'),
        extract('month', Siniestro.fecha_registro).label('month'),
        func.count(Siniestro.id).label('count')
    ).filter(
        Siniestro.empresa_id == empresa_id,
        Siniestro.eliminado == False,
        Siniestro.fecha_registro >= fecha_limite
    ).group_by(
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

