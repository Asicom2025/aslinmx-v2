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
from app.api.api_router import api_router
from app.services.storage_ops_service import StorageOpsService

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
# Peticiones HTTP (sin query string, body ni cabeceras sensibles)
access_logger = logging.getLogger("uvicorn.error")

# Crear instancia de FastAPI
# redirect_slashes=False evita 307 al llamar /api/v1/users en lugar de /api/v1/users/
app = FastAPI(
    title="Aslin 2.0 API",
    description="API REST para sistema de gestión administrativa",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    redirect_slashes=False
)

# Configurar CORS - debe estar antes de otros middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|frontend)(:\\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.middleware("http")
async def log_request_client_info(request: Request, call_next):
    """
    Registro mínimo por petición: IP de cliente / proxy y ruta.
    No se registra query string, cuerpo, cookies ni Authorization.
    """
    client_host = request.client.host if request.client else None
    x_forwarded_for = request.headers.get("x-forwarded-for")
    x_real_ip = request.headers.get("x-real-ip")
    access_logger.info(
        "request client_host=%s x_forwarded_for=%s x_real_ip=%s method=%s path=%s",
        client_host,
        x_forwarded_for,
        x_real_ip,
        request.method,
        request.url.path,
    )
    return await call_next(request)


# Manejador de excepciones global para asegurar headers CORS en errores
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Manejador global de excepciones que asegura que los headers CORS
    siempre se envíen, incluso en caso de error.
    """
    logger.error(f"Error no manejado: {str(exc)}")
    logger.error(traceback.format_exc())
    
    # Crear respuesta con headers CORS
    origin = request.headers.get("origin")
    if origin and (origin in settings.CORS_ORIGINS or 
                   any(origin.startswith(f"http://{host}") for host in ["localhost", "127.0.0.1", "0.0.0.0", "frontend"])):
        headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    else:
        headers = {}
    
    detail = "Error interno del servidor"
    if settings.DEBUG and str(exc):
        detail = f"{detail}: {str(exc)}"
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": detail},
        headers=headers
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Manejador de excepciones HTTP que incluye headers CORS"""
    origin = request.headers.get("origin")
    if origin and (origin in settings.CORS_ORIGINS or 
                   any(origin.startswith(f"http://{host}") for host in ["localhost", "127.0.0.1", "0.0.0.0", "frontend"])):
        headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    else:
        headers = {}
    
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=headers
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Manejador de errores de validación que incluye headers CORS"""
    origin = request.headers.get("origin")
    if origin and (origin in settings.CORS_ORIGINS or 
                   any(origin.startswith(f"http://{host}") for host in ["localhost", "127.0.0.1", "0.0.0.0", "frontend"])):
        headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    else:
        headers = {}
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": validation_errors_to_detail(exc.errors())},
        headers=headers
    )

# Incluir routers de la API
app.include_router(api_router, prefix="/api/v1")


@app.on_event("startup")
async def startup_event():
    """
    En Docker, la BD se inicializa en init_db.py (antes de los workers).
    En desarrollo local sin init_db, create_all se ejecuta aquí.
    """
    try:
        from app.db.session import engine
        from app.db.base import Base
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        # Si falla (ej. race con workers), las tablas probablemente ya existen
        logger.debug("Startup create_all: %s", e)

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
        "health": "/health"
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
        reload=True
    )

