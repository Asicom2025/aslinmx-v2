"""
Servicio para auditoría y logging de acciones.
Incluye sanitización central para payloads sensibles y helper contextual HTTP.
"""

from typing import Optional, Dict, Any
from decimal import Decimal
from sqlalchemy.orm import Session, joinedload, load_only, noload, selectinload
from sqlalchemy import desc
from app.models.config import Auditoria
from app.models.user import User
from datetime import datetime, date
from uuid import UUID
from fastapi import Request

from app.core.trace_context import get_trace_id


_SENSITIVE_KEY_FRAGMENTS: tuple[str, ...] = (
    "password",
    "pass",
    "pwd",
    "token",
    "secret",
    "authorization",
    "cookie",
    "set-cookie",
    "api_key",
    "apikey",
    "smtp",
    "hashed_password",
)


def _is_sensitive_key(key: str) -> bool:
    k = (key or "").strip().lower()
    return any(fragment in k for fragment in _SENSITIVE_KEY_FRAGMENTS)


def _mask_sensitive_payload(value: Any) -> Any:
    if isinstance(value, dict):
        out: Dict[str, Any] = {}
        for k, v in value.items():
            key = str(k)
            if _is_sensitive_key(key):
                out[key] = "[REDACTED]"
            else:
                out[key] = _mask_sensitive_payload(v)
        return out
    if isinstance(value, list):
        return [_mask_sensitive_payload(v) for v in value]
    if isinstance(value, tuple):
        return tuple(_mask_sensitive_payload(v) for v in value)
    if isinstance(value, set):
        return {_mask_sensitive_payload(v) for v in value}
    return value


def _sanitize_for_json(value: Any) -> Any:
    """
    Convierte valores a tipos compatibles con JSON/JSONB de PostgreSQL.
    Evita TypeError al persistir datetime, UUID, Decimal, etc.
    """
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    if isinstance(value, dict):
        return {str(k): _sanitize_for_json(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_sanitize_for_json(v) for v in value]
    if isinstance(value, set):
        return [_sanitize_for_json(v) for v in value]
    return str(value)


def _truncate_payload(value: Any, *, max_chars: int) -> Any:
    if value is None:
        return None
    text = str(value)
    if len(text) <= max_chars:
        return value
    return {
        "_truncated": True,
        "_preview": text[:max_chars],
        "_original_length": len(text),
    }


class AuditoriaService:
    """Servicio para registrar y consultar auditoría"""

    @staticmethod
    def sanitize_audit_payload(value: Any) -> Any:
        """Enmascara sensibles y convierte a tipos JSON-compatibles."""
        return _sanitize_for_json(_mask_sensitive_payload(value))

    @staticmethod
    def request_context(request: Optional[Request]) -> Dict[str, Any]:
        """
        Extrae contexto HTTP estándar para auditoría.
        Retorna valores vacíos si no existe request.
        """
        if not request:
            return {
                "ip_address": None,
                "user_agent": None,
                "route": None,
                "method": None,
                "trace_id": get_trace_id(),
            }
        route_path = None
        try:
            route = request.scope.get("route")
            route_path = getattr(route, "path", None) if route else None
        except Exception:
            route_path = None
        return {
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "route": route_path or str(request.url.path),
            "method": request.method,
            "trace_id": request.headers.get("x-trace-id") or get_trace_id(),
        }

    @staticmethod
    def registrar_accion(
        db: Session,
        usuario_id: Optional[UUID],
        empresa_id: Optional[UUID],
        accion: str,
        modulo: str,
        tabla: str,
        registro_id: Optional[UUID] = None,
        datos_anteriores: Optional[Dict[str, Any]] = None,
        datos_nuevos: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        descripcion: Optional[str] = None
    ) -> Auditoria:
        """
        Registra una acción en el log de auditoría
        """
        datos_anteriores_clean = (
            AuditoriaService.sanitize_audit_payload(datos_anteriores)
            if datos_anteriores is not None
            else None
        )
        datos_nuevos_clean = (
            AuditoriaService.sanitize_audit_payload(datos_nuevos)
            if datos_nuevos is not None
            else None
        )

        auditoria = Auditoria(
            usuario_id=usuario_id,
            empresa_id=empresa_id,
            accion=accion,
            modulo=modulo,
            tabla=tabla,
            registro_id=registro_id,
            datos_anteriores=datos_anteriores_clean,
            datos_nuevos=datos_nuevos_clean,
            ip_address=ip_address,
            user_agent=user_agent,
            descripcion=descripcion
        )
        db.add(auditoria)
        db.commit()
        db.refresh(auditoria)
        return auditoria

    @staticmethod
    def registrar_evento_http(
        db: Session,
        *,
        request: Optional[Request],
        user: Optional[User],
        accion: str,
        modulo: str,
        tabla: str,
        registro_id: Optional[UUID] = None,
        datos_anteriores: Optional[Dict[str, Any]] = None,
        datos_nuevos: Optional[Dict[str, Any]] = None,
        descripcion: Optional[str] = None,
        status: str = "success",
        error_code: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> Auditoria:
        """
        Registro homogéneo de auditoría usando contexto HTTP y metadatos de resultado.
        No agrega columnas nuevas: guarda metadatos en `_audit_meta`.
        """
        ctx = AuditoriaService.request_context(request)
        nuevos = dict(datos_nuevos or {})
        nuevos["_audit_meta"] = {
            "status": status,
            "error_code": error_code,
            "error_message": (error_message or "")[:2000] or None,
            "route": ctx.get("route"),
            "method": ctx.get("method"),
            "trace_id": ctx.get("trace_id"),
        }
        return AuditoriaService.registrar_accion(
            db=db,
            usuario_id=getattr(user, "id", None),
            empresa_id=getattr(user, "empresa_id", None),
            accion=accion,
            modulo=modulo,
            tabla=tabla,
            registro_id=registro_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=nuevos,
            ip_address=ctx.get("ip_address"),
            user_agent=ctx.get("user_agent"),
            descripcion=descripcion,
        )

    @staticmethod
    def obtener_auditoria(
        db: Session,
        empresa_id: Optional[UUID] = None,
        usuario_id: Optional[UUID] = None,
        accion: Optional[str] = None,
        modulo: Optional[str] = None,
        tabla: Optional[str] = None,
        fecha_desde: Optional[datetime] = None,
        fecha_hasta: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0,
        max_payload_chars: int = 12000,
        incluir_json_payloads: bool = False,
    ) -> list[Auditoria]:
        """
        Registros de auditoría con filtros.
        Por defecto **no** trae `datos_anteriores` / `datos_nuevos` (JSONB pesados) para
        evitar timeouts; usar `incluir_json_payloads=True` solo para un registro completo
        o escenarios puntuales.
        """
        query = db.query(Auditoria)

        if empresa_id:
            query = query.filter(Auditoria.empresa_id == empresa_id)
        if usuario_id:
            query = query.filter(Auditoria.usuario_id == usuario_id)
        if accion:
            query = query.filter(Auditoria.accion == accion)
        if modulo:
            query = query.filter(Auditoria.modulo == modulo)
        if tabla:
            query = query.filter(Auditoria.tabla == tabla)
        if fecha_desde:
            query = query.filter(Auditoria.creado_en >= fecha_desde)
        if fecha_hasta:
            query = query.filter(Auditoria.creado_en <= fecha_hasta)

        safe_limit = max(1, min(limit or 100, 1000))
        if not incluir_json_payloads:
            query = query.options(
                noload(Auditoria.empresa),
                load_only(
                    Auditoria.id,
                    Auditoria.empresa_id,
                    Auditoria.usuario_id,
                    Auditoria.accion,
                    Auditoria.modulo,
                    Auditoria.tabla,
                    Auditoria.registro_id,
                    Auditoria.ip_address,
                    Auditoria.user_agent,
                    Auditoria.descripcion,
                    Auditoria.creado_en,
                ),
                joinedload(Auditoria.usuario).load_only(User.id, User.correo),
            )
        else:
            query = query.options(joinedload(Auditoria.usuario))

        registros = (
            query.order_by(desc(Auditoria.creado_en))
            .offset(max(0, offset or 0))
            .limit(safe_limit)
            .all()
        )

        if incluir_json_payloads:
            payload_limit = max(500, min(max_payload_chars or 12000, 100000))
            for r in registros:
                if r.datos_anteriores is not None:
                    r.datos_anteriores = _truncate_payload(
                        r.datos_anteriores, max_chars=payload_limit
                    )
                if r.datos_nuevos is not None:
                    r.datos_nuevos = _truncate_payload(
                        r.datos_nuevos, max_chars=payload_limit
                    )

        return registros

    @staticmethod
    def obtener_auditoria_por_id(
        db: Session,
        auditoria_id: UUID,
        empresa_id: Optional[UUID],
        *,
        max_payload_chars: int = 200_000,
    ) -> Optional[Auditoria]:
        """Una fila con JSON completos (detalle) y usuario cargado para la respuesta."""
        q = (
            db.query(Auditoria)
            .filter(Auditoria.id == auditoria_id)
        )
        if empresa_id is not None:
            q = q.filter(Auditoria.empresa_id == empresa_id)
        r = q.options(
            noload(Auditoria.empresa),
            joinedload(Auditoria.usuario).options(selectinload(User.perfil)),
        ).first()
        if r is None:
            return None
        payload_limit = max(2000, min(max_payload_chars, 500_000))
        if r.datos_anteriores is not None:
            r.datos_anteriores = _truncate_payload(
                r.datos_anteriores, max_chars=payload_limit
            )
        if r.datos_nuevos is not None:
            r.datos_nuevos = _truncate_payload(
                r.datos_nuevos, max_chars=payload_limit
            )
        return r

    @staticmethod
    def obtener_historial_registro(
        db: Session,
        tabla: str,
        registro_id: UUID,
        empresa_id: Optional[UUID] = None
    ) -> list[Auditoria]:
        """
        Obtiene el historial completo de cambios de un registro específico
        """
        query = db.query(Auditoria).filter(
            Auditoria.tabla == tabla,
            Auditoria.registro_id == registro_id
        )

        if empresa_id:
            query = query.filter(Auditoria.empresa_id == empresa_id)

        return query.order_by(desc(Auditoria.creado_en)).all()




