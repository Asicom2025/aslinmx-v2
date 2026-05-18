/**
 * Utilidades de formato para números y moneda.
 * Formato de moneda: 10,000,000.00 (separador de miles por coma, 2 decimales).
 */

/**
 * Formatea un valor numérico como moneda.
 * - Separador de miles: coma (,)
 * - Decimales: 2
 * - Ejemplo: 10000000 -> "10,000,000.00"
 */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : Number(value);
  if (Number.isNaN(num)) return "";
  return num.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Parsea una cadena con formato de moneda a número.
 * - Quita comas y espacios
 * - Ejemplo: "10,000,000.00" -> 10000000
 */
export function parseCurrency(value: string): number {
  if (!value || typeof value !== "string") return 0;
  const cleaned = value.replace(/,/g, "").replace(/\s/g, "").trim();
  if (!cleaned) return 0;
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Extrae una fecha civil YYYY-MM-DD sin aplicar conversión de zona horaria.
 * Útil para fechas de negocio guardadas como datetime a medianoche.
 */
export function dateOnlyValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateOnlyYear(value: string | Date | null | undefined): number | null {
  const date = dateOnlyValue(value);
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

export function formatDateOnly(
  value: string | Date | null | undefined,
  fallback = "—",
): string {
  const date = dateOnlyValue(value);
  if (!date) return fallback;
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-MX");
}
