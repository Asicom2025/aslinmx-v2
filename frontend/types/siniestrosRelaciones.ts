/**
 * Tipos TypeScript para relaciones de siniestros (involucrados, áreas y pólizas)
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
  eliminado: boolean;
  creado_en: string;
  actualizado_en: string;
  eliminado_en?: string | null;
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
  eliminado: boolean;
  creado_en: string;
  actualizado_en: string;
  eliminado_en?: string | null;
}

export interface SiniestroAreaCreate {
  siniestro_id: string;
  area_id: string;
  usuario_responsable?: string;
  observaciones?: string;
  activo?: boolean;
}

export interface SiniestroAreaUpdate {
  fecha_asignacion?: string;
  usuario_responsable?: string;
  observaciones?: string;
  activo?: boolean;
}

export interface SiniestroPoliza {
  id: string;
  siniestro_id: string;
  numero_poliza?: string | null;
  deducible: number;
  reserva: number;
  coaseguro: number;
  suma_asegurada: number;
  es_principal: boolean;
  orden: number;
  creado_en: string;
  actualizado_en: string;
}

export interface SiniestroPolizaPayload {
  id?: string;
  numero_poliza?: string | null;
  deducible?: number;
  reserva?: number;
  coaseguro?: number;
  suma_asegurada?: number;
  es_principal?: boolean;
  orden?: number;
}

