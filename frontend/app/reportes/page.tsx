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
import { FiFileText, FiRefreshCw } from "react-icons/fi";
import GenerarReporteModal from "./components/GenerarReporteModal";
import ConfiguracionesGuardadas from "./components/ConfiguracionesGuardadas";

export default function ReportesPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [reportesDisponibles, setReportesDisponibles] = useState<ReporteDisponible[]>([]);
  const [loadingReportes, setLoadingReportes] = useState(true);
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

  const handleDescargarReporte = async (request: ReporteRequest) => {
    try {
      setGenerando(true);
      await apiService.descargarReporte(request);
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

  const reporteSiniestros = reportesDisponibles.find((r) => r.modulo === "siniestros");

  return (
    <div className="min-h-screen w-full bg-gray-50">
      <div className="w-full px-3 sm:px-4 lg:px-6 py-4 lg:py-6 space-y-4 lg:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Reportes
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Exporta siniestros aplicando filtros de negocio
            </p>
          </div>
          <button
            onClick={loadReportesDisponibles}
            className="inline-flex w-full sm:w-auto justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors items-center gap-2"
          >
            <FiRefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>

        {/* Reportes Disponibles */}
        <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 sm:text-xl">
            <FiFileText className="w-5 h-5" />
            Reportes Disponibles
          </h2>
        </div>
        <div className="p-4 sm:p-6">
          {!reporteSiniestros ? (
            <div className="text-center py-12">
              <FiFileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No hay configuración de reporte de siniestros disponible</p>
            </div>
          ) : (
            <div id="reporte-siniestros-parametros">
              <GenerarReporteModal
                embedded
                modulo={reporteSiniestros.modulo}
                reporteDisponible={reporteSiniestros}
                onGenerar={handleDescargarReporte}
                generando={generando}
                onGuardarConfiguracion={handleGuardarConfiguracion}
              />
            </div>
          )}
        </div>
        </div>

        {/* Configuraciones Guardadas */}
        <ConfiguracionesGuardadas
          onGenerarReporte={handleDescargarReporte}
          onAbrirModal={() => {
            const target = document.getElementById("reporte-siniestros-parametros");
            if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      </div>
    </div>
  );
}
