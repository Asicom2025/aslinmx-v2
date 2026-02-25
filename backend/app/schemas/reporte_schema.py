"""
Schemas para sistema de reportes
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from uuid import UUID


class ReporteFiltros(BaseModel):
    """Filtros genéricos para reportes"""
    fecha_desde: Optional[datetime] = None
    fecha_hasta: Optional[datetime] = None
    activo: Optional[bool] = None
    empresa_id: Optional[UUID] = None
    # Filtros adicionales específicos por módulo
    filtros_adicionales: Optional[Dict[str, Any]] = None


class ReporteRequest(BaseModel):
    modulo: str = Field(..., description="Módulo del reporte: usuarios, siniestros, entidades, etc.")
    filtros: Optional[ReporteFiltros] = None
    columnas: Optional[List[str]] = None  # Columnas específicas a incluir
    ordenamiento: Optional[Dict[str, Literal["asc", "desc"]]] = None
    agrupaciones: Optional[List[str]] = None
    formato: Literal["excel", "csv", "pdf"] = "excel"
    incluir_graficos: bool = False


class ReporteResponse(BaseModel):
    success: bool
    message: str
    archivo_base64: Optional[str] = None  # Para PDF/Excel/CSV en base64
    nombre_archivo: Optional[str] = None
    total_registros: Optional[int] = None
    datos: Optional[List[Dict[str, Any]]] = None  # Para respuestas JSON


class ReporteDisponible(BaseModel):
    modulo: str
    nombre: str
    descripcion: str
    columnas_disponibles: List[str]
    filtros_disponibles: List[str]
    agrupaciones_disponibles: Optional[List[str]] = None




