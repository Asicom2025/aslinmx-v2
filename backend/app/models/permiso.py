"""
Modelos de Permisos
Define la estructura de permisos por módulos y acciones
"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base


class Modulo(Base):
    """Módulos del sistema (Dashboard, Siniestros, etc.)"""
    __tablename__ = "modulos"
    
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    nombre = Column(String(100), nullable=False, unique=True)
    descripcion = Column(Text)
    nombre_tecnico = Column(String(100), nullable=False, unique=True)
    icono = Column(String(100))
    ruta = Column(String(150))
    orden = Column(Integer, default=0)
    activo = Column(Boolean, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
    actualizado_en = Column(DateTime(timezone=True), onupdate=func.now())
    eliminado_en = Column(DateTime(timezone=True), nullable=True)
    
    # Relaciones
    permisos = relationship("RolPermiso", back_populates="modulo")


class Accion(Base):
    """Acciones disponibles (crear, leer, actualizar, eliminar, etc.)"""
    __tablename__ = "acciones"
    
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    nombre = Column(String(50), nullable=False, unique=True)
    descripcion = Column(Text)
    nombre_tecnico = Column(String(50), nullable=False, unique=True)
    activo = Column(Boolean, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relaciones
    permisos = relationship("RolPermiso", back_populates="accion")


class RolPermiso(Base):
    """Permisos asignados a roles por módulo y acción"""
    __tablename__ = "rol_permisos"
    
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    rol_id = Column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    modulo_id = Column(UUID(as_uuid=True), ForeignKey("modulos.id", ondelete="CASCADE"), nullable=False)
    accion_id = Column(UUID(as_uuid=True), ForeignKey("acciones.id", ondelete="CASCADE"), nullable=False)
    activo = Column(Boolean, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
    creado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    
    # Relaciones
    rol = relationship("Rol", back_populates="permisos")
    modulo = relationship("Modulo", back_populates="permisos")
    accion = relationship("Accion", back_populates="permisos")
    
    # Constraint único
    __table_args__ = (
        UniqueConstraint('rol_id', 'modulo_id', 'accion_id', name='uq_rol_permiso'),
    )

