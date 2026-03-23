"""
Genera db/migrate_catalogos_litigio.sql desde los catálogos Excel de litigio.

Lee los mismos tres archivos que el plan; usa UUID determinísticos (uuid5) para
idempotencia. Requiere openpyxl.

Uso (desde la carpeta backend, con venv activo):
    python -m app.db.importadores.generar_sql_catalogos_litigio
    python -m app.db.importadores.generar_sql_catalogos_litigio --ruta-base ..
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from uuid import UUID, uuid5

from app.db.importadores.importar_catalogos import extraer_bloques_desde_hoja, slugify

# ---------------------------------------------------------------------------
# Constantes de negocio (plan)
# ---------------------------------------------------------------------------

ASLIN_NAMESPACE = UUID("018f2d6e-4b0a-7b3c-9d1e-0000a51c0001")

EMPRESA_ID = UUID("98507a8f-8c61-4da5-bd29-4d674c2ef257")
TIPO_PDF_ID = UUID("03a6cbdf-9f28-41f6-a1f3-50f92c08dd44")

ARCHIVOS: list[dict] = [
    {
        "ruta": "recursos/CATALOGO PENAL-ASLIN.xlsx",
        "hojas": [
            {
                "indice": 0,
                "nombre_flujo": "Litigio Penal - Acusatorio",
                "area_id": UUID("697c62b9-7147-430f-9303-484be5cc49b4"),
            },
            {
                "indice": 1,
                "nombre_flujo": "Litigio Penal - Tradicional",
                "area_id": UUID("697c62b9-7147-430f-9303-484be5cc49b4"),
            },
        ],
    },
    {
        "ruta": "recursos/CATALOGO CIVIL-ASLIN.xlsx",
        "hojas": [
            {
                "indice": 0,
                "nombre_flujo": "Litigio Civil",
                "area_id": UUID("da71ce1c-cc73-4308-be0c-8d70260f7250"),
            },
        ],
    },
    {
        "ruta": "recursos/CATALOGO SERV. PÚB. ASLIN.xlsx",
        "hojas": [
            {
                "indice": 0,
                "nombre_flujo": "Litigio Servidores Públicos",
                "area_id": UUID("0f051097-9fa8-474d-b5fa-8518e070f6fd"),
            },
        ],
    },
]


def sql_literal(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def sql_uuid(u: UUID) -> str:
    return f"'{u}'::uuid"


def trunc_cat_nombre(nombre: str) -> str:
    if len(nombre) <= 100:
        return nombre
    return nombre[:97] + "..."


def flujo_uuid(nombre_flujo: str) -> UUID:
    return uuid5(ASLIN_NAMESPACE, f"flujo:{nombre_flujo.strip()}")


def etapa_uuid(flujo_id: UUID, orden: int) -> UUID:
    return uuid5(ASLIN_NAMESPACE, f"etapa:{flujo_id}:{orden}")


def categoria_uuid(nombre_doc: str) -> UUID:
    return uuid5(ASLIN_NAMESPACE, f"cat_pdf:{nombre_doc.strip()}")


def requisito_uuid(etapa_id: UUID, orden_req: int, nombre_doc: str) -> UUID:
    return uuid5(
        ASLIN_NAMESPACE,
        f"req:{etapa_id}:{orden_req}:{nombre_doc.strip()}",
    )


def clave_unica_por_etapa(usadas: set[str], base: str) -> str:
    s = slugify(base)[:100] or "doc"
    if s not in usadas:
        usadas.add(s)
        return s
    n = 2
    while True:
        cand = f"{s}_{n}"[:100]
        if cand not in usadas:
            usadas.add(cand)
            return cand
        n += 1


def generar_sql(ruta_base: Path) -> str:
    lineas: list[str] = [
        "-- Catálogos litigio ASLIN → PostgreSQL",
        "-- Generado por app.db.importadores.generar_sql_catalogos_litigio",
        "-- Idempotente: ON CONFLICT (id) DO UPDATE",
        "",
        "BEGIN;",
        "",
    ]

    flujos_meta: list[tuple[UUID, str, UUID]] = []
    etapas_plan: list[tuple[UUID, UUID, str, int]] = []
    categorias_vistas: dict[UUID, str] = {}
    requisitos_plan: list[tuple] = []

    try:
        import openpyxl
    except ImportError:
        raise RuntimeError("openpyxl no está instalado. pip install openpyxl") from None

    for archivo_cfg in ARCHIVOS:
        ruta_excel = ruta_base / archivo_cfg["ruta"]
        if not ruta_excel.exists():
            print(f"AVISO: no existe {ruta_excel}", file=sys.stderr)
            continue

        wb = openpyxl.load_workbook(str(ruta_excel), read_only=True, data_only=True)
        for hoja_cfg in archivo_cfg["hojas"]:
            idx = hoja_cfg["indice"]
            nombre_flujo = hoja_cfg["nombre_flujo"]
            area_id = hoja_cfg["area_id"]

            if idx >= len(wb.sheetnames):
                print(f"AVISO: hoja {idx} no existe en {ruta_excel.name}", file=sys.stderr)
                continue

            ws = wb.worksheets[idx]
            bloques = extraer_bloques_desde_hoja(ws)
            fid = flujo_uuid(nombre_flujo)
            flujos_meta.append((fid, nombre_flujo, area_id))

            for orden_e, bloque in enumerate(bloques, start=1):
                etapa_nombre = bloque["etapa"]
                if len(etapa_nombre) > 100:
                    etapa_nombre = etapa_nombre[:100]
                eid = etapa_uuid(fid, orden_e)
                etapas_plan.append((eid, fid, etapa_nombre, orden_e))

                claves_usadas: set[str] = set()
                for orden_r, nombre_doc in enumerate(bloque["documentos"], start=1):
                    if not nombre_doc or not str(nombre_doc).strip():
                        continue
                    nd = str(nombre_doc).strip()
                    if len(nd) > 255:
                        nd = nd[:255]
                    cid = categoria_uuid(nd)
                    categorias_vistas[cid] = trunc_cat_nombre(nd)
                    rid = requisito_uuid(eid, orden_r, nd)
                    clave = clave_unica_por_etapa(claves_usadas, nd)
                    requisitos_plan.append(
                        (rid, fid, eid, nd, cid, orden_r, clave)
                    )

        wb.close()

    # INSERT flujos
    lineas.append("-- flujos_trabajo")
    for fid, nombre_flujo, area_id in flujos_meta:
        lineas.append(
            f"INSERT INTO flujos_trabajo (id, empresa_id, area_id, nombre, descripcion, activo, es_predeterminado) "
            f"VALUES ({sql_uuid(fid)}, {sql_uuid(EMPRESA_ID)}, {sql_uuid(area_id)}, {sql_literal(nombre_flujo)}, "
            f"{sql_literal('Catálogo ASLIN (migración litigio)')}, true, false) "
            f"ON CONFLICT (id) DO UPDATE SET "
            f"nombre = EXCLUDED.nombre, area_id = EXCLUDED.area_id, "
            f"descripcion = EXCLUDED.descripcion, activo = EXCLUDED.activo, "
            f"actualizado_en = now();"
        )
    lineas.append("")

    lineas.append("-- etapas_flujo")
    for eid, fid, etapa_nombre, orden_e in etapas_plan:
        lineas.append(
            f"INSERT INTO etapas_flujo (id, flujo_trabajo_id, nombre, descripcion, orden, "
            f"es_obligatoria, permite_omision, tipo_documento_principal_id, categoria_documento_id, "
            f"plantilla_documento_id, inhabilita_siguiente, activo) "
            f"VALUES ({sql_uuid(eid)}, {sql_uuid(fid)}, {sql_literal(etapa_nombre)}, NULL, {orden_e}, "
            f"true, false, {sql_uuid(TIPO_PDF_ID)}, NULL, NULL, false, true) "
            f"ON CONFLICT (id) DO UPDATE SET "
            f"nombre = EXCLUDED.nombre, orden = EXCLUDED.orden, "
            f"tipo_documento_principal_id = EXCLUDED.tipo_documento_principal_id, "
            f"activo = EXCLUDED.activo, actualizado_en = now();"
        )
    lineas.append("")

    lineas.append("-- categorias_documento (tipo PDF)")
    for cid, nombre_cat in sorted(categorias_vistas.items(), key=lambda x: str(x[0])):
        lineas.append(
            f"INSERT INTO categorias_documento (id, tipo_documento_id, nombre, descripcion, activo) "
            f"VALUES ({sql_uuid(cid)}, {sql_uuid(TIPO_PDF_ID)}, {sql_literal(nombre_cat)}, NULL, true) "
            f"ON CONFLICT (id) DO UPDATE SET "
            f"nombre = EXCLUDED.nombre, tipo_documento_id = EXCLUDED.tipo_documento_id, "
            f"activo = EXCLUDED.activo, actualizado_en = now();"
        )
    lineas.append("")

    lineas.append("-- etapa_flujo_requisitos_documento")
    for rid, fid, eid, nd, cid, orden_r, clave in requisitos_plan:
        lineas.append(
            f"INSERT INTO etapa_flujo_requisitos_documento ("
            f"id, flujo_trabajo_id, etapa_flujo_id, nombre_documento, descripcion, "
            f"tipo_documento_id, categoria_documento_id, plantilla_documento_id, "
            f"es_obligatorio, permite_upload, permite_generar, multiple, orden, clave, activo) "
            f"VALUES ({sql_uuid(rid)}, {sql_uuid(fid)}, {sql_uuid(eid)}, {sql_literal(nd)}, NULL, "
            f"{sql_uuid(TIPO_PDF_ID)}, {sql_uuid(cid)}, NULL, true, true, false, false, {orden_r}, {sql_literal(clave)}, true) "
            f"ON CONFLICT (id) DO UPDATE SET "
            f"nombre_documento = EXCLUDED.nombre_documento, "
            f"categoria_documento_id = EXCLUDED.categoria_documento_id, "
            f"tipo_documento_id = EXCLUDED.tipo_documento_id, "
            f"orden = EXCLUDED.orden, clave = EXCLUDED.clave, "
            f"activo = EXCLUDED.activo, actualizado_en = now();"
        )

    lineas.append("")
    lineas.append("COMMIT;")
    return "\n".join(lineas) + "\n"


def _default_ruta_base() -> Path:
    # backend/app/db/importadores/ → parents[4] = raíz del repo Aslin
    return Path(__file__).resolve().parents[4]


def main() -> None:
    parser = argparse.ArgumentParser(description="Generar SQL de catálogos litigio ASLIN")
    parser.add_argument(
        "--ruta-base",
        type=Path,
        default=None,
        help="Raíz del repo (contiene recursos/). Por defecto: detectada desde este archivo.",
    )
    parser.add_argument(
        "--salida",
        type=Path,
        default=None,
        help="Archivo SQL de salida (por defecto: <ruta-base>/db/migrate_catalogos_litigio.sql)",
    )
    args = parser.parse_args()

    ruta_base = args.ruta_base or _default_ruta_base()
    salida = args.salida or (ruta_base / "db" / "migrate_catalogos_litigio.sql")

    sql_text = generar_sql(ruta_base)
    salida.parent.mkdir(parents=True, exist_ok=True)
    salida.write_text(sql_text, encoding="utf-8")
    print(f"Escrito: {salida} ({len(sql_text)} bytes)")


if __name__ == "__main__":
    main()
