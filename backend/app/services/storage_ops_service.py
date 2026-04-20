"""
Servicios operativos para validar el subsistema de storage al arranque.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from app.core.config import settings
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
