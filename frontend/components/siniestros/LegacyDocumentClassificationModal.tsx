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
import { FiCheckCircle, FiFile, FiFolder, FiRefreshCw, FiSearch, FiTrash2, FiLayers } from "react-icons/fi";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import CustomSelect from "@/components/ui/Select";
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
  /** Mantiene el tab de área de la ficha alineado con el ámbito del modal (evita peticiones sin area_id). */
  onEffectiveAreaChange?: (areaId: string) => void;
  onFinalized?: () => void | Promise<void>;
}

interface SelectedTarget {
  flowId: string;
  categoryKey: string;
}

interface DraftAssignment extends LegacyFinalizeItem {
  file_id: string;
  category_key: string;
  /** Solo para mostrar en la UI; no se envía al API. */
  flujo_display_name?: string | null;
}

type OtroFlujoOption = {
  id: string;
  nombre: string;
  es_predeterminado?: boolean;
};

const STORAGE_PREFIX = "legacy-doc-migration-draft";

/** Zona especial: abre modal para elegir categoría / tipo / requisito manualmente. */
const OTRO_DROP_KEY = "__otro__";

function getStorageKey(siniestroId: string, areaId?: string) {
  return `${STORAGE_PREFIX}:${siniestroId}:${areaId || "all"}`;
}

/** Último flujo elegido en «Otro» (por siniestro/área) para no perderlo al cerrar el modal ni entre archivos. */
function lastOtroFlujoStorageKey(siniestroId: string, areaId?: string) {
  return `legacy-otro-last-flujo:${siniestroId}:${areaId || "all"}`;
}

function readLastOtroFlujoId(siniestroId: string, areaId?: string): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(lastOtroFlujoStorageKey(siniestroId, areaId))?.trim() || "";
}

function writeLastOtroFlujoId(siniestroId: string, areaId: string | undefined, flujoId: string) {
  if (typeof window === "undefined" || !flujoId.trim()) return;
  window.sessionStorage.setItem(lastOtroFlujoStorageKey(siniestroId, areaId), flujoId.trim());
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

/** Clave única para borradores asignados solo por catálogo (sin flujo/etapa). */
const LEGACY_CATALOGO_BUCKET_KEY = "__catalogo__";

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

function OtroCategoryCard({
  flow,
  active,
  onAssignSelected,
  onNativeFileDrop,
}: {
  flow: LegacyDestinationFlow;
  active: boolean;
  onAssignSelected: () => void;
  onNativeFileDrop: (file: File) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: buildDropId(flow.id, OTRO_DROP_KEY) });

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAssignSelected();
        }
      }}
      onClick={onAssignSelected}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const f = e.dataTransfer.files?.[0];
        if (f) onNativeFileDrop(f);
      }}
      className={`rounded-xl border-2 border-dashed p-4 text-left transition ${
        active
          ? "border-violet-500 bg-violet-50"
          : isOver
            ? "border-violet-400 bg-violet-50/80"
            : "border-violet-200 bg-white hover:border-violet-300 hover:bg-violet-50/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate font-semibold text-violet-900">Otro</h4>
          <p className="mt-1 text-xs text-violet-700/90">
            Clasificación manual
          </p>
        </div>
        <FiLayers className="h-6 w-6 shrink-0 text-violet-400" />
      </div>
      <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-3 text-center text-xs text-violet-800">
        Suelta aquí · archivo del listado o desde el escritorio
      </div>
    </div>
  );
}

export default function LegacyDocumentClassificationModal({
  siniestroId,
  areaId,
  enabled = true,
  assignedAreas = [],
  onEffectiveAreaChange,
  onFinalized,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const loadRequestIdRef = useRef(0);
  /** Evita que re-renders con nuevo array `assignedAreas` fuercen el área del padre sobre la elegida en el modal. */
  const prevPropAreaIdRef = useRef<string | undefined>(undefined);
  const prevSiniestroForAreaSyncRef = useRef(siniestroId);
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

  /** Modal "Otro" — clasificación manual (legacy o archivo externo) */
  const [otroOpen, setOtroOpen] = useState(false);
  const [otroLegacyFile, setOtroLegacyFile] = useState<LegacyDetectedFile | null>(null);
  const [otroExternalFile, setOtroExternalFile] = useState<File | null>(null);
  const [otroDescripcion, setOtroDescripcion] = useState("");
  const [otroSaving, setOtroSaving] = useState(false);
  const [otroCatalogTipos, setOtroCatalogTipos] = useState<{ id: string; nombre: string; tipo: string }[]>([]);
  const [otroCatalogCategorias, setOtroCatalogCategorias] = useState<{ id: string; nombre: string }[]>([]);
  const [otroCatalogPlantillas, setOtroCatalogPlantillas] = useState<{ id: string; nombre: string }[]>([]);
  const [otroTipoCatalogId, setOtroTipoCatalogId] = useState("");
  const [otroCategoriaCatalogId, setOtroCategoriaCatalogId] = useState("");
  const [otroPlantillaCatalogId, setOtroPlantillaCatalogId] = useState("");
  const [otroLoadingCatalogos, setOtroLoadingCatalogos] = useState(false);
  const [otroFlujoOpciones, setOtroFlujoOpciones] = useState<OtroFlujoOption[]>([]);
  const [otroFlujoId, setOtroFlujoId] = useState("");
  const [otroFlujoLoading, setOtroFlujoLoading] = useState(false);

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
  const otroTipoEsEditor = useMemo(() => {
    const sel = otroCatalogTipos.find((x) => x.id === otroTipoCatalogId);
    return (sel?.tipo ?? "").toLowerCase() === "editor";
  }, [otroCatalogTipos, otroTipoCatalogId]);
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
      const key =
        draft.category_key === LEGACY_CATALOGO_BUCKET_KEY
          ? LEGACY_CATALOGO_BUCKET_KEY
          : `${draft.flujo_trabajo_id}:${draft.category_key}`;
      const current = mapped.get(key) || [];
      current.push(file);
      mapped.set(key, current);
    });
    return mapped;
  }, [drafts, files]);

  const flowNombrePorId = useMemo(() => {
    const m = new Map<string, string>();
    flows.forEach((f) => m.set(f.id, f.nombre));
    return m;
  }, [flows]);

  useEffect(() => {
    if (prevSiniestroForAreaSyncRef.current !== siniestroId) {
      prevPropAreaIdRef.current = undefined;
      prevSiniestroForAreaSyncRef.current = siniestroId;
    }

    const validAreaIds = new Set(assignedAreas.map((area) => area.id));
    const preferredAreaId =
      (areaId && (validAreaIds.size === 0 || validAreaIds.has(areaId)) ? areaId : undefined) ||
      assignedAreas[0]?.id ||
      undefined;

    if (!enabled) {
      setEffectiveAreaId(undefined);
      prevPropAreaIdRef.current = undefined;
      return;
    }

    const propAreaChanged = prevPropAreaIdRef.current !== areaId;
    prevPropAreaIdRef.current = areaId;

    if (propAreaChanged && areaId && (validAreaIds.size === 0 || validAreaIds.has(areaId))) {
      setEffectiveAreaId(areaId);
      return;
    }

    setEffectiveAreaId((current) => {
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

  const loadAll = async (areaForFetch?: string) => {
    const scope = (areaForFetch ?? effectiveAreaId)?.trim();
    if (!enabled || !scope) return;
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    try {
      const [contextData, filesData, destinations] = await Promise.all([
        apiService.getLegacyDocumentMigrationContext(siniestroId, scope),
        apiService.getLegacyDocumentMigrationFiles(siniestroId, scope),
        apiService.getLegacyDocumentMigrationDestinations(siniestroId, scope),
      ]);
      if (requestId !== loadRequestIdRef.current) return;

      const nextFiles = (filesData || []) as LegacyDetectedFile[];
      const nextFlows = (destinations?.flujos || []) as LegacyDestinationFlow[];
      const persistedDrafts = readDrafts(siniestroId, scope);
      const validPendingIds = new Set(nextFiles.filter((file) => file.estado_revision !== "clasificado").map((file) => file.id));
      const nextDrafts = Object.fromEntries(
        Object.entries(persistedDrafts).filter(([fileId]) => validPendingIds.has(fileId))
      ) as Record<string, DraftAssignment>;

      setContext(contextData);
      setFiles(nextFiles);
      setFlows(nextFlows);
      setDrafts((prev) => {
        const merged: Record<string, DraftAssignment> = { ...nextDrafts };
        for (const id of Object.keys(merged)) {
          const next = merged[id];
          const previous = prev[id];
          if (
            previous?.category_key === LEGACY_CATALOGO_BUCKET_KEY &&
            next.category_key === LEGACY_CATALOGO_BUCKET_KEY &&
            previous.flujo_trabajo_id &&
            !next.flujo_trabajo_id
          ) {
            merged[id] = {
              ...next,
              flujo_trabajo_id: previous.flujo_trabajo_id,
              flujo_display_name: previous.flujo_display_name ?? next.flujo_display_name ?? null,
            };
          }
        }
        return merged;
      });
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
    const id = effectiveAreaId;
    loadAll(id).catch((error) => console.error(error));
  }, [effectiveAreaId, scopedEnabled, siniestroId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await apiService.rescanLegacyDocumentMigration(siniestroId, effectiveAreaId);
      await loadAll(effectiveAreaId);
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
          tipo_documento_id: draft.tipo_documento_id,
          categoria_documento_id: draft.categoria_documento_id ?? null,
          flujo_trabajo_id: draft.flujo_trabajo_id ?? null,
          etapa_flujo_id: draft.etapa_flujo_id ?? null,
          requisito_documento_id: draft.requisito_documento_id ?? null,
        })),
      };
      const result = await apiService.finalizeLegacyDocumentMigration(siniestroId, payload, effectiveAreaId);
      setDrafts({});
      writeDrafts(siniestroId, {}, effectiveAreaId);
      setOpen(false);
      swalSuccess(`Se importaron ${result.documentos_creados} documento(s) legacy.`);
      if (onFinalized) await onFinalized();
      await loadAll(effectiveAreaId);
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

  const openOtroModal = (
    flowForHighlight: LegacyDestinationFlow | null,
    legacy: LegacyDetectedFile | null,
    external: File | null
  ) => {
    setOtroLegacyFile(legacy);
    setOtroExternalFile(external);
    setOtroDescripcion("");
    setOtroTipoCatalogId("");
    setOtroCategoriaCatalogId("");
    setOtroPlantillaCatalogId("");
    setOtroFlujoId(
      flowForHighlight?.id || readLastOtroFlujoId(siniestroId, effectiveAreaId) || ""
    );
    const highlight = flowForHighlight || flows[0];
    if (highlight) {
      setSelectedTarget({ flowId: highlight.id, categoryKey: OTRO_DROP_KEY });
    }
    setOtroOpen(true);
  };

  const closeOtroModal = (clearSelectedTarget = true) => {
    setOtroOpen(false);
    setOtroLegacyFile(null);
    setOtroExternalFile(null);
    setOtroDescripcion("");
    setOtroTipoCatalogId("");
    setOtroCategoriaCatalogId("");
    setOtroPlantillaCatalogId("");
    setOtroCatalogCategorias([]);
    setOtroCatalogPlantillas([]);
    setOtroFlujoId("");
    if (clearSelectedTarget) setSelectedTarget(null);
  };

  useEffect(() => {
    if (!otroOpen || !effectiveAreaId) {
      setOtroFlujoOpciones([]);
      setOtroFlujoLoading(false);
      return;
    }
    let cancelled = false;
    setOtroFlujoLoading(true);
    (async () => {
      try {
        const assignedIds = new Set(assignedAreas.map((a) => a.id));
        const byId = new Map<string, OtroFlujoOption>();
        for (const f of flows) {
          byId.set(f.id, { id: f.id, nombre: f.nombre, es_predeterminado: false });
        }
        if (assignedIds.size > 0) {
          const allFlujos = await apiService.getFlujos(undefined, true);
          const arr = Array.isArray(allFlujos) ? allFlujos : [];
          for (const raw of arr) {
            const id = String(raw.id);
            const aid = raw.area_id != null && raw.area_id !== "" ? String(raw.area_id) : null;
            if (aid !== null && !assignedIds.has(aid)) continue;
            const nombre = typeof raw.nombre === "string" ? raw.nombre : id;
            if (!byId.has(id)) byId.set(id, { id, nombre, es_predeterminado: false });
          }
        }
        let pred: { id?: unknown; nombre?: string } | null = null;
        try {
          pred = await apiService.getFlujoPredeterminado(effectiveAreaId);
        } catch {
          try {
            pred = await apiService.getFlujoPredeterminado();
          } catch {
            pred = null;
          }
        }
        if (pred?.id) {
          const id = String(pred.id);
          const cur = byId.get(id);
          const nombre = typeof pred.nombre === "string" ? pred.nombre : cur?.nombre || id;
          byId.set(id, { id, nombre, es_predeterminado: true });
        }
        const list = Array.from(byId.values()).sort((a, b) => {
          if (a.es_predeterminado !== b.es_predeterminado) return a.es_predeterminado ? -1 : 1;
          return a.nombre.localeCompare(b.nombre, "es");
        });
        if (!cancelled) setOtroFlujoOpciones(list);
      } catch {
        if (!cancelled) setOtroFlujoOpciones([]);
      } finally {
        if (!cancelled) setOtroFlujoLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [otroOpen, effectiveAreaId, flows, assignedAreas]);

  useEffect(() => {
    if (!otroOpen) return;
    setOtroLoadingCatalogos(true);
    apiService
      .getPlantillas(true)
      .then((data: unknown) => {
        const arr = Array.isArray(data) ? data : [];
        setOtroCatalogTipos(
          arr.map((t: { id: unknown; nombre?: string; name?: string; tipo?: string }) => ({
            id: String(t.id),
            nombre: t.nombre || t.name || String(t.id),
            tipo: String(t.tipo ?? "").toLowerCase(),
          }))
        );
      })
      .catch(() => setOtroCatalogTipos([]))
      .finally(() => setOtroLoadingCatalogos(false));
  }, [otroOpen]);

  useEffect(() => {
    if (!otroOpen || !otroTipoCatalogId) {
      setOtroCatalogCategorias([]);
      setOtroCatalogPlantillas([]);
      setOtroCategoriaCatalogId("");
      setOtroPlantillaCatalogId("");
      return;
    }
    const sel = otroCatalogTipos.find((x) => x.id === otroTipoCatalogId);
    const esEditor = (sel?.tipo ?? "").toLowerCase() === "editor";
    setOtroLoadingCatalogos(true);
    if (esEditor) {
      setOtroCatalogCategorias([]);
      setOtroCategoriaCatalogId("");
      apiService
        .getPlantillasDocumento(otroTipoCatalogId, undefined, true)
        .then((plants: unknown) => {
          const arr = Array.isArray(plants) ? plants : [];
          setOtroCatalogPlantillas(
            arr.map((p: { id: unknown; nombre?: string; name?: string }) => ({
              id: String(p.id),
              nombre: p.nombre || p.name || String(p.id),
            }))
          );
        })
        .catch(() => setOtroCatalogPlantillas([]))
        .finally(() => setOtroLoadingCatalogos(false));
    } else {
      setOtroCatalogPlantillas([]);
      setOtroPlantillaCatalogId("");
      apiService
        .getCategoriasDocumento(otroTipoCatalogId, true)
        .then((cats: unknown) => {
          const arr = Array.isArray(cats) ? cats : [];
          setOtroCatalogCategorias(
            arr.map((c: { id: unknown; nombre?: string; name?: string }) => ({
              id: String(c.id),
              nombre: c.nombre || c.name || String(c.id),
            }))
          );
        })
        .catch(() => setOtroCatalogCategorias([]))
        .finally(() => setOtroLoadingCatalogos(false));
    }
  }, [otroOpen, otroTipoCatalogId, otroCatalogTipos]);

  const handleOtroConfirm = async () => {
    if (!otroTipoCatalogId) {
      swalWarning("Selecciona el tipo de documento.");
      return;
    }
    if (otroTipoEsEditor && otroExternalFile && !otroPlantillaCatalogId) {
      swalWarning("Selecciona una plantilla para documentos de tipo editor.");
      return;
    }

    if (otroLegacyFile) {
      if (otroLegacyFile.estado_revision === "clasificado") {
        swalInfo("Este archivo ya fue importado.");
        return;
      }
      const flujoSel = otroFlujoId ? otroFlujoOpciones.find((x) => x.id === otroFlujoId) : null;
      if (otroFlujoId) writeLastOtroFlujoId(siniestroId, effectiveAreaId, otroFlujoId);
      setDrafts((current) => ({
        ...current,
        [otroLegacyFile.id]: {
          file_id: otroLegacyFile.id,
          legacy_file_id: otroLegacyFile.legacy_file_id,
          flujo_trabajo_id: otroFlujoId || null,
          etapa_flujo_id: null,
          category_key: LEGACY_CATALOGO_BUCKET_KEY,
          categoria_documento_id: otroCategoriaCatalogId || null,
          tipo_documento_id: otroTipoCatalogId,
          requisito_documento_id: null,
          flujo_display_name: flujoSel?.nombre ?? null,
        },
      }));
      setSelectedFileId("");
      closeOtroModal(false);
      setSelectedTarget(null);
      return;
    }

    if (otroExternalFile) {
      setOtroSaving(true);
      try {
        if (otroFlujoId) writeLastOtroFlujoId(siniestroId, effectiveAreaId, otroFlujoId);
        await apiService.uploadDocumento(siniestroId, otroExternalFile, {
          descripcion: otroDescripcion.trim() || undefined,
          area_id: effectiveAreaId,
          flujo_trabajo_id: otroFlujoId || undefined,
          tipo_documento_id: otroTipoCatalogId,
          plantilla_documento_id: otroTipoEsEditor && otroPlantillaCatalogId ? otroPlantillaCatalogId : undefined,
        });
        await swalSuccess("Archivo subido correctamente.");
        closeOtroModal(true);
        if (onFinalized) await onFinalized();
        await loadAll(effectiveAreaId);
      } catch (error: any) {
        swalError(error?.response?.data?.detail || error?.message || "No se pudo subir el archivo.");
      } finally {
        setOtroSaving(false);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragFileId(null);
    const file = files.find((item) => item.id === String(event.active.id));
    const target = parseDropId(event.over?.id ? String(event.over.id) : null);
    if (!file || !target) return;
    const flow = flows.find((item) => item.id === target.flowId);
    if (!flow) return;

    if (target.categoryKey === OTRO_DROP_KEY) {
      if (file.estado_revision === "clasificado") {
        swalInfo("Este archivo ya fue importado.");
        return;
      }
      openOtroModal(flow, file, null);
      return;
    }

    const category = flow.categorias.find((item) => item.clave === target.categoryKey);
    if (!category) return;
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
                          onClick={() => {
                            setEffectiveAreaId(area.id);
                            onEffectiveAreaChange?.(area.id);
                          }}
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
                  {activeFlow && (
                    <OtroCategoryCard
                      flow={activeFlow}
                      active={
                        selectedTarget?.flowId === activeFlow.id &&
                        selectedTarget?.categoryKey === OTRO_DROP_KEY
                      }
                      onAssignSelected={() => {
                        if (!selectedFile) {
                          swalInfo(
                            "Selecciona un archivo en la lista o arrastra un archivo desde tu equipo a la zona «Otro».",
                          );
                          return;
                        }
                        if (selectedFile.estado_revision === "clasificado") {
                          swalInfo("Este archivo ya fue importado.");
                          return;
                        }
                        openOtroModal(activeFlow, selectedFile, null);
                      }}
                      onNativeFileDrop={(file) => openOtroModal(activeFlow, null, file)}
                    />
                  )}
                  {(assignedFilesByCategory.get(LEGACY_CATALOGO_BUCKET_KEY) || []).length > 0 ? (
                    <div className="sm:col-span-2 xl:col-span-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                      <h4 className="font-semibold text-emerald-900">Catálogo manual (sin etapa en flujo)</h4>
                      <p className="mt-1 text-xs text-emerald-800/90">
                        Tipo y categoría desde el catálogo general; sin etapa ni requisitos. Si indicaste un flujo, el documento queda
                        asociado a ese flujo al importar.
                      </p>
                      <div className="mt-3 space-y-2">
                        {(assignedFilesByCategory.get(LEGACY_CATALOGO_BUCKET_KEY) || []).map((file) => {
                          const d = drafts[file.id];
                          const flujoNombre =
                            d?.flujo_trabajo_id != null && d.flujo_trabajo_id !== ""
                              ? d.flujo_display_name || flowNombrePorId.get(d.flujo_trabajo_id) || null
                              : null;
                          return (
                            <div key={file.id}>
                              <DraggableFileRow
                                file={file}
                                selected={false}
                                onPreview={() => handlePreview(file)}
                                onClear={() => handleClearDraft(file.id)}
                              />
                              {flujoNombre ? (
                                <p className="mt-1 pl-1 text-xs text-emerald-900/85">Flujo: {flujoNombre}</p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {(activeFlow?.categorias || []).length === 0 && activeFlow && (
                    <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:col-span-2 xl:col-span-3">
                      No hay categorías predefinidas en este flujo. Usa «Otro» para elegir categoría y tipo manualmente.
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

      <Modal
        open={otroOpen}
        onClose={() => !otroSaving && closeOtroModal(true)}
        title="Clasificación manual — Otro"
        maxWidthClass="max-w-lg"
        contentClassName="p-4 sm:p-6"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Elige el <strong>tipo de documento</strong> desde el catálogo general y, si aplica, la <strong>categoría</strong> o la{" "}
            <strong>plantilla</strong> (editor). Opcionalmente puedes <strong>vincular un flujo</strong> del siniestro (incluido el
            predeterminado) <strong>sin elegir etapa</strong>. No se usan requisitos de etapa; el área efectiva se aplica al finalizar o
            al subir.
          </p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-medium text-slate-500">Archivo</p>
            <p className="break-all text-sm font-semibold text-slate-900">
              {otroLegacyFile?.nombre_archivo || otroExternalFile?.name || "—"}
            </p>
            {otroExternalFile ? (
              <p className="mt-1 text-xs text-slate-500">
                {(otroExternalFile.size / 1024).toFixed(1)} KB
              </p>
            ) : null}
          </div>

          <CustomSelect
            label="Flujo (opcional)"
            name="otro_flujo_catalogo"
            value={otroFlujoId}
            onChange={(val) => setOtroFlujoId(typeof val === "string" ? val : "")}
            options={[
              { value: "", label: "Sin vincular a flujo (solo catálogo)" },
              ...otroFlujoOpciones.map((f) => ({
                value: f.id,
                label: f.es_predeterminado ? `${f.nombre} (predeterminado)` : f.nombre,
              })),
            ]}
            placeholder={otroFlujoLoading ? "Cargando flujos…" : "Seleccionar flujo…"}
            disabled={otroSaving || otroFlujoLoading}
            isClearable
            usePortal
          />

          <CustomSelect
            label="Tipo de documento"
            name="otro_tipo_catalogo"
            value={otroTipoCatalogId}
            onChange={(val) => {
              const v = typeof val === "string" ? val : "";
              setOtroTipoCatalogId(v);
              setOtroCategoriaCatalogId("");
              setOtroPlantillaCatalogId("");
            }}
            options={otroCatalogTipos.map((t) => ({
              value: t.id,
              label: `${t.nombre}${
                t.tipo === "pdf"
                  ? " (PDF)"
                  : t.tipo === "editor"
                    ? " (Editor)"
                    : t.tipo === "imagen"
                      ? " (Imagen)"
                      : ""
              }`,
            }))}
            placeholder="Seleccionar tipo…"
            required
            disabled={otroSaving || otroCatalogTipos.length === 0}
            isClearable
            usePortal
          />

          {!otroTipoEsEditor && otroTipoCatalogId ? (
            <CustomSelect
              label="Categoría (opcional)"
              name="otro_cat_catalogo"
              value={otroCategoriaCatalogId}
              onChange={(val) => {
                setOtroCategoriaCatalogId(typeof val === "string" ? val : "");
              }}
              options={otroCatalogCategorias.map((c) => ({
                value: c.id,
                label: c.nombre,
              }))}
              placeholder="Todas las categorías"
              disabled={otroSaving || otroLoadingCatalogos}
              isClearable
              usePortal
            />
          ) : null}

          {otroTipoEsEditor && otroTipoCatalogId ? (
            <CustomSelect
              label="Plantilla"
              name="otro_plantilla_catalogo"
              value={otroPlantillaCatalogId}
              onChange={(val) => setOtroPlantillaCatalogId(typeof val === "string" ? val : "")}
              options={otroCatalogPlantillas.map((p) => ({
                value: p.id,
                label: p.nombre,
              }))}
              placeholder="Seleccionar plantilla…"
              required
              disabled={otroSaving || otroLoadingCatalogos}
              isClearable
              usePortal
            />
          ) : null}

          {otroExternalFile ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Descripción (opcional)</label>
              <input
                type="text"
                value={otroDescripcion}
                onChange={(e) => setOtroDescripcion(e.target.value)}
                disabled={otroSaving}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ej: documento adicional no listado en legacy"
              />
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => closeOtroModal(true)} disabled={otroSaving}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => handleOtroConfirm()}
              disabled={
                otroSaving ||
                (!otroLegacyFile && !otroExternalFile) ||
                !otroTipoCatalogId ||
                (otroTipoEsEditor && !!otroExternalFile && !otroPlantillaCatalogId)
              }
            >
              {otroSaving ? "Guardando…" : otroLegacyFile ? "Asignar" : "Subir archivo"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
