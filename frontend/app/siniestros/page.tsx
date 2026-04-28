/**
 * Página de listado de Siniestros
 * Muestra tabla con filtros y permite crear/editar/eliminar siniestros
 */

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { usePermisos } from "@/hooks/usePermisos";
import apiService from "@/lib/apiService";
import Button from "@/components/ui/Button";
import DataTable, { isDataTableFluidLayout } from "@/components/ui/DataTable";
import CustomSelect, { SelectOption } from "@/components/ui/Select";
import { swalSuccess, swalError, swalConfirmDelete } from "@/lib/swal";
import {
  buildSiniestroIdLegible,
  getSiniestroAnualidadDisplay,
} from "@/lib/siniestroIdDisplay";
import { ColumnDef } from "@tanstack/react-table";
import { Siniestro } from "@/types/siniestros";
import type { SiniestroPoliza } from "@/types/siniestrosRelaciones";
import { FiEdit2, FiTrash2, FiEye } from "react-icons/fi";
import { useTour } from "@/hooks/useTour";
import TourButton from "@/components/ui/TourButton";
import {
  buildPolizasPayload,
  PersonaLigera,
  CatalogOption,
  ExtendedSiniestroFormState,
  SiniestroFormState,
} from "@/components/siniestros/SiniestroWizard";
import {
  obtenerCatalogosColores,
  obtenerColorEstado,
  obtenerColorCalificacion,
  obtenerNombreEstado,
  obtenerNombreCalificacion,
  generarEstilosBadge,
  CatalogosColores,
} from "@/lib/siniestrosUtils";

const CALIFICACIONES_DEFAULT = ["Excelente", "Bueno", "Regular", "Malo"];

type ActivoFilterValue = "all" | "true" | "false";

type DashboardAwareFilters = {
  activo: ActivoFilterValue;
  estado_id: string;
  proveniente_id: string;
  area_id: string;
  usuario_asignado: string;
  prioridad: "" | "baja" | "media" | "alta" | "critica";
  calificacion_id: string;
  asegurado_estado: string;
  fecha_registro_mes: string;
};

const DEFAULT_FILTROS: DashboardAwareFilters = {
  activo: "true",
  estado_id: "",
  proveniente_id: "",
  area_id: "",
  usuario_asignado: "",
  prioridad: "",
  calificacion_id: "",
  asegurado_estado: "",
  fecha_registro_mes: "",
};

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
    areas_ids: [], // Array para múltiples áreas
    usuarios_ids: [], // Array para múltiples usuarios
    polizas: [
      {
        tempId: `poliza-${Math.random().toString(36).slice(2, 9)}`,
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
  const perfil =
    usuario?.perfil || usuario?.profile || usuario?.perfil_usuario || {};
  const contactos = usuario?.contactos || usuario?.contacto || null;
  const direccion =
    usuario?.direccion ||
    usuario?.direcciones ||
    usuario?.direccion_usuario ||
    null;

  return {
    id: usuario.id,
    nombre: perfil.nombre || usuario.nombre || "",
    apellido_paterno: perfil.apellido_paterno || usuario.apellido_paterno || "",
    apellido_materno: perfil.apellido_materno || usuario.apellido_materno || "",
    email: usuario.email,
    telefono: extractValue(contactos, [
      "celular",
      "telefono",
      "telefono_casa",
      "telefono_oficina",
    ]),
    estado: extractValue(direccion, ["estado"]),
    ciudad: extractValue(direccion, ["ciudad"]),
    areas: Array.isArray(usuario?.areas)
      ? usuario.areas.map((area: any) => ({
          id: String(area?.id || ""),
          nombre: area?.nombre || "",
        }))
      : [],
  };
};

function SiniestrosPageFallback() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Cargando siniestros...
        </div>
      </div>
    </div>
  );
}

export default function SiniestrosPage() {
  return (
    <Suspense fallback={<SiniestrosPageFallback />}>
      <SiniestrosPageContent />
    </Suspense>
  );
}

function SiniestrosPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading } = useUser();
  const { can } = usePermisos();
  const canCrearSiniestro = can("siniestros", "create");
  const canVerDetalle = can("siniestros", "read");
  const canActualizarSiniestro = can("siniestros", "update");
  const canEliminarSiniestro = can("siniestros", "delete");
  useTour("tour-siniestros", { autoStart: true });
  const [siniestros, setSiniestros] = useState<Siniestro[]>([]);
  const [siniestrosLoading, setSiniestrosLoading] = useState(false);
  const [areas, setAreas] = useState<any[]>([]);
  const [estados, setEstados] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [filtersReady, setFiltersReady] = useState(false);

  // Filtros
  const [filtros, setFiltros] = useState<DashboardAwareFilters>(
    DEFAULT_FILTROS
  );

  // Límite de registros a cargar del backend
  const [limit, setLimit] = useState<number>(1000);

  // Estado para edición (si se necesita en el futuro)
  const [editing, setEditing] = useState<Siniestro | null>(null);
  const [form, setForm] = useState<SiniestroFormState>({
    numero_siniestro: "",
    fecha_registro: new Date().toISOString().split("T")[0],
    fecha_asignacion: new Date().toISOString().split("T")[0],
    fecha_siniestro: "",
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
  const [extendedForm, setExtendedForm] = useState<ExtendedSiniestroFormState>(() => buildInitialExtendedForm());
  const [institucionesCatalogo, setInstitucionesCatalogo] = useState<
    CatalogOption[]
  >([]);
  const [autoridadesCatalogo, setAutoridadesCatalogo] = useState<
    CatalogOption[]
  >([]);
  const [aseguradosCatalogo, setAseguradosCatalogo] = useState<any[]>([]);
  const [provenientesCatalogo, setProvenientesCatalogo] = useState<any[]>([]);
  const [calificaciones, setCalificaciones] = useState<string[]>(
    CALIFICACIONES_DEFAULT
  );
  const [calificacionesCatalogo, setCalificacionesCatalogo] = useState<any[]>(
    []
  );
  const [catalogosColores, setCatalogosColores] = useState<CatalogosColores>({
    estados: new Map(),
    calificaciones: new Map(),
    estadosArray: [],
    calificacionesArray: [],
  });

  // Función helper para obtener el ID de calificación desde el nombre
  const getCalificacionIdFromNombre = (nombre?: string): string | null => {
    if (!nombre) return null;
    // Si ya es un UUID, retornarlo directamente
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(nombre)) {
      return nombre;
    }
    // Buscar por nombre en el catálogo
    const calificacion = calificacionesCatalogo.find(
      (c: any) => c?.nombre === nombre
    );
    return calificacion?.id || null;
  };

  // Autenticación
  useEffect(() => {
    if (loading) return;
    const token = localStorage.getItem("token");
    if (!token || !user) {
      router.push("/login");
    }
  }, [router, loading, user]);

  useEffect(() => {
    const activoParam = searchParams.get("activo");
    const limitParam = Number(searchParams.get("limit"));

    const activo: ActivoFilterValue =
      activoParam === "all"
        ? "all"
        : activoParam === "false"
          ? "false"
          : "true";

    const estado_id_raw = searchParams.get("estado_id") || "";
    const area_id_raw = searchParams.get("area_id") || "";
    const usuario_raw = searchParams.get("usuario_asignado") || "";

    setFiltros({
      activo,
      estado_id:
        activo === "all" || activo === "false" ? "" : estado_id_raw,
      proveniente_id: searchParams.get("proveniente_id") || "",
      area_id: activo === "false" ? "" : area_id_raw,
      usuario_asignado: activo === "false" ? "" : usuario_raw,
      prioridad:
        (searchParams.get("prioridad") as DashboardAwareFilters["prioridad"]) ||
        "",
      calificacion_id: searchParams.get("calificacion_id") || "",
      asegurado_estado: searchParams.get("asegurado_estado") || "",
      fecha_registro_mes: searchParams.get("fecha_registro_mes") || "",
    });
    setLimit(Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 1000);
    setFiltersReady(true);
  }, [searchParams]);

  // Cargar siniestros al cambiar filtros o límite
  useEffect(() => {
    if (!user || !filtersReady) return;
    loadSiniestros();
  }, [user, filtros, limit, filtersReady]);

  // Cargar catálogos auxiliares una sola vez
  useEffect(() => {
    if (!user) return;
    loadAreas();
    loadEstados();
    loadUsuarios();
    loadInstituciones();
    loadAutoridades();
    loadAsegurados();
    loadProvenientes();
    loadCalificaciones();
    loadCatalogosColores();
  }, [user]);

  const loadCatalogosColores = async () => {
    try {
      const catalogos = await obtenerCatalogosColores(true);
      setCatalogosColores(catalogos);
    } catch (e: any) {
      console.error("Error al cargar catálogos de colores:", e);
    }
  };

  const loadSiniestros = async () => {
    try {
      setSiniestrosLoading(true);
      const params: any = {};
      if (filtros.activo === "all") {
        params.sin_filtrar_activo = true;
      } else {
        params.activo = filtros.activo === "true";
      }
      if (filtros.estado_id) params.estado_id = filtros.estado_id;
      if (filtros.proveniente_id)
        params.proveniente_id = filtros.proveniente_id;
      if (filtros.area_id) params.area_id = filtros.area_id;
      if (filtros.usuario_asignado)
        params.usuario_asignado = filtros.usuario_asignado;
      if (filtros.prioridad) params.prioridad = filtros.prioridad;
      if (filtros.calificacion_id) params.calificacion_id = filtros.calificacion_id;
      if (filtros.asegurado_estado)
        params.asegurado_estado = filtros.asegurado_estado;
      if (filtros.fecha_registro_mes)
        params.fecha_registro_mes = filtros.fecha_registro_mes;
      // Incluir el límite de registros
      if (limit) params.limit = limit;

      const data = await apiService.getSiniestros(params);
      setSiniestros(data);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al cargar siniestros");
    } finally {
      setSiniestrosLoading(false);
    }
  };

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
      console.log("Autoridades cargadas:", data);
      setAutoridadesCatalogo(data);
    } catch (e: any) {
      console.error("Error al cargar autoridades:", e);
    }
  };

  const loadAsegurados = async () => {
    try {
      const data = await apiService.getAsegurados(true);
      setAseguradosCatalogo(data);
      console.log("Asegurados cargados:", data);
    } catch (e: any) {
      console.error("Error al cargar asegurados:", e);
    }
  };

  const loadProvenientes = async () => {
    try {
      const data = await apiService.getProvenientes(true);
      setProvenientesCatalogo(data);
      console.log("Provenientes cargados:", data);
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
          .filter(
            (nombre: string): nombre is string =>
              typeof nombre === "string" && nombre.trim().length > 0
          );
        setCalificaciones(
          nombres.length > 0 ? nombres : CALIFICACIONES_DEFAULT
        );
      } else {
        setCalificaciones(CALIFICACIONES_DEFAULT);
      }
    } catch (e: any) {
      console.error("Error al cargar calificaciones:", e);
      setCalificaciones(CALIFICACIONES_DEFAULT);
      setCalificacionesCatalogo([]);
    }
  };

  const formatMonthLabel = (mes: string) => {
    const [year, month] = mes.split("-");
    const yearNumber = Number(year);
    const monthNumber = Number(month);

    if (!yearNumber || !monthNumber) return mes;

    return new Intl.DateTimeFormat("es-MX", {
      month: "long",
      year: "numeric",
    }).format(new Date(yearNumber, monthNumber - 1, 1));
  };

  const dashboardFilterLabels = useMemo(() => {
    const labels: string[] = [];

    if (filtros.asegurado_estado) {
      labels.push(`Estado geográfico: ${filtros.asegurado_estado}`);
    }
    if (filtros.fecha_registro_mes) {
      labels.push(`Mes de registro: ${formatMonthLabel(filtros.fecha_registro_mes)}`);
    }

    return labels;
  }, [filtros.asegurado_estado, filtros.fecha_registro_mes]);

  const clearFilters = () => {
    setFiltros(DEFAULT_FILTROS);
    setLimit(1000);
    router.replace(pathname);
  };


  const openEdit = async (siniestro: Siniestro) => {
    setEditing(siniestro);

    // Cargar áreas y usuarios desde las relaciones
    let areasIds: string[] = [];
    let usuariosIds: string[] = [];

    try {
      const areasRelaciones = await apiService.getAreasAdicionales(
        siniestro.id,
        true
      );
      areasIds = areasRelaciones.map((area: any) => area.area_id);

      const involucrados = await apiService.getInvolucrados(siniestro.id, true);
      // Ordenar por es_principal para mantener el orden
      const involucradosOrdenados = involucrados
        .sort((a: any, b: any) => {
          if (a.es_principal && !b.es_principal) return -1;
          if (!a.es_principal && b.es_principal) return 1;
          return 0;
        });
      usuariosIds = involucradosOrdenados.map((inv: any) => inv.usuario_id);
    } catch (error: any) {
      console.error("Error al cargar relaciones:", error);
    }

    const initialExtended = buildInitialExtendedForm();
    initialExtended.generales = {
      ...initialExtended.generales,
      numero_reporte: siniestro.numero_reporte || "",
      proveniente_id: siniestro.proveniente_id || "",
      calificacion: siniestro.calificacion_id || "",
      institucion_id: siniestro.institucion_id || "",
      autoridad_id: siniestro.autoridad_id || "",
      abogado_id: usuariosIds.length > 0 ? usuariosIds[0] : "", // Primer usuario como referencia
      areas_ids: areasIds,
      usuarios_ids: usuariosIds,
      polizas: [
        {
          tempId: initialExtended.generales.polizas[0].tempId,
          id: siniestro.polizas?.[0]?.id,
          numero_poliza: siniestro.polizas?.[0]?.numero_poliza || "",
          deducible: siniestro.polizas?.[0]?.deducible ?? "",
          reserva: siniestro.polizas?.[0]?.reserva ?? "",
          coaseguro: siniestro.polizas?.[0]?.coaseguro ?? "",
          suma_asegurada: siniestro.polizas?.[0]?.suma_asegurada ?? "",
        },
      ],
    };
    if ((siniestro.polizas || []).length > 1) {
      initialExtended.generales.polizas = (siniestro.polizas || []).map((poliza, index) => ({
        tempId: `${initialExtended.generales.polizas[0].tempId}-${index}`,
        id: poliza.id,
        numero_poliza: poliza.numero_poliza || "",
        deducible: poliza.deducible ?? "",
        reserva: poliza.reserva ?? "",
        coaseguro: poliza.coaseguro ?? "",
        suma_asegurada: poliza.suma_asegurada ?? "",
      }));
    }
    // Cargar asegurado seleccionado si existe
    initialExtended.asegurado.seleccionadoId = siniestro.asegurado_id || null;
    initialExtended.asegurado.formaContacto =
      (siniestro.forma_contacto as any) || "";

    // Cargar calificación: buscar el nombre desde el ID
    if (siniestro.calificacion_id) {
      const calificacion = calificacionesCatalogo.find(
        (c: any) => c?.id === siniestro.calificacion_id
      );
      initialExtended.generales.calificacion = calificacion?.nombre || "";
    }
    initialExtended.especificos = {
      ...initialExtended.especificos,
      tipo_intervencion: (siniestro as any).tipo_intervencion || "",
      tercero: (siniestro as any).tercero || "",
      nicho: (siniestro as any).nicho || "",
      materia: (siniestro as any).materia || "",
      expediente: (siniestro as any).expediente || "",
      descripcion_html: siniestro.descripcion_hechos || "",
    };
    // Navegar a la página de edición cuando esté disponible
    router.push(`/siniestros/${siniestro.id}`);
  };

  const handleFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    const numericFields = new Set([
      "deducible",
      "reserva",
      "coaseguro",
      "suma_asegurada",
    ]);
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

  const submitForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const fechaRegistroDateTime = form.fecha_registro
        ? new Date(form.fecha_registro + "T00:00:00").toISOString()
        : new Date().toISOString();
      const fechaAsignacionDateTime = form.fecha_asignacion
        ? new Date(form.fecha_asignacion + "T00:00:00").toISOString()
        : new Date().toISOString();
      const fechaSiniestroDateTime = form.fecha_siniestro?.trim()
        ? new Date(form.fecha_siniestro + "T00:00:00").toISOString()
        : undefined;

      const areasIds = extendedForm.generales.areas_ids || [];
      const usuariosIds = extendedForm.generales.usuarios_ids || [];
      const aseguradoId = extendedForm.asegurado.seleccionadoId || null;
      const polizasPayload = buildPolizasPayload(extendedForm.generales.polizas);

      const {
        fecha_registro: _fr,
        fecha_asignacion: _fa,
        fecha_siniestro: _fs,
        numero_poliza: _np,
        deducible: _de,
        reserva: _re,
        coaseguro: _co,
        suma_asegurada: _sa,
        ...formRest
      } = form;
      const payload = {
        ...formRest,
        numero_siniestro: form.numero_siniestro && form.numero_siniestro.trim() ? form.numero_siniestro : null,
        fecha_registro: fechaRegistroDateTime,
        fecha_reporte: fechaRegistroDateTime,
        fecha_asignacion: fechaAsignacionDateTime,
        ...(fechaSiniestroDateTime ? { fecha_siniestro: fechaSiniestroDateTime } : {}),
        polizas: polizasPayload,
        descripcion_hechos:
          extendedForm.especificos.descripcion_html || form.descripcion_hechos,
        asegurado_id: aseguradoId,
        // Convertir strings vacíos a null para campos UUID opcionales
        institucion_id: form.institucion_id && form.institucion_id.trim() !== "" ? form.institucion_id : null,
        autoridad_id: form.autoridad_id && form.autoridad_id.trim() !== "" ? form.autoridad_id : null,
        // Nuevos campos
        proveniente_id: extendedForm.generales.proveniente_id || null,
        numero_reporte: extendedForm.generales.numero_reporte || null,
        calificacion_id: getCalificacionIdFromNombre(
          extendedForm.generales.calificacion
        ),
        forma_contacto: extendedForm.asegurado.formaContacto || null,
        tipo_intervencion: extendedForm.especificos.tipo_intervencion?.trim() || null,
        tercero: extendedForm.especificos.tercero?.trim() || null,
        nicho: extendedForm.especificos.nicho?.trim() || null,
        materia: extendedForm.especificos.materia?.trim() || null,
        expediente: extendedForm.especificos.expediente?.trim() || null,
      };

      let siniestroId: string;

      if (editing) {
        await apiService.updateSiniestro(editing.id, payload as any);
        siniestroId = editing.id;

        // Obtener áreas y usuarios actuales desde las relaciones
        const areasActuales = await apiService.getAreasAdicionales(
          siniestroId,
          true
        );
        const usuariosActuales = await apiService.getInvolucrados(
          siniestroId,
          true
        );

        // Construir lista completa de áreas actuales
        const areasActualesIds: string[] = areasActuales.map(
          (area: any) => area.area_id
        );

        // Construir lista completa de usuarios actuales
        const usuariosActualesIds: string[] = usuariosActuales.map(
          (inv: any) => inv.usuario_id,
        );

        // Áreas: sincronizar todas las áreas seleccionadas
        const areasSeleccionadas = extendedForm.generales.areas_ids || [];
        const areasParaEliminar = areasActualesIds.filter(
          (id: string) => !areasSeleccionadas.includes(id)
        );
        const areasParaAgregar = areasSeleccionadas.filter(
          (id: string) => !areasActualesIds.includes(id)
        );

        // Eliminar áreas que ya no están seleccionadas
        for (const areaRelacion of areasActuales) {
          if (areasParaEliminar.includes(areaRelacion.area_id)) {
            try {
              await apiService.removeAreaAdicional(areaRelacion.id);
            } catch (error: any) {
              console.error(
                `Error al eliminar área ${areaRelacion.id}:`,
                error
              );
            }
          }
        }

        // Agregar nuevas áreas - Asegurar que todas se guarden
        console.log("Áreas para agregar:", areasParaAgregar);
        if (areasParaAgregar && areasParaAgregar.length > 0) {
          const areasErrors: string[] = [];
          const areasGuardadas: string[] = [];
          for (const areaId of areasParaAgregar) {
            if (!areaId) {
              console.warn("Área ID vacío, omitiendo...");
              continue;
            }
            try {
              console.log(`Agregando área ${areaId} al siniestro ${siniestroId}`);
              const resultado = await apiService.addAreaAdicional(siniestroId, {
                area_id: areaId,
                activo: true,
                fecha_asignacion: fechaAsignacionDateTime,
              });
              console.log(`Área ${areaId} agregada correctamente:`, resultado);
              areasGuardadas.push(areaId);
            } catch (error: any) {
              let errorMsg = `Error desconocido al agregar área ${areaId}`;
              
              // Intentar extraer el mensaje de error de diferentes formas
              try {
                if (error.response?.data) {
                  const data = error.response.data;
                  if (data.detail) {
                    if (typeof data.detail === 'string') {
                      errorMsg = data.detail;
                    } else if (typeof data.detail === 'object') {
                      // Si es un objeto, intentar extraer el mensaje
                      errorMsg = data.detail.message || data.detail.error || JSON.stringify(data.detail);
                    }
                  } else if (data.message) {
                    errorMsg = data.message;
                  } else if (data.error) {
                    errorMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
                  } else {
                    errorMsg = JSON.stringify(data);
                  }
                } else if (error.message) {
                  errorMsg = error.message;
                } else if (typeof error === 'string') {
                  errorMsg = error;
                } else {
                  // Como último recurso, convertir a string
                  try {
                    errorMsg = JSON.stringify(error, null, 2);
                  } catch {
                    errorMsg = String(error);
                  }
                }
              } catch (parseError) {
                console.error('Error al parsear el error:', parseError);
                errorMsg = `Error al procesar el error: ${String(error)}`;
              }
              
              console.error(`Error completo al agregar área ${areaId}:`, error);
              console.error(`Mensaje de error extraído:`, errorMsg);
              areasErrors.push(`Área ${areaId}: ${errorMsg}`);
            }
          }
          
          // Verificar que todas las áreas se guardaron
          if (areasErrors.length > 0) {
            await swalError(
              `${areasErrors.length} de ${areasParaAgregar.length} áreas no se pudieron guardar:\n${areasErrors.join('\n')}`
            );
          } else if (areasGuardadas.length !== areasParaAgregar.length) {
            await swalError(
              `No se pudieron guardar todas las áreas. Esperadas: ${areasParaAgregar.length}, Guardadas: ${areasGuardadas.length}`
            );
          } else {
            console.log(`✅ Todas las áreas nuevas se guardaron correctamente: ${areasGuardadas.length} áreas`);
          }
        } else {
          console.log("No hay áreas nuevas para agregar");
        }

        // Usuarios: sincronizar TODOS los usuarios seleccionados en siniestros_usuarios
        const usuariosSeleccionados = extendedForm.generales.usuarios_ids || [];
        const usuariosParaEliminar = usuariosActualesIds.filter(
          (id: string) => !usuariosSeleccionados.includes(id)
        );
        const usuariosParaAgregar = usuariosSeleccionados.filter(
          (id: string) => !usuariosActualesIds.includes(id)
        );

        // Eliminar usuarios que ya no están seleccionados
        for (const usuarioRelacion of usuariosActuales) {
          if (usuariosParaEliminar.includes(usuarioRelacion.usuario_id)) {
            try {
              await apiService.removeInvolucrado(usuarioRelacion.id);
            } catch (error: any) {
              console.error(
                `Error al eliminar usuario ${usuarioRelacion.id}:`,
                error
              );
            }
          }
        }

        // Agregar nuevos usuarios (incluyendo el primero si no existía)
        for (let i = 0; i < usuariosParaAgregar.length; i++) {
          const usuarioId = usuariosParaAgregar[i];
          const indiceEnSeleccionados =
            usuariosSeleccionados.indexOf(usuarioId);
          try {
            await apiService.addInvolucrado(siniestroId, {
              usuario_id: usuarioId,
              es_principal: indiceEnSeleccionados === 0, // El primero es principal
              activo: true,
            });
          } catch (error: any) {
            console.error(`Error al agregar usuario ${usuarioId}:`, error);
          }
        }

        // Actualizar es_principal para el primer usuario si cambió
        if (usuariosSeleccionados.length > 0) {
          const primerUsuarioId = usuariosSeleccionados[0];
          const relacionPrimerUsuario = usuariosActuales.find(
            (inv: any) => inv.usuario_id === primerUsuarioId,
          );
          if (relacionPrimerUsuario && !relacionPrimerUsuario.es_principal) {
            try {
              await apiService.updateInvolucrado(relacionPrimerUsuario.id, {
                es_principal: true,
              });
            } catch (error: any) {
              console.error(
                `Error al actualizar usuario principal ${relacionPrimerUsuario.id}:`,
                error
              );
            }
          }
        }

        await swalSuccess("Siniestro actualizado correctamente");
      } else {
        const nuevoSiniestro = await apiService.createSiniestro(payload as any);
        siniestroId = nuevoSiniestro.id;
        // Debug: verificar si el código está presente en la respuesta
        console.log("Siniestro creado:", {
          id: nuevoSiniestro.id,
          codigo: nuevoSiniestro.codigo,
          proveniente_id: payload.proveniente_id,
        });
        await swalSuccess("Siniestro creado correctamente");

        // Crear relaciones de áreas (TODAS) - Asegurar que todas se guarden
        console.log("Áreas a guardar:", areasIds);
        if (areasIds && areasIds.length > 0) {
          const areasErrors: string[] = [];
          const areasGuardadas: string[] = [];
          
          // Intentar guardar todas las áreas
          for (const areaId of areasIds) {
            if (!areaId) {
              console.warn("Área ID vacío, omitiendo...");
              continue;
            }
            try {
              console.log(`Agregando área ${areaId} al siniestro ${siniestroId}`);
              const resultado = await apiService.addAreaAdicional(siniestroId, {
                area_id: areaId,
                activo: true,
                fecha_asignacion: fechaAsignacionDateTime,
              });
              console.log(`Área ${areaId} agregada correctamente:`, resultado);
              areasGuardadas.push(areaId);
            } catch (error: any) {
              let errorMsg = `Error desconocido al agregar área ${areaId}`;
              
              // Intentar extraer el mensaje de error de diferentes formas
              try {
                if (error.response?.data) {
                  const data = error.response.data;
                  if (data.detail) {
                    if (typeof data.detail === 'string') {
                      errorMsg = data.detail;
                    } else if (typeof data.detail === 'object') {
                      // Si es un objeto, intentar extraer el mensaje
                      errorMsg = data.detail.message || data.detail.error || JSON.stringify(data.detail);
                    }
                  } else if (data.message) {
                    errorMsg = data.message;
                  } else if (data.error) {
                    errorMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
                  } else {
                    errorMsg = JSON.stringify(data);
                  }
                } else if (error.message) {
                  errorMsg = error.message;
                } else if (typeof error === 'string') {
                  errorMsg = error;
                } else {
                  // Como último recurso, convertir a string
                  try {
                    errorMsg = JSON.stringify(error, null, 2);
                  } catch {
                    errorMsg = String(error);
                  }
                }
              } catch (parseError) {
                console.error('Error al parsear el error:', parseError);
                errorMsg = `Error al procesar el error: ${String(error)}`;
              }
              
              console.error(`Error completo al agregar área ${areaId}:`, error);
              console.error(`Mensaje de error extraído:`, errorMsg);
              areasErrors.push(`Área ${areaId}: ${errorMsg}`);
            }
          }
          // Verificar que todas las áreas se guardaron
          if (areasErrors.length > 0) {
            await swalError(
              `${areasErrors.length} de ${areasIds.length} áreas no se pudieron guardar:\n${areasErrors.join('\n')}`
            );
          } else if (areasGuardadas.length !== areasIds.length) {
            await swalError(
              `No se pudieron guardar todas las áreas. Esperadas: ${areasIds.length}, Guardadas: ${areasGuardadas.length}`
            );
          } else {
            console.log(`✅ Todas las áreas se guardaron correctamente: ${areasGuardadas.length} áreas`);
          }
        } else {
          console.log("No hay áreas para guardar o areasIds está vacío");
        }

        // Crear relaciones de usuarios en siniestros_usuarios (TODOS, incluyendo el primero)
        if (usuariosIds.length > 0) {
          for (let i = 0; i < usuariosIds.length; i++) {
            try {
              await apiService.addInvolucrado(siniestroId, {
                usuario_id: usuariosIds[i],
                es_principal: i === 0, // El primero es principal
                activo: true,
              });
            } catch (error: any) {
              console.error(
                `Error al agregar usuario ${usuariosIds[i]}:`,
                error
              );
            }
          }
        }
      }

      loadSiniestros();
      router.push("/siniestros");
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al guardar siniestro");
    }
  };

  const deleteSiniestro = async (id: string) => {
    const confirmed = await swalConfirmDelete(
      "¿Está seguro de eliminar este siniestro? Esta acción no se puede deshacer."
    );
    if (!confirmed) return;
    try {
      await apiService.deleteSiniestro(id);
      await swalSuccess("Siniestro eliminado correctamente");
      loadSiniestros();
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al eliminar siniestro");
    }
  };

  // Función para mapear asegurados del catálogo a PersonaLigera
  const mapAseguradoToPersona = (asegurado: any): PersonaLigera => {
    return {
      id: asegurado.id,
      nombre: asegurado.nombre || "",
      apellido_paterno: asegurado.apellido_paterno || "",
      apellido_materno: asegurado.apellido_materno || "",
      email: asegurado.correo || "",
      telefono:
        asegurado.telefono ||
        asegurado.tel_oficina ||
        asegurado.tel_casa ||
        "",
      estado: asegurado.estado || "",
      ciudad: asegurado.ciudad || "",
    };
  };

  const aseguradosCatalog = useMemo<PersonaLigera[]>(() => {
    return (aseguradosCatalogo || []).map(mapAseguradoToPersona);
  }, [aseguradosCatalogo]);

  // Función para mapear provenientes del catálogo a PersonaLigera
  const mapProvenienteToPersona = (proveniente: any): PersonaLigera => {
    return {
      id: proveniente.id,
      nombre: proveniente.nombre || "",
      apellido_paterno: "",
      apellido_materno: "",
      email: proveniente.email || "",
      telefono: proveniente.telefono || "",
      estado: "",
      ciudad: "",
    };
  };

  const provenientesCatalog = useMemo<PersonaLigera[]>(() => {
    // Usar el catálogo de provenientes en lugar de filtrar usuarios
    return (provenientesCatalogo || []).map(mapProvenienteToPersona);
  }, [provenientesCatalogo]);

  // Funciones helper para obtener datos relacionados
  const getProvenienteNombre = (provenienteId?: string) => {
    if (!provenienteId) return "-";
    const proveniente = provenientesCatalogo.find(
      (p: any) => p.id === provenienteId
    );
    return proveniente?.nombre || "-";
  };

  const getProvenienteCodigo = (provenienteId?: string) => {
    if (!provenienteId) return "-";
    const proveniente = provenientesCatalogo.find(
      (p: any) => p.id === provenienteId
    );
    return proveniente?.codigo || "-";
  };

  const getAseguradoNombre = (aseguradoId?: string) => {
    if (!aseguradoId) return "-";
    // Normalizar IDs para comparación (por si vienen con diferentes formatos)
    const normalizedId = String(aseguradoId).trim();
    const asegurado = aseguradosCatalog.find((a) => String(a.id).trim() === normalizedId);
    if (!asegurado) {
      // Si no se encuentra, intentar buscar directamente en el catálogo original
      const aseguradoOriginal = aseguradosCatalogo.find((a: any) => String(a.id).trim() === normalizedId);
      if (aseguradoOriginal) {
        const full = [aseguradoOriginal.nombre, aseguradoOriginal.apellido_paterno, aseguradoOriginal.apellido_materno]
          .filter(Boolean)
          .join(" ");
        return full || aseguradoOriginal.correo || "-";
      }
      // Debug: solo loguear si hay asegurados cargados pero no se encuentra el ID
      if (aseguradosCatalogo.length > 0) {
        console.warn(`Asegurado no encontrado con ID: ${normalizedId}. Total asegurados cargados: ${aseguradosCatalogo.length}`);
      }
      return "-";
    }
    const nombreCompleto = [
      asegurado.nombre,
      asegurado.apellido_paterno,
      asegurado.apellido_materno,
    ]
      .filter(Boolean)
      .join(" ");
    return nombreCompleto || asegurado.email || "-";
  };

  const getAseguradoEmail = (aseguradoId?: string) => {
    if (!aseguradoId) return "-";
    // Normalizar IDs para comparación
    const normalizedId = String(aseguradoId).trim();
    const asegurado = aseguradosCatalog.find((a) => String(a.id).trim() === normalizedId);
    if (!asegurado) {
      // Si no se encuentra, intentar buscar directamente en el catálogo original
      const aseguradoOriginal = aseguradosCatalogo.find((a: any) => String(a.id).trim() === normalizedId);
      if (aseguradoOriginal) {
        return aseguradoOriginal.correo || "-";
      }
      return "-";
    }
    return asegurado?.email || "-";
  };

  const getInstitucionNombre = (institucionId?: string) => {
    if (!institucionId) return "-";
    const institucion = institucionesCatalogo.find(
      (i) => i.id === institucionId
    );
    return institucion?.nombre || "-";
  };

  const getAutoridadNombre = (autoridadId?: string) => {
    if (!autoridadId) return "-";
    const autoridad = autoridadesCatalogo.find((a) => a.id === autoridadId);
    return autoridad?.nombre || "-";
  };

  const getEstadoNombre = (estadoId?: string) => {
    return obtenerNombreEstado(estadoId, catalogosColores);
  };

  const getCalificacionNombre = (calificacionId?: string) => {
    return obtenerNombreCalificacion(calificacionId, catalogosColores);
  };

  const getFormaContactoLabel = (forma?: string) => {
    if (!forma) return "-";
    const labels: Record<string, string> = {
      correo: "Correo",
      telefono: "Teléfono",
      directa: "Directa",
    };
    return labels[forma] || forma;
  };

  const getUsuarioNombre = (userId?: string | null) => {
    if (!userId) return "-";
    const u = usuarios.find((x: any) => String(x.id) === String(userId));
    if (!u) return "-";
    const parts = [u.nombre, u.apellido_paterno, u.apellido_materno].filter(Boolean);
    if (parts.length) return parts.join(" ");
    return u.email || u.username || String(userId);
  };

  const fmtMonto = (n: number | null | undefined) => {
    if (n === undefined || n === null || Number.isNaN(Number(n))) return "—";
    return new Intl.NumberFormat("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(n));
  };

  const prioridadLabel = (p: string | undefined) => {
    if (!p) return "—";
    const m: Record<string, string> = {
      baja: "Baja",
      media: "Media",
      alta: "Alta",
      critica: "Crítica",
    };
    return m[p] || p;
  };

  const polizaPrincipalListado = (s: Siniestro): SiniestroPoliza | null => {
    const ps = s.polizas;
    if (!ps?.length) return null;
    const prim = ps.find((p) => p.es_principal);
    if (prim) return prim;
    return [...ps].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))[0] ?? null;
  };

  // Columnas de la tabla
  const columns: ColumnDef<Siniestro>[] = [
    {
      id: "acciones",
      header: "Acciones",
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex gap-2">
          {canVerDetalle && (
            <button
              onClick={() => router.push(`/siniestros/${row.original.id}`)}
              className="text-blue-600 hover:text-blue-800"
              title="Ver detalle"
            >
              <FiEye className="w-5 h-5" />
            </button>
          )}
          {canActualizarSiniestro && (
            <button
              onClick={() => openEdit(row.original)}
              className="text-primary-600 hover:text-primary-800"
              title="Editar"
            >
              <FiEdit2 className="w-5 h-5" />
            </button>
          )}
          {canEliminarSiniestro && (
            <button
              onClick={() => deleteSiniestro(row.original.id)}
              className="text-red-600 hover:text-red-800"
              title="Eliminar"
            >
              <FiTrash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      ),
    },
    {
      accessorKey: "estado_id",
      header: "Status",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        const estadoNombre = getEstadoNombre(row.original.estado_id);
        const estadoColor = obtenerColorEstado(
          row.original.estado_id,
          catalogosColores
        );
        const estilos = generarEstilosBadge(estadoColor);
        return (
          <span
            style={estilos}
            className={
              fluid
                ? "text-sm inline-block min-w-0 max-w-full break-words rounded-md"
                : "text-sm truncate inline-block max-w-[120px] rounded-md"
            }
            title={estadoNombre}
          >
            {estadoNombre}
          </span>
        );
      },
    },
    {
      accessorKey: "calificacion_id",
      header: "Calif.",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        const calificacionNombre = getCalificacionNombre(
          row.original.calificacion_id
        );
        const calificacionColor = obtenerColorCalificacion(
          row.original.calificacion_id,
          catalogosColores
        );
        const estilos = generarEstilosBadge(calificacionColor);
        return (
          <span
            style={estilos}
            className={
              fluid
                ? "text-sm inline-block min-w-0 max-w-full break-words rounded-md"
                : "text-sm truncate inline-block max-w-[160px] rounded-md"
            }
            title={calificacionNombre}
          >
            {calificacionNombre}
          </span>
        );
      },
    },
    {
      accessorKey: "codigo",
      header: "ID",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        const codigo =
          buildSiniestroIdLegible({
            id_formato: row.original.id_formato,
            codigoProveniente: getProvenienteCodigo(row.original.proveniente_id),
            codigoSiniestro: row.original.codigo,
            anualidad: row.original.anualidad,
            fecha_registro: row.original.fecha_registro,
            fecha_siniestro: row.original.fecha_siniestro,
          }) || "—";
        return (
          <span
            className={
              fluid
                ? "font-medium text-primary-600 block min-w-0 max-w-full break-words"
                : "font-medium text-primary-600 truncate block max-w-[120px]"
            }
            title={codigo !== "—" ? codigo : undefined}
          >
            {codigo}
          </span>
        );
      },
    },
    {
      accessorKey: "proveniente_id",
      header: "Proveniente",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        const nombre = getProvenienteNombre(row.original.proveniente_id);
        return (
          <span
            className={
              fluid
                ? "text-sm block min-w-0 max-w-full break-words"
                : "text-sm truncate block max-w-[150px]"
            }
            title={nombre}
          >
            {nombre}
          </span>
        );
      },
    },
    {
      accessorKey: "numero_reporte",
      header: "N° Reporte",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        return (
          <span
            className={
              fluid
                ? "text-sm block min-w-0 max-w-full break-words"
                : "text-sm truncate block max-w-[120px]"
            }
            title={row.original.numero_reporte || ""}
          >
            {row.original.numero_reporte || "-"}
          </span>
        );
      },
    },
    {
      accessorKey: "numero_siniestro",
      header: "N° Siniestro",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        return (
          <span
            className={
              fluid
                ? "font-medium text-primary-600 block min-w-0 max-w-full break-words"
                : "font-medium text-primary-600 truncate block max-w-[120px]"
            }
            title={row.original.numero_siniestro || ""}
          >
            {row.original.numero_siniestro || "-"}
          </span>
        );
      },
    },
    {
      accessorKey: "asegurado_id",
      header: "Asegurado",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        const nombre = getAseguradoNombre(row.original.asegurado_id);
        return (
          <span
            className={
              fluid
                ? "text-sm block min-w-0 max-w-full break-words"
                : "text-sm truncate block max-w-[180px]"
            }
            title={nombre}
          >
            {nombre}
          </span>
        );
      },
    },
    {
      accessorKey: "asegurado_email",
      header: "Email Aseg.",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        const email = getAseguradoEmail(row.original.asegurado_id);
        return (
          <span
            className={
              fluid
                ? "text-sm block min-w-0 max-w-full break-words"
                : "text-sm truncate block max-w-[180px]"
            }
            title={email}
          >
            {email}
          </span>
        );
      },
    },
    {
      accessorKey: "institucion_id",
      header: "Institución",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        const nombre = getInstitucionNombre(row.original.institucion_id);
        return (
          <span
            className={
              fluid
                ? "text-sm block min-w-0 max-w-full break-words"
                : "text-sm truncate block max-w-[150px]"
            }
            title={nombre}
          >
            {nombre}
          </span>
        );
      },
    },
    {
      accessorKey: "autoridad_id",
      header: "Autoridad",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        const nombre = getAutoridadNombre(row.original.autoridad_id);
        return (
          <span
            className={
              fluid
                ? "text-sm block min-w-0 max-w-full break-words"
                : "text-sm truncate block max-w-[150px]"
            }
            title={nombre}
          >
            {nombre}
          </span>
        );
      },
    },
    {
      accessorKey: "fecha_registro",
      header: "Fecha reporte",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        const raw =
          row.original.fecha_registro || row.original.fecha_siniestro;
        if (!raw) return <span className="text-sm">—</span>;
        return (
          <span
            className={
              fluid
                ? "text-sm block min-w-0 max-w-full break-words"
                : "text-sm truncate block max-w-[100px]"
            }
          >
            {new Date(raw).toLocaleDateString("es-MX")}
          </span>
        );
      },
    },
    {
      accessorKey: "ubicacion",
      header: "Dirección",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        return (
          <span
            className={
              fluid
                ? "text-sm block min-w-0 max-w-full break-words"
                : "text-sm truncate block max-w-[200px]"
            }
            title={row.original.ubicacion || ""}
          >
            {row.original.ubicacion || "-"}
          </span>
        );
      },
    },
    {
      accessorKey: "forma_contacto",
      header: "Contacto",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        const label = getFormaContactoLabel(row.original.forma_contacto);
        return (
          <span
            className={
              fluid
                ? "text-sm block min-w-0 max-w-full break-words"
                : "text-sm truncate block max-w-[100px]"
            }
            title={label}
          >
            {label}
          </span>
        );
      },
    },
    {
      accessorKey: "creado_en",
      header: "Creado",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        return (
          <span
            className={
              fluid
                ? "text-sm block min-w-0 max-w-full break-words"
                : "text-sm truncate block max-w-[100px]"
            }
          >
            {row.original.creado_en
              ? new Date(row.original.creado_en).toLocaleDateString("es-MX")
              : "-"}
          </span>
        );
      },
    },
    {
      id: "id_interno",
      accessorKey: "id",
      meta: { columnPickerLabel: "ID sistema" },
      header: "ID sistema",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        const id = row.original.id;
        return (
          <span
            className={
              fluid
                ? "font-mono text-xs block min-w-0 max-w-full break-all text-gray-600"
                : "font-mono text-xs truncate block max-w-[100px] text-gray-600"
            }
            title={id}
          >
            {id}
          </span>
        );
      },
    },
    {
      id: "poliza_numero",
      accessorFn: (row) => polizaPrincipalListado(row)?.numero_poliza ?? "",
      header: "N° Póliza",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        const v = polizaPrincipalListado(row.original)?.numero_poliza || "—";
        return (
          <span
            className={
              fluid
                ? "text-sm block min-w-0 max-w-full break-words"
                : "text-sm truncate block max-w-[120px]"
            }
            title={v !== "—" ? v : undefined}
          >
            {v}
          </span>
        );
      },
    },
    {
      id: "poliza_deducible",
      accessorFn: (row) => Number(polizaPrincipalListado(row)?.deducible ?? 0),
      header: "Deducible",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {fmtMonto(polizaPrincipalListado(row.original)?.deducible)}
        </span>
      ),
    },
    {
      id: "poliza_reserva",
      accessorFn: (row) => Number(polizaPrincipalListado(row)?.reserva ?? 0),
      header: "Reserva",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {fmtMonto(polizaPrincipalListado(row.original)?.reserva)}
        </span>
      ),
    },
    {
      id: "poliza_coaseguro",
      accessorFn: (row) => Number(polizaPrincipalListado(row)?.coaseguro ?? 0),
      header: "Coaseguro",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {fmtMonto(polizaPrincipalListado(row.original)?.coaseguro)}
        </span>
      ),
    },
    {
      id: "poliza_suma_asegurada",
      accessorFn: (row) => Number(polizaPrincipalListado(row)?.suma_asegurada ?? 0),
      header: "Suma asegurada",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {fmtMonto(polizaPrincipalListado(row.original)?.suma_asegurada)}
        </span>
      ),
    },
    {
      accessorKey: "prioridad",
      header: "Prioridad",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        const label = prioridadLabel(row.original.prioridad);
        return (
          <span
            className={
              fluid
                ? "text-sm block min-w-0 max-w-full break-words capitalize"
                : "text-sm truncate block max-w-[90px] capitalize"
            }
          >
            {label}
          </span>
        );
      },
    },
    {
      accessorKey: "activo",
      header: "Activo",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.activo ? "Sí" : "No"}</span>
      ),
    },
    {
      accessorKey: "fecha_siniestro",
      meta: { columnPickerLabel: "Fecha siniestro (legado)" },
      header: "Fecha siniestro",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        const raw = row.original.fecha_siniestro;
        if (!raw) return <span className="text-sm">—</span>;
        return (
          <span
            className={
              fluid
                ? "text-sm block min-w-0 max-w-full break-words"
                : "text-sm truncate block max-w-[100px]"
            }
          >
            {new Date(raw).toLocaleDateString("es-MX")}
          </span>
        );
      },
    },
    {
      id: "anualidad_display",
      accessorFn: (row) => getSiniestroAnualidadDisplay(row),
      header: "Anualidad",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        const v = getSiniestroAnualidadDisplay(row.original);
        return (
          <span
            className={
              fluid
                ? "text-sm block min-w-0 max-w-full break-words"
                : "text-sm truncate block max-w-[80px]"
            }
          >
            {v}
          </span>
        );
      },
    },
    {
      accessorKey: "descripcion_hechos",
      header: "Descripción hechos",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        const v = row.original.descripcion_hechos || "—";
        return (
          <span
            className={
              fluid
                ? "text-sm block min-w-0 max-w-full break-words whitespace-pre-wrap"
                : "text-sm truncate block max-w-[220px]"
            }
            title={!fluid && v !== "—" ? v : undefined}
          >
            {v}
          </span>
        );
      },
    },
    {
      accessorKey: "observaciones",
      header: "Observaciones",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        const v = row.original.observaciones?.trim() || "—";
        return (
          <span
            className={
              fluid
                ? "text-sm block min-w-0 max-w-full break-words whitespace-pre-wrap"
                : "text-sm truncate block max-w-[220px]"
            }
            title={!fluid && v !== "—" ? v : undefined}
          >
            {v}
          </span>
        );
      },
    },
    {
      accessorKey: "creado_por",
      header: "Creado por",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        const nombre = getUsuarioNombre(row.original.creado_por);
        return (
          <span
            className={
              fluid
                ? "text-sm block min-w-0 max-w-full break-words"
                : "text-sm truncate block max-w-[140px]"
            }
            title={nombre}
          >
            {nombre}
          </span>
        );
      },
    },
    {
      accessorKey: "actualizado_en",
      header: "Actualizado",
      cell: ({ row, table }) => {
        const fluid = isDataTableFluidLayout(table);
        return (
          <span
            className={
              fluid
                ? "text-sm block min-w-0 max-w-full break-words"
                : "text-sm truncate block max-w-[100px]"
            }
          >
            {row.original.actualizado_en
              ? new Date(row.original.actualizado_en).toLocaleString("es-MX", {
                  dateStyle: "short",
                  timeStyle: "short",
                })
              : "-"}
          </span>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Cargando...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen w-full bg-gray-50 py-4 lg:py-6">
      <div className="container-app w-full">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:mb-6">
          <h1 className="text-fluid-2xl font-bold text-gray-900 sm:text-3xl">
            Siniestros
          </h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <TourButton tour="tour-siniestros" label="Ver guía" />
            {canCrearSiniestro && (
              <Button
                data-tour="siniestros-nuevo"
                onClick={() => router.push("/siniestros/nuevo")}
                className="w-full sm:w-auto"
              >
                Nuevo Siniestro
              </Button>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div
          data-tour="siniestros-filtros"
          className="bg-white p-4 sm:p-5 rounded-lg shadow mb-4 lg:mb-6"
        >
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
            Filtros
          </h2>
          {dashboardFilterLabels.length > 0 && (
            <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium text-sky-900">
                    Filtros aplicados desde el dashboard
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {dashboardFilterLabels.map((label) => (
                      <span
                        key={label}
                        className="rounded-full bg-white px-3 py-1 text-xs font-medium text-sky-700 shadow-sm"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center justify-center rounded-md border border-sky-300 bg-white px-3 py-2 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-100"
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-3 sm:gap-4">
            <CustomSelect
              label="Actividad"
              name="activo"
              value={filtros.activo}
              isClearable={false}
              onChange={(value) => {
                const v = (value || "true") as ActivoFilterValue;
                setFiltros((prev) => {
                  const next = { ...prev, activo: v };
                  // Duplicados inactivos suelen tener otro estado_id que el activo; con Status
                  // aplicado la API devolvía 0 filas. «Todos»: solo quitamos status (se mantiene
                  // area_id por enlaces del dashboard). «Solo inactivos»: también área/asignación,
                  // que suelen no coincidir con la fila inactiva.
                  if (v === "all") {
                    next.estado_id = "";
                  }
                  if (v === "false") {
                    next.estado_id = "";
                    next.area_id = "";
                    next.usuario_asignado = "";
                  }
                  return next;
                });
              }}
              options={[
                { value: "all", label: "Todos" },
                { value: "true", label: "Solo activos" },
                { value: "false", label: "Solo inactivos" },
              ]}
              placeholder="Solo activos"
            />
            <CustomSelect
              label="Status"
              name="estado_id"
              value={filtros.estado_id}
              onChange={(value) =>
                setFiltros({ ...filtros, estado_id: value as string })
              }
              options={[
                { value: "", label: "Todos" },
                ...estados.map((estado) => ({
                  value: estado.id,
                  label: estado.nombre,
                })),
              ]}
              placeholder="Todos"
            />
            <CustomSelect
              label="Proveniente"
              name="proveniente_id"
              value={filtros.proveniente_id}
              onChange={(value) =>
                setFiltros({ ...filtros, proveniente_id: value as string })
              }
              options={[
                { value: "", label: "Todos" },
                ...(provenientesCatalogo || []).map((p: any) => ({
                  value: String(p.id || ""),
                  label: p.nombre || String(p.id) || "Sin nombre",
                })),
              ]}
              placeholder="Todos"
            />
            <CustomSelect
              label="Área"
              name="area_id"
              value={filtros.area_id}
              onChange={(value) =>
                setFiltros({ ...filtros, area_id: value as string })
              }
              options={[
                { value: "", label: "Todas" },
                ...areas.map((area) => ({
                  value: area.id,
                  label: area.nombre,
                })),
              ]}
              placeholder="Todas"
            />
            <CustomSelect
              label="Prioridad"
              name="prioridad"
              value={filtros.prioridad}
              onChange={(value) =>
                setFiltros({ ...filtros, prioridad: value as any })
              }
              options={[
                { value: "", label: "Todas" },
                { value: "baja", label: "Baja" },
                { value: "media", label: "Media" },
                { value: "alta", label: "Alta" },
                { value: "critica", label: "Crítica" },
              ]}
              placeholder="Todas"
            />
            <CustomSelect
              label="Calificación"
              name="calificacion_id"
              value={filtros.calificacion_id}
              onChange={(value) =>
                setFiltros({ ...filtros, calificacion_id: value as string })
              }
              options={[
                { value: "", label: "Todas" },
                ...calificacionesCatalogo.map((calificacion) => ({
                  value: calificacion.id,
                  label: calificacion.nombre,
                })),
              ]}
              placeholder="Todas"
            />
            <CustomSelect
              label="Usuario"
              name="usuario_asignado"
              value={filtros.usuario_asignado}
              onChange={(value) =>
                setFiltros({ ...filtros, usuario_asignado: value as string })
              }
              options={[
                { value: "", label: "Todos" },
                ...usuarios.map((usuario) => ({
                  value: usuario.id,
                  label: usuario.email,
                })),
              ]}
              placeholder="Todos"
            />
          </div>
          {/* Selector de límite de registros */}
          <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">
                Límite de registros:
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
                <option value={2000}>2000</option>
                <option value={5000}>5000</option>
              </select>
            </div>
            <span className="text-sm text-gray-500">
              (Total cargados: {siniestros.length})
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Restablecer filtros
            </button>
          </div>
        </div>

        {/* Tabla */}
        <div
          data-tour="siniestros-tabla"
          className="bg-white rounded-lg shadow overflow-x-auto"
        >
          {siniestrosLoading ? (
            <div className="p-8 text-center text-gray-500">
              Cargando siniestros...
            </div>
          ) : (
            <DataTable
              layoutStorageKey="aslin-datatable-siniestros-listado"
              enableColumnVisibility
              columns={columns}
              data={siniestros}
              emptyText="No hay siniestros"
              size="compact"
            />
          )}
        </div>
      </div>
    </div>
  );
}

