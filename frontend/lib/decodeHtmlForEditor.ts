/**
 * Normaliza HTML que pudo guardarse o transportarse codificado (URL o entidades),
 * para mostrarlo/editarlo en Jodit u otros editores sin ver `%3C…` ni `&lt;p&gt;`.
 *
 * - URL: `decodeURIComponent` con `+` → espacio (form-urlencoded), hasta varias pasadas (doble encoding).
 * - Solo intenta URL-decode si el texto parece codificado (evita romper HTML válido con `%` sueltos).
 * - Entidades: si parece HTML escapado con `&lt;` sin etiqueta real al inicio, usa un `textarea` (solo en cliente).
 */

const PCT = /%[0-9A-Fa-f]{2}/i;

function looksLikeUrlEncodedHtml(s: string): boolean {
  if (!PCT.test(s)) return false;
  const t = s.trim().slice(0, 512);
  if (/^(%[0-9A-Fa-f]{2}){2,}/i.test(t)) return true;
  const encLt = t.search(/%3C|%3c/i);
  const rawLt = t.indexOf("<");
  if (encLt !== -1 && (rawLt === -1 || encLt < rawLt)) return true;
  return false;
}

function iterativeUrlDecode(s: string, maxPasses = 5): string {
  let current = s;
  for (let i = 0; i < maxPasses; i++) {
    const candidate = current.replace(/\+/g, " ");
    let decoded: string;
    try {
      decoded = decodeURIComponent(candidate);
    } catch {
      return current;
    }
    if (decoded === current) break;
    current = decoded;
    const t = current.trim();
    if (/^<[a-z?!]/i.test(t) || /^<!DOCTYPE/i.test(t)) break;
  }
  return current;
}

function tryDecodeHtmlEntitiesIfEscaped(s: string): string {
  const t = s.trim();
  if (/^<[a-z?!]/i.test(t) || /^<!DOCTYPE/i.test(t)) return s;
  if (typeof document === "undefined") return s;
  if (!/&lt;[a-z\/!]/i.test(t) && !/&#(?:60|x3c);/i.test(t)) return s;
  try {
    const ta = document.createElement("textarea");
    ta.innerHTML = s;
    const out = ta.value;
    if (out.includes("<") && !t.includes("<")) return out;
  } catch {
    /* ignore */
  }
  return s;
}

/**
 * Devuelve HTML listo para editor o `dangerouslySetInnerHTML`.
 */
export function decodeHtmlForEditor(raw: string | null | undefined): string {
  if (raw == null || raw === "") return "";
  let s = String(raw);
  s = tryDecodeHtmlEntitiesIfEscaped(s);
  if (looksLikeUrlEncodedHtml(s)) {
    s = iterativeUrlDecode(s);
  }
  return s;
}
