"""Cifrado Fernet para contraseñas temporales en auditoría de invitaciones (export CSV)."""

import base64
import hashlib

from cryptography.fernet import Fernet

from app.core.config import settings


def _fernet_key_bytes() -> bytes:
    """
    Clave Fernet (32 bytes, url-safe base64).
    Si INVITE_AUDIT_FERNET_KEY está definida en .env, debe ser el token generado por Fernet.generate_key().
    Si no, se deriva de SECRET_KEY (rotar SECRET_KEY invalida descifrado de filas antiguas).
    """
    raw = getattr(settings, "INVITE_AUDIT_FERNET_KEY", None) or ""
    if isinstance(raw, str) and raw.strip():
        return raw.strip().encode("utf-8")
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def get_invite_audit_fernet() -> Fernet:
    return Fernet(_fernet_key_bytes())


def encrypt_password_for_audit(plain: str) -> str:
    f = get_invite_audit_fernet()
    return f.encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_password_from_audit(token: str) -> str:
    f = get_invite_audit_fernet()
    return f.decrypt(token.encode("ascii")).decode("utf-8")
