"""
Rutas para descargar artefactos generados persistidos en storage.
"""

import io
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user
from app.db.session import get_db
from app.models.user import User
from app.services.generated_file_service import ArchivoGeneradoService
from app.services.storage_service import (
    StorageConfigurationError,
    StorageError,
    StorageNotFoundError,
    get_storage_service,
)

router = APIRouter(prefix="/archivos-generados", tags=["Archivos Generados"])


@router.get("/{archivo_generado_id}/archivo", name="get_generated_file_archivo")
def get_generated_file_archivo(
    archivo_generado_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    archivo_generado = ArchivoGeneradoService.get_by_id(db, archivo_generado_id)
    if not archivo_generado:
        raise HTTPException(status_code=404, detail="Archivo generado no encontrado")
    if archivo_generado.empresa_id != current_user.empresa_id:
        raise HTTPException(status_code=404, detail="Archivo generado no encontrado")

    storage_object = getattr(archivo_generado, "storage_object", None)
    if not storage_object or not storage_object.storage_path:
        raise HTTPException(status_code=404, detail="El archivo generado no tiene contenido asociado")

    storage_service = get_storage_service()
    try:
        local_path = storage_service.resolve_local_path(storage_object.storage_path)
        if local_path and local_path.exists() and local_path.is_file():
            return FileResponse(
                local_path,
                media_type=storage_object.mime_type or "application/octet-stream",
                filename=storage_object.original_filename or "archivo",
            )
        content = storage_service.get_bytes(storage_object.storage_path)
    except StorageNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Archivo no encontrado en el storage configurado") from exc
    except StorageConfigurationError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except StorageError as exc:
        raise HTTPException(status_code=500, detail=f"No se pudo recuperar el archivo: {exc}") from exc

    return StreamingResponse(
        io.BytesIO(content),
        media_type=storage_object.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{storage_object.original_filename or "archivo"}"'
        },
    )
