"""
Modelos temporales de apoyo para migraciones legacy.
"""

from sqlalchemy import BigInteger, Boolean, Column, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class TmpSiniestroFile(Base):
    """Registros temporales importados desde la fuente legacy."""

    __tablename__ = "tmp_siniestros_files"

    id = Column(BigInteger, primary_key=True, nullable=False)
    timerst = Column(Text, nullable=True)
    nombre = Column(Text, nullable=True)
    url = Column(Text, nullable=True)
    fecha = Column(DateTime(timezone=True), nullable=True)
    version = Column(Text, nullable=True)
    area_id = Column(UUID(as_uuid=True), nullable=True)
    estatus = Column(Boolean, nullable=True, default=True)
    etapa = Column(Text, nullable=True)
    migrado = Column(Boolean, nullable=True, default=True)
