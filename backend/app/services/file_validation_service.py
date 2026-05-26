"""
Validación de archivos documentales permitidos para expediente y anexos.
"""

from pathlib import Path
import zipfile
from io import BytesIO
from typing import Optional


ALLOWED_DOCUMENT_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".csv",
    ".txt",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
}

ALLOWED_DOCUMENT_ACCEPT = (
    ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,"
    ".jpg,.jpeg,.png,.gif,.webp"
)

_EXTENSION_MIME_MAP = {
    ".pdf": {"application/pdf", "application/octet-stream"},
    ".doc": {"application/msword", "application/octet-stream"},
    ".docx": {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/zip",
        "application/octet-stream",
    },
    ".xls": {"application/vnd.ms-excel", "application/octet-stream"},
    ".xlsx": {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/zip",
        "application/octet-stream",
    },
    ".csv": {
        "text/csv",
        "text/plain",
        "application/csv",
        "application/vnd.ms-excel",
        "application/octet-stream",
    },
    ".txt": {"text/plain", "application/octet-stream"},
    ".jpg": {"image/jpeg", "application/octet-stream"},
    ".jpeg": {"image/jpeg", "application/octet-stream"},
    ".png": {"image/png", "application/octet-stream"},
    ".gif": {"image/gif", "application/octet-stream"},
    ".webp": {"image/webp", "application/octet-stream"},
}

_PREFERRED_MIME_BY_EXTENSION = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
    ".txt": "text/plain",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}

_OLE_SIGNATURE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
_MAX_TEXT_SCAN_BYTES = 4096


def get_safe_document_extension(filename: Optional[str]) -> str:
    name = Path(str(filename or "").replace("\\", "/")).name.strip()
    return Path(name).suffix.lower()


def _clean_content_type(content_type: Optional[str]) -> str:
    return (content_type or "").split(";", 1)[0].strip().lower()


def _looks_like_text(data: bytes) -> bool:
    sample = data[:_MAX_TEXT_SCAN_BYTES]
    if b"\x00" in sample:
        return False
    try:
        sample.decode("utf-8")
        return True
    except UnicodeDecodeError:
        try:
            sample.decode("latin-1")
            return True
        except UnicodeDecodeError:
            return False


def _zip_contains(data: bytes, expected_prefix: str) -> bool:
    try:
        with zipfile.ZipFile(BytesIO(data)) as zf:
            names = zf.namelist()
    except zipfile.BadZipFile:
        return False
    return any(name.startswith(expected_prefix) for name in names)


def _content_matches_extension(extension: str, data: bytes) -> bool:
    if extension == ".pdf":
        return data.startswith(b"%PDF-")
    if extension in {".jpg", ".jpeg"}:
        return data.startswith(b"\xff\xd8\xff")
    if extension == ".png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if extension == ".gif":
        return data.startswith(b"GIF87a") or data.startswith(b"GIF89a")
    if extension == ".webp":
        return data.startswith(b"RIFF") and data[8:12] == b"WEBP"
    if extension == ".docx":
        return _zip_contains(data, "word/")
    if extension == ".xlsx":
        return _zip_contains(data, "xl/")
    if extension in {".doc", ".xls"}:
        return data.startswith(_OLE_SIGNATURE)
    if extension in {".csv", ".txt"}:
        return _looks_like_text(data)
    return False


def validate_safe_document_file(
    *,
    filename: Optional[str],
    content_type: Optional[str],
    data: bytes,
) -> str:
    """
    Valida una carga/anexo documental y retorna el MIME normalizado.
    Rechaza extensiones ejecutables, nombres sin extensión y archivos renombrados
    que no coincidan con su formato real.
    """
    extension = get_safe_document_extension(filename)
    if extension not in ALLOWED_DOCUMENT_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_DOCUMENT_EXTENSIONS))
        raise ValueError(f"Extensión de archivo no permitida. Permitidas: {allowed}")

    clean_type = _clean_content_type(content_type)
    allowed_mimes = _EXTENSION_MIME_MAP.get(extension, set())
    if clean_type and clean_type not in allowed_mimes:
        raise ValueError(
            f"Tipo MIME no permitido para {extension}: {clean_type or 'desconocido'}"
        )

    if not _content_matches_extension(extension, data):
        raise ValueError(
            f"El contenido del archivo no coincide con la extensión {extension}"
        )

    if clean_type and clean_type != "application/octet-stream":
        return clean_type
    return _PREFERRED_MIME_BY_EXTENSION.get(extension, "application/octet-stream")
