import type { ColumnDef } from "@tanstack/react-table";

export const DATA_TABLE_LAYOUT_VERSION = 1;

export type DataTableLayoutPersisted = {
  v: number;
  columnOrder: string[];
  columnSizing: Record<string, number>;
  /** false = oculta; ausente en objeto = visible (TanStack) */
  columnVisibility?: Record<string, boolean>;
};

/**
 * IDs estables para persistencia de orden/tamaño (misma convención que TanStack Table).
 */
export function getColumnIdsFromDefs<TData>(columns: ColumnDef<TData, any>[]): string[] {
  return columns.map((col, index) => {
    const c = col as { id?: string; accessorKey?: string | number };
    if (c.id != null && c.id !== "") return String(c.id);
    if (c.accessorKey != null && c.accessorKey !== "") return String(c.accessorKey);
    return `col_${index}`;
  });
}

/** Conserva el orden guardado, añade columnas nuevas al final y elimina ids obsoletos. */
export function mergeColumnOrder(saved: string[], currentIds: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const id of saved) {
    if (currentIds.includes(id) && !seen.has(id)) {
      seen.add(id);
      next.push(id);
    }
  }
  for (const id of currentIds) {
    if (!seen.has(id)) next.push(id);
  }
  return next;
}

/** Conserva solo ids de columnas actuales (evita basura en localStorage). */
export function mergeColumnVisibility(
  saved: Record<string, boolean> | undefined,
  columnIds: string[],
): Record<string, boolean> {
  if (!saved || typeof saved !== "object") return {};
  const next: Record<string, boolean> = {};
  for (const id of columnIds) {
    if (Object.prototype.hasOwnProperty.call(saved, id)) {
      next[id] = Boolean(saved[id]);
    }
  }
  return next;
}

export function parseLayoutFromStorage(raw: string | null): DataTableLayoutPersisted | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<DataTableLayoutPersisted>;
    if (p.v !== DATA_TABLE_LAYOUT_VERSION) return null;
    if (!Array.isArray(p.columnOrder) || typeof p.columnSizing !== "object" || p.columnSizing === null) {
      return null;
    }
    const columnVisibility =
      p.columnVisibility !== undefined &&
      p.columnVisibility !== null &&
      typeof p.columnVisibility === "object" &&
      !Array.isArray(p.columnVisibility)
        ? (p.columnVisibility as Record<string, boolean>)
        : undefined;
    return {
      v: DATA_TABLE_LAYOUT_VERSION,
      columnOrder: p.columnOrder.map(String),
      columnSizing: p.columnSizing as Record<string, number>,
      ...(columnVisibility ? { columnVisibility } : {}),
    };
  } catch {
    return null;
  }
}
