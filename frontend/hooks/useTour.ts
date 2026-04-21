"use client";

import { useCallback, useEffect } from "react";
import { driver, DriveStep, Config } from "driver.js";
import "driver.js/dist/driver.css";

// ─── Tipos ───────────────────────────────────────────────────────────────────
export type TourName =
  | "tour-general"
  | "tour-dashboard"
  | "tour-siniestros"
  | "tour-nuevo-siniestro"
  | "tour-detalle-siniestro"
  | "tour-usuarios"
  | "tour-configuracion"
  | "tour-parametros"
  | "tour-agenda";

// ─── Clave de localStorage ────────────────────────────────────────────────────
const STORAGE_KEY = "aslin_tours_done";

function getDoneTours(): Set<TourName> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as TourName[]) : new Set();
  } catch {
    return new Set();
  }
}

function markTourDone(name: TourName) {
  const done = getDoneTours();
  done.add(name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...done]));
}

export function resetAllTours() {
  localStorage.removeItem(STORAGE_KEY);
}

// ─── Definiciones de pasos por tour ──────────────────────────────────────────
const TOURS: Record<TourName, DriveStep[]> = {
  // 1. General: primera vez en la plataforma
  "tour-general": [
    {
      element: "[data-tour='sidebar']",
      popover: {
        title: "Menú lateral",
        description: "Aquí están todos los módulos de la plataforma. Puedes navegar entre ellos en cualquier momento.",
        side: "right",
        align: "start",
      },
    },
    {
      element: "[data-tour='navbar-empresa']",
      popover: {
        title: "Empresa activa",
        description: "Si tienes varias empresas asignadas, aquí puedes cambiar entre ellas fácilmente.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='navbar-busqueda']",
      popover: {
        title: "Búsqueda rápida",
        description: "Busca siniestros por número, nombre o cualquier dato clave.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: "[data-tour='navbar-notificaciones']",
      popover: {
        title: "Notificaciones",
        description: "Aquí recibirás avisos importantes sobre siniestros y actividades asignadas.",
        side: "bottom",
        align: "end",
      },
    },
    {
      element: "[data-tour='navbar-perfil']",
      popover: {
        title: "Tu perfil",
        description: "Accede a tu perfil, cambia tu contraseña o cierra sesión desde aquí.",
        side: "bottom",
        align: "end",
      },
    },
  ],

  // 2. Dashboard
  "tour-dashboard": [
    {
      element: "[data-tour='dashboard-metricas']",
      popover: {
        title: "Métricas principales",
        description: "Resumen rápido del total de siniestros, activos, críticos y notificaciones pendientes.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='dashboard-mapa']",
      popover: {
        title: "Mapa de siniestros",
        description: "Distribución geográfica de siniestros por estado. Los colores indican la concentración.",
        side: "top",
        align: "center",
      },
    },
    {
      element: "[data-tour='dashboard-grafica-estados']",
      popover: {
        title: "Siniestros por estado",
        description: "Gráfica de barras con el conteo de siniestros según su estado actual.",
        side: "top",
        align: "center",
      },
    },
    {
      element: "[data-tour='dashboard-grafica-prioridades']",
      popover: {
        title: "Siniestros por prioridad",
        description: "Distribución de siniestros por nivel de prioridad (baja, media, alta, crítica).",
        side: "top",
        align: "center",
      },
    },
    {
      element: "[data-tour='dashboard-recientes']",
      popover: {
        title: "Siniestros recientes",
        description: "Los últimos 5 siniestros registrados. Haz clic en cualquiera para ver su detalle.",
        side: "top",
        align: "start",
      },
    },
    {
      element: "[data-tour='dashboard-actualizar']",
      popover: {
        title: "Actualizar datos",
        description: "Refresca manualmente todas las métricas y gráficas del dashboard.",
        side: "bottom",
        align: "end",
      },
    },
  ],

  // 3. Listado de Siniestros
  "tour-siniestros": [
    {
      element: "[data-tour='siniestros-nuevo']",
      popover: {
        title: "Nuevo siniestro",
        description: "Registra un siniestro nuevo con toda la información del asegurado, póliza y detalles.",
        side: "bottom",
        align: "end",
      },
    },
    {
      element: "[data-tour='siniestros-filtros']",
      popover: {
        title: "Filtros de búsqueda",
        description: "Filtra la tabla por estado, prioridad, área, fechas y más campos para encontrar siniestros rápidamente.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='siniestros-tabla']",
      popover: {
        title: "Tabla de siniestros",
        description: "Lista de todos los siniestros. Haz clic en el ícono de ojo para ver el detalle, o en el lápiz para editar.",
        side: "top",
        align: "center",
      },
    },
  ],

  // 4. Nuevo Siniestro
  "tour-nuevo-siniestro": [
    {
      element: "[data-tour='nuevo-sin-asegurado']",
      popover: {
        title: "Datos del asegurado",
        description: "Selecciona un asegurado existente del catálogo o ingresa los datos de uno nuevo.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='nuevo-sin-generales']",
      popover: {
        title: "Información general",
        description: "Registra la póliza, fechas, áreas, abogado asignado y proveniente del siniestro.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='nuevo-sin-ubicacion']",
      popover: {
        title: "Ubicación del siniestro",
        description: "Ingresa la dirección donde ocurrió el siniestro. Puedes usar Google Maps para autocompletar.",
        side: "top",
        align: "start",
      },
    },
    {
      element: "[data-tour='nuevo-sin-guardar']",
      popover: {
        title: "Guardar siniestro",
        description: "Una vez completada la información obligatoria, guarda el siniestro para continuar en el módulo de detalle.",
        side: "top",
        align: "end",
      },
    },
  ],

  // 5. Detalle de Siniestro
  "tour-detalle-siniestro": [
    {
      element: "[data-tour='detalle-header']",
      popover: {
        title: "Encabezado del siniestro",
        description: "Número de siniestro, estado actual, prioridad y datos clave de un vistazo.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='detalle-tabs']",
      popover: {
        title: "Pestañas de información",
        description: "Navega entre datos generales, bitácora de actividades, documentos adjuntos y más.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='detalle-panel-lateral']",
      popover: {
        title: "Panel lateral",
        description: "Fechas importantes, usuarios asignados al siniestro y acciones rápidas.",
        side: "left",
        align: "start",
      },
    },
  ],

  // 6. Usuarios
  "tour-usuarios": [
    {
      element: "[data-tour='usuarios-tabs']",
      popover: {
        title: "Usuarios",
        description: "Gestiona los usuarios del sistema en la primera pestaña y los roles de acceso en la segunda.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='usuarios-tabla']",
      popover: {
        title: "Lista de usuarios",
        description: "Todos los usuarios de la plataforma. Puedes editar sus datos, cambiar su estado o rol.",
        side: "top",
        align: "center",
      },
    },
    {
      element: "[data-tour='usuarios-nuevo']",
      popover: {
        title: "Crear usuario",
        description: "Agrega un nuevo usuario asignándole empresa, rol y credenciales de acceso.",
        side: "bottom",
        align: "end",
      },
    },
  ],

  // 7. Configuración
  "tour-configuracion": [
    {
      element: "[data-tour='config-tabs']",
      popover: {
        title: "Pestañas de configuración",
        description: "Configura la empresa (logo, colores), flujos de trabajo, áreas, documentos y tipos de documento.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='config-empresa']",
      popover: {
        title: "Configuración de empresa",
        description: "Personaliza el nombre, logo, dominio y colores corporativos de tu empresa.",
        side: "bottom",
        align: "start",
      },
    },
  ],

  // 8. Parámetros
  "tour-parametros": [
    {
      element: "[data-tour='params-tabs']",
      popover: {
        title: "Catálogos del sistema",
        description: "Administra los catálogos base: entidades, instituciones, autoridades, provenientes, estados y calificaciones.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='params-tabla']",
      popover: {
        title: "Gestión de catálogo",
        description: "Crea, edita o elimina registros del catálogo activo. También puedes importar desde CSV.",
        side: "top",
        align: "center",
      },
    },
  ],

  // 9. Agenda
  "tour-agenda": [
    {
      element: "[data-tour='agenda-conectar']",
      popover: {
        title: "Conectar Google Calendar",
        description: "Vincula tu cuenta de Google para ver y crear eventos desde la plataforma.",
        side: "bottom",
        align: "end",
      },
    },
    {
      element: "[data-tour='agenda-calendario']",
      popover: {
        title: "Calendario",
        description: "Visualiza tus eventos por mes, semana o día. Haz clic en un hueco para crear una nueva reunión.",
        side: "top",
        align: "center",
      },
    },
  ],
};

// ─── Configuración base del driver ───────────────────────────────────────────
const BASE_CONFIG: Partial<Config> = {
  animate: true,
  showProgress: true,
  showButtons: ["next", "previous", "close"],
  nextBtnText: "Siguiente →",
  prevBtnText: "← Anterior",
  doneBtnText: "¡Entendido!",
  progressText: "{{current}} de {{total}}",
  popoverClass: "aslin-tour-popover",
  overlayColor: "rgba(0,0,0,0.45)",
  smoothScroll: true,
};

/** Comprueba si el elemento de un paso existe y está en el DOM (visible o no oculto por permisos). */
function isStepElementInDom(step: DriveStep): boolean {
  if (!step.element) return false;
  if (typeof step.element === "string") {
    return document.querySelector(step.element) != null;
  }
  if (typeof step.element === "object" && step.element instanceof Element) {
    return document.contains(step.element);
  }
  return false;
}

/**
 * Filtra los pasos del tour para incluir solo aquellos cuyo elemento está en el DOM.
 * Así, secciones ocultas por permisos no generan pasos sin destino visible.
 */
function getVisibleSteps(steps: DriveStep[]): DriveStep[] {
  return steps.filter(isStepElementInDom);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
interface UseTourOptions {
  /** Si es true, lanza el tour automáticamente si no se ha visto antes. */
  autoStart?: boolean;
  /** Callback al terminar el tour. */
  onFinish?: () => void;
}

export function useTour(name: TourName, options: UseTourOptions = {}) {
  const { autoStart = false, onFinish } = options;

  const startTour = useCallback(() => {
    const rawSteps = TOURS[name];
    if (!rawSteps?.length) return;

    const steps = getVisibleSteps(rawSteps);
    if (steps.length === 0) {
      if (rawSteps.length > 0) {
        console.info(
          `[Tour] No se mostró "${name}": ninguno de sus pasos está visible (posible restricción por permisos).`
        );
      }
      return;
    }

    const driverObj = driver({
      ...BASE_CONFIG,
      steps,
      onDestroyed() {
        markTourDone(name);
        onFinish?.();
      },
    });

    driverObj.drive();
  }, [name, onFinish]);

  // Auto-arranque si corresponde
  useEffect(() => {
    if (!autoStart) return;
    const done = getDoneTours();
    if (done.has(name)) return;

    // Pequeño delay para que el DOM esté pintado
    const id = setTimeout(() => {
      startTour();
    }, 800);

    return () => clearTimeout(id);
  }, [autoStart, name, startTour]);

  return { startTour };
}
