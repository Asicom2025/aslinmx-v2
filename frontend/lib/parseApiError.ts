/**
 * Parsea las respuestas de error de la API (formato Pydantic/FastAPI)
 * para mostrar mensajes legibles en lugar de [object Object] o JSON crudo.
 */

export interface PydanticErrorItem {
  type?: string;
  loc?: (string | number)[];
  msg?: string;
  input?: unknown;
  ctx?: Record<string, unknown>;
  url?: string;
}

/** Nombres amigables para campos comunes (body.*) */
const FIELD_LABELS: Record<string, string> = {
  password: "Contraseña",
  email: "Correo electrónico",
  username: "Usuario",
  full_name: "Nombre completo",
  apellido_paterno: "Apellido paterno",
  apellido_materno: "Apellido materno",
  rol_id: "Rol",
  empresa_ids: "Empresas",
  is_active: "Estado activo",
  current_password: "Contraseña actual",
  new_password: "Nueva contraseña",
  nombre: "Nombre",
  descripcion: "Descripción",
  numero_siniestro: "Número de siniestro",
  prioridad: "Prioridad",
  estado_id: "Estado",
  // Añadir más según necesidad
};

function getFieldLabel(loc: (string | number)[] | undefined): string {
  if (!loc || loc.length === 0) return "";
  const last = loc[loc.length - 1];
  if (typeof last === "number") return "";
  const key = String(last);
  return FIELD_LABELS[key] || key.replace(/_/g, " ");
}

/** Traducciones de mensajes comunes de Pydantic al español */
const MSG_TRANSLATIONS: Record<string, string> = {
  "String should have at least 6 characters": "debe tener al menos 6 caracteres",
  "String should have at least 8 characters": "debe tener al menos 8 caracteres",
  "Value is not a valid email address": "no es un correo electrónico válido",
  "Field required": "es obligatorio",
  "Input should be a valid string": "debe ser un texto válido",
  "Input should be a valid integer": "debe ser un número entero válido",
  "Input should be a valid UUID": "identificador no válido",
};

function translateMsg(msg: string): string {
  return MSG_TRANSLATIONS[msg] ?? msg;
}

/**
 * Convierte un item de error de Pydantic en una línea legible.
 */
function formatErrorItem(item: PydanticErrorItem): string {
  const rawMsg = item.msg ?? "Error de validación";
  const msg = translateMsg(rawMsg);
  const label = getFieldLabel(item.loc);
  if (label) {
    return `${label}: ${msg}`;
  }
  return msg;
}

/**
 * Parsea `detail` de una respuesta de error de la API.
 * - Si es string, lo devuelve tal cual.
 * - Si es array de objetos con `msg` (formato Pydantic), devuelve mensajes concatenados.
 * - En otro caso devuelve un mensaje genérico.
 */
export function parseApiErrorDetail(detail: unknown): string {
  if (detail == null) {
    return "";
  }
  if (typeof detail === "string") {
    return detail.trim();
  }
  if (Array.isArray(detail)) {
    const messages = detail
      .filter((item): item is PydanticErrorItem => typeof item === "object" && item !== null && "msg" in item)
      .map(formatErrorItem);
    if (messages.length > 0) {
      return messages.join(". ");
    }
    return "Error de validación. Revise los datos enviados.";
  }
  if (typeof detail === "object" && detail !== null && "msg" in detail) {
    return formatErrorItem(detail as PydanticErrorItem);
  }
  return "";
}

/**
 * Obtiene un mensaje de error listo para mostrar al usuario desde
 * la respuesta de axios (error.response?.data).
 * Usa parseApiErrorDetail si existe detail; si no, intenta message u otro campo.
 */
export function getApiErrorMessage(
  data:
    | {
        detail?: unknown;
        message?: string;
        success?: boolean;
        error?: { message?: string; code?: string };
        details?: { validation_errors?: unknown };
        [key: string]: unknown;
      }
    | undefined,
  fallback: string = "Ha ocurrido un error. Intente de nuevo."
): string {
  if (!data) return fallback;

  const envErr = data.error;
  if (
    envErr &&
    typeof envErr === "object" &&
    typeof envErr.message === "string" &&
    envErr.message.trim()
  ) {
    return envErr.message.trim();
  }

  const ve = data.details?.validation_errors;
  if (Array.isArray(ve)) {
    const fromVe = parseApiErrorDetail(ve as unknown);
    if (fromVe) return fromVe;
  }

  const parsed = parseApiErrorDetail(data.detail);
  if (parsed) return parsed;
  if (typeof data.message === "string" && data.message.trim()) return data.message.trim();
  return fallback;
}

/**
 * Errores 403 (o equivalentes) por matriz de permisos / nivel de rol: no deben mostrarse
 * como modal al usuario; basta registrar en consola para diagnóstico.
 */
export function isPermissionDeniedApiMessage(message: unknown): boolean {
  if (typeof message !== "string") return false;
  const t = message.trim();
  if (t.startsWith("No tiene permiso")) return true;
  if (t === "No tiene un rol asignado") return true;
  if (t === "Su nivel de rol solo permite consultar siniestros asignados") return true;
  return false;
}
