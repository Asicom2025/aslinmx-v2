/**
 * Botón reutilizable para crear módulos
 * Incluye modal de creación para usarse en vista de módulos y configuración de roles
 */

"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import apiService from "@/lib/apiService";
import { swalSuccess, swalError } from "@/lib/swal";
import { FiPlus } from "react-icons/fi";

interface ButtonCreateModuloProps {
  onCreated?: () => void;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
  className?: string;
}

export default function ButtonCreateModulo({
  onCreated,
  variant = "primary",
  size = "md",
  children,
  className = "",
}: ButtonCreateModuloProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    nombre_tecnico: "",
    descripcion: "",
    icono: "",
    ruta: "",
    orden: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.nombre_tecnico.trim()) {
      swalError("Nombre y nombre técnico son requeridos");
      return;
    }
    try {
      setLoading(true);
      await apiService.permiso.createModulo({
        nombre: form.nombre.trim(),
        nombre_tecnico: form.nombre_tecnico.trim().toLowerCase().replace(/\s+/g, "_"),
        descripcion: form.descripcion || undefined,
        icono: form.icono || undefined,
        ruta: form.ruta || undefined,
        orden: form.orden || 0,
      });
      await swalSuccess("Módulo creado correctamente");
      setOpen(false);
      setForm({ nombre: "", nombre_tecnico: "", descripcion: "", icono: "", ruta: "", orden: 0 });
      onCreated?.();
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al crear módulo");
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
        {children || "Nuevo módulo"}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Crear módulo" maxWidthClass="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            name="nombre"
            label="Nombre"
            value={form.nombre}
            onChange={(e) => handleNombreChange(e.target.value)}
            placeholder="Ej: Reportes"
            required
          />
          <Input
            name="nombre_tecnico"
            label="Nombre técnico"
            value={form.nombre_tecnico}
            onChange={(e) => setForm((p) => ({ ...p, nombre_tecnico: e.target.value }))}
            placeholder="Ej: reportes"
            required
          />
          <Input
            name="descripcion"
            label="Descripción"
            value={form.descripcion}
            onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
            placeholder="Opcional"
          />
          <Input
            name="ruta"
            label="Ruta"
            value={form.ruta}
            onChange={(e) => setForm((p) => ({ ...p, ruta: e.target.value }))}
            placeholder="Ej: /reportes"
          />
          <Input
            name="orden"
            label="Orden"
            type="number"
            min={0}
            value={String(form.orden)}
            onChange={(e) => setForm((p) => ({ ...p, orden: parseInt(e.target.value) || 0 }))}
          />
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
