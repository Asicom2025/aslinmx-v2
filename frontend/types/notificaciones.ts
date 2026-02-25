/**
 * Tipos TypeScript para el módulo de Notificaciones
 */

export type TipoNotificacion = "plazo_vencido" | "cambio_estado" | "asignacion" | "recordatorio" | "general";

export interface Notificacion {
  id: string;
  usuario_id: string;
  siniestro_id?: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fecha_vencimiento?: string;
  creado_en: string;
}

export interface NotificacionCreate {
  usuario_id: string;
  siniestro_id?: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  fecha_vencimiento?: string;
}

export interface NotificacionUpdate {
  leida?: boolean;
  titulo?: string;
  mensaje?: string;
  fecha_vencimiento?: string;
}

