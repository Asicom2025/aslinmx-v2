"""
Modelos de la aplicación
Importa todos los modelos para que SQLAlchemy los detecte
"""

# Importar todos los modelos aquí para que Base.metadata los detecte
from app.models.user import (
    User,
    Empresa,
    Rol,
    UsuarioPerfil,
    UsuarioContactos,
    UsuarioDireccion,
    Usuario2FA,
    UsuarioEmpresa,
    UsuarioArea,
)
from app.models.permiso import Modulo, Accion, RolPermiso
from app.models.flujo_trabajo import FlujoTrabajo, EtapaFlujo, SiniestroEtapa, EtapaFlujoRequisitoDocumento

# Importar modelos adicionales
from app.models.legal import (
    Area,
    TipoDocumento,
    CategoriaDocumento,
    PlantillaDocumento,
    Entidad,
    Siniestro,
    Documento,
    Institucion,
    Autoridad,
    Asegurado,
    Proveniente,
    EstadoSiniestro,
    CalificacionSiniestro,
    BitacoraActividad,
    Notificacion,
    EvidenciaFotografica,
    SiniestroUsuario,
    SiniestroArea,
    SiniestroPoliza,
)
from app.models.config import (
    ConfiguracionSMTP,
    PlantillaCorreo,
    Auditoria,
    ConfiguracionReporte,
    HistorialCorreo,
)
from app.models.backup import (
    Backup,
    ConfiguracionBackup,
)
from app.models.storage import StorageObject, ArchivoGenerado
from app.models.legacy_temp import TmpSiniestroFile

__all__ = [
    "User",
    "Empresa",
    "Rol",
    "UsuarioPerfil",
    "UsuarioContactos",
    "UsuarioDireccion",
    "Usuario2FA",
    "UsuarioEmpresa",
    "UsuarioArea",
    "Modulo",
    "Accion",
    "RolPermiso",
    "FlujoTrabajo",
    "EtapaFlujo",
    "SiniestroEtapa",
    "EtapaFlujoRequisitoDocumento",
    "Area",
    "TipoDocumento",
    "CategoriaDocumento",
    "PlantillaDocumento",
    "Entidad",
    "Siniestro",
    "Documento",
    "Institucion",
    "Autoridad",
    "Asegurado",
    "Proveniente",
    "EstadoSiniestro",
    "CalificacionSiniestro",
    "BitacoraActividad",
    "Notificacion",
    "EvidenciaFotografica",
    "SiniestroUsuario",
    "SiniestroArea",
    "SiniestroPoliza",
    "ConfiguracionSMTP",
    "PlantillaCorreo",
    "Auditoria",
    "ConfiguracionReporte",
    "HistorialCorreo",
    "Backup",
    "ConfiguracionBackup",
    "StorageObject",
    "ArchivoGenerado",
    "TmpSiniestroFile",
]
