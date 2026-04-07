"""
Schemas para respuestas relacionadas con artefactos persistidos y operación de storage.
"""

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class GeneratedFileAccessResponse(BaseModel):
    success: bool
    message: str
    generated_file_id: UUID
    storage_object_id: UUID
    filename: str
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None
    provider: str
    url: str
    expires_in: Optional[int] = None


class StorageRuntimeStatusResponse(BaseModel):
    ready: bool
    configured_provider: str
    active_provider: Optional[str] = None
    r2_configured: bool
    local_root: str
    signed_url_ttl_seconds: int
    warnings: list[str] = Field(default_factory=list)


class StorageVerificationResponse(BaseModel):
    requested: bool
    available: bool
    warnings: list[str] = Field(default_factory=list)


class StorageSummaryCountsResponse(BaseModel):
    storage_objects_total: int
    storage_objects_active: int
    storage_objects_deleted: int
    generated_files_total: int
    documents_missing_storage_metadata: int
    orphan_storage_objects: int
    missing_physical_objects_sampled: int


class StorageObjectSampleResponse(BaseModel):
    id: str
    storage_path: str
    provider: str
    original_filename: str


class MissingPhysicalObjectSampleResponse(BaseModel):
    storage_object_id: str
    storage_path: str
    provider: str
    original_filename: str


class StorageSummarySamplesResponse(BaseModel):
    orphan_storage_objects: list[StorageObjectSampleResponse] = Field(default_factory=list)
    missing_physical_objects: list[MissingPhysicalObjectSampleResponse] = Field(default_factory=list)


class StorageSummaryResponse(BaseModel):
    runtime: StorageRuntimeStatusResponse
    verification: StorageVerificationResponse
    counts: StorageSummaryCountsResponse
    samples: StorageSummarySamplesResponse


class StorageReconciliationResponse(BaseModel):
    updated_storage_objects: int
    summary: StorageSummaryResponse
