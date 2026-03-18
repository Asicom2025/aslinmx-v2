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
import CustomSelect, { SelectOption } from "@/components/ui/Select";
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
  /** Si se indica, el formulario se bloquea a este módulo */
  moduloId?: string;
}

export default function ButtonCreateAccion({
  onCreated,
  variant = "primary",
  size = "md",
  children,
  className = "",
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
    // Determinar a qué módulos se asignará la acción
    const moduloIdsDestino: string[] = moduloId
      ? [String(moduloId)]
      : form.moduloIds.map((id) => String(id));

    if (moduloIdsDestino.length === 0) {
      swalError("Selecciona al menos un módulo para la acción");
      return;
    }
    try {
      setLoading(true);
      // Crear una acción por cada módulo seleccionado (acciones "en común" por nombre/nombre_tecnico, pero registros separados)
      await Promise.all(
        moduloIdsDestino.map(async (mid) => {
          await apiService.permiso.createAccion({
            modulo_id: mid,
            nombre: form.nombre.trim(),
            nombre_tecnico: form.nombre_tecnico.trim().toLowerCase().replace(/\s+/g, "_"),
            descripcion: form.descripcion || undefined,
          });
        })
      );
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
            <CustomSelect
              label="Módulos donde aplica esta acción"
              name="modulos"
              value={form.moduloIds}
              onChange={(value) =>
                setForm((p) => ({ ...p, moduloIds: Array.isArray(value) ? (value as string[]) : [] }))
              }
              options={modulos.map<SelectableOption>((m) => ({
                value: String(m.id),
                label: m.nombre,
              }))}
              isMulti
              placeholder="Selecciona uno o varios módulos"
            />
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
