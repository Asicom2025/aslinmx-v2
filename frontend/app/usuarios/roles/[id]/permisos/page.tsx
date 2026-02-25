/**
 * Página de Configuración de Permisos por Rol
 * Permite configurar qué acciones puede realizar cada rol en cada módulo
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/context/UserContext";
import apiService from "@/lib/apiService";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import { swalSuccess, swalError, swalConfirm } from "@/lib/swal";
import { FiArrowLeft, FiSave, FiCheck, FiX } from "react-icons/fi";

interface PermisoConfig {
  modulo_id: string;
  modulo_nombre: string;
  accion_id: string;
  accion_nombre: string;
  accion_tecnica: string;
  tiene_permiso: boolean;
}

interface RolPermisosConfig {
  rol_id: string;
  rol_nombre: string;
  permisos: PermisoConfig[];
}

export default function PermisosRolPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading } = useUser();
  const [rolId, setRolId] = useState<string>("");
  const [rolNombre, setRolNombre] = useState<string>("");
  const [config, setConfig] = useState<RolPermisosConfig | null>(null);
  const [permisos, setPermisos] = useState<Map<string, boolean>>(new Map());
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
      
      // Crear mapa de permisos
      const permisosMap = new Map<string, boolean>();
      data.permisos.forEach((p: PermisoConfig) => {
        const key = `${p.modulo_id}-${p.accion_id}`;
        permisosMap.set(key, p.tiene_permiso);
      });
      setPermisos(permisosMap);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      console.error("Error al cargar configuración:", e);
      swalError(e.response?.data?.detail || "Error al cargar configuración de permisos");
      router.push("/usuarios");
    } finally {
      setLoadingData(false);
    }
  };

  const togglePermiso = (moduloId: string, accionId: string) => {
    const key = `${moduloId}-${accionId}`;
    const nuevoPermisos = new Map(permisos);
    nuevoPermisos.set(key, !nuevoPermisos.get(key));
    setPermisos(nuevoPermisos);
  };

  const guardarPermisos = async () => {
    if (!config) return;

    const confirmed = await swalConfirm(
      "¿Está seguro de actualizar los permisos de este rol?",
      "Esta acción modificará los permisos del rol y afectará a todos los usuarios con este rol."
    );
    if (!confirmed) return;

    try {
      setSaving(true);
      
      // Construir lista de permisos a asignar
      const permisosParaGuardar = config.permisos
        .filter((p) => {
          const key = `${p.modulo_id}-${p.accion_id}`;
          return permisos.get(key) === true;
        })
        .map((p) => ({
          rol_id: rolId,
          modulo_id: p.modulo_id,
          accion_id: p.accion_id,
          activo: true,
        }));

      await apiService.permiso.actualizarPermisosBulk(
        rolId,
        permisosParaGuardar,
        true // Eliminar otros permisos no incluidos
      );

      await swalSuccess("Permisos actualizados correctamente");
      router.push("/usuarios");
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      console.error("Error al guardar permisos:", e);
      swalError(e.response?.data?.detail || "Error al guardar permisos");
    } finally {
      setSaving(false);
    }
  };

  // Agrupar permisos por módulo
  const permisosPorModulo = config
    ? config.permisos.reduce((acc, permiso) => {
        if (!acc[permiso.modulo_nombre]) {
          acc[permiso.modulo_nombre] = [];
        }
        acc[permiso.modulo_nombre].push(permiso);
        return acc;
      }, {} as Record<string, PermisoConfig[]>)
    : {};

  if (loading || loadingData || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando configuración de permisos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            onClick={() => router.push("/usuarios")}
            className="flex items-center gap-2"
          >
            <FiArrowLeft className="w-4 h-4" />
            Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Configuración de Permisos</h1>
            <p className="text-gray-600 mt-1">Rol: <span className="font-semibold">{rolNombre}</span></p>
          </div>
        </div>
        <Button onClick={guardarPermisos} disabled={saving} className="flex items-center gap-2">
          <FiSave className="w-4 h-4" />
          {saving ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </div>

      {/* Instrucciones */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Instrucciones:</strong> Activa o desactiva los permisos para cada módulo y acción.
          Los cambios se aplicarán a todos los usuarios con este rol.
        </p>
      </div>

      {/* Tabla de Permisos */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Módulo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(permisosPorModulo).map(([moduloNombre, permisosModulo]) => (
                <tr key={moduloNombre} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{moduloNombre}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-4">
                      {permisosModulo.map((permiso) => {
                        const key = `${permiso.modulo_id}-${permiso.accion_id}`;
                        const tienePermiso = permisos.get(key) || false;
                        return (
                          <div key={key} className="flex items-center gap-2">
                            <Switch
                              checked={tienePermiso}
                              onChange={() => togglePermiso(permiso.modulo_id, permiso.accion_id)}
                              size="sm"
                            />
                            <span className={`text-sm ${tienePermiso ? "text-gray-900" : "text-gray-500"}`}>
                              {permiso.accion_nombre}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Total de permisos activos:{" "}
            <strong className="text-gray-900">
              {Array.from(permisos.values()).filter((v) => v).length}
            </strong>
          </span>
          <Button onClick={guardarPermisos} disabled={saving} className="flex items-center gap-2">
            <FiSave className="w-4 h-4" />
            {saving ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </div>
    </div>
  );
}

