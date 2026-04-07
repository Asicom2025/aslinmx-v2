"""
Servicio de storage con soporte para filesystem local y Cloudflare R2.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
import hashlib
import logging
import mimetypes
from pathlib import Path, PurePosixPath
import shutil
from typing import Optional
from urllib.parse import quote, urlparse, urlunparse
import uuid as uuid_lib

from app.core.config import settings
from app.models.legal import Proveniente, Siniestro

try:
    import boto3
    from botocore.config import Config as BotoConfig
    from botocore.exceptions import ClientError
except ImportError:  # pragma: no cover - solo aplica cuando boto3 no está instalado.
    boto3 = None
    BotoConfig = None
    ClientError = None


logger = logging.getLogger(__name__)


class StorageError(RuntimeError):
    """Error base del subsistema de storage."""


class StorageConfigurationError(StorageError):
    """Configuración inválida o incompleta del provider de storage."""


class StorageNotFoundError(StorageError):
    """Archivo u objeto no encontrado en el provider de storage."""


@dataclass(frozen=True)
class StoredFile:
    storage_path: str
    provider: str
    size_bytes: int
    content_type: Optional[str] = None
    etag: Optional[str] = None
    sha256: Optional[str] = None
    bucket_name: Optional[str] = None
    object_key: Optional[str] = None
    local_path: Optional[str] = None


class StorageBackend(ABC):
    provider_name: str

    @abstractmethod
    def put_bytes(
        self,
        *,
        key: str,
        data: bytes,
        content_type: Optional[str] = None,
    ) -> StoredFile:
        raise NotImplementedError

    @abstractmethod
    def put_file(
        self,
        *,
        key: str,
        source_path: Path,
        content_type: Optional[str] = None,
    ) -> StoredFile:
        raise NotImplementedError

    @abstractmethod
    def get_bytes(self, storage_path: str) -> bytes:
        raise NotImplementedError

    @abstractmethod
    def delete(self, storage_path: str) -> None:
        raise NotImplementedError

    def exists(self, storage_path: str) -> bool:
        try:
            self.get_bytes(storage_path)
            return True
        except StorageNotFoundError:
            return False

    def get_download_url(
        self,
        storage_path: str,
        *,
        filename: Optional[str] = None,
        expires_in: Optional[int] = None,
    ) -> Optional[str]:
        return None

    def resolve_local_path(self, storage_path: str) -> Optional[Path]:
        return None


class LocalStorageBackend(StorageBackend):
    provider_name = "local"

    def __init__(self, root: Path):
        self.root = root.resolve()

    def put_bytes(
        self,
        *,
        key: str,
        data: bytes,
        content_type: Optional[str] = None,
    ) -> StoredFile:
        target = self._build_target_path(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return StoredFile(
            storage_path=self._storage_path_from_absolute(target),
            provider=self.provider_name,
            size_bytes=len(data),
            content_type=content_type,
            sha256=_sha256_bytes(data),
            object_key=_normalize_storage_key(key),
            local_path=target.as_posix(),
        )

    def put_file(
        self,
        *,
        key: str,
        source_path: Path,
        content_type: Optional[str] = None,
    ) -> StoredFile:
        if not source_path.exists() or not source_path.is_file():
            raise StorageNotFoundError(f"Archivo de origen no encontrado: {source_path}")
        target = self._build_target_path(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, target)
        return StoredFile(
            storage_path=self._storage_path_from_absolute(target),
            provider=self.provider_name,
            size_bytes=target.stat().st_size,
            content_type=content_type,
            sha256=_sha256_file(source_path),
            object_key=_normalize_storage_key(key),
            local_path=target.as_posix(),
        )

    def get_bytes(self, storage_path: str) -> bytes:
        path = self.resolve_local_path(storage_path)
        if not path or not path.exists() or not path.is_file():
            raise StorageNotFoundError(f"Archivo local no encontrado: {storage_path}")
        return path.read_bytes()

    def delete(self, storage_path: str) -> None:
        path = self.resolve_local_path(storage_path)
        if not path or not path.exists():
            return
        if path.is_file():
            path.unlink(missing_ok=True)
        self._cleanup_empty_parents(path.parent)

    def exists(self, storage_path: str) -> bool:
        path = self.resolve_local_path(storage_path)
        return bool(path and path.exists() and path.is_file())

    def resolve_local_path(self, storage_path: str) -> Optional[Path]:
        path = Path(storage_path)
        if not path.is_absolute():
            path = (Path.cwd() / path).resolve()
        return path

    def _build_target_path(self, key: str) -> Path:
        normalized = _normalize_storage_key(key)
        candidate = (self.root / normalized).resolve()
        try:
            candidate.relative_to(self.root)
        except ValueError as exc:
            raise StorageConfigurationError("La ruta de destino sale del root local configurado.") from exc
        return candidate

    def _storage_path_from_absolute(self, path: Path) -> str:
        cwd = Path.cwd().resolve()
        try:
            return path.relative_to(cwd).as_posix()
        except ValueError:
            return path.as_posix()

    def _cleanup_empty_parents(self, path: Path) -> None:
        current = path
        while current != self.root:
            try:
                current.rmdir()
            except OSError:
                break
            current = current.parent


class R2StorageBackend(StorageBackend):
    provider_name = "r2"
    URI_SCHEME = "r2://"

    def __init__(
        self,
        *,
        bucket_name: str,
        access_key_id: str,
        secret_access_key: str,
        endpoint_url: str,
    ):
        if boto3 is None or BotoConfig is None:
            raise StorageConfigurationError(
                "boto3 no está instalado. Agrega la dependencia antes de usar R2."
            )
        self.bucket_name = bucket_name
        self.endpoint_url = _normalize_r2_endpoint_url(endpoint_url, bucket_name)
        session = boto3.session.Session()
        self.client = session.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name="auto",
            config=BotoConfig(signature_version="s3v4"),
        )

    @classmethod
    def is_configured(cls) -> bool:
        return bool(
            settings.R2_BUCKET_NAME
            and settings.R2_ACCESS_KEY_ID
            and settings.R2_SECRET_ACCESS_KEY
            and (settings.R2_ENDPOINT_URL or settings.R2_ACCOUNT_ID)
        )

    @classmethod
    def build_from_settings(cls) -> "R2StorageBackend":
        if not cls.is_configured():
            raise StorageConfigurationError("Faltan credenciales o endpoint de R2 en la configuración.")
        # Endpoint S3-compatible de R2: raíz del account, sin nombre de bucket en la ruta.
        endpoint_url = settings.R2_ENDPOINT_URL or (
            f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
        )
        return cls(
            bucket_name=str(settings.R2_BUCKET_NAME),
            access_key_id=str(settings.R2_ACCESS_KEY_ID),
            secret_access_key=str(settings.R2_SECRET_ACCESS_KEY),
            endpoint_url=endpoint_url,
        )

    def put_bytes(
        self,
        *,
        key: str,
        data: bytes,
        content_type: Optional[str] = None,
    ) -> StoredFile:
        normalized_key = _normalize_storage_key(key)
        put_params = {
            "Bucket": self.bucket_name,
            "Key": normalized_key,
            "Body": data,
        }
        if content_type:
            put_params["ContentType"] = content_type
        try:
            response = self.client.put_object(**put_params)
        except Exception as exc:
            raise _build_r2_operation_error(
                operation="put_object",
                endpoint_url=self.endpoint_url,
                bucket_name=self.bucket_name,
                object_key=normalized_key,
                exc=exc,
            ) from exc
        etag = str(response.get("ETag", "")).strip('"') or None
        return StoredFile(
            storage_path=self._to_storage_path(normalized_key),
            provider=self.provider_name,
            size_bytes=len(data),
            content_type=content_type,
            etag=etag,
            sha256=_sha256_bytes(data),
            bucket_name=self.bucket_name,
            object_key=normalized_key,
        )

    def put_file(
        self,
        *,
        key: str,
        source_path: Path,
        content_type: Optional[str] = None,
    ) -> StoredFile:
        if not source_path.exists() or not source_path.is_file():
            raise StorageNotFoundError(f"Archivo de origen no encontrado: {source_path}")
        with source_path.open("rb") as source_file:
            data = source_file.read()
        guessed_type = content_type or mimetypes.guess_type(source_path.name)[0]
        return self.put_bytes(key=key, data=data, content_type=guessed_type)

    def get_bytes(self, storage_path: str) -> bytes:
        bucket, key = self._parse_storage_path(storage_path)
        try:
            response = self.client.get_object(Bucket=bucket, Key=key)
        except Exception as exc:
            raise _build_r2_operation_error(
                operation="get_object",
                endpoint_url=self.endpoint_url,
                bucket_name=bucket,
                object_key=key,
                exc=exc,
            ) from exc
        body = response.get("Body")
        if body is None:
            raise StorageNotFoundError(f"Objeto R2 sin body: {storage_path}")
        return body.read()

    def delete(self, storage_path: str) -> None:
        bucket, key = self._parse_storage_path(storage_path)
        try:
            self.client.delete_object(Bucket=bucket, Key=key)
        except Exception as exc:
            raise _build_r2_operation_error(
                operation="delete_object",
                endpoint_url=self.endpoint_url,
                bucket_name=bucket,
                object_key=key,
                exc=exc,
            ) from exc

    def exists(self, storage_path: str) -> bool:
        bucket, key = self._parse_storage_path(storage_path)
        try:
            self.client.head_object(Bucket=bucket, Key=key)
            return True
        except Exception:
            return False

    def get_download_url(
        self,
        storage_path: str,
        *,
        filename: Optional[str] = None,
        expires_in: Optional[int] = None,
    ) -> Optional[str]:
        bucket, key = self._parse_storage_path(storage_path)
        params = {
            "Bucket": bucket,
            "Key": key,
        }
        if filename:
            params["ResponseContentDisposition"] = _build_content_disposition(filename)
        return self.client.generate_presigned_url(
            ClientMethod="get_object",
            Params=params,
            ExpiresIn=expires_in or settings.STORAGE_SIGNED_URL_TTL_SECONDS,
        )

    def _to_storage_path(self, key: str) -> str:
        return f"{self.URI_SCHEME}{self.bucket_name}/{key}"

    def _parse_storage_path(self, storage_path: str) -> tuple[str, str]:
        if not storage_path.startswith(self.URI_SCHEME):
            raise StorageConfigurationError(f"Ruta de storage R2 inválida: {storage_path}")
        raw = storage_path[len(self.URI_SCHEME):]
        if "/" not in raw:
            raise StorageConfigurationError(f"Ruta de storage R2 inválida: {storage_path}")
        bucket, key = raw.split("/", 1)
        if not bucket or not key:
            raise StorageConfigurationError(f"Ruta de storage R2 inválida: {storage_path}")
        return bucket, key


class StorageService:
    def __init__(
        self,
        *,
        local_backend: LocalStorageBackend,
        active_backend: StorageBackend,
        r2_backend: Optional[R2StorageBackend] = None,
    ):
        self.local_backend = local_backend
        self.active_backend = active_backend
        self.r2_backend = r2_backend

    @classmethod
    def from_settings(cls) -> "StorageService":
        local_root = Path(settings.STORAGE_LOCAL_ROOT or settings.UPLOAD_DIR)
        local_backend = LocalStorageBackend(local_root)

        provider = (settings.STORAGE_PROVIDER or "local").strip().lower()
        r2_backend = None
        if R2StorageBackend.is_configured():
            try:
                r2_backend = R2StorageBackend.build_from_settings()
            except StorageConfigurationError:
                if provider == "r2":
                    raise

        if provider == "local":
            active_backend = local_backend
        elif provider == "r2":
            if r2_backend is None:
                raise StorageConfigurationError("STORAGE_PROVIDER=r2, pero la configuración de R2 está incompleta.")
            active_backend = r2_backend
        elif provider == "auto":
            active_backend = r2_backend or local_backend
        else:
            raise StorageConfigurationError(f"Provider de storage no soportado: {provider}")

        return cls(
            local_backend=local_backend,
            active_backend=active_backend,
            r2_backend=r2_backend,
        )

    def put_document_bytes(
        self,
        *,
        siniestro_id: Optional[str] = None,
        siniestro_storage_ref: Optional[str] = None,
        original_filename: str,
        data: bytes,
        content_type: Optional[str] = None,
    ) -> StoredFile:
        key = build_document_storage_key(
            siniestro_id=siniestro_id,
            siniestro_storage_ref=siniestro_storage_ref,
            original_filename=original_filename,
        )
        guessed_type = content_type or mimetypes.guess_type(original_filename)[0]
        return self.active_backend.put_bytes(key=key, data=data, content_type=guessed_type)

    def put_document_file(
        self,
        *,
        siniestro_id: Optional[str] = None,
        siniestro_storage_ref: Optional[str] = None,
        original_filename: str,
        source_path: Path,
        content_type: Optional[str] = None,
    ) -> StoredFile:
        key = build_document_storage_key(
            siniestro_id=siniestro_id,
            siniestro_storage_ref=siniestro_storage_ref,
            original_filename=original_filename,
        )
        guessed_type = content_type or mimetypes.guess_type(original_filename)[0]
        return self.active_backend.put_file(key=key, source_path=source_path, content_type=guessed_type)

    def put_generated_bytes(
        self,
        *,
        empresa_id: str,
        category: str,
        original_filename: str,
        data: bytes,
        content_type: Optional[str] = None,
        modulo: Optional[str] = None,
    ) -> StoredFile:
        key = build_generated_storage_key(
            empresa_id=empresa_id,
            category=category,
            original_filename=original_filename,
            modulo=modulo,
        )
        guessed_type = content_type or mimetypes.guess_type(original_filename)[0]
        return self.active_backend.put_bytes(key=key, data=data, content_type=guessed_type)

    def get_bytes(self, storage_path: str) -> bytes:
        backend = self._resolve_backend_for_path(storage_path)
        return backend.get_bytes(storage_path)

    def delete(self, storage_path: str) -> None:
        backend = self._resolve_backend_for_path(storage_path)
        backend.delete(storage_path)

    def resolve_local_path(self, storage_path: str) -> Optional[Path]:
        backend = self._resolve_backend_for_path(storage_path)
        return backend.resolve_local_path(storage_path)

    def get_download_url(
        self,
        storage_path: str,
        *,
        filename: Optional[str] = None,
        expires_in: Optional[int] = None,
    ) -> Optional[str]:
        backend = self._resolve_backend_for_path(storage_path)
        return backend.get_download_url(storage_path, filename=filename, expires_in=expires_in)

    def exists(self, storage_path: str) -> bool:
        backend = self._resolve_backend_for_path(storage_path)
        return backend.exists(storage_path)

    def supports_direct_download_url(self, storage_path: str) -> bool:
        backend = self._resolve_backend_for_path(storage_path)
        return backend.get_download_url(storage_path) is not None

    def get_provider_for_path(self, storage_path: str) -> str:
        backend = self._resolve_backend_for_path(storage_path)
        return backend.provider_name

    def _resolve_backend_for_path(self, storage_path: str) -> StorageBackend:
        if storage_path.startswith(R2StorageBackend.URI_SCHEME):
            if self.r2_backend is None:
                raise StorageConfigurationError("Se intentó leer un objeto R2 sin credenciales disponibles.")
            return self.r2_backend
        return self.local_backend


def sanitize_filename(filename: str) -> str:
    basename = PurePosixPath(str(filename).replace("\\", "/")).name
    safe_name = "".join(char for char in basename if char.isalnum() or char in "._- ").strip().lstrip(".")
    return safe_name or "archivo"


def build_document_storage_key(
    *,
    siniestro_id: Optional[str] = None,
    siniestro_storage_ref: Optional[str] = None,
    original_filename: str,
) -> str:
    storage_ref = _normalize_document_storage_ref(siniestro_storage_ref or siniestro_id)
    if not storage_ref:
        raise StorageConfigurationError("No se pudo resolver la referencia de storage para el siniestro.")
    safe_name = sanitize_filename(original_filename)
    unique_name = f"{uuid_lib.uuid4().hex[:12]}_{safe_name}"
    return f"siniestros/{storage_ref}/{unique_name}"


def resolve_siniestro_storage_ref(db, siniestro: Siniestro) -> str:
    proveniente_code = None
    if getattr(siniestro, "proveniente_id", None):
        proveniente = (
            db.query(Proveniente.codigo)
            .filter(Proveniente.id == siniestro.proveniente_id)
            .first()
        )
        if proveniente and proveniente[0]:
            proveniente_code = str(proveniente[0]).strip()

    return build_siniestro_storage_ref(
        siniestro_id=str(siniestro.id),
        proveniente_code=proveniente_code,
        consecutivo=siniestro.codigo,
        fecha_referencia=siniestro.fecha_registro or siniestro.fecha_siniestro,
    )


def build_siniestro_storage_ref(
    *,
    siniestro_id: str,
    proveniente_code: Optional[str],
    consecutivo: Optional[str],
    fecha_referencia: Optional[datetime],
) -> str:
    codigo_proveniente = _normalize_siniestro_storage_component(proveniente_code)
    consecutivo_normalizado = normalize_siniestro_consecutivo(consecutivo)
    anualidad = _normalize_siniestro_anualidad(fecha_referencia)

    if codigo_proveniente and consecutivo_normalizado and anualidad:
        return f"{codigo_proveniente}-{consecutivo_normalizado}-{anualidad}"
    return _normalize_document_storage_ref(siniestro_id) or str(siniestro_id)


def build_generated_storage_key(
    *,
    empresa_id: str,
    category: str,
    original_filename: str,
    modulo: Optional[str] = None,
) -> str:
    safe_name = sanitize_filename(original_filename)
    unique_name = f"{uuid_lib.uuid4().hex[:12]}_{safe_name}"
    timestamp = datetime.now(timezone.utc)
    parts = [
        "generados",
        _sanitize_path_component(category),
        _sanitize_path_component(empresa_id),
    ]
    if modulo:
        parts.append(_sanitize_path_component(modulo))
    parts.extend([timestamp.strftime("%Y"), timestamp.strftime("%m"), unique_name])
    return "/".join(parts)


def _normalize_storage_key(key: str) -> str:
    normalized = PurePosixPath(str(key).replace("\\", "/")).as_posix().strip("/")
    if not normalized or normalized.startswith("../") or "/../" in f"/{normalized}/" or normalized == "..":
        raise StorageConfigurationError("La clave de storage no es válida.")
    return normalized


def _sanitize_path_component(value: str) -> str:
    normalized = sanitize_filename(value).strip().lower().replace(" ", "-")
    return normalized or "general"


def _normalize_document_storage_ref(value: Optional[str]) -> Optional[str]:
    normalized = str(value or "").strip()
    if not normalized:
        return None
    return "".join(char for char in normalized if char.isalnum() or char in "-_") or None


def _normalize_siniestro_storage_component(value: Optional[str]) -> Optional[str]:
    normalized = str(value or "").strip()
    if not normalized:
        return None
    return "".join(char for char in normalized if char.isalnum()) or None


def _normalize_siniestro_consecutivo(value: Optional[str]) -> Optional[str]:
    return normalize_siniestro_consecutivo(value)


def normalize_siniestro_consecutivo(value: Optional[str]) -> Optional[str]:
    normalized = "".join(char for char in str(value or "").strip() if char.isdigit())
    if not normalized:
        return None
    return normalized.zfill(3)


def _normalize_siniestro_anualidad(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    try:
        year = value.year if hasattr(value, "year") else None
        if year is None:
            return None
        return str(int(year) % 100).zfill(2)
    except (TypeError, ValueError):
        return None


def _build_content_disposition(filename: str) -> str:
    safe_name = sanitize_filename(filename)
    encoded = quote(filename, safe="")
    return f'attachment; filename="{safe_name}"; filename*=UTF-8\'\'{encoded}'


def _normalize_r2_endpoint_url(endpoint_url: str, bucket_name: str) -> str:
    normalized = (endpoint_url or "").strip().rstrip("/")
    parsed = urlparse(normalized)
    if not parsed.scheme or not parsed.netloc:
        raise StorageConfigurationError("R2_ENDPOINT_URL no es una URL válida.")

    path = (parsed.path or "").rstrip("/")
    if path and path not in {"", f"/{bucket_name}"}:
        raise StorageConfigurationError(
            "R2_ENDPOINT_URL debe apuntar al endpoint raíz de R2, sin rutas adicionales."
        )

    if path == f"/{bucket_name}":
        logger.warning(
            "R2_ENDPOINT_URL incluía el bucket en la ruta; se normalizó automáticamente a endpoint raíz."
        )

    return urlunparse((parsed.scheme, parsed.netloc, "", "", "", ""))


def _build_r2_operation_error(
    *,
    operation: str,
    endpoint_url: str,
    bucket_name: str,
    object_key: str,
    exc: Exception,
) -> StorageError:
    if ClientError is not None and isinstance(exc, ClientError):
        error = exc.response.get("Error", {})
        metadata = exc.response.get("ResponseMetadata", {})
        headers = metadata.get("HTTPHeaders", {}) or {}
        code = error.get("Code") or "Unknown"
        message = error.get("Message") or str(exc)
        status = metadata.get("HTTPStatusCode")
        request_id = metadata.get("RequestId")
        cf_ray = headers.get("cf-ray")
        server = headers.get("server")
        return StorageError(
            "Error de R2 en {operation}: code={code} status={status} bucket={bucket} "
            "key={key} endpoint={endpoint} request_id={request_id} cf_ray={cf_ray} "
            "server={server}. {message}".format(
                operation=operation,
                code=code,
                status=status,
                bucket=bucket_name,
                key=object_key,
                endpoint=endpoint_url,
                request_id=request_id,
                cf_ray=cf_ray,
                server=server,
                message=message,
            )
        )

    return StorageError(
        "Error de R2 en {operation}: bucket={bucket} key={key} endpoint={endpoint}. {message}".format(
            operation=operation,
            bucket=bucket_name,
            key=object_key,
            endpoint=endpoint_url,
            message=str(exc),
        )
    )


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file_handle:
        for chunk in iter(lambda: file_handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@lru_cache(maxsize=1)
def get_storage_service() -> StorageService:
    return StorageService.from_settings()
