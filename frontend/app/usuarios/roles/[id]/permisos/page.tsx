/**
 * Página de Configuración de Permisos por Rol
 * Diseño detallado: módulos en cards con iconos, acciones con checkboxes,
 * estadísticas, barra de progreso, selección masiva por módulo
 */

"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/context/UserContext";
import { useEmpresaColors } from "@/hooks/useEmpresaColors";
import apiService from "@/lib/apiService";
import Button from "@/components/ui/Button";
import ButtonCreateModulo from "@/components/usuarios/ButtonCreateModulo";
import ButtonCreateAccion from "@/components/usuarios/ButtonCreateAccion";
import ButtonAddAccionToModulo from "@/components/usuarios/ButtonAddAccionToModulo";
import { swalSuccess, swalError, swalConfirm } from "@/lib/swal";
import {
  FiArrowLeft,
  FiShield,
  FiLayers,
  FiCheck,
  FiGrid,
  FiFileText,
  FiUsers,
  FiSettings,
  FiBarChart2,
  FiClipboard,
  FiDatabase,
  FiChevronRight,
  FiTrash2,
} from "react-icons/fi";

interface AccionConfig {
  accion_id: string;
  accion_nombre: string;
  accion_tecnica: string;
  tiene_permiso: boolean;
}

interface ModuloConfig {
  modulo_id: string;
  modulo_nombre: string;
  orden: number;
  acciones: AccionConfig[];
}

interface RolPermisosConfig {
  rol_id: string;
  rol_nombre: string;
  modulos: ModuloConfig[];
}

const MODULO_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: FiGrid,
  siniestros: FiFileText,
  usuarios: FiUsers,
  configuracion: FiSettings,
  reportes: FiBarChart2,
  auditoria: FiClipboard,
  backups: FiDatabase,
};

function getModuloIcon(nombre: string) {
  const n = nombre.toLowerCase();
  if (n.includes("dashboard") || n.includes("panel")) return MODULO_ICONS.dashboard;
  if (n.includes("siniestro")) return MODULO_ICONS.siniestros;
  if (n.includes("usuario") || n.includes("rol")) return MODULO_ICONS.usuarios;
  if (n.includes("config")) return MODULO_ICONS.configuracion;
  if (n.includes("reporte")) return MODULO_ICONS.reportes;
  if (n.includes("auditor")) return MODULO_ICONS.auditoria;
  if (n.includes("backup")) return MODULO_ICONS.backups;
  return FiLayers;
}

export default function PermisosRolPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading } = useUser();
  const colors = useEmpresaColors();
  const [rolId, setRolId] = useState<string>("");
  const [rolNombre, setRolNombre] = useState<string>("");
  const [config, setConfig] = useState<RolPermisosConfig | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    const token = localStorage.getItem("token");
    if (!token || !user) {
      router.push("/login");
      return;
    }
    const id = params.id as string;
    if (id) {
      setRolId(id);
      loadConfiguracion(id);
    }
  }, [user, loading, router, params]);

  const loadConfiguracion = async (id: string) => {
    try {
      setLoadingData(true);
      const data = await apiService.permiso.getConfiguracionPermisos(id);
      setConfig(data);
      setRolNombre(data.rol_nombre);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al cargar configuración de permisos");
      router.push("/usuarios");
    } finally {
      setLoadingData(false);
    }
  };

  const quitarAccion = async (moduloId: string, accionId: string) => {
    const ok = await swalConfirm(
      "¿Quitar esta acción del módulo?",
      "El rol ya no tendrá este permiso."
    );
    if (!ok) return;
    try {
      setSaving(true);
      await apiService.permiso.desasignarAccionModulo(rolId, moduloId, accionId);
      await swalSuccess("Acción quitada");
      loadConfiguracion(rolId);
    } catch (e: any) {
      if (e.response?.status === 401) router.push("/login");
      else swalError(e.response?.data?.detail || "Error al quitar acción");
    } finally {
      setSaving(false);
    }
  };

  const totalPermisos = useMemo(
    () => config?.modulos.reduce((s, m) => s + m.acciones.length, 0) ?? 0,
    [config]
  );

  if (loading || loadingData || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-14 h-14 rounded-full border-4 border-gray-200 border-t-primary-500 animate-spin mx-auto"
            style={{ borderTopColor: colors.primary }}
          />
          <p className="mt-5 text-gray-600 font-medium">Cargando configuración de permisos...</p>
          <p className="mt-1 text-sm text-gray-400">Un momento por favor</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-gray-50 to-gray-100/80">
      {/* Header fijo */}
      <header className="sticky w-full top-16 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-3">
            <Link href="/usuarios" className="hover:text-primary-600 transition-colors">
              Usuarios
            </Link>
            <FiChevronRight className="w-4 h-4 text-gray-400" />
            <Link href="/usuarios" className="hover:text-primary-600 transition-colors">
              Roles
            </Link>
            <FiChevronRight className="w-4 h-4 text-gray-400" />
            <span className="text-gray-900 font-medium">Permisos</span>
          </nav>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/usuarios")}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all"
                aria-label="Volver"
              >
                <FiArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-3">
                <div
                  className="p-3 rounded-xl shadow-sm"
                  style={{ backgroundColor: `${colors.primary}15`, color: colors.primary }}
                >
                  <FiShield className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                    Permisos del rol
                  </h1>
                  <p className="text-gray-600 font-medium">{rolNombre}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonCreateModulo onCreated={() => loadConfiguracion(rolId)} variant="outline" size="sm" />
              <ButtonCreateAccion rolId={rolId} onCreated={() => loadConfiguracion(rolId)} variant="outline" size="sm" />
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Estadísticas */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary-50">
                <FiLayers className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Módulos</p>
                <p className="text-2xl font-bold text-gray-900">{config?.modulos.length ?? 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <FiCheck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Permisos activos</p>
                <p className="text-2xl font-bold text-gray-900">{totalPermisos}</p>
              </div>
            </div>
          </div>
        </div>


        {/* Cards de módulos */}
        <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {config?.modulos.map((modulo) => {
            const { modulo_id, modulo_nombre, acciones } = modulo;
            const IconModulo = getModuloIcon(modulo_nombre);

            return (
              <article
                key={modulo_id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Encabezado del módulo */}
                <div
                  className="px-5 py-4 border-b"
                  style={{ borderColor: `${colors.primary}20`, backgroundColor: `${colors.primary}06` }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="p-2.5 rounded-lg flex-shrink-0"
                        style={{ backgroundColor: `${colors.primary}20`, color: colors.primary }}
                      >
                        <IconModulo className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{modulo_nombre}</h3>
                        <p className="text-xs text-gray-500">
                          {acciones.length} acción(es) asignada(s)
                        </p>
                      </div>
                    </div>
                    <ButtonAddAccionToModulo
                      rolId={rolId}
                      moduloId={modulo_id}
                      moduloNombre={modulo_nombre}
                      accionesActuales={acciones}
                      onAdded={() => loadConfiguracion(rolId)}
                      variant="outline"
                      size="sm"
                    />
                  </div>
                </div>

                {/* Lista de acciones */}
                <div className="p-4 space-y-1">
                  {acciones.map((a) => (
                    <div
                      key={`${modulo_id}-${a.accion_id}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary-50/50 hover:bg-primary-50/70 transition-colors"
                    >
                      <FiCheck className="w-4 h-4 flex-shrink-0" style={{ color: colors.primary }} />
                      <span className="text-sm font-medium flex-1 text-gray-900">{a.accion_nombre}</span>
                      <button
                        onClick={() => quitarAccion(modulo_id, a.accion_id)}
                        disabled={saving}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Quitar acción"
                        aria-label="Quitar acción"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {acciones.length === 0 && (
                    <div className="py-4 text-center text-gray-500 text-sm">
                      <p>Sin acciones. Usa &quot;Agregar acción&quot; para asignar.</p>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {(!config?.modulos || config.modulos.length === 0) && (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
            <FiLayers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">No hay módulos configurados</p>
            <p className="text-sm text-gray-500 mt-1">Crea un módulo o contacta al administrador.</p>
          </div>
        )}
      </main>

      
    </div>
  );
}
