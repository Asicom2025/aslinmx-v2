/**
 * ID legible del siniestro: proveniente-consecutivo-anualidad (2 dígitos del año).
 * Alineado con backend `storage_service.format_siniestro_id_legible`:
 * columna anualidad (año calendario) si existe; si no, fecha_registro → fecha_siniestro.
 */

export function formatSiniestroConsecutivo(
  value: string | number | null | undefined,
): string {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\D/g, "");
  if (!normalized) return "";
  return normalized.padStart(3, "0");
}

/** Últimos 2 dígitos del año de la fecha de referencia (misma prioridad que el API). */
export function anualidadDosDigitosFromFechas(
  fechaRegistro?: string | null,
  fechaSiniestro?: string | null,
): string | null {
  const raw = fechaRegistro || fechaSiniestro;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return String(d.getFullYear() % 100).padStart(2, "0");
}

/** Año calendario del API (columna anualidad) → dos dígitos; misma regla que backend. */
export function anualidadDosDigitosFromColumn(
  anualidad?: number | null,
): string | null {
  if (anualidad == null || Number.isNaN(Number(anualidad))) return null;
  const y = Math.trunc(Number(anualidad));
  return String(y % 100).padStart(2, "0");
}

/** Extrae la anualidad del tercer segmento de id_formato (ej. 102-001-26 → 26). */
export function anualidadFromIdFormato(idFormato?: string | null): string | null {
  if (!idFormato?.trim()) return null;
  const parts = idFormato.trim().split("-").filter((p) => p.length > 0);
  if (parts.length < 3) return null;
  const last = parts[parts.length - 1].trim();
  if (!/^\d{1,2}$/.test(last)) return null;
  return last.padStart(2, "0");
}

export function getSiniestroAnualidadDisplay(s: {
  id_formato?: string | null;
  anualidad?: number | null;
  fecha_registro?: string | null;
  fecha_siniestro?: string | null;
}): string {
  const fromFmt = anualidadFromIdFormato(s.id_formato);
  if (fromFmt) return fromFmt;
  const fromCol = anualidadDosDigitosFromColumn(s.anualidad);
  if (fromCol) return fromCol;
  return (
    anualidadDosDigitosFromFechas(s.fecha_registro, s.fecha_siniestro) ?? "—"
  );
}

/**
 * ID legible: usa `id_formato` del API si existe; si no, lo arma con las mismas reglas que el backend.
 */
export function buildSiniestroIdLegible(opts: {
  id_formato?: string | null;
  codigoProveniente: string;
  codigoSiniestro?: string | null;
  anualidad?: number | null;
  fecha_registro?: string | null;
  fecha_siniestro?: string | null;
}): string {
  if (opts.id_formato?.trim()) return opts.id_formato.trim();
  const prov = (opts.codigoProveniente || "").trim();
  const cons = formatSiniestroConsecutivo(opts.codigoSiniestro);
  const anu =
    anualidadDosDigitosFromColumn(opts.anualidad) ??
    anualidadDosDigitosFromFechas(opts.fecha_registro, opts.fecha_siniestro);
  if (prov && cons && anu) return `${prov}-${cons}-${anu}`;
  return "";
}
