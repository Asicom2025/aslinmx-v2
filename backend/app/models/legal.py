"""
Modelos para el sistema legal de siniestros
"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, ForeignKey, Numeric, Date, CheckConstraint
from sqlalchemy.sql import func, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.base import Base


class Area(Base):
    """Áreas organizacionales. usuario_id = jefe de área."""
    __tablename__ = "areas"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)  # Jefe de área
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text)
    codigo = Column(String(20))
    activo = Column(Boolean, nullable=False, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    eliminado_en = Column(DateTime(timezone=True), nullable=True)

    jefe = relationship("Usuario", foreign_keys=[usuario_id], lazy="select", back_populates="areas_como_jefe")
    usuarios = relationship("Usuario", secondary="usuario_areas", back_populates="areas", lazy="select")
    usuario_areas = relationship("UsuarioArea", back_populates="area", cascade="all, delete-orphan", lazy="select")


class EstadoSiniestro(Base):
    """Estados configurables de siniestros"""
    __tablename__ = "estados_siniestro"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String(50), nullable=False)
    descripcion = Column(Text)
    color = Column(String(7), default="#007bff")
    orden = Column(Integer, default=0)
    activo = Column(Boolean, nullable=False, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    eliminado_en = Column(DateTime(timezone=True), nullable=True)


class CalificacionSiniestro(Base):
    """Calificaciones de siniestros"""
    __tablename__ = "calificaciones_siniestro"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String(50), nullable=False)
    descripcion = Column(Text)
    color = Column(String(7), default="#475569")
    orden = Column(Integer, default=0)
    activo = Column(Boolean, nullable=False, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    eliminado_en = Column(DateTime(timezone=True), nullable=True)


class Entidad(Base):
    """Entidades unificadas (pueden ser institución, autoridad, órgano o múltiples roles)"""
    __tablename__ = "entidades"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String(200), nullable=False)
    codigo = Column(String(50))
    email = Column(String(100))
    telefono = Column(String(20))
    direccion = Column(Text)
    contacto_principal = Column(String(200))  # Nombre del contacto principal
    observaciones = Column(Text)
    
    # Flags de roles (una entidad puede tener múltiples roles)
    es_institucion = Column(Boolean, nullable=False, default=False)
    es_autoridad = Column(Boolean, nullable=False, default=False)
    es_organo = Column(Boolean, nullable=False, default=False)
    
    activo = Column(Boolean, nullable=False, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    eliminado_en = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "(es_institucion = TRUE OR es_autoridad = TRUE OR es_organo = TRUE)",
            name="check_entidad_al_menos_un_rol"
        ),
    )


class Institucion(Base):
    """Instituciones externas"""
    __tablename__ = "instituciones"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String(200), nullable=False)
    codigo = Column(String(50))
    email = Column(String(100))
    activo = Column(Boolean, nullable=False, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    eliminado_en = Column(DateTime(timezone=True), nullable=True)


class Autoridad(Base):
    """Autoridades externas"""
    __tablename__ = "autoridades"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String(200), nullable=False)
    codigo = Column(String(50))
    email = Column(String(100))
    activo = Column(Boolean, nullable=False, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    eliminado_en = Column(DateTime(timezone=True), nullable=True)


class Asegurado(Base):
    """Asegurados (personas/entidades aseguradas)

    Mapeo de la tabla public.asegurados en PostgreSQL:
    - id uuid PK
    - nombre, apellido_paterno, apellido_materno
    - telefono, tel_oficina, tel_casa
    - ciudad, estado, empresa
    - correo (contacto; no único)
    - timerst_list (identificador externo TimerST; único entre registros activos — ver migración en db/)
    """
    __tablename__ = "asegurados"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    nombre = Column(String(100), nullable=False)
    apellido_paterno = Column(String(150))
    apellido_materno = Column(String(150))
    telefono = Column(String(20))
    activo = Column(Boolean, nullable=False, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    tel_oficina = Column(String(20))
    tel_casa = Column(String(20))
    ciudad = Column(String(100))
    estado = Column(String(100))
    empresa = Column(String(50))
    correo = Column(String(100), nullable=True)
    timerst_list = Column(String(100), nullable=False)
    eliminado_en = Column(DateTime(timezone=True), nullable=True)


class Proveniente(Base):
    """Provenientes (personas/entidades que reportan siniestros)"""
    __tablename__ = "provenientes"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String(200), nullable=False)
    codigo = Column(String(50))
    telefono = Column(String(20))
    email = Column(String(100))
    direccion = Column(Text)
    contacto_principal = Column(String(100))
    observaciones = Column(Text)
    activo = Column(Boolean, nullable=False, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    eliminado_en = Column(DateTime(timezone=True), nullable=True)
    contactos = relationship(
        "ProvenienteContacto",
        back_populates="proveniente",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class ProvenienteContacto(Base):
    """Contactos de correo asociados a un proveniente."""
    __tablename__ = "proveniente_contactos"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    proveniente_id = Column(UUID(as_uuid=True), ForeignKey("provenientes.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String(200), nullable=False)
    correo = Column(String(255), nullable=False)
    activo = Column(Boolean, nullable=False, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    eliminado_en = Column(DateTime(timezone=True), nullable=True)

    proveniente = relationship("Proveniente", back_populates="contactos")


class TipoDocumento(Base):
    """Tipos de documentos configurables"""
    __tablename__ = "tipos_documento"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text)
    plantilla = Column(Text)  # Contenido de la plantilla
    campos_obligatorios = Column(JSONB)
    formato = Column(String(50))  # Ej: 'A4', 'oficio', 'carta', etc.
    tipo = Column(String(20), server_default=text("'editor'"))  # 'pdf', 'editor', 'imagen'
    activo = Column(Boolean, nullable=False, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    eliminado_en = Column(DateTime(timezone=True), nullable=True)

    # Relaciones
    categorias = relationship("CategoriaDocumento", back_populates="tipo_documento", lazy="selectin", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("tipo IN ('pdf', 'editor', 'imagen')", name="check_tipo_documento_tipo"),
    )


class CategoriaDocumento(Base):
    """Categorías dentro de tipos de documentos"""
    __tablename__ = "categorias_documento"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tipo_documento_id = Column(UUID(as_uuid=True), ForeignKey("tipos_documento.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text)
    activo = Column(Boolean, nullable=False, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    eliminado_en = Column(DateTime(timezone=True), nullable=True)

    # Relaciones
    tipo_documento = relationship("TipoDocumento", back_populates="categorias")
    plantillas = relationship("PlantillaDocumento", back_populates="categoria", lazy="selectin", cascade="all, delete-orphan")


class PlantillaDocumento(Base):
    """Plantillas de documentos (pueden estar bajo tipo o categoría)"""
    __tablename__ = "plantillas_documento"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tipo_documento_id = Column(UUID(as_uuid=True), ForeignKey("tipos_documento.id", ondelete="CASCADE"), nullable=False)
    categoria_id = Column(UUID(as_uuid=True), ForeignKey("categorias_documento.id", ondelete="CASCADE"), nullable=True)  # Opcional
    header_plantilla_id = Column(UUID(as_uuid=True), ForeignKey("plantillas_documento.id", ondelete="SET NULL"), nullable=True)  # Header opcional (auto-referencia)
    plantilla_continuacion_id = Column(UUID(as_uuid=True), ForeignKey("plantillas_documento.id", ondelete="SET NULL"), nullable=True)  # Segunda sección (otra plantilla, otro header)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text)
    contenido = Column(Text)  # Contenido HTML de la plantilla
    formato = Column(String(50))  # Ej: 'A4', 'oficio', 'carta', etc.
    logo_url = Column(Text)  # URL o base64 del logo de la plantilla
    campos_formulario = Column(JSONB, nullable=True)  # Definición de campos del formulario personalizado
    activo = Column(Boolean, nullable=False, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    eliminado_en = Column(DateTime(timezone=True), nullable=True)

    # Relaciones
    tipo_documento = relationship("TipoDocumento")
    categoria = relationship("CategoriaDocumento", back_populates="plantillas")
    header_plantilla = relationship("PlantillaDocumento", remote_side=[id], foreign_keys=[header_plantilla_id])
    plantilla_continuacion = relationship("PlantillaDocumento", remote_side=[id], foreign_keys=[plantilla_continuacion_id])
    respuestas = relationship("RespuestaFormularioPlantilla", back_populates="plantilla", cascade="all, delete-orphan")


class RespuestaFormularioPlantilla(Base):
    """Respuestas capturadas del formulario personalizado de una plantilla por siniestro"""
    __tablename__ = "respuestas_formulario_plantilla"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    plantilla_id = Column(UUID(as_uuid=True), ForeignKey("plantillas_documento.id", ondelete="CASCADE"), nullable=False)
    siniestro_id = Column(UUID(as_uuid=True), ForeignKey("siniestros.id", ondelete="CASCADE"), nullable=False)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    valores = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))  # {clave: valor, ...}
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relaciones
    plantilla = relationship("PlantillaDocumento", back_populates="respuestas")
    siniestro = relationship("Siniestro", foreign_keys=[siniestro_id])
    usuario = relationship("Usuario", foreign_keys=[usuario_id])


class Siniestro(Base):
    """Tabla principal de siniestros"""
    __tablename__ = "siniestros"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    numero_siniestro = Column(String(50), nullable=True)
    fecha_siniestro = Column(DateTime(timezone=True), nullable=True)
    fecha_registro = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    fecha_reporte = Column(DateTime(timezone=True), nullable=True)
    fecha_asignacion = Column(DateTime(timezone=True), nullable=True)
    ubicacion = Column(Text)
    # descripcion_hechos removida - se maneja en versiones_descripcion_hechos
    
    # Usuario que creó el siniestro
    creado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    
    # Asegurado
    asegurado_id = Column(UUID(as_uuid=True), ForeignKey("asegurados.id", ondelete="SET NULL"), nullable=True)
    
    # Estado del siniestro
    estado_id = Column(UUID(as_uuid=True), ForeignKey("estados_siniestro.id", ondelete="RESTRICT"), nullable=True)
    
    # Instituciones involucradas
    institucion_id = Column(UUID(as_uuid=True), ForeignKey("instituciones.id", ondelete="SET NULL"), nullable=True)
    autoridad_id = Column(UUID(as_uuid=True), ForeignKey("instituciones.id", ondelete="SET NULL"), nullable=True)
    
    # Proveniente y código
    proveniente_id = Column(UUID(as_uuid=True), ForeignKey("provenientes.id", ondelete="SET NULL"), nullable=True)
    # Consecutivo del ID (ej. 099), único por proveniente + anualidad — ver db/postgresql_siniestros_codigo_por_proveniente.sql
    codigo = Column(String(50), nullable=True)
    # Año calendario (ej. 2026), alineado con fecha de reporte / referencia del consecutivo (NOT NULL tras db/postgresql_siniestros_codigo_por_proveniente.sql)
    anualidad = Column(Integer, nullable=False)
    numero_reporte = Column(String(100), nullable=True)
    old_id = Column(String(255), nullable=True)
    
    # Calificación
    calificacion_id = Column(UUID(as_uuid=True), ForeignKey("calificaciones_siniestro.id", ondelete="SET NULL"), nullable=True)
    
    # Forma de contacto del asegurado
    forma_contacto = Column(String(50), nullable=True)  # "correo", "telefono", "directa" o "N/A" -> si no se ha proporcionado
    
    # Campos adicionales
    prioridad = Column(String(20), default="media")
    observaciones = Column(Text)
    activo = Column(Boolean, nullable=False, default=True)
    eliminado = Column(Boolean, nullable=False, default=False)
    
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    eliminado_en = Column(DateTime(timezone=True), nullable=True)

    # Relaciones
    versiones_descripcion = relationship(
        "VersionesDescripcionHechos",
        backref="siniestro",
        lazy="selectin",
        cascade="all, delete-orphan"
    )
    polizas = relationship(
        "SiniestroPoliza",
        back_populates="siniestro",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    # Agregar constraint para prioridad
    __table_args__ = (
        CheckConstraint("prioridad IN ('baja', 'media', 'alta', 'critica')", name="check_prioridad"),
    )


class Documento(Base):
    """Documentos asociados a siniestros"""
    __tablename__ = "documentos"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    siniestro_id = Column(UUID(as_uuid=True), ForeignKey("siniestros.id", ondelete="CASCADE"), nullable=False)
    tipo_documento_id = Column(UUID(as_uuid=True), ForeignKey("tipos_documento.id", ondelete="RESTRICT"), nullable=True)
    etapa_flujo_id = Column(UUID(as_uuid=True), ForeignKey("etapas_flujo.id", ondelete="SET NULL"), nullable=True)
    plantilla_documento_id = Column(UUID(as_uuid=True), ForeignKey("plantillas_documento.id", ondelete="SET NULL"), nullable=True)
    # Campos para organización por área y flujo
    area_id = Column(UUID(as_uuid=True), ForeignKey("areas.id", ondelete="SET NULL"), nullable=True)
    flujo_trabajo_id = Column(UUID(as_uuid=True), ForeignKey("flujos_trabajo.id", ondelete="SET NULL"), nullable=True)
    # Requisito documental que originó este documento (nullable para documentos anteriores)
    requisito_documento_id = Column(UUID(as_uuid=True), ForeignKey("etapa_flujo_requisitos_documento.id", ondelete="SET NULL"), nullable=True)
    storage_object_id = Column(UUID(as_uuid=True), ForeignKey("storage_objects.id", ondelete="SET NULL"), nullable=True)
    nombre_archivo = Column(String(255), nullable=False)
    ruta_archivo = Column(String(500), nullable=True)
    contenido = Column(Text, nullable=True)  # Contenido HTML del documento editado
    tamaño_archivo = Column(Integer)  # BIGINT -> Integer
    tipo_mime = Column(String(100))
    usuario_subio = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=True)
    version = Column(Integer, default=1)
    descripcion = Column(Text)
    fecha_documento = Column(Date)
    es_principal = Column(Boolean, default=False)
    es_adicional = Column(Boolean, default=False)
    activo = Column(Boolean, nullable=False, default=True)
    eliminado = Column(Boolean, nullable=False, default=False)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    eliminado_en = Column(DateTime(timezone=True), nullable=True)
    
    # Relaciones
    plantilla_origen = relationship("PlantillaDocumento", foreign_keys=[plantilla_documento_id], lazy="joined")
    area = relationship("Area", foreign_keys=[area_id], lazy="select")
    flujo_trabajo = relationship("FlujoTrabajo", foreign_keys=[flujo_trabajo_id], lazy="select")
    storage_object = relationship("StorageObject", foreign_keys=[storage_object_id], lazy="joined", back_populates="documentos")


class BitacoraActividad(Base):
    """Bitácora de actividades relacionadas con siniestros"""
    __tablename__ = "bitacora_actividades"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    siniestro_id = Column(UUID(as_uuid=True), ForeignKey("siniestros.id", ondelete="CASCADE"), nullable=False)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    tipo_actividad = Column(String(20), nullable=False)  # documento, llamada, reunion, inspeccion, otro
    descripcion = Column(Text, nullable=False)
    horas_trabajadas = Column(Numeric(5, 2), default=0.00)
    fecha_actividad = Column(DateTime(timezone=True), nullable=False)
    documento_adjunto = Column(String(255), nullable=True)
    comentarios = Column(Text, nullable=True)
    verificado = Column(Boolean, nullable=False, server_default=text("false"))
    # Campos para organización por área y flujo
    area_id = Column(UUID(as_uuid=True), ForeignKey("areas.id", ondelete="SET NULL"), nullable=True)
    flujo_trabajo_id = Column(UUID(as_uuid=True), ForeignKey("flujos_trabajo.id", ondelete="SET NULL"), nullable=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("tipo_actividad IN ('documento', 'llamada', 'reunion', 'inspeccion', 'otro')", name="check_tipo_actividad"),
    )
    
    # Relaciones
    area = relationship("Area", foreign_keys=[area_id], lazy="select")
    flujo_trabajo = relationship("FlujoTrabajo", foreign_keys=[flujo_trabajo_id], lazy="select")


class SiniestroPoliza(Base):
    """Pólizas relacionadas a un siniestro"""
    __tablename__ = "siniestro_polizas"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    siniestro_id = Column(UUID(as_uuid=True), ForeignKey("siniestros.id", ondelete="CASCADE"), nullable=False)
    numero_poliza = Column(String(100), nullable=True)
    deducible = Column(Numeric(15, 2), default=0.00, nullable=False)
    reserva = Column(Numeric(15, 2), default=0.00, nullable=False)
    coaseguro = Column(Numeric(15, 2), default=0.00, nullable=False)
    suma_asegurada = Column(Numeric(15, 2), default=0.00, nullable=False)
    es_principal = Column(Boolean, nullable=False, default=False)
    orden = Column(Integer, nullable=False, default=0)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    siniestro = relationship("Siniestro", back_populates="polizas")


class Notificacion(Base):
    """Notificaciones del sistema"""
    __tablename__ = "notificaciones"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    siniestro_id = Column(UUID(as_uuid=True), ForeignKey("siniestros.id", ondelete="SET NULL"), nullable=True)
    tipo = Column(String(20), nullable=False)  # plazo_vencido, cambio_estado, asignacion, recordatorio, general
    titulo = Column(String(200), nullable=False)
    mensaje = Column(Text, nullable=False)
    leida = Column(Boolean, default=False)
    fecha_vencimiento = Column(DateTime(timezone=True), nullable=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("tipo IN ('plazo_vencido', 'cambio_estado', 'asignacion', 'recordatorio', 'general')", name="check_tipo_notificacion"),
    )


class EvidenciaFotografica(Base):
    """Evidencias fotográficas de siniestros"""
    __tablename__ = "evidencias_fotograficas"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    siniestro_id = Column(UUID(as_uuid=True), ForeignKey("siniestros.id", ondelete="CASCADE"), nullable=False)
    nombre_archivo = Column(String(255), nullable=False)
    ruta_archivo = Column(String(500), nullable=False)
    tamaño_archivo = Column(Integer)  # BIGINT -> Integer
    tipo_mime = Column(String(100))
    latitud = Column(Numeric(10, 8), nullable=True)
    longitud = Column(Numeric(11, 8), nullable=True)
    fecha_toma = Column(DateTime(timezone=True), nullable=True)
    usuario_subio = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=True)
    descripcion = Column(Text, nullable=True)
    activo = Column(Boolean, nullable=False, default=True)
    eliminado = Column(Boolean, nullable=False, default=False)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    eliminado_en = Column(DateTime(timezone=True), nullable=True)


class SiniestroUsuario(Base):
    """Relación entre siniestros y usuarios (involucrados)"""
    __tablename__ = "siniestro_usuarios"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    siniestro_id = Column(UUID(as_uuid=True), ForeignKey("siniestros.id", ondelete="CASCADE"), nullable=False)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    tipo_relacion = Column(String(20), nullable=False)  # asegurado, proveniente, testigo, tercero
    es_principal = Column(Boolean, default=False)
    observaciones = Column(Text, nullable=True)
    activo = Column(Boolean, nullable=False, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("tipo_relacion IN ('asegurado', 'proveniente', 'testigo', 'tercero')", name="check_tipo_relacion"),
    )


class SiniestroArea(Base):
    """Relación entre siniestros y áreas (múltiples áreas por siniestro)"""
    __tablename__ = "siniestro_areas"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    siniestro_id = Column(UUID(as_uuid=True), ForeignKey("siniestros.id", ondelete="CASCADE"), nullable=False)
    area_id = Column(UUID(as_uuid=True), ForeignKey("areas.id", ondelete="CASCADE"), nullable=False)
    fecha_asignacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    observaciones = Column(Text, nullable=True)
    activo = Column(Boolean, nullable=False, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class VersionesDescripcionHechos(Base):
    """Versiones de la descripción de hechos de un siniestro"""
    __tablename__ = "versiones_descripcion_hechos"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    siniestro_id = Column(UUID(as_uuid=True), ForeignKey("siniestros.id", ondelete="CASCADE"), nullable=False)
    descripcion_html = Column(Text, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    es_actual = Column(Boolean, nullable=False, default=True)
    creado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    observaciones = Column(Text, nullable=True)  # Notas sobre los cambios en esta versión
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
