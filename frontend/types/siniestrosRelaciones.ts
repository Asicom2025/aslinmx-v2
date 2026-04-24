/**
 * Tipos TypeScript para relaciones de siniestros (involucrados/abogados, áreas y pólizas)
 */

export interface SiniestroUsuario {
  id: string;
  siniestro_id: string;
  usuario_id: string;
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
  es_principal?: boolean;
  observaciones?: string;
  activo?: boolean;
}

export interface SiniestroUsuarioUpdate {
  es_principal?: boolean;
  observaciones?: string;
  activo?: boolean;
}

export interface SiniestroArea {
  id: string;
  siniestro_id: string;
  area_id: string;
  /** Abogado cuya firma y nombre se usan en informes para este ámbito de área. */
  abogado_principal_informe_id?: string | null;
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
  abogado_principal_informe_id?: string | null;
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
  numero_poliza?: string;
  deducible: number;
  reserva: number;
  coaseguro: number;
  suma_asegurada: number;
  es_principal: boolean;
  orden: number;
}
