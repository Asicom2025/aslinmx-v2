"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import JoditEditor from "@/components/ui/JoditEditor";
import apiService from "@/lib/apiService";
import { formatCurrency, parseCurrency } from "@/lib/formatUtils";
import type { CampoFormulario, TipoCampo, TamanoCampo } from "./FormularioDesigner";

/** Contenido vacío típico de Jodit/HTML (p. ej. `<p><br></p>`). */
function isCampoRequeridoVacio(campo: CampoFormulario, raw: string | number | undefined): boolean {
  if (campo.tipo === "html") {
    const s = raw !== undefined && raw !== null ? String(raw) : "";
    const plain = s
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\u00a0/g, " ")
      .trim();
    return plain.length === 0;
  }
  if (raw === undefined || raw === null) return true;
  return String(raw).trim() === "";
}

interface FormularioContinuacionModalProps {
  open: boolean;
  onClose: () => void;
  plantillaId: string;
  plantillaNombre?: string;
  siniestroId: string;
  areaId?: string;
  onSaved?: () => void;
  empresaColors?: { primary: string; secondary: string };
}

const TAMANO_CLASS: Record<TamanoCampo, string> = {
  full: "col-span-12",
  half: "col-span-12 sm:col-span-6",
  third: "col-span-12 sm:col-span-4",
};

export default function FormularioContinuacionModal({
  open,
  onClose,
  plantillaId,
  plantillaNombre,
  siniestroId,
  areaId,
  onSaved,
  empresaColors = { primary: "#4F46E5", secondary: "#7C3AED" },
}: FormularioContinuacionModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [campos, setCampos] = useState<CampoFormulario[]>([]);
  const [valores, setValores] = useState<Record<string, string | number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !plantillaId || !siniestroId) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [plantilla, respuesta] = await Promise.all([
          apiService.getPlantillaDocumentoById(plantillaId),
          apiService.getRespuestaFormulario(plantillaId, siniestroId, areaId).catch(() => null),
        ]);

        const camposForm = (plantilla?.campos_formulario || []) as CampoFormulario[];
        if (!camposForm.length) {
          setError("Esta plantilla no tiene formulario de continuación configurado.");
          setCampos([]);
          setValores({});
          return;
        }

        setCampos(camposForm.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)));
        setValores((respuesta?.valores as Record<string, string | number>) || {});
      } catch (e: any) {
        setError(e.response?.data?.detail || "Error al cargar el formulario.");
        setCampos([]);
        setValores({});
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, plantillaId, siniestroId, areaId]);

  const handleChange = (clave: string, value: string | number) => {
    setValores((prev) => ({ ...prev, [clave]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const requeridos = campos.filter((c) => c.requerido);
    for (const c of requeridos) {
      const v = valores[c.clave];
      if (isCampoRequeridoVacio(c, v)) {
        setError(`El campo "${c.titulo}" es obligatorio.`);
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      await apiService.upsertRespuestaFormulario(
        plantillaId,
        siniestroId,
        valores as Record<string, unknown>,
        areaId,
      );
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.detail || "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const renderField = (campo: CampoFormulario) => {
    const value = valores[campo.clave];
    const valStr = value !== undefined && value !== null ? String(value) : "";
    const commonProps = {
      name: campo.clave,
      label: campo.titulo,
      placeholder: campo.placeholder || "",
      value: valStr,
      required: !!campo.requerido,
    };

    const onChange = (v: string | number) => handleChange(campo.clave, v);

    switch (campo.tipo as TipoCampo) {
      case "number":
        return (
          <Input
            key={campo.clave}
            {...commonProps}
            type="number"
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "currency": {
        const rawVal = valores[campo.clave];
        const displayVal = rawVal !== undefined && rawVal !== null && rawVal !== ""
          ? formatCurrency(rawVal)
          : "";
        return (
          <Input
            key={campo.clave}
            name={campo.clave}
            label={campo.titulo}
            placeholder={campo.placeholder || "0.00"}
            value={displayVal}
            required={!!campo.requerido}
            type="text"
            onChange={(e) => onChange(parseCurrency(e.target.value))}
          />
        );
      }
      case "date":
        return (
          <Input
            key={campo.clave}
            {...commonProps}
            type="date"
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "datetime":
        return (
          <Input
            key={campo.clave}
            {...commonProps}
            type="datetime-local"
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "email":
        return (
          <Input
            key={campo.clave}
            {...commonProps}
            type="email"
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "tel":
        return (
          <Input
            key={campo.clave}
            {...commonProps}
            type="tel"
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "textarea":
        return (
          <div key={campo.clave} className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {campo.titulo} {campo.requerido && "*"}
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder={campo.placeholder || ""}
              value={valStr}
              onChange={(e) => onChange(e.target.value)}
              rows={3}
              required={!!campo.requerido}
            />
          </div>
        );
      case "html":
        return (
          <div key={campo.clave} className="space-y-1 min-w-0">
            <JoditEditor
              label={`${campo.titulo}${campo.requerido ? " *" : ""}`}
              value={valStr}
              onChange={(v) => onChange(v)}
              placeholder={campo.placeholder || "Escribe el contenido…"}
              height={300}
            />
          </div>
        );
      case "select":
        return (
          <div key={campo.clave} className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {campo.titulo} {campo.requerido && "*"}
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
              value={valStr}
              onChange={(e) => onChange(e.target.value)}
              required={!!campo.requerido}
            >
              <option value="">Seleccionar...</option>
              {(campo.opciones || []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        );
      default:
        return (
          <Input
            key={campo.clave}
            {...commonProps}
            type="text"
            onChange={(e) => onChange(e.target.value)}
          />
        );
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={plantillaNombre ? `Formulario de continuación: ${plantillaNombre}` : "Formulario de continuación"}
      maxWidthClass="max-w-2xl"
    >
      {loading ? (
        <div className="py-8 text-center text-gray-500">Cargando formulario...</div>
      ) : error && !campos.length ? (
        <div className="py-4 text-red-600 bg-red-50 rounded-lg px-4">{error}</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-red-600 bg-red-50 rounded-lg px-4 py-2 text-sm">{error}</div>
          )}
          <p className="text-sm text-gray-600">
            Completa los datos que se usarán en el documento de continuación de la plantilla.
          </p>
          <div className="grid grid-cols-12 gap-4">
            {campos.map((campo) => (
              <div key={campo.clave} className={TAMANO_CLASS[campo.tamano as TamanoCampo] || TAMANO_CLASS.full}>
                {renderField(campo)}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              style={saving ? undefined : { backgroundColor: empresaColors.primary }}
            >
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
