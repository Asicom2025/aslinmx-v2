import apiService from "@/lib/apiService";
import { normalizeGeoText } from "@/lib/geoTextNormalize";

export type GeoIdsPayload = {
  pais_id: string | null;
  estado_geografico_id: string | null;
  municipio_id: string | null;
};

const empty: GeoIdsPayload = {
  pais_id: null,
  estado_geografico_id: null,
  municipio_id: null,
};

/**
 * Intenta mapear textos de Google (o captura manual) a IDs del catálogo geo.
 * Si no hay coincidencia, devuelve null en los IDs correspondientes (dirección no catalogada).
 */
export async function matchGeoIdsFromAddressTexts(input: {
  paisNombre?: string;
  estadoNombre?: string;
  municipioNombre?: string;
}): Promise<GeoIdsPayload> {
  try {
    const paises = (await apiService.getGeoPaises(true)) as Array<{
      id: string;
      codigo_iso?: string;
      nombre?: string;
    }>;
    if (!Array.isArray(paises) || !paises.length) return empty;

    const pn = normalizeGeoText(input.paisNombre);
    let pais =
      paises.find((p) => (p.codigo_iso || "").toUpperCase() === "MX") || paises[0];
    if (pn && !/^(mexico|méxico|mx)$/.test(pn)) {
      const found = paises.find(
        (p) =>
          normalizeGeoText(p.nombre) === pn ||
          normalizeGeoText(p.nombre).includes(pn) ||
          pn.includes(normalizeGeoText(p.nombre)),
      );
      if (found) pais = found;
    }
    if (!pais?.id) return empty;

    const estados = (await apiService.getGeoEstados(pais.id, true)) as Array<{
      id: string;
      nombre?: string;
    }>;
    const en = normalizeGeoText(input.estadoNombre);
    if (!en) return { pais_id: pais.id, estado_geografico_id: null, municipio_id: null };

    const est =
      estados.find((e) => normalizeGeoText(e.nombre) === en) ||
      estados.find(
        (e) =>
          en.includes(normalizeGeoText(e.nombre)) ||
          normalizeGeoText(e.nombre).includes(en),
      );
    if (!est?.id) return { pais_id: pais.id, estado_geografico_id: null, municipio_id: null };

    const mn = normalizeGeoText(input.municipioNombre);
    if (!mn) return { pais_id: pais.id, estado_geografico_id: est.id, municipio_id: null };

    const municipios = (await apiService.getGeoMunicipios(
      est.id,
      input.municipioNombre?.trim().slice(0, 80) || undefined,
      true,
      200,
      0,
    )) as Array<{ id: string; nombre?: string }>;

    const mu =
      municipios.find((m) => normalizeGeoText(m.nombre) === mn) ||
      municipios.find(
        (m) =>
          normalizeGeoText(m.nombre).includes(mn) || mn.includes(normalizeGeoText(m.nombre)),
      );

    return {
      pais_id: pais.id,
      estado_geografico_id: est.id,
      municipio_id: mu?.id || null,
    };
  } catch {
    return empty;
  }
}
