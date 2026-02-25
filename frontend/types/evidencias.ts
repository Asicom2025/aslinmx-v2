/**
 * Tipos TypeScript para el módulo de Evidencias Fotográficas
 */

export interface EvidenciaFotografica {
  id: string;
  siniestro_id: string;
  nombre_archivo: string;
  ruta_archivo: string;
  tamaño_archivo?: number;
  tipo_mime?: string;
  latitud?: number;
  longitud?: number;
  fecha_toma?: string;
  usuario_subio?: string;
  descripcion?: string;
  activo: boolean;
  eliminado: boolean;
  creado_en: string;
  eliminado_en?: string;
}

export interface EvidenciaFotograficaCreate {
  siniestro_id: string;
  nombre_archivo: string;
  ruta_archivo: string;
  tamaño_archivo?: number;
  tipo_mime?: string;
  latitud?: number;
  longitud?: number;
  fecha_toma?: string;
  usuario_subio?: string;
  descripcion?: string;
  activo?: boolean;
}

export interface EvidenciaFotograficaUpdate {
  nombre_archivo?: string;
  descripcion?: string;
  latitud?: number;
  longitud?: number;
  fecha_toma?: string;
  activo?: boolean;
}

