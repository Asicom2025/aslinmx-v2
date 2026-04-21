"use client";

import { useState, useCallback } from "react";
import { FiPlus, FiTrash2, FiChevronUp, FiChevronDown, FiCopy } from "react-icons/fi";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

// ─── Tipos ───────────────────────────────────────────────────────────────────
export type TipoCampo =
  | "text"
  | "number"
  | "currency"
  | "date"
  | "datetime"
  | "email"
  | "tel"
  | "textarea"
  | "html"
  | "select";

export type TamanoCampo = "full" | "half" | "third";

export interface CampoFormulario {
  _id?: string;       // ID estable interno para el key de React (no se guarda en BD)
  clave: string;
  tipo: TipoCampo;
  titulo: string;
  placeholder: string;
  tamano: TamanoCampo;
  requerido: boolean;
  opciones: string[]; // solo para tipo "select"
  orden: number;
}

// ─── Constantes de UI ────────────────────────────────────────────────────────
const TIPOS_CAMPO: { value: TipoCampo; label: string }[] = [
  { value: "text",     label: "Texto corto" },
  { value: "textarea", label: "Texto largo" },
  { value: "html",     label: "Texto enriquecido (HTML)" },
  { value: "number",   label: "Número" },
  { value: "currency", label: "Moneda ($)" },
  { value: "date",     label: "Fecha" },
  { value: "datetime", label: "Fecha y hora" },
  { value: "email",    label: "Correo electrónico" },
  { value: "tel",      label: "Teléfono" },
  { value: "select",   label: "Lista de opciones" },
];

const TAMANOS_CAMPO: { value: TamanoCampo; label: string }[] = [
  { value: "full",  label: "Completo (100%)" },
  { value: "half",  label: "Medio (50%)" },
  { value: "third", label: "Tercio (33%)" },
];

const campoVacio = (orden: number): CampoFormulario => ({
  _id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  clave: "",
  tipo: "text",
  titulo: "",
  placeholder: "",
  tamano: "full",
  requerido: false,
  opciones: [],
  orden,
});

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 40);
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface FormularioDesignerProps {
  campos: CampoFormulario[];
  onChange: (campos: CampoFormulario[]) => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function FormularioDesigner({ campos, onChange }: FormularioDesignerProps) {
  const [opcionesInput, setOpcionesInput] = useState<Record<number, string>>({});

  const update = useCallback(
    (index: number, partial: Partial<CampoFormulario>) => {
      onChange(
        campos.map((c, i) => {
          if (i !== index) return c;
          const updated = { ...c, ...partial };
          // La clave siempre se genera automáticamente desde el título
          if (partial.titulo !== undefined) {
            updated.clave = slugify(partial.titulo) || c.clave;
          }
          return updated;
        })
      );
    },
    [campos, onChange]
  );

  const agregar = () => {
    onChange([...campos, campoVacio(campos.length)]);
  };

  const eliminar = (index: number) => {
    onChange(campos.filter((_, i) => i !== index).map((c, i) => ({ ...c, orden: i })));
  };

  const mover = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= campos.length) return;
    const arr = [...campos];
    [arr[index], arr[target]] = [arr[target], arr[index]];
    onChange(arr.map((c, i) => ({ ...c, orden: i })));
  };

  const duplicar = (index: number) => {
    const base = campos[index];
    const nuevo: CampoFormulario = {
      ...base,
      _id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      clave: base.clave ? base.clave + "_copia" : "",
      orden: campos.length,
    };
    onChange([...campos, nuevo]);
  };

  const agregarOpcion = (index: number) => {
    const texto = (opcionesInput[index] ?? "").trim();
    if (!texto) return;
    const campo = campos[index];
    update(index, { opciones: [...campo.opciones, texto] });
    setOpcionesInput((prev) => ({ ...prev, [index]: "" }));
  };

  const eliminarOpcion = (campoIdx: number, opcionIdx: number) => {
    const campo = campos[campoIdx];
    update(campoIdx, {
      opciones: campo.opciones.filter((_, i) => i !== opcionIdx),
    });
  };

  return (
    <div className="space-y-3">
      {/* Ayuda */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
        Los campos que definas aquí generarán un formulario de captura al usar la plantilla en un siniestro.
        La clave de cada campo se genera automáticamente del título (ej: <code className="bg-blue-100 rounded px-1">Sub Ramo</code> → <code className="bg-blue-100 rounded px-1">{"{{sub_ramo}}"}</code>) y puede usarse como variable en el HTML.
      </div>

      {/* Lista de campos */}
      {campos.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-300 rounded-lg">
          No hay campos. Haz clic en "Agregar campo" para comenzar.
        </p>
      ) : (
        <div className="space-y-3">
          {campos.map((campo, idx) => (
            <div
              key={campo._id ?? idx}
              className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm space-y-3"
            >
              {/* Barra de acciones del campo */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-gray-400">
                  Campo {idx + 1} — <code className="bg-gray-100 px-1 rounded">{campo.clave || "sin clave"}</code>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Subir"
                    disabled={idx === 0}
                    onClick={() => mover(idx, -1)}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                  >
                    <FiChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Bajar"
                    disabled={idx === campos.length - 1}
                    onClick={() => mover(idx, 1)}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                  >
                    <FiChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Duplicar"
                    onClick={() => duplicar(idx)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-500"
                  >
                    <FiCopy className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Eliminar campo"
                    onClick={() => eliminar(idx)}
                    className="p-1 rounded hover:bg-red-50 text-red-500"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Fila 1: Título + Tipo + Tamaño */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
                  <input
                    type="text"
                    value={campo.titulo}
                    onChange={(e) => update(idx, { titulo: e.target.value })}
                    placeholder="Ej: Número de póliza"
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                  <select
                    value={campo.tipo}
                    onChange={(e) => update(idx, { tipo: e.target.value as TipoCampo })}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    {TIPOS_CAMPO.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tamaño</label>
                  <select
                    value={campo.tamano}
                    onChange={(e) => update(idx, { tamano: e.target.value as TamanoCampo })}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    {TAMANOS_CAMPO.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fila 2: Placeholder + Requerido */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Placeholder</label>
                  <input
                    type="text"
                    value={campo.placeholder}
                    onChange={(e) => update(idx, { placeholder: e.target.value })}
                    placeholder="Texto de ayuda..."
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <input
                    type="checkbox"
                    id={`req-${idx}`}
                    checked={campo.requerido}
                    onChange={(e) => update(idx, { requerido: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor={`req-${idx}`} className="text-sm text-gray-700 cursor-pointer select-none">
                    Campo requerido
                  </label>
                </div>
              </div>

              {/* Opciones (solo select) */}
              {campo.tipo === "select" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Opciones</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {campo.opciones.map((op, oi) => (
                      <span
                        key={oi}
                        className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs rounded-full px-2.5 py-0.5"
                      >
                        {op}
                        <button
                          type="button"
                          onClick={() => eliminarOpcion(idx, oi)}
                          className="hover:text-red-500 ml-0.5"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {campo.opciones.length === 0 && (
                      <span className="text-xs text-gray-400">Sin opciones aún.</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={opcionesInput[idx] ?? ""}
                      onChange={(e) =>
                        setOpcionesInput((prev) => ({ ...prev, [idx]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          agregarOpcion(idx);
                        }
                      }}
                      placeholder="Escribe una opción y presiona Enter..."
                      className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => agregarOpcion(idx)}
                      className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300"
                    >
                      + Agregar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Botón agregar */}
      <button
        type="button"
        onClick={agregar}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg py-2.5 text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
      >
        <FiPlus className="w-4 h-4" />
        Agregar campo
      </button>
    </div>
  );
}
