/**
 * Almacena en localStorage los siniestros que el usuario ha visitado recientemente,
 * para mostrarlos en el dashboard como "Siniestros recientes" (últimos visitados).
 */

const STORAGE_KEY = "siniestros_recientes_visitados";
const MAX_ITEMS = 10;

export interface RecentSiniestroItem {
  id: string;
  numero_siniestro: string | null;
  fecha_siniestro: string | null;
  prioridad: string;
  estado_id?: string | null;
  area_principal_id?: string | null;
}

function getStored(): RecentSiniestroItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is RecentSiniestroItem =>
        x && typeof x === "object" && typeof (x as RecentSiniestroItem).id === "string"
    );
  } catch {
    return [];
  }
}

function setStored(items: RecentSiniestroItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // ignore
  }
}

/**
 * Devuelve la lista de siniestros visitados recientemente (máx. MAX_ITEMS).
 */
export function getRecentVisitedSiniestros(): RecentSiniestroItem[] {
  return getStored();
}

/**
 * Registra una visita a un siniestro: lo coloca al inicio y elimina duplicados por id.
 */
export function addRecentVisitedSiniestro(item: RecentSiniestroItem): void {
  const list = getStored();
  const filtered = list.filter((x) => x.id !== item.id);
  setStored([item, ...filtered]);
}
