"""
Servicios para persistir y exponer artefactos generados (PDF, reportes, exportaciones).
"""

from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models.storage import ArchivoGenerado
from app.services.storage_metadata_service import StorageObjectService
from app.services.storage_service import StorageError, get_storage_service


class ArchivoGeneradoService:
    @staticmethod
    def create(
        db: Session,
        *,
        empresa_id: UUID,
        storage_object_id: UUID,
        tipo_origen: str,
        formato: str,
        generado_por: Optional[UUID],
        modulo: Optional[str] = None,
        siniestro_id: Optional[UUID] = None,
        plantilla_documento_id: Optional[UUID] = None,
        metadata_json: Optional[dict[str, Any]] = None,
    ) -> ArchivoGenerado:
        encoded_metadata = jsonable_encoder(metadata_json or {})
        archivo_generado = ArchivoGenerado(
            empresa_id=empresa_id,
            storage_object_id=storage_object_id,
            tipo_origen=tipo_origen,
            modulo=modulo,
            formato=formato,
            siniestro_id=siniestro_id,
            plantilla_documento_id=plantilla_documento_id,
            generado_por=generado_por,
            metadata_json=encoded_metadata,
            activo=True,
            eliminado=False,
        )
        db.add(archivo_generado)
        db.flush()
        return archivo_generado

    @staticmethod
    def get_by_id(db: Session, archivo_generado_id: UUID) -> Optional[ArchivoGenerado]:
        return (
            db.query(ArchivoGenerado)
            .options(joinedload(ArchivoGenerado.storage_object))
            .filter(
                ArchivoGenerado.id == archivo_generado_id,
                ArchivoGenerado.eliminado == False,
            )
            .first()
        )

    @staticmethod
    def persist_bytes(
        db: Session,
        *,
        empresa_id: UUID,
        filename: str,
        data: bytes,
        content_type: Optional[str],
        tipo_origen: str,
        formato: str,
        generado_por: Optional[UUID],
        category: str,
        modulo: Optional[str] = None,
        siniestro_id: Optional[UUID] = None,
        plantilla_documento_id: Optional[UUID] = None,
        metadata_json: Optional[dict[str, Any]] = None,
    ) -> ArchivoGenerado:
        storage_service = get_storage_service()
        encoded_metadata = jsonable_encoder(metadata_json or {})
        stored_file = storage_service.put_generated_bytes(
            empresa_id=str(empresa_id),
            category=category,
            original_filename=filename,
            data=data,
            content_type=content_type,
            modulo=modulo,
        )
        try:
            storage_object = StorageObjectService.create(
                db,
                empresa_id=empresa_id,
                stored_file=stored_file,
                original_filename=filename,
                mime_type=content_type,
                size_bytes=len(data),
                creado_por=generado_por,
                metadata_json={
                    "source_kind": tipo_origen,
                    **encoded_metadata,
                },
            )
            archivo_generado = ArchivoGeneradoService.create(
                db,
                empresa_id=empresa_id,
                storage_object_id=storage_object.id,
                tipo_origen=tipo_origen,
                formato=formato,
                generado_por=generado_por,
                modulo=modulo,
                siniestro_id=siniestro_id,
                plantilla_documento_id=plantilla_documento_id,
                metadata_json=encoded_metadata,
            )
            db.commit()
            db.refresh(archivo_generado)
            return archivo_generado
        except Exception:
            db.rollback()
            try:
                storage_service.delete(stored_file.storage_path)
            except StorageError:
                pass
            raise


def build_generated_file_access_payload(
    archivo_generado: ArchivoGenerado,
    request: Request,
) -> dict[str, Any]:
    storage_object = getattr(archivo_generado, "storage_object", None)
    if not storage_object or not getattr(storage_object, "storage_path", None):
        raise ValueError("El archivo generado no tiene un objeto de storage asociado.")

    storage_service = get_storage_service()
    provider = (
        getattr(storage_object, "provider", None)
        or storage_service.get_provider_for_path(storage_object.storage_path)
    )
    if provider == "r2":
        url = storage_service.get_download_url(
            storage_object.storage_path,
            filename=storage_object.original_filename,
            expires_in=settings.STORAGE_SIGNED_URL_TTL_SECONDS,
        )
        expires_in = settings.STORAGE_SIGNED_URL_TTL_SECONDS
    else:
        url = str(
            request.url_for(
                "get_generated_file_archivo",
                archivo_generado_id=archivo_generado.id,
            )
        )
        expires_in = None

    return {
        "success": True,
        "message": "Archivo generado exitosamente",
        "generated_file_id": archivo_generado.id,
        "storage_object_id": storage_object.id,
        "filename": storage_object.original_filename,
        "content_type": storage_object.mime_type,
        "size_bytes": storage_object.size_bytes,
        "provider": provider,
        "url": url,
        "expires_in": expires_in,
    }
