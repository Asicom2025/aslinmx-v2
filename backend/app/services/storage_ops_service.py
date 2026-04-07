"""
Servicios operativos para validar, observar y reconciliar el subsistema de storage.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.legal import Documento, Siniestro
from app.models.storage import ArchivoGenerado, StorageObject
from app.services.storage_service import (
    StorageConfigurationError,
    get_storage_service,
)

logger = logging.getLogger(__name__)


class StorageOpsService:
    @staticmethod
    def get_runtime_status() -> dict[str, Any]:
        configured_provider = (settings.STORAGE_PROVIDER or "local").strip().lower()
        local_root = Path(settings.STORAGE_LOCAL_ROOT or settings.UPLOAD_DIR).resolve()
        warnings: list[str] = []

        r2_configured = bool(
            settings.R2_BUCKET_NAME
            and settings.R2_ACCESS_KEY_ID
            and settings.R2_SECRET_ACCESS_KEY
            and (settings.R2_ENDPOINT_URL or settings.R2_ACCOUNT_ID)
        )

        try:
            storage_service = get_storage_service()
            active_provider = storage_service.active_backend.provider_name
            ready = True
        except StorageConfigurationError as exc:
            active_provider = None
            ready = False
            warnings.append(str(exc))
        except Exception as exc:  # pragma: no cover - protección defensiva
            active_provider = None
            ready = False
            warnings.append(f"Error inesperado al inicializar storage: {exc}")

        if configured_provider == "auto" and not r2_configured:
            warnings.append("STORAGE_PROVIDER=auto sin credenciales completas de R2: se usará almacenamiento local.")
        if configured_provider == "r2" and not r2_configured:
            warnings.append("STORAGE_PROVIDER=r2 pero faltan credenciales de R2.")
        if active_provider == "local" and not local_root.exists():
            warnings.append(f"La ruta local de storage todavía no existe: {local_root}")

        return {
            "ready": ready,
            "configured_provider": configured_provider,
            "active_provider": active_provider,
            "r2_configured": r2_configured,
            "local_root": local_root.as_posix(),
            "signed_url_ttl_seconds": settings.STORAGE_SIGNED_URL_TTL_SECONDS,
            "warnings": warnings,
        }

    @staticmethod
    def ensure_runtime_ready() -> dict[str, Any]:
        status = StorageOpsService.get_runtime_status()
        local_root = Path(status["local_root"])

        if status["active_provider"] == "local":
            local_root.mkdir(parents=True, exist_ok=True)
            if not local_root.exists() or not local_root.is_dir():
                raise StorageConfigurationError(
                    f"No se pudo preparar la ruta local de storage: {local_root}"
                )

        if status["warnings"]:
            logger.warning("Storage runtime warnings: %s", "; ".join(status["warnings"]))
        else:
            logger.info(
                "Storage runtime ready. configured=%s active=%s",
                status["configured_provider"],
                status["active_provider"],
            )
        return status


class StorageReconciliationService:
    @staticmethod
    def _collect_company_state(
        db: Session,
        *,
        empresa_id: UUID,
    ) -> tuple[list[StorageObject], dict[UUID, dict[str, int]], dict[UUID, dict[str, int]], int]:
        storage_objects = (
            db.query(StorageObject)
            .filter(StorageObject.empresa_id == empresa_id)
            .order_by(StorageObject.creado_en.desc())
            .all()
        )
        generated_files = (
            db.query(ArchivoGenerado)
            .filter(ArchivoGenerado.empresa_id == empresa_id)
            .all()
        )
        documents_with_storage = (
            db.query(Documento)
            .join(Siniestro, Siniestro.id == Documento.siniestro_id)
            .filter(
                Siniestro.empresa_id == empresa_id,
                Documento.storage_object_id.isnot(None),
            )
            .all()
        )
        documents_missing_storage_metadata = (
            db.query(Documento)
            .join(Siniestro, Siniestro.id == Documento.siniestro_id)
            .filter(
                Documento.storage_object_id.is_(None),
                Documento.ruta_archivo.isnot(None),
                Documento.ruta_archivo != "",
                Documento.eliminado == False,
                Siniestro.empresa_id == empresa_id,
            )
            .count()
        )

        document_counts: dict[UUID, dict[str, int]] = {}
        for document in documents_with_storage:
            if not document.storage_object_id:
                continue
            state = document_counts.setdefault(document.storage_object_id, {"total": 0, "active": 0, "non_deleted": 0})
            state["total"] += 1
            if not bool(document.eliminado):
                state["non_deleted"] += 1
            if bool(document.activo) and not bool(document.eliminado):
                state["active"] += 1

        generated_counts: dict[UUID, dict[str, int]] = {}
        for generated in generated_files:
            state = generated_counts.setdefault(generated.storage_object_id, {"total": 0, "active": 0, "non_deleted": 0})
            state["total"] += 1
            if not bool(generated.eliminado):
                state["non_deleted"] += 1
            if bool(generated.activo) and not bool(generated.eliminado):
                state["active"] += 1

        return storage_objects, document_counts, generated_counts, documents_missing_storage_metadata

    @staticmethod
    def summarize_company(
        db: Session,
        *,
        empresa_id: UUID,
        verify_objects: bool = False,
        sample_limit: int = 25,
    ) -> dict[str, Any]:
        (
            storage_objects,
            document_counts,
            generated_counts,
            documents_missing_storage_metadata,
        ) = StorageReconciliationService._collect_company_state(
            db,
            empresa_id=empresa_id,
        )

        orphan_candidates: list[StorageObject] = []
        missing_objects: list[dict[str, Any]] = []
        verification_warnings: list[str] = []
        storage_service = None
        verification_available = False
        if verify_objects:
            try:
                storage_service = get_storage_service()
                verification_available = True
            except StorageConfigurationError as exc:
                verification_warnings.append(str(exc))

        for storage_object in storage_objects:
            document_state = document_counts.get(storage_object.id, {"active": 0, "non_deleted": 0, "total": 0})
            generated_state = generated_counts.get(storage_object.id, {"active": 0, "non_deleted": 0, "total": 0})
            if (
                not bool(storage_object.eliminado)
                and document_state["non_deleted"] == 0
                and generated_state["non_deleted"] == 0
            ):
                orphan_candidates.append(storage_object)

            if verify_objects and verification_available and len(missing_objects) < sample_limit and storage_service is not None:
                try:
                    exists = storage_service.exists(storage_object.storage_path)
                except StorageConfigurationError as exc:
                    verification_warnings.append(str(exc))
                    verification_available = False
                    storage_service = None
                    continue

                if not exists:
                    missing_objects.append(
                        {
                            "storage_object_id": str(storage_object.id),
                            "storage_path": storage_object.storage_path,
                            "provider": storage_object.provider,
                            "original_filename": storage_object.original_filename,
                        }
                    )

        return {
            "runtime": StorageOpsService.get_runtime_status(),
            "verification": {
                "requested": verify_objects,
                "available": verification_available,
                "warnings": verification_warnings,
            },
            "counts": {
                "storage_objects_total": len(storage_objects),
                "storage_objects_active": sum(1 for item in storage_objects if item.activo and not item.eliminado),
                "storage_objects_deleted": sum(1 for item in storage_objects if item.eliminado),
                "generated_files_total": sum(item["total"] for item in generated_counts.values()),
                "documents_missing_storage_metadata": documents_missing_storage_metadata,
                "orphan_storage_objects": len(orphan_candidates),
                "missing_physical_objects_sampled": len(missing_objects),
            },
            "samples": {
                "orphan_storage_objects": [
                    {
                        "id": str(item.id),
                        "storage_path": item.storage_path,
                        "provider": item.provider,
                        "original_filename": item.original_filename,
                    }
                    for item in orphan_candidates[:sample_limit]
                ],
                "missing_physical_objects": missing_objects,
            },
        }

    @staticmethod
    def reconcile_company(
        db: Session,
        *,
        empresa_id: UUID,
        sample_limit: int = 25,
        verify_objects: bool = True,
    ) -> dict[str, Any]:
        (
            storage_objects,
            document_counts,
            generated_counts,
            _documents_missing_storage_metadata,
        ) = StorageReconciliationService._collect_company_state(
            db,
            empresa_id=empresa_id,
        )
        orphan_ids = [
            storage_object.id
            for storage_object in storage_objects
            if not bool(storage_object.eliminado)
            and document_counts.get(storage_object.id, {"non_deleted": 0})["non_deleted"] == 0
            and generated_counts.get(storage_object.id, {"non_deleted": 0})["non_deleted"] == 0
        ]
        updated = 0
        if orphan_ids:
            orphan_objects = (
                db.query(StorageObject)
                .filter(StorageObject.id.in_(orphan_ids))
                .all()
            )
            for storage_object in orphan_objects:
                storage_object.activo = False
                if not storage_object.eliminado:
                    storage_object.eliminado = True
                    storage_object.eliminado_en = datetime.now(timezone.utc)
                updated += 1
            db.commit()
        else:
            db.rollback()

        summary = StorageReconciliationService.summarize_company(
            db,
            empresa_id=empresa_id,
            verify_objects=verify_objects,
            sample_limit=sample_limit,
        )

        result = {
            "updated_storage_objects": updated,
            "summary": summary,
        }
        return jsonable_encoder(result)
