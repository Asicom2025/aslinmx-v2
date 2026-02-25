/**
 * Tipos TypeScript para el módulo de Siniestros
 * Define interfaces para los datos de siniestros y sus operaciones
 */

export interface Siniestro {
  id: string;
  empresa_id: string;
  numero_siniestro?: string | null;
  fecha_siniestro: string;
  fecha_registro: string;
  fecha_asignacion: string;
  ubicacion?: string;
  descripcion_hechos: string;
  
  // Información de póliza
  numero_poliza?: string;
  deducible: number;
  reserva: number;
  coaseguro: number;
  suma_asegurada: number;
  
  // Usuario que creó el siniestro
  creado_por?: string;
  
  // Usuario asegurado (rol asegurado)
  asegurado_id?: string;
  
  // Estado del siniestro
  estado_id?: string;
  
  // Instituciones involucradas
  institucion_id?: string;
  autoridad_id?: string;
  
  // Proveniente y código
  proveniente_id?: string;
  codigo?: string;  // Código generado automáticamente
  numero_reporte?: string;
  anualidad?: string;
  
  // Calificación
  calificacion_id?: string;
  
  // Forma de contacto
  forma_contacto?: "correo" | "telefono" | "directa";
  
  // Campos adicionales
  prioridad: "baja" | "media" | "alta" | "critica";
  observaciones?: string;
  activo: boolean;
  eliminado: boolean;
  
  // Timestamps
  creado_en: string;
  actualizado_en: string;
  eliminado_en?: string;
}

export interface SiniestroCreate {
  numero_siniestro?: string | null;
  fecha_siniestro: string;
  ubicacion?: string;
  descripcion_hechos: string;
  
  // Información de póliza
  numero_poliza?: string;
  deducible?: number;
  reserva?: number;
  coaseguro?: number;
  suma_asegurada?: number;
  
  // Usuario asegurado (rol asegurado)
  asegurado_id?: string;
  
  // Estado del siniestro
  estado_id?: string;
  
  // Instituciones involucradas
  institucion_id?: string;
  autoridad_id?: string;
  
  // Campos adicionales
  prioridad?: "baja" | "media" | "alta" | "critica";
  observaciones?: string;
  activo?: boolean;
}

export interface SiniestroUpdate {
  numero_siniestro?: string;
  fecha_siniestro?: string;
  ubicacion?: string;
  descripcion_hechos?: string;
  
  // Información de póliza
  numero_poliza?: string;
  deducible?: number;
  reserva?: number;
  coaseguro?: number;
  suma_asegurada?: number;
  
  // Usuario asegurado (rol asegurado)
  asegurado_id?: string;
  
  // Estado del siniestro
  estado_id?: string;
  
  // Instituciones involucradas
  institucion_id?: string;
  autoridad_id?: string;
  
  // Proveniente y código
  proveniente_id?: string;
  numero_reporte?: string;
  
  // Calificación
  calificacion_id?: string;
  
  // Forma de contacto
  forma_contacto?: "correo" | "telefono" | "directa";
  
  // Campos adicionales
  prioridad?: "baja" | "media" | "alta" | "critica";
  observaciones?: string;
  activo?: boolean;
}

export interface SiniestroFilters {
  activo?: boolean;
  estado_id?: string;
  area_id?: string;
  usuario_asignado?: string;
  prioridad?: "baja" | "media" | "alta" | "critica";
  skip?: number;
  limit?: number;
}

