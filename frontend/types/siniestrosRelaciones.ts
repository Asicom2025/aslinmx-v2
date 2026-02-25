/**
 * Tipos TypeScript para relaciones de siniestros (involucrados y áreas)
 */

export type TipoRelacion = "asegurado" | "proveniente" | "testigo" | "tercero";

export interface SiniestroUsuario {
  id: string;
  siniestro_id: string;
  usuario_id: string;
  tipo_relacion: TipoRelacion;
  es_principal: boolean;
  observaciones?: string;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

export interface SiniestroUsuarioCreate {
  siniestro_id: string;
  usuario_id: string;
  tipo_relacion: TipoRelacion;
  es_principal?: boolean;
  observaciones?: string;
  activo?: boolean;
}

export interface SiniestroUsuarioUpdate {
  tipo_relacion?: TipoRelacion;
  es_principal?: boolean;
  observaciones?: string;
  activo?: boolean;
}

export interface SiniestroArea {
  id: string;
  siniestro_id: string;
  area_id: string;
  usuario_responsable?: string;
  fecha_asignacion: string;
  observaciones?: string;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

export interface SiniestroAreaCreate {
  siniestro_id: string;
  area_id: string;
  usuario_responsable?: string;
  observaciones?: string;
  activo?: boolean;
}

export interface SiniestroAreaUpdate {
  usuario_responsable?: string;
  observaciones?: string;
  activo?: boolean;
}

