/** Normaliza texto para comparar nombres de país/estado/municipio (sin acentos, minúsculas). */
export function normalizeGeoText(s: string | undefined | null): string {
  if (!s) return "";
  try {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return String(s).toLowerCase().trim();
  }
}
