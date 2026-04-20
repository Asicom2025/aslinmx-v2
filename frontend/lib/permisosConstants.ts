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
} as const;
