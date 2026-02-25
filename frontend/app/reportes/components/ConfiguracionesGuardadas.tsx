/**
 * Componente para mostrar y gestionar configuraciones guardadas de reportes
 */

"use client";

import { useState, useEffect } from "react";
import { ReporteRequest } from "@/types/reportes";
import { FiSettings, FiTrash2, FiPlay, FiEdit, FiSave } from "react-icons/fi";

interface ConfiguracionGuardada {
  id: string;
  nombre: string;
  modulo: string;
  formato: "excel" | "csv" | "pdf";
  filtros?: any;
  columnas?: string[];
  ordenamiento?: Record<string, "asc" | "desc">;
  creado_en: string;
}

interface ConfiguracionesGuardadasProps {
  onGenerarReporte: (request: ReporteRequest) => void;
  onAbrirModal: (modulo: string) => void;
}

export default function ConfiguracionesGuardadas({
  onGenerarReporte,
  onAbrirModal,
}: ConfiguracionesGuardadasProps) {
  const [configuraciones, setConfiguraciones] = useState<ConfiguracionGuardada[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [nombreConfiguracion, setNombreConfiguracion] = useState("");

  // Cargar configuraciones desde localStorage (por ahora)
  useEffect(() => {
    loadConfiguraciones();
  }, []);

  const loadConfiguraciones = () => {
    try {
      const stored = localStorage.getItem("reportes_configuraciones");
      if (stored) {
        setConfiguraciones(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Error al cargar configuraciones:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguraciones = (configs: ConfiguracionGuardada[]) => {
    try {
      localStorage.setItem("reportes_configuraciones", JSON.stringify(configs));
      setConfiguraciones(configs);
    } catch (error) {
      console.error("Error al guardar configuraciones:", error);
    }
  };

  const handleEliminar = (id: string) => {
    if (confirm("¿Estás seguro de eliminar esta configuración?")) {
      const nuevas = configuraciones.filter((c) => c.id !== id);
      saveConfiguraciones(nuevas);
    }
  };

  const handleGenerar = (config: ConfiguracionGuardada) => {
    const request: ReporteRequest = {
      modulo: config.modulo,
      formato: config.formato,
      filtros: config.filtros,
      columnas: config.columnas,
      ordenamiento: config.ordenamiento,
    };
    onGenerarReporte(request);
  };

  const handleGuardarConfiguracion = () => {
    if (!nombreConfiguracion.trim()) {
      alert("Por favor, ingresa un nombre para la configuración");
      return;
    }

    // Esta función se llama desde el modal de generar reporte
    // Aquí solo mostramos un mensaje informativo
    alert("Para guardar una configuración, abre el modal de generar reporte y usa la opción 'Guardar esta configuración'");
    setMostrarFormulario(false);
    setNombreConfiguracion("");
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <FiSettings className="w-5 h-5" />
          Configuraciones Guardadas
        </h2>
        <button
          onClick={() => setMostrarFormulario(!mostrarFormulario)}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors flex items-center gap-2 text-sm"
        >
          <FiSave className="w-4 h-4" />
          Nueva Configuración
        </button>
      </div>

      {mostrarFormulario && (
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex gap-2">
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
            <button
              onClick={() => {
                setMostrarFormulario(false);
                setNombreConfiguracion("");
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="p-6">
        {configuraciones.length === 0 ? (
          <div className="text-center py-12">
            <FiSettings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No hay configuraciones guardadas</p>
            <p className="text-sm text-gray-400">
              Genera un reporte y guárdalo como configuración para reutilizarlo más tarde
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {configuraciones.map((config) => (
              <div
                key={config.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{config.nombre}</h3>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span>
                        <strong>Módulo:</strong> {config.modulo}
                      </span>
                      <span>
                        <strong>Formato:</strong> {config.formato.toUpperCase()}
                      </span>
                      <span>
                        <strong>Columnas:</strong> {config.columnas?.length || 0}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(config.creado_en).toLocaleDateString("es-MX")}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleGenerar(config)}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                      title="Generar reporte"
                    >
                      <FiPlay className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onAbrirModal(config.modulo)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                      title="Editar configuración"
                    >
                      <FiEdit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleEliminar(config.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Eliminar configuración"
                    >
                      <FiTrash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
