"""
Modelos para el sistema de flujos de trabajo configurables
"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, ForeignKey
from sqlalchemy.sql import func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class FlujoTrabajo(Base):
    """Flujos de trabajo por empresa y área"""
    __tablename__ = "flujos_trabajo"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    area_id = Column(UUID(as_uuid=True), ForeignKey("areas.id", ondelete="CASCADE"), nullable=True)  # NULL = flujo general
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text)
    activo = Column(Boolean, nullable=False, default=True)
    es_predeterminado = Column(Boolean, nullable=False, default=False)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    eliminado_en = Column(DateTime(timezone=True), nullable=True)

    # Relaciones
    etapas = relationship("EtapaFlujo", back_populates="flujo_trabajo", cascade="all, delete-orphan")


class EtapaFlujo(Base):
    """Etapas/procesos dentro de un flujo de trabajo"""
    __tablename__ = "etapas_flujo"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    flujo_trabajo_id = Column(UUID(as_uuid=True), ForeignKey("flujos_trabajo.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text)
    orden = Column(Integer, nullable=False)
    es_obligatoria = Column(Boolean, nullable=False, default=True)
    permite_omision = Column(Boolean, nullable=False, default=False)
    tipo_documento_principal_id = Column(UUID(as_uuid=True), ForeignKey("tipos_documento.id", ondelete="SET NULL"), nullable=True)
    categoria_documento_id = Column(UUID(as_uuid=True), ForeignKey("categorias_documento.id", ondelete="SET NULL"), nullable=True)
    plantilla_documento_id = Column(UUID(as_uuid=True), ForeignKey("plantillas_documento.id", ondelete="SET NULL"), nullable=True)
    inhabilita_siguiente = Column(Boolean, nullable=False, default=False)
    activo = Column(Boolean, nullable=False, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    eliminado_en = Column(DateTime(timezone=True), nullable=True)

    # Relaciones
    flujo_trabajo = relationship("FlujoTrabajo", back_populates="etapas")
    tipo_documento_principal = relationship("TipoDocumento", foreign_keys=[tipo_documento_principal_id], lazy="joined")
    categoria_documento = relationship("CategoriaDocumento", foreign_keys=[categoria_documento_id], lazy="joined")
    plantilla_documento = relationship("PlantillaDocumento", foreign_keys=[plantilla_documento_id], lazy="joined")


class SiniestroEtapa(Base):
    """Seguimiento de etapas por siniestro"""
    __tablename__ = "siniestro_etapas"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    siniestro_id = Column(UUID(as_uuid=True), ForeignKey("siniestros.id", ondelete="CASCADE"), nullable=False)
    etapa_flujo_id = Column(UUID(as_uuid=True), ForeignKey("etapas_flujo.id", ondelete="RESTRICT"), nullable=False)
    fecha_inicio = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    fecha_completada = Column(DateTime(timezone=True), nullable=True)
    fecha_vencimiento = Column(DateTime(timezone=True), nullable=True)
    estado = Column(String(20), nullable=False, default="pendiente")
    documento_principal_id = Column(UUID(as_uuid=True), ForeignKey("documentos.id", ondelete="SET NULL"), nullable=True)
    observaciones = Column(Text)
    completado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relaciones
    etapa_flujo = relationship("EtapaFlujo")
    documento_principal = relationship("Documento", foreign_keys=[documento_principal_id])

