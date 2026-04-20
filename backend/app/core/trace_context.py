"""Identificador de traza por petición HTTP (compartido con handlers y logging)."""

from __future__ import annotations

import contextvars
from typing import Optional
from uuid import uuid4

_trace_id_ctx: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "http_trace_id", default=None
)


def get_trace_id() -> Optional[str]:
    return _trace_id_ctx.get()


def set_trace_id(trace_id: str) -> contextvars.Token:
    return _trace_id_ctx.set(trace_id)


def reset_trace_id(token: contextvars.Token) -> None:
    _trace_id_ctx.reset(token)


def new_trace_id() -> str:
    return str(uuid4())
