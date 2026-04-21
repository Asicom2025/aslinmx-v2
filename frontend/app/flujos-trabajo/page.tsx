/**
 * Página principal de gestión de flujos de trabajo
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { swalSuccess, swalError, swalConfirmDelete } from "@/lib/swal";
import apiService from "@/lib/apiService";
import type { FlujoTrabajo } from "@/types/flujosTrabajo";
import Button from "@/components/ui/Button";
import { useUser } from "@/context/UserContext";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Switch from "@/components/ui/Switch";
import CustomSelect, { SelectOption } from "@/components/ui/Select";
import { FiPlus } from "react-icons/fi";
import { usePermisos } from "@/hooks/usePermisos";
import { MODULO, ACCION } from "@/lib/permisosConstants";

export default function FlujosTrabajoPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const { can } = usePermisos();
  const canFlujoCreate =
    can(MODULO.configuracion, ACCION.create) || can(MODULO.parametros, ACCION.create);
  const canFlujoUpdate =
    can(MODULO.configuracion, ACCION.update) || can(MODULO.parametros, ACCION.update);
  const canFlujoDelete =
    can(MODULO.configuracion, ACCION.delete) || can(MODULO.parametros, ACCION.delete);
  const canVerDetalleFlujo =
    can(MODULO.configuracion, ACCION.read) ||
    can(MODULO.parametros, ACCION.read) ||
    can(MODULO.siniestros, ACCION.read);
  const [flujos, setFlujos] = useState<FlujoTrabajo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterArea, setFilterArea] = useState<string | null>(null);
  const [areas, setAreas] = useState<SelectOption[]>([]);
  const [plantillas, setPlantillas] = useState<SelectOption[]>([]);

  // Modal state
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<FlujoTrabajo | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    area_id: "",
    activo: true,
    es_predeterminado: false,
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token && !userLoading) {
      router.push("/login");
    }
  }, [router, userLoading]);

  useEffect(() => {
    if (!userLoading && user) {
      // Verificar que el usuario tenga empresa asignada antes de cargar datos
      if (!user.empresa?.id && (!user.empresas || user.empresas.length === 0)) {
        console.warn("FlujosTrabajoPage: Usuario no tiene empresa asignada");
        setLoading(false);
        return;
      }
      cargarFlujos();
      cargarAreas();
      cargarPlantillas();
    }
  }, [userLoading, user, filterArea]);

  const cargarAreas = async () => {
    try {
      const data = await apiService.getAreas(true);
      setAreas([
        { value: "", label: "General (todas las áreas)" },
        ...data.map((area: any) => ({ value: area.id, label: area.nombre }))
      ]);
    } catch (error) {
      console.error("Error al cargar áreas:", error);
    }
  };

  const cargarPlantillas = async () => {
    try {
      const data = await apiService.getPlantillas(true);
      setPlantillas(data.map((plantilla: any) => ({ value: plantilla.id, label: plantilla.nombre })));
    } catch (error) {
      console.error("Error al cargar plantillas:", error);
    }
  };

  const cargarFlujos = async () => {
    try {
      setLoading(true);
      // Si filterArea es "null", enviar "null" como string, si es null enviar undefined
      const areaParam = filterArea === "null" ? "null" : filterArea || undefined;
      console.log("FlujosTrabajoPage: Cargando flujos con parámetros:", { areaParam, activo: true });
      const data = await apiService.getFlujos(areaParam, true);
      console.log("FlujosTrabajoPage: Flujos recibidos:", data);
      setFlujos(data || []);
    } catch (error: any) {
      console.error("FlujosTrabajoPage: Error al cargar flujos:", error);
      const errorMsg = error.response?.data?.detail || error.message || "Error al cargar flujos";
      swalError(errorMsg);
      setFlujos([]); // Asegurar que el estado se limpia en caso de error
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ nombre: "", descripcion: "", area_id: "", activo: true, es_predeterminado: false });
    setOpenModal(true);
  };

  const openEdit = (flujo: FlujoTrabajo) => {
    setEditing(flujo);
    setFormData({
      nombre: flujo.nombre || "",
      descripcion: flujo.descripcion || "",
      area_id: (flujo.area_id as any) || "",
      activo: !!flujo.activo,
      es_predeterminado: !!flujo.es_predeterminado,
    });
    setOpenModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value === "" ? null : value,
    }));
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...formData, area_id: formData.area_id || undefined } as any;
      if (editing) {
        await apiService.updateFlujo(editing.id, payload);
        await swalSuccess("Flujo actualizado");
      } else {
        await apiService.createFlujo(payload);
        await swalSuccess("Flujo creado");
      }
      setOpenModal(false);
      cargarFlujos();
    } catch (error: any) {
      swalError(error.response?.data?.detail || "Error al guardar");
    }
  };

  const handleEliminar = async (flujoId: string) => {
    const confirmed = await swalConfirmDelete("¿Está seguro de eliminar este flujo? Esta acción no se puede deshacer.");
    if (!confirmed) return;

    try {
      await apiService.deleteFlujo(flujoId);
      await swalSuccess("Flujo eliminado correctamente");
      cargarFlujos();
    } catch (error: any) {
      swalError(error.response?.data?.detail || "Error al eliminar flujo");
    }
  };

  if (userLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-50 py-4 sm:py-6">
      <div className="container-app w-full">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-fluid-2xl font-bold text-gray-900 sm:text-3xl">Flujos de Trabajo</h1>
          {canFlujoCreate && (
            <Button className="w-full sm:w-auto" onClick={openCreate} variant="primary">
              <FiPlus className="w-4 h-4 mr-1" />
              Nuevo Flujo
            </Button>
          )}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <CustomSelect
            label="Filtrar por Área"
            name="filterArea"
            value={filterArea || ""}
            onChange={(value) => {
              if (value === "null") {
                setFilterArea("null");
              } else if (value === "") {
                setFilterArea(null);
              } else {
                setFilterArea(value as string);
              }
            }}
            options={[
              { value: "", label: "Todos los flujos" },
              { value: "null", label: "Flujos generales (sin área)" },
              ...areas.filter(a => a.value !== "").map(a => ({ value: a.value, label: `Área: ${a.label}` }))
            ]}
            placeholder="Todos los flujos"
          />
        </div>

        {/* Lista de flujos */}
        {flujos.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No hay flujos de trabajo configurados</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {flujos.map((flujo) => (
              <div
                key={flujo.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
              >
                <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 sm:text-xl">{flujo.nombre}</h3>
                    {flujo.es_predeterminado && (
                      <span className="inline-block mt-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        Predeterminado
                      </span>
                    )}
                  </div>
                </div>

                {flujo.descripcion && (
                  <p className="text-gray-600 text-sm mb-4">{flujo.descripcion}</p>
                )}

                <div className="text-sm text-gray-500 mb-4">
                  <p>Área: {flujo.area_id ? `Área específica` : "General (todas las áreas)"}</p>
                  <p>Etapas: {flujo.etapas?.length || 0}</p>
                </div>

                <div className="flex gap-2">
                  {canFlujoUpdate && (
                    <Button variant="secondary" size="sm" onClick={() => openEdit(flujo)}>
                      Editar
                    </Button>
                  )}
                  {canVerDetalleFlujo && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => router.push(`/flujos-trabajo/${flujo.id}`)}
                    >
                      Gestionar Etapas
                    </Button>
                  )}
                  {canFlujoDelete && (
                    <Button variant="danger" size="sm" onClick={() => handleEliminar(flujo.id)}>
                      Eliminar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Crear/Editar */}
      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title={editing ? "Editar Flujo" : "Nuevo Flujo"}
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={submitForm} className="space-y-4">
          <Input
            label="Nombre del Flujo"
            name="nombre"
            value={(formData as any).nombre || ""}
            onChange={handleChange}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
            <textarea
              name="descripcion"
              value={(formData as any).descripcion || ""}
              onChange={handleChange}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <CustomSelect
            label="Área (opcional)"
            name="area_id"
            value={(formData as any).area_id || ""}
            onChange={(value) => {
              const fakeEvent = {
                target: { name: "area_id", value: value as string },
              } as React.ChangeEvent<HTMLSelectElement>;
              handleChange(fakeEvent);
            }}
            options={areas}
            placeholder="General (todas las áreas)"
          />
          <div className="flex gap-6">
            <Switch
              label="Activo"
              checked={!!(formData as any).activo}
              onChange={(checked) => setFormData((prev: any) => ({ ...prev, activo: checked }))}
            />
            <Switch
              label="Predeterminado"
              checked={!!(formData as any).es_predeterminado}
              onChange={(checked) => setFormData((prev: any) => ({ ...prev, es_predeterminado: checked }))}
            />
          </div>
          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setOpenModal(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={editing ? !canFlujoUpdate : !canFlujoCreate}
            >
              {editing ? "Guardar cambios" : "Crear flujo"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

