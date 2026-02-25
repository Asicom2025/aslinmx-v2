/**
 * Página para crear un nuevo flujo de trabajo
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import apiService from "@/lib/apiService";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import CustomSelect, { SelectOption } from "@/components/ui/Select";

export default function NuevoFlujoTrabajoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    area_id: "",
    activo: true,
    es_predeterminado: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value === "" ? null : value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        ...formData,
        area_id: formData.area_id || undefined,
      };
      await apiService.createFlujo(data);
      toast.success("Flujo creado correctamente");
      router.push("/flujos-trabajo");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error al crear flujo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Nuevo Flujo de Trabajo</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
          <Input
            label="Nombre del Flujo"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            required
            placeholder="Ej: Flujo DX Legal General"
          />

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción
            </label>
            <textarea
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              rows={4}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Descripción del flujo de trabajo"
            />
          </div>

          <CustomSelect
            label="Área (opcional - dejar vacío para flujo general)"
            name="area_id"
            value={formData.area_id || ""}
            onChange={(value) => {
              const fakeEvent = {
                target: { name: "area_id", value: value as string },
              } as React.ChangeEvent<HTMLSelectElement>;
              handleChange(fakeEvent);
            }}
            options={[
              { value: "", label: "General (todas las áreas)" },
            ]}
            placeholder="General (todas las áreas)"
          />

          <div className="mt-4 flex gap-6">
            <Switch
              label="Activo"
              checked={!!formData.activo}
              onChange={(checked) => setFormData((prev) => ({ ...prev, activo: checked }))}
            />
            <Switch
              label="Flujo predeterminado"
              checked={!!formData.es_predeterminado}
              onChange={(checked) => setFormData((prev) => ({ ...prev, es_predeterminado: checked }))}
            />
          </div>

          <div className="mt-6 flex gap-4">
            <Button type="submit" variant="primary" loading={loading}>
              Crear Flujo
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

