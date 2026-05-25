import sys
import types
from types import SimpleNamespace


config_module = types.ModuleType("app.core.config")
config_module.settings = SimpleNamespace(
    BASE_URL="http://localhost:3000",
    FRONTEND_URL="http://localhost:3000",
    EMAIL_LOGO_PATH="/assets/logos/logo_dx-legal.png",
    EMAIL_FILE_ICON_PATH="/assets/icons/file2.png",
)
sys.modules["app.core.config"] = config_module

from app.services.email_service import (
    EmailService,
    _normalize_attachment_metadata,
)


def test_noname_pdf_becomes_generic_pdf_name():
    name, content_type = _normalize_attachment_metadata(
        "noname",
        b"%PDF-1.7\n",
        content_type="application/pdf",
        index=1,
    )

    assert name == "adjunto_1.pdf"
    assert content_type == "application/pdf"


def test_name_without_extension_uses_mime_extension():
    name, content_type = _normalize_attachment_metadata(
        "reporte",
        b"abc",
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        index=2,
    )

    assert name == "adjunto_2.xlsx"
    assert content_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def test_generic_octet_stream_falls_back_to_content_signature():
    name, content_type = _normalize_attachment_metadata(
        "blob",
        b"%PDF-1.7\n",
        content_type="application/octet-stream",
        index=3,
    )

    assert name == "adjunto_3.pdf"
    assert content_type == "application/pdf"


def test_valid_unicode_filename_is_preserved():
    name, content_type = _normalize_attachment_metadata(
        "Póliza firmada 01.pdf",
        b"%PDF-1.7\n",
        content_type="application/pdf",
        index=1,
    )

    assert name == "Póliza firmada 01.pdf"
    assert content_type == "application/pdf"


def test_sync_email_uses_mixed_container_and_attachment_filename(monkeypatch):
    sent = {}

    class FakeSMTP:
        def __init__(self, *args, **kwargs):
            pass

        def starttls(self):
            pass

        def login(self, usuario, password):
            pass

        def send_message(self, message, to_addrs=None):
            sent["message"] = message
            sent["to_addrs"] = to_addrs

        def quit(self):
            pass

    monkeypatch.setattr("app.services.email_service.smtplib.SMTP", FakeSMTP)

    config = SimpleNamespace(
        usar_ssl=False,
        usar_tls=False,
        servidor="smtp.test",
        puerto=25,
        usuario="user",
        password="pass",
        remitente_nombre="Sistema",
        remitente_email="from@example.com",
    )

    ok, error = EmailService.send_email_sync(
        config=config,
        destinatarios=["to@example.com"],
        asunto="Prueba",
        cuerpo_texto="Hola",
        adjuntos_bytes=[("noname", b"%PDF-1.7\n", "application/pdf")],
    )

    assert ok is True
    assert error is None
    message = sent["message"]
    assert message.get_content_type() == "multipart/mixed"
    attachments = [
        part
        for part in message.walk()
        if part.get_content_disposition() == "attachment"
    ]
    assert len(attachments) == 1
    assert attachments[0].get_filename() == "adjunto_1.pdf"
