/**
 * Página de detalle de Siniestro
 * Muestra las etapas organizadas por área y flujo de trabajo
 * Permite editar documentos desde plantillas
 */

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/context/UserContext";
import apiService from "@/lib/apiService";
import { swalError, swalSuccess, swalConfirm } from "@/lib/swal";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import TiptapEditor from "@/components/ui/TiptapEditor";
import DataTable from "@/components/ui/DataTable";
import Input from "@/components/ui/Input";
import { ColumnDef } from "@tanstack/react-table";
import {
  useEmpresaColors,
  EmpresaTabs,
  EmpresaBadge,
  EmpresaCard,
  EmpresaIconButton,
  EmpresaButton,
  EmpresaSelect,
} from "@/components/ui";
import type { EstadoSiniestro, CalificacionSiniestro } from "@/types/legal";
import {
  FiArrowLeft,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiLayers,
  FiFileText,
  FiEdit3,
  FiSave,
  FiEye,
  FiFolder,
  FiPlus,
  FiTrash2,
  FiUser,
  FiShield,
  FiMapPin,
  FiMail,
  FiPhone,
  FiInfo,
  FiDollarSign,
  FiCalendar,
  FiFile,
  FiList,
  FiActivity,
} from "react-icons/fi";
import type { Siniestro } from "@/types/siniestros";
import type {
  SiniestroArea,
  SiniestroUsuario,
} from "@/types/siniestrosRelaciones";
import type {
  FlujoTrabajo,
  FlujoCompleto,
  EtapaFlujo,
} from "@/types/flujosTrabajo";
import type { BitacoraActividad } from "@/types/bitacora";

interface AreaConFlujos {
  area: {
    id: string;
    nombre: string;
  };
  flujos: FlujoConEtapas[];
}

interface FlujoConEtapas {
  flujo: FlujoTrabajo;
  etapas: EtapaFlujo[];
}

interface FlujosGenerales {
  flujos: FlujoConEtapas[];
}

interface PlantillaDocumento {
  id: string;
  nombre: string;
  descripcion?: string;
  contenido?: string;
  tipo_documento_id: string;
  categoria_id?: string;
}

interface DocumentoEtapa {
  id: string;
  nombre_archivo: string;
  contenido?: string;
  etapa_flujo_id: string;
  plantilla_documento_id?: string;
  version: number;
  creado_en: string;
}

export default function SiniestroDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: userLoading } = useUser();
  const siniestroId = params.id as string;

  // Obtener colores de la empresa usando el hook
  const empresaColors = useEmpresaColors();

  const [siniestro, setSiniestro] = useState<Siniestro | null>(null);
  const [siniestroLoading, setSiniestroLoading] = useState(false);
  const [areasConFlujos, setAreasConFlujos] = useState<AreaConFlujos[]>([]);
  const [flujosGenerales, setFlujosGenerales] =
    useState<FlujosGenerales | null>(null);
  const [loadingFlujos, setLoadingFlujos] = useState(false);
  const [activeAreaTab, setActiveAreaTab] = useState<string>("");
  const [activeFlujoTab, setActiveFlujoTab] = useState<string>("");

  // Estado para el modal de edición de documento
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [savingDocument, setSavingDocument] = useState(false);
  const [currentEtapa, setCurrentEtapa] = useState<EtapaFlujo | null>(null);
  const [documentoContenido, setDocumentoContenido] = useState<string>("");
  const [documentoExistente, setDocumentoExistente] =
    useState<DocumentoEtapa | null>(null);
  const [plantillaActual, setPlantillaActual] =
    useState<PlantillaDocumento | null>(null);

  // Estado para modal de visualización de PDF
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState<string>("");
  const [documentosExistentes, setDocumentosExistentes] = useState<
    DocumentoEtapa[]
  >([]);

  // Estado para tabs internos (Etapas, Documentos, Bitácora)
  const [activeContentTab, setActiveContentTab] = useState<
    "etapas" | "documentos" | "bitacora"
  >("etapas");

  // Estados para documentos y bitácoras filtradas por área/flujo
  const [documentosFiltrados, setDocumentosFiltrados] = useState<any[]>([]);
  const [bitacorasFiltradas, setBitacorasFiltradas] = useState<any[]>([]);
  const [loadingDocumentos, setLoadingDocumentos] = useState(false);
  const [loadingBitacoras, setLoadingBitacoras] = useState(false);

  // Estados para status y calificación
  const [estadosSiniestro, setEstadosSiniestro] = useState<EstadoSiniestro[]>(
    []
  );
  const [calificacionesSiniestro, setCalificacionesSiniestro] = useState<
    CalificacionSiniestro[]
  >([]);
  const [loadingEstados, setLoadingEstados] = useState(false);
  const [loadingCalificaciones, setLoadingCalificaciones] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingCalificacion, setUpdatingCalificacion] = useState(false);

  // Estados para información adicional
  const [aseguradoInfo, setAseguradoInfo] = useState<any>(null);
  const [institucionInfo, setInstitucionInfo] = useState<any>(null);
  const [autoridadInfo, setAutoridadInfo] = useState<any>(null);
  const [provenienteInfo, setProvenienteInfo] = useState<any>(null);
  const [loadingInfoAdicional, setLoadingInfoAdicional] = useState(false);

  // Estados para modal de edición
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingSiniestro, setSavingSiniestro] = useState(false);
  const [editForm, setEditForm] = useState({
    numero_siniestro: "",
    fecha_siniestro: "",
    ubicacion: "",
    numero_poliza: "",
    deducible: 0,
    reserva: 0,
    coaseguro: 0,
    suma_asegurada: 0,
    prioridad: "baja" as "baja" | "media" | "alta" | "critica",
    forma_contacto: "correo" as "correo" | "telefono" | "directa",
    numero_reporte: "",
    observaciones: "",
  });

  // Estados para administrar áreas e involucrados
  const [areasAdicionales, setAreasAdicionales] = useState<SiniestroArea[]>([]);
  const [involucrados, setInvolucrados] = useState<SiniestroUsuario[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingInvolucrados, setLoadingInvolucrados] = useState(false);
  const [todasLasAreas, setTodasLasAreas] = useState<any[]>([]);
  const [todosLosUsuarios, setTodosLosUsuarios] = useState<any[]>([]);

  // Estados para modal de edición de póliza
  const [showPolizaModal, setShowPolizaModal] = useState(false);
  const [savingPoliza, setSavingPoliza] = useState(false);
  const [polizaForm, setPolizaForm] = useState({
    numero_poliza: "",
    suma_asegurada: 0,
    deducible: 0,
    reserva: 0,
    coaseguro: 0,
  });

  // Estados para log de auditoría
  const [logsAuditoria, setLogsAuditoria] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Autenticación
  useEffect(() => {
    if (userLoading) return;
    const token = localStorage.getItem("token");
    if (!token || !user) {
      router.push("/login");
    }
  }, [router, userLoading, user]);

  // Cargar datos
  useEffect(() => {
    if (user && siniestroId) {
      loadSiniestro();
    }
  }, [user, siniestroId]);

  // Cargar flujos cuando se carguen las áreas
  useEffect(() => {
    if (siniestro) {
      loadFlujosPorAreas();
    }
  }, [siniestro]);

  // Cargar estados y calificaciones cuando se carga el siniestro
  useEffect(() => {
    if (user && siniestro) {
      loadEstadosSiniestro();
      loadCalificacionesSiniestro();
    }
  }, [user, siniestro]);

  // Determinar la pestaña activa inicial
  useEffect(() => {
    if (loadingFlujos) return;

    // Si hay áreas, empezar con la primera área
    if (areasConFlujos.length > 0 && activeAreaTab === "") {
      const primeraArea = areasConFlujos[0];
      setActiveAreaTab(primeraArea.area.id);

      // Determinar el primer flujo a mostrar
      if (flujosGenerales && flujosGenerales.flujos.length > 0) {
        setActiveFlujoTab(`general-${flujosGenerales.flujos[0].flujo.id}`);
      } else if (primeraArea.flujos.length > 0) {
        setActiveFlujoTab(`area-${primeraArea.flujos[0].flujo.id}`);
      }
    }
  }, [loadingFlujos, flujosGenerales, areasConFlujos]);

  // Cargar documentos y bitácoras cuando cambia el área o flujo activo
  useEffect(() => {
    if (!activeFlujoTab) return;

    let areaId: string | undefined = undefined;
    let flujoTrabajoId: string | undefined = undefined;

    if (activeFlujoTab.startsWith("general-")) {
      flujoTrabajoId = activeFlujoTab.replace("general-", "");
    } else if (activeFlujoTab.startsWith("area-")) {
      flujoTrabajoId = activeFlujoTab.replace("area-", "");
      areaId = activeAreaTab;
    }

    // Cargar documentos y bitácoras filtradas
    loadDocumentosFiltrados(areaId, flujoTrabajoId);
    loadBitacorasFiltradas(areaId, flujoTrabajoId);
  }, [activeAreaTab, activeFlujoTab]);

  // Cargar áreas e involucrados cuando se carga el siniestro
  useEffect(() => {
    if (siniestro && siniestroId) {
      loadAreasAdicionales();
      loadInvolucrados();
      loadLogsAuditoria();
    }
  }, [siniestro, siniestroId]);

  const loadSiniestro = async () => {
    try {
      setSiniestroLoading(true);
      // Validar que siniestroId sea un UUID válido, no "nuevo"
      if (
        siniestroId === "nuevo" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          siniestroId
        )
      ) {
        router.push("/siniestros");
        return;
      }
      const data = await apiService.getSiniestroById(siniestroId);
      setSiniestro(data);

      // Cargar documentos del siniestro
      await loadDocumentosSiniestro();

      // Cargar información adicional
      await loadInfoAdicional(data);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      if (e.response?.status === 404) {
        swalError("Siniestro no encontrado");
        router.push("/siniestros");
        return;
      }
      swalError(e.response?.data?.detail || "Error al cargar siniestro");
    } finally {
      setSiniestroLoading(false);
    }
  };

  const loadDocumentosSiniestro = async () => {
    try {
      const documentos = await apiService.getDocumentosSiniestro(siniestroId, {
        activo: true,
      });
      setDocumentosExistentes(documentos);
    } catch (error: any) {
      console.error("Error al cargar documentos:", error);
    }
  };

  // Cargar información adicional del siniestro
  const loadInfoAdicional = async (siniestroData: Siniestro) => {
    try {
      setLoadingInfoAdicional(true);

      // Cargar información del asegurado
      if (siniestroData.asegurado_id) {
        try {
          const asegurado = await apiService.getUserById(
            siniestroData.asegurado_id
          );
          setAseguradoInfo(asegurado);
        } catch (e) {
          console.error("Error al cargar asegurado:", e);
        }
      }

      // Cargar información de institución
      if (siniestroData.institucion_id) {
        try {
          const instituciones = await apiService.getInstituciones();
          const institucion = instituciones.find(
            (inst: any) => inst.id === siniestroData.institucion_id
          );
          if (institucion) setInstitucionInfo(institucion);
        } catch (e) {
          console.error("Error al cargar institución:", e);
        }
      }

      // Cargar información de autoridad
      if (siniestroData.autoridad_id) {
        try {
          const autoridades = await apiService.getAutoridades();
          const autoridad = autoridades.find(
            (auth: any) => auth.id === siniestroData.autoridad_id
          );
          if (autoridad) setAutoridadInfo(autoridad);
        } catch (e) {
          console.error("Error al cargar autoridad:", e);
        }
      }

      // Cargar información de proveniente
      if (siniestroData.proveniente_id) {
        try {
          const provenientes = await apiService.getProvenientes();
          const proveniente = provenientes.find(
            (prov: any) => prov.id === siniestroData.proveniente_id
          );
          if (proveniente) setProvenienteInfo(proveniente);
        } catch (e) {
          console.error("Error al cargar proveniente:", e);
        }
      }
    } catch (error: any) {
      console.error("Error al cargar información adicional:", error);
    } finally {
      setLoadingInfoAdicional(false);
    }
  };

  // Cargar documentos filtrados por área y flujo
  const loadDocumentosFiltrados = async (
    areaId?: string,
    flujoTrabajoId?: string
  ) => {
    try {
      setLoadingDocumentos(true);
      const documentos = await apiService.getDocumentosSiniestro(siniestroId, {
        activo: true,
        area_id: areaId,
        flujo_trabajo_id: flujoTrabajoId,
      });
      setDocumentosFiltrados(documentos);
    } catch (error: any) {
      console.error("Error al cargar documentos filtrados:", error);
    } finally {
      setLoadingDocumentos(false);
    }
  };

  // Cargar bitácoras filtradas por área y flujo
  const loadBitacorasFiltradas = async (
    areaId?: string,
    flujoTrabajoId?: string
  ) => {
    try {
      setLoadingBitacoras(true);
      const bitacoras = await apiService.getBitacoraSiniestro(siniestroId, {
        area_id: areaId,
        flujo_trabajo_id: flujoTrabajoId,
      });
      setBitacorasFiltradas(bitacoras);
    } catch (error: any) {
      console.error("Error al cargar bitácoras filtradas:", error);
    } finally {
      setLoadingBitacoras(false);
    }
  };

  // Cargar estados de siniestro
  const loadEstadosSiniestro = async () => {
    try {
      setLoadingEstados(true);
      // Cargar todos los estados activos
      const estados = await apiService.getEstadosSiniestro(true);
      console.log("Estados cargados:", estados);
      console.log("Estado actual del siniestro:", siniestro?.estado_id);
      setEstadosSiniestro(estados);
    } catch (error: any) {
      console.error("Error al cargar estados de siniestro:", error);
      console.error("Error response:", error.response);
      swalError(
        error.response?.data?.detail || "Error al cargar estados de siniestro"
      );
    } finally {
      setLoadingEstados(false);
    }
  };

  // Cargar calificaciones de siniestro
  const loadCalificacionesSiniestro = async () => {
    try {
      setLoadingCalificaciones(true);
      // Cargar todas las calificaciones activas
      const calificaciones = await apiService.getCalificacionesSiniestro(true);
      console.log("Calificaciones cargadas:", calificaciones);
      console.log(
        "Calificación actual del siniestro:",
        siniestro?.calificacion_id
      );
      setCalificacionesSiniestro(calificaciones);
    } catch (error: any) {
      console.error("Error al cargar calificaciones de siniestro:", error);
      console.error("Error response:", error.response);
      swalError(
        error.response?.data?.detail ||
          "Error al cargar calificaciones de siniestro"
      );
    } finally {
      setLoadingCalificaciones(false);
    }
  };

  // Actualizar estado del siniestro
  const handleUpdateEstado = async (estadoId: string) => {
    if (!siniestro) return;

    try {
      setUpdatingStatus(true);
      await apiService.updateSiniestro(siniestroId, {
        estado_id: estadoId || undefined,
      });
      // Recargar el siniestro para obtener los datos actualizados
      await loadSiniestro();
      swalSuccess("Estado actualizado correctamente");
    } catch (error: any) {
      console.error("Error al actualizar estado:", error);
      swalError(error.response?.data?.detail || "Error al actualizar estado");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Actualizar calificación del siniestro
  const handleUpdateCalificacion = async (calificacionId: string) => {
    if (!siniestro) return;

    try {
      setUpdatingCalificacion(true);
      const updateData: any = {
        calificacion_id: calificacionId || undefined,
      };
      await apiService.updateSiniestro(siniestroId, updateData);
      // Recargar el siniestro para obtener los datos actualizados
      await loadSiniestro();
      swalSuccess("Calificación actualizada correctamente");
    } catch (error: any) {
      console.error("Error al actualizar calificación:", error);
      swalError(
        error.response?.data?.detail || "Error al actualizar calificación"
      );
    } finally {
      setUpdatingCalificacion(false);
    }
  };

  // Abrir modal de edición
  const handleOpenEditModal = () => {
    if (!siniestro) return;

    // Formatear fecha para el input de tipo date
    const fechaSiniestro = siniestro.fecha_siniestro
      ? new Date(siniestro.fecha_siniestro).toISOString().split("T")[0]
      : "";

    setEditForm({
      numero_siniestro: siniestro.numero_siniestro || "",
      fecha_siniestro: fechaSiniestro,
      ubicacion: siniestro.ubicacion || "",
      numero_poliza: siniestro.numero_poliza || "",
      deducible: siniestro.deducible || 0,
      reserva: siniestro.reserva || 0,
      coaseguro: siniestro.coaseguro || 0,
      suma_asegurada: siniestro.suma_asegurada || 0,
      prioridad: siniestro.prioridad || "baja",
      forma_contacto: siniestro.forma_contacto || "correo",
      numero_reporte: siniestro.numero_reporte || "",
      observaciones: siniestro.observaciones || "",
    });
    setShowEditModal(true);
  };

  // Guardar cambios del siniestro
  const handleSaveSiniestro = async () => {
    if (!siniestro) return;

    try {
      setSavingSiniestro(true);

      // Preparar datos para actualizar
      const updateData: any = {
        numero_siniestro: editForm.numero_siniestro || undefined,
        fecha_siniestro: editForm.fecha_siniestro || undefined,
        ubicacion: editForm.ubicacion || undefined,
        numero_poliza: editForm.numero_poliza || undefined,
        deducible: editForm.deducible || undefined,
        reserva: editForm.reserva || undefined,
        coaseguro: editForm.coaseguro || undefined,
        suma_asegurada: editForm.suma_asegurada || undefined,
        prioridad: editForm.prioridad || undefined,
        forma_contacto: editForm.forma_contacto || undefined,
        numero_reporte: editForm.numero_reporte || undefined,
        observaciones: editForm.observaciones || undefined,
      };

      await apiService.updateSiniestro(siniestroId, updateData);

      // Recargar el siniestro para obtener los datos actualizados
      await loadSiniestro();

      setShowEditModal(false);
      swalSuccess("Siniestro actualizado correctamente");
    } catch (error: any) {
      console.error("Error al actualizar siniestro:", error);
      swalError(
        error.response?.data?.detail || "Error al actualizar siniestro"
      );
    } finally {
      setSavingSiniestro(false);
    }
  };

  // Manejar cambio en el formulario
  const handleEditFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]:
        name === "deducible" ||
        name === "reserva" ||
        name === "coaseguro" ||
        name === "suma_asegurada"
          ? parseFloat(value) || 0
          : value,
    }));
  };

  const loadFlujosPorAreas = async () => {
    if (!siniestro) return;

    try {
      setLoadingFlujos(true);

      // 1. Cargar flujos generales (sin área - area_id = null)
      try {
        const flujosGeneralesData: FlujoTrabajo[] = await apiService.getFlujos(
          "null",
          true
        );
        const flujosGeneralesConEtapas: FlujoConEtapas[] = [];

        for (const flujo of flujosGeneralesData) {
          try {
            const flujoCompleto: FlujoCompleto = await apiService.getFlujoById(
              flujo.id
            );
            flujosGeneralesConEtapas.push({
              flujo: flujoCompleto,
              etapas: flujoCompleto.etapas || [],
            });
          } catch (error: any) {
            console.error(`Error al cargar flujo general ${flujo.id}:`, error);
            flujosGeneralesConEtapas.push({
              flujo,
              etapas: [],
            });
          }
        }

        if (flujosGeneralesConEtapas.length > 0) {
          setFlujosGenerales({ flujos: flujosGeneralesConEtapas });
        }
      } catch (error: any) {
        console.error("Error al cargar flujos generales:", error);
      }

      // 2. Cargar áreas del siniestro
      const areasAdicionales: SiniestroArea[] =
        await apiService.getAreasAdicionales(siniestroId, true);

      // 3. Cargar todas las áreas disponibles para obtener nombres
      const todasLasAreas = await apiService.getAreas(true);
      const areasMap = new Map(todasLasAreas.map((a: any) => [a.id, a]));

      // 4. Construir lista de áreas únicas (incluyendo área principal si existe)
      const areasUnicas = new Map<string, { id: string; nombre: string }>();

      // Agregar área principal si existe (verificar si viene en la respuesta de la API)
      const siniestroWithArea = siniestro as any;
      if (siniestroWithArea.area_principal_id) {
        const areaPrincipal = areasMap.get(siniestroWithArea.area_principal_id);
        if (
          areaPrincipal &&
          typeof areaPrincipal === "object" &&
          "nombre" in areaPrincipal
        ) {
          areasUnicas.set(String(siniestroWithArea.area_principal_id), {
            id: String(siniestroWithArea.area_principal_id),
            nombre: String((areaPrincipal as any).nombre),
          });
        }
      }

      // Agregar áreas adicionales
      for (const areaAdicional of areasAdicionales) {
        if (areaAdicional.area_id && !areasUnicas.has(areaAdicional.area_id)) {
          const area = areasMap.get(areaAdicional.area_id);
          if (area && typeof area === "object" && "nombre" in area) {
            areasUnicas.set(areaAdicional.area_id, {
              id: areaAdicional.area_id,
              nombre: String((area as any).nombre),
            });
          }
        }
      }

      // 5. Para cada área, cargar sus flujos y etapas
      const areasConFlujosData: AreaConFlujos[] = [];

      for (const [areaId, areaInfo] of areasUnicas) {
        try {
          // Cargar flujos de esta área específica
          const flujos: FlujoTrabajo[] = await apiService.getFlujos(
            areaId,
            true
          );

          // Para cada flujo, cargar sus etapas
          const flujosConEtapas: FlujoConEtapas[] = [];

          for (const flujo of flujos) {
            try {
              const flujoCompleto: FlujoCompleto =
                await apiService.getFlujoById(flujo.id);
              flujosConEtapas.push({
                flujo: flujoCompleto,
                etapas: flujoCompleto.etapas || [],
              });
            } catch (error: any) {
              console.error(`Error al cargar flujo ${flujo.id}:`, error);
              // Agregar flujo sin etapas si falla
              flujosConEtapas.push({
                flujo,
                etapas: [],
              });
            }
          }

          areasConFlujosData.push({
            area: areaInfo,
            flujos: flujosConEtapas,
          });
        } catch (error: any) {
          console.error(`Error al cargar flujos para área ${areaId}:`, error);
          // Agregar área sin flujos si falla
          areasConFlujosData.push({
            area: areaInfo,
            flujos: [],
          });
        }
      }

      setAreasConFlujos(areasConFlujosData);
    } catch (e: any) {
      console.error("Error al cargar flujos por áreas:", e);
      swalError(
        e.response?.data?.detail || "Error al cargar flujos de trabajo"
      );
    } finally {
      setLoadingFlujos(false);
    }
  };

  // Funciones para cargar y gestionar áreas adicionales
  const loadAreasAdicionales = async () => {
    if (!siniestroId) return;
    try {
      setLoadingAreas(true);
      const areas = await apiService.getAreasAdicionales(siniestroId, true);
      setAreasAdicionales(areas);

      // Cargar todas las áreas disponibles si no están cargadas
      if (todasLasAreas.length === 0) {
        const areasDisponibles = await apiService.getAreas(true);
        setTodasLasAreas(areasDisponibles);
      }
    } catch (error: any) {
      console.error("Error al cargar áreas adicionales:", error);
      swalError(error.response?.data?.detail || "Error al cargar áreas");
    } finally {
      setLoadingAreas(false);
    }
  };

  const handleAddArea = async (areaId: string) => {
    if (!siniestroId) return;
    try {
      await apiService.addAreaAdicional(siniestroId, {
        area_id: areaId,
        activo: true,
      });
      await loadAreasAdicionales();
      await loadFlujosPorAreas(); // Recargar flujos para reflejar cambios
      swalSuccess("Área agregada correctamente");
    } catch (error: any) {
      swalError(error.response?.data?.detail || "Error al agregar área");
    }
  };

  const handleRemoveArea = async (relacionId: string) => {
    try {
      const confirmed = await swalConfirm(
        "¿Estás seguro de eliminar esta área?",
        "Esta acción no se puede deshacer"
      );
      if (!confirmed) return;

      await apiService.removeAreaAdicional(relacionId);
      await loadAreasAdicionales();
      await loadFlujosPorAreas(); // Recargar flujos para reflejar cambios
      swalSuccess("Área eliminada correctamente");
    } catch (error: any) {
      swalError(error.response?.data?.detail || "Error al eliminar área");
    }
  };

  // Funciones para cargar y gestionar involucrados
  const loadInvolucrados = async () => {
    if (!siniestroId) return;
    try {
      setLoadingInvolucrados(true);
      const involucradosData = await apiService.getInvolucrados(
        siniestroId,
        true
      );
      setInvolucrados(involucradosData);

      // Cargar todos los usuarios disponibles si no están cargados
      if (todosLosUsuarios.length === 0) {
        const usuariosDisponibles = await apiService.getUsers();
        setTodosLosUsuarios(usuariosDisponibles);
      }
    } catch (error: any) {
      console.error("Error al cargar involucrados:", error);
      swalError(error.response?.data?.detail || "Error al cargar involucrados");
    } finally {
      setLoadingInvolucrados(false);
    }
  };

  const handleAddInvolucrado = async (
    usuarioId: string,
    tipoRelacion: "asegurado" | "proveniente" | "testigo" | "tercero"
  ) => {
    if (!siniestroId) return;
    try {
      await apiService.addInvolucrado(siniestroId, {
        usuario_id: usuarioId,
        tipo_relacion: tipoRelacion,
        activo: true,
      });
      await loadInvolucrados();
      swalSuccess("Involucrado agregado correctamente");
    } catch (error: any) {
      swalError(error.response?.data?.detail || "Error al agregar involucrado");
    }
  };

  const handleRemoveInvolucrado = async (relacionId: string) => {
    try {
      const confirmed = await swalConfirm(
        "¿Estás seguro de eliminar este involucrado?",
        "Esta acción no se puede deshacer"
      );
      if (!confirmed) return;

      await apiService.removeInvolucrado(relacionId);
      await loadInvolucrados();
      swalSuccess("Involucrado eliminado correctamente");
    } catch (error: any) {
      swalError(
        error.response?.data?.detail || "Error al eliminar involucrado"
      );
    }
  };

  // Funciones para gestionar póliza
  const handleOpenPolizaModal = () => {
    if (!siniestro) return;
    setPolizaForm({
      numero_poliza: siniestro.numero_poliza || "",
      suma_asegurada: siniestro.suma_asegurada || 0,
      deducible: siniestro.deducible || 0,
      reserva: siniestro.reserva || 0,
      coaseguro: siniestro.coaseguro || 0,
    });
    setShowPolizaModal(true);
  };

  const handleSavePoliza = async () => {
    if (!siniestro) return;

    try {
      setSavingPoliza(true);

      const updateData: any = {
        numero_poliza: polizaForm.numero_poliza || undefined,
        suma_asegurada: polizaForm.suma_asegurada || undefined,
        deducible: polizaForm.deducible || undefined,
        reserva: polizaForm.reserva || undefined,
        coaseguro: polizaForm.coaseguro || undefined,
      };

      await apiService.updateSiniestro(siniestroId, updateData);
      await loadSiniestro();
      setShowPolizaModal(false);
      swalSuccess("Información de póliza actualizada correctamente");
    } catch (error: any) {
      if (error.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(
        error.response?.data?.detail ||
          "Error al actualizar información de póliza"
      );
    } finally {
      setSavingPoliza(false);
    }
  };

  const handlePolizaFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPolizaForm((prev) => ({
      ...prev,
      [name]:
        name === "deducible" ||
        name === "reserva" ||
        name === "coaseguro" ||
        name === "suma_asegurada"
          ? parseFloat(value) || 0
          : value,
    }));
  };

  // Función para cargar logs de auditoría
  const loadLogsAuditoria = async () => {
    if (!siniestroId) return;

    try {
      setLoadingLogs(true);
      const logs = await apiService.getHistorialRegistro("siniestros", siniestroId);
      setLogsAuditoria(logs || []);
    } catch (error: any) {
      console.error("Error al cargar logs de auditoría:", error);
      // No mostrar error al usuario, solo log en consola
    } finally {
      setLoadingLogs(false);
    }
  };

  // Función para abrir el editor de documento de una etapa
  // Función para ver el documento como PDF desde una etapa
  const handleViewDocument = async (etapa: EtapaFlujo) => {
    setCurrentEtapa(etapa);
    setPdfLoading(true);
    setShowPdfModal(true);
    setPdfBase64(null);

    try {
      // Buscar el documento existente para esta etapa
      const docExistente = documentosExistentes.find(
        (doc: any) => doc.etapa_flujo_id === etapa.id
      );

      if (!docExistente || !docExistente.contenido) {
        swalError("No hay contenido del documento para mostrar");
        setShowPdfModal(false);
        return;
      }

      // Generar PDF desde el contenido HTML
      const filename =
        docExistente.nombre_archivo.replace(".html", ".pdf") ||
        `${etapa.nombre}.pdf`;
      const pdfResponse = await apiService.generatePDF({
        html_content: docExistente.contenido,
        page_size: "A4",
        orientation: "portrait",
        filename: filename,
      });

      setPdfBase64(pdfResponse.pdf_base64);
      setPdfFilename(filename);
    } catch (error: any) {
      console.error("Error al generar PDF:", error);
      swalError("Error al generar el PDF del documento");
      setShowPdfModal(false);
    } finally {
      setPdfLoading(false);
    }
  };

  // Función para ver un documento directamente (desde la lista de documentos)
  const handleViewDocumento = async (documento: any) => {
    setPdfLoading(true);
    setShowPdfModal(true);
    setPdfBase64(null);

    try {
      if (!documento.contenido) {
        swalError("No hay contenido del documento para mostrar");
        setShowPdfModal(false);
        return;
      }

      // Generar PDF desde el contenido HTML
      const filename =
        documento.nombre_archivo.replace(".html", ".pdf") || "documento.pdf";
      const pdfResponse = await apiService.generatePDF({
        html_content: documento.contenido,
        page_size: "A4",
        orientation: "portrait",
        filename: filename,
      });

      setPdfBase64(pdfResponse.pdf_base64);
      setPdfFilename(filename);
    } catch (error: any) {
      console.error("Error al generar PDF:", error);
      swalError("Error al generar el PDF del documento");
      setShowPdfModal(false);
    } finally {
      setPdfLoading(false);
    }
  };

  // Función para editar un documento directamente (desde la lista de documentos)
  const handleEditDocumento = async (documento: any) => {
    // Obtener la etapa relacionada si existe
    if (!documento.etapa_flujo_id) {
      swalError("No se puede editar este documento sin una etapa asociada");
      return;
    }

    // Buscar la etapa en los flujos cargados
    let etapaEncontrada: EtapaFlujo | null = null;

    // Buscar en flujos generales
    if (flujosGenerales) {
      for (const flujoConEtapas of flujosGenerales.flujos) {
        etapaEncontrada =
          flujoConEtapas.etapas.find(
            (e) => e.id === documento.etapa_flujo_id
          ) || null;
        if (etapaEncontrada) break;
      }
    }

    // Buscar en flujos de áreas
    if (!etapaEncontrada) {
      for (const areaConFlujos of areasConFlujos) {
        for (const flujoConEtapas of areaConFlujos.flujos) {
          etapaEncontrada =
            flujoConEtapas.etapas.find(
              (e) => e.id === documento.etapa_flujo_id
            ) || null;
          if (etapaEncontrada) break;
        }
        if (etapaEncontrada) break;
      }
    }

    if (!etapaEncontrada) {
      swalError("No se encontró la etapa asociada a este documento");
      return;
    }

    // Abrir el editor con la etapa encontrada
    await handleOpenDocumentEditor(etapaEncontrada);
  };

  // Función para abrir el editor de documentos
  const handleOpenDocumentEditor = async (etapa: EtapaFlujo) => {
    setCurrentEtapa(etapa);
    setEditorLoading(true);
    setShowEditorModal(true);
    setDocumentoExistente(null);
    setPlantillaActual(null);
    setDocumentoContenido("");

    try {
      // Buscar si ya existe un documento para esta etapa
      const docExistente = documentosExistentes.find(
        (doc: any) => doc.etapa_flujo_id === etapa.id
      );

      if (docExistente) {
        // Si existe, cargar el contenido existente
        setDocumentoExistente(docExistente);
        setDocumentoContenido(docExistente.contenido || "");
      } else {
        // Si no existe, cargar la plantilla para precargar
        let plantillaId = etapa.plantilla_documento_id;

        // Si no hay plantilla específica pero hay tipo de documento, buscar plantillas disponibles
        if (!plantillaId && etapa.tipo_documento_principal_id) {
          const plantillas = await apiService.getPlantillasDocumento(
            etapa.tipo_documento_principal_id,
            etapa.categoria_documento_id || undefined,
            true
          );

          if (plantillas.length > 0) {
            // Usar la primera plantilla disponible
            plantillaId = plantillas[0].id;
          }
        }

        if (plantillaId) {
          // Cargar el contenido de la plantilla
          const plantilla = await apiService.getPlantillaDocumentoById(
            plantillaId
          );
          setPlantillaActual(plantilla);
          setDocumentoContenido(
            plantilla.contenido || "<p>Contenido de la plantilla...</p>"
          );
        } else {
          // Sin plantilla, iniciar con contenido vacío
          setDocumentoContenido(
            "<p>Escribe el contenido del documento aquí...</p>"
          );
        }
      }
    } catch (error: any) {
      console.error("Error al cargar documento/plantilla:", error);
      swalError("Error al cargar el documento o plantilla");
      setShowEditorModal(false);
    } finally {
      setEditorLoading(false);
    }
  };

  // Función para guardar el documento
  const handleSaveDocument = async () => {
    if (!currentEtapa || !siniestro || !user) return;

    setSavingDocument(true);

    try {
      const fecha = new Date().toISOString().split("T")[0];
      const nombreArchivo = `${currentEtapa.nombre.replace(
        /\s+/g,
        "_"
      )}_${fecha}.html`;

      // Determinar area_id y flujo_trabajo_id basándose en el contexto actual
      let areaId: string | undefined = undefined;
      let flujoTrabajoId: string | undefined = undefined;

      if (activeFlujoTab.startsWith("general-")) {
        // Flujo general - no tiene área específica, pero sí flujo
        const flujoId = activeFlujoTab.replace("general-", "");
        flujoTrabajoId = flujoId;
      } else if (activeFlujoTab.startsWith("area-")) {
        // Flujo de área específica
        const flujoId = activeFlujoTab.replace("area-", "");
        flujoTrabajoId = flujoId;
        areaId = activeAreaTab; // El área actual del tab
      }

      if (documentoExistente) {
        // Actualizar documento existente
        await apiService.updateDocumento(documentoExistente.id, {
          contenido: documentoContenido,
          nombre_archivo: nombreArchivo,
          area_id: areaId,
          flujo_trabajo_id: flujoTrabajoId,
        });
        await swalSuccess("Documento actualizado correctamente");
      } else {
        // Crear nuevo documento
        await apiService.createDocumento({
          siniestro_id: siniestroId,
          etapa_flujo_id: currentEtapa.id,
          tipo_documento_id:
            currentEtapa.tipo_documento_principal_id || undefined,
          plantilla_documento_id:
            plantillaActual?.id ||
            currentEtapa.plantilla_documento_id ||
            undefined,
          area_id: areaId,
          flujo_trabajo_id: flujoTrabajoId,
          nombre_archivo: nombreArchivo,
          ruta_archivo: `/documentos/${siniestroId}/${nombreArchivo}`,
          contenido: documentoContenido,
          tipo_mime: "text/html",
          usuario_subio: user.id,
          version: 1,
          descripcion: `Documento generado para la etapa: ${currentEtapa.nombre}`,
          es_principal: currentEtapa.es_obligatoria,
          activo: true,
        });
        await swalSuccess("Documento guardado correctamente");
      }

      // Recargar documentos después de guardar
      await loadDocumentosSiniestro();
      setShowEditorModal(false);
    } catch (error: any) {
      console.error("Error al guardar documento:", error);
      swalError(
        error.response?.data?.detail || "Error al guardar el documento"
      );
    } finally {
      setSavingDocument(false);
    }
  };

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case "completada":
        return <FiCheckCircle className="w-5 h-5 text-green-600" />;
      case "en_proceso":
        return <FiClock className="w-5 h-5 text-blue-600" />;
      case "bloqueada":
        return <FiAlertCircle className="w-5 h-5 text-red-600" />;
      case "omitida":
        return <FiAlertCircle className="w-5 h-5 text-yellow-600" />;
      default:
        return <FiClock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getEstadoBadge = (estado: string) => {
    const estados: Record<string, { label: string; className: string }> = {
      pendiente: { label: "Pendiente", className: "bg-gray-100 text-gray-800" },
      en_proceso: {
        label: "En Proceso",
        className: "bg-blue-100 text-blue-800",
      },
      completada: {
        label: "Completada",
        className: "bg-green-100 text-green-800",
      },
      omitida: { label: "Omitida", className: "bg-yellow-100 text-yellow-800" },
      bloqueada: { label: "Bloqueada", className: "bg-red-100 text-red-800" },
    };

    const estadoInfo = estados[estado] || estados.pendiente;
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${estadoInfo.className}`}
      >
        {estadoInfo.label}
      </span>
    );
  };

  if (userLoading || siniestroLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Cargando...</p>
      </div>
    );
  }

  if (!user || !siniestro) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="mb-4">
              <Button
                variant="secondary"
                onClick={() => router.push("/siniestros")}
              >
                <FiArrowLeft className="w-4 h-4 mr-2" />
                Volver
              </Button>
            </div>
            <div className="flex items-end justify-end gap-3">
              <EmpresaButton
                variant="primary"
                size="sm"
                onClick={() => handleOpenEditModal()}
              >
                <FiEdit3 className="w-4 h-4 mr-2" />
                Editar
              </EmpresaButton>
            </div>
            <p className="text-gray-600 mt-2 flex flex-col">
              {(() => {
                // Construir código completo: proveniente-consecutivo-añalidad
                const codigoCompleto = (() => {
                  if (!siniestro.proveniente_id || !siniestro.codigo) {
                    return null;
                  }

                  // Obtener código del proveniente
                  const codigoProveniente = provenienteInfo?.codigo || "";

                  // Obtener consecutivo del código del siniestro
                  const consecutivo = siniestro.codigo.padStart(3, "0");

                  // Obtener anualidad (últimos 2 dígitos del año)
                  const anualidad = siniestro.fecha_siniestro
                    ? new Date(siniestro.fecha_siniestro)
                        .getFullYear()
                        .toString()
                        .slice(-2)
                    : new Date().getFullYear().toString().slice(-2);

                  if (!codigoProveniente) {
                    return null;
                  }

                  return `${codigoProveniente}-${consecutivo}-${anualidad}`;
                })();

                const elementos = [];

                // Código completo
                if (codigoCompleto) {
                  elementos.push(
                    <span key="codigo" className="font-semibold text-gray-800">
                      ID: {codigoCompleto}
                    </span>
                  );
                }

                // Número de siniestro
                if (siniestro.numero_siniestro) {
                  elementos.push(
                    <span key="numero" className="font-semibold text-gray-800">
                      Num Siniestro: {siniestro.numero_siniestro}
                    </span>
                  );
                }

                // Nombre del asegurado
                if (aseguradoInfo?.full_name) {
                  elementos.push(
                    <span
                      key="asegurado"
                      className="font-semibold text-gray-800"
                    >
                      {aseguradoInfo.full_name}
                    </span>
                  );
                }

                return <>{elementos}</>;
              })()}
            </p>
          </div>

          {/* Selectores de Status y Calificación */}
          <div className="grid grid-cols-2 gap-4 min-w-[500px]">
            <EmpresaSelect
              label="Status"
              value={siniestro.estado_id ? String(siniestro.estado_id) : ""}
              onChange={handleUpdateEstado}
              options={estadosSiniestro.map((estado) => ({
                value: String(estado.id),
                label: estado.nombre,
                color: estado.color,
              }))}
              placeholder="Seleccionar estado"
              disabled={loadingEstados || updatingStatus}
            />

            <EmpresaSelect
              label="Calificación"
              value={
                siniestro.calificacion_id
                  ? String(siniestro.calificacion_id)
                  : ""
              }
              onChange={handleUpdateCalificacion}
              options={calificacionesSiniestro.map((calificacion) => ({
                value: String(calificacion.id),
                label: calificacion.nombre,
                color: calificacion.color,
              }))}
              placeholder="Seleccionar calificación"
              disabled={loadingCalificaciones || updatingCalificacion}
            />
          </div>
        </div>

        {/* Layout de dos columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Columna izquierda - Contenido principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pestañas estilo Chrome - Dos niveles */}
            {loadingFlujos ? (
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-600 text-center">
                  Cargando flujos de trabajo...
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                {/* Primera línea: Pestañas de Áreas */}
                <div
                  className="flex border-b border-gray-200"
                  style={{ backgroundColor: empresaColors.secondary + "15" }}
                >
                  {areasConFlujos.length === 0 ? (
                    <div className="px-6 py-3 text-sm text-gray-500">
                      No hay áreas asignadas a este siniestro
                    </div>
                  ) : (
                    areasConFlujos.map((areaConFlujos) => (
                      <button
                        key={areaConFlujos.area.id}
                        onClick={() => {
                          setActiveAreaTab(areaConFlujos.area.id);
                          // Al cambiar de área, seleccionar el primer flujo disponible
                          if (
                            flujosGenerales &&
                            flujosGenerales.flujos.length > 0
                          ) {
                            setActiveFlujoTab(
                              `general-${flujosGenerales.flujos[0].flujo.id}`
                            );
                          } else if (areaConFlujos.flujos.length > 0) {
                            setActiveFlujoTab(
                              `area-${areaConFlujos.flujos[0].flujo.id}`
                            );
                          } else {
                            setActiveFlujoTab("");
                          }
                        }}
                        className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                          activeAreaTab === areaConFlujos.area.id
                            ? "bg-white"
                            : "border-transparent !text-gray-600 hover:bg-white/10"
                        }`}
                        style={{
                          borderBottomColor:
                            activeAreaTab === areaConFlujos.area.id
                              ? empresaColors.primary
                              : "transparent",
                          color:
                            activeAreaTab === areaConFlujos.area.id
                              ? empresaColors.primary
                              : "rgba(255, 255, 255, 0.9)",
                        }}
                      >
                        {areaConFlujos.area.nombre}
                      </button>
                    ))
                  )}
                </div>

                {/* Segunda línea: Pestañas de Flujos (solo si hay un área seleccionada) */}
                {activeAreaTab && (
                  <>
                    <div
                      className="flex border-b border-gray-200"
                      style={{
                        backgroundColor: empresaColors.secondary + "08",
                      }}
                    >
                      {/* Flujos Generales */}
                      {flujosGenerales && flujosGenerales.flujos.length > 0 && (
                        <>
                          {flujosGenerales.flujos.map((flujoConEtapas) => (
                            <button
                              key={`general-${flujoConEtapas.flujo.id}`}
                              onClick={() =>
                                setActiveFlujoTab(
                                  `general-${flujoConEtapas.flujo.id}`
                                )
                              }
                              className={`px-6 py-2 text-xs font-medium border-b-2 transition-colors ${
                                activeFlujoTab ===
                                `general-${flujoConEtapas.flujo.id}`
                                  ? "bg-white"
                                  : "border-transparent hover:bg-white/50"
                              }`}
                              style={{
                                borderBottomColor:
                                  activeFlujoTab ===
                                  `general-${flujoConEtapas.flujo.id}`
                                    ? empresaColors.primary
                                    : "transparent",
                                color:
                                  activeFlujoTab ===
                                  `general-${flujoConEtapas.flujo.id}`
                                    ? empresaColors.primary
                                    : empresaColors.secondary,
                              }}
                            >
                              {flujoConEtapas.flujo.nombre}
                            </button>
                          ))}
                        </>
                      )}

                      {/* Flujos Específicos del Área */}
                      {areasConFlujos
                        .find((a) => a.area.id === activeAreaTab)
                        ?.flujos.map((flujoConEtapas) => (
                          <button
                            key={`area-${flujoConEtapas.flujo.id}`}
                            onClick={() =>
                              setActiveFlujoTab(
                                `area-${flujoConEtapas.flujo.id}`
                              )
                            }
                            className={`px-6 py-2 text-xs font-medium border-b-2 transition-colors ${
                              activeFlujoTab ===
                              `area-${flujoConEtapas.flujo.id}`
                                ? "bg-white"
                                : "border-transparent hover:bg-white/50"
                            }`}
                            style={{
                              borderBottomColor:
                                activeFlujoTab ===
                                `area-${flujoConEtapas.flujo.id}`
                                  ? empresaColors.primary
                                  : "transparent",
                              color:
                                activeFlujoTab ===
                                `area-${flujoConEtapas.flujo.id}`
                                  ? empresaColors.primary
                                  : empresaColors.secondary,
                            }}
                          >
                            {flujoConEtapas.flujo.nombre}
                          </button>
                        ))}
                    </div>

                    {/* Contenido del Flujo seleccionado */}
                    <div className="p-6">
                      {activeFlujoTab && (
                        <>
                          {activeFlujoTab.startsWith("general-") &&
                            flujosGenerales && (
                              <>
                                {(() => {
                                  const flujoConEtapas =
                                    flujosGenerales.flujos.find(
                                      (f) =>
                                        `general-${f.flujo.id}` ===
                                        activeFlujoTab
                                    );
                                  if (!flujoConEtapas) return null;
                                  return (
                                    <div>
                                      <div className="mb-6">
                                        <div className="flex items-center gap-3 mb-2">
                                          <h2 className="text-xl font-semibold text-gray-900">
                                            {flujoConEtapas.flujo.nombre}
                                          </h2>
                                          <span
                                            className="px-2 py-1 text-xs rounded-full text-white"
                                            style={{
                                              backgroundColor:
                                                empresaColors.tertiary,
                                            }}
                                          >
                                            Flujo General
                                          </span>
                                        </div>
                                        {flujoConEtapas.flujo.descripcion && (
                                          <p className="text-gray-600 text-sm">
                                            {flujoConEtapas.flujo.descripcion}
                                          </p>
                                        )}
                                      </div>

                                      {/* Tabs internos: Etapas, Documentos, Bitácora */}
                                      <div className="mb-6">
                                        <EmpresaTabs
                                          tabs={[
                                            {
                                              id: "etapas",
                                              label: "Etapas",
                                              icon: (
                                                <FiLayers className="w-4 h-4" />
                                              ),
                                            },
                                            {
                                              id: "documentos",
                                              label: "Documentos",
                                              icon: (
                                                <FiFileText className="w-4 h-4" />
                                              ),
                                              count: documentosFiltrados.length,
                                            },
                                            {
                                              id: "bitacora",
                                              label: "Bitácora",
                                              icon: (
                                                <FiClock className="w-4 h-4" />
                                              ),
                                              count: bitacorasFiltradas.length,
                                            },
                                          ]}
                                          activeTab={activeContentTab}
                                          onTabChange={(tabId) =>
                                            setActiveContentTab(
                                              tabId as
                                                | "etapas"
                                                | "documentos"
                                                | "bitacora"
                                            )
                                          }
                                        />
                                      </div>

                                      {/* Contenido según tab activo */}
                                      {activeContentTab === "etapas" && (
                                        <EtapasTimeline
                                          etapas={flujoConEtapas.etapas}
                                          documentosExistentes={
                                            documentosExistentes
                                          }
                                          onOpenEditor={
                                            handleOpenDocumentEditor
                                          }
                                          onViewDocument={handleViewDocument}
                                          empresaColors={empresaColors}
                                        />
                                      )}

                                      {activeContentTab === "documentos" && (
                                        <DocumentosList
                                          documentos={documentosFiltrados}
                                          loading={loadingDocumentos}
                                          onViewDocument={handleViewDocumento}
                                          onEditDocument={handleEditDocumento}
                                          siniestroId={siniestroId}
                                          empresaColors={empresaColors}
                                        />
                                      )}

                                      {activeContentTab === "bitacora" && (
                                        <BitacoraList
                                          bitacoras={bitacorasFiltradas}
                                          loading={loadingBitacoras}
                                          siniestroId={siniestroId}
                                          areaId={undefined}
                                          flujoTrabajoId={
                                            flujoConEtapas.flujo.id
                                          }
                                          onRefresh={() =>
                                            loadBitacorasFiltradas(
                                              undefined,
                                              flujoConEtapas.flujo.id
                                            )
                                          }
                                        />
                                      )}
                                    </div>
                                  );
                                })()}
                              </>
                            )}

                          {activeFlujoTab.startsWith("area-") && (
                            <>
                              {(() => {
                                const areaActual = areasConFlujos.find(
                                  (a) => a.area.id === activeAreaTab
                                );
                                const flujoConEtapas = areaActual?.flujos.find(
                                  (f) => `area-${f.flujo.id}` === activeFlujoTab
                                );
                                if (!flujoConEtapas) return null;
                                return (
                                  <div>
                                    <div className="mb-6">
                                      <div className="flex items-center gap-3 mb-2">
                                        <h2 className="text-xl font-semibold text-gray-900">
                                          {flujoConEtapas.flujo.nombre}
                                        </h2>
                                        <EmpresaBadge
                                          variant="secondary"
                                          size="sm"
                                        >
                                          {areaActual?.area.nombre}
                                        </EmpresaBadge>
                                      </div>
                                      {flujoConEtapas.flujo.descripcion && (
                                        <p className="text-gray-600 text-sm">
                                          {flujoConEtapas.flujo.descripcion}
                                        </p>
                                      )}
                                    </div>

                                    {/* Tabs internos: Etapas, Documentos, Bitácora */}
                                    <div className="mb-6">
                                      <div className="flex border-b border-gray-200">
                                        <button
                                          onClick={() =>
                                            setActiveContentTab("etapas")
                                          }
                                          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                            activeContentTab === "etapas"
                                              ? "border-blue-500 text-blue-600"
                                              : "border-transparent text-gray-600 hover:text-gray-900"
                                          }`}
                                        >
                                          <FiLayers className="w-4 h-4 inline mr-2" />
                                          Etapas
                                        </button>
                                        <button
                                          onClick={() =>
                                            setActiveContentTab("documentos")
                                          }
                                          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                            activeContentTab === "documentos"
                                              ? "border-blue-500 text-blue-600"
                                              : "border-transparent text-gray-600 hover:text-gray-900"
                                          }`}
                                        >
                                          <FiFileText className="w-4 h-4 inline mr-2" />
                                          Documentos (
                                          {documentosFiltrados.length})
                                        </button>
                                        <button
                                          onClick={() =>
                                            setActiveContentTab("bitacora")
                                          }
                                          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                            activeContentTab === "bitacora"
                                              ? "border-blue-500 text-blue-600"
                                              : "border-transparent text-gray-600 hover:text-gray-900"
                                          }`}
                                        >
                                          <FiClock className="w-4 h-4 inline mr-2" />
                                          Bitácora ({bitacorasFiltradas.length})
                                        </button>
                                      </div>
                                    </div>

                                    {/* Contenido según tab activo */}
                                    {activeContentTab === "etapas" && (
                                      <EtapasTimeline
                                        etapas={flujoConEtapas.etapas}
                                        documentosExistentes={
                                          documentosExistentes
                                        }
                                        onOpenEditor={handleOpenDocumentEditor}
                                        onViewDocument={handleViewDocument}
                                        empresaColors={empresaColors}
                                      />
                                    )}

                                    {activeContentTab === "documentos" && (
                                      <DocumentosList
                                        documentos={documentosFiltrados}
                                        loading={loadingDocumentos}
                                        onViewDocument={handleViewDocumento}
                                        onEditDocument={handleEditDocumento}
                                        siniestroId={siniestroId}
                                        empresaColors={empresaColors}
                                      />
                                    )}

                                    {activeContentTab === "bitacora" && (
                                      <BitacoraList
                                        bitacoras={bitacorasFiltradas}
                                        loading={loadingBitacoras}
                                        siniestroId={siniestroId}
                                        areaId={activeAreaTab}
                                        flujoTrabajoId={flujoConEtapas.flujo.id}
                                        onRefresh={() =>
                                          loadBitacorasFiltradas(
                                            activeAreaTab,
                                            flujoConEtapas.flujo.id
                                          )
                                        }
                                      />
                                    )}
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </>
                      )}

                      {!activeFlujoTab && (
                        <p className="text-gray-500 text-center py-8">
                          Selecciona un flujo para ver sus etapas
                        </p>
                      )}
                    </div>
                  </>
                )}

                {!activeAreaTab && areasConFlujos.length > 0 && (
                  <div className="p-6">
                    <p className="text-gray-500 text-center py-8">
                      Selecciona un área para ver sus flujos
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Sección de Información del Siniestro */}
            <div className="mt-6">
              <EmpresaCard className="p-6">
                <h2
                  className="text-xl font-bold mb-4"
                  style={{ color: empresaColors.primary }}
                >
                  Información del Siniestro
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Información del Asegurado */}
                  {aseguradoInfo && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <FiUser
                          className="w-5 h-5"
                          style={{ color: empresaColors.primary }}
                        />
                        <h3 className="font-semibold text-gray-700">
                          Asegurado
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Nombre:</span>{" "}
                        {aseguradoInfo.full_name ||
                          aseguradoInfo.email ||
                          "N/A"}
                      </p>
                      {aseguradoInfo.email && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Email:</span>{" "}
                          {aseguradoInfo.email}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Información de Póliza */}
                  {(siniestro.numero_poliza || siniestro.suma_asegurada) && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <FiShield
                          className="w-5 h-5"
                          style={{ color: empresaColors.secondary }}
                        />
                        <h3 className="font-semibold text-gray-700">Póliza</h3>
                      </div>
                      {siniestro.numero_poliza && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Número:</span>{" "}
                          {siniestro.numero_poliza}
                        </p>
                      )}
                      {siniestro.suma_asegurada > 0 && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Suma Asegurada:</span> $
                          {siniestro.suma_asegurada.toLocaleString("es-MX")}
                        </p>
                      )}
                      {siniestro.deducible > 0 && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Deducible:</span> $
                          {siniestro.deducible.toLocaleString("es-MX")}
                        </p>
                      )}
                      {siniestro.reserva > 0 && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Reserva:</span> $
                          {siniestro.reserva.toLocaleString("es-MX")}
                        </p>
                      )}
                      {siniestro.coaseguro > 0 && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Coaseguro:</span> $
                          {siniestro.coaseguro.toLocaleString("es-MX")}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Ubicación */}
                  {siniestro.ubicacion && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <FiMapPin
                          className="w-5 h-5"
                          style={{ color: empresaColors.tertiary }}
                        />
                        <h3 className="font-semibold text-gray-700">
                          Ubicación
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600">
                        {siniestro.ubicacion}
                      </p>
                    </div>
                  )}

                  {/* Fechas */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <FiCalendar
                        className="w-5 h-5"
                        style={{ color: empresaColors.primary }}
                      />
                      <h3 className="font-semibold text-gray-700">Fechas</h3>
                    </div>
                    {siniestro.fecha_siniestro && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">
                          Fecha del Siniestro:
                        </span>{" "}
                        {new Date(siniestro.fecha_siniestro).toLocaleDateString(
                          "es-MX",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )}
                      </p>
                    )}
                    {siniestro.fecha_registro && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Fecha de Registro:</span>{" "}
                        {new Date(siniestro.fecha_registro).toLocaleDateString(
                          "es-MX",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )}
                      </p>
                    )}
                  </div>

                  {/* Prioridad */}
                  {siniestro.prioridad && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <FiAlertCircle
                          className="w-5 h-5"
                          style={{ color: empresaColors.primary }}
                        />
                        <h3 className="font-semibold text-gray-700">
                          Prioridad
                        </h3>
                      </div>
                      <EmpresaBadge
                        variant={
                          siniestro.prioridad === "critica"
                            ? "danger"
                            : siniestro.prioridad === "alta"
                            ? "warning"
                            : siniestro.prioridad === "media"
                            ? "info"
                            : "secondary"
                        }
                      >
                        {siniestro.prioridad.charAt(0).toUpperCase() +
                          siniestro.prioridad.slice(1)}
                      </EmpresaBadge>
                    </div>
                  )}

                  {/* Forma de Contacto */}
                  {siniestro.forma_contacto && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        {siniestro.forma_contacto === "correo" ? (
                          <FiMail
                            className="w-5 h-5"
                            style={{ color: empresaColors.secondary }}
                          />
                        ) : siniestro.forma_contacto === "telefono" ? (
                          <FiPhone
                            className="w-5 h-5"
                            style={{ color: empresaColors.secondary }}
                          />
                        ) : (
                          <FiUser
                            className="w-5 h-5"
                            style={{ color: empresaColors.secondary }}
                          />
                        )}
                        <h3 className="font-semibold text-gray-700">
                          Forma de Contacto
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600 capitalize">
                        {siniestro.forma_contacto}
                      </p>
                    </div>
                  )}

                  {/* Institución */}
                  {institucionInfo && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <FiInfo
                          className="w-5 h-5"
                          style={{ color: empresaColors.tertiary }}
                        />
                        <h3 className="font-semibold text-gray-700">
                          Institución
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600">
                        {institucionInfo.nombre}
                      </p>
                      {institucionInfo.email && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Email:</span>{" "}
                          {institucionInfo.email}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Autoridad */}
                  {autoridadInfo && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <FiShield
                          className="w-5 h-5"
                          style={{ color: empresaColors.primary }}
                        />
                        <h3 className="font-semibold text-gray-700">
                          Autoridad
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600">
                        {autoridadInfo.nombre}
                      </p>
                      {autoridadInfo.email && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Email:</span>{" "}
                          {autoridadInfo.email}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Proveniente */}
                  {provenienteInfo && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <FiFile
                          className="w-5 h-5"
                          style={{ color: empresaColors.secondary }}
                        />
                        <h3 className="font-semibold text-gray-700">
                          Proveniente
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600">
                        {provenienteInfo.nombre}
                      </p>
                    </div>
                  )}

                  {/* Número de Reporte */}
                  {siniestro.numero_reporte && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <FiFileText
                          className="w-5 h-5"
                          style={{ color: empresaColors.tertiary }}
                        />
                        <h3 className="font-semibold text-gray-700">
                          Número de Reporte
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600">
                        {siniestro.numero_reporte}
                      </p>
                    </div>
                  )}
                </div>

                {/* Descripción de los Hechos */}
                {siniestro.descripcion_hechos && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center gap-2 mb-3">
                      <FiFileText
                        className="w-5 h-5"
                        style={{ color: empresaColors.primary }}
                      />
                      <h3 className="font-semibold text-gray-700">
                        Descripción de los Hechos
                      </h3>
                    </div>
                    <div
                      className="prose max-w-none text-sm text-gray-700 bg-gray-50 p-4 rounded-lg"
                      dangerouslySetInnerHTML={{
                        __html: siniestro.descripcion_hechos,
                      }}
                    />
                  </div>
                )}

                {/* Observaciones */}
                {siniestro.observaciones && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center gap-2 mb-3">
                      <FiInfo
                        className="w-5 h-5"
                        style={{ color: empresaColors.secondary }}
                      />
                      <h3 className="font-semibold text-gray-700">
                        Observaciones
                      </h3>
                    </div>
                    <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
                      {siniestro.observaciones}
                    </p>
                  </div>
                )}
              </EmpresaCard>
            </div>
          </div>

          {/* Columna derecha - Administración */}
          <div className="lg:col-span-1 space-y-6">
            {/* Sección: Administrar Áreas */}
            <EmpresaCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2
                  className="text-lg font-bold"
                  style={{ color: empresaColors.primary }}
                >
                  Administrar Áreas
                </h2>
                <FiLayers
                  className="w-5 h-5"
                  style={{ color: empresaColors.primary }}
                />
              </div>

              {loadingAreas ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Lista de áreas asignadas */}
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {areasAdicionales.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No hay áreas asignadas
                      </p>
                    ) : (
                      areasAdicionales.map((areaRelacion) => {
                        const area = todasLasAreas.find(
                          (a) => a.id === areaRelacion.area_id
                        );
                        return (
                          <div
                            key={areaRelacion.id}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <span className="text-sm font-medium text-gray-700 flex-1">
                              {area?.nombre || "Área desconocida"}
                            </span>
                            <button
                              onClick={() => handleRemoveArea(areaRelacion.id)}
                              className="p-1 text-red-600 hover:text-red-800 transition-colors"
                              title="Eliminar área"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Agregar nueva área */}
                  <div className="pt-4 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Agregar Área
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddArea(e.target.value);
                          e.target.value = "";
                        }
                      }}
                      value=""
                    >
                      <option value="">Seleccionar área...</option>
                      {todasLasAreas
                        .filter(
                          (area) =>
                            !areasAdicionales.some(
                              (ar) => ar.area_id === area.id
                            )
                        )
                        .map((area) => (
                          <option key={area.id} value={area.id}>
                            {area.nombre}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}
            </EmpresaCard>

            {/* Sección: Administrar Involucrados */}
            <EmpresaCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2
                  className="text-lg font-bold"
                  style={{ color: empresaColors.primary }}
                >
                  Administrar Involucrados
                </h2>
                <FiUser
                  className="w-5 h-5"
                  style={{ color: empresaColors.primary }}
                />
              </div>

              {loadingInvolucrados ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Lista de involucrados */}
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {involucrados.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No hay involucrados asignados
                      </p>
                    ) : (
                      involucrados.map((involucrado) => {
                        const usuario = todosLosUsuarios.find(
                          (u) => u.id === involucrado.usuario_id
                        );
                        const tipoRelacionLabels: Record<string, string> = {
                          asegurado: "Asegurado",
                          proveniente: "Proveniente",
                          testigo: "Testigo",
                          tercero: "Tercero",
                        };
                        return (
                          <div
                            key={involucrado.id}
                            className="p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-700 truncate">
                                  {usuario?.full_name ||
                                    usuario?.email ||
                                    "Usuario desconocido"}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {tipoRelacionLabels[
                                    involucrado.tipo_relacion
                                  ] || involucrado.tipo_relacion}
                                  {involucrado.es_principal && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                      Principal
                                    </span>
                                  )}
                                </p>
                              </div>
                              <button
                                onClick={() =>
                                  handleRemoveInvolucrado(involucrado.id)
                                }
                                className="p-1 text-red-600 hover:text-red-800 transition-colors ml-2 flex-shrink-0"
                                title="Eliminar involucrado"
                              >
                                <FiTrash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Agregar nuevo involucrado */}
                  <div className="pt-4 border-t border-gray-200 space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Agregar Involucrado
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm mb-2"
                      onChange={(e) => {
                        if (e.target.value) {
                          const [usuarioId, tipoRelacion] =
                            e.target.value.split("|");
                          if (usuarioId && tipoRelacion) {
                            handleAddInvolucrado(
                              usuarioId,
                              tipoRelacion as
                                | "asegurado"
                                | "proveniente"
                                | "testigo"
                                | "tercero"
                            );
                            e.target.value = "";
                          }
                        }
                      }}
                      value=""
                    >
                      <option value="">Seleccionar usuario y tipo...</option>
                      {todosLosUsuarios
                        .filter(
                          (usuario) =>
                            !involucrados.some(
                              (inv) => inv.usuario_id === usuario.id
                            )
                        )
                        .map((usuario) => (
                          <optgroup
                            key={usuario.id}
                            label={
                              usuario.full_name || usuario.email || "Usuario"
                            }
                          >
                            <option value={`${usuario.id}|asegurado`}>
                              Como Asegurado
                            </option>
                            <option value={`${usuario.id}|proveniente`}>
                              Como Proveniente
                            </option>
                            <option value={`${usuario.id}|testigo`}>
                              Como Testigo
                            </option>
                            <option value={`${usuario.id}|tercero`}>
                              Como Tercero
                            </option>
                          </optgroup>
                        ))}
                    </select>
                  </div>
                </div>
              )}
            </EmpresaCard>

            {/* Sección: Información de Póliza */}
            <EmpresaCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2
                  className="text-lg font-bold"
                  style={{ color: empresaColors.primary }}
                >
                  Información de Póliza
                </h2>
                <div className="flex items-center gap-2">
                  <FiShield
                    className="w-5 h-5"
                    style={{ color: empresaColors.primary }}
                  />
                  <button
                    onClick={handleOpenPolizaModal}
                    className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                    title="Editar póliza"
                  >
                    <FiEdit3 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {/* Número de Póliza */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    Número de Póliza:
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {siniestro.numero_poliza || (
                      <span className="text-gray-400 italic">
                        No registrado
                      </span>
                    )}
                  </span>
                </div>

                {/* Suma Asegurada */}
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-sm text-gray-600">Suma Asegurada:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {siniestro.suma_asegurada > 0 ? (
                      `$${siniestro.suma_asegurada.toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    ) : (
                      <span className="text-gray-400 italic">$0.00</span>
                    )}
                  </span>
                </div>

                {/* Deducible */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Deducible:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {siniestro.deducible > 0 ? (
                      `$${siniestro.deducible.toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    ) : (
                      <span className="text-gray-400 italic">$0.00</span>
                    )}
                  </span>
                </div>

                {/* Reserva */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Reserva:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {siniestro.reserva > 0 ? (
                      `$${siniestro.reserva.toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    ) : (
                      <span className="text-gray-400 italic">$0.00</span>
                    )}
                  </span>
                </div>

                {/* Coaseguro */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Coaseguro:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {siniestro.coaseguro > 0 ? (
                      `$${siniestro.coaseguro.toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    ) : (
                      <span className="text-gray-400 italic">$0.00</span>
                    )}
                  </span>
                </div>
              </div>
            </EmpresaCard>
          </div>
        </div>

        {/* Sección de Log de Auditoría */}
        <div className="mt-6">
          <EmpresaCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-xl font-bold"
                style={{ color: empresaColors.primary }}
              >
                Log de Actividades
              </h2>
              <FiList
                className="w-6 h-6"
                style={{ color: empresaColors.primary }}
              />
            </div>

            {loadingLogs ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Cargando log...</span>
              </div>
            ) : logsAuditoria.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <FiList className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">
                  No hay registros de actividad
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Las acciones realizadas en el siniestro aparecerán aquí
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {logsAuditoria.map((log) => {
                  const getAccionIcon = (accion: string) => {
                    switch (accion?.toUpperCase()) {
                      case "CREATE":
                      case "CREAR":
                        return <FiPlus className="w-4 h-4" />;
                      case "UPDATE":
                      case "ACTUALIZAR":
                        return <FiEdit3 className="w-4 h-4" />;
                      case "DELETE":
                      case "ELIMINAR":
                        return <FiTrash2 className="w-4 h-4" />;
                      default:
                        return <FiActivity className="w-4 h-4" />;
                    }
                  };

                  const getAccionColor = (accion: string) => {
                    switch (accion?.toUpperCase()) {
                      case "CREATE":
                      case "CREAR":
                        return "bg-green-100 text-green-700 border-green-200";
                      case "UPDATE":
                      case "ACTUALIZAR":
                        return "bg-blue-100 text-blue-700 border-blue-200";
                      case "DELETE":
                      case "ELIMINAR":
                        return "bg-red-100 text-red-700 border-red-200";
                      default:
                        return "bg-gray-100 text-gray-700 border-gray-200";
                    }
                  };

                  const formatarDescripcion = (log: any) => {
                    if (log.descripcion) {
                      return log.descripcion;
                    }

                    const accion = log.accion?.toUpperCase() || "";
                    const modulo = log.modulo || "";
                    const tabla = log.tabla || "";

                    // Generar descripción basada en la acción y tabla
                    if (tabla === "siniestros") {
                      if (accion === "UPDATE" || accion === "ACTUALIZAR") {
                        return "Se actualizó la información del siniestro";
                      } else if (accion === "CREATE" || accion === "CREAR") {
                        return "Se creó el siniestro";
                      }
                    } else if (tabla === "siniestro_areas") {
                      if (accion === "CREATE" || accion === "CREAR") {
                        return "Se agregó un área al siniestro";
                      } else if (accion === "DELETE" || accion === "ELIMINAR") {
                        return "Se eliminó un área del siniestro";
                      }
                    } else if (tabla === "siniestro_usuarios") {
                      if (accion === "CREATE" || accion === "CREAR") {
                        return "Se agregó un involucrado al siniestro";
                      } else if (accion === "DELETE" || accion === "ELIMINAR") {
                        return "Se eliminó un involucrado del siniestro";
                      }
                    }

                    return `${accion} en ${tabla}`;
                  };

                  return (
                    <div
                      key={log.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${getAccionColor(
                                log.accion
                              )}`}
                            >
                              {getAccionIcon(log.accion)}
                              <span className="ml-1 capitalize">
                                {log.accion || "Acción"}
                              </span>
                            </span>
                            {log.modulo && (
                              <span className="text-xs text-gray-500">
                                {log.modulo}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-900 mb-2">
                            {formatarDescripcion(log)}
                          </p>
                          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                            <span>
                              {new Date(log.creado_en).toLocaleDateString(
                                "es-MX",
                                {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                            {log.usuario && (
                              <>
                                <span>•</span>
                                <span>
                                  Usuario:{" "}
                                  {log.usuario.full_name ||
                                    log.usuario.email ||
                                    "Desconocido"}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </EmpresaCard>
        </div>
      </div>

      {/* Modal de Edición de Documento */}
      <Modal
        open={showEditorModal}
        onClose={() => !savingDocument && setShowEditorModal(false)}
        title={`${
          documentoExistente ? "Editar Documento" : "Generar Documento"
        }${currentEtapa ? ` - ${currentEtapa.nombre}` : ""}`}
        maxWidthClass="max-w-6xl"
      >
        <div className="space-y-4">
          {editorLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Cargando plantilla...</span>
            </div>
          ) : (
            <>
              {/* Información de la plantilla */}
              {plantillaActual && !documentoExistente && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                  <FiFolder className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">
                      Plantilla: {plantillaActual.nombre}
                    </p>
                    {plantillaActual.descripcion && (
                      <p className="text-xs text-blue-600 mt-1">
                        {plantillaActual.descripcion}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {documentoExistente && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
                  <FiCheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      Documento existente: {documentoExistente.nombre_archivo}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      Versión {documentoExistente.version} • Creado:{" "}
                      {new Date(
                        documentoExistente.creado_en
                      ).toLocaleDateString("es-MX")}
                    </p>
                  </div>
                </div>
              )}

              {/* Editor TipTap */}
              <TiptapEditor
                label="Contenido del Documento"
                value={documentoContenido}
                onChange={setDocumentoContenido}
                placeholder="Escribe el contenido del documento aquí..."
                height={400}
                disabled={savingDocument}
              />

              {/* Botones de acción */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="secondary"
                  onClick={() => setShowEditorModal(false)}
                  disabled={savingDocument}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSaveDocument}
                  disabled={savingDocument || !documentoContenido.trim()}
                >
                  {savingDocument ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <FiSave className="w-4 h-4 mr-2" />
                      {documentoExistente
                        ? "Actualizar Documento"
                        : "Guardar Documento"}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Modal de Visualización de PDF */}
      <Modal
        open={showPdfModal}
        onClose={() => {
          setShowPdfModal(false);
          setPdfBase64(null);
          setPdfFilename("");
        }}
        title={`Ver Documento - ${
          pdfFilename || currentEtapa?.nombre || "Documento"
        }`}
        maxWidthClass="max-w-6xl"
        maxHeightClass="max-h-[90vh]"
      >
        <div className="space-y-4">
          {pdfLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Generando PDF...</p>
              </div>
            </div>
          ) : pdfBase64 ? (
            <div className="w-full">
              <iframe
                src={`data:application/pdf;base64,${pdfBase64}`}
                className="w-full h-[70vh] border border-gray-300 rounded-lg"
                title="Vista previa del PDF"
              />
              <div className="mt-4 flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowPdfModal(false)}
                >
                  Cerrar
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    // Descargar el PDF
                    const link = document.createElement("a");
                    link.href = `data:application/pdf;base64,${pdfBase64}`;
                    link.download =
                      pdfFilename ||
                      `${currentEtapa?.nombre || "documento"}.pdf`;
                    link.click();
                  }}
                >
                  <FiSave className="w-4 h-4 mr-2" />
                  Descargar PDF
                </Button>
                {currentEtapa && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      setShowPdfModal(false);
                      handleOpenDocumentEditor(currentEtapa);
                    }}
                  >
                    <FiEdit3 className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No hay contenido para mostrar
            </div>
          )}
        </div>
      </Modal>

      {/* Modal de Edición del Siniestro */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar Información del Siniestro"
        maxWidthClass="max-w-4xl"
      >
        <div className="space-y-6">
          {/* Información Básica */}
          <div>
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: empresaColors.primary }}
            >
              Información Básica
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Número de Siniestro"
                name="numero_siniestro"
                value={editForm.numero_siniestro}
                onChange={handleEditFormChange}
                required
              />
              <Input
                label="Fecha del Siniestro"
                name="fecha_siniestro"
                type="date"
                value={editForm.fecha_siniestro}
                onChange={handleEditFormChange}
                required
              />
              <Input
                label="Ubicación"
                name="ubicacion"
                value={editForm.ubicacion}
                onChange={handleEditFormChange}
              />
              <Input
                label="Número de Reporte"
                name="numero_reporte"
                value={editForm.numero_reporte}
                onChange={handleEditFormChange}
              />
            </div>
          </div>

          {/* Información de Póliza */}
          <div>
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: empresaColors.secondary }}
            >
              Información de Póliza
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Número de Póliza"
                name="numero_poliza"
                value={editForm.numero_poliza}
                onChange={handleEditFormChange}
              />
              <Input
                label="Suma Asegurada"
                name="suma_asegurada"
                type="number"
                value={editForm.suma_asegurada}
                onChange={handleEditFormChange}
                step="0.01"
              />
              <Input
                label="Deducible"
                name="deducible"
                type="number"
                value={editForm.deducible}
                onChange={handleEditFormChange}
                step="0.01"
              />
              <Input
                label="Reserva"
                name="reserva"
                type="number"
                value={editForm.reserva}
                onChange={handleEditFormChange}
                step="0.01"
              />
              <Input
                label="Coaseguro"
                name="coaseguro"
                type="number"
                value={editForm.coaseguro}
                onChange={handleEditFormChange}
                step="0.01"
              />
            </div>
          </div>

          {/* Configuración Adicional */}
          <div>
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: empresaColors.tertiary }}
            >
              Configuración Adicional
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prioridad
                </label>
                <select
                  name="prioridad"
                  value={editForm.prioridad}
                  onChange={handleEditFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{
                    borderColor: empresaColors.primary + "60",
                  }}
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Forma de Contacto
                </label>
                <select
                  name="forma_contacto"
                  value={editForm.forma_contacto}
                  onChange={handleEditFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{
                    borderColor: empresaColors.primary + "60",
                  }}
                >
                  <option value="correo">Correo</option>
                  <option value="telefono">Teléfono</option>
                  <option value="directa">Directa</option>
                </select>
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones
            </label>
            <textarea
              name="observaciones"
              value={editForm.observaciones}
              onChange={handleEditFormChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              style={{
                borderColor: empresaColors.primary + "60",
              }}
              placeholder="Ingresa observaciones adicionales..."
            />
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <EmpresaButton
              variant="outline"
              onClick={() => setShowEditModal(false)}
              disabled={savingSiniestro}
            >
              Cancelar
            </EmpresaButton>
            <EmpresaButton
              variant="primary"
              onClick={handleSaveSiniestro}
              loading={savingSiniestro}
              disabled={savingSiniestro}
            >
              <FiSave className="w-4 h-4 mr-2" />
              Guardar Cambios
            </EmpresaButton>
          </div>
        </div>
      </Modal>

      {/* Modal de Edición de Póliza */}
      <Modal
        open={showPolizaModal}
        onClose={() => !savingPoliza && setShowPolizaModal(false)}
        title="Editar Información de Póliza"
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Número de Póliza"
              name="numero_poliza"
              value={polizaForm.numero_poliza}
              onChange={handlePolizaFormChange}
              placeholder="Ej: POL-2024-001"
            />
            <Input
              label="Suma Asegurada"
              name="suma_asegurada"
              type="number"
              value={polizaForm.suma_asegurada}
              onChange={handlePolizaFormChange}
              step="0.01"
              placeholder="0.00"
            />
            <Input
              label="Deducible"
              name="deducible"
              type="number"
              value={polizaForm.deducible}
              onChange={handlePolizaFormChange}
              step="0.01"
              placeholder="0.00"
            />
            <Input
              label="Reserva"
              name="reserva"
              type="number"
              value={polizaForm.reserva}
              onChange={handlePolizaFormChange}
              step="0.01"
              placeholder="0.00"
            />
            <Input
              label="Coaseguro"
              name="coaseguro"
              type="number"
              value={polizaForm.coaseguro}
              onChange={handlePolizaFormChange}
              step="0.01"
              placeholder="0.00"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => setShowPolizaModal(false)}
              disabled={savingPoliza}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSavePoliza}
              disabled={savingPoliza}
            >
              {savingPoliza ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <FiSave className="w-4 h-4 mr-2" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/**
 * Componente para mostrar las etapas de un flujo en formato timeline/stepper
 */
function EtapasTimeline({
  etapas,
  documentosExistentes,
  onOpenEditor,
  onViewDocument,
  empresaColors,
}: {
  etapas: EtapaFlujo[];
  documentosExistentes: DocumentoEtapa[];
  onOpenEditor: (etapa: EtapaFlujo) => void;
  onViewDocument: (etapa: EtapaFlujo) => void;
  empresaColors: { primary: string; secondary: string; tertiary: string };
}) {
  if (!etapas || etapas.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <FiLayers className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500">Este flujo no tiene etapas configuradas</p>
      </div>
    );
  }

  // Ordenar etapas por orden
  const etapasOrdenadas = [...etapas].sort((a, b) => a.orden - b.orden);

  // Determinar si una etapa tiene plantilla/documento disponible
  const tieneDocumentoDisponible = (etapa: EtapaFlujo) => {
    return (
      etapa.tipo_documento_principal_id ||
      etapa.categoria_documento_id ||
      etapa.plantilla_documento_id
    );
  };

  return (
    <div className="space-y-1">
      <div className="relative">
        {etapasOrdenadas.map((etapa, index) => (
          <div key={etapa.id} className="relative flex items-start group">
            {/* Línea conectora vertical */}
            {index < etapasOrdenadas.length - 1 && (
              <div
                className="absolute left-5 top-10 w-0.5 h-full transition-colors"
                style={{
                  height: "calc(100% - 8px)",
                  backgroundColor: empresaColors.secondary + "40",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    empresaColors.secondary + "80";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    empresaColors.secondary + "40";
                }}
              />
            )}

            {/* Número de etapa */}
            <div
              className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm shadow-md transition-all"
              style={{
                background: `linear-gradient(135deg, ${empresaColors.primary} 0%, ${empresaColors.secondary} 100%)`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {etapa.orden}
            </div>

            {/* Contenido de la etapa */}
            <div className="ml-4 flex-1 pb-8">
              <div
                className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all"
                style={{
                  borderColor: "rgba(0, 0, 0, 0.1)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor =
                    empresaColors.primary + "60";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(0, 0, 0, 0.1)";
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-base font-semibold text-gray-900 mb-1">
                      {etapa.nombre}
                    </h4>
                    {etapa.descripcion && (
                      <p className="text-sm text-gray-600 mb-2">
                        {etapa.descripcion}
                      </p>
                    )}

                    {/* Badges de configuración */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {etapa.es_obligatoria && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700 rounded-full border border-red-200">
                          <FiAlertCircle className="w-3 h-3 mr-1" />
                          Obligatoria
                        </span>
                      )}
                      {etapa.inhabilita_siguiente && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-yellow-50 text-yellow-700 rounded-full border border-yellow-200">
                          <FiClock className="w-3 h-3 mr-1" />
                          Bloquea siguiente
                        </span>
                      )}
                      {etapa.permite_omision && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-50 text-gray-600 rounded-full border border-gray-200">
                          Permite omisión
                        </span>
                      )}
                      {etapa.tipo_documento_principal && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-full border border-purple-200">
                          📁 {etapa.tipo_documento_principal.nombre}
                        </span>
                      )}
                      {etapa.categoria_documento && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                          📂 {etapa.categoria_documento.nombre}
                        </span>
                      )}
                      {etapa.plantilla_documento && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full border border-green-200">
                          📄 {etapa.plantilla_documento.nombre}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Botones para ver/editar documento */}
                  <div className="ml-4 flex-shrink-0 flex gap-2">
                    {tieneDocumentoDisponible(etapa) ? (
                      (() => {
                        const docExistente = documentosExistentes.find(
                          (doc: any) => doc.etapa_flujo_id === etapa.id
                        );
                        if (docExistente) {
                          // Si existe documento, mostrar botones "Ver" y "Editar"
                          return (
                            <>
                              <button
                                onClick={() => onViewDocument(etapa)}
                                className="flex items-center gap-2 px-3 py-2 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                                style={{
                                  backgroundColor: empresaColors.tertiary,
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.opacity = "0.9";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.opacity = "1";
                                }}
                                title="Ver documento como PDF"
                              >
                                <FiEye className="w-4 h-4" />
                                Ver
                              </button>
                              <button
                                onClick={() => onOpenEditor(etapa)}
                                className="flex items-center gap-2 px-3 py-2 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                                style={{
                                  backgroundColor: empresaColors.primary,
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.opacity = "0.9";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.opacity = "1";
                                }}
                                title="Editar documento"
                              >
                                <FiEdit3 className="w-4 h-4" />
                                Editar
                              </button>
                            </>
                          );
                        } else {
                          // Si no existe, mostrar botón con texto dinámico según la etapa
                          const getDocumentoButtonText = (
                            etapaNombre: string
                          ) => {
                            // Convertir el nombre de la etapa a minúsculas para normalizar
                            const nombreLower = etapaNombre.toLowerCase();

                            // Si el nombre contiene "primera atención" o similar
                            if (
                              nombreLower.includes("primera atención") ||
                              nombreLower.includes("primera atencion")
                            ) {
                              return "Cargar informe primera atención";
                            }

                            // Si contiene "informe"
                            if (nombreLower.includes("informe")) {
                              return `Cargar ${etapaNombre.toLowerCase()}`;
                            }

                            // Si contiene "documento"
                            if (nombreLower.includes("documento")) {
                              return `Cargar ${etapaNombre.toLowerCase()}`;
                            }

                            // Por defecto, usar el nombre de la etapa con "Cargar informe"
                            return `Cargar informe ${etapaNombre.toLowerCase()}`;
                          };

                          return (
                            <EmpresaButton
                              variant="primary"
                              size="sm"
                              onClick={() => onOpenEditor(etapa)}
                            >
                              <FiEdit3 className="w-4 h-4 mr-2" />
                              {getDocumentoButtonText(etapa.nombre)}
                            </EmpresaButton>
                          );
                        }
                      })()
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
                        title="Sin documento configurado"
                      >
                        <FiClock className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Componente para mostrar la lista de documentos generados en formato tabla
 */
function DocumentosList({
  documentos,
  loading,
  onViewDocument,
  onEditDocument,
  siniestroId,
  empresaColors,
}: {
  documentos: any[];
  loading: boolean;
  onViewDocument: (documento: any) => void;
  onEditDocument: (documento: any) => void;
  siniestroId: string;
  empresaColors: { primary: string; secondary: string; tertiary: string };
}) {
  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        accessorKey: "nombre_archivo",
        header: "Nombre del Archivo",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <FiFileText
              className="w-4 h-4"
              style={{ color: empresaColors.primary }}
            />
            <span className="font-medium text-gray-900">
              {row.original.nombre_archivo}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "descripcion",
        header: "Descripción",
        cell: ({ row }) => (
          <span className="text-gray-600">
            {row.original.descripcion || "-"}
          </span>
        ),
      },
      {
        accessorKey: "version",
        header: "Versión",
        cell: ({ row }) => (
          <span className="text-gray-700">{row.original.version}</span>
        ),
      },
      {
        accessorKey: "es_principal",
        header: "Tipo",
        cell: ({ row }) => (
          <div className="flex gap-1">
            {row.original.es_principal && (
              <span className="px-2 py-0.5 text-xs bg-red-50 text-red-700 rounded-full border border-red-200">
                Principal
              </span>
            )}
            {row.original.es_adicional && (
              <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                Adicional
              </span>
            )}
            {!row.original.es_principal && !row.original.es_adicional && (
              <span className="text-xs text-gray-400">-</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "creado_en",
        header: "Fecha de Creación",
        cell: ({ row }) => (
          <span className="text-gray-600">
            {new Date(row.original.creado_en).toLocaleDateString("es-MX", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ),
      },
      {
        accessorKey: "tamaño_archivo",
        header: "Tamaño",
        cell: ({ row }) => (
          <span className="text-gray-600">
            {row.original.tamaño_archivo
              ? `${(row.original.tamaño_archivo / 1024).toFixed(2)} KB`
              : "-"}
          </span>
        ),
      },
      {
        id: "acciones",
        header: "Acciones",
        cell: ({ row }) => {
          const documento = row.original;
          return (
            <div className="flex items-center gap-2">
              {documento.contenido ? (
                <>
                  <button
                    onClick={() => onViewDocument(documento)}
                    className="flex items-center gap-1 px-2 py-1 text-white text-xs font-medium rounded transition-colors"
                    style={{
                      backgroundColor: empresaColors.tertiary,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "0.9";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "1";
                    }}
                    title="Ver documento como PDF"
                  >
                    <FiEye className="w-3 h-3" />
                    Ver
                  </button>
                  <button
                    onClick={() => onEditDocument(documento)}
                    className="flex items-center gap-1 px-2 py-1 text-white text-xs font-medium rounded transition-colors"
                    style={{
                      backgroundColor: empresaColors.primary,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "0.9";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "1";
                    }}
                    title="Editar documento"
                  >
                    <FiEdit3 className="w-3 h-3" />
                    Editar
                  </button>
                </>
              ) : (
                <span className="text-xs text-gray-400">Sin contenido</span>
              )}
            </div>
          );
        },
      },
    ],
    [onViewDocument, onEditDocument, empresaColors]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Cargando documentos...</span>
      </div>
    );
  }

  if (documentos.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <FiFileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No hay documentos generados</p>
        <p className="text-sm text-gray-400 mt-1">
          Los documentos generados desde las etapas aparecerán aquí
        </p>
      </div>
    );
  }

  return (
    <div>
      <DataTable
        columns={columns}
        data={documentos}
        emptyText="No hay documentos generados"
        enableSearch={true}
        searchPlaceholder="Buscar documentos..."
        enablePagination={true}
        enableSorting={true}
        pageSize={10}
        size="default"
        maxTextLength={50}
      />
    </div>
  );
}

/**
 * Componente para mostrar la lista de actividades de bitácora
 */
function BitacoraList({
  bitacoras,
  loading,
  siniestroId,
  areaId,
  flujoTrabajoId,
  onRefresh,
}: {
  bitacoras: BitacoraActividad[];
  loading: boolean;
  siniestroId: string;
  areaId?: string;
  flujoTrabajoId?: string;
  onRefresh: () => void;
}) {
  const getTipoActividadIcon = (tipo: string) => {
    switch (tipo) {
      case "documento":
        return <FiFileText className="w-4 h-4" />;
      case "llamada":
        return <FiClock className="w-4 h-4" />;
      case "reunion":
        return <FiCheckCircle className="w-4 h-4" />;
      case "inspeccion":
        return <FiAlertCircle className="w-4 h-4" />;
      default:
        return <FiClock className="w-4 h-4" />;
    }
  };

  const getTipoActividadColor = (tipo: string) => {
    switch (tipo) {
      case "documento":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "llamada":
        return "bg-green-100 text-green-700 border-green-200";
      case "reunion":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "inspeccion":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Cargando bitácora...</span>
      </div>
    );
  }

  if (bitacoras.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <FiClock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">
          No hay actividades registradas
        </p>
        <p className="text-sm text-gray-400 mt-1">
          Las actividades de bitácora aparecerán aquí
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-3">
        {bitacoras.map((actividad) => (
          <div
            key={actividad.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${getTipoActividadColor(
                      actividad.tipo_actividad
                    )}`}
                  >
                    {getTipoActividadIcon(actividad.tipo_actividad)}
                    <span className="ml-1 capitalize">
                      {actividad.tipo_actividad}
                    </span>
                  </span>
                  {actividad.horas_trabajadas > 0 && (
                    <span className="text-xs text-gray-500">
                      {actividad.horas_trabajadas} hrs
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-900 mb-2">
                  {actividad.descripcion}
                </p>
                {actividad.comentarios && (
                  <p className="text-xs text-gray-600 mb-2 italic">
                    {actividad.comentarios}
                  </p>
                )}
                <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                  <span>
                    {new Date(actividad.fecha_actividad).toLocaleDateString(
                      "es-MX",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </span>
                  <span>•</span>
                  <span>
                    Registrado:{" "}
                    {new Date(actividad.creado_en).toLocaleDateString("es-MX")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
