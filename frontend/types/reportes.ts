/**
 * Tipos para el módulo de reportes
 */

export interface ReporteDisponible {
  modulo: string;
  nombre: string;
  descripcion: string;
  columnas_disponibles: string[];
  filtros_disponibles: string[];
  agrupaciones_disponibles?: string[];
}

export interface ReporteFiltros {
  fecha_desde?: string;
  fecha_hasta?: string;
  activo?: boolean;
  empresa_id?: string;
  filtros_adicionales?: Record<string, any>;
}

export interface ReporteRequest {
  modulo: string;
  filtros?: ReporteFiltros;
  columnas?: string[];
  ordenamiento?: Record<string, "asc" | "desc">;
  agrupaciones?: string[];
  formato: "excel" | "csv" | "pdf";
  incluir_graficos?: boolean;
}

export interface ReporteResponse {
  success: boolean;
  message: string;
  archivo_base64?: string;
  nombre_archivo?: string;
  total_registros?: number;
  datos?: Record<string, any>[];
}

export interface EstadisticasModulo {
  total: number;
  modulo: string;
  por_estado?: Array<{ nombre: string; cantidad: number }>;
  [key: string]: any;
}
