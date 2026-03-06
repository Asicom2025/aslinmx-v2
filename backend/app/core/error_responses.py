"""
Formato homologado de respuestas de error para la API.
Todas las respuestas de error deben ser: {"detail": str}
Así el frontend puede leer siempre response.data.detail como mensaje legible.
"""
from typing import Any, List


def _format_validation_item(item: dict) -> str:
    """Convierte un item de error de validación Pydantic en una línea legible."""
    msg = item.get("msg") or "Error de validación"
    loc = item.get("loc") or []
    if loc and len(loc) > 0:
        last = loc[-1]
        if isinstance(last, str) and last != "body":
            field = last.replace("_", " ").strip()
            return f"{field}: {msg}"
    return msg


def validation_errors_to_detail(errors: List[Any]) -> str:
    """
    Convierte la lista de errores de RequestValidationError (exc.errors())
    en un único mensaje de texto para el campo 'detail'.
    """
    if not errors:
        return "Error de validación. Revise los datos enviados."
    messages = []
    for item in errors:
        if isinstance(item, dict):
            messages.append(_format_validation_item(item))
        else:
            messages.append(str(item))
    return ". ".join(messages)


def ensure_detail_string(detail: Any) -> str:
    """
    Asegura que el valor de 'detail' sea siempre un string.
    - Si ya es string, se devuelve tal cual (strip).
    - Si es lista (errores Pydantic), se convierte con validation_errors_to_detail.
    - En otro caso se convierte a string.
    """
    if detail is None:
        return "Ha ocurrido un error."
    if isinstance(detail, str):
        return detail.strip() or "Ha ocurrido un error."
    if isinstance(detail, list):
        return validation_errors_to_detail(detail)
    return str(detail)
