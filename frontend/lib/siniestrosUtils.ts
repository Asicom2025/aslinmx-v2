/**
 * Utilidades para manejo de estados y calificaciones de siniestros
 * Incluye funciones para obtener colores y aplicar estilos
 */

import React from "react";
import apiService from "./apiService";

export interface EstadoSiniestro {
  id: string;
  nombre: string;
  descripcion?: string;
  color: string;
  orden: number;
  activo: boolean;
}

export interface CalificacionSiniestro {
  id: string;
  nombre: string;
  descripcion?: string;
  color: string;
  orden: number;
  activo: boolean;
}

export interface CatalogosColores {
  estados: Map<string, EstadoSiniestro>;
  calificaciones: Map<string, CalificacionSiniestro>;
  estadosArray: EstadoSiniestro[];
  calificacionesArray: CalificacionSiniestro[];
}

/**
 * Obtiene todos los estados y calificaciones con sus colores
 * @param activo - Si se especifica, filtra por estado activo/inactivo
 * @returns Objeto con mapas y arrays de estados y calificaciones
 */
export async function obtenerCatalogosColores(
  activo: boolean = true
): Promise<CatalogosColores> {
  try {
    const [estadosData, calificacionesData] = await Promise.all([
      apiService.getEstadosSiniestro(activo),
      apiService.getCalificacionesSiniestro(activo),
    ]);

    // Crear mapas para búsqueda rápida por ID
    const estadosMap = new Map<string, EstadoSiniestro>();
    const calificacionesMap = new Map<string, CalificacionSiniestro>();

    // Procesar estados
    const estadosArray: EstadoSiniestro[] = Array.isArray(estadosData)
      ? estadosData.map((e: any) => ({
          id: e.id,
          nombre: e.nombre,
          descripcion: e.descripcion,
          color: e.color || "#007bff", // Color por defecto
          orden: e.orden || 0,
          activo: e.activo !== undefined ? e.activo : true,
        }))
      : [];

    estadosArray.forEach((estado) => {
      estadosMap.set(estado.id, estado);
    });

    // Procesar calificaciones
    const calificacionesArray: CalificacionSiniestro[] = Array.isArray(
      calificacionesData
    )
      ? calificacionesData.map((c: any) => ({
          id: c.id,
          nombre: c.nombre,
          descripcion: c.descripcion,
          color: c.color || "#475569", // Color por defecto
          orden: c.orden || 0,
          activo: c.activo !== undefined ? c.activo : true,
        }))
      : [];

    calificacionesArray.forEach((calificacion) => {
      calificacionesMap.set(calificacion.id, calificacion);
    });

    return {
      estados: estadosMap,
      calificaciones: calificacionesMap,
      estadosArray,
      calificacionesArray,
    };
  } catch (error) {
    console.error("Error al obtener catálogos de colores:", error);
    return {
      estados: new Map(),
      calificaciones: new Map(),
      estadosArray: [],
      calificacionesArray: [],
    };
  }
}

/**
 * Obtiene el color de un estado por su ID
 * @param estadoId - ID del estado
 * @param catalogos - Catálogos de colores
 * @returns Color hexadecimal o color por defecto
 */
export function obtenerColorEstado(
  estadoId: string | null | undefined,
  catalogos: CatalogosColores
): string {
  if (!estadoId) return "#6b7280"; // Gris por defecto
  const estado = catalogos.estados.get(estadoId);
  return estado?.color || "#6b7280";
}

/**
 * Obtiene el color de una calificación por su ID
 * @param calificacionId - ID de la calificación
 * @param catalogos - Catálogos de colores
 * @returns Color hexadecimal o color por defecto
 */
export function obtenerColorCalificacion(
  calificacionId: string | null | undefined,
  catalogos: CatalogosColores
): string {
  if (!calificacionId) return "#6b7280"; // Gris por defecto
  const calificacion = catalogos.calificaciones.get(calificacionId);
  return calificacion?.color || "#6b7280";
}

/**
 * Obtiene el nombre de un estado por su ID
 * @param estadoId - ID del estado
 * @param catalogos - Catálogos de colores
 * @returns Nombre del estado o "-"
 */
export function obtenerNombreEstado(
  estadoId: string | null | undefined,
  catalogos: CatalogosColores
): string {
  if (!estadoId) return "-";
  const estado = catalogos.estados.get(estadoId);
  return estado?.nombre || "-";
}

/**
 * Obtiene el nombre de una calificación por su ID
 * @param calificacionId - ID de la calificación
 * @param catalogos - Catálogos de colores
 * @returns Nombre de la calificación o "-"
 */
export function obtenerNombreCalificacion(
  calificacionId: string | null | undefined,
  catalogos: CatalogosColores
): string {
  if (!calificacionId) return "-";
  const calificacion = catalogos.calificaciones.get(calificacionId);
  return calificacion?.nombre || "-";
}

/**
 * Genera estilos inline para un badge con color de fondo y texto
 * @param color - Color hexadecimal
 * @param textoClaro - Si el texto debe ser claro (blanco) u oscuro
 * @returns Objeto con estilos CSS
 */
export function generarEstilosBadge(
  color: string,
  textoClaro: boolean = true
): React.CSSProperties {
  // Determinar si el color es claro u oscuro
  const esColorClaro = esColorClaroFunc(color);
  const colorTexto = textoClaro
    ? esColorClaro
      ? "#000000"
      : "#ffffff"
    : esColorClaro
    ? "#ffffff"
    : "#000000";

  return {
    border: `2px solid ${color}`,
    padding: "0.25rem 0.75rem",
    borderRadius: "20px",
    fontSize: "0.875rem",
    fontWeight: 500,
    display: "inline-block",
  };
}

/**
 * Determina si un color es claro u oscuro
 * @param color - Color hexadecimal
 * @returns true si el color es claro, false si es oscuro
 */
function esColorClaroFunc(color: string): boolean {
  // Convertir hex a RGB
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calcular luminosidad relativa
  const luminosidad = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminosidad > 0.5;
}

/**
 * Genera clases de Tailwind para un badge con color
 * Nota: Esta función requiere que los colores estén definidos en tailwind.config.ts
 * Para colores dinámicos, es mejor usar generarEstilosBadge
 * @param color - Color hexadecimal
 * @returns Clases de Tailwind (limitado a colores predefinidos)
 */
export function generarClasesBadge(color: string): string {
  // Mapeo de colores comunes a clases de Tailwind
  const colorMap: Record<string, string> = {
    "#007bff": "bg-blue-500 text-white",
    "#28a745": "bg-green-500 text-white",
    "#ffc107": "bg-yellow-500 text-black",
    "#dc3545": "bg-red-500 text-white",
    "#6c757d": "bg-gray-500 text-white",
    "#17a2b8": "bg-cyan-500 text-white",
    "#475569": "bg-slate-600 text-white",
  };

  return colorMap[color] || "bg-gray-500 text-white";
}

