"""
Rutas para generación de reportes
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import base64

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.schemas.reporte_schema import (
    ReporteRequest,
    ReporteResponse,
    ReporteDisponible,
    ReporteFiltros
)
from app.schemas.storage_schema import GeneratedFileAccessResponse
from app.services.generated_file_service import (
    ArchivoGeneradoService,
    build_generated_file_access_payload,
)
from app.services.reporte_service import ReporteService
router = APIRouter()


def _persist_report_response(
    *,
    db: Session,
    request: Request,
    current_user: User,
    request_payload: ReporteRequest,
    nombre_archivo: str,
    archivo_bytes: bytes,
    media_type: str,
) -> GeneratedFileAccessResponse:
    try:
        archivo_generado = ArchivoGeneradoService.persist_bytes(
            db,
            empresa_id=current_user.empresa_id,
            filename=nombre_archivo,
            data=archivo_bytes,
            content_type=media_type,
            tipo_origen="reporte",
            formato=request_payload.formato,
            generado_por=current_user.id,
            category="reportes",
            modulo=request_payload.modulo,
            metadata_json={
                "modulo": request_payload.modulo,
                "columnas": request_payload.columnas or [],
                "agrupaciones": request_payload.agrupaciones or [],
                "ordenamiento": request_payload.ordenamiento or {},
                "filtros": request_payload.filtros.model_dump(exclude_unset=True) if request_payload.filtros else {},
                "incluir_graficos": bool(request_payload.incluir_graficos),
            },
        )
        return GeneratedFileAccessResponse(
            **build_generated_file_access_payload(archivo_generado, request)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo persistir el reporte generado: {exc}",
        ) from exc


@router.get("/disponibles", response_model=List[ReporteDisponible])
async def listar_reportes_disponibles(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Lista todos los módulos disponibles para reportes"""
    reportes = [
        ReporteDisponible(
            modulo="siniestros",
            nombre="Reporte de Siniestros",
            descripcion="Exporta siniestros aplicando filtros de negocio",
            columnas_disponibles=[
                # Columnas básicas
                "id", "numero_siniestro", "fecha_siniestro", "fecha_registro", "fecha_reporte", "fecha_asignacion", "ubicacion",
                "numero_poliza", "deducible", "reserva", "coaseguro", "suma_asegurada",
                "polizas_numeros", "polizas_cantidad",
                "prioridad", "forma_contacto", "observaciones", "codigo", "numero_reporte",
                "activo", "eliminado", "creado_en", "actualizado_en",
                # Asegurado
                "asegurado_id", "asegurado_nombre", "asegurado_apellido_paterno", 
                "asegurado_apellido_materno", "asegurado_nombre_completo", "asegurado_telefono",
                "asegurado_ciudad", "asegurado_estado", "asegurado_empresa",
                # Estado y Calificación
                "estado_id", "estado_nombre", "estado_color",
                "calificacion_id", "calificacion_nombre", "calificacion_color",
                # Usuario creador
                "creado_por", "creado_por_nombre", "creado_por_email",
                # Instituciones y Autoridades
                "institucion_id", "institucion_nombre", "institucion_codigo",
                "autoridad_id", "autoridad_nombre", "autoridad_codigo",
                # Proveniente
                "proveniente_id", "proveniente_nombre", "proveniente_codigo",
                # Áreas y Usuarios (relaciones many-to-many)
                "areas_nombres", "areas_cantidad", "area_principal",
                "usuarios_involucrados", "usuarios_cantidad"
            ],
            filtros_disponibles=[
                "activo",
                "fecha_desde",
                "fecha_hasta",
                "entidad_federativa",
                "institucion_id",
                "autoridad_id",
                "area_id",
                "proveniente_id",
                "asegurado_id",
                "calificacion_id",
                "estado_id",
                "prioridad",
                "fecha_reporte_mes",
                "usuario_id",
            ],
            agrupaciones_disponibles=["estado_id", "prioridad", "calificacion_id", "asegurado_estado"]
        ),
    ]
    return reportes


@router.post("/generar", response_model=ReporteResponse)
async def generar_reporte(
    request: ReporteRequest,
    current_user: User = Depends(get_current_active_user),
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


@router.post("/generar/descargar", response_model=GeneratedFileAccessResponse)
async def descargar_reporte(
    http_request: Request,
    request: ReporteRequest,
    current_user: User = Depends(get_current_active_user),
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

        return _persist_report_response(
            db=db,
            request=http_request,
            current_user=current_user,
            request_payload=request,
            nombre_archivo=nombre_archivo,
            archivo_bytes=archivo_bytes,
            media_type=media_type,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar reporte: {str(e)}")


@router.get("/estadisticas/{modulo}")
async def obtener_estadisticas_modulo(
    modulo: str,
    filtros: ReporteFiltros = Depends(),
    current_user: User = Depends(get_current_active_user),
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

