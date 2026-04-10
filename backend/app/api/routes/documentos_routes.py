"""
Rutas API para documentos
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal
import io

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form, Request
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.core.config import settings
from app.core.security import get_current_active_user
from app.core.permisos import require_permiso
from app.models.user import User
from app.schemas.legal_schema import (
    DocumentoCreate, DocumentoUpdate, DocumentoResponse,
    BitacoraActividadCreate,
    NotificacionCreate,
)
from app.models.legal import PlantillaDocumento, Siniestro
from app.models.flujo_trabajo import EtapaFlujoRequisitoDocumento
from app.services.legal_service import (
    DocumentoService,
    BitacoraActividadService,
    NotificacionService,
)
from app.services.auditoria_service import AuditoriaService
from app.services.storage_metadata_service import StorageObjectService
from app.services.storage_service import (
    StorageConfigurationError,
    StorageError,
    StorageNotFoundError,
    get_storage_service,
    resolve_siniestro_storage_ref,
)

router = APIRouter(prefix="/documentos", tags=["Documentos"])

ALLOWED_MIME_PREFIXES = ("image/", "application/pdf", "application/msword", "application/vnd.", "text/")
MAX_FILE_SIZE_MB = 25


def _categoria_documento_nombre_por_documento(
    doc,
    reqs_por_id: dict,
    plantillas_por_id: dict,
) -> Optional[str]:
    """Resuelve el nombre de categoría desde requisito documental o plantilla."""
    if getattr(doc, "requisito_documento_id", None):
        req = reqs_por_id.get(doc.requisito_documento_id)
        if req and req.categoria_documento:
            return req.categoria_documento.nombre
    if doc.plantilla_documento_id:
        pl = plantillas_por_id.get(doc.plantilla_documento_id)
        if pl and pl.categoria:
            return pl.categoria.nombre
    return None


def _build_archivo_access_payload(documento, request: Request) -> dict:
    if not getattr(documento, "ruta_archivo", None):
        return {"archivo_url": None, "archivo_url_expira_en": None}

    storage_service = get_storage_service()
    provider = (
        getattr(getattr(documento, "storage_object", None), "provider", None)
        or storage_service.get_provider_for_path(documento.ruta_archivo)
    )

    if provider == "r2":
        try:
            return {
                "archivo_url": storage_service.get_download_url(
                    documento.ruta_archivo,
                    filename=documento.nombre_archivo or "archivo",
                    expires_in=settings.STORAGE_SIGNED_URL_TTL_SECONDS,
                ),
                "archivo_url_expira_en": settings.STORAGE_SIGNED_URL_TTL_SECONDS,
            }
        except StorageError:
            return {"archivo_url": None, "archivo_url_expira_en": None}

    return {
        "archivo_url": str(request.url_for("get_documento_archivo", documento_id=documento.id)),
        "archivo_url_expira_en": None,
    }


def _build_documento_response(
    documento,
    *,
    request: Request,
    categoria_documento_nombre: Optional[str] = None,
    plantilla_tiene_continuacion: Optional[bool] = None,
) -> DocumentoResponse:
    response = DocumentoResponse.model_validate(documento)
    payload = response.model_dump()
    payload.update(_build_archivo_access_payload(documento, request))
    if categoria_documento_nombre is not None:
        payload["categoria_documento_nombre"] = categoria_documento_nombre
    if plantilla_tiene_continuacion is not None:
        payload["plantilla_tiene_continuacion"] = plantilla_tiene_continuacion
    return DocumentoResponse(**payload)


@router.get("/siniestros/{siniestro_id}", response_model=List[DocumentoResponse])
def list_documentos_siniestro(
    request: Request,
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
    plantillas_por_id = {}
    if plantilla_ids:
        plantillas = (
            db.query(PlantillaDocumento)
            .options(joinedload(PlantillaDocumento.categoria))
            .filter(PlantillaDocumento.id.in_(plantilla_ids))
            .all()
        )
        plantillas_por_id = {p.id: p for p in plantillas}
    tiene_continuacion = {
        str(p.id): bool(
            getattr(p, "plantilla_continuacion_id", None)
            and getattr(p, "campos_formulario", None)
            and len(p.campos_formulario or []) > 0
        )
        for p in plantillas_por_id.values()
    }
    req_ids = {d.requisito_documento_id for d in documents if d.requisito_documento_id}
    reqs_por_id = {}
    if req_ids:
        reqs = (
            db.query(EtapaFlujoRequisitoDocumento)
            .options(joinedload(EtapaFlujoRequisitoDocumento.categoria_documento))
            .filter(EtapaFlujoRequisitoDocumento.id.in_(req_ids))
            .all()
        )
        reqs_por_id = {r.id: r for r in reqs}
    result = []
    for doc in documents:
        flag = (
            tiene_continuacion.get(str(doc.plantilla_documento_id), False)
            if doc.plantilla_documento_id
            else None
        )
        cat_nombre = _categoria_documento_nombre_por_documento(
            doc, reqs_por_id, plantillas_por_id
        )
        result.append(
            _build_documento_response(
                doc,
                request=request,
                plantilla_tiene_continuacion=flag,
                categoria_documento_nombre=cat_nombre,
            )
        )
    return result


@router.get("/{documento_id}", response_model=DocumentoResponse)
def get_documento(
    documento_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Obtiene un documento por ID"""
    documento = DocumentoService.get_by_id(db, documento_id)
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return _build_documento_response(documento, request=request)


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

    storage_service = get_storage_service()
    try:
        local_path = storage_service.resolve_local_path(documento.ruta_archivo)
        if local_path and local_path.exists() and local_path.is_file():
            return FileResponse(
                local_path,
                media_type=documento.tipo_mime or "application/octet-stream",
                filename=documento.nombre_archivo or "archivo",
            )
        content = storage_service.get_bytes(documento.ruta_archivo)
    except StorageNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Archivo no encontrado en el storage configurado") from exc
    except StorageConfigurationError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except StorageError as exc:
        raise HTTPException(status_code=500, detail=f"No se pudo recuperar el archivo: {exc}") from exc

    return StreamingResponse(
        io.BytesIO(content),
        media_type=documento.tipo_mime or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{documento.nombre_archivo or "archivo"}"'
        },
    )


@router.get("/{documento_id}/archivo-url")
def get_documento_archivo_url(
    documento_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Obtiene una URL de descarga directa del archivo asociado."""
    documento = DocumentoService.get_by_id(db, documento_id)
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if not documento.ruta_archivo:
        raise HTTPException(status_code=404, detail="Este documento no tiene archivo asociado")

    storage_service = get_storage_service()
    provider = (
        getattr(getattr(documento, "storage_object", None), "provider", None)
        or storage_service.get_provider_for_path(documento.ruta_archivo)
    )
    try:
        if provider == "r2":
            url = storage_service.get_download_url(
                documento.ruta_archivo,
                filename=documento.nombre_archivo or "archivo",
                expires_in=settings.STORAGE_SIGNED_URL_TTL_SECONDS,
            )
            return {
                "url": url,
                "provider": provider,
                "filename": documento.nombre_archivo or "archivo",
                "expires_in": settings.STORAGE_SIGNED_URL_TTL_SECONDS,
            }
    except StorageError as exc:
        raise HTTPException(status_code=500, detail=f"No se pudo firmar la URL del archivo: {exc}") from exc

    return {
        "url": str(request.url_for("get_documento_archivo", documento_id=documento_id)),
        "provider": "local",
        "filename": documento.nombre_archivo or "archivo",
        "expires_in": None,
    }


@router.post("", response_model=DocumentoResponse, status_code=status.HTTP_201_CREATED)
def create_documento(
    payload: DocumentoCreate,
    request: Request,
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

    return _build_documento_response(documento, request=request)


@router.put("/{documento_id}", response_model=DocumentoResponse)
def update_documento(
    documento_id: UUID,
    payload: DocumentoUpdate,
    request: Request,
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

    return _build_documento_response(documento, request=request)


@router.post("/upload", response_model=DocumentoResponse, status_code=status.HTTP_201_CREATED)
def upload_documento_archivo(
    request: Request,
    siniestro_id: UUID = Form(...),
    file: UploadFile = File(...),
    descripcion: Optional[str] = Form(None),
    area_id: Optional[UUID] = Form(None),
    flujo_trabajo_id: Optional[UUID] = Form(None),
    etapa_flujo_id: Optional[UUID] = Form(None),
    tipo_documento_id: Optional[UUID] = Form(None),
    plantilla_documento_id: Optional[UUID] = Form(None),
    requisito_documento_id: Optional[UUID] = Form(None, description="ID del requisito documental al que pertenece"),
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

    storage_service = get_storage_service()
    siniestro_obj = db.query(Siniestro).filter(Siniestro.id == siniestro_id).first()
    if not siniestro_obj:
        raise HTTPException(status_code=404, detail="Siniestro no encontrado")
    try:
        siniestro_storage_ref = resolve_siniestro_storage_ref(db, siniestro_obj)
        stored_file = storage_service.put_document_bytes(
            siniestro_id=str(siniestro_id),
            siniestro_storage_ref=siniestro_storage_ref,
            original_filename=file.filename,
            data=content,
            content_type=content_type or "application/octet-stream",
        )
    except StorageError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo guardar el archivo en el storage configurado: {exc}",
        ) from exc

    storage_object = None
    try:
        storage_object = StorageObjectService.create(
            db,
            empresa_id=siniestro_obj.empresa_id,
            stored_file=stored_file,
            original_filename=file.filename,
            mime_type=content_type or "application/octet-stream",
            size_bytes=size,
            creado_por=current_user.id,
            metadata_json={
                "source_kind": "documento_upload",
                "siniestro_id": str(siniestro_id),
            },
        )
    except Exception as exc:
        db.rollback()
        try:
            storage_service.delete(stored_file.storage_path)
        except StorageError:
            pass
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo registrar la metadata del archivo: {exc}",
        ) from exc

    payload = DocumentoCreate(
        siniestro_id=siniestro_id,
        storage_object_id=storage_object.id if storage_object else None,
        nombre_archivo=file.filename,
        ruta_archivo=stored_file.storage_path,
        contenido=None,
        tamaño_archivo=size,
        tipo_mime=content_type or "application/octet-stream",
        descripcion=descripcion or f"Archivo subido: {file.filename}",
        es_principal=False,
        es_adicional=True,
        usuario_subio=current_user.id,
        area_id=area_id,
        flujo_trabajo_id=flujo_trabajo_id,
        etapa_flujo_id=etapa_flujo_id,
        tipo_documento_id=tipo_documento_id,
        plantilla_documento_id=plantilla_documento_id,
        requisito_documento_id=requisito_documento_id,
    )
    try:
        documento = DocumentoService.create(db, payload)
    except Exception as exc:
        db.rollback()
        try:
            storage_service.delete(stored_file.storage_path)
        except StorageError:
            pass
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo registrar el documento después de guardar el archivo: {exc}",
        ) from exc

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

    return _build_documento_response(documento, request=request)


@router.delete("/{documento_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_documento(
    documento_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permiso("siniestros", "subir_archivo")),
):
    """Elimina lógicamente un documento (sigue existiendo en base de datos)."""
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
