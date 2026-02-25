"""
Modelos de base de datos alineados con la nueva estructura normalizada
con UUIDs y tablas en español.
"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, ForeignKey
from sqlalchemy.sql import func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, synonym
from app.db.base import Base


class Empresa(Base):
    __tablename__ = "empresas"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    nombre = Column(String(150), nullable=False)
    alias = Column(String(100), unique=True)
    logo_url = Column(Text)
    color_principal = Column(String(20), default="#0A2E5C")
    color_secundario = Column(String(20), default="#F4F4F4")
    color_terciario = Column(String(20), default="#F4F4F4")
    dominio = Column(String(150))
    activo = Column(Boolean, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
    actualizado_en = Column(DateTime(timezone=True), onupdate=func.now())
    eliminado_en = Column(DateTime(timezone=True), nullable=True)
    
    # Aliases para compatibilidad (opcional, para uso futuro)
    created_at = synonym("creado_en")
    updated_at = synonym("actualizado_en")
    deleted_at = synonym("eliminado_en")
    is_active = synonym("activo")
    usuarios = relationship(
        "Usuario",
        secondary="usuario_empresas",
        back_populates="empresas",
        lazy="selectin",
    )


class Rol(Base):
    __tablename__ = "roles"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text)
    nivel = Column(Integer, default=3)
    activo = Column(Boolean, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
    actualizado_en = Column(DateTime(timezone=True), onupdate=func.now())
    eliminado_en = Column(DateTime(timezone=True), nullable=True)
    
    # Relaciones - usando string para evitar importación circular
    permisos = relationship(
        "RolPermiso",
        back_populates="rol",
        cascade="all, delete-orphan",
        lazy="select"
    )


class Usuario(Base):
    """Tabla principal de cuentas de usuario."""

    __tablename__ = "usuarios"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="SET NULL"), nullable=True)
    rol_id = Column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)
    correo = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    multiempresa = Column(Boolean, default=False)
    activo = Column(Boolean, default=True)
    eliminado = Column(Boolean, default=False)
    ultimo_acceso = Column(DateTime(timezone=True), nullable=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
    actualizado_en = Column(DateTime(timezone=True), onupdate=func.now())

    # Relaciones
    perfil = relationship("UsuarioPerfil", uselist=False, back_populates="usuario", cascade="all, delete-orphan")
    contactos = relationship("UsuarioContactos", uselist=False, back_populates="usuario", cascade="all, delete-orphan")
    direccion = relationship("UsuarioDireccion", uselist=False, back_populates="usuario", cascade="all, delete-orphan")
    dosfa = relationship("Usuario2FA", uselist=False, back_populates="usuario", cascade="all, delete-orphan")
    # Relaciones a tablas de catálogo (no alteran el esquema existente)
    empresa = relationship("Empresa", lazy="joined", foreign_keys=[empresa_id])
    rol = relationship("Rol", lazy="joined", foreign_keys=[rol_id])
    usuario_empresas = relationship(
        "UsuarioEmpresa",
        back_populates="usuario",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    empresas = relationship(
        "Empresa",
        secondary="usuario_empresas",
        back_populates="usuarios",
        lazy="selectin",
    )

    # Compatibilidad hacia el resto del código existente
    email = synonym("correo")
    username = synonym("correo")  # no hay username, usamos correo
    hashed_password = synonym("password_hash")
    is_active = synonym("activo")
    created_at = synonym("creado_en")
    updated_at = synonym("actualizado_en")

    @property
    def full_name(self) -> str:
        if self.perfil:
            nombres = [self.perfil.nombre, self.perfil.apellido_paterno, self.perfil.apellido_materno]
            return " ".join([p for p in nombres if p])
        return None

    @property
    def two_factor_enabled(self) -> bool:
        return bool(self.dosfa and self.dosfa.habilitado)

    @property
    def two_factor_secret(self) -> str | None:
        return self.dosfa.secreto if self.dosfa else None

    @property
    def two_factor_recovery_codes(self) -> str | None:
        return self.dosfa.codigos_recuperacion if self.dosfa else None

    @property
    def two_factor_verified_at(self):
        return self.dosfa.verificado_en if self.dosfa else None

    def __repr__(self):
        return f"<Usuario(id={self.id}, correo='{self.correo}')>"


class UsuarioPerfil(Base):
    __tablename__ = "usuario_perfiles"
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    foto_de_perfil = Column(Text, nullable=True)
    nombre = Column(String(150), nullable=False)
    apellido_paterno = Column(String(150), nullable=False)
    apellido_materno = Column(String(150), nullable=False)
    titulo = Column(String(50))
    cedula_profesional = Column(String(150))
    firma = Column(Text, nullable=True)  # Firma física/literal (imagen)
    firma_digital = Column(Text, nullable=True)  # Imagen que se envía por correo al mandar emails desde la plataforma
    usuario = relationship("Usuario", back_populates="perfil")


class UsuarioContactos(Base):
    __tablename__ = "usuario_contactos"
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    telefono = Column(String(150))
    celular = Column(String(150))
    usuario = relationship("Usuario", back_populates="contactos")


class UsuarioDireccion(Base):
    __tablename__ = "usuario_direcciones"
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    direccion = Column(String(150))
    ciudad = Column(String(150))
    estado = Column(String(150))
    codigo_postal = Column(String(150))
    pais = Column(String(150))
    usuario = relationship("Usuario", back_populates="direccion")


class Usuario2FA(Base):
    __tablename__ = "usuario_2fa"
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    habilitado = Column(Boolean, default=False)
    secreto = Column(String(150))
    codigos_recuperacion = Column(Text)
    verificado_en = Column(DateTime(timezone=True))
    usuario = relationship("Usuario", back_populates="dosfa")


class UsuarioEmpresa(Base):
    __tablename__ = "usuario_empresas"
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="CASCADE"), primary_key=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    usuario = relationship("Usuario", back_populates="usuario_empresas")
    empresa = relationship("Empresa")

# Alias para compatibilidad con imports existentes
User = Usuario

