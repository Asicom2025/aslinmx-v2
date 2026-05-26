import zipfile
from io import BytesIO

import pytest

from app.services.file_validation_service import validate_safe_document_file


def _zip_with(path: str) -> bytes:
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(path, "ok")
    return buf.getvalue()


def test_allows_docx_with_word_zip_content():
    content_type = validate_safe_document_file(
        filename="contrato.docx",
        content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        data=_zip_with("word/document.xml"),
    )

    assert content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def test_allows_xlsx_with_excel_zip_content():
    content_type = validate_safe_document_file(
        filename="reporte.xlsx",
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        data=_zip_with("xl/workbook.xml"),
    )

    assert content_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def test_rejects_php_extension_even_if_text_plain():
    with pytest.raises(ValueError, match="Extensión"):
        validate_safe_document_file(
            filename="shell.php",
            content_type="text/plain",
            data=b"<?php echo 'x';",
        )


def test_rejects_env_extension():
    with pytest.raises(ValueError, match="Extensión"):
        validate_safe_document_file(
            filename=".env",
            content_type="text/plain",
            data=b"SECRET=1",
        )


def test_rejects_php_renamed_as_docx():
    with pytest.raises(ValueError, match="no coincide"):
        validate_safe_document_file(
            filename="contrato.docx",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            data=b"<?php echo 'x';",
        )
