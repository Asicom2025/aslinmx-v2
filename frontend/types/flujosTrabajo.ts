/**
 * Tipos TypeScript para el sistema de flujos de trabajo
 */

export interface FlujoTrabajo {
  id: string;
  empresa_id: string;
  area_id?: string | null;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  es_predeterminado: boolean;
  creado_en: string;
  actualizado_en: string;
  eliminado_en?: string | null;
  etapas?: EtapaFlujo[];
}

export interface EtapaFlujo {
  id: string;
  flujo_trabajo_id: string;
  nombre: string;
  descripcion?: string;
  orden: number;
  es_obligatoria: boolean;
  permite_omision: boolean;
  tipo_documento_principal_id?: string | null;
  categoria_documento_id?: string | null;
  plantilla_documento_id?: string | null;
  inhabilita_siguiente: boolean;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
  eliminado_en?: string | null;
  tipo_documento_principal?: {
    id: string;
    nombre: string;
  } | null;
  categoria_documento?: {
    id: string;
    nombre: string;
  } | null;
  plantilla_documento?: {
    id: string;
    nombre: string;
  } | null;
}

export interface SiniestroEtapa {
  id: string;
  siniestro_id: string;
  etapa_flujo_id: string;
  fecha_inicio: string;
  fecha_completada?: string | null;
  fecha_vencimiento?: string | null;
  estado: EstadoEtapa;
  documento_principal_id?: string | null;
  observaciones?: string;
  completado_por?: string | null;
  creado_en: string;
  actualizado_en: string;
  etapa?: EtapaFlujo;
}

export type EstadoEtapa = "pendiente" | "en_proceso" | "completada" | "omitida" | "bloqueada";

export interface FlujoCompleto extends FlujoTrabajo {
  etapas: EtapaFlujo[];
}

export interface SiniestroFlujoResponse {
  flujo: FlujoTrabajo;
  etapas: SiniestroEtapa[];
}

