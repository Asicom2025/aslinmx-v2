/**
 * Tipos TypeScript para el módulo de Bitácora
 */

export type TipoActividad = "documento" | "llamada" | "reunion" | "inspeccion" | "otro";

export interface BitacoraActividad {
  id: string;
  siniestro_id: string;
  usuario_id: string;
  tipo_actividad: TipoActividad;
  descripcion: string;
  horas_trabajadas: number;
  fecha_actividad: string;
  documento_adjunto?: string;
  comentarios?: string;
  area_id?: string;
  flujo_trabajo_id?: string;
  creado_en: string;
}

export interface BitacoraActividadCreate {
  siniestro_id: string;
  usuario_id?: string;
  tipo_actividad: TipoActividad;
  descripcion: string;
  horas_trabajadas?: number;
  fecha_actividad: string;
  documento_adjunto?: string;
  comentarios?: string;
  area_id?: string;
  flujo_trabajo_id?: string;
}

export interface BitacoraActividadUpdate {
  tipo_actividad?: TipoActividad;
  descripcion?: string;
  horas_trabajadas?: number;
  fecha_actividad?: string;
  documento_adjunto?: string;
  comentarios?: string;
  area_id?: string;
  flujo_trabajo_id?: string;
}

