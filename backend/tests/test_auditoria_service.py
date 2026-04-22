from app.services.auditoria_service import AuditoriaService


def test_sanitize_audit_payload_masks_sensitive_keys() -> None:
    payload = {
        "username": "user@acme.com",
        "password": "123456",
        "token": "abc",
        "smtp_password": "secret-value",
        "nested": {"authorization": "Bearer xyz", "safe": "ok"},
    }
    sanitized = AuditoriaService.sanitize_audit_payload(payload)
    assert sanitized["username"] == "user@acme.com"
    assert sanitized["password"] == "[REDACTED]"
    assert sanitized["token"] == "[REDACTED]"
    assert sanitized["smtp_password"] == "[REDACTED]"
    assert sanitized["nested"]["authorization"] == "[REDACTED]"
    assert sanitized["nested"]["safe"] == "ok"


def test_sanitize_audit_payload_keeps_non_sensitive_data() -> None:
    payload = {"nombre": "SMTP Principal", "puerto": 587, "activo": True}
    sanitized = AuditoriaService.sanitize_audit_payload(payload)
    assert sanitized == payload
