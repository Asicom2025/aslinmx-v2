"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiUpload,
  FiFileText,
  FiChevronDown,
  FiChevronRight,
  FiCheck,
  FiClock,
  FiAlertCircle,
  FiRefreshCw,
} from "react-icons/fi";
import Button from "@/components/ui/Button";
import apiService from "@/lib/apiService";
import type { ChecklistItem, EstadoRequisito, RequisitoDocumento } from "@/types/flujosTrabajo";

// ─────────────────────────────────────────────────────────────
// Helpers de estado
// ─────────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<
  EstadoRequisito,
  { label: string; colorClass: string; icon: React.ReactNode }
> = {
  pendiente: {
    label: "Pendiente",
    colorClass: "bg-red-100 text-red-700 border-red-200",
    icon: <FiClock className="w-3 h-3" />,
  },
  opcional: {
    label: "Opcional",
    colorClass: "bg-gray-100 text-gray-600 border-gray-200",
    icon: <FiAlertCircle className="w-3 h-3" />,
  },
  cargado: {
    label: "Cargado",
    colorClass: "bg-blue-100 text-blue-700 border-blue-200",
    icon: <FiUpload className="w-3 h-3" />,
  },
  generado: {
    label: "Generado",
    colorClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: <FiFileText className="w-3 h-3" />,
  },
  completo: {
    label: "Completo",
    colorClass: "bg-green-100 text-green-700 border-green-200",
    icon: <FiCheck className="w-3 h-3" />,
  },
};

function EstadoBadge({ estado }: { estado: EstadoRequisito }) {
  const cfg = ESTADO_CONFIG[estado] ?? ESTADO_CONFIG.pendiente;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.colorClass}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Fila de requisito
// ─────────────────────────────────────────────────────────────

interface RequisitoRowProps {
  item: ChecklistItem;
  siniestroId: string;
  areaId?: string;
  flujoTrabajoId?: string;
  onUpload: (requisito: RequisitoDocumento, file: File) => Promise<void>;
  onGenerar: (requisito: RequisitoDocumento) => void;
  onRefresh: () => void;
}

function RequisitoRow({
  item,
  siniestroId,
  areaId,
  flujoTrabajoId,
  onUpload,
  onGenerar,
  onRefresh,
}: RequisitoRowProps) {
  const { requisito, documentos, estado } = item;
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(requisito, file);
      onRefresh();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Cabecera del requisito */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Expand toggle */}
        <button
          type="button"
          className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Colapsar" : "Expandir"}
        >
          {expanded ? (
            <FiChevronDown className="w-4 h-4" />
          ) : (
            <FiChevronRight className="w-4 h-4" />
          )}
        </button>

        {/* Nombre */}
        <span className="flex-1 text-sm font-medium text-gray-800 truncate">
          {requisito.nombre_documento}
        </span>

        {/* Obligatorio/opcional badge */}
        <span
          className={`text-xs px-1.5 py-0.5 rounded border ${
            requisito.es_obligatorio
              ? "bg-orange-50 text-orange-600 border-orange-200"
              : "bg-gray-50 text-gray-500 border-gray-200"
          }`}
        >
          {requisito.es_obligatorio ? "Obligatorio" : "Opcional"}
        </span>

        {/* Estado */}
        <EstadoBadge estado={estado} />

        {/* Acciones */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {requisito.permite_upload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Subir archivo"
              >
                <FiUpload className="w-3.5 h-3.5" />
                <span className="ml-1 hidden sm:inline">
                  {uploading ? "Subiendo…" : "Subir"}
                </span>
              </Button>
            </>
          )}
          {requisito.permite_generar && requisito.plantilla_documento_id && (
            <Button
              variant="primary"
              size="sm"
              type="button"
              onClick={() => onGenerar(requisito)}
              title="Generar desde plantilla"
            >
              <FiFileText className="w-3.5 h-3.5" />
              <span className="ml-1 hidden sm:inline">Generar</span>
            </Button>
          )}
        </div>
      </div>

      {/* Panel expandido: lista de documentos */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-2">
          {documentos.length === 0 ? (
            <p className="text-xs text-gray-500 italic py-1">
              Sin documentos cargados para este requisito.
            </p>
          ) : (
            <ul className="space-y-1">
              {documentos.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between text-xs text-gray-700 bg-white border border-gray-200 rounded px-2 py-1"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    {doc.contenido ? (
                      <FiFileText className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <FiUpload className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    )}
                    <span className="truncate">{doc.nombre_archivo}</span>
                    <span className="text-gray-400 flex-shrink-0">v{doc.version}</span>
                  </span>
                  <span className="text-gray-400 flex-shrink-0 ml-2">
                    {doc.creado_en ? new Date(doc.creado_en).toLocaleDateString("es-MX") : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────

export interface ChecklistDocumentalProps {
  siniestroId: string;
  etapaId: string;
  etapaNombre?: string;
  flujoTrabajoId?: string;
  areaId?: string;
  /** Callback para abrir el modal de generación de informe del siniestro */
  onAbrirGenerarInforme?: (plantillaId: string, requisitoId: string) => void;
}

export default function ChecklistDocumental({
  siniestroId,
  etapaId,
  etapaNombre,
  flujoTrabajoId,
  areaId,
  onAbrirGenerarInforme,
}: ChecklistDocumentalProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getChecklistEtapa(siniestroId, etapaId);
      setChecklist(data ?? []);
    } catch (err: unknown) {
      setError("No se pudo cargar el checklist documental.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [siniestroId, etapaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleUpload = async (requisito: RequisitoDocumento, file: File) => {
    await apiService.uploadDocumento(siniestroId, file, {
      area_id: areaId,
      flujo_trabajo_id: flujoTrabajoId,
      etapa_flujo_id: etapaId,
      requisito_documento_id: requisito.id,
      descripcion: `Documento para requisito: ${requisito.nombre_documento}`,
    });
  };

  const handleGenerar = (requisito: RequisitoDocumento) => {
    if (requisito.plantilla_documento_id && onAbrirGenerarInforme) {
      onAbrirGenerarInforme(requisito.plantilla_documento_id, requisito.id);
    }
  };

  const pendientes = checklist.filter((i) => i.estado === "pendiente").length;
  const completados = checklist.filter((i) =>
    ["cargado", "generado", "completo"].includes(i.estado)
  ).length;
  const total = checklist.length;

  return (
    <div className="mt-3 space-y-2">
      {/* Cabecera del checklist */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Checklist documental{etapaNombre ? ` — ${etapaNombre}` : ""}
        </h4>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className="text-xs text-gray-500">
              {completados}/{total} completados
              {pendientes > 0 && (
                <span className="ml-1 text-red-500">· {pendientes} pendiente{pendientes !== 1 ? "s" : ""}</span>
              )}
            </span>
          )}
          <button
            type="button"
            onClick={cargar}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Recargar checklist"
          >
            <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Barra de progreso */}
      {total > 0 && (
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${Math.round((completados / total) * 100)}%` }}
          />
        </div>
      )}

      {/* Estados de carga / error */}
      {loading && (
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <FiRefreshCw className="w-3 h-3 animate-spin" />
          Cargando checklist…
        </p>
      )}
      {error && !loading && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <FiAlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}

      {/* Sin requisitos configurados */}
      {!loading && !error && total === 0 && (
        <p className="text-xs text-gray-400 italic">
          No hay documentos configurados para esta etapa.
        </p>
      )}

      {/* Lista de requisitos */}
      {!loading && checklist.length > 0 && (
        <div className="space-y-1.5">
          {checklist.map((item) => (
            <RequisitoRow
              key={item.requisito.id}
              item={item}
              siniestroId={siniestroId}
              areaId={areaId}
              flujoTrabajoId={flujoTrabajoId}
              onUpload={handleUpload}
              onGenerar={handleGenerar}
              onRefresh={cargar}
            />
          ))}
        </div>
      )}
    </div>
  );
}
