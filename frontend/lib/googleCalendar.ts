/**
 * Utilidades para almacenar y gestionar el token de Google Calendar
 */

const STORAGE_KEY = "google_calendar_token";
const EXPIRY_KEY = "google_calendar_token_expiry";

/**
 * Guarda el token de acceso de Google en localStorage
 */
export function saveGoogleToken(token: string, expiresInSeconds?: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, token);
    if (expiresInSeconds) {
      const expiry = Date.now() + expiresInSeconds * 1000;
      localStorage.setItem(EXPIRY_KEY, String(expiry));
    } else {
      localStorage.removeItem(EXPIRY_KEY);
    }
  } catch {
    // localStorage puede estar deshabilitado
  }
}

/**
 * Obtiene el token almacenado
 */
export function getStoredGoogleToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Verifica si hay un token válido (existe y no está expirado)
 */
export function isGoogleTokenValid(): boolean {
  const token = getStoredGoogleToken();
  if (!token) return false;
  try {
    const expiry = localStorage.getItem(EXPIRY_KEY);
    if (expiry) {
      const expiryMs = parseInt(expiry, 10);
      if (Date.now() >= expiryMs) return false;
    }
    return true;
  } catch {
    return !!token;
  }
}

/**
 * Elimina el token de Google del almacenamiento
 */
export function clearGoogleToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(EXPIRY_KEY);
  } catch {
    // ignore
  }
}
