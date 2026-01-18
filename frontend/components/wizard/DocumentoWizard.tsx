"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import TiptapEditor from "@/components/ui/TiptapEditor";
import apiService from "@/lib/apiService";
import { swalError, swalSuccess } from "@/lib/swal";

interface DocumentoWizardProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type WizardStep = 1 | 2 | 3;

export default function DocumentoWizard({ open, onClose, onSuccess }: DocumentoWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(false);
  
  // Paso 1: Tipo de documento
  const [tiposDocumento, setTiposDocumento] = useState<any[]>([]);
  const [tipoDocumentoSeleccionado, setTipoDocumentoSeleccionado] = useState<string>("");
  const [crearNuevoTipo, setCrearNuevoTipo] = useState(false);
  const [nuevoTipoForm, setNuevoTipoForm] = useState({
    nombre: "",
    descripcion: "",
    formato: "",
    tipo: "editor" as "pdf" | "editor" | "imagen",
    activo: true,
  });

  // Paso 2: Categoría (opcional)
  const [categorias, setCategorias] = useState<any[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("");
  const [crearNuevaCategoria, setCrearNuevaCategoria] = useState(false);
  const [saltarCategoria, setSaltarCategoria] = useState(false);
  const [nuevaCategoriaForm, setNuevaCategoriaForm] = useState({
    nombre: "",
    descripcion: "",
    activo: true,
  });

  // Paso 3: Plantilla
  const [plantillaForm, setPlantillaForm] = useState({
    nombre: "",
    descripcion: "",
    contenido: "",
    formato: "",
    activo: true,
  });

  // Cargar tipos de documento
  useEffect(() => {
    if (open && step === 1) {
      loadTiposDocumento();
    }
  }, [open, step]);

  // Cargar categorías cuando se selecciona un tipo de documento
  useEffect(() => {
    if (tipoDocumentoSeleccionado && step === 2 && !saltarCategoria) {
      loadCategorias();
    }
  }, [tipoDocumentoSeleccionado, step, saltarCategoria]);

  const loadTiposDocumento = async () => {
    try {
      const data = await apiService.getPlantillas(true);
      setTiposDocumento(data);
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al cargar tipos de documento");
    }
  };

  const loadCategorias = async () => {
    if (!tipoDocumentoSeleccionado) return;
    try {
      const data = await apiService.getCategoriasDocumento(tipoDocumentoSeleccionado, true);
      setCategorias(data);
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al cargar categorías");
    }
  };

  const handleNext = async () => {
    if (step === 1) {
      // Validar tipo de documento
      if (crearNuevoTipo) {
        if (!nuevoTipoForm.nombre.trim()) {
          swalError("El nombre del tipo de documento es requerido");
          return;
        }
        try {
          setLoading(true);
          const nuevoTipo = await apiService.createPlantilla(nuevoTipoForm);
          setTipoDocumentoSeleccionado(nuevoTipo.id);
          setTiposDocumento([...tiposDocumento, nuevoTipo]);
          setCrearNuevoTipo(false);
        } catch (e: any) {
          swalError(e.response?.data?.detail || "Error al crear tipo de documento");
          return;
        } finally {
          setLoading(false);
        }
      } else {
        if (!tipoDocumentoSeleccionado) {
          swalError("Debes seleccionar o crear un tipo de documento");
          return;
        }
      }
      setStep(2);
    } else if (step === 2) {
      // Si se crea nueva categoría, crearla primero
      if (crearNuevaCategoria && !saltarCategoria) {
        if (!nuevaCategoriaForm.nombre.trim()) {
          swalError("El nombre de la categoría es requerido");
          return;
        }
        try {
          setLoading(true);
          const nuevaCategoria = await apiService.createCategoriaDocumento({
            ...nuevaCategoriaForm,
            tipo_documento_id: tipoDocumentoSeleccionado,
          });
          setCategoriaSeleccionada(nuevaCategoria.id);
          setCategorias([...categorias, nuevaCategoria]);
          setCrearNuevaCategoria(false);
        } catch (e: any) {
          swalError(e.response?.data?.detail || "Error al crear categoría");
          return;
        } finally {
          setLoading(false);
        }
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as WizardStep);
    }
  };

  const handleFinish = async () => {
    if (!plantillaForm.nombre.trim()) {
      swalError("El nombre de la plantilla es requerido");
      return;
    }

    try {
      setLoading(true);
      await apiService.createPlantillaDocumento({
        ...plantillaForm,
        tipo_documento_id: tipoDocumentoSeleccionado,
        categoria_id: saltarCategoria ? null : categoriaSeleccionada || null,
      });
      await swalSuccess("Plantilla creada exitosamente");
      handleClose();
      if (onSuccess) onSuccess();
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al crear plantilla");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setTipoDocumentoSeleccionado("");
    setCrearNuevoTipo(false);
    setCategoriaSeleccionada("");
    setCrearNuevaCategoria(false);
    setSaltarCategoria(false);
    setNuevoTipoForm({ nombre: "", descripcion: "", formato: "", tipo: "editor", activo: true });
    setNuevaCategoriaForm({ nombre: "", descripcion: "", activo: true });
    setPlantillaForm({ nombre: "", descripcion: "", contenido: "", formato: "", activo: true });
    onClose();
  };

  const getTipoDocumentoNombre = () => {
    if (crearNuevoTipo) return nuevoTipoForm.nombre;
    const tipo = tiposDocumento.find((t) => t.id === tipoDocumentoSeleccionado);
    return tipo?.nombre || "";
  };

  const getCategoriaNombre = () => {
    if (saltarCategoria) return null;
    if (crearNuevaCategoria) return nuevaCategoriaForm.nombre;
    const categoria = categorias.find((c) => c.id === categoriaSeleccionada);
    return categoria?.nombre || null;
  };

  const getRutaCompleta = () => {
    const tipoNombre = getTipoDocumentoNombre();
    const categoriaNombre = getCategoriaNombre();
    const plantillaNombre = plantillaForm.nombre;

    if (categoriaNombre) {
      return `${tipoNombre} - ${categoriaNombre} - ${plantillaNombre}`;
    }
    return `${tipoNombre} - ${plantillaNombre}`;
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Asistente de creación de plantillas"
      maxWidthClass="max-w-4xl"
      maxHeightClass="max-h-[95vh]"
    >
      <div className="space-y-6">
        {/* Indicador de pasos */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2 flex-1">
            <div className={`flex items-center ${step >= 1 ? "text-primary-600" : "text-gray-400"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? "bg-primary-600 text-white" : "bg-gray-200"}`}>
                1
              </div>
              <span className="ml-2 text-sm font-medium">Tipo de documento</span>
            </div>
            <div className={`flex-1 h-1 ${step >= 2 ? "bg-primary-600" : "bg-gray-200"}`}></div>
            <div className={`flex items-center ${step >= 2 ? "text-primary-600" : "text-gray-400"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? "bg-primary-600 text-white" : "bg-gray-200"}`}>
                2
              </div>
              <span className="ml-2 text-sm font-medium">Categoría (opcional)</span>
            </div>
            <div className={`flex-1 h-1 ${step >= 3 ? "bg-primary-600" : "bg-gray-200"}`}></div>
            <div className={`flex items-center ${step >= 3 ? "text-primary-600" : "text-gray-400"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? "bg-primary-600 text-white" : "bg-gray-200"}`}>
                3
              </div>
              <span className="ml-2 text-sm font-medium">Plantilla</span>
            </div>
          </div>
        </div>

        {/* Vista previa de ruta completa */}
        {step === 3 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900 mb-1">Ruta completa:</p>
            <p className="text-sm text-blue-700">{getRutaCompleta()}</p>
          </div>
        )}

        {/* Paso 1: Tipo de documento */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={!crearNuevoTipo}
                  onChange={() => setCrearNuevoTipo(false)}
                  className="mr-2"
                />
                Seleccionar tipo existente
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={crearNuevoTipo}
                  onChange={() => setCrearNuevoTipo(true)}
                  className="mr-2"
                />
                Crear nuevo tipo
              </label>
            </div>

            {!crearNuevoTipo ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de documento
                </label>
                <select
                  value={tipoDocumentoSeleccionado}
                  onChange={(e) => setTipoDocumentoSeleccionado(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Selecciona un tipo...</option>
                  {tiposDocumento.map((tipo) => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.nombre}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  label="Nombre del tipo de documento"
                  name="nombre"
                  value={nuevoTipoForm.nombre}
                  onChange={(e) =>
                    setNuevoTipoForm({ ...nuevoTipoForm, nombre: e.target.value })
                  }
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descripción
                  </label>
                  <textarea
                    value={nuevoTipoForm.descripcion}
                    onChange={(e) =>
                      setNuevoTipoForm({ ...nuevoTipoForm, descripcion: e.target.value })
                    }
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo
                    </label>
                    <select
                      value={nuevoTipoForm.tipo}
                      onChange={(e) =>
                        setNuevoTipoForm({
                          ...nuevoTipoForm,
                          tipo: e.target.value as "pdf" | "editor" | "imagen",
                        })
                      }
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="editor">Editor</option>
                      <option value="pdf">PDF</option>
                      <option value="imagen">Imagen</option>
                    </select>
                  </div>
                  <Input
                    label="Formato (opcional)"
                    name="formato"
                    value={nuevoTipoForm.formato}
                    onChange={(e) =>
                      setNuevoTipoForm({ ...nuevoTipoForm, formato: e.target.value })
                    }
                    placeholder="Ej: A4, oficio"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Paso 2: Categoría (opcional) */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={!saltarCategoria && !crearNuevaCategoria}
                  onChange={() => {
                    setSaltarCategoria(false);
                    setCrearNuevaCategoria(false);
                  }}
                  className="mr-2"
                />
                Seleccionar categoría existente
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={crearNuevaCategoria}
                  onChange={() => {
                    setCrearNuevaCategoria(true);
                    setSaltarCategoria(false);
                  }}
                  className="mr-2"
                />
                Crear nueva categoría
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={saltarCategoria}
                  onChange={() => {
                    setSaltarCategoria(true);
                    setCrearNuevaCategoria(false);
                  }}
                  className="mr-2"
                />
                Saltar categoría
              </label>
            </div>

            {!saltarCategoria && !crearNuevaCategoria && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoría
                </label>
                <select
                  value={categoriaSeleccionada}
                  onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Selecciona una categoría...</option>
                  {categorias.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {crearNuevaCategoria && (
              <div className="space-y-4">
                <Input
                  label="Nombre de la categoría"
                  name="nombre"
                  value={nuevaCategoriaForm.nombre}
                  onChange={(e) =>
                    setNuevaCategoriaForm({ ...nuevaCategoriaForm, nombre: e.target.value })
                  }
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descripción
                  </label>
                  <textarea
                    value={nuevaCategoriaForm.descripcion}
                    onChange={(e) =>
                      setNuevaCategoriaForm({
                        ...nuevaCategoriaForm,
                        descripcion: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>
            )}

            {saltarCategoria && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  Se creará la plantilla directamente bajo el tipo de documento sin categoría.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Paso 3: Plantilla */}
        {step === 3 && (
          <div className="space-y-4">
            <Input
              label="Nombre de la plantilla"
              name="nombre"
              value={plantillaForm.nombre}
              onChange={(e) =>
                setPlantillaForm({ ...plantillaForm, nombre: e.target.value })
              }
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción
              </label>
              <textarea
                value={plantillaForm.descripcion}
                onChange={(e) =>
                  setPlantillaForm({ ...plantillaForm, descripcion: e.target.value })
                }
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <Input
              label="Formato (opcional)"
              name="formato"
              value={plantillaForm.formato}
              onChange={(e) =>
                setPlantillaForm({ ...plantillaForm, formato: e.target.value })
              }
              placeholder="Ej: A4, oficio"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contenido de la plantilla (HTML)
              </label>
              <TiptapEditor
                content={plantillaForm.contenido}
                onChange={(content) =>
                  setPlantillaForm({ ...plantillaForm, contenido: content })
                }
              />
            </div>
          </div>
        )}

        {/* Botones de navegación */}
        <div className="flex justify-between pt-4 border-t">
          <div>
            {step > 1 && (
              <Button variant="secondary" onClick={handleBack} disabled={loading}>
                Anterior
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            {step < 3 ? (
              <Button variant="primary" onClick={handleNext} disabled={loading}>
                Siguiente
              </Button>
            ) : (
              <Button variant="primary" onClick={handleFinish} disabled={loading}>
                {loading ? "Creando..." : "Crear plantilla"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

