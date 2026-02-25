/**
 * Modal para generar reportes con filtros y opciones
 */

"use client";

import { useState, useEffect } from "react";
import { ReporteDisponible, ReporteRequest, ReporteFiltros } from "@/types/reportes";
import { FiX, FiDownload, FiCalendar, FiCheckSquare, FiSquare, FiSave } from "react-icons/fi";

interface GenerarReporteModalProps {
  modulo: string;
  reporteDisponible: ReporteDisponible;
  onClose: () => void;
  onGenerar: (request: ReporteRequest) => void;
  generando: boolean;
  onGuardarConfiguracion?: (nombre: string, request: ReporteRequest) => void;
}

export default function GenerarReporteModal({
  modulo,
  reporteDisponible,
  onClose,
  onGenerar,
  generando,
  onGuardarConfiguracion,
}: GenerarReporteModalProps) {
  const [formato, setFormato] = useState<"excel" | "csv" | "pdf">("excel");
  const [filtros, setFiltros] = useState<ReporteFiltros>({});
  const [columnasSeleccionadas, setColumnasSeleccionadas] = useState<string[]>([]);
  const [ordenamiento, setOrdenamiento] = useState<Record<string, "asc" | "desc">>({});
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [activo, setActivo] = useState<boolean | null>(null);
  const [filtrosAdicionales, setFiltrosAdicionales] = useState<Record<string, any>>({});
  const [mostrarGuardar, setMostrarGuardar] = useState(false);
  const [nombreConfiguracion, setNombreConfiguracion] = useState("");

  // Inicializar todas las columnas seleccionadas por defecto
  useEffect(() => {
    if (reporteDisponible && reporteDisponible.columnas_disponibles) {
      setColumnasSeleccionadas([...reporteDisponible.columnas_disponibles]);
    }
  }, [reporteDisponible]);

  const handleToggleColumna = (columna: string) => {
    setColumnasSeleccionadas((prev) => {
      if (prev.includes(columna)) {
        return prev.filter((c) => c !== columna);
      } else {
        return [...prev, columna];
      }
    });
  };

  const handleToggleTodasColumnas = () => {
    if (columnasSeleccionadas.length === reporteDisponible.columnas_disponibles.length) {
      setColumnasSeleccionadas([]);
    } else {
      setColumnasSeleccionadas([...reporteDisponible.columnas_disponibles]);
    }
  };

  const convertirFechaADatetime = (fecha: string): string => {
    // Convertir fecha YYYY-MM-DD a datetime ISO YYYY-MM-DDTHH:MM:SS
    if (!fecha) return "";
    // Si ya tiene formato datetime, retornarlo tal cual
    if (fecha.includes("T")) return fecha;
    // Convertir fecha a inicio del día (00:00:00)
    return `${fecha}T00:00:00`;
  };

  const convertirFechaADatetimeFin = (fecha: string): string => {
    // Convertir fecha YYYY-MM-DD a datetime ISO YYYY-MM-DDTHH:MM:SS
    if (!fecha) return "";
    // Si ya tiene formato datetime, retornarlo tal cual
    if (fecha.includes("T")) return fecha;
    // Convertir fecha a fin del día (23:59:59)
    return `${fecha}T23:59:59`;
  };

  const handleGenerar = () => {
    const filtrosFinales: ReporteFiltros = {
      ...filtros,
    };

    if (fechaDesde) {
      filtrosFinales.fecha_desde = convertirFechaADatetime(fechaDesde);
    }
    if (fechaHasta) {
      filtrosFinales.fecha_hasta = convertirFechaADatetimeFin(fechaHasta);
    }
    if (activo !== null) {
      filtrosFinales.activo = activo;
    }
    if (Object.keys(filtrosAdicionales).length > 0) {
      filtrosFinales.filtros_adicionales = filtrosAdicionales;
    }

    const request: ReporteRequest = {
      modulo,
      formato,
      filtros: Object.keys(filtrosFinales).length > 0 ? filtrosFinales : undefined,
      columnas: columnasSeleccionadas.length > 0 ? columnasSeleccionadas : undefined,
      ordenamiento: Object.keys(ordenamiento).length > 0 ? ordenamiento : undefined,
    };

    onGenerar(request);
  };

  const handleGuardarConfiguracion = () => {
    if (!nombreConfiguracion.trim()) {
      alert("Por favor, ingresa un nombre para la configuración");
      return;
    }

    const filtrosFinales: ReporteFiltros = {
      ...filtros,
    };

    if (fechaDesde) {
      filtrosFinales.fecha_desde = convertirFechaADatetime(fechaDesde);
    }
    if (fechaHasta) {
      filtrosFinales.fecha_hasta = convertirFechaADatetimeFin(fechaHasta);
    }
    if (activo !== null) {
      filtrosFinales.activo = activo;
    }
    if (Object.keys(filtrosAdicionales).length > 0) {
      filtrosFinales.filtros_adicionales = filtrosAdicionales;
    }

    const request: ReporteRequest = {
      modulo,
      formato,
      filtros: Object.keys(filtrosFinales).length > 0 ? filtrosFinales : undefined,
      columnas: columnasSeleccionadas.length > 0 ? columnasSeleccionadas : undefined,
      ordenamiento: Object.keys(ordenamiento).length > 0 ? ordenamiento : undefined,
    };

    if (onGuardarConfiguracion) {
      onGuardarConfiguracion(nombreConfiguracion, request);
      setMostrarGuardar(false);
      setNombreConfiguracion("");
      alert("Configuración guardada exitosamente");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Generar Reporte</h2>
            <p className="text-sm text-gray-600 mt-1">{reporteDisponible.nombre}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Formato */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Formato de Exportación
            </label>
            <div className="flex gap-4">
              {(["excel", "csv", "pdf"] as const).map((fmt) => (
                <label
                  key={fmt}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer transition-colors ${
                    formato === fmt
                      ? "border-primary-600 bg-primary-50 text-primary-700"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="formato"
                    value={fmt}
                    checked={formato === fmt}
                    onChange={() => setFormato(fmt)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">{fmt.toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Filtros de Fecha */}
          {reporteDisponible.filtros_disponibles.includes("fecha_desde") && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FiCalendar className="w-4 h-4 inline mr-1" />
                  Fecha Desde
                </label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FiCalendar className="w-4 h-4 inline mr-1" />
                  Fecha Hasta
                </label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          {/* Filtro Activo */}
          {reporteDisponible.filtros_disponibles.includes("activo") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="activo"
                    checked={activo === null}
                    onChange={() => setActivo(null)}
                  />
                  <span className="text-sm">Todos</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="activo"
                    checked={activo === true}
                    onChange={() => setActivo(true)}
                  />
                  <span className="text-sm">Activos</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="activo"
                    checked={activo === false}
                    onChange={() => setActivo(false)}
                  />
                  <span className="text-sm">Inactivos</span>
                </label>
              </div>
            </div>
          )}

          {/* Columnas */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Columnas a Incluir
              </label>
              <button
                onClick={handleToggleTodasColumnas}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                {columnasSeleccionadas.length === reporteDisponible.columnas_disponibles.length
                  ? "Deseleccionar todas"
                  : "Seleccionar todas"}
              </button>
            </div>
            <div className="border border-gray-200 rounded-md p-4 max-h-96 overflow-y-auto">
              {(() => {
                // Agrupar columnas por categoría
                const columnasAgrupadas: Record<string, string[]> = {
                  "Básicas": [],
                  "Asegurado": [],
                  "Estado y Calificación": [],
                  "Usuarios": [],
                  "Instituciones": [],
                  "Áreas": [],
                  "Otros": [],
                };

                reporteDisponible.columnas_disponibles.forEach((col) => {
                  if (col.startsWith("asegurado_")) {
                    columnasAgrupadas["Asegurado"].push(col);
                  } else if (col.startsWith("estado_") || col.startsWith("calificacion_")) {
                    columnasAgrupadas["Estado y Calificación"].push(col);
                  } else if (col.includes("usuario") || col.includes("creado_por")) {
                    columnasAgrupadas["Usuarios"].push(col);
                  } else if (col.includes("institucion") || col.includes("autoridad")) {
                    columnasAgrupadas["Instituciones"].push(col);
                  } else if (col.includes("area")) {
                    columnasAgrupadas["Áreas"].push(col);
                  } else if (["id", "numero_siniestro", "fecha_siniestro", "fecha_registro", "prioridad", "activo", "creado_en", "actualizado_en"].includes(col)) {
                    columnasAgrupadas["Básicas"].push(col);
                  } else {
                    columnasAgrupadas["Otros"].push(col);
                  }
                });

                return Object.entries(columnasAgrupadas).map(([categoria, columnas]) => {
                  if (columnas.length === 0) return null;
                  return (
                    <div key={categoria} className="mb-4 last:mb-0">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                        {categoria}
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {columnas.map((columna) => {
                          const isSelected = columnasSeleccionadas.includes(columna);
                          return (
                            <label
                              key={columna}
                              className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleColumna(columna)}
                                className="sr-only"
                              />
                              {isSelected ? (
                                <FiCheckSquare className="w-4 h-4 text-primary-600" />
                              ) : (
                                <FiSquare className="w-4 h-4 text-gray-400" />
                              )}
                              <span className="text-sm text-gray-700">
                                {columna.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {columnasSeleccionadas.length} de {reporteDisponible.columnas_disponibles.length}{" "}
              columnas seleccionadas
            </p>
          </div>

          {/* Guardar Configuración */}
          {onGuardarConfiguracion && (
            <div className="border-t border-gray-200 pt-4">
              <button
                onClick={() => setMostrarGuardar(!mostrarGuardar)}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-2"
              >
                <FiSave className="w-4 h-4" />
                {mostrarGuardar ? "Ocultar" : "Guardar esta configuración"}
              </button>
              {mostrarGuardar && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={nombreConfiguracion}
                    onChange={(e) => setNombreConfiguracion(e.target.value)}
                    placeholder="Nombre de la configuración"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={handleGuardarConfiguracion}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                  >
                    Guardar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Ordenamiento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ordenamiento
            </label>
            <div className="space-y-2">
              {reporteDisponible.columnas_disponibles.slice(0, 3).map((columna) => (
                <div key={columna} className="flex items-center gap-2">
                  <select
                    value={ordenamiento[columna] || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value) {
                        setOrdenamiento((prev) => ({
                          ...prev,
                          [columna]: value as "asc" | "desc",
                        }));
                      } else {
                        setOrdenamiento((prev) => {
                          const newOrd = { ...prev };
                          delete newOrd[columna];
                          return newOrd;
                        });
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Sin ordenar</option>
                    <option value="asc">Ascendente</option>
                    <option value="desc">Descendente</option>
                  </select>
                  <span className="text-sm text-gray-600 w-32">
                    {columna.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            disabled={generando}
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerar}
            disabled={generando || columnasSeleccionadas.length === 0}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generando ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Generando...
              </>
            ) : (
              <>
                <FiDownload className="w-4 h-4" />
                Generar y Descargar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
