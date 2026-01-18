/**
 * Página para crear nuevo siniestro
 * Formulario completo en una página nueva (no modal)
 */

"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import apiService from "@/lib/apiService";
import { swalSuccess, swalError } from "@/lib/swal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Switch from "@/components/ui/Switch";
import TiptapEditor from "@/components/ui/TiptapEditor";
import CustomSelect, { SelectOption } from "@/components/ui/Select";
import CrearAseguradoModal from "@/components/siniestros/CrearAseguradoModal";
import {
  SiniestroFormState,
  ExtendedSiniestroFormState,
  PersonaLigera,
  CatalogOption,
  PolizaDraft,
} from "@/components/siniestros/SiniestroWizard";
import { FiArrowLeft, FiPlus, FiTrash2, FiUser } from "react-icons/fi";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const CALIFICACIONES_DEFAULT = ["Excelente", "Bueno", "Regular", "Malo"];

const contactoPreferencia = [
  { value: "", label: "Sin preferencia" },
  { value: "correo", label: "Correo" },
  { value: "telefono", label: "Teléfono" },
  { value: "directa", label: "Directa" },
];

function buildTempId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const buildInitialExtendedForm = (): ExtendedSiniestroFormState => ({
  asegurado: {
    seleccionadoId: null,
    busqueda: "",
    formaContacto: "",
    nuevo: {
      nombre: "",
      apellido_paterno: "",
      apellido_materno: "",
      celular: "",
      telefono_casa: "",
      telefono_oficina: "",
      estado: "",
      ciudad: "",
      email: "",
      direccion: "",
      colonia: "",
      municipio: "",
      codigo_postal: "",
      pais: "",
    },
  },
  generales: {
    numero_reporte: "",
    proveniente_id: "",
    institucion_id: "",
    autoridad_id: "",
    fecha_inicio_vigencia: "",
    fecha_fin_vigencia: "",
    calificacion: "",
    abogado_id: "",
    areas_ids: [],
    usuarios_ids: [],
    polizas: [
      {
        tempId: buildTempId("poliza"),
        numero_poliza: "",
        deducible: "",
        reserva: "",
        coaseguro: "",
        suma_asegurada: "",
      },
    ],
  },
  especificos: {
    tipo_intervencion: "",
    tercero: "",
    nicho: "",
    materia: "",
    expediente: "",
    descripcion_html: "",
  },
});

const getInitialForm = (): SiniestroFormState => ({
  numero_siniestro: "",
  fecha_siniestro: new Date().toISOString().split("T")[0],
  ubicacion: "",
  descripcion_hechos: "",
  numero_poliza: "",
  deducible: 0,
  reserva: 0,
  coaseguro: 0,
  suma_asegurada: 0,
  estado_id: "",
  institucion_id: "",
  autoridad_id: "",
  prioridad: "media",
  observaciones: "",
  activo: true,
});

const extractValue = (source: any, keys: string[]): string => {
  if (!source) return "";
  if (Array.isArray(source)) {
    for (const item of source) {
      const value = extractValue(item, keys);
      if (value) return value;
    }
    return "";
  }
  if (typeof source === "object") {
    for (const key of keys) {
      if (source && source[key]) {
        return source[key];
      }
    }
  }
  return "";
};

const mapUserToPersona = (usuario: any): PersonaLigera => {
  const perfil = usuario?.perfil || usuario?.profile || usuario?.perfil_usuario || {};
  const contactos = usuario?.contactos || usuario?.contacto || null;
  const direccion = usuario?.direccion || usuario?.direcciones || usuario?.direccion_usuario || null;

  return {
    id: usuario.id,
    nombre: perfil.nombre || usuario.nombre || "",
    apellido_paterno: perfil.apellido_paterno || usuario.apellido_paterno || "",
    apellido_materno: perfil.apellido_materno || usuario.apellido_materno || "",
    email: usuario.email,
    telefono: extractValue(contactos, ["celular", "telefono", "telefono_casa", "telefono_oficina"]),
    estado: extractValue(direccion, ["estado"]),
    ciudad: extractValue(direccion, ["ciudad"]),
  };
};

export default function NuevoSiniestroPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCrearAseguradoModal, setShowCrearAseguradoModal] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Estados del formulario
  const [form, setForm] = useState<SiniestroFormState>(() => getInitialForm());
  const [extendedForm, setExtendedForm] = useState<ExtendedSiniestroFormState>(() => buildInitialExtendedForm());

  // Catálogos
  const [areas, setAreas] = useState<any[]>([]);
  const [estados, setEstados] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [institucionesCatalogo, setInstitucionesCatalogo] = useState<CatalogOption[]>([]);
  const [autoridadesCatalogo, setAutoridadesCatalogo] = useState<CatalogOption[]>([]);
  const [provenientesCatalogo, setProvenientesCatalogo] = useState<any[]>([]);
  const [calificaciones, setCalificaciones] = useState<string[]>(CALIFICACIONES_DEFAULT);
  const [calificacionesCatalogo, setCalificacionesCatalogo] = useState<any[]>([]);

  const addressInputRef = useRef<HTMLInputElement>(null);

  // Autenticación
  useEffect(() => {
    if (userLoading) return;
    const token = localStorage.getItem("token");
    if (!token || !user) {
      router.push("/login");
    }
  }, [router, userLoading, user]);

  // Cargar catálogos
  useEffect(() => {
    if (!user) return;
    const loadCatalogos = async () => {
      try {
        setLoading(true);
        await Promise.all([
          loadAreas(),
          loadEstados(),
          loadUsuarios(),
          loadRoles(),
          loadInstituciones(),
          loadAutoridades(),
          loadProvenientes(),
          loadCalificaciones(),
        ]);
      } catch (error) {
        console.error("Error al cargar catálogos:", error);
      } finally {
        setLoading(false);
      }
    };
    loadCatalogos();
  }, [user]);

  // Google Places
  useEffect(() => {
    if (!addressInputRef.current) return;
    let autocomplete: any = null;

    const loadGooglePlaces = (): Promise<void> => {
      if (typeof window === "undefined") return Promise.resolve();
      if (window.google?.maps?.places) return Promise.resolve();
      if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error("Google Maps API key no configurada"));

      return new Promise((resolve, reject) => {
        const existingScript = document.getElementById("google-maps-script");
        if (existingScript) {
          existingScript.addEventListener("load", () => resolve());
          existingScript.addEventListener("error", reject);
          return;
        }

        const script = document.createElement("script");
        script.id = "google-maps-script";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=es`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = reject;
        document.body.appendChild(script);
      });
    };

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
  }, []);

  const handleDireccionSeleccionada = (place: any) => {
    if (!place) return;
    const components = place.address_components || [];
    const getComponent = (types: string[]) => {
      const component = components.find((item: any) => types.every((type) => item.types.includes(type)));
      return component ? component.long_name : "";
    };

    const formattedAddress = place.formatted_address || addressInputRef.current?.value || "";
    const estado = getComponent(["administrative_area_level_1"]);
    const ciudad = getComponent(["locality"]) || getComponent(["administrative_area_level_2"]);
    const municipio = getComponent(["administrative_area_level_2"]);
    const colonia = getComponent(["sublocality", "sublocality_level_1"]) || getComponent(["neighborhood"]);
    const codigoPostal = getComponent(["postal_code"]);
    const pais = getComponent(["country"]);

    setForm((prev) => ({
      ...prev,
      ubicacion: formattedAddress,
    }));
  };

  // Funciones de carga
  const loadAreas = async () => {
    try {
      const data = await apiService.getAreas(true);
      setAreas(data);
    } catch (e: any) {
      console.error("Error al cargar áreas:", e);
    }
  };

  const loadEstados = async () => {
    try {
      const data = await apiService.getEstadosSiniestro(true);
      setEstados(data);
    } catch (e: any) {
      console.error("Error al cargar estados:", e);
    }
  };

  const loadUsuarios = async () => {
    try {
      const data = await apiService.getUsers();
      setUsuarios(data);
    } catch (e: any) {
      console.error("Error al cargar usuarios:", e);
    }
  };

  const loadRoles = async () => {
    try {
      const data = await apiService.getRoles();
      setRoles(data);
    } catch (e: any) {
      console.error("Error al cargar roles:", e);
    }
  };

  const loadInstituciones = async () => {
    try {
      const data = await apiService.getInstituciones(true);
      setInstitucionesCatalogo(data);
    } catch (e: any) {
      console.error("Error al cargar instituciones:", e);
    }
  };

  const loadAutoridades = async () => {
    try {
      const data = await apiService.getAutoridades(true);
      setAutoridadesCatalogo(data);
    } catch (e: any) {
      console.error("Error al cargar autoridades:", e);
    }
  };

  const loadProvenientes = async () => {
    try {
      const data = await apiService.getProvenientes(true);
      setProvenientesCatalogo(data);
    } catch (e: any) {
      console.error("Error al cargar provenientes:", e);
    }
  };

  const loadCalificaciones = async () => {
    try {
      const data = await apiService.getCalificacionesSiniestro(true);
      setCalificacionesCatalogo(data || []);
      if (Array.isArray(data) && data.length > 0) {
        const nombres = data
          .map((item: any) => item?.nombre)
          .filter((nombre: string): nombre is string => typeof nombre === "string" && nombre.trim().length > 0);
        setCalificaciones(nombres.length > 0 ? nombres : CALIFICACIONES_DEFAULT);
      } else {
        setCalificaciones(CALIFICACIONES_DEFAULT);
      }
    } catch (e: any) {
      console.error("Error al cargar calificaciones:", e);
      setCalificaciones(CALIFICACIONES_DEFAULT);
      setCalificacionesCatalogo([]);
    }
  };

  // Helpers
  const rolesMap = useMemo(() => {
    const map: Record<string, string> = {};
    (roles || []).forEach((rol: any) => {
      if (rol?.id) {
        map[rol.id] = rol.nombre;
      }
    });
    return map;
  }, [roles]);

  const getRoleName = (usuario: any) => {
    if (usuario?.rol?.nombre) return usuario.rol.nombre;
    if (usuario?.rol_id && rolesMap[usuario.rol_id]) return rolesMap[usuario.rol_id];
    return "";
  };

  const aseguradosCatalog = useMemo<PersonaLigera[]>(() => {
    return (usuarios || [])
      .filter((usuario: any) => getRoleName(usuario) === "Asegurado")
      .map(mapUserToPersona);
  }, [usuarios, rolesMap]);

  const provenientesCatalog = useMemo<PersonaLigera[]>(() => {
    return (provenientesCatalogo || []).map((proveniente: any) => ({
      id: proveniente.id,
      nombre: proveniente.nombre || "",
      apellido_paterno: "",
      apellido_materno: "",
      email: proveniente.email || "",
      telefono: proveniente.telefono || "",
      estado: "",
      ciudad: "",
    }));
  }, [provenientesCatalogo]);

  const abogadosCatalog = useMemo<PersonaLigera[]>(() => {
    return (usuarios || [])
      .filter((usuario: any) => {
        const rolNombre = getRoleName(usuario);
        return rolNombre === "Abogado" || rolNombre === "Abogado JR";
      })
      .map(mapUserToPersona);
  }, [usuarios, rolesMap]);

  const aseguradoOptions = useMemo(() => {
    return aseguradosCatalog.map((item) => {
      const fullName = `${item.nombre || ""} ${item.apellido_paterno || ""} ${item.apellido_materno || ""}`.trim();
      const label = fullName || item.email || "Sin nombre";
      const sublabel = item.email ? ` - ${item.email}` : "";
      return {
        value: item.id,
        label: `${label}${sublabel}`,
      };
    });
  }, [aseguradosCatalog]);

  const getCalificacionIdFromNombre = (nombre?: string): string | null => {
    if (!nombre) return null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(nombre)) return nombre;
    const calificacion = calificacionesCatalogo.find((c: any) => c?.nombre === nombre);
    return calificacion?.id || null;
  };

  // Handlers
  const handleSelectAsegurado = async (id: string) => {
    if (!id) {
      setExtendedForm((prev) => ({
        ...prev,
        asegurado: {
          ...prev.asegurado,
          seleccionadoId: null,
        },
      }));
      return;
    }

    try {
      const userDetails = await apiService.getUserById(id);
      const perfil = userDetails?.perfil || {};
      const direccion = userDetails?.direccion || {};
      const contactos = userDetails?.contactos || {};

      setExtendedForm((prev) => ({
        ...prev,
        asegurado: {
          ...prev.asegurado,
          seleccionadoId: id,
        },
      }));

      if (direccion?.direccion || direccion?.direccion_completa) {
        const direccionCompleta = [
          direccion.calle || direccion.direccion_completa,
          direccion.colonia,
          direccion.municipio || direccion.delegacion,
          direccion.estado,
          direccion.codigo_postal,
        ]
          .filter(Boolean)
          .join(", ");

        setForm((prev) => ({
          ...prev,
          ubicacion: direccionCompleta,
        }));
      }
    } catch (error: any) {
      console.error("Error al obtener datos del asegurado:", error);
      setExtendedForm((prev) => ({
        ...prev,
        asegurado: {
          ...prev.asegurado,
          seleccionadoId: id,
        },
      }));
    }
  };

  const handleAseguradoCreado = async (aseguradoId: string) => {
    await handleSelectAsegurado(aseguradoId);
    // Recargar usuarios para incluir el nuevo asegurado
    await loadUsuarios();
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const numericFields = new Set(["deducible", "reserva", "coaseguro", "suma_asegurada"]);
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : numericFields.has(name)
          ? value === "" || Number.isNaN(Number(value))
            ? ""
            : Number(value)
          : value,
    }));
  };

  const setGeneralesValue = <K extends keyof ExtendedSiniestroFormState["generales"]>(
    field: K,
    value: ExtendedSiniestroFormState["generales"][K]
  ) => {
    setExtendedForm((prev) => ({
      ...prev,
      generales: {
        ...prev.generales,
        [field]: value,
      },
    }));
  };

  const setEspecificosValue = <K extends keyof ExtendedSiniestroFormState["especificos"]>(
    field: K,
    value: ExtendedSiniestroFormState["especificos"][K]
  ) => {
    setExtendedForm((prev) => ({
      ...prev,
      especificos: {
        ...prev.especificos,
        [field]: value,
      },
    }));
  };

  const handlePolizaFieldChange = (index: number, field: keyof PolizaDraft, value: string) => {
    setExtendedForm((prev) => {
      const updated = prev.generales.polizas.map((poliza, idx) =>
        idx === index
          ? {
              ...poliza,
              [field]: ["deducible", "reserva", "coaseguro", "suma_asegurada"].includes(field)
                ? value === "" || Number.isNaN(Number(value))
                  ? ""
                  : Number(value)
                : value,
            }
          : poliza
      );

      return {
        ...prev,
        generales: {
          ...prev.generales,
          polizas: updated,
        },
      };
    });

    if (index === 0) {
      setForm((prev) => ({
        ...prev,
        numero_poliza: field === "numero_poliza" ? value : prev.numero_poliza,
        deducible: field === "deducible" ? (value === "" ? "" : Number(value)) : prev.deducible,
        reserva: field === "reserva" ? (value === "" ? "" : Number(value)) : prev.reserva,
        coaseguro: field === "coaseguro" ? (value === "" ? "" : Number(value)) : prev.coaseguro,
        suma_asegurada: field === "suma_asegurada" ? (value === "" ? "" : Number(value)) : prev.suma_asegurada,
      }));
    }
  };

  const handleAddPoliza = () => {
    setExtendedForm((prev) => ({
      ...prev,
      generales: {
        ...prev.generales,
        polizas: [
          ...prev.generales.polizas,
          {
            tempId: buildTempId("poliza"),
            numero_poliza: "",
            deducible: "",
            reserva: "",
            coaseguro: "",
            suma_asegurada: "",
          },
        ],
      },
    }));
  };

  const handleRemovePoliza = (index: number) => {
    setExtendedForm((prev) => {
      const updated = prev.generales.polizas.filter((_, idx) => idx !== index);
      const next = {
        ...prev,
        generales: {
          ...prev.generales,
          polizas: updated.length
            ? updated
            : [
                {
                  tempId: buildTempId("poliza"),
                  numero_poliza: "",
                  deducible: "",
                  reserva: "",
                  coaseguro: "",
                  suma_asegurada: "",
                },
              ],
        },
      };

      const primary = next.generales.polizas[0];
      setForm((prevForm) => ({
        ...prevForm,
        numero_poliza: primary.numero_poliza,
        deducible: primary.deducible,
        reserva: primary.reserva,
        coaseguro: primary.coaseguro,
        suma_asegurada: primary.suma_asegurada,
      }));

      return next;
    });
  };

  // Validación
  const validateForm = (): string | null => {
    if (!extendedForm.asegurado.seleccionadoId) {
      return "Debes seleccionar un asegurado.";
    }
    if (!form.numero_siniestro.trim()) {
      return "El número de siniestro es obligatorio.";
    }
    if (!form.fecha_siniestro) {
      return "Selecciona la fecha del siniestro.";
    }
    if (!form.estado_id) {
      return "Selecciona un status para el siniestro.";
    }
    if (!form.institucion_id || form.institucion_id.trim() === "") {
      return "Selecciona una institución.";
    }
    if (!form.autoridad_id || form.autoridad_id.trim() === "") {
      return "Selecciona una autoridad.";
    }
    if (!extendedForm.especificos.descripcion_html || extendedForm.especificos.descripcion_html.trim() === "") {
      return "La descripción de los hechos es obligatoria.";
    }
    return null;
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationError(null);

    const error = validateForm();
    if (error) {
      setValidationError(error);
      return;
    }

    setSaving(true);
    try {
      const primaryPoliza = extendedForm.generales.polizas[0];
      const deducibleBase = primaryPoliza ? primaryPoliza.deducible : form.deducible;
      const reservaBase = primaryPoliza ? primaryPoliza.reserva : form.reserva;
      const coaseguroBase = primaryPoliza ? primaryPoliza.coaseguro : form.coaseguro;
      const sumaAseguradaBase = primaryPoliza ? primaryPoliza.suma_asegurada : form.suma_asegurada;

      const fechaSiniestroDateTime = form.fecha_siniestro
        ? new Date(form.fecha_siniestro + "T00:00:00").toISOString()
        : new Date().toISOString();

      const areasIds = extendedForm.generales.areas_ids || [];
      const usuariosIds = extendedForm.generales.usuarios_ids || [];
      const aseguradoId = extendedForm.asegurado.seleccionadoId || null;

      const payload = {
        ...form,
        fecha_siniestro: fechaSiniestroDateTime,
        numero_poliza: primaryPoliza ? primaryPoliza.numero_poliza : form.numero_poliza,
        deducible: deducibleBase === "" ? 0 : Number(deducibleBase),
        reserva: reservaBase === "" ? 0 : Number(reservaBase),
        coaseguro: coaseguroBase === "" ? 0 : Number(coaseguroBase),
        suma_asegurada: sumaAseguradaBase === "" ? 0 : Number(sumaAseguradaBase),
        descripcion_hechos: extendedForm.especificos.descripcion_html || form.descripcion_hechos,
        asegurado_id: aseguradoId,
        institucion_id: form.institucion_id && form.institucion_id.trim() !== "" ? form.institucion_id : null,
        autoridad_id: form.autoridad_id && form.autoridad_id.trim() !== "" ? form.autoridad_id : null,
        proveniente_id: extendedForm.generales.proveniente_id || null,
        numero_reporte: extendedForm.generales.numero_reporte || null,
        calificacion_id: getCalificacionIdFromNombre(extendedForm.generales.calificacion),
        forma_contacto: extendedForm.asegurado.formaContacto || null,
      };

      const nuevoSiniestro = await apiService.createSiniestro(payload as any);
      const siniestroId = nuevoSiniestro.id;

      await swalSuccess("Siniestro creado correctamente");

      // Crear relaciones de áreas
      if (areasIds && areasIds.length > 0) {
        const areasErrors: string[] = [];
        const areasGuardadas: string[] = [];

        for (const areaId of areasIds) {
          if (!areaId) continue;
          try {
            await apiService.addAreaAdicional(siniestroId, {
              area_id: areaId,
              activo: true,
            });
            areasGuardadas.push(areaId);
          } catch (error: any) {
            let errorMsg = `Error desconocido al agregar área ${areaId}`;
            try {
              if (error.response?.data?.detail) {
                errorMsg = typeof error.response.data.detail === "string" ? error.response.data.detail : JSON.stringify(error.response.data.detail);
              } else if (error.message) {
                errorMsg = error.message;
              }
            } catch {}
            areasErrors.push(`Área ${areaId}: ${errorMsg}`);
          }
        }

        if (areasErrors.length > 0) {
          await swalError(`${areasErrors.length} de ${areasIds.length} áreas no se pudieron guardar:\n${areasErrors.join("\n")}`);
        }
      }

      // Crear relaciones de usuarios
      if (usuariosIds.length > 0) {
        for (let i = 0; i < usuariosIds.length; i++) {
          try {
            await apiService.addInvolucrado(siniestroId, {
              usuario_id: usuariosIds[i],
              tipo_relacion: "tercero",
              es_principal: i === 0,
              activo: true,
            });
          } catch (error: any) {
            console.error(`Error al agregar usuario ${usuariosIds[i]}:`, error);
          }
        }
      }

      router.push(`/siniestros/${siniestroId}`);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al crear siniestro");
    } finally {
      setSaving(false);
    }
  };

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Cargando...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const provenienteOptions = provenientesCatalog.map((p) => ({
    id: p.id,
    nombre: p.nombre || p.email || p.id,
  }));

  const abogadoOptions = abogadosCatalog.map((p) => ({
    id: p.id,
    nombre: `${p.nombre || ""} ${p.apellido_paterno || ""}`.trim() || p.email || p.id,
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Nuevo Siniestro</h1>
            <p className="text-gray-600 mt-2">Completa el formulario para crear un nuevo siniestro</p>
          </div>
          <Button variant="secondary" onClick={() => router.push("/siniestros")}>
            <FiArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {validationError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {validationError}
            </div>
          )}

          {/* Sección: Asegurado */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Datos del Asegurado</h2>
            <div className="space-y-4">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <CustomSelect
                    label="Seleccionar asegurado *"
                    name="asegurado_selector"
                    value={extendedForm.asegurado.seleccionadoId || ""}
                    onChange={(value) => handleSelectAsegurado(value as string)}
                    options={aseguradoOptions}
                    placeholder="Escribe para buscar por nombre o correo..."
                    isSearchable={true}
                    isClearable={true}
                    required
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCrearAseguradoModal(true)}
                  className="mb-0"
                >
                  <FiUser className="w-4 h-4 mr-2" />
                  Crear Asegurado
                </Button>
              </div>
              {extendedForm.asegurado.seleccionadoId && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">✓ Asegurado seleccionado</p>
                </div>
              )}
              <CustomSelect
                label="Forma de contacto"
                name="formaContacto"
                value={extendedForm.asegurado.formaContacto}
                onChange={(value) =>
                  setExtendedForm((prev) => ({
                    ...prev,
                    asegurado: { ...prev.asegurado, formaContacto: value as any },
                  }))
                }
                options={contactoPreferencia}
              />
            </div>
          </div>

          {/* Sección: Datos Generales */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Datos Generales</h2>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  label="Número de reporte"
                  name="numero_reporte"
                  value={extendedForm.generales.numero_reporte}
                  onChange={(event) => setGeneralesValue("numero_reporte", event.target.value)}
                  placeholder="REP-2025-0001"
                />
                <Input
                  label="Número de siniestro *"
                  name="numero_siniestro"
                  value={form.numero_siniestro}
                  onChange={handleFormChange}
                  placeholder="SIN-2025-000001"
                  required
                />
                <Input
                  label="Fecha del siniestro *"
                  type="date"
                  name="fecha_siniestro"
                  value={form.fecha_siniestro}
                  onChange={handleFormChange}
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <CustomSelect
                  label="Proveniente"
                  name="proveniente_id"
                  value={extendedForm.generales.proveniente_id}
                  onChange={(value) => setGeneralesValue("proveniente_id", value as string)}
                  options={[
                    { value: "", label: "Seleccionar proveniente" },
                    ...provenienteOptions.map((option) => ({
                      value: option.id,
                      label: option.nombre,
                    })),
                  ]}
                />
                <CustomSelect
                  label="Institución *"
                  name="institucion_id"
                  value={form.institucion_id}
                  onChange={(value) => {
                    const fakeEvent = {
                      target: { name: "institucion_id", value: value as string },
                    } as React.ChangeEvent<HTMLSelectElement>;
                    handleFormChange(fakeEvent);
                    setGeneralesValue("institucion_id", value as string);
                  }}
                  options={[
                    { value: "", label: "Seleccionar institución" },
                    ...(institucionesCatalogo && Array.isArray(institucionesCatalogo)
                      ? institucionesCatalogo.map((option) => ({
                          value: String(option.id || ""),
                          label: option.nombre || String(option.id) || "Sin nombre",
                        }))
                      : []),
                  ]}
                  required
                />
                <CustomSelect
                  label="Autoridad *"
                  name="autoridad_id"
                  value={form.autoridad_id}
                  onChange={(value) => {
                    const fakeEvent = {
                      target: { name: "autoridad_id", value: value as string },
                    } as React.ChangeEvent<HTMLSelectElement>;
                    handleFormChange(fakeEvent);
                    setGeneralesValue("autoridad_id", value as string);
                  }}
                  options={[
                    { value: "", label: "Seleccionar autoridad" },
                    ...(autoridadesCatalogo && Array.isArray(autoridadesCatalogo)
                      ? autoridadesCatalogo.map((option) => ({
                          value: String(option.id || ""),
                          label: option.nombre || String(option.id) || "Sin nombre",
                        }))
                      : []),
                  ]}
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <Input
                  label="Fecha inicio vigencia"
                  type="date"
                  name="fecha_inicio_vigencia"
                  value={extendedForm.generales.fecha_inicio_vigencia}
                  onChange={(event) => setGeneralesValue("fecha_inicio_vigencia", event.target.value)}
                />
                <Input
                  label="Fecha fin vigencia"
                  type="date"
                  name="fecha_fin_vigencia"
                  value={extendedForm.generales.fecha_fin_vigencia}
                  onChange={(event) => setGeneralesValue("fecha_fin_vigencia", event.target.value)}
                />
                <CustomSelect
                  label="Status *"
                  name="estado_id"
                  value={form.estado_id}
                  onChange={(value) => {
                    const fakeEvent = {
                      target: { name: "estado_id", value: value as string },
                    } as React.ChangeEvent<HTMLSelectElement>;
                    handleFormChange(fakeEvent);
                  }}
                  options={[
                    { value: "", label: "Seleccionar status" },
                    ...estados.map((estado) => ({
                      value: estado.id,
                      label: estado.nombre || estado.id,
                    })),
                  ]}
                  required
                />
                <CustomSelect
                  label="Calificación"
                  name="calificacion"
                  value={extendedForm.generales.calificacion}
                  onChange={(value) => setGeneralesValue("calificacion", value as string)}
                  options={[
                    { value: "", label: "Sin calificación" },
                    ...(calificacionesCatalogo && calificacionesCatalogo.length > 0
                      ? calificacionesCatalogo.map((cal: any) => ({
                          value: cal.nombre || cal.id,
                          label: cal.nombre || cal.id,
                        }))
                      : calificaciones.map((option) => ({
                          value: option,
                          label: option,
                        }))),
                  ]}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <CustomSelect
                  label="Áreas"
                  name="areas_ids"
                  value={extendedForm.generales.areas_ids || []}
                  onChange={(value) => {
                    const areasArray = Array.isArray(value) ? value : [];
                    setGeneralesValue("areas_ids", areasArray);
                  }}
                  isMulti
                  options={areas.map((area) => ({
                    value: area.id,
                    label: area.nombre || area.id,
                  }))}
                  placeholder="Seleccionar áreas..."
                />
                <CustomSelect
                  label="Usuarios asignados"
                  name="usuarios_ids"
                  value={extendedForm.generales.usuarios_ids || []}
                  onChange={(value) => {
                    const usuariosArray = Array.isArray(value) ? value : [];
                    setGeneralesValue("usuarios_ids", usuariosArray);
                    if (usuariosArray.length > 0) {
                      setGeneralesValue("abogado_id", usuariosArray[0]);
                    } else {
                      setGeneralesValue("abogado_id", "");
                    }
                  }}
                  isMulti
                  options={abogadoOptions.map((option) => ({
                    value: option.id,
                    label: option.nombre,
                  }))}
                  placeholder="Seleccionar usuarios..."
                />
                <CustomSelect
                  label="Prioridad"
                  name="prioridad"
                  value={form.prioridad}
                  onChange={(value) => {
                    const fakeEvent = {
                      target: { name: "prioridad", value: value as string },
                    } as React.ChangeEvent<HTMLSelectElement>;
                    handleFormChange(fakeEvent);
                  }}
                  options={[
                    { value: "baja", label: "Baja" },
                    { value: "media", label: "Media" },
                    { value: "alta", label: "Alta" },
                    { value: "critica", label: "Crítica" },
                  ]}
                />
              </div>

              {/* Pólizas */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">Pólizas relacionadas</h3>
                  <Button type="button" variant="secondary" onClick={handleAddPoliza}>
                    <FiPlus className="mr-2" /> Agregar póliza adicional
                  </Button>
                </div>
                <div className="space-y-4">
                  {extendedForm.generales.polizas.map((poliza, index) => (
                    <div key={poliza.tempId} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">
                          {index === 0 ? "Póliza principal" : `Póliza adicional ${index}`}
                        </span>
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePoliza(index)}
                            className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                          >
                            <FiTrash2 /> Quitar
                          </button>
                        )}
                      </div>
                      <div className="grid gap-4 md:grid-cols-5">
                        <Input
                          label="Número"
                          name={`poliza_numero_${index}`}
                          value={poliza.numero_poliza}
                          onChange={(event) => handlePolizaFieldChange(index, "numero_poliza", event.target.value)}
                          placeholder="01-066-07007105-8-0"
                        />
                        <Input
                          label="Deducible"
                          type="number"
                          step="0.01"
                          name={`poliza_deducible_${index}`}
                          value={poliza.deducible}
                          onChange={(event) => handlePolizaFieldChange(index, "deducible", event.target.value)}
                        />
                        <Input
                          label="Reserva"
                          type="number"
                          step="0.01"
                          name={`poliza_reserva_${index}`}
                          value={poliza.reserva}
                          onChange={(event) => handlePolizaFieldChange(index, "reserva", event.target.value)}
                        />
                        <Input
                          label="Coaseguro"
                          type="number"
                          step="0.01"
                          name={`poliza_coaseguro_${index}`}
                          value={poliza.coaseguro}
                          onChange={(event) => handlePolizaFieldChange(index, "coaseguro", event.target.value)}
                        />
                        <Input
                          label="Suma asegurada"
                          type="number"
                          step="0.01"
                          name={`poliza_suma_${index}`}
                          value={poliza.suma_asegurada}
                          onChange={(event) => handlePolizaFieldChange(index, "suma_asegurada", event.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <Switch
                  label="Siniestro activo"
                  checked={form.activo}
                  onChange={(checked) => setForm((prevForm) => ({ ...prevForm, activo: checked }))}
                />
              </div>
            </div>
          </div>

          {/* Sección: Datos Específicos */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Datos Específicos</h2>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Tipo de intervención"
                  name="tipo_intervencion"
                  value={extendedForm.especificos.tipo_intervencion}
                  onChange={(event) => setEspecificosValue("tipo_intervencion", event.target.value)}
                  placeholder="Ej. Jurídica"
                />
                <Input
                  label="Tercero involucrado"
                  name="tercero"
                  value={extendedForm.especificos.tercero}
                  onChange={(event) => setEspecificosValue("tercero", event.target.value)}
                  placeholder="Nombre del tercero"
                />
                <Input
                  label="Nicho"
                  name="nicho"
                  value={extendedForm.especificos.nicho}
                  onChange={(event) => setEspecificosValue("nicho", event.target.value)}
                  placeholder="Ej. Salud"
                />
                <Input
                  label="Materia"
                  name="materia"
                  value={extendedForm.especificos.materia}
                  onChange={(event) => setEspecificosValue("materia", event.target.value)}
                  placeholder="Ej. Penal"
                />
              </div>

              <Input
                label="Número de expediente"
                name="expediente"
                value={extendedForm.especificos.expediente}
                onChange={(event) => setEspecificosValue("expediente", event.target.value)}
                placeholder="EXP-2025-0001"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección (Google)
                </label>
                <input
                  ref={addressInputRef}
                  type="text"
                  value={form.ubicacion}
                  onChange={(e) => setForm((prev) => ({ ...prev, ubicacion: e.target.value }))}
                  placeholder="Ingresa la dirección y selecciona desde las sugerencias"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {!GOOGLE_MAPS_API_KEY && (
                  <p className="mt-1 text-xs text-amber-600">
                    Configura <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> para habilitar las sugerencias de Google.
                  </p>
                )}
              </div>

              <TiptapEditor
                label="Descripción de los hechos *"
                value={extendedForm.especificos.descripcion_html}
                onChange={(value) => setEspecificosValue("descripcion_html", value)}
                placeholder="Describe con detalle lo ocurrido"
                height={400}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones adicionales</label>
                <textarea
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  rows={4}
                  name="observaciones"
                  value={form.observaciones}
                  onChange={handleFormChange}
                  placeholder="Notas internas, acuerdos o puntos a seguir"
                />
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 bg-white rounded-lg shadow p-6">
            <Button type="button" variant="secondary" onClick={() => router.push("/siniestros")}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Crear Siniestro
            </Button>
          </div>
        </form>
      </div>

      {/* Modal para crear asegurado */}
      <CrearAseguradoModal
        open={showCrearAseguradoModal}
        onClose={() => setShowCrearAseguradoModal(false)}
        onAseguradoCreado={handleAseguradoCreado}
        aseguradoRolId={
          roles?.find((rol: any) => rol.nombre === "Asegurado")?.id
        }
      />
    </div>
  );
}
