"""
Schemas para respuestas relacionadas con artefactos persistidos en storage.
"""

from typing import Optional
from uuid import UUID

from pydantic import BaseModel


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
