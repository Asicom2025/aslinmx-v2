/**
 * Nombres técnicos de módulos y acciones (alineados con backend / docs/ACCIONESANDMODULOS.md).
 * Usar estos valores en can("modulo", "accion") para evitar typos.
 */

export const MODULO = {
  dashboard: "dashboard",
  permisos: "permisos",
  configuracion: "configuracion",
  siniestros: "siniestros",
  historico: "historico",
  parametros: "parametros",
  reportes: "reportes",
  usuarios: "usuarios",
  agenda: "agenda",
  soporte: "soporte",
} as const;

export const ACCION = {
  create: "create",
  read: "read",
  update: "update",
  delete: "delete",
  ver_grafica_prioridad: "ver_grafica_prioridad",
  ver_grafica_barras_por_estado: "ver_grafica_barras_por_estado",
  ver_grafica_mapa: "ver_grafica_mapa",
  ver_grafica_areas: "ver_grafica_areas",
  ver_actividad_reciente: "ver_actividad_reciente",
  ver_kpis: "ver_kpis",
  ver_siniestros_recientes: "ver_siniestros_recientes",
  ver_grafica_por_mes: "ver_grafica_por_mes",
  asignar_areas: "asignar_areas",
  /** Cambiar solo estado_id del siniestro (sin siniestros.update completo) */
  editar_status: "editar_status",
  /** Cambiar solo calificacion_id del siniestro */
  editar_calificacion: "editar_calificacion",
  /** Cambiar solo el arreglo polizas del siniestro (sin siniestros.update completo) */
  editar_poliza: "editar_poliza",
  /** Descripción de hechos y versiones (independiente de siniestros.update) */
  editar_descripcion_de_hechos: "editar_descripcion_de_hechos",
  ver_bitacora: "ver_bitacora",
  ver_documentos: "ver_documentos",
  subir_archivo: "subir_archivo",
  generar_pdf: "generar_pdf",
  ver_involucrados: "ver_involucrados",
  verificar_bitcora: "verificar_bitcora",
  eliminar_archivos: "eliminar_archivos",
  ver_reportes_de_autoridades: "ver_reportes_de_autoridades",
  invitar: "invitar",
  exportar_invitaciones: "exportar_invitaciones",
  /** Gestión de roles (módulo usuarios; además de create/read/update/delete genéricos) */
  ver_roles: "ver_roles",
  editar_roles: "editar_roles",
  crear_roles: "crear_roles",
  eliminar_roles: "eliminar_roles",
  /** Configuración — granular (módulo configuracion) */
  leer_smtp: "leer_smtp",
  editar_smtp: "editar_smtp",
  eliminar_smtp: "eliminar_smtp",
  leer_flujos: "leer_flujos",
  editar_flujos: "editar_flujos",
  eliminar_flujos: "eliminar_flujos",
  ver_areas: "ver_areas",
  editar_areas: "editar_areas",
  eliminar_areas: "eliminar_areas",
  ver_tipos_de_documentos: "ver_tipos_de_documentos",
  editar_tipos_de_documentos: "editar_tipos_de_documentos",
  eliminar_tipos_de_documentos: "eliminar_tipos_de_documentos",
} as const;

export type CanFn = (modulo: string, accion: string) => boolean;

/** SMTP en configuración: lectura (compat. con read). */
export const canConfigSmtpLeer = (can: CanFn) =>
  can(MODULO.configuracion, ACCION.read) || can(MODULO.configuracion, ACCION.leer_smtp);

export const canConfigSmtpCrear = (can: CanFn) =>
  can(MODULO.configuracion, ACCION.create) ||
  can(MODULO.configuracion, ACCION.editar_smtp);

export const canConfigSmtpActualizar = (can: CanFn) =>
  can(MODULO.configuracion, ACCION.update) ||
  can(MODULO.configuracion, ACCION.editar_smtp);

export const canConfigSmtpEliminar = (can: CanFn) =>
  can(MODULO.configuracion, ACCION.delete) || can(MODULO.configuracion, ACCION.eliminar_smtp);

/** Flujos de trabajo (configuración / parámetros / siniestros lectura). */
export const canConfigFlujoLeer = (can: CanFn) =>
  can(MODULO.configuracion, ACCION.read) ||
  can(MODULO.parametros, ACCION.read) ||
  can(MODULO.siniestros, ACCION.read) ||
  can(MODULO.configuracion, ACCION.leer_flujos);

export const canConfigFlujoCrear = (can: CanFn) =>
  can(MODULO.configuracion, ACCION.create) ||
  can(MODULO.parametros, ACCION.create) ||
  can(MODULO.configuracion, ACCION.editar_flujos);

export const canConfigFlujoActualizar = (can: CanFn) =>
  can(MODULO.configuracion, ACCION.update) ||
  can(MODULO.parametros, ACCION.update) ||
  can(MODULO.configuracion, ACCION.editar_flujos);

export const canConfigFlujoEliminar = (can: CanFn) =>
  can(MODULO.configuracion, ACCION.delete) ||
  can(MODULO.parametros, ACCION.delete) ||
  can(MODULO.configuracion, ACCION.eliminar_flujos);

/**
 * Visibilidad de pestañas en /configuración: no usar siniestros.read como sustituto de permisos
 * de catálogo (evita mostrar Áreas / Tipos / Documentos solo por leer siniestros).
 */
export const canConfiguracionTabGeneral = (can: CanFn) =>
  can(MODULO.configuracion, ACCION.read) ||
  can(MODULO.configuracion, ACCION.update) ||
  can(MODULO.configuracion, ACCION.leer_smtp) ||
  can(MODULO.parametros, ACCION.read) ||
  can(MODULO.parametros, ACCION.update);

export const canConfiguracionTabAreas = (can: CanFn) =>
  can(MODULO.configuracion, ACCION.read) ||
  can(MODULO.parametros, ACCION.read) ||
  can(MODULO.configuracion, ACCION.ver_areas);

export const canConfiguracionTabTiposDocumento = (can: CanFn) =>
  can(MODULO.configuracion, ACCION.read) ||
  can(MODULO.parametros, ACCION.read) ||
  can(MODULO.configuracion, ACCION.ver_tipos_de_documentos);

/** Expediente documentos desde configuración: ver listado o permisos de administración. */
export const canConfiguracionTabDocumentos = (can: CanFn) =>
  can(MODULO.siniestros, ACCION.ver_documentos) ||
  can(MODULO.configuracion, ACCION.update) ||
  can(MODULO.parametros, ACCION.update) ||
  can(MODULO.configuracion, ACCION.create) ||
  can(MODULO.parametros, ACCION.create);

/** Áreas (catálogo): lectura para pantallas que ya usaban read de config/param/siniestros. */
export const canConfigAreasLeer = (can: CanFn) =>
  can(MODULO.configuracion, ACCION.read) ||
  can(MODULO.parametros, ACCION.read) ||
  can(MODULO.configuracion, ACCION.ver_areas) ||
  can(MODULO.siniestros, ACCION.read);

export const canConfigAreasCrear = (can: CanFn) =>
  can(MODULO.configuracion, ACCION.create) ||
  can(MODULO.parametros, ACCION.create) ||
  can(MODULO.configuracion, ACCION.editar_areas);

export const canConfigAreasActualizar = (can: CanFn) =>
  can(MODULO.configuracion, ACCION.update) ||
  can(MODULO.parametros, ACCION.update) ||
  can(MODULO.configuracion, ACCION.editar_areas);

export const canConfigAreasEliminar = (can: CanFn) =>
  can(MODULO.configuracion, ACCION.delete) ||
  can(MODULO.parametros, ACCION.delete) ||
  can(MODULO.configuracion, ACCION.eliminar_areas);

/** Tipos/categorías/plantillas de documento (catálogos legales). */
export const canCatalogoDocumentoLeer = (can: CanFn) =>
  can(MODULO.configuracion, ACCION.read) ||
  can(MODULO.parametros, ACCION.read) ||
  can(MODULO.configuracion, ACCION.ver_tipos_de_documentos) ||
  can(MODULO.siniestros, ACCION.read);

export const canCatalogoDocumentoCrear = (can: CanFn) =>
  can(MODULO.configuracion, ACCION.create) ||
  can(MODULO.parametros, ACCION.create) ||
  can(MODULO.configuracion, ACCION.editar_tipos_de_documentos) ||
  can(MODULO.siniestros, ACCION.create) ||
  can(MODULO.siniestros, ACCION.subir_archivo);

export const canCatalogoDocumentoActualizar = (can: CanFn) =>
  can(MODULO.configuracion, ACCION.update) ||
  can(MODULO.parametros, ACCION.update) ||
  can(MODULO.configuracion, ACCION.editar_tipos_de_documentos) ||
  can(MODULO.siniestros, ACCION.update);

export const canCatalogoDocumentoEliminar = (can: CanFn) =>
  can(MODULO.configuracion, ACCION.delete) ||
  can(MODULO.parametros, ACCION.delete) ||
  can(MODULO.configuracion, ACCION.eliminar_tipos_de_documentos);

/** Descripción de hechos / versiones (no usar siniestros.update como sustituto). */
export const canSiniestroEditarDescripcionHechos = (can: CanFn) =>
  can(MODULO.siniestros, ACCION.editar_descripcion_de_hechos);
