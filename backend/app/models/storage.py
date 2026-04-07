"""
Modelos de metadata de storage para archivos persistidos y artefactos generados.
"""

from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func, text

from app.db.base import Base


class StorageObject(Base):
    """Metadata estable del archivo físico almacenado en local o R2."""

    __tablename__ = "storage_objects"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String(20), nullable=False)
    storage_path = Column(Text, nullable=False, unique=True)
    bucket_name = Column(String(255), nullable=True)
    object_key = Column(Text, nullable=True)
    local_path = Column(Text, nullable=True)
    original_filename = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=True)
    size_bytes = Column(BigInteger, nullable=True)
    etag = Column(String(255), nullable=True)
    sha256 = Column(String(64), nullable=True)
    metadata_json = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    creado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    activo = Column(Boolean, nullable=False, server_default=text("true"))
    eliminado = Column(Boolean, nullable=False, server_default=text("false"))
    creado_en = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    actualizado_en = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    eliminado_en = Column(DateTime(timezone=True), nullable=True)

    empresa = relationship("Empresa", lazy="joined")
    creador = relationship("Usuario", foreign_keys=[creado_por], lazy="joined")
    documentos = relationship("Documento", back_populates="storage_object", lazy="select")
    archivos_generados = relationship("ArchivoGenerado", back_populates="storage_object", lazy="select")


class ArchivoGenerado(Base):
    """Registro lógico de archivos generados por PDF, reportes o exportaciones."""

    __tablename__ = "archivos_generados"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    storage_object_id = Column(UUID(as_uuid=True), ForeignKey("storage_objects.id", ondelete="CASCADE"), nullable=False)
    tipo_origen = Column(String(50), nullable=False)
    modulo = Column(String(100), nullable=True)
    formato = Column(String(20), nullable=False)
    siniestro_id = Column(UUID(as_uuid=True), ForeignKey("siniestros.id", ondelete="SET NULL"), nullable=True)
    plantilla_documento_id = Column(UUID(as_uuid=True), ForeignKey("plantillas_documento.id", ondelete="SET NULL"), nullable=True)
    generado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    metadata_json = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    activo = Column(Boolean, nullable=False, server_default=text("true"))
    eliminado = Column(Boolean, nullable=False, server_default=text("false"))
    creado_en = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    actualizado_en = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    eliminado_en = Column(DateTime(timezone=True), nullable=True)

    empresa = relationship("Empresa", lazy="joined")
    storage_object = relationship("StorageObject", back_populates="archivos_generados", lazy="joined")
    siniestro = relationship("Siniestro", lazy="joined")
    plantilla_documento = relationship("PlantillaDocumento", lazy="joined")
    generador = relationship("Usuario", foreign_keys=[generado_por], lazy="joined")
