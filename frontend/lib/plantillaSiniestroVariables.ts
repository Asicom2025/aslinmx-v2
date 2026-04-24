import type { Siniestro } from "@/types/siniestros";

/** Contacto asegurado para placeholders de plantillas / PDF. */
export type AseguradoContactoPlantilla = {
  telefono?: string | null;
  tel_oficina?: string | null;
  tel_casa?: string | null;
  correo?: string | null;
};

/** Escapa la clave de un placeholder para usarla dentro de un `RegExp`. */
export function escapePlaceholderKeyForRegex(key: string): string {
  return key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Variables estándar para plantillas / informes / PDF / Jodit:
 * {{poliza_principal_numero}}, {{institucion}}, {{tercero}}, {{autoridad}},
 * {{celular}}, {{correo_electrónico}} (y alias ASCII en correo),
 * {{id}}, {{ID}}, {{numero_de_reporte}}, {{numero_de_siniestro}}, {{calificacion}}.
 */
export function buildCatalogoInformePlaceholders(input: {
  siniestroData: Siniestro | null;
  polizaPrincipalNumero: string;
  institucionNombre: string;
  autoridadNombre: string;
  aseguradoContact?: AseguradoContactoPlantilla | null;
  idLegible: string;
  numeroReporte: string;
  numeroSiniestro: string | number | null | undefined;
  calificacionNombre: string;
}): Record<string, string> {
  const terceroRaw = input.siniestroData?.tercero;
  const tercero =
    terceroRaw != null && String(terceroRaw).trim()
      ? String(terceroRaw).trim()
      : "";
  const ac = input.aseguradoContact || {};
  const cel =
    [ac.telefono, ac.tel_oficina, ac.tel_casa]
      .map((s) => (s != null ? String(s).trim() : ""))
      .find((s) => s.length > 0) || "";
  const corr = ac.correo != null ? String(ac.correo).trim() : "";
  const np = (input.polizaPrincipalNumero || "").trim();
  const idl = (input.idLegible || "").trim();
  const nr = (input.numeroReporte || "").trim();
  const ns =
    input.numeroSiniestro != null && input.numeroSiniestro !== ""
      ? String(input.numeroSiniestro).trim()
      : "";
  const cal = (input.calificacionNombre || "").trim();
  return {
    poliza_principal_numero: np,
    institucion: (input.institucionNombre || "").trim(),
    tercero,
    autoridad: (input.autoridadNombre || "").trim(),
    celular: cel,
    "correo_electrónico": corr,
    correo_electronico: corr,
    id: idl,
    ID: idl,
    numero_de_reporte: nr,
    numero_de_siniestro: ns,
    calificacion: cal,
  };
}
