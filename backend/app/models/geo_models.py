"""Catálogo geográfico (país, estado federativo, municipio). Prefijo geo_ en tablas."""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func, text

from app.db.base import Base


class GeoPais(Base):
    __tablename__ = "geo_paises"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    codigo_iso = Column(String(3), nullable=False, unique=True)
    nombre = Column(String(150), nullable=False)
    activo = Column(Boolean, nullable=False, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    estados = relationship("GeoEstado", back_populates="pais", lazy="select")


class GeoEstado(Base):
    __tablename__ = "geo_estados"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    pais_id = Column(UUID(as_uuid=True), ForeignKey("geo_paises.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String(150), nullable=False)
    codigo_oficial = Column(String(10), nullable=True)
    activo = Column(Boolean, nullable=False, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    pais = relationship("GeoPais", back_populates="estados")
    municipios = relationship("GeoMunicipio", back_populates="estado", lazy="select")


class GeoMunicipio(Base):
    __tablename__ = "geo_municipios"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    estado_id = Column(UUID(as_uuid=True), ForeignKey("geo_estados.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String(200), nullable=False)
    activo = Column(Boolean, nullable=False, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    estado = relationship("GeoEstado", back_populates="municipios")
