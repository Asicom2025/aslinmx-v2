"""
Servicio para generación de reportes
"""

from decimal import Decimal
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session, selectinload, aliased
from sqlalchemy import func, and_, or_
from datetime import datetime
from uuid import UUID
from app.models.user import User, Empresa, Rol
from app.models.legal import (
    Siniestro, Area, EstadoSiniestro, Entidad, Institucion, Autoridad, Proveniente,
    Asegurado, CalificacionSiniestro, SiniestroArea, SiniestroUsuario
)
from app.models.geo_models import GeoEstado, GeoMunicipio
from app.services.export_service import ExportService
from app.services.pdf_service import PDFService
from app.services.storage_service import format_siniestro_id_legible
from app.services.legal_service import es_estado_cancelacion_por_nombre


logger = logging.getLogger(__name__)


def _debug_value(value: Any) -> Any:
    """Normaliza valores para logs legibles sin romper por tipos no JSON."""
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict):
        return {str(k): _debug_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_debug_value(v) for v in value]
    return value


def _debug_query_sql(query) -> str:
    """Intenta compilar la query con parámetros literales para depuración."""
    try:
        bind = query.session.get_bind()
        dialect = bind.dialect if bind is not None else None
        return str(
            query.statement.compile(
                dialect=dialect,
                compile_kwargs={"literal_binds": True},
            )
        )
    except Exception as exc:
        return f"<no se pudo compilar SQL: {exc}>"


def _debug_log_reporte(evento: str, **payload: Any) -> None:
    logger.warning("[REPORT_DEBUG] %s | %s", evento, _debug_value(payload))


def _normalize_uuid_list(val: Any) -> List[UUID]:
    """Convierte un UUID o lista de UUID (str/UUID) en lista de UUID; ignora inválidos."""
    if val is None:
        return []
    items = val if isinstance(val, (list, tuple)) else [val]
    out: List[UUID] = []
    for x in items:
        if x is None or (isinstance(x, str) and not x.strip()):
            continue
        try:
            out.append(x if isinstance(x, UUID) else UUID(str(x)))
        except (ValueError, TypeError):
            continue
    return out


def _int_or_text_sort_value(value: Any) -> tuple[int, Any]:
    raw = str(value or "").strip()
    digits = "".join(ch for ch in raw if ch.isdigit())
    if digits:
        return (0, int(digits))
    return (1, raw.lower())


def _year_sort_value(value: Any) -> tuple[int, Any]:
    if value is None:
        return (1, "")
    try:
        year = int(value)
        return (0, year % 100)
    except (TypeError, ValueError):
        return _int_or_text_sort_value(value)


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
        _debug_log_reporte(
            "obtener_datos_reporte:start",
            modulo=modulo,
            empresa_id=empresa_id,
            filtros=filtros,
            columnas=columnas,
            ordenamiento=ordenamiento,
            limit=limit,
        )

        if modulo not in ReporteService.MODULOS_MODELOS:
            _debug_log_reporte(
                "obtener_datos_reporte:modulo_no_soportado",
                modulo=modulo,
                modulos_soportados=list(ReporteService.MODULOS_MODELOS.keys()),
            )
            raise ValueError(f"Módulo '{modulo}' no soportado")

        Modelo = ReporteService.MODULOS_MODELOS[modulo]
        _debug_log_reporte(
            "obtener_datos_reporte:modelo_resuelto",
            modulo=modulo,
            modelo=Modelo.__name__,
        )
        
        # Para siniestros, hacer joins con tablas relacionadas
        if modulo == "siniestros":
            query = db.query(Siniestro).options(selectinload(Siniestro.polizas))
            _debug_log_reporte(
                "obtener_datos_reporte:query_base",
                tipo="siniestros_con_selectinload_polizas",
                sql=_debug_query_sql(query),
            )
        else:
            query = db.query(Modelo)
            _debug_log_reporte(
                "obtener_datos_reporte:query_base",
                tipo="modelo_directo",
                sql=_debug_query_sql(query),
            )

        # Filtrar por empresa si el modelo tiene empresa_id
        if hasattr(Modelo, 'empresa_id'):
            query = query.filter(Modelo.empresa_id == empresa_id)
            _debug_log_reporte(
                "obtener_datos_reporte:filtro_empresa",
                columna=f"{Modelo.__name__}.empresa_id",
                empresa_id=empresa_id,
                sql=_debug_query_sql(query),
            )
        else:
            _debug_log_reporte(
                "obtener_datos_reporte:filtro_empresa_omitido",
                motivo="el modelo no tiene empresa_id",
                modelo=Modelo.__name__,
            )

        # Aplicar filtros
        if filtros:
            _debug_log_reporte(
                "obtener_datos_reporte:aplicar_filtros:start",
                filtros=filtros,
            )
            query = ReporteService._aplicar_filtros(
                query, Modelo, filtros, modulo, db=db, empresa_id=empresa_id
            )
            _debug_log_reporte(
                "obtener_datos_reporte:aplicar_filtros:end",
                sql=_debug_query_sql(query),
            )
        elif modulo == "siniestros":
            query = query.filter(
                Siniestro.eliminado == False,  # noqa: E712
                Siniestro.activo == True,  # noqa: E712
            )
            _debug_log_reporte(
                "obtener_datos_reporte:filtros_default_siniestros",
                condiciones=[
                    "Siniestro.eliminado == False",
                    "Siniestro.activo == True",
                ],
                sql=_debug_query_sql(query),
            )
        else:
            _debug_log_reporte(
                "obtener_datos_reporte:sin_filtros_adicionales",
                modulo=modulo,
            )

        computed_ordering = []
        if ordenamiento:
            _debug_log_reporte(
                "obtener_datos_reporte:ordenamiento:start",
                ordenamiento=ordenamiento,
            )
            for campo, direccion in ordenamiento.items():
                if modulo == "siniestros" and campo in ("id_normalizado", "id_formato"):
                    computed_ordering.append((campo, direccion))
                    _debug_log_reporte(
                        "obtener_datos_reporte:ordenamiento_calculado",
                        campo=campo,
                        direccion=direccion,
                    )
                elif hasattr(Modelo, campo):
                    col = getattr(Modelo, campo)
                    if direccion.lower() == "desc":
                        query = query.order_by(col.desc())
                    else:
                        query = query.order_by(col.asc())
                    _debug_log_reporte(
                        "obtener_datos_reporte:ordenamiento_sql",
                        campo=campo,
                        direccion=direccion,
                        sql=_debug_query_sql(query),
                    )
                else:
                    _debug_log_reporte(
                        "obtener_datos_reporte:ordenamiento_omitido",
                        campo=campo,
                        direccion=direccion,
                        motivo="el modelo no tiene ese atributo",
                    )
        else:
            _debug_log_reporte("obtener_datos_reporte:sin_ordenamiento")

        # Aplicar límite en SQL solo cuando todo el ordenamiento también vive en SQL.
        if limit and not computed_ordering:
            query = query.limit(limit)
            _debug_log_reporte(
                "obtener_datos_reporte:limit_sql",
                limit=limit,
                sql=_debug_query_sql(query),
            )
        elif limit and computed_ordering:
            _debug_log_reporte(
                "obtener_datos_reporte:limit_pospuesto",
                limit=limit,
                motivo="hay ordenamiento calculado en Python",
                computed_ordering=computed_ordering,
            )

        _debug_log_reporte(
            "obtener_datos_reporte:query_final_antes_all",
            sql=_debug_query_sql(query),
        )
        registros = query.all()
        _debug_log_reporte(
            "obtener_datos_reporte:query_ejecutada",
            total_registros_sql=len(registros),
            ids_preview=[getattr(r, "id", None) for r in registros[:10]],
        )

        if computed_ordering:
            proveniente_ids = {
                r.proveniente_id for r in registros if getattr(r, "proveniente_id", None)
            }
            _debug_log_reporte(
                "obtener_datos_reporte:ordenamiento_calculado:start",
                computed_ordering=computed_ordering,
                total_registros=len(registros),
                proveniente_ids=proveniente_ids,
            )
            proveniente_codigo_por_id = {}
            if proveniente_ids:
                proveniente_codigo_por_id = {
                    row.id: (row.codigo or "").strip()
                    for row in db.query(Proveniente.id, Proveniente.codigo)
                    .filter(Proveniente.id.in_(proveniente_ids))
                    .all()
                }
            _debug_log_reporte(
                "obtener_datos_reporte:ordenamiento_calculado:provenientes",
                proveniente_codigo_por_id=proveniente_codigo_por_id,
            )

            def id_normalizado_sort_key(registro: Siniestro):
                codigo_proveniente = proveniente_codigo_por_id.get(
                    registro.proveniente_id, ""
                )
                return (
                    _int_or_text_sort_value(codigo_proveniente),
                    _int_or_text_sort_value(getattr(registro, "codigo", None)),
                    _year_sort_value(getattr(registro, "anualidad", None)),
                )

            for campo, direccion in reversed(list(ordenamiento.items())):
                if campo in ("id_normalizado", "id_formato"):
                    registros.sort(
                        key=id_normalizado_sort_key,
                        reverse=str(direccion).lower() == "desc",
                    )
                elif hasattr(Modelo, campo):
                    registros.sort(
                        key=lambda r, c=campo: (getattr(r, c, None) is None, getattr(r, c, None)),
                        reverse=str(direccion).lower() == "desc",
                    )
            if limit:
                registros = registros[:limit]
                _debug_log_reporte(
                    "obtener_datos_reporte:limit_python_aplicado",
                    limit=limit,
                    total_registros=len(registros),
                    ids_preview=[getattr(r, "id", None) for r in registros[:10]],
                )

        # Convertir a diccionarios con datos relacionados
        datos = []
        for idx, registro in enumerate(registros):
            if idx < 10:
                _debug_log_reporte(
                    "obtener_datos_reporte:convertir_registro:start",
                    index=idx,
                    registro_id=getattr(registro, "id", None),
                    modulo=modulo,
                )
            registro_dict = ReporteService._modelo_a_dict_con_relaciones(
                db, registro, modulo, columnas
            )
            if idx < 10:
                _debug_log_reporte(
                    "obtener_datos_reporte:convertir_registro:end",
                    index=idx,
                    registro_id=getattr(registro, "id", None),
                    columnas_resultado=list(registro_dict.keys()),
                    resultado_preview=registro_dict,
                )
            datos.append(registro_dict)

        _debug_log_reporte(
            "obtener_datos_reporte:end",
            total_datos=len(datos),
            columnas_primer_registro=list(datos[0].keys()) if datos else [],
            primer_registro=datos[0] if datos else None,
        )
        return datos

    @staticmethod
    def _aplicar_filtros(
        query,
        Modelo,
        filtros: Dict[str, Any],
        modulo: str,
        db: Optional[Session] = None,
        empresa_id: Optional[UUID] = None,
    ):
        """Aplica filtros a una query"""
        _debug_log_reporte(
            "_aplicar_filtros:start",
            modulo=modulo,
            modelo=Modelo.__name__,
            filtros=filtros,
            sql_inicial=_debug_query_sql(query),
        )
        if modulo == "siniestros":
            return ReporteService._aplicar_filtros_siniestros(
                query, filtros, db, empresa_id
            )

        if filtros.get("activo") is not None and hasattr(Modelo, "activo"):
            query = query.filter(Modelo.activo == filtros["activo"])
            _debug_log_reporte(
                "_aplicar_filtros:activo",
                valor=filtros["activo"],
                sql=_debug_query_sql(query),
            )

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
                campo_fecha = "creado_en"
            elif hasattr(Modelo, "fecha_registro"):
                query = query.filter(Modelo.fecha_registro >= fecha_desde)
                campo_fecha = "fecha_registro"
            elif hasattr(Modelo, "fecha_siniestro"):
                query = query.filter(Modelo.fecha_siniestro >= fecha_desde)
                campo_fecha = "fecha_siniestro"
            else:
                campo_fecha = None
            _debug_log_reporte(
                "_aplicar_filtros:fecha_desde",
                valor=fecha_desde,
                campo=campo_fecha,
                sql=_debug_query_sql(query),
            )

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
                campo_fecha = "creado_en"
            elif hasattr(Modelo, "fecha_registro"):
                query = query.filter(Modelo.fecha_registro <= fecha_hasta)
                campo_fecha = "fecha_registro"
            elif hasattr(Modelo, "fecha_siniestro"):
                query = query.filter(Modelo.fecha_siniestro <= fecha_hasta)
                campo_fecha = "fecha_siniestro"
            else:
                campo_fecha = None
            _debug_log_reporte(
                "_aplicar_filtros:fecha_hasta",
                valor=fecha_hasta,
                campo=campo_fecha,
                sql=_debug_query_sql(query),
            )

        # Filtros adicionales específicos por módulo
        filtros_adicionales = filtros.get("filtros_adicionales", {})
        for campo, valor in filtros_adicionales.items():
            if hasattr(Modelo, campo):
                col = getattr(Modelo, campo)
                if isinstance(valor, list):
                    query = query.filter(col.in_(valor))
                    operador = "in"
                elif isinstance(valor, dict):
                    # Soporte para operadores: {"op": "like", "value": "texto"}
                    op = valor.get("op", "eq")
                    val = valor.get("value")
                    if op == "like" and val:
                        query = query.filter(col.like(f"%{val}%"))
                        operador = "like"
                    elif op == "gte" and val:
                        query = query.filter(col >= val)
                        operador = "gte"
                    elif op == "lte" and val:
                        query = query.filter(col <= val)
                        operador = "lte"
                    else:
                        query = query.filter(col == val)
                        operador = "eq"
                else:
                    query = query.filter(col == valor)
                    operador = "eq"
                _debug_log_reporte(
                    "_aplicar_filtros:filtro_adicional",
                    campo=campo,
                    valor=valor,
                    operador=operador,
                    sql=_debug_query_sql(query),
                )
            else:
                _debug_log_reporte(
                    "_aplicar_filtros:filtro_adicional_omitido",
                    campo=campo,
                    valor=valor,
                    motivo="el modelo no tiene ese atributo",
                )

        _debug_log_reporte("_aplicar_filtros:end", sql=_debug_query_sql(query))
        return query

    @staticmethod
    def _aplicar_filtros_siniestros(
        query,
        filtros: Dict[str, Any],
        db: Optional[Session] = None,
        empresa_id: Optional[UUID] = None,
    ):
        """Aplica filtros de negocio para exportar siniestros."""
        _debug_log_reporte(
            "_aplicar_filtros_siniestros:start",
            filtros=filtros,
            empresa_id=empresa_id,
            sql_inicial=_debug_query_sql(query),
        )
        if filtros.get("activo") is not None:
            query = query.filter(Siniestro.activo == filtros["activo"])
            _debug_log_reporte(
                "_aplicar_filtros_siniestros:activo",
                valor=filtros["activo"],
                sql=_debug_query_sql(query),
            )

        fecha_desde = filtros.get("fecha_desde")
        if fecha_desde:
            if isinstance(fecha_desde, str):
                try:
                    fecha_desde = datetime.fromisoformat(fecha_desde.replace("Z", "+00:00"))
                except ValueError:
                    try:
                        fecha_desde = datetime.strptime(fecha_desde, "%Y-%m-%d")
                    except ValueError:
                        fecha_desde = None
            if fecha_desde:
                query = query.filter(Siniestro.creado_en >= fecha_desde)
                _debug_log_reporte(
                    "_aplicar_filtros_siniestros:fecha_desde",
                    valor=fecha_desde,
                    campo="Siniestro.creado_en",
                    sql=_debug_query_sql(query),
                )

        fecha_hasta = filtros.get("fecha_hasta")
        if fecha_hasta:
            if isinstance(fecha_hasta, str):
                try:
                    fecha_hasta = datetime.fromisoformat(fecha_hasta.replace("Z", "+00:00"))
                except ValueError:
                    try:
                        fecha_hasta = datetime.strptime(fecha_hasta, "%Y-%m-%d")
                        fecha_hasta = fecha_hasta.replace(hour=23, minute=59, second=59)
                    except ValueError:
                        fecha_hasta = None
            if fecha_hasta:
                query = query.filter(Siniestro.creado_en <= fecha_hasta)
                _debug_log_reporte(
                    "_aplicar_filtros_siniestros:fecha_hasta",
                    valor=fecha_hasta,
                    campo="Siniestro.creado_en",
                    sql=_debug_query_sql(query),
                )

        adicionales = filtros.get("filtros_adicionales", {}) or {}
        _debug_log_reporte(
            "_aplicar_filtros_siniestros:adicionales",
            adicionales=adicionales,
        )

        ids_inst = _normalize_uuid_list(adicionales.get("institucion_id"))
        if ids_inst:
            query = query.filter(Siniestro.institucion_id.in_(ids_inst))
            _debug_log_reporte("_aplicar_filtros_siniestros:institucion_id", ids=ids_inst, sql=_debug_query_sql(query))
        ids_aut = _normalize_uuid_list(adicionales.get("autoridad_id"))
        if ids_aut:
            query = query.filter(Siniestro.autoridad_id.in_(ids_aut))
            _debug_log_reporte("_aplicar_filtros_siniestros:autoridad_id", ids=ids_aut, sql=_debug_query_sql(query))
        ids_prov = _normalize_uuid_list(adicionales.get("proveniente_id"))
        if ids_prov:
            query = query.filter(Siniestro.proveniente_id.in_(ids_prov))
            _debug_log_reporte("_aplicar_filtros_siniestros:proveniente_id", ids=ids_prov, sql=_debug_query_sql(query))
        ids_aseg = _normalize_uuid_list(adicionales.get("asegurado_id"))
        if ids_aseg:
            query = query.filter(Siniestro.asegurado_id.in_(ids_aseg))
            _debug_log_reporte("_aplicar_filtros_siniestros:asegurado_id", ids=ids_aseg, sql=_debug_query_sql(query))
        ids_cal = _normalize_uuid_list(adicionales.get("calificacion_id"))
        if ids_cal:
            query = query.filter(Siniestro.calificacion_id.in_(ids_cal))
            _debug_log_reporte("_aplicar_filtros_siniestros:calificacion_id", ids=ids_cal, sql=_debug_query_sql(query))
        ids_est = _normalize_uuid_list(adicionales.get("estado_id"))
        if ids_est:
            query = query.filter(Siniestro.estado_id.in_(ids_est))
            _debug_log_reporte("_aplicar_filtros_siniestros:estado_id", ids=ids_est, sql=_debug_query_sql(query))

        pr = adicionales.get("prioridad")
        if pr:
            if isinstance(pr, (list, tuple)):
                vals = [str(x).strip() for x in pr if str(x).strip()]
                if vals:
                    query = query.filter(Siniestro.prioridad.in_(vals))
                    _debug_log_reporte("_aplicar_filtros_siniestros:prioridad_in", valores=vals, sql=_debug_query_sql(query))
            else:
                query = query.filter(Siniestro.prioridad == str(pr).strip())
                _debug_log_reporte("_aplicar_filtros_siniestros:prioridad_eq", valor=str(pr).strip(), sql=_debug_query_sql(query))

        ids_area = _normalize_uuid_list(adicionales.get("area_id"))
        if ids_area:
            query = query.join(
                SiniestroArea,
                and_(
                    SiniestroArea.siniestro_id == Siniestro.id,
                    SiniestroArea.activo == True,
                    SiniestroArea.eliminado == False,
                ),
            ).filter(SiniestroArea.area_id.in_(ids_area))
            _debug_log_reporte("_aplicar_filtros_siniestros:area_id", ids=ids_area, sql=_debug_query_sql(query))

        ids_user = _normalize_uuid_list(adicionales.get("usuario_id"))
        if ids_user:
            query = query.outerjoin(
                SiniestroUsuario,
                and_(
                    SiniestroUsuario.siniestro_id == Siniestro.id,
                    SiniestroUsuario.activo == True,
                    SiniestroUsuario.eliminado == False,
                ),
            ).filter(
                or_(
                    Siniestro.creado_por.in_(ids_user),
                    SiniestroUsuario.usuario_id.in_(ids_user),
                )
            )
            _debug_log_reporte("_aplicar_filtros_siniestros:usuario_id", ids=ids_user, sql=_debug_query_sql(query))

        ids_geo_est = _normalize_uuid_list(adicionales.get("geo_estado_id"))
        if ids_geo_est:
            GeoMun = aliased(GeoMunicipio)
            query = query.join(Asegurado, Asegurado.id == Siniestro.asegurado_id)
            query = query.outerjoin(GeoMun, GeoMun.id == Asegurado.municipio_id)
            query = query.filter(
                or_(
                    Asegurado.estado_geografico_id.in_(ids_geo_est),
                    GeoMun.estado_id.in_(ids_geo_est),
                )
            )
            _debug_log_reporte("_aplicar_filtros_siniestros:geo_estado_id", ids=ids_geo_est, sql=_debug_query_sql(query))

        if adicionales.get("fecha_reporte_mes"):
            mes = str(adicionales["fecha_reporte_mes"]).strip()
            try:
                year_str, month_str = mes.split("-")
                year = int(year_str)
                month = int(month_str)
                if 1 <= month <= 12:
                    query = query.filter(
                        func.extract("year", Siniestro.fecha_reporte) == year,
                        func.extract("month", Siniestro.fecha_reporte) == month,
                    )
                    _debug_log_reporte(
                        "_aplicar_filtros_siniestros:fecha_reporte_mes",
                        valor=mes,
                        year=year,
                        month=month,
                        sql=_debug_query_sql(query),
                    )
            except Exception:
                _debug_log_reporte(
                    "_aplicar_filtros_siniestros:fecha_reporte_mes_invalida",
                    valor=mes,
                )

        adicionales_f = filtros.get("filtros_adicionales", {}) or {}
        estado_f = adicionales_f.get("estado_id")
        relajar_activo = False
        estado_ids_relaj = _normalize_uuid_list(estado_f)
        if db is not None and empresa_id is not None and estado_ids_relaj:
            for eid in estado_ids_relaj:
                row_e = (
                    db.query(EstadoSiniestro)
                    .filter(
                        EstadoSiniestro.id == eid,
                        EstadoSiniestro.empresa_id == empresa_id,
                    )
                    .first()
                )
                if row_e and es_estado_cancelacion_por_nombre(
                    getattr(row_e, "nombre", None)
                ):
                    relajar_activo = True
                    break
        _debug_log_reporte(
            "_aplicar_filtros_siniestros:relajar_activo",
            estado_ids=estado_ids_relaj,
            relajar_activo=relajar_activo,
        )

        query = query.filter(Siniestro.eliminado == False)  # noqa: E712
        _debug_log_reporte(
            "_aplicar_filtros_siniestros:eliminado_false",
            sql=_debug_query_sql(query),
        )
        if filtros.get("activo") is None and not relajar_activo:
            query = query.filter(Siniestro.activo == True)  # noqa: E712
            _debug_log_reporte(
                "_aplicar_filtros_siniestros:activo_default_true",
                sql=_debug_query_sql(query),
            )
        else:
            _debug_log_reporte(
                "_aplicar_filtros_siniestros:activo_default_omitido",
                activo_en_filtros=filtros.get("activo"),
                relajar_activo=relajar_activo,
            )

        query = query.distinct()
        _debug_log_reporte("_aplicar_filtros_siniestros:end", sql=_debug_query_sql(query))
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
            if columnas is None or any(col in (columnas or []) for col in ("id_normalizado", "id_formato")):
                codigo_proveniente = ""
                if registro.proveniente_id:
                    proveniente = (
                        db.query(Proveniente)
                        .filter(Proveniente.id == registro.proveniente_id)
                        .first()
                    )
                    if proveniente:
                        codigo_proveniente = (proveniente.codigo or "").strip()
                id_normalizado = format_siniestro_id_legible(
                    codigo_proveniente,
                    (registro.codigo or "").strip(),
                    anualidad_column=getattr(registro, "anualidad", None),
                    fecha_registro=getattr(registro, "fecha_registro", None),
                    fecha_siniestro=getattr(registro, "fecha_siniestro", None),
                )
                if columnas is None or "id_normalizado" in (columnas or []):
                    resultado["id_normalizado"] = id_normalizado
                if "id_formato" in (columnas or []):
                    resultado["id_formato"] = id_normalizado

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
                    resultado["asegurado_empresa"] = asegurado.empresa
                    geo_est = (
                        db.query(GeoEstado)
                        .filter(GeoEstado.id == asegurado.estado_geografico_id)
                        .first()
                        if asegurado.estado_geografico_id
                        else None
                    )
                    geo_mun = (
                        db.query(GeoMunicipio)
                        .filter(GeoMunicipio.id == asegurado.municipio_id)
                        .first()
                        if asegurado.municipio_id
                        else None
                    )
                    resultado["asegurado_ciudad"] = geo_mun.nombre if geo_mun else None
                    geo_est_via_mun = None
                    if geo_mun and geo_mun.estado_id:
                        geo_est_via_mun = (
                            db.query(GeoEstado)
                            .filter(GeoEstado.id == geo_mun.estado_id)
                            .first()
                        )
                    if geo_est:
                        resultado["asegurado_estado"] = geo_est.nombre
                    elif geo_est_via_mun:
                        resultado["asegurado_estado"] = geo_est_via_mun.nombre
                    else:
                        resultado["asegurado_estado"] = None
                    _cols_geo = columnas is None or any(
                        c in (columnas or [])
                        for c in (
                            "asegurado_estado_catalogo",
                            "asegurado_municipio_catalogo",
                            "asegurado_geo_estado_id",
                            "asegurado_geo_municipio_id",
                        )
                    )
                    if _cols_geo:
                        estado_cat = (
                            geo_est.nombre
                            if geo_est
                            else (geo_est_via_mun.nombre if geo_est_via_mun else None)
                        )
                        resultado["asegurado_estado_catalogo"] = estado_cat
                        resultado["asegurado_municipio_catalogo"] = (
                            geo_mun.nombre if geo_mun else None
                        )
                        resultado["asegurado_geo_estado_id"] = (
                            str(asegurado.estado_geografico_id)
                            if asegurado.estado_geografico_id
                            else None
                        )
                        resultado["asegurado_geo_municipio_id"] = (
                            str(asegurado.municipio_id) if asegurado.municipio_id else None
                        )

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
                autoridad = db.query(Autoridad).filter(Autoridad.id == registro.autoridad_id).first()
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
                SiniestroArea.activo == True,
                SiniestroArea.eliminado == False,
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
                SiniestroUsuario.activo == True,
                SiniestroUsuario.eliminado == False,
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
        titulo: Optional[str] = None,
        columnas: Optional[List[str]] = None,
    ) -> bytes:
        """Genera un archivo Excel con los datos"""
        return ExportService.export_to_excel(datos, nombre_hoja, titulo, columnas=columnas)

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
            query = ReporteService._aplicar_filtros(
                query, Modelo, filtros, modulo, db=db, empresa_id=empresa_id
            )
        elif modulo == "siniestros":
            query = query.filter(
                Siniestro.eliminado == False,  # noqa: E712
                Siniestro.activo == True,  # noqa: E712
            )

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
                Siniestro.empresa_id == empresa_id,
                Siniestro.eliminado == False,  # noqa: E712
                Siniestro.activo == True,  # noqa: E712
            ).group_by(EstadoSiniestro.nombre).all()

            estadisticas["por_estado"] = [
                {"nombre": nombre, "cantidad": cantidad}
                for nombre, cantidad in estados
            ]

        return estadisticas




