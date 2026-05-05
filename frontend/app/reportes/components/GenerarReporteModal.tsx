/**
 * Modal para generar reportes con filtros y opciones
 */

"use client";

import { useState, useEffect } from "react";
import { ReporteDisponible, ReporteRequest, ReporteFiltros } from "@/types/reportes";
import { FiDownload, FiCalendar, FiCheckSquare, FiSquare, FiSave } from "react-icons/fi";
import apiService from "@/lib/apiService";
import CustomSelect, { SelectOption } from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";

interface GenerarReporteModalProps {
  modulo: string;
  reporteDisponible: ReporteDisponible;
  onClose?: () => void;
  onGenerar: (request: ReporteRequest) => void;
  generando: boolean;
  onGuardarConfiguracion?: (nombre: string, request: ReporteRequest) => void;
  embedded?: boolean;
}

export default function GenerarReporteModal({
  modulo,
  reporteDisponible,
  onClose,
  onGenerar,
  generando,
  onGuardarConfiguracion,
  embedded = false,
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
  const [catalogos, setCatalogos] = useState({
    instituciones: [] as any[],
    autoridades: [] as any[],
    areas: [] as any[],
    provenientes: [] as any[],
    asegurados: [] as any[],
    calificaciones: [] as any[],
    estados: [] as any[],
    usuarios: [] as any[],
    entidadesFederativas: [] as string[],
    geoEstados: [] as { id: string; nombre?: string }[],
  });

  // Inicializar todas las columnas seleccionadas por defecto
  useEffect(() => {
    if (reporteDisponible && reporteDisponible.columnas_disponibles) {
      setColumnasSeleccionadas([...reporteDisponible.columnas_disponibles]);
    }
  }, [reporteDisponible]);

  useEffect(() => {
    if (modulo !== "siniestros") return;
    const loadCatalogos = async () => {
      try {
        const [
          instituciones,
          autoridades,
          areas,
          provenientes,
          asegurados,
          calificaciones,
          estados,
          usuarios,
        ] = await Promise.all([
          apiService.getInstituciones(true),
          apiService.getAutoridades(true),
          apiService.getAreas(true),
          apiService.getProvenientes(true),
          apiService.getAsegurados(true),
          apiService.getCalificacionesSiniestro(true),
          apiService.getEstadosSiniestro(true),
          apiService.getUsers(0, 1000),
        ]);

        const estadosRaw = (asegurados || [])
          .map((a: any) => (a?.estado || "").trim())
          .filter(Boolean) as string[];
        const estadosAsegurados: string[] = Array.from(
          new Set<string>(estadosRaw),
        ).sort((a: string, b: string) => a.localeCompare(b, "es"));

        let geoEstados: { id: string; nombre?: string }[] = [];
        try {
          const paises = (await apiService.getGeoPaises(true)) as { id: string; codigo_iso?: string }[];
          const mx = (paises || []).find(
            (p) => String(p.codigo_iso || "").toUpperCase() === "MX",
          );
          if (mx?.id) {
            geoEstados = ((await apiService.getGeoEstados(String(mx.id), true)) ||
              []) as { id: string; nombre?: string }[];
          }
        } catch {
          geoEstados = [];
        }

        setCatalogos({
          instituciones: instituciones || [],
          autoridades: autoridades || [],
          areas: areas || [],
          provenientes: provenientes || [],
          asegurados: asegurados || [],
          calificaciones: calificaciones || [],
          estados: estados || [],
          usuarios: usuarios || [],
          entidadesFederativas: estadosAsegurados,
          geoEstados,
        });
      } catch {
        // Si falla algún catálogo, el usuario puede seguir exportando con otros filtros.
      }
    };
    loadCatalogos();
  }, [modulo]);

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

  const setFiltroAdicional = (key: string, value: string | string[]) => {
    setFiltrosAdicionales((prev) => {
      const next = { ...prev };
      if (Array.isArray(value)) {
        if (value.length === 0) delete next[key];
        else next[key] = value;
      } else if (!value) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const filtroAdicional = (key: string): string =>
    Array.isArray(filtrosAdicionales[key])
      ? ""
      : String(filtrosAdicionales[key] || "");

  const filtroAdicionalMulti = (key: string): string[] => {
    const v = filtrosAdicionales[key];
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
    if (v != null && String(v).trim()) return [String(v)];
    return [];
  };
  const buildSimpleOptions = (
    items: any[],
    labelBuilder: (item: any) => string,
  ): SelectOption[] =>
    (items || [])
      .filter((item) => item?.id)
      .map((item) => ({
        value: String(item.id),
        label: labelBuilder(item),
      }));

  const orderOptions: SelectOption[] = [
    { value: "asc", label: "Ascendente" },
    { value: "desc", label: "Descendente" },
  ];

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

  const content = (
      <div className="space-y-6">
        <p className="text-sm text-gray-600">{reporteDisponible.nombre}</p>
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

          {/* Filtros de negocio para exportar siniestros */}
          {modulo === "siniestros" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reporteDisponible.filtros_disponibles.includes("geo_estado_id") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Entidad federativa
                  </label>
                  <CustomSelect
                    name="filtro_geo_estado_id"
                    isMulti
                    value={filtroAdicionalMulti("geo_estado_id")}
                    onChange={(value) =>
                      setFiltroAdicional("geo_estado_id", Array.isArray(value) ? value : [])
                    }
                    options={buildSimpleOptions(
                      catalogos.geoEstados,
                      (item) => item.nombre || "Sin nombre",
                    )}
                    placeholder="Todos (vacío = sin filtro)"
                    usePortal={false}
                  />
                </div>
              )}

              {reporteDisponible.filtros_disponibles.includes("institucion_id") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Institución</label>
                  <CustomSelect
                    name="filtro_institucion"
                    isMulti
                    value={filtroAdicionalMulti("institucion_id")}
                    onChange={(value) =>
                      setFiltroAdicional(
                        "institucion_id",
                        Array.isArray(value) ? value : [],
                      )
                    }
                    options={buildSimpleOptions(catalogos.instituciones, (item) => item.nombre || "Sin nombre")}
                    placeholder="Todas (vacío = sin filtro)"
                    usePortal={false}
                  />
                </div>
              )}

              {reporteDisponible.filtros_disponibles.includes("autoridad_id") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Autoridad</label>
                  <CustomSelect
                    name="filtro_autoridad"
                    isMulti
                    value={filtroAdicionalMulti("autoridad_id")}
                    onChange={(value) =>
                      setFiltroAdicional(
                        "autoridad_id",
                        Array.isArray(value) ? value : [],
                      )
                    }
                    options={buildSimpleOptions(catalogos.autoridades, (item) => item.nombre || "Sin nombre")}
                    placeholder="Todas (vacío = sin filtro)"
                    usePortal={false}
                  />
                </div>
              )}

              {reporteDisponible.filtros_disponibles.includes("area_id") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Área</label>
                  <CustomSelect
                    name="filtro_area"
                    isMulti
                    value={filtroAdicionalMulti("area_id")}
                    onChange={(value) =>
                      setFiltroAdicional("area_id", Array.isArray(value) ? value : [])
                    }
                    options={buildSimpleOptions(catalogos.areas, (item) => item.nombre || "Sin nombre")}
                    placeholder="Todas (vacío = sin filtro)"
                    usePortal={false}
                  />
                </div>
              )}

              {reporteDisponible.filtros_disponibles.includes("proveniente_id") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Proveniente</label>
                  <CustomSelect
                    name="filtro_proveniente"
                    isMulti
                    value={filtroAdicionalMulti("proveniente_id")}
                    onChange={(value) =>
                      setFiltroAdicional(
                        "proveniente_id",
                        Array.isArray(value) ? value : [],
                      )
                    }
                    options={buildSimpleOptions(catalogos.provenientes, (item) => item.nombre || "Sin nombre")}
                    placeholder="Todos (vacío = sin filtro)"
                    usePortal={false}
                  />
                </div>
              )}

              {reporteDisponible.filtros_disponibles.includes("asegurado_id") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Asegurado</label>
                  <CustomSelect
                    name="filtro_asegurado"
                    isMulti
                    value={filtroAdicionalMulti("asegurado_id")}
                    onChange={(value) =>
                      setFiltroAdicional(
                        "asegurado_id",
                        Array.isArray(value) ? value : [],
                      )
                    }
                    options={buildSimpleOptions(
                      catalogos.asegurados,
                      (item) =>
                        [item.nombre, item.apellido_paterno, item.apellido_materno]
                          .filter(Boolean)
                          .join(" ") || "Sin nombre",
                    )}
                    placeholder="Todos (vacío = sin filtro)"
                    usePortal={false}
                  />
                </div>
              )}

              {reporteDisponible.filtros_disponibles.includes("calificacion_id") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Calificación</label>
                  <CustomSelect
                    name="filtro_calificacion"
                    isMulti
                    value={filtroAdicionalMulti("calificacion_id")}
                    onChange={(value) =>
                      setFiltroAdicional(
                        "calificacion_id",
                        Array.isArray(value) ? value : [],
                      )
                    }
                    options={buildSimpleOptions(catalogos.calificaciones, (item) => item.nombre || "Sin nombre")}
                    placeholder="Todas (vacío = sin filtro)"
                    usePortal={false}
                  />
                </div>
              )}

              {reporteDisponible.filtros_disponibles.includes("estado_id") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estatus</label>
                  <CustomSelect
                    name="filtro_estado"
                    isMulti
                    value={filtroAdicionalMulti("estado_id")}
                    onChange={(value) =>
                      setFiltroAdicional("estado_id", Array.isArray(value) ? value : [])
                    }
                    options={buildSimpleOptions(catalogos.estados, (item) => item.nombre || "Sin nombre")}
                    placeholder="Todos (vacío = sin filtro)"
                    usePortal={false}
                  />
                </div>
              )}

              {reporteDisponible.filtros_disponibles.includes("prioridad") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prioridad</label>
                  <CustomSelect
                    name="filtro_prioridad"
                    isMulti
                    value={filtroAdicionalMulti("prioridad")}
                    onChange={(value) =>
                      setFiltroAdicional("prioridad", Array.isArray(value) ? value : [])
                    }
                    options={[
                      { value: "baja", label: "Baja" },
                      { value: "media", label: "Media" },
                      { value: "alta", label: "Alta" },
                      { value: "critica", label: "Crítica" },
                    ]}
                    placeholder="Todas (vacío = sin filtro)"
                    usePortal={false}
                  />
                </div>
              )}

              {reporteDisponible.filtros_disponibles.includes("fecha_reporte_mes") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Reporte (Mes)</label>
                  <input
                    type="month"
                    value={filtroAdicional("fecha_reporte_mes")}
                    onChange={(e) => setFiltroAdicional("fecha_reporte_mes", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}

              {reporteDisponible.filtros_disponibles.includes("usuario_id") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Usuario</label>
                  <CustomSelect
                    name="filtro_usuario"
                    isMulti
                    value={filtroAdicionalMulti("usuario_id")}
                    onChange={(value) =>
                      setFiltroAdicional("usuario_id", Array.isArray(value) ? value : [])
                    }
                    options={buildSimpleOptions(
                      catalogos.usuarios,
                      (item) => item.full_name || item.email || item.username || "Usuario",
                    )}
                    placeholder="Todos (vacío = sin filtro)"
                    usePortal={false}
                  />
                </div>
              )}
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
            <div className="border border-gray-200 rounded-md p-4 max-h-96 min-h-40 overflow-y-auto">
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
                  <div className="flex-1">
                    <CustomSelect
                      name={`ordenamiento_${columna}`}
                      value={ordenamiento[columna] || ""}
                      onChange={(value) => {
                        const v = String(value || "");
                        if (v === "asc" || v === "desc") {
                          setOrdenamiento((prev) => ({ ...prev, [columna]: v }));
                        } else {
                          setOrdenamiento((prev) => {
                            const next = { ...prev };
                            delete next[columna];
                            return next;
                          });
                        }
                      }}
                      options={[{ value: "", label: "Sin ordenar" }, ...orderOptions]}
                      placeholder="Sin ordenar"
                      usePortal={false}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-32">
                    {columna.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>

        {/* Footer */}
        <div className="border-t border-gray-200 pt-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            disabled={generando}
            style={{ display: embedded ? "none" : undefined }}
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
  );

  if (embedded) {
    return <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">{content}</div>;
  }

  return (
    <Modal
      open
      onClose={onClose || (() => {})}
      title="Generar Reporte"
      maxWidthClass="max-w-4xl"
      maxHeightClass="h-[min(90dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem))]"
    >
      {content}
    </Modal>
  );
}
