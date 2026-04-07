"""
Rutas para exportación de datos.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import Optional, List, Literal
from datetime import datetime

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.storage_schema import GeneratedFileAccessResponse
from app.services.generated_file_service import (
    ArchivoGeneradoService,
    build_generated_file_access_payload,
)
from app.services.export_service import ExportService
from app.services.reporte_service import ReporteService

router = APIRouter()


def _persist_export_response(
    *,
    db: Session,
    request: Request,
    current_user: User,
    modulo: str,
    formato: str,
    nombre_archivo: str,
    archivo_bytes: bytes,
    media_type: str,
    filtros: Optional[dict] = None,
    columnas: Optional[List[str]] = None,
) -> GeneratedFileAccessResponse:
    try:
        archivo_generado = ArchivoGeneradoService.persist_bytes(
            db,
            empresa_id=current_user.empresa_id,
            filename=nombre_archivo,
            data=archivo_bytes,
            content_type=media_type,
            tipo_origen="exportacion",
            formato=formato,
            generado_por=current_user.id,
            category="exportaciones",
            modulo=modulo,
            metadata_json={
                "modulo": modulo,
                "filtros": filtros or {},
                "columnas": columnas or [],
            },
        )
        return GeneratedFileAccessResponse(
            **build_generated_file_access_payload(archivo_generado, request)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo persistir la exportación generada: {exc}",
        ) from exc


@router.post("/exportar/{modulo}", response_model=GeneratedFileAccessResponse)
async def exportar_datos(
    request: Request,
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

        return _persist_export_response(
            db=db,
            request=request,
            current_user=current_user,
            modulo=modulo,
            formato=formato,
            nombre_archivo=nombre_archivo,
            archivo_bytes=archivo_bytes,
            media_type=media_type,
            filtros=filtros,
            columnas=columnas,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al exportar datos: {str(e)}")


@router.get("/exportar/{modulo}/excel")
async def exportar_excel(
    request: Request,
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
        request=request,
        modulo=modulo,
        formato="excel",
        columnas=columnas,
        filtros=filtros,
        current_user=current_user,
        db=db
    )


@router.get("/exportar/{modulo}/csv")
async def exportar_csv(
    request: Request,
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
        request=request,
        modulo=modulo,
        formato="csv",
        columnas=columnas,
        filtros=filtros,
        current_user=current_user,
        db=db
    )




