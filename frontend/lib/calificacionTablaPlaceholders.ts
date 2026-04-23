/**
 * Variables de plantilla/PDF para la tabla de calificaciones del catálogo.
 * Tabla HTML completa; table-layout auto y saltos de línea para títulos largos.
 * Alineado con backend: app.api.routes.pdf_routes._merge_calificacion_placeholders
 */

const CALIF_TABLE_CLASS = "calificaciones-siniestro-dinamica";
/** Bordes negros; cabecera azul cielo (no gris). */
const CALIF_TABLE_STYLE =
  "width:100%;max-width:100%;border-collapse:collapse;table-layout:auto;margin:0.75em 0;border:1px solid #000;";
const CALIF_HEADER_BG = "#7de8ff";
const CALIF_TD_HEADER_BASE =
  `border:1px solid #000;padding:10px 8px;text-align:center;font-weight:bold;text-transform:uppercase;vertical-align:middle;box-sizing:border-box;white-space:normal;word-break:break-word;overflow-wrap:anywhere;line-height:1.35;min-width:4.75rem;background-color:${CALIF_HEADER_BG};color:#333;`;
const CALIF_TD_DATA_STYLE =
  "border:1px solid #000;padding:10px 8px;text-align:center;font-size:13px;vertical-align:middle;box-sizing:border-box;white-space:normal;min-width:4.75rem;line-height:1.4;background-color:#fff;color:#333;";

export type CalificacionCatalogItem = {
  id: string;
  nombre: string;
  orden?: number | null;
};

function escHtmlTextoCelda(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function headerFontPx(n: number): number {
  if (n > 8) return 9;
  if (n > 5) return 10;
  return 11;
}

/**
 * Primera fila: títulos; segunda: (X) solo donde id coincide con calificacionIdSiniestro.
 */
export function buildCalificacionPlantillaVariables(
  calificaciones: CalificacionCatalogItem[] | null | undefined,
  calificacionIdSiniestro: string | null | undefined,
): {
  calificaciones_headers_html: string;
  calificaciones_marcas_html: string;
  calificaciones_tabla_dos_filas_html: string;
} {
  const sorted = [...(calificaciones ?? [])].sort((a, b) => {
    const oa = a.orden ?? 0;
    const ob = b.orden ?? 0;
    if (oa !== ob) return oa - ob;
    return (a.nombre || "").localeCompare(b.nombre || "", "es", {
      sensitivity: "base",
    });
  });
  const n = sorted.length;
  const fpx = headerFontPx(n);
  const sel = calificacionIdSiniestro
    ? String(calificacionIdSiniestro).trim()
    : "";

  if (n === 0) {
    return {
      calificaciones_headers_html: "",
      calificaciones_marcas_html: "",
      calificaciones_tabla_dos_filas_html: "",
    };
  }

  const headers = sorted.map((c) => {
    const titulo = escHtmlTextoCelda(
      (c.nombre || "").trim().toLocaleUpperCase("es"),
    );
    const style = `${CALIF_TD_HEADER_BASE}font-size:${fpx}px;`;
    return `<td class="header-cell text-center" colspan="1" style="${style}">${titulo}</td>`;
  });
  const marks = sorted.map((c) => {
    const mark = sel && String(c.id) === sel ? "(X)" : "";
    return `<td class="data-cell text-center" colspan="1" style="${CALIF_TD_DATA_STYLE}">${mark}</td>`;
  });
  const hInner = headers.join("");
  const mInner = marks.join("");
  const innerRows = `<tr>\n${hInner}\n</tr>\n<tr>\n${mInner}\n</tr>`;
  return {
    calificaciones_headers_html: hInner,
    calificaciones_marcas_html: mInner,
    calificaciones_tabla_dos_filas_html: `<table lang="es" class="${CALIF_TABLE_CLASS}" style="${CALIF_TABLE_STYLE}"><tbody>${innerRows}</tbody></table>`,
  };
}
