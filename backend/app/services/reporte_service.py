"""
Servicio para generación de reportes
"""

from decimal import Decimal
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func, and_, or_
from datetime import datetime
from uuid import UUID
from app.models.user import User, Empresa, Rol
from app.models.legal import (
    Siniestro, Area, EstadoSiniestro, Entidad, Institucion, Autoridad, Proveniente,
    Asegurado, CalificacionSiniestro, SiniestroArea, SiniestroUsuario
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
        "calificaciones_siniestro": CalificacionSiniestro,
        "entidades": Entidad,
        "instituciones": Institucion,
        "autoridades": Autoridad,
        "provenientes": Proveniente,
        "asegurados": Asegurado,
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
        
        # Para siniestros, hacer joins con tablas relacionadas
        if modulo == "siniestros":
            query = db.query(Siniestro).options(selectinload(Siniestro.polizas))
        else:
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

        # Convertir a diccionarios con datos relacionados
        datos = []
        for registro in registros:
            registro_dict = ReporteService._modelo_a_dict_con_relaciones(
                db, registro, modulo, columnas
            )
            datos.append(registro_dict)

        return datos

    @staticmethod
    def _aplicar_filtros(query, Modelo, filtros: Dict[str, Any]):
        """Aplica filtros a una query"""
        if filtros.get("activo") is not None and hasattr(Modelo, "activo"):
            query = query.filter(Modelo.activo == filtros["activo"])

        # Manejar fechas (pueden venir como string o datetime)
        fecha_desde = filtros.get("fecha_desde")
        if fecha_desde:
            if isinstance(fecha_desde, str):
                try:
                    fecha_desde = datetime.fromisoformat(fecha_desde.replace('Z', '+00:00'))
                except ValueError:
                    try:
                        fecha_desde = datetime.strptime(fecha_desde, "%Y-%m-%d")
                    except ValueError:
                        pass
            if hasattr(Modelo, "creado_en"):
                query = query.filter(Modelo.creado_en >= fecha_desde)
            elif hasattr(Modelo, "fecha_registro"):
                query = query.filter(Modelo.fecha_registro >= fecha_desde)
            elif hasattr(Modelo, "fecha_siniestro"):
                query = query.filter(Modelo.fecha_siniestro >= fecha_desde)

        fecha_hasta = filtros.get("fecha_hasta")
        if fecha_hasta:
            if isinstance(fecha_hasta, str):
                try:
                    fecha_hasta = datetime.fromisoformat(fecha_hasta.replace('Z', '+00:00'))
                except ValueError:
                    try:
                        fecha_hasta = datetime.strptime(fecha_hasta, "%Y-%m-%d")
                        # Si es solo fecha, agregar tiempo al final del día
                        fecha_hasta = fecha_hasta.replace(hour=23, minute=59, second=59)
                    except ValueError:
                        pass
            if hasattr(Modelo, "creado_en"):
                query = query.filter(Modelo.creado_en <= fecha_hasta)
            elif hasattr(Modelo, "fecha_registro"):
                query = query.filter(Modelo.fecha_registro <= fecha_hasta)
            elif hasattr(Modelo, "fecha_siniestro"):
                query = query.filter(Modelo.fecha_siniestro <= fecha_hasta)

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
    def _modelo_a_dict_con_relaciones(
        db: Session,
        registro,
        modulo: str,
        columnas: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Convierte un modelo SQLAlchemy a diccionario incluyendo datos relacionados"""
        # Obtener datos base del modelo
        if columnas:
            resultado = {col: getattr(registro, col, None) for col in columnas if hasattr(registro, col)}
        else:
            resultado = {
                col.name: getattr(registro, col.name, None)
                for col in registro.__table__.columns
            }

        # Agregar datos relacionados según el módulo
        if modulo == "siniestros" and isinstance(registro, Siniestro):
            polizas = sorted(
                list(getattr(registro, "polizas", []) or []),
                key=lambda poliza: (
                    0 if getattr(poliza, "es_principal", False) else 1,
                    getattr(poliza, "orden", 0) or 0,
                    getattr(poliza, "creado_en", None),
                ),
            )
            poliza_principal = polizas[0] if polizas else None
            if columnas is None or any(
                col in (columnas or [])
                for col in (
                    "numero_poliza",
                    "deducible",
                    "reserva",
                    "coaseguro",
                    "suma_asegurada",
                    "polizas_numeros",
                    "polizas_cantidad",
                )
            ):
                resultado["numero_poliza"] = getattr(poliza_principal, "numero_poliza", None)
                resultado["deducible"] = getattr(poliza_principal, "deducible", Decimal("0.00")) if poliza_principal else Decimal("0.00")
                resultado["reserva"] = getattr(poliza_principal, "reserva", Decimal("0.00")) if poliza_principal else Decimal("0.00")
                resultado["coaseguro"] = getattr(poliza_principal, "coaseguro", Decimal("0.00")) if poliza_principal else Decimal("0.00")
                resultado["suma_asegurada"] = getattr(poliza_principal, "suma_asegurada", Decimal("0.00")) if poliza_principal else Decimal("0.00")
                resultado["polizas_numeros"] = ", ".join(
                    [poliza.numero_poliza for poliza in polizas if getattr(poliza, "numero_poliza", None)]
                )
                resultado["polizas_cantidad"] = len(polizas)

            # Asegurado
            if registro.asegurado_id:
                asegurado = db.query(Asegurado).filter(Asegurado.id == registro.asegurado_id).first()
                if asegurado:
                    resultado["asegurado_nombre"] = asegurado.nombre
                    resultado["asegurado_apellido_paterno"] = asegurado.apellido_paterno
                    resultado["asegurado_apellido_materno"] = asegurado.apellido_materno
                    resultado["asegurado_nombre_completo"] = f"{asegurado.nombre} {asegurado.apellido_paterno or ''} {asegurado.apellido_materno or ''}".strip()
                    resultado["asegurado_telefono"] = asegurado.telefono or asegurado.tel_oficina or asegurado.tel_casa
                    resultado["asegurado_ciudad"] = asegurado.ciudad
                    resultado["asegurado_estado"] = asegurado.estado
                    resultado["asegurado_empresa"] = asegurado.empresa

            # Estado del siniestro
            if registro.estado_id:
                estado = db.query(EstadoSiniestro).filter(EstadoSiniestro.id == registro.estado_id).first()
                if estado:
                    resultado["estado_nombre"] = estado.nombre
                    resultado["estado_color"] = estado.color

            # Calificación
            if registro.calificacion_id:
                calificacion = db.query(CalificacionSiniestro).filter(CalificacionSiniestro.id == registro.calificacion_id).first()
                if calificacion:
                    resultado["calificacion_nombre"] = calificacion.nombre
                    resultado["calificacion_color"] = calificacion.color

            # Usuario creador
            if registro.creado_por:
                usuario = db.query(User).filter(User.id == registro.creado_por).first()
                if usuario:
                    resultado["creado_por_nombre"] = usuario.full_name
                    resultado["creado_por_email"] = usuario.email

            # Institución
            if registro.institucion_id:
                institucion = db.query(Institucion).filter(Institucion.id == registro.institucion_id).first()
                if institucion:
                    resultado["institucion_nombre"] = institucion.nombre
                    resultado["institucion_codigo"] = institucion.codigo

            # Autoridad
            if registro.autoridad_id:
                autoridad = db.query(Institucion).filter(Institucion.id == registro.autoridad_id).first()
                if autoridad:
                    resultado["autoridad_nombre"] = autoridad.nombre
                    resultado["autoridad_codigo"] = autoridad.codigo

            # Proveniente
            if registro.proveniente_id:
                proveniente = db.query(Proveniente).filter(Proveniente.id == registro.proveniente_id).first()
                if proveniente:
                    resultado["proveniente_nombre"] = proveniente.nombre
                    resultado["proveniente_codigo"] = proveniente.codigo

            # Áreas (many-to-many)
            areas_relacionadas = db.query(Area).join(
                SiniestroArea, SiniestroArea.area_id == Area.id
            ).filter(
                SiniestroArea.siniestro_id == registro.id,
                SiniestroArea.activo == True
            ).all()
            if areas_relacionadas:
                resultado["areas_nombres"] = ", ".join([area.nombre for area in areas_relacionadas])
                resultado["areas_cantidad"] = len(areas_relacionadas)
                resultado["area_principal"] = areas_relacionadas[0].nombre if areas_relacionadas else None

            # Usuarios involucrados (many-to-many)
            usuarios_relacionados = db.query(User).join(
                SiniestroUsuario, SiniestroUsuario.usuario_id == User.id
            ).filter(
                SiniestroUsuario.siniestro_id == registro.id,
                SiniestroUsuario.activo == True
            ).all()
            if usuarios_relacionados:
                resultado["usuarios_involucrados"] = ", ".join([user.full_name for user in usuarios_relacionados])
                resultado["usuarios_cantidad"] = len(usuarios_relacionados)

        elif modulo == "usuarios" and isinstance(registro, User):
            # Rol
            if registro.rol_id:
                rol = db.query(Rol).filter(Rol.id == registro.rol_id).first()
                if rol:
                    resultado["rol_nombre"] = rol.nombre

            # Empresa
            if registro.empresa_id:
                empresa = db.query(Empresa).filter(Empresa.id == registro.empresa_id).first()
                if empresa:
                    resultado["empresa_nombre"] = empresa.nombre

        elif modulo == "areas" and isinstance(registro, Area):
            # No hay relaciones directas en este modelo
            pass

        elif modulo == "entidades" and isinstance(registro, Entidad):
            # No hay relaciones directas en este modelo
            pass

        elif modulo == "instituciones" and isinstance(registro, Institucion):
            # No hay relaciones directas en este modelo
            pass

        elif modulo == "autoridades" and isinstance(registro, Autoridad):
            # No hay relaciones directas en este modelo
            pass

        elif modulo == "provenientes" and isinstance(registro, Proveniente):
            # No hay relaciones directas en este modelo
            pass

        elif modulo == "asegurados" and isinstance(registro, Asegurado):
            # Construir nombre completo
            nombre_completo = f"{registro.nombre} {registro.apellido_paterno or ''} {registro.apellido_materno or ''}".strip()
            resultado["nombre_completo"] = nombre_completo
            # Teléfono preferido
            resultado["telefono_preferido"] = registro.telefono or registro.tel_oficina or registro.tel_casa

        elif modulo == "calificaciones_siniestro" and isinstance(registro, CalificacionSiniestro):
            # No hay relaciones directas en este modelo
            pass

        return resultado

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




