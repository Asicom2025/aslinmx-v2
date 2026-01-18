"""
Servicio para generación de reportes
"""

from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import datetime
from uuid import UUID
from app.models.user import User, Empresa, Rol
from app.models.legal import (
    Siniestro, Area, EstadoSiniestro, Entidad, Institucion, Autoridad, Proveniente
)
from app.services.export_service import ExportService
from app.services.pdf_service import PDFService


class ReporteService:
    """Servicio para generar reportes de diferentes módulos"""

    # Mapeo de módulos a modelos
    MODULOS_MODELOS = {
        "usuarios": User,
        "siniestros": Siniestro,
        "areas": Area,
        "estados_siniestro": EstadoSiniestro,
        "entidades": Entidad,
        "instituciones": Institucion,
        "autoridades": Autoridad,
        "provenientes": Proveniente,
        "empresas": Empresa,
        "roles": Rol,
    }

    @staticmethod
    def obtener_datos_reporte(
        db: Session,
        modulo: str,
        empresa_id: UUID,
        filtros: Optional[Dict[str, Any]] = None,
        columnas: Optional[List[str]] = None,
        ordenamiento: Optional[Dict[str, str]] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Obtiene datos para un reporte según el módulo y filtros
        
        Args:
            db: Sesión de base de datos
            modulo: Nombre del módulo
            empresa_id: ID de la empresa
            filtros: Diccionario con filtros a aplicar
            columnas: Lista de columnas a incluir
            ordenamiento: Dict con campo: "asc"|"desc"
            limit: Límite de registros
        """
        if modulo not in ReporteService.MODULOS_MODELOS:
            raise ValueError(f"Módulo '{modulo}' no soportado")

        Modelo = ReporteService.MODULOS_MODELOS[modulo]
        query = db.query(Modelo)

        # Filtrar por empresa si el modelo tiene empresa_id
        if hasattr(Modelo, 'empresa_id'):
            query = query.filter(Modelo.empresa_id == empresa_id)

        # Aplicar filtros
        if filtros:
            query = ReporteService._aplicar_filtros(query, Modelo, filtros)

        # Aplicar ordenamiento
        if ordenamiento:
            for campo, direccion in ordenamiento.items():
                if hasattr(Modelo, campo):
                    col = getattr(Modelo, campo)
                    if direccion.lower() == "desc":
                        query = query.order_by(col.desc())
                    else:
                        query = query.order_by(col.asc())

        # Aplicar límite
        if limit:
            query = query.limit(limit)

        registros = query.all()

        # Convertir a diccionarios
        datos = []
        for registro in registros:
            registro_dict = ReporteService._modelo_a_dict(registro, columnas)
            datos.append(registro_dict)

        return datos

    @staticmethod
    def _aplicar_filtros(query, Modelo, filtros: Dict[str, Any]):
        """Aplica filtros a una query"""
        if filtros.get("activo") is not None and hasattr(Modelo, "activo"):
            query = query.filter(Modelo.activo == filtros["activo"])

        if filtros.get("fecha_desde") and hasattr(Modelo, "creado_en"):
            query = query.filter(Modelo.creado_en >= filtros["fecha_desde"])

        if filtros.get("fecha_hasta") and hasattr(Modelo, "creado_en"):
            query = query.filter(Modelo.creado_en <= filtros["fecha_hasta"])

        # Filtros adicionales específicos por módulo
        filtros_adicionales = filtros.get("filtros_adicionales", {})
        for campo, valor in filtros_adicionales.items():
            if hasattr(Modelo, campo):
                col = getattr(Modelo, campo)
                if isinstance(valor, list):
                    query = query.filter(col.in_(valor))
                elif isinstance(valor, dict):
                    # Soporte para operadores: {"op": "like", "value": "texto"}
                    op = valor.get("op", "eq")
                    val = valor.get("value")
                    if op == "like" and val:
                        query = query.filter(col.like(f"%{val}%"))
                    elif op == "gte" and val:
                        query = query.filter(col >= val)
                    elif op == "lte" and val:
                        query = query.filter(col <= val)
                    else:
                        query = query.filter(col == val)
                else:
                    query = query.filter(col == valor)

        return query

    @staticmethod
    def _modelo_a_dict(registro, columnas: Optional[List[str]] = None) -> Dict[str, Any]:
        """Convierte un modelo SQLAlchemy a diccionario"""
        if columnas:
            # Solo incluir columnas solicitadas
            return {col: getattr(registro, col, None) for col in columnas if hasattr(registro, col)}
        else:
            # Incluir todas las columnas
            return {
                col.name: getattr(registro, col.name, None)
                for col in registro.__table__.columns
            }

    @staticmethod
    def generar_reporte_excel(
        datos: List[Dict[str, Any]],
        nombre_hoja: str = "Reporte",
        titulo: Optional[str] = None
    ) -> bytes:
        """Genera un archivo Excel con los datos"""
        return ExportService.export_to_excel(datos, nombre_hoja, titulo)

    @staticmethod
    def generar_reporte_csv(
        datos: List[Dict[str, Any]],
        columnas: Optional[List[str]] = None
    ) -> str:
        """Genera un archivo CSV con los datos"""
        return ExportService.export_to_csv(datos, columnas)

    @staticmethod
    def generar_reporte_pdf(
        datos: List[Dict[str, Any]],
        titulo: str = "Reporte",
        columnas: Optional[List[str]] = None
    ) -> bytes:
        """Genera un PDF con los datos en formato tabla"""
        # Crear HTML para la tabla
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    margin: 20px;
                }}
                h1 {{
                    color: #366092;
                    text-align: center;
                }}
                table {{
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }}
                th {{
                    background-color: #366092;
                    color: white;
                    padding: 10px;
                    text-align: left;
                    border: 1px solid #ddd;
                }}
                td {{
                    padding: 8px;
                    border: 1px solid #ddd;
                }}
                tr:nth-child(even) {{
                    background-color: #f2f2f2;
                }}
            </style>
        </head>
        <body>
            <h1>{titulo}</h1>
            <table>
                <thead>
                    <tr>
        """

        if datos:
            headers = columnas if columnas else list(datos[0].keys())
            for header in headers:
                html += f"<th>{str(header).replace('_', ' ').title()}</th>"

            html += """
                    </tr>
                </thead>
                <tbody>
            """

            for row in datos:
                html += "<tr>"
                for header in headers:
                    value = row.get(header, '')
                    if isinstance(value, bool):
                        value = "Sí" if value else "No"
                    elif value is None:
                        value = ""
                    html += f"<td>{str(value)}</td>"
                html += "</tr>"

            html += """
                </tbody>
            </table>
        </body>
        </html>
        """

        return PDFService.generate_pdf(html)

    @staticmethod
    def obtener_estadisticas_modulo(
        db: Session,
        modulo: str,
        empresa_id: UUID,
        filtros: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Obtiene estadísticas agregadas de un módulo"""
        if modulo not in ReporteService.MODULOS_MODELOS:
            raise ValueError(f"Módulo '{modulo}' no soportado")

        Modelo = ReporteService.MODULOS_MODELOS[modulo]
        query = db.query(Modelo)

        if hasattr(Modelo, 'empresa_id'):
            query = query.filter(Modelo.empresa_id == empresa_id)

        if filtros:
            query = ReporteService._aplicar_filtros(query, Modelo, filtros)

        total = query.count()

        estadisticas = {
            "total": total,
            "modulo": modulo
        }

        # Estadísticas adicionales según el módulo
        if modulo == "siniestros" and hasattr(Modelo, "estado_id"):
            # Contar por estado
            estados = db.query(
                EstadoSiniestro.nombre,
                func.count(Siniestro.id).label("cantidad")
            ).join(
                Siniestro, Siniestro.estado_id == EstadoSiniestro.id
            ).filter(
                Siniestro.empresa_id == empresa_id
            ).group_by(EstadoSiniestro.nombre).all()

            estadisticas["por_estado"] = [
                {"nombre": nombre, "cantidad": cantidad}
                for nombre, cantidad in estados
            ]

        return estadisticas




