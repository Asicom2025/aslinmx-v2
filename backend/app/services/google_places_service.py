"""Llamadas opcionales a Google Places Details (API legacy JSON) con clave de servidor."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"


def google_maps_server_key_configured() -> bool:
    k = getattr(settings, "GOOGLE_MAPS_API_KEY", None)
    return bool(k and str(k).strip())


def fetch_place_details(place_id: str, language: str = "es") -> Optional[Dict[str, Any]]:
    """
    Devuelve el JSON de result de Place Details o None si no hay clave / error HTTP.
    Estructura esperada: result.address_components, result.geometry.location, result.formatted_address
    """
    key = (getattr(settings, "GOOGLE_MAPS_API_KEY", None) or "").strip()
    if not key or not place_id:
        return None
    params = {
        "place_id": place_id.strip(),
        "fields": "address_component,geometry,formatted_address,types",
        "key": key,
        "language": language,
    }
    try:
        with httpx.Client(timeout=12.0) as client:
            r = client.get(PLACES_DETAILS_URL, params=params)
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        logger.warning("Google Places Details falló: %s", e)
        return None
    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        logger.warning("Google Places Details status=%s", data.get("status"))
        return None
    return data.get("result") or None


def _get_component(components: List[Dict[str, Any]], types: List[str]) -> str:
    for c in components or []:
        tset = set(c.get("types") or [])
        if all(t in tset for t in types):
            return (c.get("long_name") or c.get("short_name") or "").strip()
    return ""


def normalized_fields_from_details(result: Dict[str, Any]) -> Dict[str, Any]:
    """Extrae campos útiles para fusionar con payload de asegurado (texto + lat/lng)."""
    out: Dict[str, Any] = {}
    if not result:
        return out
    comps = result.get("address_components") or []
    out["direccion"] = (result.get("formatted_address") or "").strip() or None
    out["pais"] = _get_component(comps, ["country"]) or None
    out["estado"] = _get_component(comps, ["administrative_area_level_1"]) or None
    out["ciudad"] = (
        _get_component(comps, ["locality"])
        or _get_component(comps, ["administrative_area_level_2"])
        or None
    )
    out["municipio"] = _get_component(comps, ["administrative_area_level_2"]) or None
    out["colonia"] = (
        _get_component(comps, ["sublocality", "sublocality_level_1"])
        or _get_component(comps, ["neighborhood"])
        or None
    )
    out["codigo_postal"] = _get_component(comps, ["postal_code"]) or None
    loc = (result.get("geometry") or {}).get("location") or {}
    lat, lng = loc.get("lat"), loc.get("lng")
    if lat is not None:
        out["latitud"] = lat
    if lng is not None:
        out["longitud"] = lng
    return out
