import sys
import types
from types import SimpleNamespace

from app.services.export_service import ExportService

pdf_service_stub = types.ModuleType("app.services.pdf_service")
pdf_service_stub.PDFService = object
sys.modules.setdefault("app.services.pdf_service", pdf_service_stub)

storage_service_stub = types.ModuleType("app.services.storage_service")
storage_service_stub.format_siniestro_id_legible = lambda *args, **kwargs: ""
sys.modules.setdefault("app.services.storage_service", storage_service_stub)

legal_service_stub = types.ModuleType("app.services.legal_service")
legal_service_stub.es_estado_cancelacion_por_nombre = lambda *args, **kwargs: False
sys.modules.setdefault("app.services.legal_service", legal_service_stub)

from app.services.reporte_service import _siniestro_id_sort_key


def test_siniestro_visible_id_sort_key_orders_by_origin_code_number_and_year():
    proveniente_a = "prov-a"
    proveniente_b = "prov-b"
    proveniente_codigo_por_id = {
        proveniente_a: "102",
        proveniente_b: "103",
    }
    siniestros = [
        SimpleNamespace(proveniente_id=proveniente_a, codigo="003", anualidad=2026),
        SimpleNamespace(proveniente_id=proveniente_a, codigo="001", anualidad=2026),
        SimpleNamespace(proveniente_id=proveniente_a, codigo="002", anualidad=2026),
        SimpleNamespace(proveniente_id=proveniente_a, codigo="001", anualidad=2024),
        SimpleNamespace(proveniente_id=proveniente_b, codigo="001", anualidad=2026),
        SimpleNamespace(proveniente_id=proveniente_a, codigo="001", anualidad=2025),
    ]

    ordered = sorted(
        siniestros,
        key=lambda item: _siniestro_id_sort_key(item, proveniente_codigo_por_id),
    )

    assert [
        f"{proveniente_codigo_por_id[item.proveniente_id]}-{item.codigo}-{item.anualidad % 100:02d}"
        for item in ordered
    ] == [
        "102-001-24",
        "102-001-25",
        "102-001-26",
        "102-002-26",
        "102-003-26",
        "103-001-26",
    ]


def test_csv_export_uses_utf8_bom_and_repairs_common_mojibake():
    csv_content = ExportService.export_to_csv(
        [{"pais": "M\u00c3\u00a9xico", "ciudad": "Quer\u00c3\u00a9taro"}],
        columnas=["pais", "ciudad"],
    )

    assert csv_content.startswith("\ufeff")
    assert "M\u00e9xico" in csv_content
    assert "Quer\u00e9taro" in csv_content
    assert "M\u00c3\u00a9xico" not in csv_content
