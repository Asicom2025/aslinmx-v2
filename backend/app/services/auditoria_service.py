"""
Servicio para auditoría y logging de acciones
"""

from typing import Optional, Dict, Any
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.config import Auditoria
from app.models.user import User
from datetime import datetime, date
from uuid import UUID


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


class AuditoriaService:
    """Servicio para registrar y consultar auditoría"""

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
            _sanitize_for_json(datos_anteriores) if datos_anteriores is not None else None
        )
        datos_nuevos_clean = _sanitize_for_json(datos_nuevos) if datos_nuevos is not None else None

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
        offset: int = 0
    ) -> tuple[list[Auditoria], int]:
        """
        Obtiene registros de auditoría con filtros
        
        Returns:
            (registros, total)
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

        total = query.count()
        registros = query.order_by(desc(Auditoria.creado_en)).offset(offset).limit(limit).all()

        return registros, total

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




