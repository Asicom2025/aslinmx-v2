/**
 * Tipos TypeScript para el módulo de Siniestros
 * Define interfaces para los datos de siniestros y sus operaciones
 */

import type { SiniestroPoliza, SiniestroPolizaPayload } from "./siniestrosRelaciones";

export interface Siniestro {
  id: string;
  empresa_id: string;
  numero_siniestro?: string | null;
  fecha_siniestro?: string | null;
  fecha_registro?: string | null;
  fecha_reporte?: string | null;
  fecha_asignacion?: string | null;
  ubicacion?: string;
  descripcion_hechos: string;

  /** Pólizas en `siniestro_polizas` (API las devuelve anidadas). */
  polizas?: SiniestroPoliza[];
  
  // Usuario que creó el siniestro
  creado_por?: string;
  
  // Usuario asegurado (rol asegurado)
  asegurado_id?: string;
  /** Nombre completo del asegurado (solo lectura en API; no es columna en BD). */
  asegurado_nombre?: string | null;
  
  // Estado del siniestro
  estado_id?: string;
  
  // Instituciones involucradas
  institucion_id?: string;
  autoridad_id?: string;
  
  // Proveniente y código
  proveniente_id?: string;
  codigo?: string;  // Código generado automáticamente
  /** Año calendario del consecutivo (ej. 2026) */
  anualidad?: number | null;
  numero_reporte?: string;
  /** ID legible armado en API: proveniente-consecutivo-anualidad */
  id_formato?: string | null;
  
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
  fecha_registro: string;
  fecha_reporte?: string;
  fecha_asignacion?: string;
  fecha_siniestro?: string;
  ubicacion?: string;
  descripcion_hechos: string;

  polizas?: SiniestroPolizaPayload[];
  
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
  fecha_registro?: string;
  fecha_reporte?: string;
  fecha_asignacion?: string;
  fecha_siniestro?: string;
  ubicacion?: string;
  descripcion_hechos?: string;

  polizas?: SiniestroPolizaPayload[];
  
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

export interface ProvenienteContacto {
  id: string;
  proveniente_id: string;
  nombre: string;
  correo: string;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
  eliminado_en?: string;
}

