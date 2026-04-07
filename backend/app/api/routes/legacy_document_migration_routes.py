"""
Rutas API para importar archivos legacy usando la estructura actual de documentos.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.permisos import require_permiso
from app.db.session import get_db
from app.models.user import User
from app.schemas.legacy_document_migration_schema import (
    LegacyDetectedFileResponse,
    LegacyDestinationsResponse,
    LegacyFinalizeRequest,
    LegacyFinalizeResponse,
    LegacyMigrationContextResponse,
)
from app.services.auditoria_service import AuditoriaService
from app.services.legacy_document_migration_service import LegacyDocumentMigrationService

router = APIRouter(prefix="/siniestros", tags=["Siniestros - Migración Documental"])


@router.get("/{siniestro_id}/migracion-documental/contexto", response_model=LegacyMigrationContextResponse)
def get_migracion_contexto(
    siniestro_id: UUID,
    area_id: UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("siniestros", "ver_documentos")),
):
    return LegacyDocumentMigrationService.get_context(db, siniestro_id, current_user, area_id)


@router.post("/{siniestro_id}/migracion-documental/scan", response_model=LegacyMigrationContextResponse)
def rescan_migracion_documental(
    siniestro_id: UUID,
    area_id: UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("siniestros", "ver_documentos")),
):
    return LegacyDocumentMigrationService.get_context(db, siniestro_id, current_user, area_id)


@router.get("/{siniestro_id}/migracion-documental/archivos", response_model=list[LegacyDetectedFileResponse])
def list_migracion_archivos(
    siniestro_id: UUID,
    area_id: UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("siniestros", "ver_documentos")),
):
    return LegacyDocumentMigrationService.list_files(db, siniestro_id, current_user, area_id)


@router.get("/{siniestro_id}/migracion-documental/destinos", response_model=LegacyDestinationsResponse)
def get_migracion_destinos(
    siniestro_id: UUID,
    area_id: UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("siniestros", "ver_documentos")),
):
    return LegacyDocumentMigrationService.get_destinations(db, siniestro_id, current_user, area_id)


@router.get("/{siniestro_id}/migracion-documental/archivos/{archivo_id}/preview")
def preview_migracion_file(
    siniestro_id: UUID,
    archivo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("siniestros", "ver_documentos")),
):
    content, media_type, filename = LegacyDocumentMigrationService.get_preview_payload(
        db, siniestro_id, archivo_id, current_user
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.post(
    "/{siniestro_id}/migracion-documental/finalizar",
    response_model=LegacyFinalizeResponse,
    status_code=status.HTTP_200_OK,
)
def finalizar_migracion_documental(
    siniestro_id: UUID,
    payload: LegacyFinalizeRequest,
    area_id: UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("siniestros", "subir_archivo")),
):
    result = LegacyDocumentMigrationService.finalize(db, siniestro_id, payload, current_user, area_id)
    try:
        AuditoriaService.registrar_accion(
            db=db,
            usuario_id=current_user.id,
            empresa_id=current_user.empresa_id,
            accion="migracion_documental_finalizada",
            modulo="siniestros",
            tabla="siniestros",
            registro_id=siniestro_id,
            descripcion="Importación de archivos legacy finalizada.",
            datos_nuevos=result.model_dump(mode="json"),
        )
    except Exception:
        pass
    return result
