"""
Router principal de la API
Agrupa todos los routers de la aplicación
"""

from fastapi import APIRouter
from app.api.routes import (
    user_routes, flujo_trabajo_routes, legal_routes, siniestros_routes,
    bitacora_routes, documentos_routes, notificaciones_routes, evidencias_routes,
    siniestro_relaciones_routes, versiones_descripcion_routes, dashboard_routes, rol_routes, empresa_routes,
    permiso_routes, pdf_routes, config_routes, reporte_routes, export_routes, auditoria_routes, backup_routes,
    legacy_document_migration_routes, generated_files_routes,
)

# Router principal
api_router = APIRouter()

# Incluir routers de módulos
api_router.include_router(
    user_routes.router,
    prefix="/users",
    tags=["users"]
)

api_router.include_router(
    flujo_trabajo_routes.router,
    prefix="/flujos-trabajo",
    tags=["Flujos de Trabajo"]
)

api_router.include_router(
    legal_routes.router,
    prefix="",
    tags=["Catálogos"]
)

api_router.include_router(
    siniestros_routes.router,
    prefix="",
    tags=["Siniestros"]
)

api_router.include_router(
    bitacora_routes.router,
    prefix="",
    tags=["Bitácora"]
)

api_router.include_router(
    documentos_routes.router,
    prefix="",
    tags=["Documentos"]
)

api_router.include_router(
    generated_files_routes.router,
    prefix="",
    tags=["Archivos Generados"]
)

api_router.include_router(
    notificaciones_routes.router,
    prefix="",
    tags=["Notificaciones"]
)

api_router.include_router(
    evidencias_routes.router,
    prefix="",
    tags=["Evidencias"]
)

api_router.include_router(
    siniestro_relaciones_routes.router,
    prefix="",
    tags=["Siniestros - Relaciones"]
)

api_router.include_router(
    legacy_document_migration_routes.router,
    prefix="",
    tags=["Siniestros - Migración Documental"]
)

api_router.include_router(
    versiones_descripcion_routes.router,
    prefix="",
    tags=["Siniestros - Versiones Descripción"]
)

api_router.include_router(
    dashboard_routes.router,
    prefix="",
    tags=["Dashboard"]
)

api_router.include_router(
    rol_routes.router,
    prefix="/roles",
    tags=["Roles"]
)

api_router.include_router(
    empresa_routes.router,
    prefix="/empresas",
    tags=["Empresas"]
)

api_router.include_router(
    permiso_routes.router,
    prefix="/permisos",
    tags=["Permisos"]
)

api_router.include_router(
    pdf_routes.router,
    prefix="/pdf",
    tags=["PDF"]
)

api_router.include_router(
    config_routes.router,
    prefix="/configuracion",
    tags=["Configuración"]
)

api_router.include_router(
    reporte_routes.router,
    prefix="/reportes",
    tags=["Reportes"]
)

api_router.include_router(
    export_routes.router,
    prefix="/exportar",
    tags=["Exportación"]
)

api_router.include_router(
    auditoria_routes.router,
    prefix="/auditoria",
    tags=["Auditoría"]
)

api_router.include_router(
    backup_routes.router,
    prefix="",
    tags=["Backup"]
)

