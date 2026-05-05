/**
 * Carga del script de Google Maps (Places) y parseo de PlaceResult → payload de dirección.
 * Un solo punto de entrada para modal, wizard y páginas de siniestros.
 */

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

let googlePlacesPromise: Promise<void> | null = null;

export function loadGooglePlaces(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.places) {
    return Promise.resolve();
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error("Google Maps API key no configurada"));
  }

  if (!googlePlacesPromise) {
    googlePlacesPromise = new Promise((resolve, reject) => {
      const existingScript = document.getElementById("google-maps-script");
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve());
        existingScript.addEventListener("error", (error) => reject(error));
        return;
      }

      const script = document.createElement("script");
      script.id = "google-maps-script";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=es`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = (error) => reject(error);
      document.body.appendChild(script);
    });
  }

  return googlePlacesPromise;
}

export type ParsedGooglePlaceAddress = {
  direccion: string;
  colonia: string;
  municipio: string;
  ciudad: string;
  estado: string;
  codigo_postal: string;
  pais: string;
  google_place_id: string;
  latitud: number | null;
  longitud: number | null;
};

export function parseGooglePlaceToPayload(place: any): ParsedGooglePlaceAddress {
  const components = place?.address_components || [];
  const getComponent = (types: string[]) => {
    const component = components.find((item: any) =>
      types.every((type) => item.types.includes(type)),
    );
    return component ? component.long_name : "";
  };

  const loc = place?.geometry?.location;
  let lat: number | null = null;
  let lng: number | null = null;
  if (loc) {
    if (typeof loc.lat === "function") {
      lat = loc.lat();
      lng = typeof loc.lng === "function" ? loc.lng() : null;
    } else {
      lat = loc.lat ?? null;
      lng = loc.lng ?? null;
    }
  }

  return {
    direccion: place?.formatted_address || "",
    estado: getComponent(["administrative_area_level_1"]),
    ciudad: getComponent(["locality"]) || getComponent(["administrative_area_level_2"]) || "",
    municipio: getComponent(["administrative_area_level_2"]) || "",
    colonia:
      getComponent(["sublocality", "sublocality_level_1"]) ||
      getComponent(["neighborhood"]) ||
      "",
    codigo_postal: getComponent(["postal_code"]),
    pais: getComponent(["country"]),
    google_place_id: place?.place_id || "",
    latitud: lat,
    longitud: lng,
  };
}
