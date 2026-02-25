"""
Modelos para sistema de backup y restore
"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, ForeignKey, Numeric
from sqlalchemy.sql import func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base


class Backup(Base):
    """Registro de backups realizados"""
    __tablename__ = "backups"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    nombre_archivo = Column(String(255), nullable=False)
    ruta_archivo = Column(Text, nullable=False)
    tamano_bytes = Column(Numeric(15, 2))  # Tamaño del archivo en bytes
    tipo = Column(String(20), nullable=False, default="completo")  # completo, incremental, solo_datos
    estado = Column(String(20), nullable=False, default="completado")  # completado, fallido, en_proceso
    error = Column(Text)  # Mensaje de error si falló
    creado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    programado = Column(Boolean, default=False)  # Si fue un backup programado o manual

    empresa = relationship("Empresa", lazy="joined")
    creador = relationship("Usuario", foreign_keys=[creado_por], lazy="joined")


class ConfiguracionBackup(Base):
    """Configuración de backups automáticos"""
    __tablename__ = "configuracion_backups"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    activo = Column(Boolean, default=True)
    frecuencia = Column(String(20), nullable=False)  # diario, semanal, mensual
    hora = Column(String(10), nullable=False)  # HH:MM formato
    dia_semana = Column(Integer)  # 0-6 (Lunes-Domingo) para backups semanales
    dia_mes = Column(Integer)  # 1-31 para backups mensuales
    tipo = Column(String(20), default="completo")  # completo, incremental
    retener_dias = Column(Integer, default=30)  # Días para retener backups
    ruta_destino = Column(Text)  # Ruta donde guardar backups
    notificar = Column(Boolean, default=True)
    email_notificacion = Column(String(255))
    ultimo_backup = Column(DateTime(timezone=True), nullable=True)
    proximo_backup = Column(DateTime(timezone=True), nullable=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
    actualizado_en = Column(DateTime(timezone=True), onupdate=func.now())

    empresa = relationship("Empresa", lazy="joined")




