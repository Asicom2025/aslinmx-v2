"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight, FiArrowUp, FiArrowDown } from "react-icons/fi";

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
}: DataTableProps<TData>) {
  const [globalFilter, setGlobalFilter] = useState<string>("");
  const [sorting, setSorting] = useState<SortingState>([]);
  
  const table = useReactTable<TData>({
    data: data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    state: { 
      globalFilter,
      sorting,
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    initialState: {
      pagination: {
        pageSize,
      },
    },
    globalFilterFn: (row, columnId, filterValue) => {
      const v = row.getValue<any>(columnId);
      const text = (v ?? "").toString().toLowerCase();
      return text.includes((filterValue ?? "").toString().toLowerCase());
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
    <div className={`overflow-x-auto ${className}`}>
      <div className="flex justify-between items-center mb-4 p-2">
        {enableSearch && (
          <div>
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full md:w-72 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        )}
        {enablePagination && totalRows > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>
              Mostrando {startRow} - {endRow} de {totalRows} registros
            </span>
            <select
              value={pageSizeValue}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = enableSorting && header.column.getCanSort();
                  const sortDirection = header.column.getIsSorted();
                  return (
                    <th 
                      key={header.id} 
                      className={`${headerPadding} text-left ${textSize} font-medium text-gray-500 uppercase ${
                        canSort ? "cursor-pointer select-none hover:bg-gray-100" : ""
                      }`}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <div className="flex items-center gap-2">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className="text-gray-400">
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
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={`${emptyPadding} text-center text-gray-500 ${textSize}`}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => {
                    const cellValue = cell.getValue();
                    const isStringValue = typeof cellValue === 'string' || typeof cellValue === 'number';
                    const textLength = isStringValue ? String(cellValue).length : 0;
                    const shouldTruncate = textLength > maxTextLength;
                    
                    return (
                      <td 
                        key={cell.id} 
                        className={`${cellPadding} ${textSize} ${shouldTruncate ? '' : 'whitespace-nowrap'}`}
                        title={shouldTruncate ? String(cellValue) : undefined}
                      >
                        <div 
                          className={shouldTruncate ? 'truncate max-w-md' : ''}
                          style={shouldTruncate ? { 
                            maxWidth: '400px',
                            display: 'inline-block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            verticalAlign: 'middle'
                          } : undefined}
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
        <div className="flex items-center justify-between mt-4 px-4 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              title="Primera página"
            >
              <FiChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              title="Página anterior"
            >
              <FiChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-700">
              Página {currentPage + 1} de {totalPages}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              title="Página siguiente"
            >
              <FiChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => table.setPageIndex(totalPages - 1)}
              disabled={!table.getCanNextPage()}
              className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              title="Última página"
            >
              <FiChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


