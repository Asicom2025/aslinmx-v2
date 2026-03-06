/**
 * Página de detalle de un flujo de trabajo
 * Muestra el flujo y permite gestionar sus etapas
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { swalSuccess, swalError, swalConfirmDelete } from "@/lib/swal";
import apiService from "@/lib/apiService";
import { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/ui/DataTable";
import type { FlujoCompleto, EtapaFlujo } from "@/types/flujosTrabajo";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Switch from "@/components/ui/Switch";
import CustomSelect, { SelectOption } from "@/components/ui/Select";
import { FiArrowLeft, FiPlus, FiFolder, FiFileText } from "react-icons/fi";

interface TipoDocumento {
  id: string;
  nombre: string;
  descripcion?: string;
  tipo: string;
  activo: boolean;
}

interface CategoriaDocumento {
  id: string;
  tipo_documento_id: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
}

interface PlantillaDocumento {
  id: string;
  tipo_documento_id: string;
  categoria_id?: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
}

export default function FlujoDetallePage() {
  const router = useRouter();
  const params = useParams();
  const flujoId = params.id as string;

  const [flujo, setFlujo] = useState<FlujoCompleto | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEtapaForm, setShowEtapaForm] = useState(false);
  const [etapaEditando, setEtapaEditando] = useState<EtapaFlujo | null>(null);
  
  // Tipos de documento y sus relaciones
  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([]);
  const [categorias, setCategorias] = useState<CategoriaDocumento[]>([]);
  const [plantillasDocumento, setPlantillasDocumento] = useState<PlantillaDocumento[]>([]);
  const [tipoDocumentoSeleccionado, setTipoDocumentoSeleccionado] = useState<string>("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("");
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<string>("");
  
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    orden: 1,
    es_obligatoria: true,
    permite_omision: false,
    inhabilita_siguiente: false,
    tipo_documento_principal_id: "",
    categoria_documento_id: "",
    plantilla_documento_id: "",
    activo: true,
  });

  useEffect(() => {
    cargarFlujo();
    cargarTiposDocumento();
  }, [flujoId]);

  // Cargar categorías cuando cambia el tipo de documento
  useEffect(() => {
    if (tipoDocumentoSeleccionado) {
      cargarCategorias(tipoDocumentoSeleccionado);
      cargarPlantillasDocumento(tipoDocumentoSeleccionado);
    } else {
      setCategorias([]);
      setPlantillasDocumento([]);
    }
  }, [tipoDocumentoSeleccionado]);

  // Filtrar plantillas cuando cambia la categoría
  useEffect(() => {
    if (tipoDocumentoSeleccionado) {
      cargarPlantillasDocumento(tipoDocumentoSeleccionado, categoriaSeleccionada || undefined);
    }
  }, [categoriaSeleccionada]);

  const cargarTiposDocumento = async () => {
    try {
      const data = await apiService.getPlantillas(true);
      setTiposDocumento(data);
    } catch (error) {
      console.error("Error al cargar tipos de documento:", error);
    }
  };

  const cargarCategorias = async (tipoDocumentoId: string) => {
    try {
      const data = await apiService.getCategoriasDocumento(tipoDocumentoId, true);
      setCategorias(data);
    } catch (error) {
      console.error("Error al cargar categorías:", error);
      setCategorias([]);
    }
  };

  const cargarPlantillasDocumento = async (tipoDocumentoId: string, categoriaId?: string) => {
    try {
      const data = await apiService.getPlantillasDocumento(tipoDocumentoId, categoriaId, true);
      setPlantillasDocumento(data);
    } catch (error) {
      console.error("Error al cargar plantillas:", error);
      setPlantillasDocumento([]);
    }
  };

  const cargarFlujo = async () => {
    try {
      setLoading(true);
      const data = await apiService.getFlujoById(flujoId);
      setFlujo(data);
    } catch (error: any) {
      swalError(error.response?.data?.detail || "Error al cargar flujo");
      router.push("/flujos-trabajo");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox"
        ? (e.target as HTMLInputElement).checked
        : type === "number"
        ? parseInt(value) || 0
        : value === ""
        ? null
        : value,
    });
  };

  const handleCrearEtapa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        tipo_documento_principal_id: formData.tipo_documento_principal_id || undefined,
        categoria_documento_id: formData.categoria_documento_id || undefined,
        plantilla_documento_id: formData.plantilla_documento_id || undefined,
      };
      if (etapaEditando) {
        await apiService.updateEtapa(etapaEditando.id, data);
        await swalSuccess("Etapa actualizada correctamente");
      } else {
        await apiService.createEtapa(flujoId, data);
        await swalSuccess("Etapa creada correctamente");
      }
      setShowEtapaForm(false);
      setEtapaEditando(null);
      resetForm();
      cargarFlujo();
    } catch (error: any) {
      swalError(error.response?.data?.detail || "Error al guardar etapa");
    }
  };

  const handleEditarEtapa = (etapa: EtapaFlujo) => {
    setEtapaEditando(etapa);
    setFormData({
      nombre: etapa.nombre,
      descripcion: etapa.descripcion || "",
      orden: etapa.orden,
      es_obligatoria: etapa.es_obligatoria,
      permite_omision: etapa.permite_omision,
      inhabilita_siguiente: etapa.inhabilita_siguiente,
      tipo_documento_principal_id: etapa.tipo_documento_principal_id || "",
      categoria_documento_id: etapa.categoria_documento_id || "",
      plantilla_documento_id: etapa.plantilla_documento_id || "",
      activo: etapa.activo,
    });
    // Si hay un tipo de documento principal, seleccionarlo
    if (etapa.tipo_documento_principal_id) {
      setTipoDocumentoSeleccionado(etapa.tipo_documento_principal_id);
    }
    // Si hay una categoría, seleccionarla
    if (etapa.categoria_documento_id) {
      setCategoriaSeleccionada(etapa.categoria_documento_id);
    }
    // Si hay una plantilla, seleccionarla
    if (etapa.plantilla_documento_id) {
      setPlantillaSeleccionada(etapa.plantilla_documento_id);
    }
    setShowEtapaForm(true);
  };

  const handleEliminarEtapa = async (etapaId: string) => {
    const confirmed = await swalConfirmDelete("¿Está seguro de eliminar esta etapa? Esta acción no se puede deshacer.");
    if (!confirmed) return;

    try {
      await apiService.deleteEtapa(etapaId);
      await swalSuccess("Etapa eliminada correctamente");
      cargarFlujo();
    } catch (error: any) {
      swalError(error.response?.data?.detail || "Error al eliminar etapa");
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: "",
      descripcion: "",
      orden: (flujo?.etapas?.length || 0) + 1,
      es_obligatoria: true,
      permite_omision: false,
      inhabilita_siguiente: false,
      tipo_documento_principal_id: "",
      categoria_documento_id: "",
      plantilla_documento_id: "",
      activo: true,
    });
    setTipoDocumentoSeleccionado("");
    setCategoriaSeleccionada("");
    setPlantillaSeleccionada("");
  };

  if (loading || !flujo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-50 p-6">
      <div className="w-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{flujo.nombre}</h1>
            {flujo.es_predeterminado && (
              <span className="inline-block mt-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                Predeterminado
              </span>
            )}
          </div>
          <Button variant="secondary" onClick={() => router.push("/flujos-trabajo")}>
            <FiArrowLeft className="w-4 h-4 mr-1" />
            Volver
          </Button>
        </div>

        {flujo.descripcion && (
          <p className="text-gray-600 mb-6">{flujo.descripcion}</p>
        )}

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Etapas del Flujo</h2>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                resetForm();
                setEtapaEditando(null);
                setShowEtapaForm(true);
              }}
            >
              <FiPlus className="w-4 h-4 mr-1" />
              Agregar Etapa
            </Button>
          </div>

          {flujo.etapas && flujo.etapas.length > 0 ? (
            <EtapasTable
              data={[...flujo.etapas].sort((a, b) => a.orden - b.orden)}
              onEdit={handleEditarEtapa}
              onDelete={handleEliminarEtapa}
            />
          ) : (
            <p className="text-gray-500 text-center py-8">No hay etapas configuradas. Agrega la primera etapa.</p>
          )}
        </div>
      </div>

      {/* Modal Crear/Editar Etapa */}
      <Modal 
        open={showEtapaForm} 
        onClose={() => setShowEtapaForm(false)} 
        title={etapaEditando ? "Editar Etapa" : "Nueva Etapa"}
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleCrearEtapa} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nombre de la Etapa" name="nombre" value={formData.nombre} onChange={handleChange} required />
            <Input label="Orden" name="orden" type="number" value={formData.orden.toString()} onChange={handleChange} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
            <textarea
              name="descripcion"
              value={formData.descripcion || ""}
              onChange={handleChange}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          
          {/* Sección de Tipo de Documento */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <FiFileText className="w-4 h-4" />
              Documento Principal de la Etapa
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Selecciona el tipo de documento, categoría o plantilla específica para esta etapa.
            </p>
            
            {/* Selector de Tipo de Documento */}
            <div className="space-y-3">
              <CustomSelect
                label="Tipo de Documento"
                name="tipo_documento"
                value={tipoDocumentoSeleccionado}
                onChange={(value) => {
                  const newValue = value as string;
                  setTipoDocumentoSeleccionado(newValue);
                  setCategoriaSeleccionada("");
                  setPlantillaSeleccionada("");
                  // Actualizar el formData
                  setFormData((prev) => ({ 
                    ...prev, 
                    tipo_documento_principal_id: newValue,
                    categoria_documento_id: "",
                    plantilla_documento_id: ""
                  }));
                }}
                options={[
                  { value: "", label: "Sin tipo de documento específico" },
                  ...tiposDocumento.map((tipo) => ({ 
                    value: tipo.id, 
                    label: `${tipo.nombre} (${tipo.tipo === "pdf" ? "PDF" : tipo.tipo === "editor" ? "Editor" : "Imagen"})` 
                  }))
                ]}
                placeholder="Selecciona un tipo de documento"
              />

              {/* Selector de Categoría si existen */}
              {tipoDocumentoSeleccionado && categorias.length > 0 && (
                <div className="ml-4 border-l-2 border-blue-200 pl-4">
                  <CustomSelect
                    label={
                      <span className="flex items-center gap-1">
                        <FiFolder className="w-3 h-3 text-blue-500" />
                        Categoría
                      </span>
                    }
                    name="categoria"
                    value={categoriaSeleccionada}
                    onChange={(value) => {
                      const newValue = value as string;
                      setCategoriaSeleccionada(newValue);
                      setPlantillaSeleccionada("");
                      // Actualizar el formData con la categoría
                      setFormData((prev) => ({ 
                        ...prev, 
                        categoria_documento_id: newValue,
                        plantilla_documento_id: ""
                      }));
                    }}
                    options={[
                      { value: "", label: "Cualquier categoría" },
                      ...categorias.map((cat) => ({ value: cat.id, label: cat.nombre }))
                    ]}
                    placeholder="Seleccionar categoría"
                  />
                </div>
              )}

              {/* Selector de Plantilla Específica */}
              {tipoDocumentoSeleccionado && plantillasDocumento.length > 0 && (
                <div className="ml-4 border-l-2 border-green-200 pl-4">
                  <CustomSelect
                    label={
                      <span className="flex items-center gap-1">
                        <FiFileText className="w-3 h-3 text-green-500" />
                        Plantilla Específica
                      </span>
                    }
                    name="plantilla"
                    value={plantillaSeleccionada}
                    onChange={(value) => {
                      const newValue = value as string;
                      setPlantillaSeleccionada(newValue);
                      // Actualizar el formData con la plantilla
                      setFormData((prev) => ({ 
                        ...prev, 
                        plantilla_documento_id: newValue
                      }));
                    }}
                    options={[
                      { value: "", label: "Cualquier plantilla de este tipo" },
                      ...plantillasDocumento.map((p) => ({ value: p.id, label: p.nombre }))
                    ]}
                    placeholder="Seleccionar plantilla específica"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Si seleccionas una plantilla específica, solo esa plantilla estará disponible para esta etapa.
                  </p>
                </div>
              )}

              {tipoDocumentoSeleccionado && categorias.length === 0 && plantillasDocumento.length === 0 && (
                <p className="ml-4 text-xs text-amber-600 italic">
                  Este tipo de documento no tiene categorías ni plantillas configuradas.
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-6 flex-wrap">
            <Switch
              label="Obligatoria"
              checked={!!formData.es_obligatoria}
              onChange={(checked) => setFormData((prev) => ({ ...prev, es_obligatoria: checked }))}
            />
            <Switch
              label="Permite omisión"
              checked={!!formData.permite_omision}
              onChange={(checked) => setFormData((prev) => ({ ...prev, permite_omision: checked }))}
            />
            <Switch
              label="Bloquea siguiente"
              checked={!!formData.inhabilita_siguiente}
              onChange={(checked) => setFormData((prev) => ({ ...prev, inhabilita_siguiente: checked }))}
            />
            <Switch
              label="Activa"
              checked={!!formData.activo}
              onChange={(checked) => setFormData((prev) => ({ ...prev, activo: checked }))}
            />
          </div>
          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setShowEtapaForm(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              {etapaEditando ? "Guardar cambios" : "Crear etapa"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function EtapasTable({ data, onEdit, onDelete }: { data: EtapaFlujo[]; onEdit: (row: EtapaFlujo) => void; onDelete: (id: string) => void }) {
  const columns: ColumnDef<EtapaFlujo>[] = [
    { 
      header: "Orden", 
      accessorKey: "orden", 
      cell: (info) => (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-semibold text-sm">
          {info.getValue() as number}
        </span>
      ) 
    },
    { 
      header: "Nombre", 
      accessorKey: "nombre", 
      cell: (info) => (
        <div>
          <span className="text-sm font-medium text-gray-900">{info.getValue() as string}</span>
          {info.row.original.descripcion && (
            <p className="text-xs text-gray-500 mt-1">{info.row.original.descripcion}</p>
          )}
        </div>
      ) 
    },
    {
      header: "Documento Requerido",
      id: "documento",
      cell: ({ row }) => {
        const etapa = row.original;
        const tieneDoc = etapa.tipo_documento_principal || etapa.tipo_documento_principal_id;
        const tieneCat = etapa.categoria_documento || etapa.categoria_documento_id;
        const tienePlantilla = etapa.plantilla_documento || etapa.plantilla_documento_id;
        
        if (!tieneDoc && !tieneCat && !tienePlantilla) {
          return <span className="text-gray-400 italic text-sm">Sin documento</span>;
        }
        
        return (
          <div className="flex flex-col gap-1 text-xs">
            {etapa.tipo_documento_principal?.nombre && (
              <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded w-fit flex items-center gap-1">
                📁 {etapa.tipo_documento_principal.nombre}
              </span>
            )}
            {etapa.categoria_documento?.nombre && (
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded w-fit flex items-center gap-1">
                📂 {etapa.categoria_documento.nombre}
              </span>
            )}
            {etapa.plantilla_documento?.nombre && (
              <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded w-fit flex items-center gap-1">
                📄 {etapa.plantilla_documento.nombre}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: "Estado",
      id: "estado",
      cell: ({ row }) => (
        <div className="flex flex-col gap-1 text-xs">
          {row.original.activo ? (
            <span className="bg-green-100 text-green-600 px-2 py-1 rounded w-fit">Activa</span>
          ) : (
            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded w-fit">Inactiva</span>
          )}
          {row.original.es_obligatoria && (
            <span className="bg-red-100 text-red-600 px-2 py-1 rounded w-fit">Obligatoria</span>
          )}
          {row.original.inhabilita_siguiente && (
            <span className="bg-yellow-100 text-yellow-600 px-2 py-1 rounded w-fit">Bloquea siguiente</span>
          )}
        </div>
      ),
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={() => onEdit(row.original)}>Editar</Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(row.original.id)}>Eliminar</Button>
        </div>
      ),
    },
  ];
  return <DataTable columns={columns} data={data} emptyText="Sin etapas" />;
}

