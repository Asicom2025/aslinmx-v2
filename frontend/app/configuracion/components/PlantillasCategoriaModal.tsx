"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import DataTable from "@/components/ui/DataTable";
import JoditEditor from "@/components/ui/JoditEditor";
import PDFPreviewModal from "./PDFPreviewModal";
import { ColumnDef } from "@tanstack/react-table";
import apiService from "@/lib/apiService";
import { swalSuccess, swalError, swalConfirmDelete } from "@/lib/swal";
import { FiEye } from "react-icons/fi";

interface PlantillasCategoriaModalProps {
  open: boolean;
  onClose: () => void;
  categoria: {
    id: string;
    nombre: string;
  };
  tipoDocumento: {
    id: string;
    nombre: string;
  };
  onSuccess?: () => void;
}

export default function PlantillasCategoriaModal({
  open,
  onClose,
  categoria,
  tipoDocumento,
  onSuccess,
}: PlantillasCategoriaModalProps) {
  const [plantillas, setPlantillas] = useState<any[]>([]);
  const [headersDisponibles, setHeadersDisponibles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewPlantilla, setPreviewPlantilla] = useState<any | null>(null);
  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    contenido: "",
    formato: "",
    logo_url: "",
    header_plantilla_id: "",
    plantilla_continuacion_id: "",
    activo: true,
  });
  const [logoPreview, setLogoPreview] = useState<string>("");

  useEffect(() => {
    if (open) {
      loadPlantillas();
      loadHeadersDisponibles();
    }
  }, [open, categoria.id]);

  const loadPlantillas = async () => {
    try {
      setLoading(true);
      const data = await apiService.getPlantillasDocumento(tipoDocumento.id, categoria.id, true);
      setPlantillas(data);
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al cargar plantillas");
    } finally {
      setLoading(false);
    }
  };

  const loadHeadersDisponibles = async () => {
    try {
      // Cargar todas las plantillas activas que pueden servir como headers
      const data = await apiService.getPlantillasDocumento(undefined, undefined, true);
      setHeadersDisponibles(data);
    } catch (e: any) {
      console.error("Error al cargar headers disponibles:", e);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ nombre: "", descripcion: "", contenido: "", formato: "", logo_url: "", header_plantilla_id: "", plantilla_continuacion_id: "", activo: true });
    setLogoPreview("");
    setModalOpen(true);
  };

  const openEdit = (plantilla: any) => {
    setEditing(plantilla);
    setForm({
      nombre: plantilla.nombre || "",
      descripcion: plantilla.descripcion || "",
      contenido: plantilla.contenido || "",
      formato: plantilla.formato || "",
      logo_url: plantilla.logo_url || "",
      header_plantilla_id: plantilla.header_plantilla_id || "",
      plantilla_continuacion_id: plantilla.plantilla_continuacion_id || "",
      activo: !!plantilla.activo,
    });
    setLogoPreview(plantilla.logo_url || "");
    setModalOpen(true);
  };

  const changeForm = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleLogoUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    changeForm(e);
    setLogoPreview(e.target.value || "");
  };

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      swalError("Selecciona un archivo de imagen válido (PNG, JPG, SVG, etc.)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        setForm((prev) => ({ ...prev, logo_url: result }));
        setLogoPreview(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setForm((prev) => ({ ...prev, logo_url: "" }));
    setLogoPreview("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        header_plantilla_id: form.header_plantilla_id || null,
        plantilla_continuacion_id: form.plantilla_continuacion_id || null,
      };
      if (editing) {
        await apiService.updatePlantillaDocumento(editing.id, payload);
        await swalSuccess("Plantilla actualizada");
      } else {
        await apiService.createPlantillaDocumento({
          ...payload,
          tipo_documento_id: tipoDocumento.id,
          categoria_id: categoria.id,
        });
        await swalSuccess("Plantilla creada");
      }
      setModalOpen(false);
      loadPlantillas();
      if (onSuccess) onSuccess();
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al guardar plantilla");
    }
  };

  const deletePlantilla = async (id: string) => {
    const confirmed = await swalConfirmDelete("¿Eliminar plantilla? Esta acción no se puede deshacer.");
    if (!confirmed) return;
    try {
      await apiService.deletePlantillaDocumento(id);
      await swalSuccess("Plantilla eliminada");
      loadPlantillas();
      if (onSuccess) onSuccess();
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al eliminar plantilla");
    }
  };

  const openPreview = (plantilla: any) => {
    setPreviewPlantilla(plantilla);
    setPreviewModalOpen(true);
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
      header: "Formato",
      accessorKey: "formato",
      cell: (info) => <span className="text-sm text-gray-600">{(info.getValue() as string) || "-"}</span>,
    },
    {
      header: "Activo",
      accessorKey: "activo",
      cell: (info) => <span className="text-sm text-gray-600">{info.getValue() ? "Sí" : "No"}</span>,
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => {
        const plantilla = row.original;
        const canPreview = plantilla.contenido && plantilla.contenido.trim() !== "";

        return (
          <div className="flex gap-2 justify-end">
            {canPreview && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openPreview(plantilla)}
                title="Previsualizar PDF"
              >
                <FiEye className="w-4 h-4 mr-1" />
                Vista Previa
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => openEdit(plantilla)}>
              Editar
            </Button>
            <Button variant="danger" size="sm" onClick={() => deletePlantilla(plantilla.id)}>
              Eliminar
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={`Plantillas - ${tipoDocumento.nombre} - ${categoria.nombre}`}
        maxWidthClass="max-w-6xl"
        maxHeightClass="max-h-[95vh]"
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Gestiona las plantillas de la categoría "{categoria.nombre}"
            </p>
            <Button variant="primary" onClick={openCreate}>
              Nueva plantilla
            </Button>
          </div>

          {loading ? (
            <p className="text-gray-500">Cargando plantillas...</p>
          ) : (
            <DataTable
              columns={columns}
              data={plantillas}
              emptyText="No hay plantillas registradas. Crea una para comenzar."
            />
          )}
        </div>
      </Modal>

      {/* Modal para crear/editar plantilla */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar plantilla" : "Nueva plantilla"}
        maxWidthClass="max-w-4xl"
        maxHeightClass="max-h-[95vh]"
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
          <Input
            label="Formato (opcional)"
            name="formato"
            value={form.formato}
            onChange={changeForm}
            placeholder="Ej: A4, oficio"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Header (opcional)
            </label>
            <select
              name="header_plantilla_id"
              value={form.header_plantilla_id}
              onChange={(e) => setForm({ ...form, header_plantilla_id: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
            >
              <option value="">Sin header</option>
              {headersDisponibles
                .filter((h) => h.id !== editing?.id) // No mostrar la plantilla actual como opción
                .map((header) => (
                  <option key={header.id} value={header.id}>
                    {header.nombre}
                  </option>
                ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              El header se incluirá al inicio del documento al generar el PDF.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Segunda sección / continuación (opcional)
            </label>
            <select
              name="plantilla_continuacion_id"
              value={form.plantilla_continuacion_id}
              onChange={(e) => setForm({ ...form, plantilla_continuacion_id: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
            >
              <option value="">Sin segunda sección</option>
              {headersDisponibles
                .filter((h) => h.id !== editing?.id && h.id !== form.header_plantilla_id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Se generará un solo PDF: esta plantilla (con su header) + salto de página + la plantilla seleccionada (con su propio header).
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contenido de la plantilla (HTML)
            </label>
            <JoditEditor
              value={form.contenido}
              onChange={(content) => setForm({ ...form, contenido: content })}
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

      {/* Modal de previsualización de PDF */}
      {previewPlantilla && (
        <Modal
          open={previewModalOpen}
          onClose={() => {
            setPreviewModalOpen(false);
            setPreviewPlantilla(null);
          }}
          title={`Previsualizar PDF - ${previewPlantilla?.nombre || ""}`}
          maxWidthClass="max-w-6xl"
          maxHeightClass="max-h-[95vh]"
        >
          <PDFPreviewModal
            plantillaId={previewPlantilla.id}
            plantillaNombre={previewPlantilla.nombre}
            onClose={() => {
              setPreviewModalOpen(false);
              setPreviewPlantilla(null);
            }}
          />
        </Modal>
      )}
    </>
  );
}


