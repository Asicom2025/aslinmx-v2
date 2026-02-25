"use client";

import { useState, useEffect, useRef } from "react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import apiService from "@/lib/apiService";
import { swalSuccess, swalError } from "@/lib/swal";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

let googlePlacesPromise: Promise<void> | null = null;

function loadGooglePlaces(): Promise<void> {
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

interface CrearAseguradoModalProps {
  open: boolean;
  onClose: () => void;
  onAseguradoCreado: (aseguradoId: string) => void;
  aseguradoRolId?: string;
}

export default function CrearAseguradoModal({
  open,
  onClose,
  onAseguradoCreado,
  aseguradoRolId,
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
    ciudad: "",
    estado: "",
    codigo_postal: "",
    pais: "",
  });
  const [loading, setLoading] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      // Resetear formulario al cerrar
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
        ciudad: "",
        estado: "",
        codigo_postal: "",
        pais: "",
      });
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
    const components = place.address_components || [];
    const getComponent = (types: string[]) => {
      const component = components.find((item: any) =>
        types.every((type) => item.types.includes(type))
      );
      return component ? component.long_name : "";
    };

    const formattedAddress = place.formatted_address || addressInputRef.current?.value || "";
    const estado = getComponent(["administrative_area_level_1"]);
    const ciudad =
      getComponent(["locality"]) ||
      getComponent(["administrative_area_level_2"]) ||
      formData.ciudad;
    const municipio = getComponent(["administrative_area_level_2"]) || formData.municipio;
    const colonia =
      getComponent(["sublocality", "sublocality_level_1"]) ||
      getComponent(["neighborhood"]) ||
      formData.colonia;
    const codigoPostal = getComponent(["postal_code"]) || formData.codigo_postal;
    const pais = getComponent(["country"]) || formData.pais;

    setFormData((prev) => ({
      ...prev,
      direccion: formattedAddress,
      estado: estado || prev.estado,
      ciudad,
      municipio,
      colonia,
      codigo_postal: codigoPostal,
      pais,
    }));
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
    
    if (!formData.nombre.trim() || !formData.apellido_paterno.trim() || !formData.email.trim()) {
      swalError("Nombre, apellido paterno y correo electrónico son obligatorios");
      return;
    }

    setLoading(true);
    try {
      // Crear usuario/asegurado
      const userData = {
        email: formData.email,
        password: "TempPassword123!", // Contraseña temporal, el usuario deberá cambiarla
        full_name: `${formData.nombre} ${formData.apellido_paterno} ${formData.apellido_materno}`.trim(),
        rol_id: aseguradoRolId || undefined, // Asignar rol de Asegurado
        perfil: {
          nombre: formData.nombre,
          apellido_paterno: formData.apellido_paterno,
          apellido_materno: formData.apellido_materno,
        },
        contactos: {
          celular: formData.celular || undefined,
          telefono: formData.telefono_casa || formData.telefono_oficina || undefined,
        },
        direccion: formData.direccion
          ? {
              direccion: formData.direccion,
              colonia: formData.colonia || undefined,
              municipio: formData.municipio || undefined,
              ciudad: formData.ciudad || undefined,
              estado: formData.estado || undefined,
              codigo_postal: formData.codigo_postal || undefined,
              pais: formData.pais || undefined,
            }
          : undefined,
      };

      const nuevoUsuario = await apiService.registerUser(userData);
      await swalSuccess("Asegurado creado correctamente");
      onAseguradoCreado(nuevoUsuario.id);
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          label="Correo Electrónico *"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          required
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Colonia"
            name="colonia"
            value={formData.colonia}
            onChange={handleChange}
          />
          <Input
            label="Municipio"
            name="municipio"
            value={formData.municipio}
            onChange={handleChange}
          />
          <Input
            label="Ciudad"
            name="ciudad"
            value={formData.ciudad}
            onChange={handleChange}
          />
          <Input
            label="Estado"
            name="estado"
            value={formData.estado}
            onChange={handleChange}
          />
          <Input
            label="Código Postal"
            name="codigo_postal"
            value={formData.codigo_postal}
            onChange={handleChange}
          />
          <Input
            label="País"
            name="pais"
            value={formData.pais}
            onChange={handleChange}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
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
