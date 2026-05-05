"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CustomSelect, { SelectOption } from "@/components/ui/Select";
import apiService from "@/lib/apiService";

export type GeoCascadeValue = {
  pais_id: string;
  estado_geografico_id: string;
  municipio_id: string;
};

type GeoRow = { id: string; nombre?: string; codigo_iso?: string };

type Props = {
  value: GeoCascadeValue;
  onChange: (next: GeoCascadeValue) => void;
  disabled?: boolean;
  /** Texto auxiliar bajo los selects */
  hint?: string;
};

export default function GeoCascadeSelects({
  value,
  onChange,
  disabled = false,
  hint = "Al elegir el estado se cargan los municipios del catálogo. Usa el cuadro de filtro para acotar la lista si hay muchos.",
}: Props) {
  const [paises, setPaises] = useState<GeoRow[]>([]);
  const [estados, setEstados] = useState<GeoRow[]>([]);
  const [municipios, setMunicipios] = useState<GeoRow[]>([]);
  const [munQuery, setMunQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [munLoading, setMunLoading] = useState(false);
  const prevEstadoRef = useRef<string>("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const p = (await apiService.getGeoPaises(true)) as GeoRow[];
        if (!cancel) setPaises(Array.isArray(p) ? p : []);
      } catch {
        if (!cancel) setPaises([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!value.pais_id) {
      setEstados([]);
      return;
    }
    let cancel = false;
    (async () => {
      try {
        const e = (await apiService.getGeoEstados(value.pais_id, true)) as GeoRow[];
        if (!cancel) setEstados(Array.isArray(e) ? e : []);
      } catch {
        if (!cancel) setEstados([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [value.pais_id]);

  // Al cambiar de estado: vaciar filtro y lista previa para no mostrar municipios de otro estado
  useEffect(() => {
    const id = value.estado_geografico_id || "";
    if (id !== prevEstadoRef.current) {
      prevEstadoRef.current = id;
      setMunQuery("");
      setMunicipios([]);
    }
  }, [value.estado_geografico_id]);

  // Lista de municipios: carga inmediata si no hay filtro; con debounce solo al escribir
  useEffect(() => {
    if (!value.estado_geografico_id) {
      setMunicipios([]);
      setMunLoading(false);
      return;
    }

    const q = munQuery.trim();
    const delay = q.length > 0 ? 280 : 0;

    let cancel = false;
    const t = setTimeout(async () => {
      setMunLoading(true);
      try {
        const m = (await apiService.getGeoMunicipios(
          value.estado_geografico_id,
          q || undefined,
          true,
          500,
          0,
        )) as GeoRow[];
        if (!cancel) setMunicipios(Array.isArray(m) ? m : []);
      } catch {
        if (!cancel) setMunicipios([]);
      } finally {
        if (!cancel) setMunLoading(false);
      }
    }, delay);

    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [value.estado_geografico_id, munQuery]);

  const paisOptions: SelectOption[] = useMemo(
    () =>
      paises.map((p) => ({
        value: p.id,
        label: `${p.nombre || p.id}${p.codigo_iso ? ` (${p.codigo_iso})` : ""}`,
      })),
    [paises],
  );

  const estadoOptions: SelectOption[] = useMemo(
    () => estados.map((e) => ({ value: e.id, label: e.nombre || e.id })),
    [estados],
  );

  const municipioOptions: SelectOption[] = useMemo(
    () => municipios.map((m) => ({ value: m.id, label: m.nombre || m.id })),
    [municipios],
  );

  if (loading && !paises.length) {
    return <p className="text-sm text-gray-500">Cargando catálogo geográfico…</p>;
  }

  return (
    <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50/80 p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <CustomSelect
          label="País"
          name="geo_pais_id"
          value={value.pais_id || ""}
          onChange={(v) =>
            onChange({
              pais_id: String(v || ""),
              estado_geografico_id: "",
              municipio_id: "",
            })
          }
          options={paisOptions}
          placeholder="—"
          disabled={disabled}
          usePortal={false}
        />
        <CustomSelect
          label="Estado"
          name="geo_estado_id"
          value={value.estado_geografico_id || ""}
          onChange={(v) =>
            onChange({
              ...value,
              estado_geografico_id: String(v || ""),
              municipio_id: "",
            })
          }
          options={estadoOptions}
          placeholder={value.pais_id ? "—" : "Elige país"}
          disabled={disabled || !value.pais_id}
          usePortal={false}
        />
        <div>
          <CustomSelect
            label="Municipio"
            name="geo_municipio_id"
            value={value.municipio_id || ""}
            onChange={(v) =>
              onChange({
                ...value,
                municipio_id: String(v || ""),
              })
            }
            options={municipioOptions}
            placeholder={
              !value.estado_geografico_id
                ? "Elige estado"
                : munLoading
                  ? "Cargando municipios…"
                  : municipioOptions.length
                    ? "—"
                    : "Sin resultados"
            }
            disabled={disabled || !value.estado_geografico_id}
            usePortal={false}
          />
        </div>
      </div>
    </div>
  );
}
