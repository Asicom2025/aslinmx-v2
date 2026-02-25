"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import DataTable from "@/components/ui/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import apiService from "@/lib/apiService";
import { swalSuccess, swalError, swalConfirmDelete } from "@/lib/swal";
import PlantillasCategoriaModal from "./PlantillasCategoriaModal";
import { FiFileText } from "react-icons/fi";

interface CategoriasModalProps {
  open: boolean;
  onClose: () => void;
  tipoDocumento: {
    id: string;
    nombre: string;
  };
}

export default function CategoriasModal({ open, onClose, tipoDocumento }: CategoriasModalProps) {
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    activo: true,
  });
  const [plantillasModalOpen, setPlantillasModalOpen] = useState(false);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<any | null>(null);

  useEffect(() => {
    if (open) {
      loadCategorias();
    }
  }, [open, tipoDocumento.id]);

  const loadCategorias = async () => {
    try {
      setLoading(true);
      const data = await apiService.getCategoriasDocumento(tipoDocumento.id, true);
      setCategorias(data);
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al cargar categorías");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ nombre: "", descripcion: "", activo: true });
    setModalOpen(true);
  };

  const openEdit = (categoria: any) => {
    setEditing(categoria);
    setForm({
      nombre: categoria.nombre || "",
      descripcion: categoria.descripcion || "",
      activo: !!categoria.activo,
    });
    setModalOpen(true);
  };

  const changeForm = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await apiService.updateCategoriaDocumento(editing.id, form);
        await swalSuccess("Categoría actualizada");
      } else {
        await apiService.createCategoriaDocumento({
          ...form,
          tipo_documento_id: tipoDocumento.id,
        });
        await swalSuccess("Categoría creada");
      }
      setModalOpen(false);
      loadCategorias();
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al guardar categoría");
    }
  };

  const deleteCategoria = async (id: string) => {
    const confirmed = await swalConfirmDelete("¿Eliminar categoría? Esta acción no se puede deshacer.");
    if (!confirmed) return;
    try {
      await apiService.deleteCategoriaDocumento(id);
      await swalSuccess("Categoría eliminada");
      loadCategorias();
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al eliminar categoría");
    }
  };

  const openPlantillas = (categoria: any) => {
    setCategoriaSeleccionada(categoria);
    setPlantillasModalOpen(true);
  };

  const columns: ColumnDef<any>[] = [
    {
      header: "Nombre",
      accessorKey: "nombre",
      cell: (info) => <span className="text-sm text-gray-900">{info.getValue() as string}</span>,
    },
    {
      header: "Descripción",
      accessorKey: "descripcion",
      cell: (info) => {
        const descripcion = (info.getValue() as string) || "-";
        return (
          <span className="text-sm text-gray-600" title={descripcion !== "-" ? descripcion : undefined}>
            {descripcion.length > 50 ? descripcion.substring(0, 50) + "..." : descripcion}
          </span>
        );
      },
    },
    {
      header: "Activo",
      accessorKey: "activo",
      cell: (info) => <span className="text-sm text-gray-600">{info.getValue() ? "Sí" : "No"}</span>,
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={() => openPlantillas(row.original)}
            title="Ver plantillas de esta categoría"
          >
            <FiFileText className="w-4 h-4 mr-1" />
            Plantillas
          </Button>
          <Button variant="secondary" size="sm" onClick={() => openEdit(row.original)}>
            Editar
          </Button>
          <Button variant="danger" size="sm" onClick={() => deleteCategoria(row.original.id)}>
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={`Categorías - ${tipoDocumento.nombre}`}
        maxWidthClass="max-w-6xl"
        maxHeightClass="max-h-[95vh]"
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Gestiona las categorías del tipo de documento "{tipoDocumento.nombre}"
            </p>
            <Button variant="primary" onClick={openCreate}>
              Nueva categoría
            </Button>
          </div>

          {loading ? (
            <p className="text-gray-500">Cargando categorías...</p>
          ) : (
            <DataTable
              columns={columns}
              data={categorias}
              emptyText="No hay categorías registradas. Crea una para organizar tus plantillas."
            />
          )}
        </div>
      </Modal>

      {/* Modal para crear/editar categoría */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar categoría" : "Nueva categoría"}
      >
        <form onSubmit={submit} className="space-y-4">
          <Input
            label="Nombre"
            name="nombre"
            value={form.nombre}
            onChange={changeForm}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
            <textarea
              name="descripcion"
              value={form.descripcion || ""}
              onChange={changeForm}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              {editing ? "Guardar" : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de plantillas de la categoría */}
      {categoriaSeleccionada && (
        <PlantillasCategoriaModal
          open={plantillasModalOpen}
          onClose={() => {
            setPlantillasModalOpen(false);
            setCategoriaSeleccionada(null);
          }}
          categoria={categoriaSeleccionada}
          tipoDocumento={tipoDocumento}
          onSuccess={loadCategorias}
        />
      )}
    </>
  );
}


