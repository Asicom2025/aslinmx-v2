"""
Rutas para generación de reportes
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import base64
import io

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.reporte_schema import (
    ReporteRequest,
    ReporteResponse,
    ReporteDisponible,
    ReporteFiltros
)
from app.services.reporte_service import ReporteService
from app.services.export_service import ExportService

router = APIRouter()


@router.get("/disponibles", response_model=List[ReporteDisponible])
async def listar_reportes_disponibles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lista todos los módulos disponibles para reportes"""
    reportes = [
        ReporteDisponible(
            modulo="usuarios",
            nombre="Reporte de Usuarios",
            descripcion="Listado completo de usuarios del sistema",
            columnas_disponibles=["correo", "activo", "creado_en", "empresa_id", "rol_id"],
            filtros_disponibles=["activo", "fecha_desde", "fecha_hasta", "empresa_id"]
        ),
        ReporteDisponible(
            modulo="siniestros",
            nombre="Reporte de Siniestros",
            descripcion="Listado de siniestros con filtros avanzados",
            columnas_disponibles=["numero_siniestro", "fecha_siniestro", "prioridad", "estado_id", "area_principal_id"],
            filtros_disponibles=["activo", "fecha_desde", "fecha_hasta", "estado_id", "prioridad"],
            agrupaciones_disponibles=["estado_id", "area_principal_id", "prioridad"]
        ),
        ReporteDisponible(
            modulo="entidades",
            nombre="Reporte de Entidades",
            descripcion="Listado de entidades unificadas",
            columnas_disponibles=["nombre", "codigo", "email", "telefono", "es_institucion", "es_autoridad", "es_organo"],
            filtros_disponibles=["activo", "es_institucion", "es_autoridad", "es_organo"]
        ),
        ReporteDisponible(
            modulo="instituciones",
            nombre="Reporte de Instituciones",
            descripcion="Listado de instituciones",
            columnas_disponibles=["nombre", "codigo", "email", "activo"],
            filtros_disponibles=["activo"]
        ),
        ReporteDisponible(
            modulo="autoridades",
            nombre="Reporte de Autoridades",
            descripcion="Listado de autoridades",
            columnas_disponibles=["nombre", "codigo", "email", "activo"],
            filtros_disponibles=["activo"]
        ),
        ReporteDisponible(
            modulo="areas",
            nombre="Reporte de Áreas",
            descripcion="Listado de áreas organizacionales",
            columnas_disponibles=["nombre", "codigo", "descripcion", "activo"],
            filtros_disponibles=["activo"]
        ),
    ]
    return reportes


@router.post("/generar", response_model=ReporteResponse)
async def generar_reporte(
    request: ReporteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Genera un reporte en el formato especificado"""
    try:
        # Obtener datos
        datos = ReporteService.obtener_datos_reporte(
            db=db,
            modulo=request.modulo,
            empresa_id=current_user.empresa_id,
            filtros=request.filtros.model_dump(exclude_unset=True) if request.filtros else None,
            columnas=request.columnas,
            ordenamiento=request.ordenamiento
        )

        nombre_archivo = f"reporte_{request.modulo}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        if request.formato == "excel":
            archivo_bytes = ReporteService.generar_reporte_excel(
                datos=datos,
                nombre_hoja=request.modulo.title(),
                titulo=f"Reporte de {request.modulo.title()}"
            )
            nombre_archivo += ".xlsx"
            archivo_base64 = base64.b64encode(archivo_bytes).decode('utf-8')
        elif request.formato == "csv":
            csv_content = ReporteService.generar_reporte_csv(
                datos=datos,
                columnas=request.columnas
            )
            nombre_archivo += ".csv"
            archivo_base64 = base64.b64encode(csv_content.encode('utf-8')).decode('utf-8')
        elif request.formato == "pdf":
            archivo_bytes = ReporteService.generar_reporte_pdf(
                datos=datos,
                titulo=f"Reporte de {request.modulo.title()}",
                columnas=request.columnas
            )
            nombre_archivo += ".pdf"
            archivo_base64 = base64.b64encode(archivo_bytes).decode('utf-8')
        else:
            raise HTTPException(status_code=400, detail="Formato no soportado")

        return ReporteResponse(
            success=True,
            message="Reporte generado exitosamente",
            archivo_base64=archivo_base64,
            nombre_archivo=nombre_archivo,
            total_registros=len(datos),
            datos=datos if request.formato == "json" else None
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar reporte: {str(e)}")


@router.post("/generar/descargar")
async def descargar_reporte(
    request: ReporteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Genera y descarga un reporte directamente"""
    try:
        datos = ReporteService.obtener_datos_reporte(
            db=db,
            modulo=request.modulo,
            empresa_id=current_user.empresa_id,
            filtros=request.filtros.model_dump(exclude_unset=True) if request.filtros else None,
            columnas=request.columnas,
            ordenamiento=request.ordenamiento
        )

        nombre_archivo = f"reporte_{request.modulo}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        if request.formato == "excel":
            archivo_bytes = ReporteService.generar_reporte_excel(
                datos=datos,
                nombre_hoja=request.modulo.title(),
                titulo=f"Reporte de {request.modulo.title()}"
            )
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            nombre_archivo += ".xlsx"
        elif request.formato == "csv":
            csv_content = ReporteService.generar_reporte_csv(
                datos=datos,
                columnas=request.columnas
            )
            archivo_bytes = csv_content.encode('utf-8')
            media_type = "text/csv"
            nombre_archivo += ".csv"
        elif request.formato == "pdf":
            archivo_bytes = ReporteService.generar_reporte_pdf(
                datos=datos,
                titulo=f"Reporte de {request.modulo.title()}",
                columnas=request.columnas
            )
            media_type = "application/pdf"
            nombre_archivo += ".pdf"
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
        raise HTTPException(status_code=500, detail=f"Error al generar reporte: {str(e)}")


@router.get("/estadisticas/{modulo}")
async def obtener_estadisticas_modulo(
    modulo: str,
    filtros: ReporteFiltros = Depends(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtiene estadísticas agregadas de un módulo"""
    try:
        estadisticas = ReporteService.obtener_estadisticas_modulo(
            db=db,
            modulo=modulo,
            empresa_id=current_user.empresa_id,
            filtros=filtros.model_dump(exclude_unset=True) if filtros else None
        )
        return estadisticas
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener estadísticas: {str(e)}")

