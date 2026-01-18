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
from app.api.api_router import api_router
from app.db.session import engine
from app.db.base import Base

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Crear instancia de FastAPI
app = FastAPI(
    title="Aslin 2.0 API",
    description="API REST para sistema de gestión administrativa",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
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
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Error interno del servidor",
            "error": str(exc) if settings.DEBUG else "Error interno del servidor"
        },
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
        content={"detail": exc.errors(), "body": exc.body},
        headers=headers
    )

# Incluir routers de la API
app.include_router(api_router, prefix="/api/v1")


@app.on_event("startup")
async def startup_event():
    """
    Evento que se ejecuta al iniciar la aplicación.
    Crea las tablas en la base de datos si no existen.
    """
    Base.metadata.create_all(bind=engine)
    print("✅ Base de datos inicializada")


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
    return {
        "status": "healthy",
        "service": "Aslin 2.0 Backend",
        "version": "2.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )

