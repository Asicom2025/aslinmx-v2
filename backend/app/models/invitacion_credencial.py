"""Registro de invitaciones con credencial cifrada (export CSV, no reversible desde password_hash)."""

from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class InvitacionCredencialAuditoria(Base):
    __tablename__ = "invitacion_credencial_auditoria"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="SET NULL"), nullable=True)
    invitado_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=False)
    correo_destino = Column(String(150), nullable=False)
    password_cifrado = Column(Text, nullable=False)
    ip_invitador = Column(String(64), nullable=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    usuario = relationship("Usuario", foreign_keys=[usuario_id], lazy="joined")
    invitado_por = relationship("Usuario", foreign_keys=[invitado_por_id], lazy="joined")
