"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { FiCheckCircle, FiFile, FiFolder, FiRefreshCw, FiSearch, FiTrash2 } from "react-icons/fi";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import apiService from "@/lib/apiService";
import { swalConfirm, swalError, swalInfo, swalSuccess, swalWarning } from "@/lib/swal";
import type {
  LegacyDestinationCategory,
  LegacyDestinationFlow,
  LegacyDetectedFile,
  LegacyFinalizeItem,
  LegacyMigrationContext,
} from "@/types/legacyDocumentMigration";

interface Props {
  siniestroId: string;
  areaId?: string;
  enabled?: boolean;
  assignedAreas?: Array<{
    id: string;
    nombre: string;
    flowNames: string[];
  }>;
  onFinalized?: () => void | Promise<void>;
}

interface SelectedTarget {
  flowId: string;
  categoryKey: string;
}

interface DraftAssignment extends LegacyFinalizeItem {
  file_id: string;
  category_key: string;
}

const STORAGE_PREFIX = "legacy-doc-migration-draft";

function getStorageKey(siniestroId: string, areaId?: string) {
  return `${STORAGE_PREFIX}:${siniestroId}:${areaId || "all"}`;
}

function readDrafts(siniestroId: string, areaId?: string): Record<string, DraftAssignment> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(getStorageKey(siniestroId, areaId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, DraftAssignment>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeDrafts(siniestroId: string, drafts: Record<string, DraftAssignment>, areaId?: string) {
  if (typeof window === "undefined") return;
  if (!Object.keys(drafts).length) {
    window.localStorage.removeItem(getStorageKey(siniestroId, areaId));
    return;
  }
  window.localStorage.setItem(getStorageKey(siniestroId, areaId), JSON.stringify(drafts));
}

function buildDropId(flowId: string, categoryKey: string) {
  return `legacy-drop:${flowId}:${encodeURIComponent(categoryKey)}`;
}

function parseDropId(id?: string | null): SelectedTarget | null {
  if (!id || !id.startsWith("legacy-drop:")) return null;
  const raw = id.slice("legacy-drop:".length);
  const idx = raw.indexOf(":");
  if (idx === -1) return null;
  return { flowId: raw.slice(0, idx), categoryKey: decodeURIComponent(raw.slice(idx + 1)) };
}

function formatLegacyDateCompact(value?: string | null) {
  if (!value) return "sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sin fecha";
  return date.toLocaleString("es-MX", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function buildCompactLabel(file: LegacyDetectedFile) {
  return `${file.nombre_archivo} - ${file.legacy_etapa || "sin etapa"} - ${formatLegacyDateCompact(file.fecha_archivo)}`;
}

function FileRow({
  file,
  selected,
  dragActive = false,
  draggable = true,
  onClick,
  onPreview,
  onClear,
}: {
  file: LegacyDetectedFile;
  selected: boolean;
  dragActive?: boolean;
  draggable?: boolean;
  onClick?: () => void;
  onPreview?: () => void;
  onClear?: () => void;
}) {
  return (
    <div
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      title={buildCompactLabel(file)}
      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition ${
        selected ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"
      } ${dragActive ? "shadow-lg ring-2 ring-blue-300" : "hover:border-slate-300"}`}
    >
      <div className="min-w-0 flex-1 truncate text-sm text-slate-800">
        {buildCompactLabel(file)}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {file.previewable && (
          <Button
            variant="tertiary"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onPreview?.();
            }}
          >
            <FiFile className="h-4 w-4" />
          </Button>
        )}
        {onClear && (
          <Button
            variant="tertiary"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
          >
            <FiTrash2 className="h-4 w-4" />
          </Button>
        )}
        {!draggable && <span className="hidden" />}
      </div>
    </div>
  );
}

function DraggableFileRow(props: {
  file: LegacyDetectedFile;
  selected: boolean;
  draggable?: boolean;
  onClick?: () => void;
  onPreview?: () => void;
  onClear?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: props.file.id,
    disabled: props.draggable === false,
  });

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} {...attributes} {...listeners}>
      <FileRow {...props} dragActive={isDragging} />
    </div>
  );
}

function CategoryCard({
  flow,
  category,
  active,
  assignedFiles,
  onAssignSelected,
  onPreview,
  onClearDraft,
}: {
  flow: LegacyDestinationFlow;
  category: LegacyDestinationCategory;
  active: boolean;
  assignedFiles: LegacyDetectedFile[];
  onAssignSelected: () => void;
  onPreview: (file: LegacyDetectedFile) => void;
  onClearDraft: (fileId: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: buildDropId(flow.id, category.clave) });

  return (
    <div
      ref={setNodeRef}
      onClick={onAssignSelected}
      className={`rounded-xl border p-4 text-left transition ${
        active
          ? "border-blue-500 bg-blue-50"
          : isOver
            ? "border-blue-400 bg-blue-50"
            : "border-slate-200 bg-slate-50 hover:border-slate-300"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="truncate font-semibold text-slate-900">{category.nombre}</h4>
        <FiFolder className="h-5 w-5 shrink-0 text-slate-400" />
      </div>
      <div className="mt-3 space-y-2">
        {assignedFiles.map((file) => (
          <DraggableFileRow
            key={file.id}
            file={file}
            selected={false}
            onPreview={() => onPreview(file)}
            onClear={() => onClearDraft(file.id)}
          />
        ))}
        {assignedFiles.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
            Suelta aquí
          </div>
        )}
      </div>
    </div>
  );
}

export default function LegacyDocumentClassificationModal({
  siniestroId,
  areaId,
  enabled = true,
  assignedAreas = [],
  onFinalized,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const loadRequestIdRef = useRef(0);
  const [effectiveAreaId, setEffectiveAreaId] = useState<string | undefined>(areaId);
  const scopedEnabled = Boolean(enabled && effectiveAreaId);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [context, setContext] = useState<LegacyMigrationContext | null>(null);
  const [files, setFiles] = useState<LegacyDetectedFile[]>([]);
  const [flows, setFlows] = useState<LegacyDestinationFlow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftAssignment>>({});
  const [activeFlowId, setActiveFlowId] = useState("");
  const [selectedFileId, setSelectedFileId] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(null);
  const [search, setSearch] = useState("");
  const [activeDragFileId, setActiveDragFileId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState("");

  useEffect(() => {
    if (!scopedEnabled) {
      setDrafts({});
      setOpen(false);
      return;
    }
    setDrafts(readDrafts(siniestroId, effectiveAreaId));
  }, [effectiveAreaId, scopedEnabled, siniestroId]);

  useEffect(() => {
    if (!scopedEnabled) return;
    writeDrafts(siniestroId, drafts, effectiveAreaId);
  }, [drafts, effectiveAreaId, scopedEnabled, siniestroId]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const activeFlow = useMemo(() => flows.find((flow) => flow.id === activeFlowId) || null, [flows, activeFlowId]);
  const selectedFile = useMemo(() => files.find((file) => file.id === selectedFileId) || null, [files, selectedFileId]);
  const activeDragFile = useMemo(() => files.find((file) => file.id === activeDragFileId) || null, [activeDragFileId, files]);
  const importedCount = useMemo(() => files.filter((file) => file.estado_revision === "clasificado").length, [files]);
  const draftCount = useMemo(
    () => files.filter((file) => file.estado_revision !== "clasificado" && !!drafts[file.id]).length,
    [drafts, files]
  );
  const pendingCount = Math.max(files.length - importedCount - draftCount, 0);

  const unassignedFiles = useMemo(
    () => files.filter((file) => file.estado_revision !== "clasificado" && !drafts[file.id]),
    [drafts, files]
  );

  const filteredFiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return unassignedFiles;
    return unassignedFiles.filter((file) =>
      `${file.nombre_archivo} ${file.legacy_etapa || ""} ${file.fecha_archivo || ""}`.toLowerCase().includes(query)
    );
  }, [search, unassignedFiles]);

  const assignedFilesByCategory = useMemo(() => {
    const mapped = new Map<string, LegacyDetectedFile[]>();
    Object.values(drafts).forEach((draft) => {
      const file = files.find((item) => item.id === draft.file_id);
      if (!file) return;
      const key = `${draft.flujo_trabajo_id}:${draft.category_key}`;
      const current = mapped.get(key) || [];
      current.push(file);
      mapped.set(key, current);
    });
    return mapped;
  }, [drafts, files]);

  useEffect(() => {
    const validAreaIds = new Set(assignedAreas.map((area) => area.id));
    const preferredAreaId =
      (areaId && (validAreaIds.size === 0 || validAreaIds.has(areaId)) ? areaId : undefined) ||
      assignedAreas[0]?.id ||
      undefined;

    setEffectiveAreaId((current) => {
      if (!enabled) return undefined;
      if (areaId && (validAreaIds.size === 0 || validAreaIds.has(areaId)) && current !== areaId) {
        return areaId;
      }
      if (current && (validAreaIds.size === 0 || validAreaIds.has(current))) {
        return current;
      }
      return preferredAreaId;
    });
  }, [areaId, assignedAreas, enabled, siniestroId]);

  useEffect(() => {
    setSelectedTarget(null);
    setSelectedFileId("");
  }, [effectiveAreaId]);

  const loadAll = async () => {
    if (!scopedEnabled || !effectiveAreaId) return;
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    try {
      const [contextData, filesData, destinations] = await Promise.all([
        apiService.getLegacyDocumentMigrationContext(siniestroId, effectiveAreaId),
        apiService.getLegacyDocumentMigrationFiles(siniestroId, effectiveAreaId),
        apiService.getLegacyDocumentMigrationDestinations(siniestroId, effectiveAreaId),
      ]);
      if (requestId !== loadRequestIdRef.current) return;

      const nextFiles = (filesData || []) as LegacyDetectedFile[];
      const nextFlows = (destinations?.flujos || []) as LegacyDestinationFlow[];
      const persistedDrafts = readDrafts(siniestroId, effectiveAreaId);
      const validPendingIds = new Set(nextFiles.filter((file) => file.estado_revision !== "clasificado").map((file) => file.id));
      const nextDrafts = Object.fromEntries(
        Object.entries(persistedDrafts).filter(([fileId]) => validPendingIds.has(fileId))
      ) as Record<string, DraftAssignment>;

      setContext(contextData);
      setFiles(nextFiles);
      setFlows(nextFlows);
      setDrafts(nextDrafts);
      setOpen((current) => current || Boolean(contextData?.requiere_modal));

      if ((!activeFlowId || !nextFlows.some((flow) => flow.id === activeFlowId)) && nextFlows.length > 0) {
        setActiveFlowId(nextFlows[0].id);
      }

      const nextVisibleFiles = nextFiles.filter((file) => file.estado_revision !== "clasificado" && !nextDrafts[file.id]);
      if ((!selectedFileId || !nextVisibleFiles.some((file) => file.id === selectedFileId)) && nextVisibleFiles.length > 0) {
        setSelectedFileId(nextVisibleFiles[0].id);
      } else if (nextVisibleFiles.length === 0) {
        setSelectedFileId("");
      }
    } catch (error: any) {
      if (requestId !== loadRequestIdRef.current) return;
      console.error(error);
      swalError(error?.response?.data?.detail || "No se pudo cargar la clasificación documental legacy.");
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!scopedEnabled || !effectiveAreaId) return;
    loadAll().catch((error) => console.error(error));
  }, [effectiveAreaId, scopedEnabled, siniestroId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await apiService.rescanLegacyDocumentMigration(siniestroId, effectiveAreaId);
      await loadAll();
    } catch (error: any) {
      swalError(error?.response?.data?.detail || "No se pudo recargar la fuente legacy.");
    } finally {
      setRefreshing(false);
    }
  };

  const handlePreview = async (file: LegacyDetectedFile) => {
    try {
      setPreviewLoading(true);
      const { blob, contentType } = await apiService.fetchLegacyDocumentPreviewBlob(siniestroId, file.id);
      const nextPreviewUrl = window.URL.createObjectURL(
        new Blob([blob], { type: contentType || "application/pdf" })
      );
      setPreviewUrl((current) => {
        if (current) {
          window.URL.revokeObjectURL(current);
        }
        return nextPreviewUrl;
      });
      setPreviewFilename(file.nombre_archivo);
      setPreviewOpen(true);
    } catch (error: any) {
      swalError(error?.response?.data?.detail || error?.message || "No se pudo abrir la vista previa.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    setPreviewFilename("");
    setPreviewUrl((current) => {
      if (current) {
        window.URL.revokeObjectURL(current);
      }
      return null;
    });
  };

  const handleClearDraft = async (fileId: string) => {
    const confirmed = await swalConfirm("Se quitará la asignación del archivo.", "Quitar asignación");
    if (!confirmed) return;
    setDrafts((current) => {
      const next = { ...current };
      delete next[fileId];
      return next;
    });
    setSelectedFileId(fileId);
    setSelectedTarget(null);
  };

  const upsertDraftForCategory = (file: LegacyDetectedFile, flow: LegacyDestinationFlow, category: LegacyDestinationCategory) => {
    if (file.estado_revision === "clasificado") {
      swalInfo("Este archivo ya fue importado y no se puede volver a clasificar.");
      return;
    }

    const currentDraft = drafts[file.id];
    const selectedStage = category.etapas.find((stage) => stage.id === currentDraft?.etapa_flujo_id) || category.etapas[0] || null;
    const selectedType =
      selectedStage?.tipos_documento.find((type) => type.id === currentDraft?.tipo_documento_id) ||
      selectedStage?.tipos_documento[0] ||
      null;
    const selectedRequirement =
      selectedType?.requisitos.find((req) => req.id === currentDraft?.requisito_documento_id) ||
      selectedType?.requisitos[0] ||
      null;

    if (!selectedStage?.id || !selectedType?.id) {
      swalWarning("La categoría seleccionada no tiene una configuración válida de etapa y tipo documental.");
      return;
    }

    setDrafts((current) => ({
      ...current,
      [file.id]: {
        file_id: file.id,
        legacy_file_id: file.legacy_file_id,
        flujo_trabajo_id: flow.id,
        category_key: category.clave,
        categoria_documento_id: category.id || null,
        etapa_flujo_id: selectedStage.id,
        tipo_documento_id: selectedType.id,
        requisito_documento_id: selectedRequirement?.id || null,
      },
    }));
    setSelectedTarget({ flowId: flow.id, categoryKey: category.clave });
    setSelectedFileId("");
  };

  const handleFinalize = async () => {
    const pendingFiles = files.filter((file) => file.estado_revision !== "clasificado");
    if (!pendingFiles.length) {
      swalInfo("No hay archivos pendientes por importar.");
      return;
    }
    if (pendingCount > 0) {
      swalWarning("Aún hay archivos pendientes sin asignación.");
      return;
    }

    const items = pendingFiles.map((file) => drafts[file.id]).filter(Boolean) as DraftAssignment[];
    const confirmed = await swalConfirm(
      "Se descargarán los archivos desde la fuente temporal y se crearán los documentos definitivos en storage.",
      "Finalizar importación",
      "Sí, finalizar",
      "Cancelar"
    );
    if (!confirmed) return;

    setFinalizing(true);
    try {
      const payload = {
        items: items.map((draft): LegacyFinalizeItem => ({
          legacy_file_id: draft.legacy_file_id,
          flujo_trabajo_id: draft.flujo_trabajo_id,
          categoria_documento_id: draft.categoria_documento_id || null,
          etapa_flujo_id: draft.etapa_flujo_id,
          tipo_documento_id: draft.tipo_documento_id,
          requisito_documento_id: draft.requisito_documento_id || null,
        })),
      };
      const result = await apiService.finalizeLegacyDocumentMigration(siniestroId, payload, effectiveAreaId);
      setDrafts({});
      writeDrafts(siniestroId, {}, effectiveAreaId);
      setOpen(false);
      swalSuccess(`Se importaron ${result.documentos_creados} documento(s) legacy.`);
      if (onFinalized) await onFinalized();
      await loadAll();
    } catch (error: any) {
      swalError(error?.response?.data?.detail || "No se pudo finalizar la importación documental.");
    } finally {
      setFinalizing(false);
    }
  };

  const handleClose = () => {
    if (files.some((file) => file.estado_revision !== "clasificado")) {
      swalInfo("Debes finalizar la importación de archivos legacy antes de cerrar este modal.");
      return;
    }
    setOpen(false);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragFileId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragFileId(null);
    const file = files.find((item) => item.id === String(event.active.id));
    const target = parseDropId(event.over?.id ? String(event.over.id) : null);
    if (!file || !target) return;
    const flow = flows.find((item) => item.id === target.flowId);
    const category = flow?.categorias.find((item) => item.clave === target.categoryKey);
    if (!flow || !category) return;
    upsertDraftForCategory(file, flow, category);
  };

  if (!scopedEnabled || (!open && !context?.requiere_modal)) return null;

  return (
    <>
      <Modal
      open={open}
      onClose={handleClose}
      title="Importación de documentos legacy"
      maxWidthClass="max-w-[96vw]"
      maxHeightClass="max-h-[95vh]"
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Fuente detectada</p>
              <p className="text-xs text-slate-600">
                {context?.legacy_source_ref || context?.legacy_folder_path_ref || "Sin referencia legacy"}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                Total: <strong>{files.length}</strong>
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                Importados: <strong>{importedCount}</strong>
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                Asignados: <strong>{draftCount}</strong>
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                Pendientes: <strong>{pendingCount}</strong>
              </span>
            </div>
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[1fr_1fr]">
            <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Archivos</h3>
                    <p className="text-sm text-slate-500">Arrastra a la categoría correspondiente.</p>
                  </div>
                  <Button variant="secondary" onClick={handleRefresh} disabled={refreshing || finalizing}>
                    <FiRefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                    Actualizar
                  </Button>
                </div>
                <div className="relative mt-4">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar archivo..."
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4">
                <div className="space-y-2">
                  {filteredFiles.map((file) => (
                    <DraggableFileRow
                      key={file.id}
                      file={file}
                      selected={selectedFileId === file.id}
                      onClick={() => setSelectedFileId(file.id)}
                      onPreview={() => handlePreview(file)}
                      draggable
                    />
                  ))}
                  {filteredFiles.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                      No hay archivos pendientes en esta lista.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 p-4">
                {assignedAreas.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Áreas</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {assignedAreas.map((area) => (
                        <button
                          key={area.id}
                          type="button"
                          onClick={() => setEffectiveAreaId(area.id)}
                          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                            effectiveAreaId === area.id
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {area.nombre}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <h3 className="text-base font-semibold text-slate-900">Categorías</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {flows.map((flow) => (
                    <button
                      key={flow.id}
                      type="button"
                      onClick={() => setActiveFlowId(flow.id)}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                        activeFlowId === flow.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {flow.nombre}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {(activeFlow?.categorias || []).map((category) => (
                    <CategoryCard
                      key={category.clave}
                      flow={activeFlow!}
                      category={category}
                      active={selectedTarget?.flowId === activeFlow?.id && selectedTarget?.categoryKey === category.clave}
                      assignedFiles={assignedFilesByCategory.get(`${activeFlow!.id}:${category.clave}`) || []}
                      onAssignSelected={() => {
                        if (!selectedFile) {
                          swalInfo("Selecciona primero un archivo del listado.");
                          return;
                        }
                        upsertDraftForCategory(selectedFile, activeFlow!, category);
                      }}
                      onPreview={handlePreview}
                      onClearDraft={handleClearDraft}
                    />
                  ))}
                  {(activeFlow?.categorias || []).length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 sm:col-span-2 xl:col-span-3">
                      No hay categorías disponibles para el flujo seleccionado.
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-600">
                    Los archivos asignados desaparecen de la lista izquierda y quedan dentro de su categoría.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={handleFinalize}
                    disabled={loading || finalizing || pendingCount > 0 || draftCount === 0}
                  >
                    <FiCheckCircle className="mr-2 h-4 w-4" />
                    Finalizar
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DragOverlay>
            {activeDragFile ? (
              <div className="w-[420px] max-w-[90vw] opacity-95">
                <FileRow file={activeDragFile} selected={false} draggable />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {loading && (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
            Cargando importación documental legacy...
          </div>
        )}
      </div>
      </Modal>
      <Modal
        open={previewOpen}
        onClose={handleClosePreview}
        title={`Vista previa - ${previewFilename || "Documento"}`}
        maxWidthClass="max-w-6xl"
        maxHeightClass="max-h-[92vh]"
        contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {previewLoading ? (
            <div className="flex min-h-[50vh] flex-1 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
                <p className="text-gray-600">Cargando vista previa...</p>
              </div>
            </div>
          ) : previewUrl ? (
            <iframe
              src={previewUrl}
              className="h-[75vh] w-full rounded-lg border border-slate-300"
              title={`Vista previa de ${previewFilename || "documento"}`}
            />
          ) : (
            <div className="flex min-h-[50vh] flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500">
              No hay un archivo disponible para vista previa.
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
