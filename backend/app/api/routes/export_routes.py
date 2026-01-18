"""
Rutas para exportación de datos
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List, Literal
from datetime import datetime
import io

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.legal import (
    Siniestro, Entidad, Institucion, Autoridad, Proveniente, Area, EstadoSiniestro
)
from app.services.export_service import ExportService
from app.services.reporte_service import ReporteService

router = APIRouter()


@router.post("/exportar/{modulo}")
async def exportar_datos(
    modulo: str,
    formato: Literal["excel", "csv"] = Query("excel"),
    columnas: Optional[List[str]] = Query(None),
    filtros: Optional[dict] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Exporta datos de un módulo específico
    
    Módulos disponibles: usuarios, siniestros, entidades, instituciones, autoridades, areas
    """
    try:
        # Obtener datos
        datos = ReporteService.obtener_datos_reporte(
            db=db,
            modulo=modulo,
            empresa_id=current_user.empresa_id,
            filtros=filtros,
            columnas=columnas
        )

        nombre_archivo = f"{modulo}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        if formato == "excel":
            archivo_bytes = ExportService.export_to_excel(
                datos=datos,
                nombre_hoja=modulo.title(),
                titulo=f"Exportación de {modulo.title()}"
            )
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            nombre_archivo += ".xlsx"
        elif formato == "csv":
            csv_content = ExportService.export_to_csv(datos=datos, columnas=columnas)
            archivo_bytes = csv_content.encode('utf-8')
            media_type = "text/csv"
            nombre_archivo += ".csv"
        else:
            raise HTTPException(status_code=400, detail="Formato no soportado")

        return StreamingResponse(
            io.BytesIO(archivo_bytes),
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{nombre_archivo}"'
            }
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al exportar datos: {str(e)}")


@router.get("/exportar/{modulo}/excel")
async def exportar_excel(
    modulo: str,
    columnas: Optional[List[str]] = Query(None),
    activo: Optional[bool] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Exporta datos a Excel - Endpoint simplificado"""
    filtros = {}
    if activo is not None:
        filtros["activo"] = activo

    return await exportar_datos(
        modulo=modulo,
        formato="excel",
        columnas=columnas,
        filtros=filtros,
        current_user=current_user,
        db=db
    )


@router.get("/exportar/{modulo}/csv")
async def exportar_csv(
    modulo: str,
    columnas: Optional[List[str]] = Query(None),
    activo: Optional[bool] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Exporta datos a CSV - Endpoint simplificado"""
    filtros = {}
    if activo is not None:
        filtros["activo"] = activo

    return await exportar_datos(
        modulo=modulo,
        formato="csv",
        columnas=columnas,
        filtros=filtros,
        current_user=current_user,
        db=db
    )




