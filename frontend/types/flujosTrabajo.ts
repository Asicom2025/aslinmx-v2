/**
 * Tipos TypeScript para el sistema de flujos de trabajo
 */

export interface FlujoTrabajo {
  id: string;
  empresa_id: string;
  area_id?: string | null;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  es_predeterminado: boolean;
  creado_en: string;
  actualizado_en: string;
  eliminado_en?: string | null;
  etapas?: EtapaFlujo[];
}

export interface EtapaFlujo {
  id: string;
  flujo_trabajo_id: string;
  nombre: string;
  descripcion?: string;
  orden: number;
  es_obligatoria: boolean;
  permite_omision: boolean;
  tipo_documento_principal_id?: string | null;
  categoria_documento_id?: string | null;
  plantilla_documento_id?: string | null;
  inhabilita_siguiente: boolean;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
  eliminado_en?: string | null;
  tipo_documento_principal?: {
    id: string;
    nombre: string;
    tipo?: string; // "pdf" | "editor" | "imagen"
  } | null;
  categoria_documento?: {
    id: string;
    nombre: string;
  } | null;
  plantilla_documento?: {
    id: string;
    nombre: string;
  } | null;
}

export interface SiniestroEtapa {
  id: string;
  siniestro_id: string;
  etapa_flujo_id: string;
  fecha_inicio: string;
  fecha_completada?: string | null;
  fecha_vencimiento?: string | null;
  estado: EstadoEtapa;
  documento_principal_id?: string | null;
  observaciones?: string;
  completado_por?: string | null;
  creado_en: string;
  actualizado_en: string;
  etapa?: EtapaFlujo;
}

export type EstadoEtapa = "pendiente" | "en_proceso" | "completada" | "omitida" | "bloqueada";

export interface FlujoCompleto extends FlujoTrabajo {
  etapas: EtapaFlujo[];
}

export interface SiniestroFlujoResponse {
  flujo: FlujoTrabajo;
  etapas: SiniestroEtapa[];
}

// ============================================================
// REQUISITOS DOCUMENTALES POR ETAPA
// ============================================================

export interface DocumentoRelacionado {
  id: string;
  nombre: string;
}

export interface RequisitoDocumento {
  id: string;
  flujo_trabajo_id: string;
  etapa_flujo_id: string;
  nombre_documento: string;
  descripcion?: string | null;
  tipo_documento_id?: string | null;
  categoria_documento_id?: string | null;
  plantilla_documento_id?: string | null;
  es_obligatorio: boolean;
  permite_upload: boolean;
  permite_generar: boolean;
  multiple: boolean;
  orden: number;
  clave?: string | null;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
  eliminado_en?: string | null;
  tipo_documento?: DocumentoRelacionado | null;
  categoria_documento?: DocumentoRelacionado | null;
  plantilla_documento?: DocumentoRelacionado | null;
}

export interface RequisitoDocumentoCreate {
  nombre_documento: string;
  descripcion?: string | null;
  tipo_documento_id?: string | null;
  categoria_documento_id?: string | null;
  plantilla_documento_id?: string | null;
  es_obligatorio?: boolean;
  permite_upload?: boolean;
  permite_generar?: boolean;
  multiple?: boolean;
  orden?: number;
  clave?: string | null;
  activo?: boolean;
}

export type RequisitoDocumentoUpdate = Partial<RequisitoDocumentoCreate>;

export type EstadoRequisito = "pendiente" | "cargado" | "generado" | "completo" | "opcional";

export interface ChecklistDocumentoInfo {
  id: string;
  nombre_archivo: string;
  ruta_archivo?: string | null;
  contenido: boolean;
  version: number;
  creado_en?: string | null;
  tipo_mime?: string | null;
  usuario_subio?: string | null;
}

export interface ChecklistItem {
  requisito: RequisitoDocumento;
  documentos: ChecklistDocumentoInfo[];
  estado: EstadoRequisito;
}

