"""
ASLIN 2.0 - Backend Principal
FastAPI application entry point
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import traceback
import logging

from app.core.config import settings
from app.core.error_responses import ensure_detail_string, validation_errors_to_detail
from app.core.api_envelope import (
    build_error_envelope,
    effective_trace_id,
    validation_details_from_errors,
)
from app.core.trace_context import get_trace_id
from app.middleware.http_transaction_middleware import HttpTransactionMiddleware
from app.api.api_router import api_router
from app.services.storage_ops_service import StorageOpsService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Aslin 2.0 API",
    description="API REST para sistema de gestión administrativa",
    version="2.0.0",
    docs_url=None if settings.ENVIRONMENT == "production" else "/docs",
    redoc_url=None if settings.ENVIRONMENT == "production" else "/redoc",
    redirect_slashes=False,
)

# Primero el middleware de transacción (más externo): ve la respuesta final y unifica logs.
app.add_middleware(HttpTransactionMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|frontend)(:\\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


def _cors_headers(request: Request) -> dict:
    origin = request.headers.get("origin")
    if origin and (
        origin in settings.CORS_ORIGINS
        or any(
            origin.startswith(f"http://{host}")
            for host in ["localhost", "127.0.0.1", "0.0.0.0", "frontend"]
        )
    ):
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    return {}


def _envelope_json_response(
    request: Request,
    *,
    status_code: int,
    payload: dict,
) -> JSONResponse:
    headers = _cors_headers(request)
    tid = get_trace_id() or effective_trace_id()
    headers["X-Trace-Id"] = tid
    return JSONResponse(status_code=status_code, content=payload, headers=headers)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Manejador global de excepciones que asegura que los headers CORS
    siempre se envíen, incluso en caso de error.
    """
    logger.error("Error no manejado: %s", str(exc))
    logger.error(traceback.format_exc())

    message = "Error interno del servidor"
    if settings.DEBUG and str(exc):
        message = f"{message}: {str(exc)}"

    tid = get_trace_id() or effective_trace_id()
    payload = build_error_envelope(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        message=message,
        details=None,
        trace_id=tid,
    )
    return _envelope_json_response(
        request,
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        payload=payload,
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """HTTPException con envelope homologado."""
    message = ensure_detail_string(exc.detail)
    tid = get_trace_id() or effective_trace_id()
    payload = build_error_envelope(
        status_code=exc.status_code,
        message=message,
        details=None,
        trace_id=tid,
    )
    return _envelope_json_response(
        request,
        status_code=exc.status_code,
        payload=payload,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Errores de validación Pydantic con envelope y detalle estructurado."""
    errors = exc.errors()
    message = validation_errors_to_detail(errors)
    tid = get_trace_id() or effective_trace_id()
    payload = build_error_envelope(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        message=message,
        details=validation_details_from_errors(errors),
        trace_id=tid,
    )
    return _envelope_json_response(
        request,
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        payload=payload,
    )


app.include_router(api_router, prefix="/api/v1")


@app.on_event("startup")
async def startup_event():
    if settings.STORAGE_VALIDATE_ON_STARTUP:
        try:
            StorageOpsService.ensure_runtime_ready()
        except Exception as exc:
            logger.error("Storage startup validation failed: %s", exc)
            raise


@app.get("/")
async def root():
    """Endpoint raíz - Información básica de la API"""
    return {
        "message": "Bienvenido a Aslin 2.0 API",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
async def health_check():
    """Endpoint para verificar el estado del servidor"""
    storage_status = StorageOpsService.get_runtime_status()
    return {
        "status": "healthy",
        "service": "Aslin 2.0 Backend",
        "version": "2.0.0",
        "storage": storage_status,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
