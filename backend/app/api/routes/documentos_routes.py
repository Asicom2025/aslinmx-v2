"""
Rutas API para documentos
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
import os
import uuid as uuid_lib

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.core.permisos import require_permiso
from app.models.user import User
from app.schemas.legal_schema import (
    DocumentoCreate, DocumentoUpdate, DocumentoResponse,
    BitacoraActividadCreate,
    NotificacionCreate,
)
from app.models.legal import PlantillaDocumento, Siniestro
from app.services.legal_service import (
    DocumentoService,
    BitacoraActividadService,
    NotificacionService,
)
from app.services.auditoria_service import AuditoriaService

router = APIRouter(prefix="/documentos", tags=["Documentos"])

# Directorio base para archivos subidos (fotos, PDF, etc.)
UPLOAD_BASE = Path(os.environ.get("UPLOAD_DIR", "uploads"))
ALLOWED_MIME_PREFIXES = ("image/", "application/pdf", "application/msword", "application/vnd.", "text/")
MAX_FILE_SIZE_MB = 25


@router.get("/siniestros/{siniestro_id}", response_model=List[DocumentoResponse])
def list_documentos_siniestro(
    siniestro_id: UUID,
    tipo_documento_id: Optional[UUID] = Query(None, description="Filtrar por tipo de documento"),
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    area_id: Optional[UUID] = Query(None, description="Filtrar por área"),
    flujo_trabajo_id: Optional[UUID] = Query(None, description="Filtrar por flujo de trabajo"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("siniestros", "ver_documentos")),
):
    """Lista documentos de un siniestro, opcionalmente filtrados por área y flujo. Incluye plantilla_tiene_continuacion cuando el documento tiene plantilla."""
    documents = DocumentoService.list(
        db=db,
        siniestro_id=siniestro_id,
        tipo_documento_id=tipo_documento_id,
        activo=activo,
        area_id=area_id,
        flujo_trabajo_id=flujo_trabajo_id,
        skip=skip,
        limit=limit
    )
    if not documents:
        return []
    plantilla_ids = {d.plantilla_documento_id for d in documents if d.plantilla_documento_id}
    plantillas = db.query(PlantillaDocumento).filter(PlantillaDocumento.id.in_(plantilla_ids)).all()
    tiene_continuacion = {
        str(p.id): bool(getattr(p, "plantilla_continuacion_id", None) and getattr(p, "campos_formulario", None) and len(p.campos_formulario or []) > 0)
        for p in plantillas
    }
    result = []
    for doc in documents:
        resp = DocumentoResponse.model_validate(doc)
        flag = tiene_continuacion.get(str(doc.plantilla_documento_id), False) if doc.plantilla_documento_id else None
        result.append(DocumentoResponse(**(resp.model_dump() | {"plantilla_tiene_continuacion": flag})))
    return result


@router.get("/{documento_id}", response_model=DocumentoResponse)
def get_documento(
    documento_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Obtiene un documento por ID"""
    documento = DocumentoService.get_by_id(db, documento_id)
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return documento


@router.get("/{documento_id}/archivo")
def get_documento_archivo(
    documento_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Descarga el archivo físico de un documento (para documentos subidos, no HTML)."""
    documento = DocumentoService.get_by_id(db, documento_id)
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if not documento.ruta_archivo:
        raise HTTPException(status_code=404, detail="Este documento no tiene archivo asociado")
    path = Path(documento.ruta_archivo)
    if not path.is_absolute():
        path = Path.cwd() / path
    if not path.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado en el servidor")
    return FileResponse(
        path,
        media_type=documento.tipo_mime or "application/octet-stream",
        filename=documento.nombre_archivo or "archivo",
    )


@router.post("", response_model=DocumentoResponse, status_code=status.HTTP_201_CREATED)
def create_documento(
    payload: DocumentoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Crea un nuevo documento y registra en bitácora y notificación"""
    if not payload.usuario_subio:
        payload.usuario_subio = current_user.id

    # Excluir campos de bitácora del payload para crear el documento
    doc_data = payload.model_dump(exclude={"horas_trabajadas_bitacora", "comentarios_bitacora"})
    doc_payload = DocumentoCreate(**doc_data)
    documento = DocumentoService.create(db, doc_payload)

    horas_bitacora = getattr(payload, "horas_trabajadas_bitacora", None) or Decimal("0")
    comentarios_bitacora = getattr(payload, "comentarios_bitacora", None) or ""

    # Registrar en bitácora (carga de informe)
    BitacoraActividadService.create(db, BitacoraActividadCreate(
        siniestro_id=documento.siniestro_id,
        usuario_id=current_user.id,
        tipo_actividad="documento",
        descripcion=f"Documento guardado: {documento.nombre_archivo}",
        horas_trabajadas=horas_bitacora,
        comentarios=comentarios_bitacora or None,
        fecha_actividad=datetime.now(timezone.utc),
        area_id=documento.area_id,
        flujo_trabajo_id=documento.flujo_trabajo_id,
    ))

    # Notificación para el usuario actual (visible en la plataforma)
    NotificacionService.create(db, NotificacionCreate(
        usuario_id=current_user.id,
        siniestro_id=documento.siniestro_id,
        tipo="general",
        titulo="Documento guardado",
        mensaje=f"Se guardó el documento «{documento.nombre_archivo}» en el siniestro.",
    ))

    # Auditoría: documento creado
    siniestro_obj = db.query(Siniestro).filter(Siniestro.id == documento.siniestro_id).first()
    empresa_id = siniestro_obj.empresa_id if siniestro_obj else current_user.empresa_id
    AuditoriaService.registrar_accion(
        db=db,
        usuario_id=current_user.id,
        empresa_id=empresa_id,
        accion="documento_creado",
        modulo="siniestros",
        tabla="siniestros",
        registro_id=documento.siniestro_id,
        descripcion=f"Documento creado: {documento.nombre_archivo}",
        datos_nuevos={"nombre_archivo": documento.nombre_archivo, "documento_id": str(documento.id)},
    )

    return documento


@router.put("/{documento_id}", response_model=DocumentoResponse)
def update_documento(
    documento_id: UUID,
    payload: DocumentoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Excluir campos de bitácora del payload para actualizar el documento
    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()
                   if k not in ("horas_trabajadas_bitacora", "comentarios_bitacora")}
    doc_update = DocumentoUpdate(**update_data) if update_data else None
    documento = DocumentoService.update(db, documento_id, doc_update) if doc_update else DocumentoService.get_by_id(db, documento_id)
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    horas_bitacora = getattr(payload, "horas_trabajadas_bitacora", None) or Decimal("0")
    comentarios_bitacora = getattr(payload, "comentarios_bitacora", None) or ""

    # Registrar actualización en bitácora
    BitacoraActividadService.create(db, BitacoraActividadCreate(
        siniestro_id=documento.siniestro_id,
        usuario_id=current_user.id,
        tipo_actividad="documento",
        descripcion=f"Documento actualizado: {documento.nombre_archivo}",
        horas_trabajadas=horas_bitacora,
        comentarios=comentarios_bitacora or None,
        fecha_actividad=datetime.now(timezone.utc),
        area_id=documento.area_id,
        flujo_trabajo_id=documento.flujo_trabajo_id,
    ))

    # Auditoría: documento actualizado
    siniestro_obj = db.query(Siniestro).filter(Siniestro.id == documento.siniestro_id).first()
    empresa_id = siniestro_obj.empresa_id if siniestro_obj else current_user.empresa_id
    AuditoriaService.registrar_accion(
        db=db,
        usuario_id=current_user.id,
        empresa_id=empresa_id,
        accion="documento_actualizado",
        modulo="siniestros",
        tabla="siniestros",
        registro_id=documento.siniestro_id,
        descripcion=f"Documento actualizado: {documento.nombre_archivo}",
        datos_nuevos={"nombre_archivo": documento.nombre_archivo, "documento_id": str(documento.id)},
    )

    return documento


@router.post("/upload", response_model=DocumentoResponse, status_code=status.HTTP_201_CREATED)
def upload_documento_archivo(
    siniestro_id: UUID = Form(...),
    file: UploadFile = File(...),
    descripcion: Optional[str] = Form(None),
    area_id: Optional[UUID] = Form(None),
    flujo_trabajo_id: Optional[UUID] = Form(None),
    tipo_documento_id: Optional[UUID] = Form(None),
    plantilla_documento_id: Optional[UUID] = Form(None),
    horas_trabajadas: Optional[float] = Form(None, description="Horas para bitácora"),
    comentarios: Optional[str] = Form(None, description="Comentario para bitácora"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("siniestros", "subir_archivo")),
):
    """
    Sube un archivo (foto, PDF, etc.) como documento del siniestro.
    Acepta imágenes, PDF, documentos Office y texto.
    """
    if not file.filename or not file.filename.strip():
        raise HTTPException(status_code=400, detail="Nombre de archivo vacío")

    content_type = (file.content_type or "").strip().lower()
    if not any(content_type.startswith(p) for p in ALLOWED_MIME_PREFIXES):
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no permitido: {content_type}. Se permiten imágenes, PDF y documentos.",
        )

    content = b""
    size = 0
    max_bytes = MAX_FILE_SIZE_MB * 1024 * 1024
    while True:
        chunk = file.file.read(1024 * 1024)
        if not chunk:
            break
        size += len(chunk)
        if size > max_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"El archivo supera el límite de {MAX_FILE_SIZE_MB} MB.",
            )
        content += chunk

    if size == 0:
        raise HTTPException(status_code=400, detail="El archivo está vacío")

    # Guardar en disco: uploads/siniestros/{siniestro_id}/{uuid}_{nombre_original}
    dir_siniestro = UPLOAD_BASE / "siniestros" / str(siniestro_id)
    dir_siniestro.mkdir(parents=True, exist_ok=True)
    safe_name = "".join(c for c in file.filename if c.isalnum() or c in "._- ").strip() or "archivo"
    unique_name = f"{uuid_lib.uuid4().hex[:12]}_{safe_name}"
    file_path = dir_siniestro / unique_name
    with open(file_path, "wb") as f:
        f.write(content)
    ruta_relativa = f"uploads/siniestros/{siniestro_id}/{unique_name}"

    payload = DocumentoCreate(
        siniestro_id=siniestro_id,
        nombre_archivo=file.filename,
        ruta_archivo=ruta_relativa,
        contenido=None,
        tamaño_archivo=size,
        tipo_mime=content_type or "application/octet-stream",
        descripcion=descripcion or f"Archivo subido: {file.filename}",
        es_principal=False,
        es_adicional=True,
        usuario_subio=current_user.id,
        area_id=area_id,
        flujo_trabajo_id=flujo_trabajo_id,
        tipo_documento_id=tipo_documento_id,
        plantilla_documento_id=plantilla_documento_id,
    )
    documento = DocumentoService.create(db, payload)

    horas_bita = (Decimal(str(horas_trabajadas)) if horas_trabajadas is not None else Decimal("0"))
    if horas_bita < 0 or horas_bita > 24:
        horas_bita = Decimal("0")

    BitacoraActividadService.create(db, BitacoraActividadCreate(
        siniestro_id=documento.siniestro_id,
        usuario_id=current_user.id,
        tipo_actividad="documento",
        descripcion=f"Archivo subido: {documento.nombre_archivo}",
        horas_trabajadas=horas_bita,
        comentarios=comentarios.strip() if comentarios and comentarios.strip() else None,
        fecha_actividad=datetime.now(timezone.utc),
        area_id=documento.area_id,
        flujo_trabajo_id=documento.flujo_trabajo_id,
    ))
    NotificacionService.create(db, NotificacionCreate(
        usuario_id=current_user.id,
        siniestro_id=documento.siniestro_id,
        tipo="general",
        titulo="Archivo subido",
        mensaje=f"Se subió el archivo «{documento.nombre_archivo}» al siniestro.",
    ))

    # Auditoría: documento subido
    siniestro_obj = db.query(Siniestro).filter(Siniestro.id == documento.siniestro_id).first()
    empresa_id = siniestro_obj.empresa_id if siniestro_obj else current_user.empresa_id
    AuditoriaService.registrar_accion(
        db=db,
        usuario_id=current_user.id,
        empresa_id=empresa_id,
        accion="documento_subido",
        modulo="siniestros",
        tabla="siniestros",
        registro_id=documento.siniestro_id,
        descripcion=f"Archivo subido: {documento.nombre_archivo}",
        datos_nuevos={"nombre_archivo": documento.nombre_archivo, "documento_id": str(documento.id)},
    )

    return documento


@router.delete("/{documento_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_documento(
    documento_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Elimina lógicamente un documento"""
    documento = DocumentoService.get_by_id(db, documento_id)
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    siniestro_id = documento.siniestro_id
    nombre_archivo = documento.nombre_archivo
    ok = DocumentoService.delete(db, documento_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    # Auditoría: documento eliminado
    siniestro_obj = db.query(Siniestro).filter(Siniestro.id == siniestro_id).first()
    empresa_id = siniestro_obj.empresa_id if siniestro_obj else current_user.empresa_id
    AuditoriaService.registrar_accion(
        db=db,
        usuario_id=current_user.id,
        empresa_id=empresa_id,
        accion="documento_eliminado",
        modulo="siniestros",
        tabla="siniestros",
        registro_id=siniestro_id,
        descripcion=f"Documento eliminado: {nombre_archivo}",
        datos_nuevos={"nombre_archivo": nombre_archivo, "documento_id": str(documento_id)},
    )
    return None

