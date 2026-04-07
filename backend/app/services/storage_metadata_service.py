"""
Servicios de metadata persistente para archivos almacenados.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.models.legal import Documento
from app.models.storage import StorageObject
from app.services.storage_service import StoredFile


class StorageObjectService:
    @staticmethod
    def create(
        db: Session,
        *,
        empresa_id: UUID,
        stored_file: StoredFile,
        original_filename: str,
        mime_type: Optional[str],
        size_bytes: Optional[int],
        creado_por: Optional[UUID],
        metadata_json: Optional[dict[str, Any]] = None,
    ) -> StorageObject:
        storage_object = StorageObject(
            empresa_id=empresa_id,
            provider=stored_file.provider,
            storage_path=stored_file.storage_path,
            bucket_name=stored_file.bucket_name,
            object_key=stored_file.object_key,
            local_path=stored_file.local_path,
            original_filename=original_filename,
            mime_type=mime_type or stored_file.content_type,
            size_bytes=size_bytes if size_bytes is not None else stored_file.size_bytes,
            etag=stored_file.etag,
            sha256=stored_file.sha256,
            metadata_json=jsonable_encoder(metadata_json or {}),
            creado_por=creado_por,
            activo=True,
            eliminado=False,
        )
        db.add(storage_object)
        db.flush()
        return storage_object

    @staticmethod
    def get_by_id(db: Session, storage_object_id: UUID) -> Optional[StorageObject]:
        return db.query(StorageObject).filter(StorageObject.id == storage_object_id).first()

    @staticmethod
    def sync_document_link_state(
        db: Session,
        storage_object_id: Optional[UUID],
    ) -> Optional[StorageObject]:
        if not storage_object_id:
            return None

        storage_object = (
            db.query(StorageObject)
            .filter(StorageObject.id == storage_object_id)
            .first()
        )
        if not storage_object:
            return None

        document_states = (
            db.query(Documento.activo, Documento.eliminado)
            .filter(Documento.storage_object_id == storage_object_id)
            .all()
        )
        has_active_reference = any(bool(activo) and not bool(eliminado) for activo, eliminado in document_states)
        has_non_deleted_reference = any(not bool(eliminado) for _activo, eliminado in document_states)

        storage_object.activo = has_active_reference
        storage_object.eliminado = bool(document_states) and not has_non_deleted_reference
        storage_object.eliminado_en = (
            datetime.now(timezone.utc)
            if storage_object.eliminado
            else None
        )
        db.flush()
        return storage_object
