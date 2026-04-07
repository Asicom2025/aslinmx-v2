export type LegacyMigrationStatus =
  | "pendiente"
  | "en_progreso"
  | "completado"
  | "sin_archivos"
  | "error_lectura";

export type LegacyFileStatus = "pendiente" | "clasificado";

export interface LegacyClassificationSummary {
  categoria_documento_id?: string | null;
  categoria_documento_nombre?: string | null;
  etapa_flujo_id?: string | null;
  etapa_flujo_nombre?: string | null;
  tipo_documento_id?: string | null;
  tipo_documento_nombre?: string | null;
  flujo_trabajo_id?: string | null;
  flujo_trabajo_nombre?: string | null;
  documento_id?: string | null;
}

export interface LegacyDetectedFile {
  id: string;
  legacy_source_ref: string;
  legacy_file_id: string;
  legacy_timerst?: string | null;
  legacy_url: string;
  nombre_archivo: string;
  extension?: string | null;
  size_bytes?: number | null;
  fecha_archivo?: string | null;
  tipo_mime?: string | null;
  legacy_version?: string | null;
  legacy_area_id?: string | null;
  legacy_etapa?: string | null;
  estado_revision: LegacyFileStatus;
  previewable: boolean;
  clasificacion?: LegacyClassificationSummary | null;
}

export interface LegacyMigrationContext {
  estado: LegacyMigrationStatus;
  requiere_modal: boolean;
  legacy_folder_path_ref?: string | null;
  legacy_source_ref?: string | null;
  total_archivos: number;
  total_resueltos: number;
  total_pendientes: number;
  ultimo_escaneo_en?: string | null;
}

export interface LegacyDestinationRequirement {
  id: string;
  nombre_documento: string;
  tipo_documento_id?: string | null;
  tipo_documento_nombre?: string | null;
}

export interface LegacyDestinationType {
  id: string;
  nombre: string;
  requisitos: LegacyDestinationRequirement[];
}

export interface LegacyDestinationStage {
  id: string;
  nombre: string;
  orden: number;
  tipos_documento: LegacyDestinationType[];
}

export interface LegacyDestinationCategory {
  id?: string | null;
  clave: string;
  nombre: string;
  synthetic: boolean;
  etapas: LegacyDestinationStage[];
}

export interface LegacyDestinationFlow {
  id: string;
  nombre: string;
  area_id?: string | null;
  area_nombre?: string | null;
  categorias: LegacyDestinationCategory[];
}

export interface LegacyDestinationsResponse {
  flujos: LegacyDestinationFlow[];
}

export interface LegacyFinalizeItem {
  legacy_file_id: string;
  /** Si se omiten flujo y etapa, la importación usa solo tipo (y categoría opcional) del catálogo; el área va en la query `area_id`. */
  flujo_trabajo_id?: string | null;
  categoria_documento_id?: string | null;
  etapa_flujo_id?: string | null;
  tipo_documento_id: string;
  requisito_documento_id?: string | null;
}

export interface LegacyFinalizeResponse {
  documentos_creados: number;
  total_solicitado: number;
  total_archivos_pendientes: number;
}
