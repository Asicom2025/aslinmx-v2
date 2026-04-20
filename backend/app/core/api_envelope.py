"""
Envelope homologado para respuestas JSON de la API (éxito y error).
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, cast

from app.core.trace_context import get_trace_id, new_trace_id

REDACT_BODY_KEYS = frozenset(
    {
        "password",
        "current_password",
        "new_password",
        "hashed_password",
        "token",
        "access_token",
        "refresh_token",
        "temp_token",
        "recaptcha_token",
        "authorization",
        "secret",
        "client_secret",
        "api_key",
    }
)


def effective_trace_id() -> str:
    return get_trace_id() or new_trace_id()


def redact_object(obj: Any, depth: int = 0, max_depth: int = 12) -> Any:
    """Recorre dict/list y enmascara claves sensibles (no muta el original)."""
    if depth > max_depth:
        return "[truncated-depth]"
    if isinstance(obj, dict):
        out: Dict[str, Any] = {}
        for k, v in obj.items():
            key = str(k).lower()
            if key in REDACT_BODY_KEYS or key.endswith("_password") or key.endswith("_token"):
                out[k] = "[REDACTED]"
            else:
                out[k] = redact_object(v, depth + 1, max_depth)
        return out
    if isinstance(obj, list):
        return [redact_object(i, depth + 1, max_depth) for i in obj[:200]]
    return obj


def truncate_json_value(obj: Any, max_bytes: int) -> Any:
    """Serializa y trunca si excede max_bytes (aprox)."""
    try:
        raw = json.dumps(obj, default=str, ensure_ascii=False)
    except (TypeError, ValueError):
        return str(obj)[: max_bytes // 2]
    if len(raw.encode("utf-8")) <= max_bytes:
        return obj
    return raw[: max_bytes] + "…[truncated]"


def build_success_envelope(data: Any, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {
        "success": True,
        "trace_id": effective_trace_id(),
        "data": data,
        "meta": meta,
    }


def build_error_envelope(
    *,
    status_code: int,
    message: str,
    details: Optional[Dict[str, Any]] = None,
    trace_id: Optional[str] = None,
) -> Dict[str, Any]:
    tid = trace_id or effective_trace_id()
    return {
        "success": False,
        "trace_id": tid,
        "error": {
            "code": f"HTTP_{status_code}",
            "message": message,
        },
        "details": details,
    }


def validation_details_from_errors(errors: List[Any]) -> Dict[str, Any]:
    """Evita filtrar valores crudos de `input` (p. ej. contraseñas) en el detalle 422."""
    safe: List[Any] = []
    for e in errors:
        if isinstance(e, dict):
            d = dict(cast(Dict[Any, Any], e))
            if "input" in d:
                d["input"] = "[REDACTED]"
            safe.append(d)
        else:
            safe.append(e)
    return {"validation_errors": safe}


def is_envelope_response(body: Any) -> bool:
    if not isinstance(body, dict):
        return False
    return "success" in body and "trace_id" in body
