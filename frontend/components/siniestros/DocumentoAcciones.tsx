"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";
import { FiEdit3, FiEye, FiFile, FiMail, FiSave, FiMoreVertical, FiTrash2 } from "react-icons/fi";

export type DocumentoEmpresaColors = {
  primary: string;
  secondary: string;
  tertiary: string;
};

type TablaFilaProps = {
  variant: "tabla-fila";
  documento: Record<string, unknown> & { id?: string; contenido?: unknown; ruta_archivo?: string };
  empresaColors: DocumentoEmpresaColors;
  onViewDocument: (documento: unknown) => void;
  onEditDocument?: (documento: unknown) => void;
  onSendByEmail?: (documento: unknown) => void;
  onDownloadDocument?: (documento: unknown) => void;
  onDownloadInforme?: (documento: unknown) => void;
  /** Eliminación lógica (oculta en listados; el registro permanece en BD). */
  onDeleteDocument?: (documento: unknown) => void;
};

export type DocumentoModalPreviewAccionesProps = {
  variant: "modal-preview";
  /** informe: PDF generado; archivo: subido desde API */
  kind: "informe" | "archivo";
  documento: { id?: string } | null;
  showEditar?: boolean;
  canDescargar?: boolean;
  descargarLabel: string;
  onCerrar: () => void;
  onDescargar: () => void;
  onEnviar: () => void;
  onEditar?: () => void;
};

export type DocumentoAccionesProps = TablaFilaProps | DocumentoModalPreviewAccionesProps;

/**
 * Acciones de documento: fila de tabla (detalle siniestro) o pie del modal de vista previa.
 * Replica estilos y comportamiento para mantener consistencia.
 */
export function DocumentoAcciones(props: DocumentoAccionesProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  useEffect(() => {
    if (!menuOpen) return;

    const onDocumentMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      // No cerrar si el click fue en el trigger o dentro del menú.
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, [menuOpen]);

  useLayoutEffect(() => {
    if (!menuOpen) return;
    const btn = triggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setMenuCoords({
      top: rect.bottom + 6,
      left: rect.left,
    });
  }, [menuOpen]);

  if (props.variant === "tabla-fila") {
    const {
      documento,
      empresaColors,
      onViewDocument,
      onEditDocument,
      onSendByEmail,
      onDownloadDocument,
      onDownloadInforme,
      onDeleteDocument,
    } = props;
    const plantillaDocId = (documento as any).plantilla_documento_id;
    const rutaArchivo = (documento as any).ruta_archivo;

    // "Informe" (HTML con plantilla) vs "Archivo subido"
    // En la tabla, un "informe" suele venir con `contenido` (HTML).
    // No siempre garantizamos que venga también `plantilla_documento_id` en el objeto agrupado,
    // así que para mostrar Editar/Enviar/Ver basamos el tipo únicamente en `contenido`.
    const esInforme = !!(documento as any).contenido;
    const tieneRutaArchivo = !!rutaArchivo;

    const tieneId = !!(documento as any).id;
    const puedeDescargarArchivo = !!onDownloadDocument && tieneId && tieneRutaArchivo;
    const puedeDescargarInforme = !!onDownloadInforme && tieneId && !!plantillaDocId;

    const items: Array<{
      key: string;
      label: string;
      icon: any;
      disabled?: boolean;
      action?: () => void;
    }> = [];

    // Comunes
    items.push({
      key: "ver",
      label: "Ver",
      icon: <FiEye className="w-4 h-4" />,
      disabled: false,
      action: () => onViewDocument(documento),
    });

    if (esInforme) {
      items.push({
        key: "editar",
        label: "Editar",
        icon: <FiEdit3 className="w-4 h-4" />,
        disabled: !onEditDocument,
        action: () => onEditDocument?.(documento),
      });
      items.push({
        key: "enviar",
        label: "Enviar",
        icon: <FiMail className="w-4 h-4" />,
        disabled: !onSendByEmail,
        action: () => onSendByEmail?.(documento),
      });
      items.push({
        key: "descargar",
        label: "Descargar PDF",
        icon: <FiFile className="w-4 h-4" />,
        disabled: !puedeDescargarInforme,
        action: () => onDownloadInforme?.(documento),
      });
      if (onDeleteDocument && tieneId) {
        items.push({
          key: "eliminar",
          label: "Eliminar del expediente",
          icon: <FiTrash2 className="w-4 h-4 text-red-600" />,
          action: () => onDeleteDocument(documento),
        });
      }
    } else {
      items.push({
        key: "descargar",
        label: "Descargar",
        icon: <FiFile className="w-4 h-4" />,
        disabled: !puedeDescargarArchivo,
        action: () => onDownloadDocument?.(documento),
      });
      items.push({
        key: "enviar",
        label: "Enviar",
        icon: <FiMail className="w-4 h-4" />,
        disabled: !onSendByEmail,
        action: () => onSendByEmail?.(documento),
      });
      if (onDeleteDocument && tieneId) {
        items.push({
          key: "eliminar",
          label: "Eliminar del expediente",
          icon: <FiTrash2 className="w-4 h-4 text-red-600" />,
          action: () => onDeleteDocument(documento),
        });
      }
    }

    const canRender = items.some((it) => !it.disabled);
    if (!canRender) {
      return <span className="text-xs text-gray-400">Sin contenido</span>;
    }

    return (
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((prev) => !prev);
          }}
          className="flex items-center justify-center"
          title="Acciones"
          aria-label="Acciones de documento"
          ref={triggerRef}
        >
          <FiMoreVertical className="w-4 h-4" />
        </button>

        {menuOpen &&
          createPortal(
            <div
              ref={menuRef}
              className="w-56 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
              style={{
                position: "fixed",
                top: menuCoords.top,
                left: menuCoords.left,
                zIndex: 10000,
              }}
              role="menu"
            >
              {items.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  disabled={it.disabled}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm hover:bg-gray-50 ${
                    it.disabled ? "opacity-50 cursor-not-allowed" : ""
                  } ${it.key === "eliminar" ? "text-red-700 hover:bg-red-50" : ""}`}
                  onClick={() => {
                    if (it.disabled) return;
                    it.action?.();
                    setMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  {it.icon}
                  <span>{it.label}</span>
                </button>
              ))}
            </div>,
            document.body
          )}
      </div>
    );
  }

  const {
    kind,
    documento,
    showEditar,
    canDescargar = true,
    descargarLabel,
    onCerrar,
    onDescargar,
    onEnviar,
    onEditar,
  } = props;
  const puedeEnviar = !!documento?.id;

  return (
    <div className="mt-4 flex flex-wrap justify-end gap-3">
      <Button variant="secondary" type="button" onClick={onCerrar}>
        Cerrar
      </Button>
      <Button
        variant="primary"
        type="button"
        onClick={onDescargar}
        disabled={!canDescargar}
        title={
          canDescargar
            ? descargarLabel
            : "No tiene permiso para descargar este documento"
        }
      >
        <FiSave className="w-4 h-4 mr-2" />
        {descargarLabel}
      </Button>
      <Button
        variant="success"
        type="button"
        onClick={onEnviar}
        disabled={!puedeEnviar}
        title={
          puedeEnviar
            ? "Enviar por correo"
            : "No se puede enviar: documento sin identificador"
        }
      >
        <FiMail className="w-4 h-4 mr-2" />
        Enviar
      </Button>
      {kind === "informe" && showEditar && onEditar ? (
        <Button variant="primary" type="button" onClick={onEditar}>
          <FiEdit3 className="w-4 h-4 mr-2" />
          Editar
        </Button>
      ) : null}
    </div>
  );
}
