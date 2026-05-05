"use client";

import {
  Column,
  ColumnDef,
  ColumnSizingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  Table,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiArrowDown,
  FiArrowUp,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiMenu,
} from "react-icons/fi";
import {
  DATA_TABLE_LAYOUT_VERSION,
  getColumnIdsFromDefs,
  mergeColumnOrder,
  mergeColumnVisibility,
  parseLayoutFromStorage,
  type DataTableLayoutPersisted,
} from "./dataTableLayout";

/**
 * Función helper para truncar texto a un número máximo de caracteres
 * @param text - Texto a truncar
 * @param maxLength - Longitud máxima (por defecto 50)
 * @returns Texto truncado con "..." si excede el límite
 */
export function truncateText(text: string | number | null | undefined, maxLength: number = 50): string {
  if (text === null || text === undefined) return "-";
  const textStr = String(text);
  if (textStr.length <= maxLength) return textStr;
  return textStr.substring(0, maxLength) + "...";
}

/**
 * Componente para renderizar texto truncado con tooltip
 */
export function TruncatedText({ 
  text, 
  maxLength = 50,
  className = ""
}: { 
  text: string | number | null | undefined; 
  maxLength?: number;
  className?: string;
}) {
  const textStr = text === null || text === undefined ? "-" : String(text);
  const truncated = truncateText(textStr, maxLength);
  const isTruncated = textStr.length > maxLength;

  if (!isTruncated) {
    return <span className={className}>{textStr}</span>;
  }

  return (
    <span 
      className={`${className} cursor-help`}
      title={textStr}
    >
      {truncated}
    </span>
  );
}

/**
 * Dentro de un `cell` de ColumnDef, indica si el DataTable tiene layout redimensionable
 * (`layoutStorageKey`). El texto se trunca con elipsis según el ancho de columna (sin wrap).
 */
export function isDataTableFluidLayout<TData>(table: Table<TData>): boolean {
  return Boolean((table.options.meta as { fluidCells?: boolean } | undefined)?.fluidCells);
}

function getColumnPickerLabel<TData>(column: Column<TData, unknown>): string {
  const meta = column.columnDef.meta as { columnPickerLabel?: string } | undefined;
  if (meta?.columnPickerLabel) return meta.columnPickerLabel;
  const h = column.columnDef.header;
  if (typeof h === "string") return h;
  return column.id;
}

type DataTableProps<TData> = {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  emptyText?: string;
  className?: string;
  enableSearch?: boolean;
  searchPlaceholder?: string;
  enablePagination?: boolean;
  enableSorting?: boolean;
  pageSize?: number;
  size?: "default" | "compact";
  maxTextLength?: number; // Longitud máxima de texto antes de truncar (por defecto 50)
  /**
   * Clave única en localStorage para guardar orden y anchos de columnas.
   * Si se define, el usuario puede redimensionar y arrastrar cabeceras para reordenar.
   * Las columnas deben tener `id` o `accessorKey` estable para que la preferencia sea fiable.
   */
  layoutStorageKey?: string;
  /** Mostrar selector para ocultar/mostrar columnas (requiere `layoutStorageKey`). Se persiste en el mismo JSON. */
  enableColumnVisibility?: boolean;
  /** Visibilidad inicial antes de hidratar localStorage; también se aplica al restablecer layout. */
  initialColumnVisibility?: Record<string, boolean>;
  /**
   * Si se define, el buscador global filtra por este texto (coincide con lo que ve el usuario)
   * en lugar de usar los valores crudos de las columnas (p. ej. UUIDs).
   */
  getGlobalSearchText?: (row: TData) => string;
};

export default function DataTable<TData>({ 
  columns, 
  data, 
  emptyText = "Sin datos", 
  className = "", 
  enableSearch = true, 
  searchPlaceholder = "Buscar...",
  enablePagination = true,
  enableSorting = true,
  pageSize = 10,
  size = "default",
  maxTextLength = 50,
  layoutStorageKey,
  enableColumnVisibility = false,
  initialColumnVisibility,
  getGlobalSearchText,
}: DataTableProps<TData>) {
  const [globalFilter, setGlobalFilter] = useState<string>("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => ({
    ...(initialColumnVisibility ?? {}),
  }));
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [prefsReady, setPrefsReady] = useState(!layoutStorageKey);
  const dragColId = useRef<string | null>(null);
  const skipNextPersistRef = useRef(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  const columnIds = useMemo(() => getColumnIdsFromDefs(columns), [columns]);
  const columnIdsKey = columnIds.join("|");
  const visibilityEnabled = Boolean(layoutStorageKey && enableColumnVisibility);

  useEffect(() => {
    if (!columnPickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (columnPickerRef.current?.contains(e.target as Node)) return;
      setColumnPickerOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [columnPickerOpen]);

  useEffect(() => {
    if (!layoutStorageKey) {
      setPrefsReady(true);
      return;
    }
    skipNextPersistRef.current = true;
    const raw = typeof window !== "undefined" ? localStorage.getItem(layoutStorageKey) : null;
    const parsed = parseLayoutFromStorage(raw);
    if (parsed) {
      setColumnSizing(parsed.columnSizing);
      setColumnOrder(mergeColumnOrder(parsed.columnOrder, columnIds));
      if (enableColumnVisibility) {
        setColumnVisibility(
          mergeColumnVisibility(parsed.columnVisibility, columnIds),
        );
      }
    } else {
      setColumnSizing({});
      setColumnOrder([...columnIds]);
      if (enableColumnVisibility) {
        setColumnVisibility(mergeColumnVisibility(initialColumnVisibility, columnIds));
      }
    }
    setPrefsReady(true);
  }, [layoutStorageKey, columnIdsKey, enableColumnVisibility, initialColumnVisibility]);

  useEffect(() => {
    if (!layoutStorageKey || !prefsReady) return;
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    const payload: DataTableLayoutPersisted = {
      v: DATA_TABLE_LAYOUT_VERSION,
      columnOrder,
      columnSizing,
      ...(enableColumnVisibility ? { columnVisibility } : {}),
    };
    try {
      localStorage.setItem(layoutStorageKey, JSON.stringify(payload));
    } catch {
      /* quota u otro error: ignorar */
    }
  }, [layoutStorageKey, prefsReady, columnOrder, columnSizing, columnVisibility, enableColumnVisibility]);

  const reorderColumns = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setColumnOrder((prev) => {
      const order = prev.length ? prev : [...columnIds];
      const from = order.indexOf(sourceId);
      const to = order.indexOf(targetId);
      if (from < 0 || to < 0) return order;
      const next = [...order];
      next.splice(from, 1);
      next.splice(to, 0, sourceId);
      return next;
    });
  }, [columnIds]);

  const resetColumnLayout = useCallback(() => {
    if (!layoutStorageKey) return;
    try {
      localStorage.removeItem(layoutStorageKey);
    } catch {
      /* ignore */
    }
    setColumnSizing({});
    setColumnOrder([...columnIds]);
    if (enableColumnVisibility) {
      setColumnVisibility({ ...(initialColumnVisibility ?? {}) });
    }
  }, [layoutStorageKey, columnIds, enableColumnVisibility, initialColumnVisibility]);

  const customizeLayout = Boolean(layoutStorageKey);
  const layoutActive = customizeLayout && prefsReady;

  const displayData = useMemo(() => {
    const base = data ?? [];
    const needle = (globalFilter ?? "").trim().toLowerCase();
    if (!enableSearch || !needle || !getGlobalSearchText) {
      return base;
    }
    return base.filter((row) =>
      (getGlobalSearchText(row) ?? "").toLowerCase().includes(needle),
    );
  }, [data, enableSearch, globalFilter, getGlobalSearchText]);

  const tableGlobalFilter = getGlobalSearchText ? "" : globalFilter;

  const table = useReactTable<TData>({
    data: displayData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    enableColumnResizing: layoutActive,
    columnResizeMode: "onEnd",
    columnResizeDirection: "ltr",
    onColumnSizingChange: layoutActive ? setColumnSizing : undefined,
    onColumnOrderChange: layoutActive ? setColumnOrder : undefined,
    enableHiding: layoutActive && visibilityEnabled,
    onColumnVisibilityChange: layoutActive && visibilityEnabled ? setColumnVisibility : undefined,
    state: {
      globalFilter: tableGlobalFilter,
      sorting,
      ...(layoutActive
        ? {
            columnSizing,
            columnOrder: columnOrder.length ? columnOrder : columnIds,
            ...(visibilityEnabled ? { columnVisibility } : {}),
          }
        : {}),
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    initialState: {
      pagination: {
        pageSize,
      },
    },
    defaultColumn: customizeLayout
      ? {
          minSize: 56,
          maxSize: 2000,
          size: 160,
        }
      : undefined,
    globalFilterFn: getGlobalSearchText
      ? () => true
      : (row, columnId, filterValue) => {
          const v = row.getValue<any>(columnId);
          const text = (v ?? "").toString().toLowerCase();
          return text.includes((filterValue ?? "").toString().toLowerCase());
        },
    meta: {
      fluidCells: layoutActive,
    },
  });

  const rows = table.getRowModel().rows;
  const totalRows = table.getFilteredRowModel().rows.length;
  const currentPage = table.getState().pagination.pageIndex;
  const totalPages = table.getPageCount();
  const pageSizeValue = table.getState().pagination.pageSize;
  const startRow = currentPage * pageSizeValue + 1;
  const endRow = Math.min((currentPage + 1) * pageSizeValue, totalRows);

  // Clases CSS según el tamaño
  const isCompact = size === "compact";
  const headerPadding = isCompact ? "px-3 py-2" : "px-4 py-3";
  const cellPadding = isCompact ? "px-3 py-2" : "px-4 py-3";
  const textSize = isCompact ? "text-xs" : "text-sm";
  const emptyPadding = isCompact ? "px-3 py-6" : "px-4 py-8";

  return (
    <div className={`w-full min-w-0 ${className}`}>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {enableSearch && (
          <div className="w-full min-w-0 sm:max-w-md sm:flex-1">
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {layoutActive && visibilityEnabled && (
            <div className="relative" ref={columnPickerRef}>
              <button
                type="button"
                onClick={() => setColumnPickerOpen((o) => !o)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                Columnas visibles
              </button>
              {columnPickerOpen && (
                <div
                  className="absolute right-0 z-50 mt-1 max-h-80 min-w-[260px] overflow-y-auto rounded-md border border-gray-200 bg-white py-2 shadow-lg"
                  role="menu"
                >
                  <div className="mb-1 flex items-center justify-between border-b border-gray-100 px-3 pb-2">
                    <span className="text-xs font-medium text-gray-500">Mostrar u ocultar</span>
                    <button
                      type="button"
                      className="text-xs text-primary-600 hover:underline"
                      onClick={() => table.toggleAllColumnsVisible(true)}
                    >
                      Todas
                    </button>
                  </div>
                  {table.getAllLeafColumns().map((column) => {
                    if (!column.getCanHide()) return null;
                    return (
                      <label
                        key={column.id}
                        className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={column.getIsVisible()}
                          onChange={column.getToggleVisibilityHandler()}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="min-w-0 flex-1 truncate">{getColumnPickerLabel(column)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {layoutActive && (
            <button
              type="button"
              onClick={resetColumnLayout}
              className="text-sm text-primary-600 hover:text-primary-800 underline-offset-2 hover:underline"
            >
              Restablecer columnas
            </button>
          )}
        </div>
        {enablePagination && totalRows > 0 && (
          <div className="flex w-full flex-wrap items-center gap-2 text-sm text-gray-600 sm:w-auto sm:justify-end">
            <span className="whitespace-nowrap">
              Mostrando {startRow} - {endRow} de {totalRows} registros
            </span>
            <select
              value={pageSizeValue}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}
      </div>

      <div
        className="-mx-px overflow-x-auto rounded-xl border border-gray-200/90 bg-white shadow-sm [scrollbar-gutter:stable]"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <table
          className={`min-w-full border-collapse divide-y divide-gray-200 ${
            layoutActive ? "table-fixed w-full" : "w-full table-auto"
          }`}
        >
          <thead className="sticky top-0 z-10 bg-gray-50/95 shadow-[inset_0_-1px_0_0_rgba(15,23,42,0.06)] backdrop-blur-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = enableSorting && header.column.getCanSort();
                  const sortDirection = header.column.getIsSorted();
                  const colId = header.column.id;
                  return (
                    <th
                      key={header.id}
                      style={
                        layoutActive
                          ? { width: header.getSize(), minWidth: header.getSize(), position: "relative" }
                          : undefined
                      }
                      className={`${headerPadding} text-left ${textSize} font-medium uppercase tracking-wide text-slate-600 align-middle ${layoutActive ? "min-w-0 max-w-0" : ""}`}
                      onDragOver={
                        layoutActive
                          ? (e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "move";
                            }
                          : undefined
                      }
                      onDrop={
                        layoutActive
                          ? (e) => {
                              e.preventDefault();
                              const src = dragColId.current || e.dataTransfer.getData("text/plain");
                              if (src) reorderColumns(src, colId);
                              dragColId.current = null;
                            }
                          : undefined
                      }
                    >
                      <div className="flex min-w-0 items-center gap-1">
                        {layoutActive && (
                          <span
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", colId);
                              e.dataTransfer.effectAllowed = "move";
                              dragColId.current = colId;
                            }}
                            onDragEnd={() => {
                              dragColId.current = null;
                            }}
                            className="shrink-0 cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing p-0.5 rounded hover:bg-gray-100"
                            title="Arrastrar para reordenar"
                            aria-hidden={true}
                          >
                            <FiMenu className="w-4 h-4" />
                          </span>
                        )}
                        <div
                          className={`flex min-w-0 flex-1 items-center gap-2 overflow-hidden ${
                            layoutActive ? "truncate" : ""
                          } ${
                            canSort ? "cursor-pointer select-none rounded px-0.5 -mx-0.5 hover:bg-gray-100/80" : ""
                          }`}
                          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            <span className="text-gray-400 shrink-0">
                              {sortDirection === "asc" ? (
                                <FiArrowUp className="w-4 h-4" />
                              ) : sortDirection === "desc" ? (
                                <FiArrowDown className="w-4 h-4" />
                              ) : (
                                <span className="opacity-0">↕</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      {layoutActive && header.column.getCanResize() && (
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            header.getResizeHandler()(e);
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            header.getResizeHandler()(e);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={`absolute right-0 top-0 z-20 h-full w-2 -translate-x-1/2 cursor-col-resize touch-none select-none border-r border-transparent px-0.5 hover:border-slate-300 ${
                            header.column.getIsResizing()
                              ? "border-primary-500 bg-primary-500/15"
                              : ""
                          }`}
                          title="Arrastrar para cambiar ancho"
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length || columns.length}
                  className={`${emptyPadding} text-center text-gray-500 ${textSize}`}
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-slate-50/90">
                  {row.getVisibleCells().map((cell) => {
                    const cellValue = cell.getValue();
                    const isStringValue =
                      typeof cellValue === "string" || typeof cellValue === "number";
                    const textLength = isStringValue ? String(cellValue).length : 0;
                    /** Sin layout fluido: truncado por número de caracteres (legacy). Con layout: solo elipsis CSS. */
                    const shouldTruncate =
                      !layoutActive && isStringValue && textLength > maxTextLength;
                    const cellMeta = cell.column.columnDef.meta as
                      | { allowWrapInFluid?: boolean }
                      | undefined;
                    const allowWrapFluid = Boolean(cellMeta?.allowWrapInFluid);

                    return (
                      <td
                        key={cell.id}
                        style={
                          layoutActive
                            ? { width: cell.column.getSize(), minWidth: cell.column.getSize() }
                            : undefined
                        }
                        className={`${cellPadding} ${textSize} ${
                          layoutActive
                            ? "min-w-0 max-w-0 align-middle"
                            : shouldTruncate
                              ? ""
                              : "whitespace-nowrap"
                        } align-top`}
                        title={
                          layoutActive && isStringValue
                            ? String(cellValue)
                            : shouldTruncate && isStringValue
                              ? String(cellValue)
                              : undefined
                        }
                      >
                        <div
                          className={
                            layoutActive
                              ? allowWrapFluid
                                ? "min-w-0 max-w-full break-words [word-break:break-word]"
                                : "min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
                              : shouldTruncate
                                ? "max-w-md truncate"
                                : ""
                          }
                          style={
                            !layoutActive && shouldTruncate
                              ? {
                                  maxWidth: "min(100%,24rem)",
                                  display: "block",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }
                              : undefined
                          }
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {enablePagination && totalPages > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200/90 bg-slate-50/80 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              title="Primera página"
              type="button"
            >
              <FiChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              title="Página anterior"
              type="button"
            >
              <FiChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-1 text-sm font-medium text-slate-700">
              Página {currentPage + 1} de {totalPages}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              title="Página siguiente"
              type="button"
            >
              <FiChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => table.setPageIndex(totalPages - 1)}
              disabled={!table.getCanNextPage()}
              className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              title="Última página"
              type="button"
            >
              <FiChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


