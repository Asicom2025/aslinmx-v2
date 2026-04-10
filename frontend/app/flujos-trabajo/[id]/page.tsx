/**
 * Página de detalle de un flujo de trabajo
 * Muestra el flujo y permite gestionar sus etapas.
 * Cada etapa puede tener MÚLTIPLES categorías y plantillas asociadas
 * (EtapaFlujoRequisitoDocumento), gestionadas desde el mismo formulario de etapa.
 */

"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { swalSuccess, swalError, swalConfirmDelete } from "@/lib/swal";
import apiService from "@/lib/apiService";
import { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/ui/DataTable";
import type { FlujoCompleto, EtapaFlujo, RequisitoDocumento } from "@/types/flujosTrabajo";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Switch from "@/components/ui/Switch";
import CustomSelect from "@/components/ui/Select";
import { FiArrowLeft, FiPlus, FiFolder, FiFileText } from "react-icons/fi";

interface TipoDocumento {
  id: string;
  nombre: string;
  tipo: string;
  activo: boolean;
}

interface CategoriaDocumento {
  id: string;
  tipo_documento_id: string;
  nombre: string;
  activo: boolean;
}

interface PlantillaDocumento {
  id: string;
  tipo_documento_id: string;
  categoria_id?: string;
  nombre: string;
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

  // ── Catálogos para la cascada del formulario de etapa ──────
  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([]);
  const [categorias, setCategorias] = useState<CategoriaDocumento[]>([]);
  const [plantillasDocumento, setPlantillasDocumento] = useState<PlantillaDocumento[]>([]);

  // Tipo: sigue siendo single-select (define el "tipo principal" de la etapa)
  const [tipoDocumentoSeleccionado, setTipoDocumentoSeleccionado] = useState<string>("");

  // Categorías y plantillas: ahora MULTI-SELECT → cada una genera un requisito
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<string[]>([]);
  const [plantillasSeleccionadas, setPlantillasSeleccionadas] = useState<string[]>([]);
  const prevTipoDocIdRef = useRef<string>("");

  // Datos del formulario de etapa
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    orden: 1,
    es_obligatoria: true,
    permite_omision: false,
    inhabilita_siguiente: false,
    tipo_documento_principal_id: "",
    activo: true,
  });

  // ── Efectos de cascada ─────────────────────────────────────
  useEffect(() => {
    cargarFlujo();
    cargarTiposDocumento();
  }, [flujoId]);

  // Según el tipo de plantilla del tipo de documento: PDF/imagen → solo categorías; editor → solo plantillas
  useEffect(() => {
    if (!tipoDocumentoSeleccionado) {
      prevTipoDocIdRef.current = "";
      setCategorias([]);
      setPlantillasDocumento([]);
      setCategoriasSeleccionadas([]);
      setPlantillasSeleccionadas([]);
      return;
    }
    if (tiposDocumento.length === 0) {
      if (tipoDocumentoSeleccionado) prevTipoDocIdRef.current = tipoDocumentoSeleccionado;
      return;
    }

    const info = tiposDocumento.find((t) => t.id === tipoDocumentoSeleccionado);
    const t = (info?.tipo ?? "").toLowerCase();
    const tipoCambio = prevTipoDocIdRef.current !== tipoDocumentoSeleccionado;
    prevTipoDocIdRef.current = tipoDocumentoSeleccionado;
    if (tipoCambio) {
      setCategoriasSeleccionadas([]);
      setPlantillasSeleccionadas([]);
    }
    if (t === "editor") {
      setCategorias([]);
      cargarPlantillasDocumento(tipoDocumentoSeleccionado);
    } else {
      setPlantillasDocumento([]);
      cargarCategorias(tipoDocumentoSeleccionado);
    }
  }, [tipoDocumentoSeleccionado, tiposDocumento]);

  // ── Cargadores ─────────────────────────────────────────────
  const cargarTiposDocumento = async () => {
    try {
      const data = await apiService.getPlantillas(true);
      setTiposDocumento(data ?? []);
    } catch {
      console.error("Error al cargar tipos de documento");
    }
  };

  const cargarCategorias = async (tipoId: string) => {
    try {
      const data = await apiService.getCategoriasDocumento(tipoId, true);
      setCategorias(data ?? []);
    } catch {
      setCategorias([]);
    }
  };

  const cargarPlantillasDocumento = async (tipoId: string) => {
    try {
      const data = await apiService.getPlantillasDocumento(tipoId, undefined, true);
      setPlantillasDocumento(data ?? []);
    } catch {
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

  // ── Sincronizar requisitos documentales al guardar etapa ───
  /**
   * Para cada categoría/plantilla seleccionada, crea un EtapaFlujoRequisitoDocumento
   * si no existe ya (idempotente). Elimina los que ya no están en la selección.
   */
  const sincronizarRequisitos = async (etapaId: string) => {
    const tipoInfo = tiposDocumento.find((t) => t.id === tipoDocumentoSeleccionado);
    const tNorm = (tipoInfo?.tipo ?? "").toLowerCase();
    const esEditor = tNorm === "editor";

    const existentes: RequisitoDocumento[] = await apiService.getRequisitosEtapa(
      flujoId,
      etapaId,
      false
    );

    // ── Eliminar los que ya no están seleccionados ──────────
    for (const req of existentes) {
      const esCat = !!req.categoria_documento_id && !req.plantilla_documento_id;
      const esPlant = !!req.plantilla_documento_id;

      if (esCat && !categoriasSeleccionadas.includes(req.categoria_documento_id!)) {
        await apiService.deleteRequisito(req.id);
      }
      if (esPlant && !plantillasSeleccionadas.includes(req.plantilla_documento_id!)) {
        await apiService.deleteRequisito(req.id);
      }
    }

    // ── Crear requisitos por categoría (solo tipo PDF / imagen / otros no editor) ──
    if (!esEditor) {
      const existentesCatIds = existentes
        .filter((r) => r.categoria_documento_id && !r.plantilla_documento_id)
        .map((r) => r.categoria_documento_id!);

      for (const [idx, catId] of categoriasSeleccionadas.entries()) {
        if (!existentesCatIds.includes(catId)) {
          const cat = categorias.find((c) => c.id === catId);
          await apiService.createRequisito(flujoId, etapaId, {
            nombre_documento: cat?.nombre ?? catId,
            tipo_documento_id: tipoDocumentoSeleccionado || null,
            categoria_documento_id: catId,
            plantilla_documento_id: null,
            es_obligatorio: true,
            permite_upload: true,
            permite_generar: false,
            multiple: false,
            orden: idx + 1,
            activo: true,
          });
        }
      }
    }

    // ── Crear requisitos por plantilla (solo tipo editor) ──
    if (esEditor) {
      const existentesPlantIds = existentes
        .filter((r) => r.plantilla_documento_id)
        .map((r) => r.plantilla_documento_id!);

      for (const [idx, plantId] of plantillasSeleccionadas.entries()) {
        if (!existentesPlantIds.includes(plantId)) {
          const plant = plantillasDocumento.find((p) => p.id === plantId);
          await apiService.createRequisito(flujoId, etapaId, {
            nombre_documento: plant?.nombre ?? plantId,
            tipo_documento_id: tipoDocumentoSeleccionado || null,
            categoria_documento_id: plant?.categoria_id ?? null,
            plantilla_documento_id: plantId,
            es_obligatorio: true,
            permite_upload: false,
            permite_generar: true,
            multiple: false,
            orden: idx + 1,
            activo: true,
          });
        }
      }
    }
  };

  // ── Guardar etapa ──────────────────────────────────────────
  const handleCrearEtapa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const tipoInfo = tiposDocumento.find((t) => t.id === tipoDocumentoSeleccionado);
      const esEditor = (tipoInfo?.tipo ?? "").toLowerCase() === "editor";

      // Si el tipo es editor y hay exactamente una plantilla seleccionada, la propagamos
      // directamente a etapas_flujo.plantilla_documento_id para que el detalle de siniestro
      // la muestre y la use sin necesidad de hacer un segundo lookup por tipo.
      const plantillaUnica =
        esEditor && plantillasSeleccionadas.length === 1
          ? plantillasSeleccionadas[0]
          : undefined;

      const data = {
        ...formData,
        tipo_documento_principal_id: tipoDocumentoSeleccionado || undefined,
        categoria_documento_id: undefined,
        plantilla_documento_id: plantillaUnica,
      };

      let etapaId: string;

      if (etapaEditando) {
        await apiService.updateEtapa(etapaEditando.id, data);
        etapaId = etapaEditando.id;
        await swalSuccess("Etapa actualizada correctamente");
      } else {
        const nueva = await apiService.createEtapa(flujoId, data);
        etapaId = nueva.id;
        await swalSuccess("Etapa creada correctamente");
      }

      // Sincronizar requisitos (también limpia huérfanos si se vacían las selecciones)
      if (tipoDocumentoSeleccionado) {
        await sincronizarRequisitos(etapaId);
      }

      setShowEtapaForm(false);
      setEtapaEditando(null);
      resetForm();
      cargarFlujo();
    } catch (error: any) {
      swalError(error.response?.data?.detail || "Error al guardar etapa");
    }
  };

  // ── Editar etapa: pre-cargar multi-selección ───────────────
  const handleEditarEtapa = async (etapa: EtapaFlujo) => {
    setEtapaEditando(etapa);
    setFormData({
      nombre: etapa.nombre,
      descripcion: etapa.descripcion || "",
      orden: etapa.orden,
      es_obligatoria: etapa.es_obligatoria,
      permite_omision: etapa.permite_omision,
      inhabilita_siguiente: etapa.inhabilita_siguiente,
      tipo_documento_principal_id: etapa.tipo_documento_principal_id || "",
      activo: etapa.activo,
    });

    const tipoId = etapa.tipo_documento_principal_id || "";
    // Evita que el useEffect de cascada interprete "cambio de tipo" y vacíe la multi-selección
    // justo al hidratar desde la API (competía con setCategoriasSeleccionadas asíncrono).
    prevTipoDocIdRef.current = tipoId;
    setTipoDocumentoSeleccionado(tipoId);

    if (tipoId) {
      const tipoNorm = (
        etapa.tipo_documento_principal?.tipo ??
        tiposDocumento.find((x) => x.id === tipoId)?.tipo ??
        ""
      ).toLowerCase();
      const esEditorEtapa = tipoNorm === "editor";

      const reqs = await apiService.getRequisitosEtapa(flujoId, etapa.id, false).catch(() => []);

      if (esEditorEtapa) {
        const plants = await apiService.getPlantillasDocumento(tipoId, undefined, true).catch(() => []);
        setCategorias([]);
        setPlantillasDocumento(plants ?? []);
        const plantIds = (reqs as any[])
          .filter((r) => r.plantilla_documento_id)
          .map((r) => r.plantilla_documento_id as string);
        setCategoriasSeleccionadas([]);
        setPlantillasSeleccionadas(plantIds);
      } else {
        const cats = await apiService.getCategoriasDocumento(tipoId, true).catch(() => []);
        setCategorias(cats ?? []);
        setPlantillasDocumento([]);
        const catIds = (reqs as any[])
          .filter((r) => {
            const cid =
              r.categoria_documento_id ?? r.categoria_documento?.id ?? null;
            return !!cid && !r.plantilla_documento_id;
          })
          .map(
            (r) =>
              (r.categoria_documento_id ?? r.categoria_documento?.id) as string,
          );
        setCategoriasSeleccionadas(catIds);
        setPlantillasSeleccionadas([]);
      }
    } else {
      setCategorias([]);
      setPlantillasDocumento([]);
      setCategoriasSeleccionadas([]);
      setPlantillasSeleccionadas([]);
    }

    setShowEtapaForm(true);
  };

  // ── Eliminar etapa ─────────────────────────────────────────
  const handleEliminarEtapa = async (etapaId: string) => {
    const confirmed = await swalConfirmDelete(
      "¿Está seguro de ocultar esta etapa? La base de datos no se modificará."
    );
    if (!confirmed) return;
    try {
      await apiService.deleteEtapa(flujoId, etapaId);
      await swalSuccess("Etapa ocultada correctamente");
      setFlujo((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          etapas: (prev.etapas ?? []).filter((e: any) => String(e.id) !== String(etapaId)),
        };
      });
    } catch (error: any) {
      swalError(error.response?.data?.detail || "Error al eliminar etapa");
    }
  };

  // ── Reset ──────────────────────────────────────────────────
  const resetForm = () => {
    prevTipoDocIdRef.current = "";
    setFormData({
      nombre: "",
      descripcion: "",
      orden: (flujo?.etapas?.length || 0) + 1,
      es_obligatoria: true,
      permite_omision: false,
      inhabilita_siguiente: false,
      tipo_documento_principal_id: "",
      activo: true,
    });
    setTipoDocumentoSeleccionado("");
    setCategoriasSeleccionadas([]);
    setPlantillasSeleccionadas([]);
    setCategorias([]);
    setPlantillasDocumento([]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? parseInt(value) || 0 : value,
    }));
  };

  // ── Render ─────────────────────────────────────────────────
  if (loading || !flujo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Cargando...</p>
      </div>
    );
  }

  const tipoDocSel = tiposDocumento.find((t) => t.id === tipoDocumentoSeleccionado);
  const tipoPlantillaNorm = (tipoDocSel?.tipo ?? "").toLowerCase();
  const esTipoEditorFlujo = tipoPlantillaNorm === "editor";
  const mostrarCategoriasEtapa = !!tipoDocumentoSeleccionado && !esTipoEditorFlujo;
  const mostrarPlantillasEtapa = !!tipoDocumentoSeleccionado && esTipoEditorFlujo;

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
              flujoId={flujoId}
              onEdit={handleEditarEtapa}
              onDelete={handleEliminarEtapa}
            />
          ) : (
            <p className="text-gray-500 text-center py-8">
              No hay etapas configuradas. Agrega la primera etapa.
            </p>
          )}
        </div>
      </div>

      {/* ── Modal Crear / Editar Etapa ── */}
      <Modal
        open={showEtapaForm}
        onClose={() => { setShowEtapaForm(false); resetForm(); }}
        title={etapaEditando ? "Editar Etapa" : "Nueva Etapa"}
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleCrearEtapa} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre de la Etapa"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              required
            />
            <Input
              label="Orden"
              name="orden"
              type="number"
              value={formData.orden.toString()}
              onChange={handleChange}
              required
            />
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

          {/* ── Documentos esperados (cascada tipo → multi-categorías + multi-plantillas) ── */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-1">
                <FiFileText className="w-4 h-4" />
                Documentos esperados en esta etapa
              </h3>
              <p className="text-xs text-gray-500">
                Si el tipo es <strong>PDF</strong> o <strong>imagen</strong>, elige una o varias{" "}
                <strong>categorías</strong>. Si el tipo es <strong>editor</strong>, elige una o varias{" "}
                <strong>plantillas</strong>. Cada ítem seleccionado es un documento esperado en el siniestro.
              </p>
            </div>

            {/* 1. Tipo de documento (single) */}
            <CustomSelect
              label="Tipo de documento"
              name="tipo_documento"
              value={tipoDocumentoSeleccionado}
              onChange={(value) => {
                setTipoDocumentoSeleccionado(value as string);
                setFormData((prev) => ({ ...prev, tipo_documento_principal_id: value as string }));
              }}
              options={[
                { value: "", label: "Sin tipo de documento" },
                ...tiposDocumento.map((t) => ({
                  value: t.id,
                  label: `${t.nombre} (${t.tipo === "pdf" ? "PDF" : t.tipo === "editor" ? "Editor" : "Imagen"})`,
                })),
              ]}
              placeholder="Selecciona un tipo"
            />

            {/* PDF / imagen → solo categorías (multi) */}
            {mostrarCategoriasEtapa && categorias.length > 0 && (
              <div className="ml-4 border-l-2 border-blue-200 pl-4 space-y-1">
                <CustomSelect
                  label={
                    <span className="flex items-center gap-1">
                      <FiFolder className="w-3 h-3 text-blue-500" />
                      Categorías
                      <span className="text-xs text-blue-400 font-normal">(puede seleccionar varias)</span>
                    </span>
                  }
                  name="categorias_multi"
                  value={categoriasSeleccionadas}
                  onChange={(val) => setCategoriasSeleccionadas(val as string[])}
                  options={categorias.map((c) => ({ value: c.id, label: c.nombre }))}
                  placeholder="Seleccionar una o más categorías…"
                  isMulti
                />
                {categoriasSeleccionadas.length > 0 && (
                  <p className="text-xs text-blue-600">
                    ✓ Se crearán {categoriasSeleccionadas.length} documento(s) esperado(s) de tipo subible.
                  </p>
                )}
              </div>
            )}

            {/* Editor → solo plantillas (multi) */}
            {mostrarPlantillasEtapa && plantillasDocumento.length > 0 && (
              <div className="ml-4 border-l-2 border-green-200 pl-4 space-y-1">
                <CustomSelect
                  label={
                    <span className="flex items-center gap-1">
                      <FiFileText className="w-3 h-3 text-green-500" />
                      Plantillas generables
                      <span className="text-xs text-green-400 font-normal">(puede seleccionar varias)</span>
                    </span>
                  }
                  name="plantillas_multi"
                  value={plantillasSeleccionadas}
                  onChange={(val) => setPlantillasSeleccionadas(val as string[])}
                  options={plantillasDocumento.map((p) => ({ value: p.id, label: p.nombre }))}
                  placeholder="Seleccionar una o más plantillas…"
                  isMulti
                />
                {plantillasSeleccionadas.length > 0 && (
                  <p className="text-xs text-green-600">
                    ✓ Se crearán {plantillasSeleccionadas.length} documento(s) generable(s) desde plantilla.
                  </p>
                )}
              </div>
            )}

            {mostrarCategoriasEtapa && categorias.length === 0 && (
              <p className="ml-4 text-xs text-amber-600 italic">
                Este tipo (PDF/imagen) no tiene categorías configuradas.
              </p>
            )}
            {mostrarPlantillasEtapa && plantillasDocumento.length === 0 && (
              <p className="ml-4 text-xs text-amber-600 italic">
                Este tipo (editor) no tiene plantillas configuradas.
              </p>
            )}

            {((mostrarCategoriasEtapa && categoriasSeleccionadas.length > 0) ||
              (mostrarPlantillasEtapa && plantillasSeleccionadas.length > 0)) && (
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-700 mb-2">Documentos que se agregarán a esta etapa:</p>
                <ul className="space-y-1">
                  {mostrarCategoriasEtapa &&
                    categoriasSeleccionadas.map((id) => {
                      const cat = categorias.find((c) => c.id === id);
                      return (
                        <li key={id} className="text-xs text-gray-600 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                          {cat?.nombre ?? id}
                          <span className="text-gray-400">(subible)</span>
                        </li>
                      );
                    })}
                  {mostrarPlantillasEtapa &&
                    plantillasSeleccionadas.map((id) => {
                      const plant = plantillasDocumento.find((p) => p.id === id);
                      return (
                        <li key={id} className="text-xs text-gray-600 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                          {plant?.nombre ?? id}
                          <span className="text-gray-400">(generable)</span>
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}
          </div>

          {/* Flags */}
          <div className="flex gap-6 flex-wrap">
            <Switch
              label="Obligatoria"
              checked={!!formData.es_obligatoria}
              onChange={(v) => setFormData((prev) => ({ ...prev, es_obligatoria: v }))}
            />
            <Switch
              label="Permite omisión"
              checked={!!formData.permite_omision}
              onChange={(v) => setFormData((prev) => ({ ...prev, permite_omision: v }))}
            />
            <Switch
              label="Bloquea siguiente"
              checked={!!formData.inhabilita_siguiente}
              onChange={(v) => setFormData((prev) => ({ ...prev, inhabilita_siguiente: v }))}
            />
            <Switch
              label="Activa"
              checked={!!formData.activo}
              onChange={(v) => setFormData((prev) => ({ ...prev, activo: v }))}
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setShowEtapaForm(false); resetForm(); }}
            >
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

// ─────────────────────────────────────────────────────────────
// Tabla de etapas
// ─────────────────────────────────────────────────────────────

function EtapasTable({
  data,
  flujoId,
  onEdit,
  onDelete,
}: {
  data: EtapaFlujo[];
  flujoId: string;
  onEdit: (row: EtapaFlujo) => void;
  onDelete: (id: string) => void;
}) {
  // Carga la cantidad de requisitos por etapa para mostrarla en la tabla
  const [countMap, setCountMap] = useState<Record<string, number>>({});

  useEffect(() => {
    const cargar = async () => {
      const resultados = await Promise.allSettled(
        data.map((e) =>
          apiService
            .getRequisitosEtapa(flujoId, e.id, true)
            .then((r: any[]) => ({ id: e.id, count: r?.length ?? 0 }))
        )
      );
      const map: Record<string, number> = {};
      for (const r of resultados) {
        if (r.status === "fulfilled") map[r.value.id] = r.value.count;
      }
      setCountMap(map);
    };
    if (data.length > 0) cargar();
  }, [data, flujoId]);

  const columns: ColumnDef<EtapaFlujo>[] = [
    {
      header: "Orden",
      accessorKey: "orden",
      cell: (info) => (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-semibold text-sm">
          {info.getValue() as number}
        </span>
      ),
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
      ),
    },
    {
      header: "Tipo / Documentos",
      id: "docs",
      cell: ({ row }) => {
        const etapa = row.original;
        const count = countMap[etapa.id] ?? 0;
        return (
          <div className="flex flex-col gap-1 text-xs">
            {etapa.tipo_documento_principal?.nombre && (
              <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded w-fit">
                📁 {etapa.tipo_documento_principal.nombre}
              </span>
            )}
            {count > 0 ? (
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded w-fit">
                📋 {count} documento{count !== 1 ? "s" : ""} esperado{count !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-gray-400 italic">Sin documentos configurados</span>
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
          <Button variant="secondary" size="sm" onClick={() => onEdit(row.original)}>
            Editar
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(row.original.id)}>
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      layoutStorageKey="aslin-datatable-flujo-etapas"
      columns={columns}
      data={data}
      emptyText="Sin etapas"
    />
  );
}
