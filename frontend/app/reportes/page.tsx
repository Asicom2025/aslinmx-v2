/**
 * Página de Reportes
 * Módulo completo para generación y gestión de reportes
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import apiService from "@/lib/apiService";
import { ReporteDisponible, ReporteRequest } from "@/types/reportes";
import { FiFileText, FiDownload, FiSettings, FiFilter, FiBarChart2, FiRefreshCw } from "react-icons/fi";
import GenerarReporteModal from "./components/GenerarReporteModal";
import ConfiguracionesGuardadas from "./components/ConfiguracionesGuardadas";

export default function ReportesPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [reportesDisponibles, setReportesDisponibles] = useState<ReporteDisponible[]>([]);
  const [loadingReportes, setLoadingReportes] = useState(true);
  const [selectedModulo, setSelectedModulo] = useState<string | null>(null);
  const [showGenerarModal, setShowGenerarModal] = useState(false);
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    if (loading) return;
    const token = localStorage.getItem("token");
    if (!token || !user) {
      router.push("/login");
      return;
    }
    loadReportesDisponibles();
  }, [user, loading, router]);

  const loadReportesDisponibles = async () => {
    try {
      setLoadingReportes(true);
      const reportes = await apiService.getReportesDisponibles();
      setReportesDisponibles(reportes);
    } catch (error: any) {
      console.error("Error al cargar reportes disponibles:", error);
      if (error.response?.status === 401) {
        router.push("/login");
      }
    } finally {
      setLoadingReportes(false);
    }
  };

  const handleGenerarReporte = (modulo: string) => {
    setSelectedModulo(modulo);
    setShowGenerarModal(true);
  };

  const handleDescargarReporte = async (request: ReporteRequest) => {
    try {
      setGenerando(true);
      const blob = await apiService.descargarReporte(request);
      
      // Crear URL del blob y descargar
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = request.modulo + "_" + new Date().toISOString().split("T")[0] + "." + request.formato;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setShowGenerarModal(false);
    } catch (error: any) {
      console.error("Error al generar reporte:", error);
      alert("Error al generar el reporte. Por favor, intenta nuevamente.");
    } finally {
      setGenerando(false);
    }
  };

  const handleGuardarConfiguracion = (nombre: string, request: ReporteRequest) => {
    try {
      const stored = localStorage.getItem("reportes_configuraciones");
      const configuraciones = stored ? JSON.parse(stored) : [];
      
      const nuevaConfiguracion = {
        id: Date.now().toString(),
        nombre,
        modulo: request.modulo,
        formato: request.formato,
        filtros: request.filtros,
        columnas: request.columnas,
        ordenamiento: request.ordenamiento,
        creado_en: new Date().toISOString(),
      };
      
      configuraciones.push(nuevaConfiguracion);
      localStorage.setItem("reportes_configuraciones", JSON.stringify(configuraciones));
    } catch (error) {
      console.error("Error al guardar configuración:", error);
      alert("Error al guardar la configuración");
    }
  };

  if (loading || loadingReportes || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando reportes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
          <p className="mt-1 text-sm text-gray-600">
            Genera y descarga reportes de los diferentes módulos del sistema
          </p>
        </div>
        <button
          onClick={loadReportesDisponibles}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors flex items-center gap-2"
        >
          <FiRefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Reportes Disponibles */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <FiFileText className="w-5 h-5" />
            Reportes Disponibles
          </h2>
        </div>
        <div className="p-6">
          {reportesDisponibles.length === 0 ? (
            <div className="text-center py-12">
              <FiFileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No hay reportes disponibles</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reportesDisponibles.map((reporte) => (
                <div
                  key={reporte.modulo}
                  className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {reporte.nombre}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3">{reporte.descripcion}</p>
                    </div>
                    <div className="bg-primary-100 text-primary-600 rounded-full p-2">
                      <FiBarChart2 className="w-5 h-5" />
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <FiFilter className="w-3 h-3" />
                      <span>
                        {reporte.filtros_disponibles.length} filtros disponibles
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <FiSettings className="w-3 h-3" />
                      <span>
                        {reporte.columnas_disponibles.length} columnas disponibles
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleGenerarReporte(reporte.modulo)}
                    className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <FiDownload className="w-4 h-4" />
                    Generar Reporte
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Configuraciones Guardadas */}
      <ConfiguracionesGuardadas
        onGenerarReporte={handleDescargarReporte}
        onAbrirModal={(modulo) => {
          setSelectedModulo(modulo);
          setShowGenerarModal(true);
        }}
      />

      {/* Modal para Generar Reporte */}
      {showGenerarModal && selectedModulo && (
        <GenerarReporteModal
          modulo={selectedModulo}
          reporteDisponible={reportesDisponibles.find((r) => r.modulo === selectedModulo)!}
          onClose={() => {
            setShowGenerarModal(false);
            setSelectedModulo(null);
          }}
          onGenerar={handleDescargarReporte}
          generando={generando}
          onGuardarConfiguracion={handleGuardarConfiguracion}
        />
      )}
    </div>
  );
}
