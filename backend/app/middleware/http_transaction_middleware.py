"""
Una sola línea JSON por transacción HTTP: request/response resumidos y envelope de éxito.
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, StreamingResponse
from starlette.types import ASGIApp, Message, Scope

from app.core.api_envelope import (
    build_success_envelope,
    is_envelope_response,
    redact_object,
    truncate_json_value,
)
from app.core.config import settings
from app.core.trace_context import reset_trace_id, set_trace_id

_structured_logger = logging.getLogger("aslin.http_transaction")
_structured_logger.propagate = False
_structured_logger.setLevel(logging.INFO)
if not _structured_logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(message)s"))
    _structured_logger.addHandler(_h)

# Rutas sin envelope JSON ni lectura pesada de body
_EXCLUDED_PATH_PREFIXES: Tuple[str, ...] = (
    "/docs",
    "/redoc",
    "/openapi.json",
    "/health",
    "/favicon.ico",
)

_SENSITIVE_HEADER_KEYS = frozenset(
    {"authorization", "cookie", "set-cookie", "proxy-authorization"}
)


def _path_excluded(path: str) -> bool:
    p = path.split("?", 1)[0]
    return any(p == pref or p.startswith(pref + "/") for pref in _EXCLUDED_PATH_PREFIXES)


def _filter_headers(headers: List[Tuple[bytes, bytes]]) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for k, v in headers:
        key = k.decode("latin-1").lower()
        if key in _SENSITIVE_HEADER_KEYS:
            out[key] = "[REDACTED]"
        else:
            out[key] = v.decode("latin-1", errors="replace")[:2048]
    return out


def _client_ip(scope: Scope, request: Request) -> Optional[str]:
    if request.client:
        return request.client.host
    return None


def _multipart_summary(content_type: str, content_length: int) -> Dict[str, Any]:
    return {
        "kind": "multipart",
        "content_type": content_type[:200],
        "content_length": content_length,
    }


def _parse_json_body(raw: bytes) -> Any:
    if not raw:
        return None
    try:
        return json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return {"_raw_preview": raw[:512].decode("utf-8", errors="replace")}


def _daily_log_path() -> Optional[str]:
    base = getattr(settings, "STRUCTURED_LOG_DIR", None) or os.environ.get("STRUCTURED_LOG_DIR")
    if not base:
        return None
    os.makedirs(base, exist_ok=True)
    name = datetime.now(timezone.utc).strftime("log_%d_%m_%y.log")
    return os.path.join(base, name)


def _emit_log_line(payload: Dict[str, Any]) -> None:
    line = json.dumps(payload, default=str, ensure_ascii=False)
    target = getattr(settings, "STRUCTURED_LOG_TARGET", "stdout").lower()
    if target in ("stdout", "both"):
        _structured_logger.info(line)
    if target in ("file", "both"):
        path = _daily_log_path()
        if path:
            try:
                with open(path, "a", encoding="utf-8") as fp:
                    fp.write(line + "\n")
            except OSError:
                pass


class HttpTransactionMiddleware(BaseHTTPMiddleware):
    """Envuelve respuestas JSON 2xx y emite un log estructurado por petición."""

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        trace_token = None
        scope = request.scope
        if scope.get("type") != "http":
            return await call_next(request)

        incoming = request.headers.get("x-request-id") or request.headers.get("x-trace-id")
        trace_id = (incoming or "").strip() or str(uuid4())
        trace_token = set_trace_id(trace_id)

        start = time.perf_counter()
        path = scope.get("path", "") or ""
        query = scope.get("query_string", b"").decode("latin-1", errors="replace")
        method = request.method
        content_type = (request.headers.get("content-type") or "").lower()
        content_length = int(request.headers.get("content-length") or 0)

        max_body = int(getattr(settings, "HTTP_LOG_MAX_BODY_BYTES", 262144))

        request_body_log: Any = None
        body_bytes: bytes = b""

        if _path_excluded(path):
            pass
        elif "multipart/form-data" in content_type:
            request_body_log = _multipart_summary(content_type, content_length)
        elif content_length > max_body:
            request_body_log = {
                "kind": "too_large",
                "content_length": content_length,
                "content_type": content_type[:200],
            }
        else:
            try:
                body_bytes = await request.body()
            except Exception:
                body_bytes = b""
            parsed = _parse_json_body(body_bytes)
            if parsed is not None:
                request_body_log = truncate_json_value(
                    redact_object(parsed), max_bytes=max_body
                )
            else:
                request_body_log = None

        async def receive() -> Message:
            return {"type": "http.request", "body": body_bytes, "more_body": False}

        wrapped = Request(scope, receive)

        try:
            response = await call_next(wrapped)
            duration_ms = int((time.perf_counter() - start) * 1000)
            response = await self._post_process_response(
                request=wrapped,
                response=response,
                path=path,
                method=method,
                query=query,
                duration_ms=duration_ms,
                request_body_log=request_body_log,
                trace_id=trace_id,
            )
            return response
        finally:
            if trace_token is not None:
                reset_trace_id(trace_token)

    async def _post_process_response(
        self,
        *,
        request: Request,
        response: Response,
        path: str,
        method: str,
        query: str,
        duration_ms: int,
        request_body_log: Any,
        trace_id: str,
    ) -> Response:
        status_code = response.status_code
        ct = (response.headers.get("content-type") or "").lower()

        # Cabecera de traza siempre visible
        if "x-trace-id" not in {k.lower() for k in response.headers.keys()}:
            response.headers["X-Trace-Id"] = trace_id

        if _path_excluded(path):
            log_payload = self._build_log_payload(
                request=request,
                path=path,
                method=method,
                query=query,
                status_code=status_code,
                duration_ms=duration_ms,
                request_body_log=request_body_log,
                trace_id=trace_id,
                response_body_log={"_hint": "path_excluded"},
                response_size_bytes=None,
                response_content_type=response.headers.get("content-type"),
                error_obj=None,
            )
            _emit_log_line(log_payload)
            return response

        if isinstance(response, StreamingResponse):
            log_payload = self._build_log_payload(
                request=request,
                path=path,
                method=method,
                query=query,
                status_code=status_code,
                duration_ms=duration_ms,
                request_body_log=request_body_log,
                trace_id=trace_id,
                response_body_log={"_hint": "streaming"},
                response_size_bytes=None,
                response_content_type=response.headers.get("content-type"),
                error_obj=None,
            )
            _emit_log_line(log_payload)
            return response

        body = b""
        async for chunk in response.body_iterator:
            body += chunk

        response_body_log: Any = None
        envelope_body = body
        parsed: Any = None

        if "application/json" in ct and body:
            try:
                parsed = json.loads(body.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                parsed = None

        envelope_enabled = getattr(settings, "API_ENVELOPE_ENABLED", True)
        parsed_is_plain_json = (
            parsed is not None
            and not isinstance(parsed, bool)
            and isinstance(parsed, (dict, list, str, int, float, type(None)))
        )
        should_wrap = (
            envelope_enabled
            and not _path_excluded(path)
            and 200 <= status_code < 300
            and parsed_is_plain_json
            and not (isinstance(parsed, dict) and is_envelope_response(parsed))
        )

        if should_wrap:
            wrapped_json = build_success_envelope(parsed, meta=None)
            envelope_body = json.dumps(wrapped_json, default=str, ensure_ascii=False).encode(
                "utf-8"
            )
            response_body_log = truncate_json_value(
                redact_object(wrapped_json),
                max_bytes=int(getattr(settings, "HTTP_LOG_MAX_BODY_BYTES", 262144)),
            )
        elif parsed is not None:
            max_b = int(getattr(settings, "HTTP_LOG_MAX_BODY_BYTES", 262144))
            response_body_log = truncate_json_value(redact_object(parsed), max_bytes=max_b)
        elif body:
            response_body_log = {"_binary_length": len(body)}

        headers_out = dict(response.headers)
        headers_out.pop("content-length", None)
        new_resp = Response(
            content=envelope_body,
            status_code=status_code,
            headers=headers_out,
            media_type=response.media_type or ct.split(";")[0].strip() or None,
        )
        new_resp.headers["X-Trace-Id"] = trace_id
        new_resp.headers["content-length"] = str(len(envelope_body))

        error_obj = None
        if isinstance(parsed, dict) and parsed.get("success") is False:
            err = parsed.get("error")
            if isinstance(err, dict):
                error_obj = {"code": err.get("code"), "message": (err.get("message") or "")[:2000]}

        log_payload = self._build_log_payload(
            request=request,
            path=path,
            method=method,
            query=query,
            status_code=status_code,
            duration_ms=duration_ms,
            request_body_log=request_body_log,
            trace_id=trace_id,
            response_body_log=response_body_log,
            response_size_bytes=len(envelope_body),
            response_content_type=new_resp.headers.get("content-type"),
            error_obj=error_obj,
        )
        _emit_log_line(log_payload)
        return new_resp

    def _build_log_payload(
        self,
        *,
        request: Request,
        path: str,
        method: str,
        query: str,
        status_code: int,
        duration_ms: int,
        request_body_log: Any,
        trace_id: str,
        response_body_log: Any,
        response_size_bytes: Optional[int],
        response_content_type: Optional[str],
        error_obj: Any,
    ) -> Dict[str, Any]:
        ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        level = "warn" if status_code >= 400 else "info"
        if status_code >= 500:
            level = "error"
        service = getattr(settings, "HTTP_LOG_SERVICE_NAME", "aslin-api")
        env = getattr(settings, "HTTP_LOG_ENVIRONMENT", None) or (
            "development" if settings.DEBUG else "production"
        )
        scope = request.scope
        req_headers = _filter_headers(scope.get("headers") or [])
        resp_ct = (response_content_type or "")[:200]
        resp_headers_min = {"content-type": resp_ct}

        user_block: Optional[Dict[str, str]] = None
        # Sin decodificar JWT completo: opcional desde scope state si otra capa lo setea
        if getattr(request.state, "user_id", None):
            user_block = {"id": str(request.state.user_id)}

        return {
            "timestamp": ts,
            "level": level,
            "service": service,
            "environment": env,
            "trace_id": trace_id,
            "request_id": trace_id,
            "span_id": None,
            "event": "http_transaction",
            "http": {
                "method": method,
                "path": path,
                "query": f"?{query}" if query else "",
                "route": path,
                "status_code": status_code,
                "duration_ms": duration_ms,
                "client_ip": _client_ip(scope, request),
                "user_agent": (request.headers.get("user-agent") or "")[:512],
                "request_size_bytes": int(request.headers.get("content-length") or 0),
                "response_size_bytes": response_size_bytes,
            },
            "user": user_block,
            "request": {
                "headers": req_headers,
                "body": request_body_log,
            },
            "response": {
                "headers": resp_headers_min,
                "body": response_body_log,
            },
            "error": error_obj,
        }
