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
