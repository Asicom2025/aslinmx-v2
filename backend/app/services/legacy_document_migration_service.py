"""
Servicios ligeros para importar archivos legacy usando la estructura actual de documentos.
"""

from __future__ import annotations

import mimetypes
import re
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlparse, unquote_plus
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, or_

from app.core.config import settings
from app.models.flujo_trabajo import EtapaFlujo, EtapaFlujoRequisitoDocumento, FlujoTrabajo
from app.models.legacy_temp import TmpSiniestroFile
from app.models.legal import (
    BitacoraActividad,
    Documento,
    Notificacion,
    Siniestro,
    SiniestroArea,
    TipoDocumento,
)
from app.models.user import User
from app.schemas.legacy_document_migration_schema import (
    LegacyClassificationSummary,
    LegacyDestinationCategoryResponse,
    LegacyDestinationFlowResponse,
    LegacyDestinationRequirementResponse,
    LegacyDestinationStageResponse,
    LegacyDestinationTypeResponse,
    LegacyDestinationsResponse,
    LegacyDetectedFileResponse,
    LegacyFinalizeRequest,
    LegacyFinalizeResponse,
    LegacyMigrationContextResponse,
)
from app.services.storage_metadata_service import StorageObjectService
from app.services.storage_service import StorageError, get_storage_service, resolve_siniestro_storage_ref

LEGACY_MARKER_RE = re.compile(r"\[LEGACY_ORIGEN:(.+?)\]")
PREVIEWABLE_MIME_PREFIXES = ("image/", "application/pdf", "text/")
EXCLUDED_FLOW_IDS = {""}
LEGACY_TMP_SOURCE_PREFIX = "tmp_siniestros_files:"
LEGACY_FILES_URL_PREFIX = "/backend/uploads/files/"
PROJECT_ROOT = Path(__file__).resolve().parents[2]
LEGACY_MIGRADO_NOT_FOUND = "not_found"


class LegacyDocumentMigrationService:
    """Importa documentos legacy sin alterar el modelo permanente."""

    @staticmethod
    def get_context(
        db: Session,
        siniestro_id: UUID,
        current_user: User,
        area_id: Optional[UUID] = None,
    ) -> LegacyMigrationContextResponse:
        siniestro = LegacyDocumentMigrationService._get_siniestro(db, siniestro_id, current_user)
        scanned_files = LegacyDocumentMigrationService._scan_legacy_files(db, siniestro, area_id)
        source_ref = LegacyDocumentMigrationService._build_legacy_source_reference(siniestro)

        imported_map = LegacyDocumentMigrationService._get_imported_documents_map(db, siniestro_id)
        imported_count = sum(1 for file_item in scanned_files if file_item["source_ref"] in imported_map)
        total_archivos = len(scanned_files)
        total_pendientes = max(total_archivos - imported_count, 0)
        if total_archivos == 0:
            estado = "sin_archivos"
        elif total_pendientes == 0:
            estado = "completado"
        else:
            estado = "pendiente"

        return LegacyMigrationContextResponse(
            estado=estado,
            requiere_modal=bool(settings.LEGACY_DOCUMENTS_ENABLED and total_pendientes > 0),
            legacy_folder_path_ref=source_ref,
            legacy_source_ref=source_ref,
            total_archivos=total_archivos,
            total_resueltos=imported_count,
            total_pendientes=total_pendientes,
            ultimo_escaneo_en=datetime.now(timezone.utc),
        )

    @staticmethod
    def list_files(
        db: Session,
        siniestro_id: UUID,
        current_user: User,
        area_id: Optional[UUID] = None,
    ) -> List[LegacyDetectedFileResponse]:
        siniestro = LegacyDocumentMigrationService._get_siniestro(db, siniestro_id, current_user)
        scanned_files = LegacyDocumentMigrationService._scan_legacy_files(db, siniestro, area_id)
        imported_map = LegacyDocumentMigrationService._get_imported_documents_map(db, siniestro_id)
        return [
            LegacyDocumentMigrationService._build_file_response(file_item, imported_map.get(file_item["source_ref"]))
            for file_item in scanned_files
        ]

    @staticmethod
    def get_destinations(
        db: Session,
        siniestro_id: UUID,
        current_user: User,
        area_id: Optional[UUID] = None,
    ) -> LegacyDestinationsResponse:
        siniestro = LegacyDocumentMigrationService._get_siniestro(db, siniestro_id, current_user)
        flows = LegacyDocumentMigrationService._get_allowed_flows(db, siniestro, current_user, area_id)
        return LegacyDestinationsResponse(flujos=flows)

    @staticmethod
    def get_preview_payload(
        db: Session,
        siniestro_id: UUID,
        archivo_id: str,
        current_user: User,
    ) -> tuple[bytes, str, str]:
        siniestro = LegacyDocumentMigrationService._get_siniestro(db, siniestro_id, current_user)
        source_file = LegacyDocumentMigrationService._get_legacy_file_record(db, siniestro, archivo_id)
        media_type = LegacyDocumentMigrationService._infer_mime_type(source_file)
        if not LegacyDocumentMigrationService._is_previewable(media_type):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Este archivo no tiene vista previa disponible.",
            )
        payload = LegacyDocumentMigrationService._download_remote_legacy_file(source_file)
        return payload["content"], payload["mime_type"], payload["filename"]

    @staticmethod
    def finalize(
        db: Session,
        siniestro_id: UUID,
        payload: LegacyFinalizeRequest,
        current_user: User,
        area_id: Optional[UUID] = None,
    ) -> LegacyFinalizeResponse:
        if not payload.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debes clasificar al menos un archivo antes de finalizar.",
            )

        siniestro = LegacyDocumentMigrationService._get_siniestro(db, siniestro_id, current_user)
        scanned_files = LegacyDocumentMigrationService._scan_legacy_files(db, siniestro, area_id)
        files_by_id = {item["id"]: item for item in scanned_files}
        imported_map = LegacyDocumentMigrationService._get_imported_documents_map(db, siniestro_id)
        requested_ids: list[str] = []
        duplicate_ids: set[str] = set()
        for item in payload.items:
            normalized_id = LegacyDocumentMigrationService._normalize_file_id(item.legacy_file_id)
            if normalized_id in requested_ids:
                duplicate_ids.add(normalized_id)
            requested_ids.append(normalized_id)

        if duplicate_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Se enviaron archivos repetidos en la finalización: {', '.join(sorted(duplicate_ids))}",
            )

        missing_ids = sorted(file_id for file_id in requested_ids if file_id not in files_by_id)
        if missing_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Los siguientes archivos ya no existen en la fuente legacy: {', '.join(missing_ids)}",
            )

        already_imported = sorted(
            files_by_id[file_id]["name"]
            for file_id in requested_ids
            if files_by_id[file_id]["source_ref"] in imported_map
        )
        if already_imported:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Estos archivos ya fueron importados: {', '.join(already_imported)}",
            )

        pending_file_ids = {
            item["id"]
            for item in scanned_files
            if item["source_ref"] not in imported_map
        }
        requested_set = set(requested_ids)
        if requested_set != pending_file_ids:
            missing_assignment = sorted(files_by_id[file_id]["name"] for file_id in (pending_file_ids - requested_set))
            extra_assignment = sorted(file_id for file_id in (requested_set - pending_file_ids))
            detail_parts: list[str] = []
            if missing_assignment:
                detail_parts.append(f"Faltan archivos por clasificar: {', '.join(missing_assignment)}")
            if extra_assignment:
                detail_parts.append(f"Se enviaron archivos inválidos: {', '.join(extra_assignment)}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=" ".join(detail_parts) or "La clasificación enviada no coincide con los archivos pendientes.",
            )

        flow_index = LegacyDocumentMigrationService._build_flow_index(
            LegacyDocumentMigrationService._get_allowed_flows(db, siniestro, current_user, area_id)
        )
        storage_service = get_storage_service()
        siniestro_storage_ref = resolve_siniestro_storage_ref(db, siniestro)
        created_storage_paths: list[str] = []
        created_documents: list[Documento] = []
        try:
            for item in payload.items:
                source_file = LegacyDocumentMigrationService._get_legacy_file_record(
                    db,
                    siniestro,
                    item.legacy_file_id,
                    area_id,
                )

                if item.flujo_trabajo_id is None and item.etapa_flujo_id is None:
                    if not area_id:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="Para clasificación solo por tipo/categoría (sin flujo ni etapa) se requiere area_id en la solicitud.",
                        )
                    destination_meta = {"area_id": area_id}
                elif item.flujo_trabajo_id is not None and item.etapa_flujo_id is None:
                    destination_meta = LegacyDocumentMigrationService._destination_meta_flujo_sin_etapa(
                        db,
                        siniestro,
                        current_user,
                        item.flujo_trabajo_id,
                        area_id,
                    )
                else:
                    destination_meta = LegacyDocumentMigrationService._validate_destination(flow_index, item)
                downloaded_file = LegacyDocumentMigrationService._download_remote_legacy_file(source_file)
                mime_type = downloaded_file["mime_type"]
                stored_file = storage_service.put_document_bytes(
                    siniestro_id=str(siniestro_id),
                    siniestro_storage_ref=siniestro_storage_ref,
                    original_filename=downloaded_file["filename"],
                    data=downloaded_file["content"],
                    content_type=mime_type,
                )
                created_storage_paths.append(stored_file.storage_path)
                storage_object = StorageObjectService.create(
                    db,
                    empresa_id=siniestro.empresa_id,
                    stored_file=stored_file,
                    original_filename=downloaded_file["filename"],
                    mime_type=mime_type,
                    size_bytes=len(downloaded_file["content"]),
                    creado_por=current_user.id,
                    metadata_json={
                        "source_kind": "legacy_finalize",
                        "legacy_source_ref": LegacyDocumentMigrationService._build_legacy_record_source_ref(source_file.id),
                        "legacy_file_id": str(source_file.id),
                        "legacy_timerst": source_file.timerst,
                        "legacy_url": source_file.url,
                        "siniestro_id": str(siniestro_id),
                    },
                )
                description = LegacyDocumentMigrationService._build_document_description(
                    downloaded_file["filename"],
                    LegacyDocumentMigrationService._build_legacy_record_source_ref(source_file.id),
                )

                doc_creado_en, doc_actualizado_en = (
                    LegacyDocumentMigrationService._document_timestamps_from_legacy(source_file)
                )

                document = Documento(
                    siniestro_id=siniestro_id,
                    tipo_documento_id=item.tipo_documento_id,
                    etapa_flujo_id=item.etapa_flujo_id,
                    plantilla_documento_id=None,
                    area_id=destination_meta["area_id"],
                    flujo_trabajo_id=item.flujo_trabajo_id,
                    requisito_documento_id=item.requisito_documento_id,
                    storage_object_id=storage_object.id,
                    nombre_archivo=downloaded_file["filename"],
                    ruta_archivo=stored_file.storage_path,
                    contenido=None,
                    tamaño_archivo=len(downloaded_file["content"]),
                    tipo_mime=mime_type,
                    usuario_subio=current_user.id,
                    version=1,
                    descripcion=description,
                    es_principal=False,
                    es_adicional=True,
                    activo=True,
                    eliminado=False,
                    creado_en=doc_creado_en,
                    actualizado_en=doc_actualizado_en,
                )
                db.add(document)
                created_documents.append(document)

                db.add(
                    BitacoraActividad(
                        siniestro_id=siniestro_id,
                        usuario_id=current_user.id,
                        tipo_actividad="documento",
                        descripcion=f"Se cargó un archivo {downloaded_file['filename']} al siniestro.",
                        horas_trabajadas=0,
                        fecha_actividad=doc_creado_en,
                        comentarios=None,
                        area_id=destination_meta["area_id"],
                        flujo_trabajo_id=item.flujo_trabajo_id,
                        creado_en=doc_creado_en,
                    )
                )
                db.add(
                    Notificacion(
                        usuario_id=current_user.id,
                        siniestro_id=siniestro_id,
                        tipo="general",
                        titulo="Archivo importado",
                        mensaje=f"Se importó el archivo «{downloaded_file['filename']}» al siniestro.",
                    )
                )

            db.commit()
        except HTTPException:
            db.rollback()
            for storage_path in created_storage_paths:
                try:
                    storage_service.delete(storage_path)
                except StorageError:
                    pass
            raise
        except Exception as exc:
            db.rollback()
            for storage_path in created_storage_paths:
                try:
                    storage_service.delete(storage_path)
                except StorageError:
                    pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"No se pudieron importar los archivos legacy: {exc}",
            ) from exc

        return LegacyFinalizeResponse(
            documentos_creados=len(created_documents),
            total_solicitado=len(payload.items),
            total_archivos_pendientes=0,
        )

    @staticmethod
    def _get_siniestro(db: Session, siniestro_id: UUID, current_user: User) -> Siniestro:
        siniestro = (
            db.query(Siniestro)
            .filter(
                Siniestro.id == siniestro_id,
                Siniestro.empresa_id == current_user.empresa_id,
                Siniestro.eliminado == False,
            )
            .first()
        )
        if not siniestro:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Siniestro no encontrado.")
        return siniestro

    @staticmethod
    def _get_legacy_timerst(siniestro: Siniestro) -> Optional[str]:
        if not settings.LEGACY_DOCUMENTS_ENABLED:
            return None
        old_id = (getattr(siniestro, "old_id", None) or "").strip()
        return old_id or None

    @staticmethod
    def _build_legacy_source_reference(siniestro: Siniestro) -> Optional[str]:
        timerst = LegacyDocumentMigrationService._get_legacy_timerst(siniestro)
        if not timerst:
            return None
        return f"tmp_siniestros_files.timerst={timerst}"

    @staticmethod
    def _build_legacy_record_source_ref(record_id: int | str) -> str:
        return f"{LEGACY_TMP_SOURCE_PREFIX}{record_id}"

    @staticmethod
    def _document_timestamps_from_legacy(record: TmpSiniestroFile) -> tuple[datetime, datetime]:
        """Replica tmp_siniestros_files.fecha en documentos.creado_en / actualizado_en (UTC)."""
        now = datetime.now(timezone.utc)
        fe = record.fecha
        if fe is None:
            return now, now
        if getattr(fe, "tzinfo", None) is None:
            creado = fe.replace(tzinfo=timezone.utc)
        else:
            creado = fe.astimezone(timezone.utc)
        return creado, creado

    @staticmethod
    def _normalize_file_id(file_id: str) -> str:
        normalized = str(file_id or "").strip()
        if not normalized or not normalized.isdigit():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El identificador del archivo legacy no es válido.")
        return normalized

    @staticmethod
    def _get_legacy_file_query(db: Session, siniestro: Siniestro):
        return LegacyDocumentMigrationService._get_legacy_file_query_for_area(db, siniestro, None)

    @staticmethod
    def _get_legacy_file_query_for_area(
        db: Session,
        siniestro: Siniestro,
        area_id: Optional[UUID],
    ):
        timerst = LegacyDocumentMigrationService._get_legacy_timerst(siniestro)
        if not timerst:
            return None

        query = (
            db.query(TmpSiniestroFile)
            .filter(
                func.btrim(TmpSiniestroFile.timerst) == timerst,
                func.coalesce(TmpSiniestroFile.estatus, True) == True,
                TmpSiniestroFile.url.isnot(None),
                func.btrim(TmpSiniestroFile.url) != "",
                or_(
                    TmpSiniestroFile.migrado.is_(None),
                    TmpSiniestroFile.migrado != LEGACY_MIGRADO_NOT_FOUND,
                ),
            )
        )
        if area_id:
            # Archivos con area_id IS NULL son compartidos y se muestran en todas las áreas.
            # Archivos con area_id de otra área se excluyen.
            query = query.filter(
                or_(
                    TmpSiniestroFile.area_id == area_id,
                    TmpSiniestroFile.area_id.is_(None),
                )
            )
        return query

    @staticmethod
    def _scan_legacy_files(
        db: Session,
        siniestro: Siniestro,
        area_id: Optional[UUID] = None,
    ) -> list[dict[str, Any]]:
        query = LegacyDocumentMigrationService._get_legacy_file_query_for_area(db, siniestro, area_id)
        if query is None:
            return []

        files: list[dict[str, Any]] = []
        marked_not_found = False
        for record in query.order_by(TmpSiniestroFile.fecha.desc().nullslast(), TmpSiniestroFile.id.asc()).all():
            if not LegacyDocumentMigrationService._legacy_source_file_exists(record):
                record.migrado = LEGACY_MIGRADO_NOT_FOUND
                marked_not_found = True
                continue
            filename = LegacyDocumentMigrationService._resolve_remote_filename(record)
            mime_type = LegacyDocumentMigrationService._infer_mime_type(record)
            files.append(
                {
                    "id": str(record.id),
                    "file_id": str(record.id),
                    "source_ref": LegacyDocumentMigrationService._build_legacy_record_source_ref(record.id),
                    "timerst": record.timerst,
                    "url": str(record.url).strip(),
                    "name": filename,
                    "extension": PurePosixPath(filename).suffix.lower().lstrip(".") or None,
                    "size": None,
                    "modified_at": record.fecha,
                    "mime_type": mime_type,
                    "previewable": LegacyDocumentMigrationService._is_previewable(mime_type),
                    "version": record.version,
                    "area_id": record.area_id,
                    "etapa": record.etapa,
                }
            )
        if marked_not_found:
            db.commit()
        return files

    @staticmethod
    def _get_legacy_file_record(
        db: Session,
        siniestro: Siniestro,
        file_id: str,
        area_id: Optional[UUID] = None,
    ) -> TmpSiniestroFile:
        query = LegacyDocumentMigrationService._get_legacy_file_query_for_area(db, siniestro, area_id)
        if query is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No hay fuente legacy disponible para este siniestro.")

        normalized_id = int(LegacyDocumentMigrationService._normalize_file_id(file_id))
        record = query.filter(TmpSiniestroFile.id == normalized_id).first()
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo legacy no encontrado.")
        return record

    @staticmethod
    def _resolve_remote_filename(record: TmpSiniestroFile) -> str:
        explicit_name = PurePosixPath(unquote_plus((record.nombre or "").strip())).name
        if explicit_name:
            return explicit_name

        parsed = urlparse((record.url or "").strip())
        candidate = PurePosixPath(unquote_plus(parsed.path or "")).name
        return candidate or f"legacy_{record.id}"

    @staticmethod
    def _infer_mime_type(record: TmpSiniestroFile, response_content_type: Optional[str] = None) -> str:
        if response_content_type:
            return response_content_type.split(";", 1)[0].strip() or "application/octet-stream"

        filename = LegacyDocumentMigrationService._resolve_remote_filename(record)
        guessed = mimetypes.guess_type(filename)[0]
        if guessed:
            return guessed

        parsed = urlparse((record.url or "").strip())
        guessed_from_url = mimetypes.guess_type(unquote_plus(parsed.path or ""))[0]
        return guessed_from_url or "application/octet-stream"

    @staticmethod
    def _find_legacy_local_path(record: TmpSiniestroFile) -> Optional[Path]:
        """Resuelve ruta local si el archivo existe y está bajo raíces permitidas; si no, None."""
        raw_url = str(record.url or "").strip()
        if not raw_url:
            return None

        parsed = urlparse(raw_url)
        if parsed.scheme in {"http", "https"}:
            return None

        decoded_path = unquote_plus(parsed.path or raw_url).strip()
        if not decoded_path:
            return None

        legacy_root = Path(settings.LEGACY_DOCUMENTS_ROOT).expanduser().resolve() if settings.LEGACY_DOCUMENTS_ROOT else None
        upload_root = (PROJECT_ROOT / settings.UPLOAD_DIR).resolve()
        allowed_roots = [PROJECT_ROOT.resolve()]
        if legacy_root:
            allowed_roots.insert(0, legacy_root)
        allowed_roots.append(upload_root)

        candidate_paths: list[Path] = []

        def append_candidate(path: Path) -> None:
            candidate_paths.append(path.resolve())

        raw_path = Path(decoded_path)
        if raw_path.is_absolute():
            append_candidate(raw_path)

        if legacy_root and decoded_path.startswith(LEGACY_FILES_URL_PREFIX):
            relative_path = decoded_path[len(LEGACY_FILES_URL_PREFIX) :].lstrip("/")
            append_candidate(legacy_root / relative_path)

        if decoded_path.startswith(LEGACY_FILES_URL_PREFIX):
            relative_path = decoded_path[len(LEGACY_FILES_URL_PREFIX) :].lstrip("/")
            append_candidate(upload_root / "files" / relative_path)

        append_candidate(PROJECT_ROOT / decoded_path.lstrip("/"))

        for candidate in candidate_paths:
            if not candidate.exists() or not candidate.is_file():
                continue
            if any(candidate == root or root in candidate.parents for root in allowed_roots):
                return candidate
        return None

    @staticmethod
    def _legacy_remote_url_exists(url: str) -> bool:
        try:
            with httpx.Client(
                timeout=settings.LEGACY_DOCUMENTS_REMOTE_TIMEOUT_SECONDS,
                follow_redirects=True,
            ) as client:
                response = client.head(url)
                if response.status_code in (405, 501):
                    response = client.get(url, headers={"Range": "bytes=0-0"})
                return 200 <= response.status_code < 400
        except httpx.HTTPError:
            return False

    @staticmethod
    def _legacy_source_file_exists(record: TmpSiniestroFile) -> bool:
        raw_url = str(record.url or "").strip()
        if not raw_url:
            return False
        parsed = urlparse(raw_url)
        if parsed.scheme in {"http", "https"}:
            return LegacyDocumentMigrationService._legacy_remote_url_exists(raw_url)
        return LegacyDocumentMigrationService._find_legacy_local_path(record) is not None

    @staticmethod
    def _resolve_legacy_local_path(record: TmpSiniestroFile) -> Path:
        local = LegacyDocumentMigrationService._find_legacy_local_path(record)
        if local is not None:
            return local

        raw_url = str(record.url or "").strip()
        legacy_root = Path(settings.LEGACY_DOCUMENTS_ROOT).expanduser().resolve() if settings.LEGACY_DOCUMENTS_ROOT else None
        detail = f"No se encontró el archivo legacy {record.id} en la ruta configurada."
        if legacy_root:
            detail = f"{detail} URL={raw_url} raíz={legacy_root}"
        else:
            detail = f"{detail} URL={raw_url}"
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)

    @staticmethod
    def _download_remote_legacy_file(record: TmpSiniestroFile) -> dict[str, Any]:
        url = (record.url or "").strip()
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            local_path = LegacyDocumentMigrationService._resolve_legacy_local_path(record)
            try:
                content = local_path.read_bytes()
            except OSError as exc:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"No se pudo leer el archivo legacy {record.id}: {exc}",
                ) from exc

            filename = LegacyDocumentMigrationService._resolve_remote_filename(record)
            mime_type = LegacyDocumentMigrationService._infer_mime_type(record)
            return {
                "filename": filename,
                "mime_type": mime_type,
                "content": content,
                "content_length": len(content),
            }

        try:
            with httpx.Client(
                timeout=settings.LEGACY_DOCUMENTS_REMOTE_TIMEOUT_SECONDS,
                follow_redirects=True,
            ) as client:
                response = client.get(url)
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    f"No se pudo descargar el archivo legacy {record.id}. "
                    f"La fuente remota respondió {exc.response.status_code}."
                ),
            ) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"No se pudo descargar el archivo legacy {record.id}: {exc}",
            ) from exc

        filename = LegacyDocumentMigrationService._resolve_remote_filename(record)
        mime_type = LegacyDocumentMigrationService._infer_mime_type(
            record,
            response.headers.get("content-type"),
        )
        return {
            "filename": filename,
            "mime_type": mime_type,
            "content": response.content,
            "content_length": len(response.content),
        }

    @staticmethod
    def _get_imported_documents_map(
        db: Session,
        siniestro_id: UUID,
    ) -> Dict[str, LegacyClassificationSummary]:
        documents = (
            db.query(Documento)
            .filter(
                Documento.siniestro_id == siniestro_id,
                Documento.eliminado == False,
                Documento.activo == True,
                Documento.descripcion.isnot(None),
            )
            .order_by(Documento.creado_en.desc())
            .all()
        )

        stage_ids = {doc.etapa_flujo_id for doc in documents if doc.etapa_flujo_id}
        flow_ids = {doc.flujo_trabajo_id for doc in documents if doc.flujo_trabajo_id}
        type_ids = {doc.tipo_documento_id for doc in documents if doc.tipo_documento_id}
        requirement_ids = {doc.requisito_documento_id for doc in documents if doc.requisito_documento_id}

        stage_map = {}
        if stage_ids:
            stage_map = {
                stage.id: stage
                for stage in db.query(EtapaFlujo)
                .options(joinedload(EtapaFlujo.categoria_documento))
                .filter(EtapaFlujo.id.in_(stage_ids))
                .all()
            }
        flow_map = {}
        if flow_ids:
            flow_map = {
                flow.id: flow for flow in db.query(FlujoTrabajo).filter(FlujoTrabajo.id.in_(flow_ids)).all()
            }
        type_map = {}
        if type_ids:
            type_map = {
                tipo.id: tipo for tipo in db.query(TipoDocumento).filter(TipoDocumento.id.in_(type_ids)).all()
            }
        requirement_map = {}
        if requirement_ids:
            requirement_map = {
                req.id: req
                for req in db.query(EtapaFlujoRequisitoDocumento)
                .options(joinedload(EtapaFlujoRequisitoDocumento.categoria_documento))
                .filter(EtapaFlujoRequisitoDocumento.id.in_(requirement_ids))
                .all()
            }

        imported: Dict[str, LegacyClassificationSummary] = {}
        for document in documents:
            source_ref = LegacyDocumentMigrationService._extract_legacy_marker(document.descripcion)
            if not source_ref or source_ref in imported:
                continue
            stage = stage_map.get(document.etapa_flujo_id) if document.etapa_flujo_id else None
            requirement = (
                requirement_map.get(document.requisito_documento_id) if document.requisito_documento_id else None
            )
            category = requirement.categoria_documento if requirement and requirement.categoria_documento else None
            if not category and stage and stage.categoria_documento:
                category = stage.categoria_documento
            imported[source_ref] = LegacyClassificationSummary(
                flujo_trabajo_id=document.flujo_trabajo_id,
                flujo_trabajo_nombre=flow_map.get(document.flujo_trabajo_id).nombre
                if document.flujo_trabajo_id and flow_map.get(document.flujo_trabajo_id)
                else None,
                etapa_flujo_id=document.etapa_flujo_id,
                etapa_flujo_nombre=stage.nombre if stage else None,
                tipo_documento_id=document.tipo_documento_id,
                tipo_documento_nombre=type_map.get(document.tipo_documento_id).nombre
                if document.tipo_documento_id and type_map.get(document.tipo_documento_id)
                else None,
                categoria_documento_id=category.id if category else None,
                categoria_documento_nombre=category.nombre if category else None,
                documento_id=document.id,
            )
        return imported

    @staticmethod
    def _build_file_response(
        file_item: dict[str, Any],
        imported_summary: Optional[LegacyClassificationSummary],
    ) -> LegacyDetectedFileResponse:
        return LegacyDetectedFileResponse(
            id=file_item["id"],
            legacy_source_ref=file_item["source_ref"],
            legacy_file_id=file_item["file_id"],
            legacy_timerst=file_item["timerst"],
            legacy_url=file_item["url"],
            nombre_archivo=file_item["name"],
            extension=file_item["extension"],
            size_bytes=file_item["size"],
            fecha_archivo=file_item["modified_at"],
            tipo_mime=file_item["mime_type"],
            legacy_version=file_item["version"],
            legacy_area_id=file_item["area_id"],
            legacy_etapa=file_item["etapa"],
            estado_revision="clasificado" if imported_summary else "pendiente",
            previewable=file_item["previewable"],
            clasificacion=imported_summary,
        )

    @staticmethod
    def _get_allowed_flows(
        db: Session,
        siniestro: Siniestro,
        current_user: User,
        area_id: Optional[UUID] = None,
    ) -> List[LegacyDestinationFlowResponse]:
        siniestro_area_ids = {
            area_id
            for (area_id,) in db.query(SiniestroArea.area_id).filter(
                SiniestroArea.siniestro_id == siniestro.id,
                SiniestroArea.activo == True,
                SiniestroArea.eliminado == False,
            ).all()
            if area_id
        }
        if not siniestro_area_ids:
            return []

        scoped_area_ids = siniestro_area_ids
        if area_id:
            if area_id not in siniestro_area_ids:
                return []
            scoped_area_ids = {area_id}

        query = (
            db.query(FlujoTrabajo)
            .options(
                selectinload(FlujoTrabajo.etapas).joinedload(EtapaFlujo.categoria_documento),
                selectinload(FlujoTrabajo.etapas).joinedload(EtapaFlujo.tipo_documento_principal),
                selectinload(FlujoTrabajo.etapas)
                .selectinload(EtapaFlujo.requisitos)
                .joinedload(EtapaFlujoRequisitoDocumento.tipo_documento),
                selectinload(FlujoTrabajo.etapas)
                .selectinload(EtapaFlujo.requisitos)
                .joinedload(EtapaFlujoRequisitoDocumento.categoria_documento),
            )
            .filter(
                FlujoTrabajo.empresa_id == current_user.empresa_id,
                FlujoTrabajo.activo == True,
                FlujoTrabajo.eliminado_en.is_(None),
                FlujoTrabajo.area_id.in_(scoped_area_ids),
            )
        )

        flows = [
            flow
            for flow in query.order_by(FlujoTrabajo.nombre.asc()).all()
            if str(flow.id) not in EXCLUDED_FLOW_IDS
        ]
        return [LegacyDocumentMigrationService._build_flow_response(flow) for flow in flows]

    @staticmethod
    def _build_flow_response(flow: FlujoTrabajo) -> LegacyDestinationFlowResponse:
        categories: dict[str, dict[str, Any]] = {}

        for stage in sorted(
            [item for item in flow.etapas if item.activo and item.eliminado_en is None],
            key=lambda current: (current.orden, current.nombre.lower()),
        ):
            stage_default_category_id = stage.categoria_documento.id if stage.categoria_documento else None
            stage_default_category_name = stage.categoria_documento.nombre if stage.categoria_documento else stage.nombre

            stage_category_targets: list[
                tuple[
                    Optional[UUID],
                    str,
                    bool,
                    Optional[UUID],
                    Optional[str],
                    Optional[EtapaFlujoRequisitoDocumento],
                ]
            ] = []

            if stage.tipo_documento_principal_id:
                stage_category_targets.append(
                    (
                        stage_default_category_id,
                        stage_default_category_name,
                        stage.categoria_documento is None,
                        stage.tipo_documento_principal_id,
                        stage.tipo_documento_principal.nombre if stage.tipo_documento_principal else None,
                        None,
                    )
                )

            for requirement in [
                req for req in stage.requisitos if req.activo and req.eliminado_en is None and req.permite_upload
            ]:
                category_id = requirement.categoria_documento.id if requirement.categoria_documento else stage_default_category_id
                category_name = (
                    requirement.categoria_documento.nombre
                    if requirement.categoria_documento
                    else stage_default_category_name
                )
                stage_category_targets.append(
                    (
                        category_id,
                        category_name,
                        category_id is None,
                        requirement.tipo_documento_id or stage.tipo_documento_principal_id,
                        requirement.tipo_documento.nombre
                        if requirement.tipo_documento
                        else (stage.tipo_documento_principal.nombre if stage.tipo_documento_principal else None),
                        requirement,
                    )
                )

            if not stage_category_targets:
                stage_category_targets.append(
                    (
                        stage_default_category_id,
                        stage_default_category_name,
                        stage.categoria_documento is None,
                        None,
                        None,
                        None,
                    )
                )

            for category_id, category_name, synthetic, type_id, type_name, requirement in stage_category_targets:
                category_key = str(category_id) if category_id else f"stage:{stage.id}"
                category_payload = categories.setdefault(
                    category_key,
                    {
                        "id": category_id,
                        "clave": category_key,
                        "nombre": category_name or stage.nombre,
                        "synthetic": synthetic,
                        "etapas": {},
                    },
                )
                stage_payload = category_payload["etapas"].setdefault(
                    str(stage.id),
                    {
                        "id": stage.id,
                        "nombre": stage.nombre,
                        "orden": stage.orden,
                        "tipos": {},
                    },
                )

                if type_id:
                    type_payload = stage_payload["tipos"].setdefault(
                        str(type_id),
                        {
                            "id": type_id,
                            "nombre": type_name or "Tipo documental",
                            "requisitos": {},
                        },
                    )
                    if requirement:
                        type_payload["requisitos"][str(requirement.id)] = LegacyDestinationRequirementResponse(
                            id=requirement.id,
                            nombre_documento=requirement.nombre_documento,
                            tipo_documento_id=requirement.tipo_documento_id,
                            tipo_documento_nombre=requirement.tipo_documento.nombre
                            if requirement.tipo_documento
                            else None,
                        )

        categories_response: list[LegacyDestinationCategoryResponse] = []
        for category in categories.values():
            stages_response: list[LegacyDestinationStageResponse] = []
            for stage in sorted(category["etapas"].values(), key=lambda current: (current["orden"], current["nombre"].lower())):
                types_response: list[LegacyDestinationTypeResponse] = []
                for type_item in stage["tipos"].values():
                    requirements = sorted(
                        type_item["requisitos"].values(),
                        key=lambda current: current.nombre_documento.lower(),
                    )
                    types_response.append(
                        LegacyDestinationTypeResponse(
                            id=type_item["id"],
                            nombre=type_item["nombre"],
                            requisitos=requirements,
                        )
                    )
                stages_response.append(
                    LegacyDestinationStageResponse(
                        id=stage["id"],
                        nombre=stage["nombre"],
                        orden=stage["orden"],
                        tipos_documento=types_response,
                    )
                )
            categories_response.append(
                LegacyDestinationCategoryResponse(
                    id=category["id"],
                    clave=category["clave"],
                    nombre=category["nombre"],
                    synthetic=category["synthetic"],
                    etapas=stages_response,
                )
            )

        categories_response.sort(key=lambda current: current.nombre.lower())
        return LegacyDestinationFlowResponse(
            id=flow.id,
            nombre=flow.nombre,
            area_id=flow.area_id,
            area_nombre=None,
            categorias=categories_response,
        )

    @staticmethod
    def _build_flow_index(
        flows: Iterable[LegacyDestinationFlowResponse],
    ) -> dict[str, Any]:
        flow_index: dict[str, Any] = {}
        for flow in flows:
            categories_by_stage: dict[str, set[str]] = {}
            requirements_by_id: dict[str, Any] = {}
            stages_by_id: dict[str, Any] = {}
            for category in flow.categorias:
                for stage in category.etapas:
                    stage_state = stages_by_id.setdefault(
                        str(stage.id),
                        {
                            "stage": stage,
                            "type_ids": set(),
                        },
                    )
                    categories_by_stage.setdefault(str(stage.id), set()).add(str(category.id) if category.id else category.clave)
                    for doc_type in stage.tipos_documento:
                        stage_state["type_ids"].add(str(doc_type.id))
                        for requirement in doc_type.requisitos:
                            requirements_by_id[str(requirement.id)] = {
                                "requirement": requirement,
                                "type_id": str(doc_type.id),
                                "category_id": str(category.id) if category.id else None,
                                "category_key": category.clave,
                                "stage_id": str(stage.id),
                            }
            flow_index[str(flow.id)] = {
                "flow": flow,
                "stages_by_id": stages_by_id,
                "requirements_by_id": requirements_by_id,
                "categories_by_stage": categories_by_stage,
            }
        return flow_index

    @staticmethod
    def _destination_meta_flujo_sin_etapa(
        db: Session,
        siniestro: Siniestro,
        current_user: User,
        flujo_id: UUID,
        area_id_from_query: Optional[UUID],
    ) -> dict[str, UUID]:
        """Documento con tipo/categoría de catálogo pero asociado a un flujo (sin etapa)."""
        flow = (
            db.query(FlujoTrabajo)
            .filter(
                FlujoTrabajo.id == flujo_id,
                FlujoTrabajo.empresa_id == current_user.empresa_id,
                FlujoTrabajo.activo == True,
                FlujoTrabajo.eliminado_en.is_(None),
            )
            .first()
        )
        if not flow:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El flujo indicado no es válido o no está activo.",
            )
        if str(flow.id) in EXCLUDED_FLOW_IDS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El flujo indicado no está disponible para importación legacy.",
            )

        siniestro_area_ids = {
            aid
            for (aid,) in db.query(SiniestroArea.area_id).filter(
                SiniestroArea.siniestro_id == siniestro.id,
                SiniestroArea.activo == True,
                SiniestroArea.eliminado == False,
            ).all()
            if aid
        }
        if not siniestro_area_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El siniestro no tiene áreas asignadas.",
            )

        if flow.area_id is not None:
            if flow.area_id not in siniestro_area_ids:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="El flujo no pertenece a las áreas asignadas a este siniestro.",
                )
            return {"area_id": flow.area_id}

        if not area_id_from_query:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Para flujos generales (sin área propia) se requiere area_id en la solicitud.",
            )
        if area_id_from_query not in siniestro_area_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="area_id no está asignada a este siniestro.",
            )
        return {"area_id": area_id_from_query}

    @staticmethod
    def _validate_destination(
        flow_index: dict[str, Any],
        item: Any,
    ) -> dict[str, Optional[UUID]]:
        flow_state = flow_index.get(str(item.flujo_trabajo_id))
        if not flow_state:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"El flujo {item.flujo_trabajo_id} no está disponible para este siniestro.",
            )

        stage_state = flow_state["stages_by_id"].get(str(item.etapa_flujo_id))
        if not stage_state:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"La etapa {item.etapa_flujo_id} no pertenece al flujo seleccionado.",
            )

        stage_categories = flow_state["categories_by_stage"].get(str(item.etapa_flujo_id), set())
        requested_category = str(item.categoria_documento_id) if item.categoria_documento_id else None
        if requested_category and requested_category not in stage_categories:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La categoría seleccionada no corresponde a la etapa elegida.",
            )

        if str(item.tipo_documento_id) not in stage_state["type_ids"]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El tipo documental no está habilitado para la etapa seleccionada.",
            )

        if item.requisito_documento_id:
            requirement_state = flow_state["requirements_by_id"].get(str(item.requisito_documento_id))
            if not requirement_state:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="El requisito documental seleccionado no pertenece al flujo elegido.",
                )
            if requirement_state["stage_id"] != str(item.etapa_flujo_id):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="El requisito documental no corresponde a la etapa seleccionada.",
                )
            if requirement_state["type_id"] != str(item.tipo_documento_id):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="El requisito documental no coincide con el tipo seleccionado.",
                )
            if requested_category and requirement_state["category_id"] and requirement_state["category_id"] != requested_category:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="El requisito documental no coincide con la categoría seleccionada.",
                )

        return {
            "area_id": flow_state["flow"].area_id,
        }

    @staticmethod
    def _build_document_description(
        original_name: str,
        source_ref: str,
    ) -> str:
        parts = [original_name, f"[LEGACY_ORIGEN:{source_ref}]"]
        return "\n".join(parts)

    @staticmethod
    def _extract_legacy_marker(description: Optional[str]) -> Optional[str]:
        if not description:
            return None
        match = LEGACY_MARKER_RE.search(description)
        if not match:
            return None
        return LegacyDocumentMigrationService._normalize_legacy_source_ref(match.group(1))

    @staticmethod
    def _normalize_legacy_source_ref(source_ref: Optional[str]) -> Optional[str]:
        normalized = str(source_ref or "").strip()
        return normalized or None

    @staticmethod
    def _is_previewable(mime_type: str) -> bool:
        return any(mime_type.startswith(prefix) for prefix in PREVIEWABLE_MIME_PREFIXES)

    @staticmethod
    def _sanitize_filename(filename: str) -> str:
        safe_name = "".join(char for char in filename if char.isalnum() or char in "._- ").strip()
        return safe_name or "archivo"
