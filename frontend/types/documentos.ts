/**
 * Tipos TypeScript para el módulo de Documentos
 */

export interface Documento {
  id: string;
  siniestro_id: string;
  tipo_documento_id?: string;
  etapa_flujo_id?: string;
  plantilla_documento_id?: string;
  area_id?: string;
  flujo_trabajo_id?: string;
  nombre_archivo: string;
  ruta_archivo: string;
  contenido?: string;
  tamaño_archivo?: number;
  tipo_mime?: string;
  usuario_subio?: string;
  version: number;
  descripcion?: string;
  fecha_documento?: string;
  es_principal: boolean;
  es_adicional: boolean;
  activo: boolean;
  eliminado: boolean;
  creado_en: string;
  actualizado_en: string;
  eliminado_en?: string;
}

export interface DocumentoCreate {
  siniestro_id: string;
  tipo_documento_id?: string;
  etapa_flujo_id?: string;
  nombre_archivo: string;
  ruta_archivo: string;
  tamaño_archivo?: number;
  tipo_mime?: string;
  usuario_subio?: string;
  version?: number;
  descripcion?: string;
  fecha_documento?: string;
  es_principal?: boolean;
  es_adicional?: boolean;
  activo?: boolean;
}

export interface DocumentoUpdate {
  nombre_archivo?: string;
  descripcion?: string;
  fecha_documento?: string;
  es_principal?: boolean;
  es_adicional?: boolean;
  tipo_documento_id?: string;
  etapa_flujo_id?: string;
  activo?: boolean;
}

