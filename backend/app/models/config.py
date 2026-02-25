"""
Modelos para configuración del sistema
"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, ForeignKey
from sqlalchemy.sql import func, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base import Base


class ConfiguracionSMTP(Base):
    """Configuración SMTP para envío de correos"""
    __tablename__ = "configuracion_smtp"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String(100), nullable=False)  # Nombre descriptivo de la configuración
    servidor = Column(String(255), nullable=False)
    puerto = Column(Integer, nullable=False, default=587)
    usuario = Column(String(255), nullable=False)
    password = Column(Text, nullable=False)  # Encriptado
    usar_tls = Column(Boolean, default=True)
    usar_ssl = Column(Boolean, default=False)
    remitente_nombre = Column(String(255))
    remitente_email = Column(String(255), nullable=False)
    activo = Column(Boolean, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
    actualizado_en = Column(DateTime(timezone=True), onupdate=func.now())
    creado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)

    empresa = relationship("Empresa", lazy="joined")
    creador = relationship("Usuario", foreign_keys=[creado_por], lazy="joined")


class PlantillaCorreo(Base):
    """Plantillas de correo electrónico"""
    __tablename__ = "plantillas_correo"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String(100), nullable=False)
    asunto = Column(String(255), nullable=False)
    cuerpo_html = Column(Text, nullable=False)
    cuerpo_texto = Column(Text)  # Versión texto plano opcional
    variables_disponibles = Column(JSONB)  # Lista de variables disponibles para la plantilla
    activo = Column(Boolean, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
    actualizado_en = Column(DateTime(timezone=True), onupdate=func.now())

    empresa = relationship("Empresa", lazy="joined")


class Auditoria(Base):
    """Log de auditoría de acciones del sistema"""
    __tablename__ = "auditoria"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="SET NULL"), nullable=True)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    accion = Column(String(100), nullable=False)  # CREATE, UPDATE, DELETE, LOGIN, etc.
    modulo = Column(String(100), nullable=False)  # usuarios, siniestros, etc.
    tabla = Column(String(100), nullable=False)  # Nombre de la tabla afectada
    registro_id = Column(UUID(as_uuid=True), nullable=True)  # ID del registro afectado
    datos_anteriores = Column(JSONB, nullable=True)  # Estado anterior del registro
    datos_nuevos = Column(JSONB, nullable=True)  # Estado nuevo del registro
    ip_address = Column(String(45))  # IPv4 o IPv6
    user_agent = Column(Text)
    descripcion = Column(Text)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    empresa = relationship("Empresa", lazy="joined")
    usuario = relationship("Usuario", lazy="joined")


class ConfiguracionReporte(Base):
    """Configuraciones guardadas de reportes"""
    __tablename__ = "configuracion_reportes"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String(100), nullable=False)
    modulo = Column(String(100), nullable=False)  # usuarios, siniestros, etc.
    filtros = Column(JSONB, nullable=True)  # Filtros guardados
    columnas = Column(JSONB, nullable=True)  # Columnas a mostrar
    ordenamiento = Column(JSONB, nullable=True)  # Ordenamiento guardado
    agrupaciones = Column(JSONB, nullable=True)  # Agrupaciones para reportes
    formato_exportacion = Column(String(20), default="excel")  # excel, csv, pdf
    programado = Column(Boolean, default=False)
    frecuencia = Column(String(20))  # diario, semanal, mensual
    hora_envio = Column(String(10))  # HH:MM formato
    destinatarios = Column(JSONB)  # Lista de emails para envío automático
    activo = Column(Boolean, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
    actualizado_en = Column(DateTime(timezone=True), onupdate=func.now())

    empresa = relationship("Empresa", lazy="joined")
    usuario = relationship("Usuario", lazy="joined")


class HistorialCorreo(Base):
    """Historial de correos enviados"""
    __tablename__ = "historial_correos"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    configuracion_smtp_id = Column(UUID(as_uuid=True), ForeignKey("configuracion_smtp.id", ondelete="SET NULL"), nullable=True)
    plantilla_id = Column(UUID(as_uuid=True), ForeignKey("plantillas_correo.id", ondelete="SET NULL"), nullable=True)
    destinatario = Column(String(255), nullable=False)
    asunto = Column(String(255), nullable=False)
    cuerpo_html = Column(Text)
    cuerpo_texto = Column(Text)
    estado = Column(String(20), nullable=False, default="enviado")  # enviado, fallido, pendiente
    error = Column(Text)  # Mensaje de error si falló
    enviado_en = Column(DateTime(timezone=True), server_default=func.now())
    leido_en = Column(DateTime(timezone=True), nullable=True)

    empresa = relationship("Empresa", lazy="joined")
    configuracion_smtp = relationship("ConfiguracionSMTP", lazy="joined")
    plantilla = relationship("PlantillaCorreo", lazy="joined")



