/**
 * Botón reutilizable para crear acciones
 * Permite asignar la acción a uno o más módulos al crearla.
 * Cada módulo puede tener un conjunto diferente de acciones.
 */

"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import apiService from "@/lib/apiService";
import { swalSuccess, swalError } from "@/lib/swal";
import { FiPlus } from "react-icons/fi";

interface Modulo {
  id: string;
  nombre: string;
  nombre_tecnico: string;
}

interface ButtonCreateAccionProps {
  onCreated?: () => void;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
  className?: string;
  /** Rol al que asignar (requerido para asignar a módulos) */
  rolId?: string;
  /** Si se indica, la acción se asignará automáticamente a este módulo */
  moduloId?: string;
}

export default function ButtonCreateAccion({
  onCreated,
  variant = "primary",
  size = "md",
  children,
  className = "",
  rolId,
  moduloId,
}: ButtonCreateAccionProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [form, setForm] = useState({
    nombre: "",
    nombre_tecnico: "",
    descripcion: "",
    moduloIds: [] as string[],
  });

  useEffect(() => {
    if (open) {
      apiService.permiso.getModulos(true).then(setModulos).catch(() => setModulos([]));
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.nombre_tecnico.trim()) {
      swalError("Nombre y nombre técnico son requeridos");
      return;
    }
    try {
      setLoading(true);
      const nuevaAccion = await apiService.permiso.createAccion({
        nombre: form.nombre.trim(),
        nombre_tecnico: form.nombre_tecnico.trim().toLowerCase().replace(/\s+/g, "_"),
        descripcion: form.descripcion || undefined,
      });
      if (rolId) {
        const idsParaAsignar = moduloId
          ? [String(moduloId)]
          : form.moduloIds.map((id) => String(id));
        for (const mid of idsParaAsignar) {
          try {
            await apiService.permiso.asignarAccionModulo(rolId, mid, String(nuevaAccion.id));
          } catch {
            // Ignorar si ya está asignada
          }
        }
      }
      await swalSuccess("Acción creada correctamente");
      setOpen(false);
      setForm({ nombre: "", nombre_tecnico: "", descripcion: "", moduloIds: [] });
      onCreated?.();
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al crear acción");
    } finally {
      setLoading(false);
    }
  };

  const handleNombreChange = (v: string) => {
    setForm((prev) => ({
      ...prev,
      nombre: v,
      nombre_tecnico: v.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
    }));
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 ${className}`}
      >
        <FiPlus className="w-4 h-4" />
        {children || "Nueva acción"}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Crear acción" maxWidthClass="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            name="nombre"
            label="Nombre"
            value={form.nombre}
            onChange={(e) => handleNombreChange(e.target.value)}
            placeholder="Ej: Exportar"
            required
          />
          <Input
            name="nombre_tecnico"
            label="Nombre técnico"
            value={form.nombre_tecnico}
            onChange={(e) => setForm((p) => ({ ...p, nombre_tecnico: e.target.value }))}
            placeholder="Ej: exportar"
            required
          />
          <Input
            name="descripcion"
            label="Descripción"
            value={form.descripcion}
            onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
            placeholder="Opcional"
          />
          {!moduloId && modulos.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Asignar a módulos (opcional)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({ ...p, moduloIds: modulos.map((m) => String(m.id)) }))
                    }
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Todos
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, moduloIds: [] }))}
                    className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                  >
                    Ninguno
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {modulos.map((m) => {
                  const mid = String(m.id);
                  const checked = form.moduloIds.includes(mid);
                  return (
                    <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setForm((p) => ({
                            ...p,
                            moduloIds: isChecked
                              ? [...p.moduloIds.filter((id) => id !== mid), mid]
                              : p.moduloIds.filter((id) => id !== mid),
                          }));
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{m.nombre}</span>
                    </label>
                  );
                })}
              </div>
              {form.moduloIds.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {form.moduloIds.length} módulo(s) seleccionado(s)
                </p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
