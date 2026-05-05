"use client";

import { useState, useEffect, useRef } from "react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import apiService from "@/lib/apiService";
import { swalSuccess, swalError } from "@/lib/swal";
import { loadGooglePlaces, parseGooglePlaceToPayload } from "@/lib/googlePlacesAddress";
import { matchGeoIdsFromAddressTexts } from "@/lib/geoCatalogMatch";
import GeoCascadeSelects, { type GeoCascadeValue } from "@/components/siniestros/GeoCascadeSelects";

interface CrearAseguradoModalProps {
  open: boolean;
  onClose: () => void;
  onAseguradoCreado: (aseguradoId: string) => void;
  /** @deprecated El asegurado se crea en la tabla asegurados, no como usuario con rol. */
  aseguradoRolId?: string;
}

function emptyGeo(): GeoCascadeValue {
  return { pais_id: "", estado_geografico_id: "", municipio_id: "" };
}

export default function CrearAseguradoModal({
  open,
  onClose,
  onAseguradoCreado,
}: CrearAseguradoModalProps) {
  const [formData, setFormData] = useState({
    nombre: "",
    apellido_paterno: "",
    apellido_materno: "",
    email: "",
    celular: "",
    telefono_casa: "",
    telefono_oficina: "",
    direccion: "",
    colonia: "",
    municipio: "",
    codigo_postal: "",
    pais: "",
    google_place_id: "",
    latitud: "",
    longitud: "",
  });
  const [geoCascade, setGeoCascade] = useState<GeoCascadeValue>(emptyGeo());
  const [loading, setLoading] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFormData({
        nombre: "",
        apellido_paterno: "",
        apellido_materno: "",
        email: "",
        celular: "",
        telefono_casa: "",
        telefono_oficina: "",
        direccion: "",
        colonia: "",
        municipio: "",
        codigo_postal: "",
        pais: "",
        google_place_id: "",
        latitud: "",
        longitud: "",
      });
      setGeoCascade(emptyGeo());
      return;
    }

    let autocomplete: any = null;

    loadGooglePlaces()
      .then(() => {
        if (addressInputRef.current && window.google?.maps?.places) {
          autocomplete = new window.google.maps.places.Autocomplete(addressInputRef.current, {
            types: ["geocode"],
            componentRestrictions: undefined,
          });
          autocomplete.addListener("place_changed", () => {
            const place = autocomplete?.getPlace();
            handleDireccionSeleccionada(place);
          });
        }
      })
      .catch((error) => {
        console.warn("No fue posible inicializar Google Places:", error);
      });

    return () => {
      if (autocomplete && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, [open]);

  const handleDireccionSeleccionada = (place: any) => {
    if (!place) return;
    const p = parseGooglePlaceToPayload(place);
    setFormData((prev) => ({
      ...prev,
      direccion: p.direccion || prev.direccion,
      municipio: p.municipio || prev.municipio,
      colonia: p.colonia || prev.colonia,
      codigo_postal: p.codigo_postal || prev.codigo_postal,
      pais: p.pais || prev.pais,
      google_place_id: p.google_place_id || prev.google_place_id,
      latitud: p.latitud != null ? String(p.latitud) : prev.latitud,
      longitud: p.longitud != null ? String(p.longitud) : prev.longitud,
    }));
    void matchGeoIdsFromAddressTexts({
      paisNombre: p.pais,
      estadoNombre: p.estado,
      municipioNombre: p.municipio,
    }).then((geo) => {
      setGeoCascade({
        pais_id: geo.pais_id || "",
        estado_geografico_id: geo.estado_geografico_id || "",
        municipio_id: geo.municipio_id || "",
      });
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nombre.trim() || !formData.apellido_paterno.trim()) {
      swalError("Nombre y apellido paterno son obligatorios");
      return;
    }

    const correoTrim = formData.email?.trim() || "";

    const uuidOrNull = (s: string) => {
      const t = (s || "").trim();
      return t ? t : null;
    };
    const numOrNull = (s: string) => {
      const t = (s || "").trim();
      if (!t) return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : null;
    };

    setLoading(true);
    try {
      const aseguradoData = {
        nombre: formData.nombre.trim(),
        apellido_paterno: formData.apellido_paterno.trim() || null,
        apellido_materno: formData.apellido_materno.trim() || null,
        telefono:
          formData.celular?.trim() ||
          formData.telefono_casa?.trim() ||
          formData.telefono_oficina?.trim() ||
          null,
        tel_casa: formData.telefono_casa?.trim() || null,
        tel_oficina: formData.telefono_oficina?.trim() || null,
        direccion: formData.direccion?.trim() || null,
        colonia: formData.colonia?.trim() || null,
        municipio: formData.municipio?.trim() || null,
        codigo_postal: formData.codigo_postal?.trim() || null,
        pais: formData.pais?.trim() || null,
        pais_id: uuidOrNull(geoCascade.pais_id),
        estado_geografico_id: uuidOrNull(geoCascade.estado_geografico_id),
        municipio_id: uuidOrNull(geoCascade.municipio_id),
        google_place_id: formData.google_place_id?.trim() || null,
        latitud: numOrNull(formData.latitud),
        longitud: numOrNull(formData.longitud),
        empresa: null,
        correo: correoTrim ? correoTrim : null,
        activo: true,
      };

      const nuevoAsegurado = await apiService.createAsegurado(aseguradoData);
      await swalSuccess("Asegurado creado correctamente");
      onAseguradoCreado(nuevoAsegurado.id);
      onClose();
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.detail || error.message || "Error al crear el asegurado";
      swalError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Crear Nuevo Asegurado" maxWidthClass="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input
            label="Nombre *"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            required
          />
          <Input
            label="Apellido Paterno *"
            name="apellido_paterno"
            value={formData.apellido_paterno}
            onChange={handleChange}
            required
          />
          <Input
            label="Apellido Materno"
            name="apellido_materno"
            value={formData.apellido_materno}
            onChange={handleChange}
          />
        </div>

        <Input
          label="Correo electrónico (opcional; no tiene que ser único)"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input
            label="Celular"
            name="celular"
            value={formData.celular}
            onChange={handleChange}
          />
          <Input
            label="Teléfono Casa"
            name="telefono_casa"
            value={formData.telefono_casa}
            onChange={handleChange}
          />
          <Input
            label="Teléfono Oficina"
            name="telefono_oficina"
            value={formData.telefono_oficina}
            onChange={handleChange}
          />
        </div>

        <Input
          label="Dirección"
          name="direccion"
          value={formData.direccion}
          onChange={handleChange}
          ref={addressInputRef}
          placeholder="Escribe y selecciona una dirección"
        />

        <GeoCascadeSelects value={geoCascade} onChange={setGeoCascade} disabled={loading} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Colonia"
            name="colonia"
            value={formData.colonia}
            onChange={handleChange}
          />
          <Input
            label="Código Postal"
            name="codigo_postal"
            value={formData.codigo_postal}
            onChange={handleChange}
          />
        </div>

        <div className="flex justify-end gap-3 border-t pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            Crear Asegurado
          </Button>
        </div>
      </form>
    </Modal>
  );
}
