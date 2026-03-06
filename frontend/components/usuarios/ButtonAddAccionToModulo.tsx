/**
 * Botón para agregar una o más acciones a un módulo para un rol.
 * Permite selección múltiple con checkboxes en un modal amplio.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Checkbox from "@/components/ui/Checkbox";
import apiService from "@/lib/apiService";
import { swalSuccess, swalError } from "@/lib/swal";
import { FiPlus } from "react-icons/fi";

interface Accion {
  id: string;
  nombre: string;
  nombre_tecnico: string;
  activo?: boolean;
}

interface ButtonAddAccionToModuloProps {
  rolId: string;
  moduloId: string;
  moduloNombre: string;
  accionesActuales: { accion_id: string }[];
  onAdded?: () => void;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
  className?: string;
}

export default function ButtonAddAccionToModulo({
  rolId,
  moduloId,
  moduloNombre,
  accionesActuales,
  onAdded,
  variant = "outline",
  size = "sm",
  children,
  className = "",
}: ButtonAddAccionToModuloProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const idsActuales = new Set(accionesActuales.map((a) => String(a.accion_id)));

  useEffect(() => {
    if (open) {
      apiService.permiso
        .getAcciones(true)
        .then((data: Accion[]) => setAcciones(data))
        .catch(() => setAcciones([]));
      setSelectedIds(new Set());
    }
  }, [open]);

  const disponibles = acciones.filter((a) => !idsActuales.has(String(a.id)));

  const toggleAccion = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(disponibles.map((a) => a.id)));
  }, [disponibles]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleAsignar = async () => {
    if (selectedIds.size === 0) {
      swalError("Selecciona al menos una acción");
      return;
    }
    try {
      setLoading(true);
      await Promise.all(
        Array.from(selectedIds).map((accionId) =>
          apiService.permiso.asignarAccionModulo(rolId, moduloId, accionId)
        )
      );
      await swalSuccess(
        selectedIds.size === 1
          ? `Acción asignada a ${moduloNombre}`
          : `${selectedIds.size} acciones asignadas a ${moduloNombre}`
      );
      setOpen(false);
      onAdded?.();
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al asignar acción(es)");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 ${className}`}
      >
        <FiPlus className="w-3.5 h-3.5" />
        {children || "Agregar acción"}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Agregar acciones a ${moduloNombre}`}
        maxWidthClass="max-w-3xl"
      >
        <div className="space-y-5">
          <p className="text-sm text-gray-600">
            Elige una o más acciones para asignarlas a este módulo. Puedes seleccionar varias a la vez.
          </p>
          {disponibles.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">
              No hay acciones disponibles para agregar. Todas las acciones ya están asignadas a este módulo.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-200">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {disponibles.length} acción(es) disponible(s)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-xs font-medium text-primary-600 hover:text-primary-700"
                  >
                    Seleccionar todas
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {disponibles.map((a) => (
                  <div
                    key={a.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
                      selectedIds.has(a.id) ? "bg-primary-50 border-primary-200" : "border-gray-100 hover:bg-gray-50"
                    }`}
                  >
                    <Checkbox
                      checked={selectedIds.has(a.id)}
                      onChange={(checked) => toggleAccion(a.id, checked)}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-gray-900 block truncate">{a.nombre}</span>
                      <span className="text-xs text-gray-500">{a.nombre_tecnico}</span>
                    </div>
                  </div>
                ))}
              </div>
              {selectedIds.size > 0 && (
                <p className="text-sm text-gray-500">
                  {selectedIds.size} acción(es) seleccionada(s)
                </p>
              )}
            </>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAsignar}
              disabled={loading || selectedIds.size === 0}
            >
              {loading ? "Asignando..." : selectedIds.size === 0 ? "Asignar" : `Asignar ${selectedIds.size} acción(es)`}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
