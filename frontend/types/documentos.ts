/**
 * Tipos TypeScript para el módulo de Documentos
 */

export interface DocumentoStorageObject {
  id: string;
  provider: string;
  storage_path: string;
  bucket_name?: string | null;
  object_key?: string | null;
  original_filename: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  etag?: string | null;
  sha256?: string | null;
  creado_en: string;
}

export interface DocumentoArchivoAcceso {
  url: string;
  provider: string;
  filename: string;
  expires_in?: number | null;
}

export interface Documento {
  id: string;
  siniestro_id: string;
  tipo_documento_id?: string;
  etapa_flujo_id?: string;
  plantilla_documento_id?: string;
  area_id?: string;
  flujo_trabajo_id?: string;
  requisito_documento_id?: string;
  nombre_archivo: string;
  ruta_archivo?: string | null;
  contenido?: string | null;
  tamaño_archivo?: number | null;
  tipo_mime?: string | null;
  usuario_subio?: string;
  version: number;
  descripcion?: string | null;
  fecha_documento?: string | null;
  es_principal: boolean;
  es_adicional: boolean;
  activo: boolean;
  eliminado: boolean;
  creado_en: string;
  actualizado_en: string;
  eliminado_en?: string | null;
  plantilla_tiene_continuacion?: boolean | null;
  categoria_documento_nombre?: string | null;
  storage_object_id?: string | null;
  storage_object?: DocumentoStorageObject | null;
  archivo_url?: string | null;
  archivo_url_expira_en?: number | null;
}

export interface DocumentoCreate {
  siniestro_id: string;
  tipo_documento_id?: string;
  etapa_flujo_id?: string;
  plantilla_documento_id?: string;
  area_id?: string;
  flujo_trabajo_id?: string;
  requisito_documento_id?: string;
  nombre_archivo: string;
  ruta_archivo?: string | null;
  contenido?: string | null;
  tamaño_archivo?: number;
  tipo_mime?: string;
  storage_object_id?: string | null;
  usuario_subio?: string;
  version?: number;
  descripcion?: string | null;
  fecha_documento?: string | null;
  es_principal?: boolean;
  es_adicional?: boolean;
  activo?: boolean;
}

export interface DocumentoUpdate {
  nombre_archivo?: string;
  ruta_archivo?: string | null;
  contenido?: string | null;
  descripcion?: string | null;
  fecha_documento?: string | null;
  es_principal?: boolean;
  es_adicional?: boolean;
  tipo_documento_id?: string;
  etapa_flujo_id?: string;
  plantilla_documento_id?: string;
  area_id?: string;
  flujo_trabajo_id?: string;
  requisito_documento_id?: string;
  storage_object_id?: string | null;
  activo?: boolean;
}

