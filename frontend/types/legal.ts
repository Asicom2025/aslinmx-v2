/**
 * Tipos TypeScript para catálogos legales
 * Estados y Calificaciones de Siniestros
 */

export interface EstadoSiniestro {
  id: string;
  empresa_id: string;
  nombre: string;
  descripcion?: string;
  color: string;
  orden: number;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
  eliminado_en?: string;
}

export interface CalificacionSiniestro {
  id: string;
  empresa_id: string;
  nombre: string;
  descripcion?: string;
  color: string;
  orden: number;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
  eliminado_en?: string;
}
