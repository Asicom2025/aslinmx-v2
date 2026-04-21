/**
 * Página de detalle de Siniestro
 * Muestra las etapas organizadas por área y flujo de trabajo
 * Permite editar documentos desde plantillas
 */

"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { usePermisos } from "@/hooks/usePermisos";
import apiService from "@/lib/apiService";
import { addRecentVisitedSiniestro } from "@/lib/recentSiniestrosStorage";
import { swalError, swalSuccess, swalConfirm } from "@/lib/swal";
import { buildSiniestroIdLegible } from "@/lib/siniestroIdDisplay";
import { decodeHtmlForEditor } from "@/lib/decodeHtmlForEditor";
import { getUserDisplayName } from "@/lib/userName";
import { filtrarAbogadosPorAreas } from "@/lib/usuariosAreas";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import JoditEditor from "@/components/ui/JoditEditor";
import DataTable from "@/components/ui/DataTable";
import Input from "@/components/ui/Input";
import CustomSelect, { SelectOption, SelectGroupedOption } from "@/components/ui/Select";
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
import { useTour } from "@/hooks/useTour";
import TourButton from "@/components/ui/TourButton";
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
  FiPaperclip,
  FiCornerDownRight,
  FiAlertTriangle,
  FiUserPlus,
  FiUpload,
  FiChevronRight,
} from "react-icons/fi";
import FormularioContinuacionModal from "@/components/plantillas/FormularioContinuacionModal";
import CrearAseguradoModal from "@/components/siniestros/CrearAseguradoModal";
import LegacyDocumentClassificationModal from "@/components/siniestros/LegacyDocumentClassificationModal";
import {
  buildPolizasPayload,
  PolizaDraft,
} from "@/components/siniestros/SiniestroWizard";
import { DocumentoAcciones } from "@/components/siniestros/DocumentoAcciones";
import type { Siniestro, ProvenienteContacto } from "@/types/siniestros";
import type {
  SiniestroArea,
  SiniestroUsuario,
} from "@/types/siniestrosRelaciones";
import type {
  FlujoTrabajo,
  FlujoCompleto,
  EtapaFlujo,
  RequisitoDocumento,
} from "@/types/flujosTrabajo";
import type { BitacoraActividad } from "@/types/bitacora";
import { FaCheck } from "react-icons/fa";

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
  plantilla_continuacion_id?: string | null;
  campos_formulario?: Array<{
    clave: string;
    tipo: string;
    titulo: string;
    placeholder?: string;
    tamano?: string;
    requerido?: boolean;
    opciones?: string[];
    orden?: number;
  }> | null;
}

interface DocumentoEtapa {
  id: string;
  nombre_archivo: string;
  contenido?: string;
  etapa_flujo_id: string;
  area_id?: string;
  plantilla_documento_id?: string;
  /** Categoría (viene del requisito o de la plantilla) */
  categoria_documento_nombre?: string | null;
  version: number;
  creado_en: string;
}

interface VersionDescripcionHechos {
  id: string;
  version: number;
  descripcion_html: string;
  es_actual: boolean;
  creado_en?: string;
}

function buildPolizaTempId(prefix = "poliza") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildEmptyPolizaDraft(): PolizaDraft {
  return {
    tempId: buildPolizaTempId(),
    numero_poliza: "",
    deducible: 0,
    reserva: 0,
    coaseguro: 0,
    suma_asegurada: 0,
  };
}

function getPolizaDraftsFromSiniestro(siniestro: Siniestro | null): PolizaDraft[] {
  if (siniestro?.polizas?.length) {
    return siniestro.polizas.map((poliza, index) => ({
      id: poliza.id,
      tempId: buildPolizaTempId(`poliza-${index}`),
      numero_poliza: poliza.numero_poliza || "",
      deducible: poliza.deducible ?? 0,
      reserva: poliza.reserva ?? 0,
      coaseguro: poliza.coaseguro ?? 0,
      suma_asegurada: poliza.suma_asegurada ?? 0,
    }));
  }
  return [buildEmptyPolizaDraft()];
}

function getDisplayPolizasFromSiniestro(siniestro: Siniestro | null): PolizaDraft[] {
  return getPolizaDraftsFromSiniestro(siniestro).filter(
    (poliza) =>
      !!poliza.numero_poliza ||
      Number(poliza.deducible || 0) > 0 ||
      Number(poliza.reserva || 0) > 0 ||
      Number(poliza.coaseguro || 0) > 0 ||
      Number(poliza.suma_asegurada || 0) > 0,
  );
}

export default function SiniestroDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: userLoading } = useUser();
  const siniestroId = params.id as string;
  useTour("tour-detalle-siniestro", { autoStart: true });

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
  const legacyAssignedAreas = useMemo(
    () =>
      areasConFlujos.map((areaConFlujos) => ({
        id: areaConFlujos.area.id,
        nombre: areaConFlujos.area.nombre,
        flowNames: areaConFlujos.flujos.map((item) => item.flujo.nombre),
      })),
    [areasConFlujos],
  );

  // Estado para el modal de edición de documento
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [docHorasBitacora, setDocHorasBitacora] = useState("");
  const [docComentarioBitacora, setDocComentarioBitacora] = useState("");
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
  /** Vista previa de archivos subidos (PDF/imagen) vía object URL */
  const [archivoPreviewUrl, setArchivoPreviewUrl] = useState<string | null>(
    null,
  );
  const [archivoPreviewMime, setArchivoPreviewMime] = useState<string>("");
  const [documentoEnVistaPrevia, setDocumentoEnVistaPrevia] = useState<
    any | null
  >(null);

  const revokeArchivoPreviewUrl = () => {
    setArchivoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setArchivoPreviewMime("");
  };
  const [documentosExistentes, setDocumentosExistentes] = useState<
    DocumentoEtapa[]
  >([]);

  // Estado para modal de formulario de continuación (llenar datos para documento de continuación)
  const [showFormularioContinuacionModal, setShowFormularioContinuacionModal] =
    useState(false);
  const [
    formularioContinuacionPlantillaId,
    setFormularioContinuacionPlantillaId,
  ] = useState<string>("");
  const [
    formularioContinuacionPlantillaNombre,
    setFormularioContinuacionPlantillaNombre,
  ] = useState<string>("");

  // Estado para subir archivo (fotos, PDF, etc.) como documento
  const [showUploadDocModal, setShowUploadDocModal] = useState(false);
  const [uploadDocFile, setUploadDocFile] = useState<File | null>(null);
  const [uploadDocDescripcion, setUploadDocDescripcion] = useState("");
  const [uploadDocSaving, setUploadDocSaving] = useState(false);
  const [uploadDocTipoId, setUploadDocTipoId] = useState("");
  const [uploadDocCategoriaId, setUploadDocCategoriaId] = useState("");
  const [uploadDocPlantillaId, setUploadDocPlantillaId] = useState("");
  const [uploadTiposDocumento, setUploadTiposDocumento] = useState<
    { id: string; nombre: string; tipo?: string }[]
  >([]);
  const [uploadCategorias, setUploadCategorias] = useState<
    { id: string; nombre: string }[]
  >([]);
  const [uploadPlantillas, setUploadPlantillas] = useState<
    { id: string; nombre: string }[]
  >([]);
  const [uploadDocLoadingCatalogos, setUploadDocLoadingCatalogos] =
    useState(false);
  const [uploadDocHoras, setUploadDocHoras] = useState("");
  const [uploadDocComentario, setUploadDocComentario] = useState("");

  /** Subida desde etapa (PDF/imagen): tipo fijo y lista de requisitos de la etapa */
  const [uploadModalEtapaContext, setUploadModalEtapaContext] =
    useState<EtapaFlujo | null>(null);
  const [uploadEtapaRequisitos, setUploadEtapaRequisitos] = useState<
    RequisitoDocumento[]
  >([]);
  const [uploadRequisitoSeleccionadoId, setUploadRequisitoSeleccionadoId] =
    useState("");
  const [uploadEtapaLoadingReqs, setUploadEtapaLoadingReqs] = useState(false);

  // Estado para envío de correo con documento
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailForm, setEmailForm] = useState<{
    configuracion_smtp_id: string;
    asunto: string;
    mensaje: string;
    archivos_adicionales: File[];
    documento_id: string | null;
    tipo_documento_nombre: string;
    categoria_nombre: string;
  }>({
    configuracion_smtp_id: "",
    asunto: "",
    mensaje: "",
    archivos_adicionales: [],
    documento_id: null,
    tipo_documento_nombre: "",
    categoria_nombre: "",
  });
  const [smtpConfigs, setSmtpConfigs] = useState<any[]>([]);
  // Destinatarios unificados (Para / CC / CCO) — emails directos
  const [emailPara, setEmailPara] = useState<string[]>([]);
  const [emailCc, setEmailCc] = useState<string[]>([]);
  const [emailCco, setEmailCco] = useState<string[]>([]);
  const [provenienteContactos, setProvenienteContactos] = useState<
    ProvenienteContacto[]
  >([]);
  const [showNuevoContactoModal, setShowNuevoContactoModal] = useState(false);
  const [nuevoContactoForm, setNuevoContactoForm] = useState({
    nombre: "",
    correo: "",
  });

  // Estado para tabs internos (Etapas, Documentos, Bitácora)
  const [activeContentTab, setActiveContentTab] = useState<
    "etapas" | "documentos" | "bitacora"
  >("etapas");

  // Estados para documentos y bitácoras filtradas por área/flujo
  const [documentosFiltrados, setDocumentosFiltrados] = useState<any[]>([]);
  const [bitacorasFiltradas, setBitacorasFiltradas] = useState<any[]>([]);
  const [loadingDocumentos, setLoadingDocumentos] = useState(false);
  const [loadingBitacoras, setLoadingBitacoras] = useState(false);

  const { can } = usePermisos();
  const canVerDocumentos = can("siniestros", "ver_documentos");
  const canSubirArchivo = can("siniestros", "subir_archivo");
  const canVerBitacora = can("siniestros", "ver_bitacora");
  const canGenerarPdf = can("siniestros", "generar_pdf");
  const canActualizarSiniestro = can("siniestros", "update");
  const canAgregarAbogado = can("siniestros", "asignar_abogado");
  const canCrearSiniestro = can("siniestros", "create");
  const canAsignarAreas = can("siniestros", "asignar_areas");
  const canEliminarSiniestro = can("siniestros", "delete");
  const canVerInvolucrados = can("siniestros", "ver_involucrados");

  // Estados para status y calificación
  const [estadosSiniestro, setEstadosSiniestro] = useState<EstadoSiniestro[]>(
    [],
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
  const [versionesDescripcionHechos, setVersionesDescripcionHechos] = useState<
    VersionDescripcionHechos[]
  >([]);
  const [selectedDescripcionVersionId, setSelectedDescripcionVersionId] =
    useState<string>("");
  const [showDescripcionModal, setShowDescripcionModal] = useState(false);
  const [descripcionEditHtml, setDescripcionEditHtml] = useState("");
  const [savingDescripcionVersion, setSavingDescripcionVersion] = useState(false);

  // Estados para modal de edición
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingSiniestro, setSavingSiniestro] = useState(false);
  const [editForm, setEditForm] = useState({
    numero_siniestro: "",
    fecha_registro: "",
    fecha_asignacion: "",
    fecha_siniestro: "",
    ubicacion: "",
    prioridad: "baja" as "baja" | "media" | "alta" | "critica",
    forma_contacto: "correo" as "correo" | "telefono" | "directa",
    numero_reporte: "",
    observaciones: "",
    asegurado_id: "" as string,
    institucion_id: "" as string,
    autoridad_id: "" as string,
    proveniente_id: "" as string,
    estado_id: "" as string,
    calificacion_id: "" as string,
  });
  const [editModalAsegurados, setEditModalAsegurados] = useState<any[]>([]);
  const [editModalInstituciones, setEditModalInstituciones] = useState<any[]>([]);
  const [editModalAutoridades, setEditModalAutoridades] = useState<any[]>([]);
  const [editModalProvenientes, setEditModalProvenientes] = useState<any[]>([]);
  const [editModalEstados, setEditModalEstados] = useState<any[]>([]);
  const [editModalCalificaciones, setEditModalCalificaciones] = useState<any[]>(
    [],
  );
  const [crearAseguradoDesdeEditModal, setCrearAseguradoDesdeEditModal] =
    useState(false);

  // Estados para administrar áreas e involucrados
  const [areasAdicionales, setAreasAdicionales] = useState<SiniestroArea[]>([]);
  const [involucrados, setInvolucrados] = useState<SiniestroUsuario[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingInvolucrados, setLoadingInvolucrados] = useState(false);
  const [todasLasAreas, setTodasLasAreas] = useState<any[]>([]);
  const [todosLosUsuarios, setTodosLosUsuarios] = useState<any[]>([]);
  const [nuevoInvolucradoUsuarioId, setNuevoInvolucradoUsuarioId] =
    useState<string>("");

  // Estados para modal de edición de póliza
  const [showPolizaModal, setShowPolizaModal] = useState(false);
  const [savingPoliza, setSavingPoliza] = useState(false);
  const [polizaForm, setPolizaForm] = useState<PolizaDraft[]>([
    buildEmptyPolizaDraft(),
  ]);

  // Estados para log de auditoría
  const [logsAuditoria, setLogsAuditoria] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Modal agregar/cambiar asegurado
  const [showModalAsegurado, setShowModalAsegurado] = useState(false);
  const [aseguradosCatalogo, setAseguradosCatalogo] = useState<any[]>([]);
  const [aseguradoSeleccionadoModal, setAseguradoSeleccionadoModal] =
    useState<string>("");
  const [showCrearAseguradoModal, setShowCrearAseguradoModal] = useState(false);
  const [asignandoAsegurado, setAsignandoAsegurado] = useState(false);

  const polizasDisplay = useMemo(
    () => getDisplayPolizasFromSiniestro(siniestro),
    [siniestro],
  );
  const polizaPrincipal = polizasDisplay[0] || null;
  const descripcionActual = useMemo(
    () =>
      versionesDescripcionHechos.find((version) => version.es_actual) ||
      versionesDescripcionHechos[0] ||
      null,
    [versionesDescripcionHechos],
  );
  const descripcionSeleccionada = useMemo(() => {
    if (!versionesDescripcionHechos.length) return null;
    if (selectedDescripcionVersionId) {
      const selected = versionesDescripcionHechos.find(
        (version) => version.id === selectedDescripcionVersionId,
      );
      if (selected) return selected;
    }
    return descripcionActual;
  }, [
    versionesDescripcionHechos,
    selectedDescripcionVersionId,
    descripcionActual,
  ]);
  const isDescripcionSeleccionadaUltima =
    !!descripcionSeleccionada &&
    !!descripcionActual &&
    descripcionSeleccionada.id === descripcionActual.id;

  const descripcionHechosVistaHtml = useMemo(
    () =>
      decodeHtmlForEditor(descripcionSeleccionada?.descripcion_html) ||
      decodeHtmlForEditor(siniestro?.descripcion_hechos || ""),
    [descripcionSeleccionada?.descripcion_html, siniestro?.descripcion_hechos],
  );

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

  /** Código de proveniente para `buildSiniestroIdLegible`: catálogo cargado o objeto anidado en el siniestro. */
  const codigoProvenienteParaIdLegible = (siniestroData: Siniestro | null) => {
    const fromCat = (provenienteInfo?.codigo || "").trim();
    if (fromCat) return fromCat;
    const nested = (siniestroData as any)?.proveniente;
    const c = nested?.codigo;
    return typeof c === "string" ? c.trim() : "";
  };

  /**
   * HTML de firma física para plantillas ({{firmado_por}}, {{firma_fisica}}).
   * Foto/firma en R2 llegan como data URL desde GET /users y GET /users/:id (lista también).
   */
  const buildFirmaPhysicalHtml = (autorUsuario: any): string => {
    const firmaRaw =
      (autorUsuario?.perfil && (autorUsuario.perfil as any).firma) ||
      autorUsuario?.firma ||
      "";
    let firmaSrc = "";
    if (typeof firmaRaw === "string" && firmaRaw.trim()) {
      const raw = firmaRaw.trim();
      if (raw.startsWith("data:")) {
        firmaSrc = raw;
      } else if (
        raw.startsWith("http://") ||
        raw.startsWith("https://") ||
        raw.startsWith("/")
      ) {
        firmaSrc = raw;
      } else {
        firmaSrc = `data:image/png;base64,${raw}`;
      }
    }
    return firmaSrc
      ? `<img src="${firmaSrc.replace(/"/g, "&quot;")}" alt="Firma" style="max-width:60px;height:auto;"/>`
      : "---";
  };

  /**
   * Aplica los valores dinámicos del siniestro y del contexto actual
   * a una plantilla HTML con placeholders tipo {{nombre_campo}}.
   */
  const aplicarPlaceholdersPlantilla = (
    contenido: string,
    etapa: EtapaFlujo,
    siniestroData: Siniestro | null,
    autorUsuario: any,
    asegurado: any,
  ): string => {
    if (!contenido) return contenido;

    const hoy = new Date();
    const formatoFecha = (fecha?: string | Date | null) => {
      if (!fecha) return "";
      const d = typeof fecha === "string" ? new Date(fecha) : fecha;
      if (Number.isNaN(d.getTime())) return "";
      const day = d.getDate().toString().padStart(2, "0");
      const month = (d.getMonth() + 1).toString().padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const nombreAsegurado =
      `${asegurado?.nombre || ""} ${asegurado?.apellido_paterno || ""} ${
        asegurado?.apellido_materno || ""
      }`.trim() ||
      asegurado?.full_name ||
      asegurado?.correo ||
      asegurado?.email ||
      "";

    const autorNombre =
      `${autorUsuario?.nombre || ""} ${autorUsuario?.apellido_paterno || ""} ${
        autorUsuario?.apellido_materno || ""
      }`.trim() ||
      autorUsuario?.full_name ||
      autorUsuario?.nombre_completo ||
      autorUsuario?.email ||
      "";

    const firmaHtml = buildFirmaPhysicalHtml(autorUsuario);

    // ID legible: mismo criterio que API (id_formato; si no, anualidad columna → fechas)
    const construirIdFormato = (): string => {
      if (!siniestroData) return "";
      return buildSiniestroIdLegible({
        id_formato: siniestroData.id_formato,
        codigoProveniente: codigoProvenienteParaIdLegible(siniestroData),
        codigoSiniestro: siniestroData.codigo,
        anualidad: siniestroData.anualidad,
        fecha_registro: siniestroData.fecha_registro,
        fecha_siniestro: siniestroData.fecha_siniestro,
      });
    };

    const idFormato = construirIdFormato();

    const areaPrincipalId = (siniestroData as any)?.area_principal_id;
    const relacionPrincipal = areaPrincipalId
      ? areasAdicionales.find(
          (ar) => String(ar.area_id) === String(areaPrincipalId),
        )
      : areasAdicionales[0];
    const fechaAsignacionSrc = relacionPrincipal?.fecha_asignacion;

    // Estado del siniestro: buscar nombre en el array ya cargado
    const estadoNombre =
      estadosSiniestro.find(
        (e) => String(e.id) === String((siniestroData as any)?.estado_id ?? ""),
      )?.nombre ?? "";

    const creadoEn = formatoFecha(
      (siniestroData as any)?.fecha_registro || siniestroData?.creado_en,
    );
    const polizaPrincipalData = getDisplayPolizasFromSiniestro(siniestroData)[0];

    const replacements: Record<string, string> = {
      // ── Fechas ──────────────────────────────────────────────────────────────
      fecha: formatoFecha(hoy),
      fecha_asignacion: formatoFecha(fechaAsignacionSrc),
      fecha_registro: creadoEn,
      creado_en: creadoEn,
      fecha_siniestro: formatoFecha(
        (siniestroData as any)?.fecha_siniestro,
      ),
      // ── ID / Códigos ─────────────────────────────────────────────────────────
      id: idFormato,
      numero_reporte: siniestroData?.numero_reporte || "",
      numero_siniestro: siniestroData?.numero_siniestro ?? "",
      numero_poliza: polizaPrincipalData?.numero_poliza ?? "",
      // ── Estado y calificación ────────────────────────────────────────────────
      estado_siniestro: estadoNombre,
      // ── Asegurado ────────────────────────────────────────────────────────────
      nombre_asegurado: nombreAsegurado,
      asegurado: nombreAsegurado,
      // ── Autor ────────────────────────────────────────────────────────────────
      autor: autorNombre,
      creado_por: autorNombre,
      // ── Firma física como imagen HTML (si no hay, se coloca '---') ───────────
      firmado_por: firmaHtml,
      firma_fisica: firmaHtml,
    };

    let resultado = contenido;
    Object.entries(replacements).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      resultado = resultado.replace(regex, value ?? "");
    });

    return resultado;
  };

  /**
   * Construye el objeto de variables para el PDF (header y cuerpo).
   * Incluye creado_en, creado_por, id, asegurado, area y el resto usado en plantillas.
   */
  const getVariablesForPdf = (
    siniestroData: Siniestro | null,
    doc: { creado_en?: string | null; area_id?: string | null } | null,
    areaNombre: string,
    aseguradoData: any,
    autorNombre: string,
    autorUsuario?: any | null,
  ): Record<string, string> => {
    const hoy = new Date();
    const formatoFecha = (fecha?: string | Date | null) => {
      if (!fecha) return "";
      const d = typeof fecha === "string" ? new Date(fecha) : fecha;
      if (Number.isNaN(d.getTime())) return "";
      const day = d.getDate().toString().padStart(2, "0");
      const month = (d.getMonth() + 1).toString().padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const nombreAsegurado =
      `${aseguradoData?.nombre || ""} ${aseguradoData?.apellido_paterno || ""} ${
        aseguradoData?.apellido_materno || ""
      }`.trim() ||
      aseguradoData?.full_name ||
      aseguradoData?.correo ||
      aseguradoData?.email ||
      "";

    const creadoEn = doc?.creado_en
      ? formatoFecha(doc.creado_en)
      : formatoFecha(
          (siniestroData as any)?.fecha_registro || siniestroData?.creado_en,
        );

    const construirIdFormato = (): string => {
      if (!siniestroData) return "";
      return buildSiniestroIdLegible({
        id_formato: siniestroData.id_formato,
        codigoProveniente: codigoProvenienteParaIdLegible(siniestroData),
        codigoSiniestro: siniestroData.codigo,
        anualidad: siniestroData.anualidad,
        fecha_registro: siniestroData.fecha_registro,
        fecha_siniestro: siniestroData.fecha_siniestro,
      });
    };

    const relacionParaFechaAsignacion = doc?.area_id
      ? areasAdicionales.find(
          (ar) => String(ar.area_id) === String(doc.area_id),
        )
      : areasAdicionales[0];
    const fechaAsignacionSrc = relacionParaFechaAsignacion?.fecha_asignacion;

    const estadoNombrePdf =
      estadosSiniestro.find(
        (e) =>
          String(e.id) === String((siniestroData as any)?.estado_id ?? ""),
      )?.nombre ?? "";
    const polizaPrincipalData = getDisplayPolizasFromSiniestro(siniestroData)[0];

    const firmaImg = buildFirmaPhysicalHtml(autorUsuario ?? {});

    return {
      creado_en: creadoEn,
      creado_por: autorNombre,
      firmado_por: firmaImg,
      firma_fisica: firmaImg,
      id: construirIdFormato(),
      asegurado: nombreAsegurado,
      area: areaNombre || "",
      fecha_registro: creadoEn,
      nombre_asegurado: nombreAsegurado,
      autor: autorNombre,
      fecha_asignacion: formatoFecha(fechaAsignacionSrc),
      fecha: formatoFecha(hoy),
      fecha_siniestro: formatoFecha((siniestroData as any)?.fecha_siniestro),
      numero_reporte: siniestroData?.numero_reporte || "",
      numero_siniestro: siniestroData?.numero_siniestro ?? "",
      numero_poliza: polizaPrincipalData?.numero_poliza ?? "",
      estado_siniestro: estadoNombrePdf,
    };
  };

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

  // Al cambiar de área, asegurar que el flujo activo pertenezca a esa área (si hay flujos del área).
  // Los flujos generales (prefijo "general-") son válidos en cualquier área y nunca se resetean.
  useEffect(() => {
    if (!activeAreaTab) return;

    // Un flujo general siempre es seleccionable sin importar el área activa
    if (activeFlujoTab.startsWith("general-")) return;

    const areaActual = areasConFlujos.find((a) => a.area.id === activeAreaTab);
    const flujosArea = areaActual?.flujos || [];
    if (flujosArea.length === 0) return;

    const flujoIdsArea = new Set(flujosArea.map((f) => `area-${f.flujo.id}`));
    if (!flujoIdsArea.has(activeFlujoTab)) {
      setActiveFlujoTab(`area-${flujosArea[0].flujo.id}`);
    }
  }, [activeAreaTab, areasConFlujos, activeFlujoTab]);

  // Agrupa documentos de informes (HTML con plantilla) y devuelve solo la última versión por grupo lógico
  const getUltimasVersionesDocumentos = (documentos: any[]): any[] => {
    if (!Array.isArray(documentos) || documentos.length === 0) return [];

    const informesPorClave = new Map<string, any>();
    const otros: any[] = [];

    for (const doc of documentos) {
      const esInforme = !!doc.contenido && !!doc.plantilla_documento_id;
      if (!esInforme) {
        otros.push(doc);
        continue;
      }

      const clave = [
        doc.siniestro_id || "",
        doc.etapa_flujo_id || "",
        doc.flujo_trabajo_id || "",
        doc.plantilla_documento_id || "",
        // Importante: en flujos generales, puede existir el mismo informe por área
        doc.area_id || "",
      ].join("::");

      const actual = informesPorClave.get(clave);
      if (!actual) {
        informesPorClave.set(clave, doc);
        continue;
      }

      const verActual = typeof actual.version === "number" ? actual.version : 1;
      const verNuevo = typeof doc.version === "number" ? doc.version : 1;
      if (verNuevo > verActual) {
        informesPorClave.set(clave, doc);
      }
    }

    const ultimosInformes = Array.from(informesPorClave.values());
    const combinados = [...ultimosInformes, ...otros];

    // Ordenar por fecha de creación descendente para una tabla más intuitiva
    combinados.sort((a, b) => {
      const da = a.creado_en ? new Date(a.creado_en).getTime() : 0;
      const db = b.creado_en ? new Date(b.creado_en).getTime() : 0;
      return db - da;
    });

    return combinados;
  };

  // Cargar documentos y bitácoras cuando cambia el área o flujo activo
  useEffect(() => {
    if (!activeFlujoTab) return;

    let areaId: string | undefined = activeAreaTab || undefined;
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
      // Cargar configuraciones SMTP disponibles para envío de correos
      loadSmtpConfigs();
    }
  }, [siniestro, siniestroId]);

  const loadVersionesDescripcionHechos = useCallback(
    async (fallbackDescripcionHtml?: string) => {
      try {
        const versiones = await apiService.getVersionesDescripcion(siniestroId);
        const versionesOrdenadas = Array.isArray(versiones)
          ? [...versiones]
              .sort(
                (a, b) => Number(b?.version || 0) - Number(a?.version || 0),
              )
              .map((v: any) => ({
                ...v,
                descripcion_html: decodeHtmlForEditor(v?.descripcion_html),
              }))
          : [];
        setVersionesDescripcionHechos(versionesOrdenadas);
        const versionActual =
          versionesOrdenadas.find((version) => version.es_actual) ||
          versionesOrdenadas[0];
        setSelectedDescripcionVersionId(versionActual?.id || "");
      } catch (error: any) {
        // Fallback para casos de datos heredados sin versiones.
        const descripcionLegacy = fallbackDescripcionHtml || "";
        if (descripcionLegacy.trim()) {
          const fallbackVersion: VersionDescripcionHechos = {
            id: "legacy-v1",
            version: 1,
            descripcion_html: decodeHtmlForEditor(descripcionLegacy),
            es_actual: true,
          };
          setVersionesDescripcionHechos([fallbackVersion]);
          setSelectedDescripcionVersionId(fallbackVersion.id);
          return;
        }
        setVersionesDescripcionHechos([]);
        setSelectedDescripcionVersionId("");
      }
    },
    [siniestroId],
  );

  const loadSiniestro = async () => {
    try {
      setSiniestroLoading(true);
      // Validar que siniestroId sea un UUID válido, no "nuevo"
      if (
        siniestroId === "nuevo" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          siniestroId,
        )
      ) {
        router.push("/siniestros");
        return;
      }
      const data = await apiService.getSiniestroById(siniestroId);
      setSiniestro(data);
      await loadVersionesDescripcionHechos(data?.descripcion_hechos || "");

      // Registrar en "recientes visitados" para el dashboard
      try {
        const fecha =
          (data as any).fecha_registro ??
          (data as any).creado_en;
        const areaId =
          (data as any).siniestro_areas?.[0]?.area_id ??
          (data as any).area_id ??
          undefined;
        addRecentVisitedSiniestro({
          id: String((data as any).id),
          numero_siniestro: (data as any).numero_siniestro ?? null,
          fecha_registro: fecha
            ? typeof fecha === "string"
              ? fecha
              : (fecha as Date).toISOString?.()
            : null,
          prioridad: (data as any).prioridad ?? "media",
          estado_id: (data as any).estado_id
            ? String((data as any).estado_id)
            : null,
          area_principal_id: areaId ? String(areaId) : null,
        });
      } catch {
        // ignorar errores de almacenamiento
      }

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

  const handleOpenEditDescripcion = useCallback(() => {
    if (!descripcionSeleccionada || !isDescripcionSeleccionadaUltima) return;
    setDescripcionEditHtml(
      decodeHtmlForEditor(descripcionSeleccionada.descripcion_html || ""),
    );
    setShowDescripcionModal(true);
  }, [descripcionSeleccionada, isDescripcionSeleccionadaUltima]);

  const handleSaveDescripcionVersion = useCallback(async () => {
    if (!descripcionActual) return;
    const html = descripcionEditHtml.trim();
    if (!html) {
      swalError("La descripción de los hechos no puede quedar vacía");
      return;
    }
    try {
      setSavingDescripcionVersion(true);
      const nuevaVersion = await apiService.createVersionDescripcion(siniestroId, {
        descripcion_html: html,
      });
      setSiniestro((prev) =>
        prev
          ? {
              ...prev,
              descripcion_hechos: decodeHtmlForEditor(
                nuevaVersion.descripcion_html || html,
              ),
            }
          : prev,
      );
      await loadVersionesDescripcionHechos(nuevaVersion.descripcion_html || html);
      await loadLogsAuditoria();
      setShowDescripcionModal(false);
      swalSuccess("Descripción de los hechos actualizada correctamente");
    } catch (error: any) {
      console.error("Error al guardar versión de descripción:", error);
      swalError(
        error.response?.data?.detail ||
          "Error al actualizar descripción de los hechos",
      );
    } finally {
      setSavingDescripcionVersion(false);
    }
  }, [
    descripcionActual,
    descripcionEditHtml,
    loadVersionesDescripcionHechos,
    siniestroId,
  ]);

  const loadDocumentosSiniestro = async () => {
    if (!canVerDocumentos) {
      setDocumentosExistentes([]);
      return;
    }
    try {
      const documentos = await apiService.getDocumentosSiniestro(siniestroId, {
        activo: true,
      });
      setDocumentosExistentes(getUltimasVersionesDocumentos(documentos));
    } catch (error: any) {
      console.error("Error al cargar documentos:", error);
    }
  };

  // Cargar información adicional del siniestro
  const loadInfoAdicional = async (siniestroData: Siniestro) => {
    try {
      setLoadingInfoAdicional(true);

      // Cargar información del asegurado (tabla asegurados)
      if (siniestroData.asegurado_id) {
        try {
          const asegurado = await apiService.getAseguradoById(
            siniestroData.asegurado_id,
          );
          setAseguradoInfo(asegurado);
        } catch (e: any) {
          // Cualquier fallo (404 = ID de usuario antiguo, 500, red, etc.): mostrar "Sin asegurado" y limpiar
          setAseguradoInfo(null);
          try {
            await apiService.updateSiniestro(siniestroData.id, {
              asegurado_id: null as any,
            });
            setSiniestro((prev) =>
              prev ? { ...prev, asegurado_id: undefined } : null,
            );
          } catch (_) {
            // Si falla el update (ej. permisos), al menos la UI ya muestra "Sin asegurado"
          }
        }
      } else {
        setAseguradoInfo(null);
      }

      // Cargar información de institución
      if (siniestroData.institucion_id) {
        try {
          const instituciones = await apiService.getInstituciones();
          const institucion = instituciones.find(
            (inst: any) => inst.id === siniestroData.institucion_id,
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
            (auth: any) => auth.id === siniestroData.autoridad_id,
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
            (prov: any) => prov.id === siniestroData.proveniente_id,
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

  // Abrir modal de asegurado y cargar catálogo
  const abrirModalAsegurado = useCallback(async () => {
    setShowModalAsegurado(true);
    setAseguradoSeleccionadoModal("");
    try {
      const data = await apiService.getAsegurados(true);
      setAseguradosCatalogo(data || []);
    } catch (e) {
      console.error("Error al cargar asegurados:", e);
      setAseguradosCatalogo([]);
    }
  }, []);

  // Asignar asegurado al siniestro
  const asignarAsegurado = useCallback(async () => {
    if (!aseguradoSeleccionadoModal || !siniestroId) return;
    setAsignandoAsegurado(true);
    try {
      await apiService.updateSiniestro(siniestroId, {
        asegurado_id: aseguradoSeleccionadoModal,
      });
      const asegurado = await apiService.getAseguradoById(
        aseguradoSeleccionadoModal,
      );
      setAseguradoInfo(asegurado);
      setSiniestro((prev) =>
        prev ? { ...prev, asegurado_id: aseguradoSeleccionadoModal } : null,
      );
      await loadLogsAuditoria();
      setShowModalAsegurado(false);
      swalSuccess("Asegurado asignado correctamente");
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al asignar asegurado");
    } finally {
      setAsignandoAsegurado(false);
    }
  }, [aseguradoSeleccionadoModal, siniestroId]);

  // Tras crear nuevo asegurado: si viene del modal Editar, solo actualizar form y lista; si no, asignar al siniestro y cerrar modal Asignar
  const onAseguradoCreadoDesdeModal = useCallback(
    async (nuevoId: string) => {
      setShowCrearAseguradoModal(false);
      const data = await apiService.getAsegurados(true);
      const list = data || [];

      if (crearAseguradoDesdeEditModal) {
        setCrearAseguradoDesdeEditModal(false);
        setEditModalAsegurados(list);
        setEditForm((prev) => ({ ...prev, asegurado_id: nuevoId }));
        swalSuccess(
          "Asegurado creado. Selecciónalo en el listado y guarda los cambios.",
        );
        return;
      }

      setAseguradosCatalogo(list);
      setAseguradoSeleccionadoModal(nuevoId);
      if (!siniestroId) return;
      setAsignandoAsegurado(true);
      try {
        await apiService.updateSiniestro(siniestroId, {
          asegurado_id: nuevoId,
        });
        const asegurado = await apiService.getAseguradoById(nuevoId);
        setAseguradoInfo(asegurado);
        setSiniestro((prev) =>
          prev ? { ...prev, asegurado_id: nuevoId } : null,
        );
        await loadLogsAuditoria();
        setShowModalAsegurado(false);
        swalSuccess("Asegurado creado y asignado correctamente");
      } catch (e: any) {
        swalError(e.response?.data?.detail || "Error al asignar asegurado");
      } finally {
        setAsignandoAsegurado(false);
      }
    },
    [siniestroId, crearAseguradoDesdeEditModal],
  );

  // Cargar documentos filtrados por área y flujo (solo si tiene permiso)
  const loadDocumentosFiltrados = async (
    areaId?: string,
    flujoTrabajoId?: string,
  ) => {
    if (!canVerDocumentos) {
      setDocumentosFiltrados([]);
      return;
    }
    try {
      setLoadingDocumentos(true);
      const documentos = await apiService.getDocumentosSiniestro(siniestroId, {
        activo: true,
        area_id: areaId,
        flujo_trabajo_id: flujoTrabajoId,
      });
      setDocumentosFiltrados(getUltimasVersionesDocumentos(documentos));
    } catch (error: any) {
      console.error("Error al cargar documentos filtrados:", error);
    } finally {
      setLoadingDocumentos(false);
    }
  };

  // Cargar bitácoras filtradas por área y flujo (solo si tiene permiso)
  const loadBitacorasFiltradas = async (
    areaId?: string,
    flujoTrabajoId?: string,
  ) => {
    if (!canVerBitacora) {
      setBitacorasFiltradas([]);
      return;
    }
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

  // Cargar configuraciones SMTP
  const loadSmtpConfigs = async () => {
    try {
      const configs = await apiService.getConfiguracionesSMTP(true);
      setSmtpConfigs(configs || []);
      // Si no hay seleccionada y existe alguna, preseleccionar la primera
      if (!emailForm.configuracion_smtp_id && configs && configs.length > 0) {
        setEmailForm((prev) => ({
          ...prev,
          configuracion_smtp_id: configs[0].id,
        }));
      }
    } catch (error: any) {
      console.error("Error al cargar configuraciones SMTP:", error);
    }
  };

  // Cargar estados de siniestro
  const loadEstadosSiniestro = async () => {
    try {
      setLoadingEstados(true);
      // Cargar todos los estados activos
      const estados = await apiService.getEstadosSiniestro(true);
      setEstadosSiniestro(estados);
    } catch (error: any) {
      console.error("Error al cargar estados de siniestro:", error);
      console.error("Error response:", error.response);
      swalError(
        error.response?.data?.detail || "Error al cargar estados de siniestro",
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
      setCalificacionesSiniestro(calificaciones);
    } catch (error: any) {
      console.error("Error al cargar calificaciones de siniestro:", error);
      console.error("Error response:", error.response);
      swalError(
        error.response?.data?.detail ||
          "Error al cargar calificaciones de siniestro",
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
      await loadSiniestro();
      await loadLogsAuditoria();
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
      await loadSiniestro();
      await loadLogsAuditoria();
      swalSuccess("Calificación actualizada correctamente");
    } catch (error: any) {
      console.error("Error al actualizar calificación:", error);
      swalError(
        error.response?.data?.detail || "Error al actualizar calificación",
      );
    } finally {
      setUpdatingCalificacion(false);
    }
  };

  const crearInstitucionEditModalDesdeNombre = useCallback(async (nombre: string) => {
    try {
      const created = await apiService.createInstitucion({ nombre, activo: true });
      if (!created?.id) return null;
      setEditModalInstituciones((prev) => [...(prev || []), created]);
      return String(created.id);
    } catch (e: any) {
      swalError(e.response?.data?.detail || "No se pudo crear la institución");
      return null;
    }
  }, []);

  const crearAutoridadEditModalDesdeNombre = useCallback(async (nombre: string) => {
    try {
      const created = await apiService.createAutoridad({ nombre, activo: true });
      if (!created?.id) return null;
      setEditModalAutoridades((prev) => [...(prev || []), created]);
      return String(created.id);
    } catch (e: any) {
      swalError(e.response?.data?.detail || "No se pudo crear la autoridad");
      return null;
    }
  }, []);

  // Abrir modal de edición
  const handleOpenEditModal = async () => {
    if (!siniestro) return;

    const reporteSrc =
      (siniestro as any).fecha_reporte || siniestro.fecha_registro;
    const fechaReporte = reporteSrc
      ? new Date(reporteSrc).toISOString().split("T")[0]
      : "";

    const areaPrincipalId = (siniestro as any)?.area_principal_id;
    const relacionPrincipal =
      areaPrincipalId
        ? areasAdicionales.find(
            (ar) => String(ar.area_id) === String(areaPrincipalId),
          )
        : areasAdicionales[0];

    const fechaAsignacionRel =
      relacionPrincipal?.fecha_asignacion
        ? String(relacionPrincipal.fecha_asignacion).includes("T")
          ? String(relacionPrincipal.fecha_asignacion).split("T")[0]
          : String(relacionPrincipal.fecha_asignacion).slice(0, 10)
        : "";
    const fechaAsignacionSin = (siniestro as any).fecha_asignacion
      ? String((siniestro as any).fecha_asignacion).includes("T")
        ? String((siniestro as any).fecha_asignacion).split("T")[0]
        : String((siniestro as any).fecha_asignacion).slice(0, 10)
      : "";
    const fechaAsignacion = fechaAsignacionSin || fechaAsignacionRel;

    const fechaSiniestroStr = (siniestro as any).fecha_siniestro
      ? new Date((siniestro as any).fecha_siniestro).toISOString().split("T")[0]
      : "";

    setEditForm({
      numero_siniestro: siniestro.numero_siniestro || "",
      fecha_registro: fechaReporte,
      fecha_asignacion: fechaAsignacion,
      fecha_siniestro: fechaSiniestroStr,
      ubicacion: siniestro.ubicacion || "",
      prioridad: siniestro.prioridad || "baja",
      forma_contacto: siniestro.forma_contacto || "correo",
      numero_reporte: siniestro.numero_reporte || "",
      observaciones: siniestro.observaciones || "",
      asegurado_id: siniestro.asegurado_id || "",
      institucion_id: siniestro.institucion_id || "",
      autoridad_id: siniestro.autoridad_id || "",
      proveniente_id: siniestro.proveniente_id || "",
      estado_id: siniestro.estado_id || "",
      calificacion_id: siniestro.calificacion_id || "",
    });
    setShowEditModal(true);
    try {
      const [
        aseguradosData,
        institucionesData,
        autoridadesData,
        provenientesData,
        estadosData,
        calificacionesData,
      ] = await Promise.all([
        apiService.getAsegurados(true),
        apiService.getInstituciones(true),
        apiService.getAutoridades(true),
        apiService.getProvenientes(true),
        apiService.getEstadosSiniestro(true),
        apiService.getCalificacionesSiniestro(true),
      ]);
      setEditModalAsegurados(aseguradosData || []);
      setEditModalInstituciones(institucionesData || []);
      setEditModalAutoridades(autoridadesData || []);
      setEditModalProvenientes(provenientesData || []);
      setEditModalEstados(estadosData || []);
      setEditModalCalificaciones(calificacionesData || []);
    } catch (_) {
      setEditModalAsegurados([]);
      setEditModalInstituciones([]);
      setEditModalAutoridades([]);
      setEditModalProvenientes([]);
      setEditModalEstados([]);
      setEditModalCalificaciones([]);
    }
  };

  // Guardar cambios del siniestro
  const handleSaveSiniestro = async () => {
    if (!siniestro) return;

    try {
      setSavingSiniestro(true);

      const fechaRegistroIso = editForm.fecha_registro
        ? editForm.fecha_registro.includes("T")
          ? editForm.fecha_registro
          : `${editForm.fecha_registro}T00:00:00`
        : undefined;

      const fechaAsignacionIso = editForm.fecha_asignacion
        ? editForm.fecha_asignacion.includes("T")
          ? editForm.fecha_asignacion
          : `${editForm.fecha_asignacion}T00:00:00`
        : undefined;

      const fechaSiniestroIso = editForm.fecha_siniestro
        ? editForm.fecha_siniestro.includes("T")
          ? editForm.fecha_siniestro
          : `${editForm.fecha_siniestro}T00:00:00`
        : undefined;

      const areaPrincipalId = (siniestro as any)?.area_principal_id;
      const relacionPrincipal =
        areaPrincipalId
          ? areasAdicionales.find(
              (ar) => String(ar.area_id) === String(areaPrincipalId),
            )
          : areasAdicionales[0];
      const relacionPrincipalId = relacionPrincipal?.id;
      const updateData: any = {
        numero_siniestro:
          editForm.numero_siniestro && editForm.numero_siniestro.trim()
            ? editForm.numero_siniestro
            : null,
        fecha_registro: fechaRegistroIso,
        fecha_reporte: fechaRegistroIso,
        fecha_asignacion: fechaAsignacionIso,
        fecha_siniestro: fechaSiniestroIso,
        ubicacion: editForm.ubicacion || undefined,
        prioridad: editForm.prioridad || undefined,
        forma_contacto: editForm.forma_contacto || undefined,
        numero_reporte:
          editForm.numero_reporte && editForm.numero_reporte.trim()
            ? editForm.numero_reporte
            : null,
        observaciones: editForm.observaciones || undefined,
        asegurado_id:
          editForm.asegurado_id && editForm.asegurado_id.trim()
            ? editForm.asegurado_id
            : null,
        institucion_id:
          editForm.institucion_id && editForm.institucion_id.trim()
            ? editForm.institucion_id
            : null,
        autoridad_id:
          editForm.autoridad_id && editForm.autoridad_id.trim()
            ? editForm.autoridad_id
            : null,
        proveniente_id:
          editForm.proveniente_id && editForm.proveniente_id.trim()
            ? editForm.proveniente_id
            : null,
        estado_id:
          editForm.estado_id && editForm.estado_id.trim()
            ? editForm.estado_id
            : null,
        calificacion_id:
          editForm.calificacion_id && editForm.calificacion_id.trim()
            ? editForm.calificacion_id
            : null,
      };

      await apiService.updateSiniestro(siniestroId, updateData);

      // Actualizar `fecha_asignacion` de la relación siniestro-área (si aplica)
      if (relacionPrincipalId && fechaAsignacionIso) {
        await apiService.updateAreaAdicional(relacionPrincipalId, {
          fecha_asignacion: fechaAsignacionIso,
        });
      }

      await loadSiniestro();
      await loadAreasAdicionales();
      await loadLogsAuditoria();
      setShowEditModal(false);
      swalSuccess("Siniestro actualizado correctamente");
    } catch (error: any) {
      console.error("Error al actualizar siniestro:", error);
      swalError(
        error.response?.data?.detail || "Error al actualizar siniestro",
      );
    } finally {
      setSavingSiniestro(false);
    }
  };

  // Manejar cambio en el formulario
  const handleEditFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]:
        value,
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
          true,
        );
        const flujosGeneralesConEtapas: FlujoConEtapas[] = [];

        for (const flujo of flujosGeneralesData) {
          try {
            const flujoCompleto: FlujoCompleto = await apiService.getFlujoById(
              flujo.id,
            );
            flujosGeneralesConEtapas.push({
              flujo: flujoCompleto,
              etapas: flujoCompleto.etapas || [],
            });
          } catch (error: any) {
            console.warn(
              `[loadFlujosPorAreas] No se pudieron cargar las etapas del flujo general "${flujo.nombre}" (${flujo.id}). ` +
              `Esto puede explicar que el tipo de documento no aparezca en producción. ` +
              `Error: ${error?.response?.data?.detail ?? error?.message ?? error}`,
            );
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
            true,
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
              console.warn(
                `[loadFlujosPorAreas] No se pudieron cargar las etapas del flujo "${flujo.nombre}" (${flujo.id}) ` +
                `para el área ${areaId}. ` +
                `Esto puede explicar que el tipo de documento no aparezca en producción. ` +
                `Error: ${error?.response?.data?.detail ?? error?.message ?? error}`,
              );
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
        e.response?.data?.detail || "Error al cargar flujos de trabajo",
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
        fecha_asignacion: new Date().toISOString(),
      });
      await loadAreasAdicionales();
      await loadFlujosPorAreas(); // Recargar flujos para reflejar cambios
      await loadLogsAuditoria();
      swalSuccess("Área agregada correctamente");
    } catch (error: any) {
      swalError(error.response?.data?.detail || "Error al agregar área");
    }
  };

  const handleRemoveArea = async (relacionId: string) => {
    try {
      const confirmed = await swalConfirm(
        "¿Estás seguro de eliminar esta área?",
        "Esta acción no se puede deshacer",
      );
      if (!confirmed) return;

      await apiService.removeAreaAdicional(relacionId);
      await loadAreasAdicionales();
      await loadFlujosPorAreas(); // Recargar flujos para reflejar cambios
      await loadLogsAuditoria();
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
        true,
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
    tipoRelacion: "asegurado" | "proveniente" | "testigo" | "tercero",
  ) => {
    if (!siniestroId) return;
    try {
      await apiService.addInvolucrado(siniestroId, {
        usuario_id: usuarioId,
        tipo_relacion: tipoRelacion,
        activo: true,
      });
      await loadInvolucrados();
      await loadLogsAuditoria();
      swalSuccess("Involucrado agregado correctamente");
    } catch (error: any) {
      swalError(error.response?.data?.detail || "Error al agregar involucrado");
    }
  };

  const handleRemoveInvolucrado = async (relacionId: string) => {
    try {
      const confirmed = await swalConfirm(
        "¿Estás seguro de eliminar este involucrado?",
        "Esta acción no se puede deshacer",
      );
      if (!confirmed) return;

      await apiService.removeInvolucrado(relacionId);
      await loadInvolucrados();
      await loadLogsAuditoria();
      swalSuccess("Involucrado eliminado correctamente");
    } catch (error: any) {
      swalError(
        error.response?.data?.detail || "Error al eliminar involucrado",
      );
    }
  };

  // Funciones para gestionar póliza
  const handleOpenPolizaModal = () => {
    setPolizaForm(getPolizaDraftsFromSiniestro(siniestro));
    setShowPolizaModal(true);
  };

  const handleSavePoliza = async () => {
    if (!siniestro) return;

    try {
      setSavingPoliza(true);

      const updateData: any = {
        polizas: buildPolizasPayload(polizaForm),
      };

      await apiService.updateSiniestro(siniestroId, updateData);
      await loadSiniestro();
      await loadLogsAuditoria();
      setShowPolizaModal(false);
      swalSuccess("Información de póliza actualizada correctamente");
    } catch (error: any) {
      if (error.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(
        error.response?.data?.detail ||
          "Error al actualizar información de póliza",
      );
    } finally {
      setSavingPoliza(false);
    }
  };

  const handlePolizaFormChange = (
    index: number,
    field: keyof PolizaDraft,
    value: string,
  ) => {
    setPolizaForm((prev) =>
      prev.map((poliza, polizaIndex) =>
        polizaIndex === index
          ? {
              ...poliza,
              [field]:
                field === "deducible" ||
                field === "reserva" ||
                field === "coaseguro" ||
                field === "suma_asegurada"
                  ? value === "" || Number.isNaN(Number(value))
                    ? 0
                    : Number(value)
                  : value,
            }
          : poliza,
      ),
    );
  };

  const handleAddPoliza = () => {
    setPolizaForm((prev) => [...prev, buildEmptyPolizaDraft()]);
  };

  const handleRemovePoliza = (index: number) => {
    setPolizaForm((prev) => {
      const updated = prev.filter((_, polizaIndex) => polizaIndex !== index);
      return updated.length > 0 ? updated : [buildEmptyPolizaDraft()];
    });
  };

  // Función para cargar logs de auditoría
  const loadLogsAuditoria = async () => {
    if (!siniestroId) return;

    try {
      setLoadingLogs(true);
      const logs = await apiService.getHistorialRegistro(
        "siniestros",
        siniestroId,
      );
      setLogsAuditoria(logs || []);
    } catch (error: any) {
      console.error("Error al cargar logs de auditoría:", error);
      // No mostrar error al usuario, solo log en consola
    } finally {
      setLoadingLogs(false);
    }
  };

  const logColumns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        accessorKey: "creado_en",
        header: "Fecha",
        cell: ({ row }) => (
          <span className="text-gray-700">
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
        accessorKey: "accion",
        header: "Acción",
        cell: ({ row }) => {
          const accion: string = row.original.accion || "";
          const accionUpper = accion.toUpperCase();

          const formatarAccionLabel = (value: string) => {
            const labels: Record<string, string> = {
              crear: "Siniestro creado",
              actualizar: "Actualización",
              eliminar: "Eliminación",
              estado_cambiado: "Cambio de estado",
              calificacion_cambiada: "Cambio de calificación",
              area_asignada: "Área asignada",
              area_desactivada: "Área desactivada",
              area_activada: "Área activada",
              area_eliminada: "Área eliminada",
              usuario_asignado: "Usuario asignado",
              usuario_eliminado: "Usuario eliminado",
              abogado_asignado: "Abogado asignado",
              abogado_eliminado: "Abogado eliminado",
              poliza_creada: "Póliza creada",
              poliza_actualizada: "Póliza actualizada",
              poliza_eliminada: "Póliza eliminada",
              etapa_completada: "Etapa completada",
              etapa_reabierta: "Etapa reabierta",
              documento_creado: "Documento creado",
              documento_actualizado: "Documento actualizado",
              documento_subido: "Archivo subido",
              documento_upload_fallo: "Fallo al subir archivo",
              documento_eliminado: "Documento eliminado",
              bitacora_creada: "Actividad en bitácora",
              bitacora_actualizada: "Actividad actualizada",
              formulario_actualizado: "Formulario actualizado",
              error: "Error",
            };
            return labels[value?.toLowerCase()] || value || "Acción";
          };

          const getAccionIcon = (value: string) => {
            switch (value?.toUpperCase()) {
              case "CREATE":
              case "CREAR":
                return <FiPlus className="w-4 h-4" />;
              case "UPDATE":
              case "ACTUALIZAR":
                return <FiEdit3 className="w-4 h-4" />;
              case "DELETE":
              case "ELIMINAR":
                return <FiTrash2 className="w-4 h-4" />;
              case "ERROR":
                return <FiAlertTriangle className="w-4 h-4" />;
              case "ESTADO_CAMBIADO":
                return <FiActivity className="w-4 h-4" />;
              case "CALIFICACION_CAMBIADA":
                return <FiCheckCircle className="w-4 h-4" />;
              case "AREA_ASIGNADA":
              case "AREA_ACTIVADA":
                return <FiLayers className="w-4 h-4" />;
              case "AREA_DESACTIVADA":
              case "AREA_ELIMINADA":
                return <FiTrash2 className="w-4 h-4" />;
              case "USUARIO_ASIGNADO":
              case "ABOGADO_ASIGNADO":
                return <FiUserPlus className="w-4 h-4" />;
              case "USUARIO_ELIMINADO":
              case "ABOGADO_ELIMINADO":
                return <FiUserPlus className="w-4 h-4" />;
              case "POLIZA_CREADA":
              case "POLIZA_ACTUALIZADA":
              case "POLIZA_ELIMINADA":
                return <FiFileText className="w-4 h-4" />;
              case "ETAPA_COMPLETADA":
              case "ETAPA_REABIERTA":
                return <FiCheckCircle className="w-4 h-4" />;
              case "DOCUMENTO_CREADO":
              case "DOCUMENTO_ACTUALIZADO":
              case "DOCUMENTO_SUBIDO":
                return <FiFileText className="w-4 h-4" />;
              case "DOCUMENTO_UPLOAD_FALLO":
                return <FiAlertTriangle className="w-4 h-4" />;
              case "DOCUMENTO_ELIMINADO":
                return <FiTrash2 className="w-4 h-4" />;
              case "BITACORA_CREADA":
              case "BITACORA_ACTUALIZADA":
                return <FiClock className="w-4 h-4" />;
              case "FORMULARIO_ACTUALIZADO":
                return <FiFileText className="w-4 h-4" />;
              default:
                return <FiActivity className="w-4 h-4" />;
            }
          };

          const getAccionColor = (value: string) => {
            const a = value?.toUpperCase();
            if (a === "ERROR" || a === "DOCUMENTO_UPLOAD_FALLO") {
              return "bg-red-200 text-red-800 border-red-300";
            }
            switch (a) {
              case "CREATE":
              case "CREAR":
                return "bg-green-100 text-green-700 border-green-200";
              case "UPDATE":
              case "ACTUALIZAR":
                return "bg-blue-100 text-blue-700 border-blue-200";
              case "DELETE":
              case "ELIMINAR":
              case "AREA_ELIMINADA":
              case "USUARIO_ELIMINADO":
              case "ABOGADO_ELIMINADO":
              case "DOCUMENTO_ELIMINADO":
                return "bg-red-100 text-red-700 border-red-200";
              case "ESTADO_CAMBIADO":
              case "CALIFICACION_CAMBIADA":
                return "bg-amber-100 text-amber-700 border-amber-200";
              case "AREA_ASIGNADA":
              case "AREA_ACTIVADA":
              case "USUARIO_ASIGNADO":
              case "ABOGADO_ASIGNADO":
                return "bg-emerald-100 text-emerald-700 border-emerald-200";
              case "AREA_DESACTIVADA":
                return "bg-orange-100 text-orange-700 border-orange-200";
              case "POLIZA_CREADA":
              case "POLIZA_ACTUALIZADA":
              case "POLIZA_ELIMINADA":
              case "DOCUMENTO_ACTUALIZADO":
                return "bg-indigo-100 text-indigo-700 border-indigo-200";
              case "ETAPA_COMPLETADA":
              case "ETAPA_REABIERTA":
                return "bg-teal-100 text-teal-700 border-teal-200";
              case "DOCUMENTO_CREADO":
              case "DOCUMENTO_SUBIDO":
                return "bg-violet-100 text-violet-700 border-violet-200";
              case "BITACORA_CREADA":
              case "BITACORA_ACTUALIZADA":
                return "bg-cyan-100 text-cyan-700 border-cyan-200";
              case "FORMULARIO_ACTUALIZADO":
                return "bg-amber-100 text-amber-700 border-amber-200";
              default:
                return "bg-gray-100 text-gray-700 border-gray-200";
            }
          };

          return (
            <span
              className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${getAccionColor(
                accionUpper,
              )}`}
            >
              {getAccionIcon(accionUpper)}
              <span className="ml-1">{formatarAccionLabel(accion)}</span>
            </span>
          );
        },
      },
      {
        accessorKey: "descripcion",
        header: "Descripción",
        cell: ({ row }) => (
          <span className="text-gray-900">
            {row.original.descripcion || "-"}
          </span>
        ),
      },
      {
        accessorKey: "tabla",
        header: "Tabla",
        cell: ({ row }) => (
          <span className="text-gray-600">{row.original.tabla || "-"}</span>
        ),
      },
      {
        accessorKey: "usuario_id",
        header: "Usuario",
          cell: ({ row }) => {
            const u = row.original.usuario;
            const nombre = getUserDisplayName(u, row.original.usuario_id || "-");
            return <span className="text-gray-600">{nombre}</span>;
          },
        },
    ],
    [],
  );

  // Función para abrir el editor de documento de una etapa
  // Función para ver el documento como PDF desde una etapa
  const handleViewDocument = async (etapa: EtapaFlujo) => {
    revokeArchivoPreviewUrl();
    setDocumentoEnVistaPrevia(null);
    setCurrentEtapa(etapa);
    setPdfLoading(true);
    setShowPdfModal(true);
    setPdfBase64(null);

    try {
      // Determinar el flujo_trabajo_id actual basado en el tab activo
      let flujoTrabajoIdActual: string | undefined = undefined;
      const areaIdActual: string | undefined = activeAreaTab || undefined;
      if (activeFlujoTab.startsWith("general-")) {
        flujoTrabajoIdActual = activeFlujoTab.replace("general-", "");
      } else if (activeFlujoTab.startsWith("area-")) {
        flujoTrabajoIdActual = activeFlujoTab.replace("area-", "");
      }

      // Buscar documentos de esta etapa
      const documentosEtapa = documentosExistentes.filter(
        (doc: any) => doc.etapa_flujo_id === etapa.id,
      );

      console.log("documentosEtapa", documentosEtapa);
      console.log("flujoTrabajoIdActual", flujoTrabajoIdActual);
      console.log("areaIdActual", areaIdActual);

      // Buscar documento del flujo actual (debe coincidir exactamente)
      // Si no hay flujo específico activo, usar el más reciente
      let docExistente: any = null;
      if (flujoTrabajoIdActual) {
        // Si hay flujo específico, solo buscar documentos de ese flujo
        docExistente =
          documentosEtapa.find(
            (doc: any) =>
              doc.flujo_trabajo_id === flujoTrabajoIdActual &&
              (!!areaIdActual ? doc.area_id === areaIdActual : true),
          ) ||
          documentosEtapa.find(
            (doc: any) => doc.flujo_trabajo_id === flujoTrabajoIdActual,
          );
      } else {
        // Si no hay flujo específico, usar el más reciente
        if (documentosEtapa.length > 0) {
          docExistente = documentosEtapa.sort(
            (a: any, b: any) =>
              new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime(),
          )[0];
        }
      }

      if (!docExistente || !docExistente.contenido) {
        swalError("No hay contenido del documento para mostrar");
        setShowPdfModal(false);
        return;
      }

      setDocumentoEnVistaPrevia(docExistente);

      const areaNombre =
        areasConFlujos.find(
          (acf) => acf.area.id === (docExistente.area_id || activeAreaTab),
        )?.area.nombre || "";

      // Resolver el autor desde usuario_subio del documento, no desde el usuario logueado
      let autorUsuario: any = user;
      if (docExistente.usuario_subio) {
        const encontrado = todosLosUsuarios.find(
          (u) => u.id === docExistente.usuario_subio,
        );
        if (encontrado) {
          autorUsuario = encontrado;
        } else {
          try {
            const fetched = await apiService.getUserById(
              docExistente.usuario_subio,
            );
            if (fetched) autorUsuario = fetched;
          } catch {
            // fallback al usuario logueado
          }
        }
      }
      const autorNombre = getUserDisplayName(autorUsuario, "");

      let variables = getVariablesForPdf(
        siniestro,
        docExistente,
        areaNombre,
        aseguradoInfo,
        autorNombre,
        autorUsuario,
      );

      const plantillaId =
        docExistente.plantilla_documento_id ||
        etapa.plantilla_documento_id ||
        etapa.plantilla_documento?.id;

      // Incluir respuestas del formulario de continuación para reemplazar {{clave}} en el HTML
      if (plantillaId && siniestroId) {
        try {
          const respuesta = await apiService.getRespuestaFormulario(
            plantillaId,
            siniestroId,
            (docExistente?.area_id as string | undefined) || activeAreaTab || undefined,
          );
          if (respuesta?.valores && typeof respuesta.valores === "object") {
            variables = { ...respuesta.valores, ...variables };
          }
        } catch {
          // Sin respuesta de formulario, seguir con las variables base
        }
      }

      const filename =
        docExistente.nombre_archivo.replace(".html", ".pdf") ||
        `${etapa.nombre}.pdf`;
      const pdfResponse = await apiService.generatePDF({
        html_content: decodeHtmlForEditor(docExistente.contenido || ""),
        plantilla_id: plantillaId || undefined,
        siniestro_id: siniestroId,
        variables,
        page_size: "A4",
        orientation: "portrait",
        filename: filename,
      });

      setPdfBase64(pdfResponse.pdf_base64);
      setPdfFilename(filename);
    } catch (error: any) {
      console.error("Error al generar PDF:", error);
      swalError(
        error.response?.data?.detail || "Error al generar el PDF del documento",
      );
      setShowPdfModal(false);
      setDocumentoEnVistaPrevia(null);
    } finally {
      setPdfLoading(false);
    }
  };

  // Función para ver un documento directamente (desde la lista de documentos)
  const handleViewDocumento = async (documento: any) => {
    revokeArchivoPreviewUrl();
    setDocumentoEnVistaPrevia(documento);
    setCurrentEtapa(null);
    setPdfLoading(true);
    setShowPdfModal(true);
    setPdfBase64(null);
    setPdfFilename(documento.nombre_archivo || "documento");

    try {
      // Informe con HTML (plantilla)
      if (documento.contenido) {
        const areaNombre =
          areasConFlujos.find(
            (acf) => acf.area.id === (documento.area_id || activeAreaTab),
          )?.area.nombre || "";

        // Resolver el autor desde usuario_subio del documento, no desde el usuario logueado
        let autorUsuarioDoc: any = user;
        if (documento.usuario_subio) {
          const encontrado = todosLosUsuarios.find(
            (u) => u.id === documento.usuario_subio,
          );
          if (encontrado) {
            autorUsuarioDoc = encontrado;
          } else {
            try {
              const fetched = await apiService.getUserById(
                documento.usuario_subio,
              );
              if (fetched) autorUsuarioDoc = fetched;
            } catch {
              // fallback al usuario logueado
            }
          }
        }
        const autorNombre = getUserDisplayName(autorUsuarioDoc, "");

        let variables = getVariablesForPdf(
          siniestro,
          documento,
          areaNombre,
          aseguradoInfo,
          autorNombre,
          autorUsuarioDoc,
        );

        const plantillaIdDoc = documento.plantilla_documento_id;
        if (plantillaIdDoc && siniestroId) {
          try {
            const respuesta = await apiService.getRespuestaFormulario(
              plantillaIdDoc,
              siniestroId,
              (documento?.area_id as string | undefined) || activeAreaTab || undefined,
            );
            if (respuesta?.valores && typeof respuesta.valores === "object") {
              variables = { ...respuesta.valores, ...variables };
            }
          } catch {
            // Sin respuesta de formulario, seguir con las variables base
          }
        }

        const filename =
          documento.nombre_archivo.replace(".html", ".pdf") || "documento.pdf";
        const pdfResponse = await apiService.generatePDF({
          html_content: decodeHtmlForEditor(documento.contenido || ""),
          plantilla_id: documento.plantilla_documento_id || undefined,
          siniestro_id: siniestroId,
          variables,
          page_size: "A4",
          orientation: "portrait",
          filename: filename,
        });

        setPdfBase64(pdfResponse.pdf_base64);
        setPdfFilename(filename);

        // Botón Editar en el modal: misma resolución de etapa que handleEditDocumento
        // En algunos casos el objeto "documento" llega agrupado y puede venir sin etapa_flujo_id,
        // así que intentamos recuperarla desde documentosExistentes por id.
        const etapaId =
          documento.etapa_flujo_id ??
          (documento.id
            ? (
                documentosExistentes.find(
                  (d: any) => String(d.id) === String(documento.id),
                ) || ({} as any)
              ).etapa_flujo_id
            : undefined);

        if (etapaId) {
          let etapaEncontrada: EtapaFlujo | null = null;
          if (flujosGenerales) {
            for (const flujoConEtapas of flujosGenerales.flujos) {
              etapaEncontrada =
                flujoConEtapas.etapas.find((e) => e.id === etapaId) || null;
              if (etapaEncontrada) break;
            }
          }
          if (!etapaEncontrada) {
            for (const areaConFlujos of areasConFlujos) {
              for (const flujoConEtapas of areaConFlujos.flujos) {
                etapaEncontrada =
                  flujoConEtapas.etapas.find((e) => e.id === etapaId) || null;
                if (etapaEncontrada) break;
              }
              if (etapaEncontrada) break;
            }
          }
          setCurrentEtapa(etapaEncontrada);
        }
        return;
      }

      // Archivo subido (foto, PDF, etc.): vista previa con blob autenticado
      if (documento.id) {
        const { blob, contentType } =
          await apiService.fetchDocumentoArchivoBlob(documento.id);
        const url = URL.createObjectURL(blob);
        setArchivoPreviewUrl(url);
        setArchivoPreviewMime(contentType || "application/octet-stream");
        setPdfFilename(documento.nombre_archivo || "archivo");
        return;
      }

      swalError("No hay contenido del documento para mostrar");
      setShowPdfModal(false);
      setDocumentoEnVistaPrevia(null);
    } catch (error: any) {
      console.error("Error al visualizar documento:", error);
      swalError(
        error.response?.data?.detail ||
          "Error al visualizar el documento o el archivo",
      );
      setShowPdfModal(false);
      revokeArchivoPreviewUrl();
      setDocumentoEnVistaPrevia(null);
    } finally {
      setPdfLoading(false);
    }
  };

  const loadProvenienteContactos = useCallback(async () => {
    if (!siniestro?.proveniente_id) {
      setProvenienteContactos([]);
      return;
    }
    const contactos = (await apiService.getProvenienteContactos(
      siniestro.proveniente_id,
    )) as ProvenienteContacto[];
    setProvenienteContactos(contactos || []);
  }, [siniestro?.proveniente_id]);

  // Abrir modal de envío de correo desde un documento (plantilla "Te envían un archivo"; si es informe se adjunta PDF)
  const handleOpenEmailModalFromDocumento = (documento: any) => {
    if (!siniestro) return;

    const asuntoBase =
      documento.nombre_archivo ||
      `Documento de siniestro ${
        siniestro.numero_siniestro || siniestro.codigo || ""
      }`;

    const mensajeBase = `Estimado(a),\n\nAdjunto envío el documento relacionado con el siniestro ${
      siniestro.numero_siniestro || siniestro.codigo || siniestro.id
    }.\n\nSaludos cordiales.`;

    const tipoNombre =
      documento.tipo_documento?.nombre ||
      documento.tipo_documento_principal?.nombre ||
      "";
    const categoriaNombre =
      documento.categoria_documento?.nombre ||
      documento.categoria?.nombre ||
      (documento.plantilla_origen?.categoria?.nombre as string) ||
      "";

    setEmailForm((prev) => ({
      ...prev,
      asunto: asuntoBase,
      mensaje: mensajeBase,
      archivos_adicionales: [],
      documento_id: documento.id ?? null,
      tipo_documento_nombre: tipoNombre,
      categoria_nombre: categoriaNombre,
    }));
    setEmailPara([]);
    setEmailCc([]);
    setEmailCco([]);

    loadProvenienteContactos().catch((error) => {
      console.error("Error al cargar contactos del proveniente:", error);
    });
    setShowEmailModal(true);
  };

  const handleEmailAdjuntosChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setEmailForm((prev) => ({
      ...prev,
      // Permite seleccionar archivos en tandas y acumularlos.
      archivos_adicionales: [...prev.archivos_adicionales, ...files],
    }));
    // Permite volver a elegir el mismo archivo si el usuario lo quita y lo agrega de nuevo.
    e.target.value = "";
  };

  const handleRemoveArchivoAdicional = (indexToRemove: number) => {
    setEmailForm((prev) => ({
      ...prev,
      archivos_adicionales: prev.archivos_adicionales.filter(
        (_, idx) => idx !== indexToRemove,
      ),
    }));
  };

  const fileToBase64 = async (file: File): Promise<string> =>
    await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("No fue posible leer el archivo"));
      reader.readAsDataURL(file);
    });

  const handleCrearNuevoContacto = async () => {
    if (!siniestro?.proveniente_id) {
      swalError("El siniestro no tiene proveniente asociado");
      return;
    }
    const nombre = nuevoContactoForm.nombre.trim();
    const correo = nuevoContactoForm.correo.trim().toLowerCase();
    if (!nombre || !correo) {
      swalError("Debes capturar nombre y correo");
      return;
    }
    const duplicado = provenienteContactos.some(
      (c) => c.correo.trim().toLowerCase() === correo,
    );
    if (duplicado) {
      swalError("Ese correo ya existe en los contactos del proveniente");
      return;
    }

    const creado = (await apiService.createProvenienteContacto(
      siniestro.proveniente_id,
      { nombre, correo },
    )) as ProvenienteContacto;
    setProvenienteContactos((prev) => [...prev, creado]);
    // Autoseleccionar en "Para" el correo recién creado
    if (creado.correo) {
      setEmailPara((prev) => Array.from(new Set([...prev, creado.correo])));
    }
    setNuevoContactoForm({ nombre: "", correo: "" });
    setShowNuevoContactoModal(false);
  };

  // Lista agrupada de posibles destinatarios:
  // - Grupo "Internos": usuarios activos del sistema
  // - Grupo "Externos (Proveniente)": contactos del proveniente del siniestro
  // Deduplicada por email (case-insensitive) entre ambos grupos
  const opcionesDestinatariosUnificadas = useMemo<SelectGroupedOption[]>(() => {
    const vistos = new Set<string>();
    const internos: SelectOption[] = [];
    const externos: SelectOption[] = [];

    todosLosUsuarios
      .filter((u) => (u.email || u.correo) && u.is_active !== false)
        .forEach((u) => {
          const email = (u.email || u.correo || "").trim().toLowerCase();
          if (!email || vistos.has(email)) return;
          vistos.add(email);
          const nombre = getUserDisplayName(u, "");
          internos.push({ value: email, label: nombre ? `${nombre} <${email}>` : email });
        });

    provenienteContactos
      .filter((c) => c.correo)
      .forEach((c) => {
        const email = (c.correo || "").trim().toLowerCase();
        if (!email || vistos.has(email)) return;
        vistos.add(email);
        externos.push({ value: email, label: c.nombre ? `${c.nombre} <${email}>` : email });
      });

    const grupos: SelectGroupedOption[] = [];
    if (internos.length > 0) grupos.push({ label: "Internos", options: internos });
    if (externos.length > 0) grupos.push({ label: "Externos (Proveniente)", options: externos });
    return grupos;
  }, [todosLosUsuarios, provenienteContactos]);

  const areaIdsSiniestro = useMemo(
    () =>
      (areasAdicionales || [])
        .map((areaRelacion) => String(areaRelacion.area_id || "").trim())
        .filter(Boolean),
    [areasAdicionales],
  );

  const abogadosDisponibles = useMemo(
    () =>
      filtrarAbogadosPorAreas(todosLosUsuarios, areaIdsSiniestro).filter(
        (usuario) =>
          !involucrados.some((involucrado) => involucrado.usuario_id === usuario.id),
      ),
    [todosLosUsuarios, areaIdsSiniestro, involucrados],
  );

  useEffect(() => {
    if (!nuevoInvolucradoUsuarioId) return;
    if (abogadosDisponibles.some((usuario) => usuario.id === nuevoInvolucradoUsuarioId)) {
      return;
    }
    setNuevoInvolucradoUsuarioId("");
  }, [abogadosDisponibles, nuevoInvolucradoUsuarioId]);

  const handleSendEmailWithDocument = async () => {
    if (!siniestro) return;

    if (!emailForm.configuracion_smtp_id) {
      swalError("Debes seleccionar una configuración SMTP");
      return;
    }

    const paraLimpios = emailPara.filter((e) => !!e.trim());
    const ccLimpios = emailCc.filter((e) => !!e.trim());
    const ccoLimpios = emailCco.filter((e) => !!e.trim());

    if (paraLimpios.length === 0) {
      swalError("Debes indicar al menos un destinatario en Para");
      return;
    }

    try {
      setEmailSending(true);

      if (emailForm.documento_id) {
        const archivosAdjuntos =
          emailForm.archivos_adicionales.length > 0
            ? await Promise.all(
                emailForm.archivos_adicionales.map(async (archivo) => ({
                  nombre: archivo.name,
                  tipo_mime: archivo.type || "application/octet-stream",
                  contenido_base64: await fileToBase64(archivo),
                })),
              )
            : undefined;
        await apiService.enviarArchivoCorreo({
          siniestro_id: siniestro.id,
          configuracion_smtp_id: emailForm.configuracion_smtp_id,
          destinatarios: paraLimpios,
          cc: ccLimpios.length > 0 ? ccLimpios : undefined,
          cco: ccoLimpios.length > 0 ? ccoLimpios : undefined,
          mensaje: emailForm.mensaje || "",
          asunto: emailForm.asunto?.trim() || undefined,
          documento_id: emailForm.documento_id,
          tipo_documento_nombre: emailForm.tipo_documento_nombre || undefined,
          categoria_nombre: emailForm.categoria_nombre || undefined,
          archivos_adjuntos: archivosAdjuntos,
        });
      } else {
        await apiService.enviarCorreo({
          configuracion_smtp_id: emailForm.configuracion_smtp_id,
          destinatarios: paraLimpios,
          cc: ccLimpios.length > 0 ? ccLimpios : undefined,
          cco: ccoLimpios.length > 0 ? ccoLimpios : undefined,
          asunto: emailForm.asunto || undefined,
          cuerpo_html: emailForm.mensaje
            ? emailForm.mensaje.replace(/\n/g, "<br />")
            : undefined,
          variables: { siniestro_id: siniestro.id },
        });
      }

      swalSuccess("Correo enviado correctamente");
      setShowEmailModal(false);
    } catch (error: any) {
      console.error("Error al enviar correo:", error);
      swalError(
        error.response?.data?.detail ||
          error.response?.data?.message ||
          "Error al enviar el correo",
      );
    } finally {
      setEmailSending(false);
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
            (e) => e.id === documento.etapa_flujo_id,
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
              (e) => e.id === documento.etapa_flujo_id,
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

  // Descargar archivo de un documento (documentos subidos: fotos, PDF, etc.)
  const handleDownloadDocumento = async (documento: any) => {
    try {
      await apiService.downloadDocumentoArchivo(
        documento.id,
        documento.nombre_archivo,
      );
      swalSuccess("Descarga iniciada");
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al descargar el archivo");
    }
  };

  // Descargar PDF de un informe desde la tabla de documentos (HTML + variables + continuación)
  const handleDownloadInforme = async (documento: any) => {
    try {
      if (!siniestro) return;
      if (!documento?.contenido || !documento?.plantilla_documento_id) {
        swalError(
          "No se puede descargar: el documento no tiene contenido de informe.",
        );
        return;
      }
      if (!siniestroId) {
        swalError("No se puede descargar: siniestro no disponible.");
        return;
      }

      const areaNombre =
        areasConFlujos.find(
          (acf) => acf.area.id === (documento.area_id || activeAreaTab),
        )?.area.nombre || "";

      let autorUsuarioDl: any = user;
      if (documento.usuario_subio) {
        const encontrado = todosLosUsuarios.find(
          (u) => u.id === documento.usuario_subio,
        );
        if (encontrado) {
          autorUsuarioDl = encontrado;
        } else {
          try {
            const fetched = await apiService.getUserById(
              documento.usuario_subio,
            );
            if (fetched) autorUsuarioDl = fetched;
          } catch {
            // fallback al usuario logueado
          }
        }
      }
      const autorNombre = getUserDisplayName(autorUsuarioDl as any, "");

      let variables = getVariablesForPdf(
        siniestro,
        documento,
        areaNombre,
        aseguradoInfo,
        autorNombre,
        autorUsuarioDl,
      );

      const plantillaIdDoc = documento.plantilla_documento_id;
      if (plantillaIdDoc && siniestroId) {
        try {
          const respuesta = await apiService.getRespuestaFormulario(
            plantillaIdDoc,
            siniestroId,
            (documento?.area_id as string | undefined) || activeAreaTab || undefined,
          );
          if (respuesta?.valores && typeof respuesta.valores === "object") {
            variables = { ...respuesta.valores, ...variables };
          }
        } catch {
          // Sin respuesta de formulario: descargar con variables base
        }
      }

      const baseName: string = documento.nombre_archivo || "documento";
      const filename = baseName.toLowerCase().endsWith(".pdf")
        ? baseName
        : baseName.replace(/\.[^/.]+$/, "") + ".pdf";

      await apiService.downloadPDF({
        html_content: decodeHtmlForEditor(documento.contenido || ""),
        plantilla_id: documento.plantilla_documento_id,
        siniestro_id: siniestroId,
        variables,
        page_size: "A4",
        orientation: "portrait",
        filename,
      });
      swalSuccess("Descarga iniciada");
    } catch (error: any) {
      console.error("Error al descargar informe:", error);
      swalError(
        error.response?.data?.detail || "Error al descargar el informe",
      );
    }
  };

  /** Eliminación lógica: el documento deja de mostrarse pero permanece en base de datos. */
  const handleEliminarDocumento = async (documento: any) => {
    if (!documento?.id || !canSubirArchivo) return;
    const nombre = documento.nombre_archivo || "este documento";
    const confirmed = await swalConfirm(
      `Se eliminará «${nombre}» del expediente.`,
      "Eliminar del expediente",
      "Sí, eliminar",
      "Cancelar",
    );
    if (!confirmed) return;
    try {
      await apiService.deleteDocumento(documento.id);
      await swalSuccess("Documento eliminado del expediente");
      if (documentoEnVistaPrevia?.id === documento.id) {
        setShowPdfModal(false);
        setPdfBase64(null);
        setPdfFilename("");
        revokeArchivoPreviewUrl();
        setDocumentoEnVistaPrevia(null);
      }
      let flujoId: string | undefined;
      let areaIdForContext: string | undefined = activeAreaTab || undefined;
      if (activeFlujoTab?.startsWith("general-")) {
        flujoId = activeFlujoTab.replace("general-", "");
      } else if (activeFlujoTab?.startsWith("area-")) {
        flujoId = activeFlujoTab.replace("area-", "");
        areaIdForContext = activeAreaTab;
      }
      await loadDocumentosSiniestro();
      await loadDocumentosFiltrados(areaIdForContext, flujoId);
      await loadLogsAuditoria();
    } catch (e: any) {
      swalError(
        e.response?.data?.detail || "No se pudo eliminar el documento",
      );
    }
  };

  // Abrir/cerrar modal de subir archivo (opcional: etapa → PDF/imagen bloquea tipo y muestra requisitos)
  const handleOpenUploadDocModal = useCallback((etapa?: EtapaFlujo) => {
    setUploadDocFile(null);
    setUploadDocDescripcion("");
    setUploadRequisitoSeleccionadoId("");
    setUploadDocCategoriaId("");
    setUploadDocPlantillaId("");
    setUploadEtapaRequisitos([]);

    if (etapa) {
      const t = (etapa.tipo_documento_principal?.tipo ?? "").toLowerCase();
      if (t !== "editor" && etapa.tipo_documento_principal_id) {
        setUploadModalEtapaContext(etapa);
        setUploadDocTipoId(etapa.tipo_documento_principal_id);
      } else {
        setUploadModalEtapaContext(null);
        setUploadDocTipoId("");
      }
    } else {
      setUploadModalEtapaContext(null);
      setUploadDocTipoId("");
    }
    setShowUploadDocModal(true);
  // Solo usa state setters (estables) + el argumento etapa → deps vacíos
  }, []);
  const handleCloseUploadDocModal = () => {
    setShowUploadDocModal(false);
    setUploadDocFile(null);
    setUploadDocDescripcion("");
    setUploadDocTipoId("");
    setUploadDocCategoriaId("");
    setUploadDocPlantillaId("");
    setUploadCategorias([]);
    setUploadPlantillas([]);
    setUploadDocHoras("");
    setUploadDocComentario("");
    setUploadModalEtapaContext(null);
    setUploadEtapaRequisitos([]);
    setUploadRequisitoSeleccionadoId("");
  };

  // Cargar tipos de documento al abrir el modal de subir archivo
  useEffect(() => {
    if (!showUploadDocModal) return;
    setUploadDocLoadingCatalogos(true);
    apiService
      .getPlantillas(true)
      .then((data: any[]) => {
        setUploadTiposDocumento(
          Array.isArray(data)
            ? data.map((t: any) => ({
                id: t.id,
                nombre: t.nombre || t.name || String(t.id),
                tipo: String(t.tipo ?? "").toLowerCase(),
              }))
            : [],
        );
      })
      .catch(() => setUploadTiposDocumento([]))
      .finally(() => setUploadDocLoadingCatalogos(false));
  }, [showUploadDocModal]);

  // PDF/imagen → solo categorías; editor → solo plantillas (omitir si el modal viene desde etapa PDF: ahí van los requisitos)
  useEffect(() => {
    if (!uploadDocTipoId) {
      setUploadCategorias([]);
      setUploadPlantillas([]);
      setUploadDocCategoriaId("");
      setUploadDocPlantillaId("");
      return;
    }
    if (uploadModalEtapaContext) {
      setUploadCategorias([]);
      setUploadPlantillas([]);
      setUploadDocCategoriaId("");
      setUploadDocPlantillaId("");
      setUploadDocLoadingCatalogos(false);
      return;
    }
    const sel = uploadTiposDocumento.find((x) => x.id === uploadDocTipoId);
    const t = (sel?.tipo ?? "").toLowerCase();
    const esEditor = t === "editor";

    setUploadDocCategoriaId("");
    setUploadDocPlantillaId("");
    setUploadDocLoadingCatalogos(true);

    if (esEditor) {
      setUploadCategorias([]);
      apiService
        .getPlantillasDocumento(uploadDocTipoId, undefined, true)
        .then((plants: any[]) => {
          setUploadPlantillas(
            Array.isArray(plants)
              ? plants.map((p: any) => ({
                  id: p.id,
                  nombre: p.nombre || p.name || String(p.id),
                }))
              : [],
          );
        })
        .catch(() => setUploadPlantillas([]))
        .finally(() => setUploadDocLoadingCatalogos(false));
    } else {
      setUploadPlantillas([]);
      apiService
        .getCategoriasDocumento(uploadDocTipoId, true)
        .then((cats: any[]) => {
          setUploadCategorias(
            Array.isArray(cats)
              ? cats.map((c: any) => ({
                  id: c.id,
                  nombre: c.nombre || c.name || String(c.id),
                }))
              : [],
          );
        })
        .catch(() => setUploadCategorias([]))
        .finally(() => setUploadDocLoadingCatalogos(false));
    }
  }, [uploadDocTipoId, uploadTiposDocumento, uploadModalEtapaContext]);

  // Requisitos documentales de la etapa (modal contextual PDF desde timeline)
  useEffect(() => {
    if (!showUploadDocModal || !uploadModalEtapaContext) {
      setUploadEtapaRequisitos([]);
      setUploadEtapaLoadingReqs(false);
      return;
    }
    // Usar flujo de la etapa (siempre correcto). Antes solo se leía activeFlujoTab y podía
    // quedar vacío o desincronizado → 0 requisitos aunque la tabla del flujo muestre N.
    const flujoIdRaw =
      uploadModalEtapaContext.flujo_trabajo_id ||
      (activeFlujoTab?.startsWith("general-")
        ? activeFlujoTab.replace("general-", "")
        : activeFlujoTab?.startsWith("area-")
          ? activeFlujoTab.replace("area-", "")
          : undefined);
    const flujoId =
      flujoIdRaw !== undefined && flujoIdRaw !== null
        ? String(flujoIdRaw)
        : undefined;
    if (!flujoId) {
      setUploadEtapaRequisitos([]);
      return;
    }
    setUploadEtapaLoadingReqs(true);
    apiService
      .getRequisitosEtapa(flujoId, uploadModalEtapaContext.id, true)
      .then((data: RequisitoDocumento[]) => {
        setUploadEtapaRequisitos(Array.isArray(data) ? data : []);
      })
      .catch(() => setUploadEtapaRequisitos([]))
      .finally(() => setUploadEtapaLoadingReqs(false));
  }, [showUploadDocModal, uploadModalEtapaContext, activeFlujoTab]);

  useEffect(() => {
    if (
      uploadEtapaRequisitos.length === 1 &&
      !uploadRequisitoSeleccionadoId
    ) {
      setUploadRequisitoSeleccionadoId(uploadEtapaRequisitos[0].id);
    }
  }, [uploadEtapaRequisitos, uploadRequisitoSeleccionadoId]);

  const uploadDocEsEditor = useMemo(() => {
    const sel = uploadTiposDocumento.find((x) => x.id === uploadDocTipoId);
    return (sel?.tipo ?? "").toLowerCase() === "editor";
  }, [uploadTiposDocumento, uploadDocTipoId]);

  /** Modal abierto desde una etapa PDF/imagen: tipo bloqueado, lista = requisitos de la etapa */
  const uploadEsVistaEtapaPdf = !!uploadModalEtapaContext;

  // Subir archivo (foto, PDF, etc.) como documento del siniestro
  const handleSubmitUploadDoc = async () => {
    if (!uploadDocFile || !siniestroId) return;
    if (
      uploadModalEtapaContext &&
      uploadEtapaRequisitos.length > 0 &&
      !uploadRequisitoSeleccionadoId
    ) {
      swalError(
        "Selecciona el documento esperado de la etapa al que corresponde el archivo.",
      );
      return;
    }
    setUploadDocSaving(true);
    try {
      let flujoId: string | undefined;
      let areaIdForContext: string | undefined = activeAreaTab || undefined;
      if (activeFlujoTab?.startsWith("general-")) {
        flujoId = activeFlujoTab.replace("general-", "");
      } else if (activeFlujoTab?.startsWith("area-")) {
        flujoId = activeFlujoTab.replace("area-", "");
        areaIdForContext = activeAreaTab;
      }
      const horasNum = uploadDocHoras.trim()
        ? parseFloat(uploadDocHoras)
        : undefined;
      await apiService.uploadDocumento(siniestroId, uploadDocFile, {
        descripcion: uploadDocDescripcion.trim() || undefined,
        area_id: areaIdForContext || undefined,
        flujo_trabajo_id: flujoId,
        etapa_flujo_id: uploadModalEtapaContext?.id || undefined,
        tipo_documento_id: uploadDocTipoId || undefined,
        plantilla_documento_id: uploadDocPlantillaId || undefined,
        requisito_documento_id: uploadRequisitoSeleccionadoId || undefined,
        horas_trabajadas:
          horasNum != null && !Number.isNaN(horasNum) ? horasNum : undefined,
        comentarios: uploadDocComentario.trim() || undefined,
      });
      await swalSuccess("Archivo subido correctamente");
      handleCloseUploadDocModal();
      await loadDocumentosSiniestro();
      await loadDocumentosFiltrados(areaIdForContext, flujoId);
      await loadBitacorasFiltradas(areaIdForContext, flujoId);
      await loadLogsAuditoria();
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al subir el archivo");
    } finally {
      setUploadDocSaving(false);
    }
  };

  // Abrir modal de formulario de continuación (para llenar datos del documento de continuación)
  const handleOpenFormularioContinuacion = useCallback(async (
    plantillaId: string,
    plantillaNombre?: string,
  ) => {
    if (!plantillaId || !siniestroId) return;
    try {
      const plantilla = (await apiService.getPlantillaDocumentoById(
        plantillaId,
      )) as PlantillaDocumento;
      const tieneForm =
        plantilla?.plantilla_continuacion_id &&
        Array.isArray(plantilla?.campos_formulario) &&
        plantilla.campos_formulario.length > 0;
      if (!tieneForm) {
        swalError(
          "Esta plantilla no tiene formulario de continuación configurado.",
        );
        return;
      }
      setFormularioContinuacionPlantillaId(plantillaId);
      setFormularioContinuacionPlantillaNombre(
        plantilla?.nombre || plantillaNombre || "",
      );
      setShowFormularioContinuacionModal(true);
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al cargar el formulario.");
    }
  // Solo usa siniestroId (estable de params) + state setters → deps estables
  }, [siniestroId]);

  // Callback estable para EtapasTimeline — evita re-renders al cambiar otros estados
  const handleContinuarEtapa = useCallback((_: EtapaFlujo, doc: any) => {
    if (doc?.plantilla_documento_id) {
      handleOpenFormularioContinuacion(
        doc.plantilla_documento_id,
        doc.nombre_archivo,
      );
    }
  }, [handleOpenFormularioContinuacion]);

  // Función para abrir el editor de documentos
  const handleOpenDocumentEditor = async (etapa: EtapaFlujo) => {
    setCurrentEtapa(etapa);
    setEditorLoading(true);
    setShowEditorModal(true);
    setDocumentoExistente(null);
    setPlantillaActual(null);
    setDocumentoContenido("");

    try {
      // Determinar el flujo_trabajo_id actual basado en el tab activo
      let flujoTrabajoIdActual: string | undefined = undefined;
      const areaIdActual: string | undefined = activeAreaTab || undefined;
      if (activeFlujoTab.startsWith("general-")) {
        flujoTrabajoIdActual = activeFlujoTab.replace("general-", "");
      } else if (activeFlujoTab.startsWith("area-")) {
        flujoTrabajoIdActual = activeFlujoTab.replace("area-", "");
      }

      // Buscar si ya existe un documento para esta etapa
      // Si el documento tiene flujo_trabajo_id, debe coincidir con el flujo actual
      // Si no tiene flujo_trabajo_id (documentos antiguos), se muestra para compatibilidad
      const documentosEtapa = documentosExistentes.filter(
        (doc: any) => doc.etapa_flujo_id === etapa.id,
      );

      // Buscar documento del flujo actual (debe coincidir exactamente)
      // Si no hay flujo específico activo, usar el más reciente
      let docExistente: any = null;
      if (flujoTrabajoIdActual) {
        // Si hay flujo específico, solo buscar documentos de ese flujo
        docExistente =
          documentosEtapa.find(
            (doc: any) =>
              doc.flujo_trabajo_id === flujoTrabajoIdActual &&
              (!!areaIdActual ? doc.area_id === areaIdActual : true),
          ) ||
          documentosEtapa.find(
            (doc: any) => doc.flujo_trabajo_id === flujoTrabajoIdActual,
          );
      } else {
        // Si no hay flujo específico, usar el más reciente
        if (documentosEtapa.length > 0) {
          docExistente = documentosEtapa.sort(
            (a: any, b: any) =>
              new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime(),
          )[0];
        }
      }

      if (docExistente) {
        // Si existe: decodificar y volver a aplicar placeholders del sistema (p. ej. {{id}})
        // para alinear con PDF / id_formato aunque el HTML guardado tenga valor antiguo o placeholders sin resolver.
        setDocumentoExistente(docExistente);
        const decoded = decodeHtmlForEditor(docExistente.contenido || "");
        setDocumentoContenido(
          aplicarPlaceholdersPlantilla(
            decoded,
            etapa,
            siniestro,
            user,
            aseguradoInfo,
          ),
        );
      } else {
        // Si no existe, cargar la plantilla para precargar
        let plantillaId = etapa.plantilla_documento_id;

        // Si no hay plantilla específica pero hay tipo de documento, buscar plantillas disponibles
        if (!plantillaId && etapa.tipo_documento_principal_id) {
          const plantillas = await apiService.getPlantillasDocumento(
            etapa.tipo_documento_principal_id,
            etapa.categoria_documento_id || undefined,
            true,
          );

          if (plantillas.length > 0) {
            // Usar la primera plantilla disponible
            plantillaId = plantillas[0].id;
          }
        }

        if (plantillaId) {
          // Cargar el contenido de la plantilla
          const plantilla =
            await apiService.getPlantillaDocumentoById(plantillaId);
          setPlantillaActual(plantilla);
          const contenidoBase =
            decodeHtmlForEditor(
              plantilla.contenido || "<p>Contenido de la plantilla...</p>",
            ) || "<p>Contenido de la plantilla...</p>";

          // Aplicar placeholders solo cuando se genera el documento por primera vez
          const contenidoConDatos = aplicarPlaceholdersPlantilla(
            contenidoBase,
            etapa,
            siniestro,
            user,
            aseguradoInfo,
          );

          setDocumentoContenido(contenidoConDatos);
        } else {
          // Sin plantilla, iniciar con contenido vacío
          setDocumentoContenido(
            "<p>Escribe el contenido del documento aquí...</p>",
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
        "_",
      )}_${fecha}.html`;

      // Determinar area_id y flujo_trabajo_id basándose en el contexto actual
      let areaId: string | undefined = activeAreaTab || undefined;
      let flujoTrabajoId: string | undefined = undefined;

      if (activeFlujoTab.startsWith("general-")) {
        const flujoId = activeFlujoTab.replace("general-", "");
        flujoTrabajoId = flujoId;
      } else if (activeFlujoTab.startsWith("area-")) {
        const flujoId = activeFlujoTab.replace("area-", "");
        flujoTrabajoId = flujoId;
        areaId = activeAreaTab; // El área actual del tab
      }

      const horasBita = docHorasBitacora.trim()
        ? parseFloat(docHorasBitacora)
        : undefined;
      const comentarioBita = docComentarioBitacora.trim() || undefined;

      if (documentoExistente) {
        // Actualizar documento existente
        await apiService.updateDocumento(documentoExistente.id, {
          contenido: documentoContenido,
          nombre_archivo: nombreArchivo,
          area_id: areaId,
          flujo_trabajo_id: flujoTrabajoId,
          horas_trabajadas_bitacora:
            horasBita != null && !Number.isNaN(horasBita)
              ? horasBita
              : undefined,
          comentarios_bitacora: comentarioBita,
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
          horas_trabajadas_bitacora:
            horasBita != null && !Number.isNaN(horasBita)
              ? horasBita
              : undefined,
          comentarios_bitacora: comentarioBita,
        });
        await swalSuccess("Documento guardado correctamente");
      }

      await loadDocumentosSiniestro();
      await loadDocumentosFiltrados(areaId, flujoTrabajoId);
      await loadBitacorasFiltradas(areaId, flujoTrabajoId);
      await loadLogsAuditoria();
      setShowEditorModal(false);
      setDocHorasBitacora("");
      setDocComentarioBitacora("");

      // Si la plantilla tiene continuación con formulario, abrir el modal para llenar los datos
      const tieneContinuacionYForm =
        plantillaActual?.plantilla_continuacion_id &&
        Array.isArray(plantillaActual?.campos_formulario) &&
        plantillaActual.campos_formulario.length > 0;
      if (tieneContinuacionYForm && plantillaActual) {
        setFormularioContinuacionPlantillaId(plantillaActual.id);
        setFormularioContinuacionPlantillaNombre(plantillaActual.nombre || "");
        setShowFormularioContinuacionModal(true);
      }
    } catch (error: any) {
      console.error("Error al guardar documento:", error);
      swalError(
        error.response?.data?.detail || "Error al guardar el documento",
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
    <div className="min-h-screen w-full bg-gray-50">
      <div className="w-full px-3 sm:px-4 lg:px-6 py-4 lg:py-6">
        {/* Header */}
        <div
          data-tour="detalle-header"
          className="mb-4 lg:mb-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 lg:gap-6"
        >
          <div className="flex-1 min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2 sm:gap-3">
              <Button
                variant="secondary"
                onClick={() => router.push("/siniestros")}
              >
                <FiArrowLeft className="w-4 h-4 mr-2" />
                Volver
              </Button>
              <TourButton tour="tour-detalle-siniestro" label="Ver guía" />
            </div>
            <p className="text-gray-600 mt-2 flex flex-col gap-1 text-sm sm:text-base">
              {(() => {
                // Construir código completo: proveniente-consecutivo-añalidad
                const codigoCompleto =
                  buildSiniestroIdLegible({
                    id_formato: siniestro.id_formato,
                    codigoProveniente: codigoProvenienteParaIdLegible(siniestro),
                    codigoSiniestro: siniestro.codigo,
                    anualidad: siniestro.anualidad,
                    fecha_registro: siniestro.fecha_registro,
                    fecha_siniestro: siniestro.fecha_siniestro,
                  }) || null;

                const elementos = [];

                // Código completo
                if (codigoCompleto) {
                  elementos.push(
                    <span key="codigo" className="font-semibold text-gray-800">
                      ID: {codigoCompleto}
                    </span>,
                  );
                }

                // Número de siniestro
                if (siniestro.numero_siniestro) {
                  elementos.push(
                    <span key="numero" className="font-semibold text-gray-800">
                      Num Siniestro: {siniestro.numero_siniestro}
                    </span>,
                  );
                }

                // Nombre completo del asegurado
                const nombreCompletoAsegurado = aseguradoInfo
                  ? [
                      aseguradoInfo.nombre,
                      aseguradoInfo.apellido_paterno,
                      aseguradoInfo.apellido_materno,
                    ]
                      .filter(Boolean)
                      .join(" ")
                  : "";
                if (nombreCompletoAsegurado) {
                  elementos.push(
                    <span
                      key="asegurado"
                      className="font-semibold text-gray-800"
                    >
                      {nombreCompletoAsegurado}
                    </span>,
                  );
                }

                return <>{elementos}</>;
              })()}
            </p>
          </div>

          {/* Selectores de Status y Calificación + botón Editar (solo editables con permiso actualizar) */}
          <div className="w-full lg:w-auto flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="w-full sm:w-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                disabled={
                  !canActualizarSiniestro || loadingEstados || updatingStatus
                }
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
                disabled={
                  !canActualizarSiniestro ||
                  loadingCalificaciones ||
                  updatingCalificacion
                }
              />
            </div>

            {canActualizarSiniestro && (
              <div className="flex justify-end">
                <EmpresaButton
                  variant="primary"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => handleOpenEditModal()}
                >
                  <FiEdit3 className="w-4 h-4 mr-2" />
                  Editar
                </EmpresaButton>
              </div>
            )}
          </div>
        </div>

        {/* Layout de dos columnas */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)] gap-4 lg:gap-6 mt-4 lg:mt-6">
          {/* Columna izquierda - Contenido principal */}
          <div data-tour="detalle-tabs" className="space-y-4 lg:space-y-6">
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
                          if (areaConFlujos.flujos.length > 0) {
                            setActiveFlujoTab(
                              `area-${areaConFlujos.flujos[0].flujo.id}`,
                            );
                          } else if (
                            flujosGenerales &&
                            flujosGenerales.flujos.length > 0
                          ) {
                            setActiveFlujoTab(
                              `general-${flujosGenerales.flujos[0].flujo.id}`,
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
                                  `general-${flujoConEtapas.flujo.id}`,
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
                                `area-${flujoConEtapas.flujo.id}`,
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
                                        activeFlujoTab,
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

                                      {/* Tabs internos: Etapas, Documentos, Bitácora (según permisos) */}
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
                                            ...(canVerDocumentos
                                              ? [
                                                  {
                                                    id: "documentos" as const,
                                                    label: "Documentos",
                                                    icon: (
                                                      <FiFileText className="w-4 h-4" />
                                                    ),
                                                    count:
                                                      documentosFiltrados.length,
                                                  },
                                                ]
                                              : []),
                                            ...(canVerBitacora
                                              ? [
                                                  {
                                                    id: "bitacora" as const,
                                                    label: "Bitácora",
                                                    icon: (
                                                      <FiClock className="w-4 h-4" />
                                                    ),
                                                    count:
                                                      bitacorasFiltradas.length,
                                                  },
                                                ]
                                              : []),
                                          ]}
                                          activeTab={activeContentTab}
                                          onTabChange={(tabId) =>
                                            setActiveContentTab(
                                              tabId as
                                                | "etapas"
                                                | "documentos"
                                                | "bitacora",
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
                                          onContinuar={handleContinuarEtapa}
                                          onSubirArchivo={handleOpenUploadDocModal}
                                          empresaColors={empresaColors}
                                          flujoTrabajoId={
                                            flujoConEtapas.flujo.id
                                          }
                                          areaId={activeAreaTab}
                                          siniestroId={siniestroId as string}
                                          canVerPdf={canGenerarPdf}
                                          canEditarDocumento={
                                            canGenerarPdf
                                          }
                                          canCrearDocumento={canGenerarPdf}
                                        />
                                      )}

                                      {activeContentTab === "documentos" &&
                                        canVerDocumentos && (
                                          <DocumentosList
                                            documentos={documentosFiltrados}
                                            loading={loadingDocumentos}
                                            onViewDocument={handleViewDocumento}
                                            onEditDocument={handleEditDocumento}
                                            onSendByEmail={
                                              handleOpenEmailModalFromDocumento
                                            }
                                            onDownloadDocument={
                                              handleDownloadDocumento
                                            }
                                            onDownloadInforme={
                                              handleDownloadInforme
                                            }
                                            onDeleteDocument={
                                              canSubirArchivo
                                                ? handleEliminarDocumento
                                                : undefined
                                            }
                                            onUploadClick={
                                              canSubirArchivo
                                                ? handleOpenUploadDocModal
                                                : undefined
                                            }
                                            siniestroId={siniestroId}
                                            empresaColors={empresaColors}
                                            etapas={flujoConEtapas.etapas}
                                          />
                                        )}

                                      {activeContentTab === "bitacora" &&
                                        canVerBitacora && (
                                          <BitacoraList
                                            bitacoras={bitacorasFiltradas}
                                            loading={loadingBitacoras}
                                            siniestroId={siniestroId}
                                            areaId={activeAreaTab}
                                            flujoTrabajoId={
                                              flujoConEtapas.flujo.id
                                            }
                                            onRefresh={async () => {
                                              await loadBitacorasFiltradas(
                                                undefined,
                                                flujoConEtapas.flujo.id,
                                              );
                                              await loadLogsAuditoria();
                                            }}
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
                                  (a) => a.area.id === activeAreaTab,
                                );
                                const flujoConEtapas = areaActual?.flujos.find(
                                  (f) =>
                                    `area-${f.flujo.id}` === activeFlujoTab,
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

                                    {/* Tabs internos: Etapas, Documentos, Bitácora (según permisos) */}
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
                                        {canVerDocumentos && (
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
                                        )}
                                        {canVerBitacora && (
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
                                            Bitácora (
                                            {bitacorasFiltradas.length})
                                          </button>
                                        )}
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
                                        onContinuar={handleContinuarEtapa}
                                        onSubirArchivo={handleOpenUploadDocModal}
                                        empresaColors={empresaColors}
                                        flujoTrabajoId={flujoConEtapas.flujo.id}
                                        areaId={activeAreaTab}
                                        siniestroId={siniestroId as string}
                                        canVerPdf={canGenerarPdf}
                                        canEditarDocumento={
                                          canGenerarPdf
                                        }
                                        canCrearDocumento={canGenerarPdf}
                                      />
                                    )}

                                    {activeContentTab === "documentos" &&
                                      canVerDocumentos && (
                                        <DocumentosList
                                          documentos={documentosFiltrados}
                                          loading={loadingDocumentos}
                                          onViewDocument={handleViewDocumento}
                                          onEditDocument={handleEditDocumento}
                                          onSendByEmail={
                                            handleOpenEmailModalFromDocumento
                                          }
                                          onDownloadDocument={
                                            handleDownloadDocumento
                                          }
                                          onDownloadInforme={
                                            handleDownloadInforme
                                          }
                                          onDeleteDocument={
                                            canSubirArchivo
                                              ? handleEliminarDocumento
                                              : undefined
                                          }
                                          onUploadClick={
                                            canSubirArchivo
                                              ? handleOpenUploadDocModal
                                              : undefined
                                          }
                                          siniestroId={siniestroId}
                                          empresaColors={empresaColors}
                                          etapas={flujoConEtapas.etapas}
                                        />
                                      )}

                                    {activeContentTab === "bitacora" &&
                                      canVerBitacora && (
                                        <BitacoraList
                                          bitacoras={bitacorasFiltradas}
                                          loading={loadingBitacoras}
                                          siniestroId={siniestroId}
                                          areaId={activeAreaTab}
                                          flujoTrabajoId={
                                            flujoConEtapas.flujo.id
                                          }
                                          onRefresh={async () => {
                                            await loadBitacorasFiltradas(
                                              activeAreaTab,
                                              flujoConEtapas.flujo.id,
                                            );
                                            await loadLogsAuditoria();
                                          }}
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
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <FiUser
                        className="w-5 h-5"
                        style={{ color: empresaColors.primary }}
                      />
                      <h3 className="font-semibold text-gray-700 flex-1">
                        Asegurado
                      </h3>
                      {aseguradoInfo && !aseguradoInfo.error && (
                        <EmpresaButton
                          size="sm"
                          variant="outline"
                          onClick={abrirModalAsegurado}
                          className="text-xs"
                        >
                          Cambiar
                        </EmpresaButton>
                      )}
                    </div>
                    {aseguradoInfo && !aseguradoInfo.error ? (
                      <>
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Nombre:</span>{" "}
                          {[
                            aseguradoInfo.nombre,
                            aseguradoInfo.apellido_paterno,
                            aseguradoInfo.apellido_materno,
                          ]
                            .filter(Boolean)
                            .join(" ") || "N/A"}
                        </p>
                        {(aseguradoInfo.telefono ||
                          aseguradoInfo.tel_casa ||
                          aseguradoInfo.tel_oficina) && (
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Teléfono:</span>{" "}
                            {aseguradoInfo.telefono ||
                              aseguradoInfo.tel_oficina ||
                              aseguradoInfo.tel_casa}
                          </p>
                        )}
                        {(aseguradoInfo.ciudad || aseguradoInfo.estado) && (
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Ubicación:</span>{" "}
                            {[aseguradoInfo.ciudad, aseguradoInfo.estado]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                      </>
                    ) : (
                      <div>
                        <p className="text-sm text-gray-500 mb-2">
                          {aseguradoInfo?.error
                            ? "No se pudo cargar el asegurado."
                            : "Sin asegurado asignado."}
                        </p>
                        <EmpresaButton
                          variant="primary"
                          size="sm"
                          onClick={abrirModalAsegurado}
                        >
                          <FiPlus className="w-4 h-4 mr-2" />
                          Agregar asegurado
                        </EmpresaButton>
                      </div>
                    )}
                  </div>

                  {/* Información de Póliza */}
                  {polizasDisplay.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <FiShield
                          className="w-5 h-5"
                          style={{ color: empresaColors.secondary }}
                        />
                        <h3 className="font-semibold text-gray-700">
                          Pólizas
                        </h3>
                      </div>
                      <div className="space-y-3">
                        {polizasDisplay.map((poliza, index) => (
                          <div
                            key={poliza.id || poliza.tempId}
                            className="rounded-lg border border-gray-200 p-3"
                          >
                            <p className="text-sm font-medium text-gray-700">
                              {index === 0
                                ? "Póliza principal"
                                : `Póliza adicional ${index}`}
                            </p>
                            {poliza.numero_poliza && (
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Número:</span>{" "}
                                {poliza.numero_poliza}
                              </p>
                            )}
                            {Number(poliza.suma_asegurada || 0) > 0 && (
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">
                                  Suma Asegurada:
                                </span>{" "}
                                $
                                {Number(
                                  poliza.suma_asegurada || 0,
                                ).toLocaleString("es-MX")}
                              </p>
                            )}
                            {Number(poliza.deducible || 0) > 0 && (
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Deducible:</span>{" "}
                                $
                                {Number(poliza.deducible || 0).toLocaleString(
                                  "es-MX",
                                )}
                              </p>
                            )}
                            {Number(poliza.reserva || 0) > 0 && (
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Reserva:</span> $
                                {Number(poliza.reserva || 0).toLocaleString(
                                  "es-MX",
                                )}
                              </p>
                            )}
                            {Number(poliza.coaseguro || 0) > 0 && (
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Coaseguro:</span>{" "}
                                $
                                {Number(poliza.coaseguro || 0).toLocaleString(
                                  "es-MX",
                                )}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
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
                    {(() => {
                      const areaPrincipalId = (siniestro as any)?.area_principal_id;
                      const relacionPrincipal = areaPrincipalId
                        ? areasAdicionales.find(
                            (ar) => String(ar.area_id) === String(areaPrincipalId),
                          )
                        : areasAdicionales[0];

                      const fechaAsignacion = relacionPrincipal?.fecha_asignacion;
                      if (!fechaAsignacion) return null;

                      return (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">
                            Fecha Asignacion:
                          </span>{" "}
                          {new Date(fechaAsignacion).toLocaleDateString(
                            "es-MX",
                            {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            },
                          )}
                        </p>
                      );
                    })()}
                    {siniestro.fecha_registro && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Fecha Reporte:</span>{" "}
                        {new Date(siniestro.fecha_registro).toLocaleDateString(
                          "es-MX",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          },
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
                {descripcionHechosVistaHtml.trim() && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <FiFileText
                          className="w-5 h-5"
                          style={{ color: empresaColors.primary }}
                        />
                        <h3 className="font-semibold text-gray-700">
                          Descripción de los Hechos
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <CustomSelect
                          name="descripcion_version_selector"
                          value={
                            descripcionSeleccionada?.id ||
                            selectedDescripcionVersionId
                          }
                          onChange={(value) =>
                            setSelectedDescripcionVersionId((value as string) || "")
                          }
                          options={versionesDescripcionHechos.map((version) => ({
                            value: version.id,
                            label: `v${version.version}`,
                          }))}
                          placeholder="Versión"
                          isSearchable={false}
                          isClearable={false}
                        />
                        {canActualizarSiniestro && isDescripcionSeleccionadaUltima && (
                          <EmpresaButton
                            variant="secondary"
                            size="sm"
                            onClick={handleOpenEditDescripcion}
                          >
                            <FiEdit3 className="w-4 h-4 mr-2" />
                            Editar
                          </EmpresaButton>
                        )}
                      </div>
                    </div>
                    <div
                      className="prose max-w-none text-sm text-gray-700 bg-gray-50 p-4 rounded-lg"
                      dangerouslySetInnerHTML={{
                        __html: descripcionHechosVistaHtml,
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
          <div
            data-tour="detalle-panel-lateral"
            className="lg:col-span-1 space-y-6"
          >
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
                          (a) => a.id === areaRelacion.area_id,
                        );
                        return (
                          <div
                            key={areaRelacion.id}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <span className="text-sm font-medium text-gray-700 flex-1">
                              {area?.nombre || "Área desconocida"}
                            </span>
                            {canAsignarAreas && (
                              <button
                                onClick={() =>
                                  handleRemoveArea(areaRelacion.id)
                                }
                                className="p-1 text-red-600 hover:text-red-800 transition-colors"
                                title="Eliminar área"
                              >
                                <FiTrash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Agregar nueva área (solo con permiso asignar_areas) */}
                  {canAsignarAreas && (
                    <div className="pt-4 border-t border-gray-200">
                      <CustomSelect
                        key={`add-area-${areasAdicionales.map((a) => a.id).join("-")}`}
                        label="Agregar Área"
                        name="agregar_area_siniestro"
                        value=""
                        onChange={(val) => {
                          const id = typeof val === "string" ? val : "";
                          if (id) handleAddArea(id);
                        }}
                        options={todasLasAreas
                          .filter(
                            (area) =>
                              !areasAdicionales.some(
                                (ar) => ar.area_id === area.id,
                              ),
                          )
                          .map((area) => ({
                            value: area.id,
                            label: area.nombre,
                          }))}
                        placeholder="Seleccionar área…"
                        isSearchable
                        isClearable
                      />
                    </div>
                  )}
                </div>
              )}
            </EmpresaCard>

            {/* Sección: Administrar Involucrados (visible solo con ver_involucrados) */}
            {canVerInvolucrados && (
              <EmpresaCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2
                    className="text-lg font-bold"
                    style={{ color: empresaColors.primary }}
                  >
                    Abogados designados
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
                            (u) => u.id === involucrado.usuario_id,
                          );

                          const rolUsuario =
                            usuario?.rol?.nombre ||
                            (usuario?.rol_id
                              ? `Rol ID: ${usuario.rol_id}`
                              : "Sin rol");

                          return (
                            <div
                              key={involucrado.id}
                              className="p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-700 truncate">
                                      {getUserDisplayName(usuario, usuario?.email || "Usuario desconocido")}
                                    </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Rol del usuario:{" "}
                                    <span className="font-medium text-gray-700">
                                      {rolUsuario}
                                    </span>
                                    {involucrado.es_principal && (
                                      <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                        Principal
                                      </span>
                                    )}
                                  </p>
                                </div>
                                {canActualizarSiniestro && (
                                  <button
                                    onClick={() =>
                                      handleRemoveInvolucrado(involucrado.id)
                                    }
                                    className="p-1 text-red-600 hover:text-red-800 transition-colors ml-2 flex-shrink-0"
                                    title="Eliminar involucrado"
                                  >
                                    <FiTrash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Agregar nuevo involucrado (solo con permiso actualizar) */}
                    {canAgregarAbogado && (
                      <div className="pt-4 border-t border-gray-200 space-y-3">
                        <div className="flex flex-col md:flex-row gap-2 md:items-end">
                          <div className="w-full md:flex-1">
                            <CustomSelect
                              label="Agregar abogado"
                              name="agregar_involucrado_siniestro"
                              value={nuevoInvolucradoUsuarioId}
                              onChange={(val) =>
                                setNuevoInvolucradoUsuarioId(
                                  typeof val === "string" ? val : "",
                                )
                              }
                              options={abogadosDisponibles.map((usuario) => ({
                                value: usuario.id,
                                label: getUserDisplayName(
                                  usuario,
                                  usuario.email || "Usuario",
                                ),
                              }))}
                              placeholder={
                                areaIdsSiniestro.length > 0
                                  ? "Seleccionar abogado…"
                                  : "Asigna primero al menos un área al siniestro…"
                              }
                              disabled={areaIdsSiniestro.length === 0}
                              isSearchable
                              isClearable
                            />
                          </div>

                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={!nuevoInvolucradoUsuarioId}
                            onClick={async () => {
                              if (!nuevoInvolucradoUsuarioId) return;
                              await handleAddInvolucrado(
                                nuevoInvolucradoUsuarioId,
                                "tercero",
                              );
                              setNuevoInvolucradoUsuarioId("");
                            }}
                          >
                            Agregar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </EmpresaCard>
            )}

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
                  {canActualizarSiniestro && (
                    <button
                      onClick={handleOpenPolizaModal}
                      className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                      title="Administrar pólizas"
                    >
                      <FiEdit3 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    Pólizas registradas:
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {polizasDisplay.length}
                  </span>
                </div>

                {polizaPrincipal ? (
                  <>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <span className="text-sm text-gray-600">
                        Póliza principal:
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {polizaPrincipal.numero_poliza || (
                          <span className="text-gray-400 italic">
                            Sin número
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        Suma Asegurada:
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {Number(polizaPrincipal.suma_asegurada || 0) > 0 ? (
                          `$${Number(
                            polizaPrincipal.suma_asegurada || 0,
                          ).toLocaleString("es-MX", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        ) : (
                          <span className="text-gray-400 italic">$0.00</span>
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Deducible:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {Number(polizaPrincipal.deducible || 0) > 0 ? (
                          `$${Number(polizaPrincipal.deducible || 0).toLocaleString(
                            "es-MX",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )}`
                        ) : (
                          <span className="text-gray-400 italic">$0.00</span>
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Reserva:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {Number(polizaPrincipal.reserva || 0) > 0 ? (
                          `$${Number(polizaPrincipal.reserva || 0).toLocaleString(
                            "es-MX",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )}`
                        ) : (
                          <span className="text-gray-400 italic">$0.00</span>
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Coaseguro:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {Number(polizaPrincipal.coaseguro || 0) > 0 ? (
                          `$${Number(
                            polizaPrincipal.coaseguro || 0,
                          ).toLocaleString("es-MX", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        ) : (
                          <span className="text-gray-400 italic">$0.00</span>
                        )}
                      </span>
                    </div>

                    {polizasDisplay.length > 1 && (
                      <div className="pt-2 border-t border-gray-200 space-y-2">
                        {polizasDisplay.slice(1).map((poliza, index) => (
                          <div
                            key={poliza.id || poliza.tempId}
                            className="rounded-lg bg-gray-50 px-3 py-2"
                          >
                            <p className="text-sm font-medium text-gray-700">
                              Póliza adicional {index + 1}
                            </p>
                            <p className="text-sm text-gray-600">
                              {poliza.numero_poliza || "Sin número"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="pt-2 border-t border-gray-200">
                    <span className="text-gray-400 italic">
                      No hay pólizas registradas
                    </span>
                  </div>
                )}
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
              <DataTable
                layoutStorageKey="aslin-datatable-siniestro-log-auditoria"
                columns={logColumns}
                data={logsAuditoria}
                emptyText="No hay registros de actividad"
                enableSearch={true}
                searchPlaceholder="Buscar en el log..."
                enablePagination={true}
                enableSorting={true}
                pageSize={25}
                size="compact"
                maxTextLength={140}
              />
            )}
          </EmpresaCard>
        </div>
      </div>

      {/* Modal de Edición de Documento */}
      <Modal
        open={showEditorModal}
        onClose={() => {
          if (!savingDocument) {
            setShowEditorModal(false);
            setDocHorasBitacora("");
            setDocComentarioBitacora("");
          }
        }}
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
                        documentoExistente.creado_en,
                      ).toLocaleDateString("es-MX")}
                    </p>
                  </div>
                </div>
              )}

              {/* Editor Jodit */}
              <JoditEditor
                label="Contenido del Documento"
                value={documentoContenido}
                onChange={setDocumentoContenido}
                placeholder="Escribe el contenido del documento aquí..."
                height={400}
                disabled={savingDocument}
              />

              {/* Bitácora: horas y comentario (carga/actualización de informe) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Horas (para bitácora)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={24}
                    step={0.25}
                    value={docHorasBitacora}
                    onChange={(e) => setDocHorasBitacora(e.target.value)}
                    placeholder="Ej: 1.5"
                    disabled={savingDocument}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Comentario (para bitácora)
                  </label>
                  <input
                    type="text"
                    value={docComentarioBitacora}
                    onChange={(e) => setDocComentarioBitacora(e.target.value)}
                    placeholder="Comentario que se registrará en la bitácora..."
                    disabled={savingDocument}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>

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

      {/* Modal para subir archivo (solo archivos, no editables) */}
      <Modal
        open={showUploadDocModal}
        onClose={handleCloseUploadDocModal}
        title={
          uploadModalEtapaContext
            ? `Subir archivo — ${uploadModalEtapaContext.nombre}`
            : "Subir archivo"
        }
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-4">
          {!uploadEsVistaEtapaPdf && (
            <p className="text-sm text-gray-600">
              Sube imágenes, PDFs u otros archivos. Según el tipo elegido: si es{" "}
              <strong>PDF</strong> o <strong>imagen</strong> podrás clasificar por{" "}
              <strong>categoría</strong>; si es <strong>editor</strong>, por{" "}
              <strong>plantilla</strong>.
            </p>
          )}
          {uploadEsVistaEtapaPdf && (
            <p className="text-sm text-gray-600">
              El tipo de documento corresponde a esta etapa. Elige uno de los{" "}
              <strong>documentos esperados</strong> y adjunta el archivo.
            </p>
          )}

          {/* Tipo de documento (solo si no viene bloqueado desde la etapa PDF) */}
          {!uploadEsVistaEtapaPdf && (
            <CustomSelect
              label="Tipo de documento"
              name="upload_doc_tipo"
              value={uploadDocTipoId}
              onChange={(val) =>
                setUploadDocTipoId(typeof val === "string" ? val : "")
              }
              options={uploadTiposDocumento.map((t) => ({
                value: t.id,
                label: `${t.nombre}${
                  t.tipo === "pdf"
                    ? " (PDF)"
                    : t.tipo === "editor"
                      ? " (Editor)"
                      : t.tipo === "imagen"
                        ? " (Imagen)"
                        : ""
                }`,
              }))}
              placeholder="Seleccionar tipo…"
              disabled={uploadDocLoadingCatalogos}
              isSearchable
              isClearable
            />
          )}

          {uploadEsVistaEtapaPdf && uploadDocTipoId && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Tipo de documento (etapa)
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {uploadModalEtapaContext?.tipo_documento_principal?.nombre ??
                  "—"}
                <span className="ml-2 text-xs font-normal text-gray-500">
                  (
                  {(uploadModalEtapaContext?.tipo_documento_principal?.tipo ??
                    "pdf"
                  ).toUpperCase()}
                  )
                </span>
              </p>
            </div>
          )}

          {/* Desde etapa PDF: documentos esperados (requisitos) — react-select */}
          {uploadEsVistaEtapaPdf && (
            <div>
              {uploadEtapaLoadingReqs ? (
                <p className="text-sm text-gray-500">Cargando lista…</p>
              ) : uploadEtapaRequisitos.length === 0 ? (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Documento esperado en esta etapa
                  </label>
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    No hay documentos configurados para esta etapa. Puedes subir el
                    archivo sin asociar un requisito.
                  </p>
                </>
              ) : (
                <CustomSelect
                  label="Documento esperado en esta etapa"
                  name="upload_requisito_etapa"
                  required
                  value={uploadRequisitoSeleccionadoId}
                  onChange={(val) =>
                    setUploadRequisitoSeleccionadoId(
                      typeof val === "string" ? val : "",
                    )
                  }
                  options={uploadEtapaRequisitos.map((req) => {
                    const nombre = (req.nombre_documento ?? "").trim();
                    const catNombre = (
                      req.categoria_documento?.nombre ?? ""
                    ).trim();
                    const parts: string[] = [nombre || "—"];
                    // No repetir: la categoría suele ser el mismo texto (o truncado) que nombre_documento
                    if (
                      catNombre &&
                      catNombre.toLowerCase() !== nombre.toLowerCase()
                    ) {
                      parts.push(`(${catNombre})`);
                    }
                    // if (req.es_obligatorio) {
                    //   parts.push("Obligatorio");
                    // }
                    return {
                      value: req.id,
                      label: parts.join(" · "),
                    };
                  })}
                  placeholder="Buscar o seleccionar documento esperado…"
                  disabled={uploadEtapaLoadingReqs}
                  isSearchable
                  isClearable
                />
              )}
            </div>
          )}

          {/* PDF / imagen (modal genérico) → solo categoría */}
          {uploadDocTipoId && !uploadDocEsEditor && !uploadEsVistaEtapaPdf && (
            <CustomSelect
              label="Categoría (opcional)"
              name="upload_doc_categoria"
              value={uploadDocCategoriaId}
              onChange={(val) =>
                setUploadDocCategoriaId(typeof val === "string" ? val : "")
              }
              options={uploadCategorias.map((c) => ({
                value: c.id,
                label: c.nombre,
              }))}
              placeholder="Sin categoría"
              disabled={uploadDocLoadingCatalogos}
              isSearchable
              isClearable
            />
          )}

          {/* Editor → solo plantilla (modal genérico) */}
          {uploadDocTipoId && uploadDocEsEditor && !uploadEsVistaEtapaPdf && (
            <CustomSelect
              label="Plantilla (opcional)"
              name="upload_doc_plantilla"
              value={uploadDocPlantillaId}
              onChange={(val) =>
                setUploadDocPlantillaId(typeof val === "string" ? val : "")
              }
              options={uploadPlantillas.map((p) => ({
                value: p.id,
                label: p.nombre,
              }))}
              placeholder="Ninguna"
              disabled={uploadDocLoadingCatalogos}
              isSearchable
              isClearable
            />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Archivo *
            </label>
            <input
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:cursor-pointer"
              onChange={(e) => setUploadDocFile(e.target.files?.[0] || null)}
            />
            {uploadDocFile && (
              <p className="mt-1 text-xs text-gray-500">
                {uploadDocFile.name} ({(uploadDocFile.size / 1024).toFixed(1)}{" "}
                KB)
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción (opcional)
            </label>
            <input
              type="text"
              value={uploadDocDescripcion}
              onChange={(e) => setUploadDocDescripcion(e.target.value)}
              placeholder="Ej: Foto del daño, contrato firmado..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Horas (para bitácora)
            </label>
            <input
              type="number"
              min={0}
              max={24}
              step={0.25}
              value={uploadDocHoras}
              onChange={(e) => setUploadDocHoras(e.target.value)}
              placeholder="Ej: 1.5"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comentario (para bitácora)
            </label>
            <textarea
              value={uploadDocComentario}
              onChange={(e) => setUploadDocComentario(e.target.value)}
              placeholder="Comentario que se registrará en la bitácora..."
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={handleCloseUploadDocModal}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitUploadDoc}
              disabled={
                !uploadDocFile ||
                uploadDocSaving ||
                (uploadEsVistaEtapaPdf &&
                  uploadEtapaRequisitos.length > 0 &&
                  !uploadRequisitoSeleccionadoId)
              }
            >
              {uploadDocSaving ? "Subiendo…" : "Subir archivo"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de formulario de continuación (llenar datos para documento de continuación) */}
      <FormularioContinuacionModal
        open={showFormularioContinuacionModal}
        onClose={() => {
          setShowFormularioContinuacionModal(false);
          setFormularioContinuacionPlantillaId("");
          setFormularioContinuacionPlantillaNombre("");
        }}
        plantillaId={formularioContinuacionPlantillaId}
        plantillaNombre={formularioContinuacionPlantillaNombre}
        siniestroId={siniestroId}
        areaId={activeAreaTab || undefined}
        onSaved={async () => {
          await loadDocumentosSiniestro();
          await loadLogsAuditoria();
          swalSuccess("Datos de continuación guardados correctamente.");
        }}
        empresaColors={empresaColors}
      />

      {/* Modal de Visualización de PDF */}
      <Modal
        open={showPdfModal}
        onClose={() => {
          setShowPdfModal(false);
          setPdfBase64(null);
          setPdfFilename("");
          revokeArchivoPreviewUrl();
          setDocumentoEnVistaPrevia(null);
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
                <p className="text-gray-600">Cargando vista previa…</p>
              </div>
            </div>
          ) : pdfBase64 ? (
            <div className="w-full">
              <iframe
                src={`data:application/pdf;base64,${pdfBase64}`}
                className="w-full h-[70vh] border border-gray-300 rounded-lg"
                title="Vista previa del PDF"
              />
              <DocumentoAcciones
                variant="modal-preview"
                kind="informe"
                documento={documentoEnVistaPrevia}
                showEditar={!!currentEtapa}
                descargarLabel="Descargar PDF"
                onCerrar={() => {
                  setShowPdfModal(false);
                  setPdfBase64(null);
                  setPdfFilename("");
                  revokeArchivoPreviewUrl();
                  setDocumentoEnVistaPrevia(null);
                }}
                onDescargar={() => {
                  const link = document.createElement("a");
                  link.href = `data:application/pdf;base64,${pdfBase64}`;
                  link.download =
                    pdfFilename || `${currentEtapa?.nombre || "documento"}.pdf`;
                  link.click();
                }}
                onEnviar={() => {
                  const doc = documentoEnVistaPrevia;
                  if (!doc?.id) {
                    swalError(
                      "No se puede enviar: el documento no tiene identificador en el sistema.",
                    );
                    return;
                  }
                  handleOpenEmailModalFromDocumento(doc);
                  setShowPdfModal(false);
                  setPdfBase64(null);
                  setPdfFilename("");
                  revokeArchivoPreviewUrl();
                  setDocumentoEnVistaPrevia(null);
                }}
                onEditar={
                  currentEtapa
                    ? () => {
                        setShowPdfModal(false);
                        revokeArchivoPreviewUrl();
                        setPdfBase64(null);
                        setPdfFilename("");
                        setDocumentoEnVistaPrevia(null);
                        handleOpenDocumentEditor(currentEtapa);
                      }
                    : undefined
                }
              />
            </div>
          ) : archivoPreviewUrl ? (
            <div className="w-full">
              {(() => {
                const mime = (archivoPreviewMime || "").toLowerCase();
                const ext =
                  (pdfFilename || "").split(".").pop()?.toLowerCase() || "";
                const isPdf = mime.includes("pdf") || ext === "pdf";
                const isImage =
                  mime.startsWith("image/") ||
                  ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(
                    ext,
                  );
                if (isImage) {
                  return (
                    <div className="flex justify-center overflow-auto max-h-[70vh] border border-gray-300 rounded-lg bg-gray-50 p-2">
                      <img
                        src={archivoPreviewUrl}
                        alt={pdfFilename || "Vista previa"}
                        className="max-h-[68vh] w-auto object-contain"
                      />
                    </div>
                  );
                }
                if (isPdf) {
                  return (
                    <iframe
                      src={archivoPreviewUrl}
                      className="w-full h-[70vh] border border-gray-300 rounded-lg"
                      title={pdfFilename || "Vista previa"}
                    />
                  );
                }
                return (
                  <div className="text-center py-10 px-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                    <p className="text-gray-700 font-medium">
                      Vista previa no disponible para este tipo de archivo
                    </p>
                    <p className="text-sm text-gray-500 mt-2 break-all">
                      {pdfFilename}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Usa &quot;Descargar archivo&quot; para abrirlo en tu
                      equipo.
                    </p>
                  </div>
                );
              })()}
              <DocumentoAcciones
                variant="modal-preview"
                kind="archivo"
                documento={documentoEnVistaPrevia}
                descargarLabel="Descargar archivo"
                onCerrar={() => {
                  setShowPdfModal(false);
                  setPdfBase64(null);
                  setPdfFilename("");
                  revokeArchivoPreviewUrl();
                  setDocumentoEnVistaPrevia(null);
                }}
                onDescargar={() => {
                  if (documentoEnVistaPrevia) {
                    handleDownloadDocumento(documentoEnVistaPrevia);
                  }
                }}
                onEnviar={() => {
                  const doc = documentoEnVistaPrevia;
                  if (!doc?.id) {
                    swalError(
                      "No se puede enviar: el documento no tiene identificador en el sistema.",
                    );
                    return;
                  }
                  handleOpenEmailModalFromDocumento(doc);
                  setShowPdfModal(false);
                  setPdfBase64(null);
                  setPdfFilename("");
                  revokeArchivoPreviewUrl();
                  setDocumentoEnVistaPrevia(null);
                }}
              />
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No hay contenido para mostrar
            </div>
          )}
        </div>
      </Modal>

      {/* Modal de Envío de Correo con Documento */}
      <Modal
        open={showEmailModal}
        onClose={() => !emailSending && setShowEmailModal(false)}
        title="Enviar documento por correo"
        maxWidthClass="max-w-3xl"
        maxHeightClass="max-h-[90vh]"
      >
        <div className="space-y-4">
          {/* Configuración SMTP */}
          <CustomSelect
            label="Configuración SMTP"
            name="email_configuracion_smtp"
            disabled={true}
            value={emailForm.configuracion_smtp_id}
            onChange={(val) =>
              setEmailForm((prev) => ({
                ...prev,
                configuracion_smtp_id:
                  typeof val === "string" ? val : "",
              }))
            }
            options={smtpConfigs.map((cfg) => ({
              value: cfg.id,
              label: cfg.nombre || cfg.host || String(cfg.id),
            }))}
            placeholder="Seleccionar configuración…"
            isSearchable
            isClearable
          />

          {/* Para */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Para <span className="text-red-500">*</span>
              </label>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setNuevoContactoForm({ nombre: "", correo: "" });
                  setShowNuevoContactoModal(true);
                }}
              >
                <FiUserPlus className="w-4 h-4 mr-1" />
                Agregar contacto
              </Button>
            </div>
            <CustomSelect
              name="email_para"
              value={emailPara}
              onChange={(value) =>
                setEmailPara(Array.isArray(value) ? value : value ? [value] : [])
              }
              options={opcionesDestinatariosUnificadas}
              placeholder="Selecciona o busca destinatarios principales..."
              isMulti
            />
          </div>

          {/* CC */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CC (Con copia)
            </label>
            <CustomSelect
              name="email_cc"
              value={emailCc}
              onChange={(value) =>
                setEmailCc(Array.isArray(value) ? value : value ? [value] : [])
              }
              options={opcionesDestinatariosUnificadas}
              placeholder="Selecciona destinatarios en copia..."
              isMulti
            />
          </div>

          {/* CCO */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CCO (Con copia oculta)
            </label>
            <CustomSelect
              name="email_cco"
              value={emailCco}
              onChange={(value) =>
                setEmailCco(Array.isArray(value) ? value : value ? [value] : [])
              }
              options={opcionesDestinatariosUnificadas}
              placeholder="Selecciona destinatarios en copia oculta..."
              isMulti
            />
          </div>

          {/* Asunto */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Asunto
            </label>
            <input
              type="text"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={emailForm.asunto}
              onChange={(e) =>
                setEmailForm((prev) => ({
                  ...prev,
                  asunto: e.target.value,
                }))
              }
            />
          </div>

          {/* Mensaje */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Mensaje
            </label>
            <div className="mt-1">
              <JoditEditor
                value={emailForm.mensaje}
                onChange={(value) =>
                  setEmailForm((prev) => ({
                    ...prev,
                    mensaje: value,
                  }))
                }
                placeholder="Escribe el mensaje del correo..."
                height={320}
              />
            </div>
          </div>

          {/* Adjuntos adicionales */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Adjuntar archivos adicionales
            </label>
            <div className="mt-1 flex items-center gap-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                <FiPaperclip className="w-4 h-4" />
                Seleccionar archivos
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleEmailAdjuntosChange}
                />
              </label>
              {emailForm.archivos_adicionales.length > 0 && (
                <span className="text-xs text-gray-500">
                  {emailForm.archivos_adicionales.length} archivo(s)
                  seleccionado(s)
                </span>
              )}
            </div>
            {emailForm.archivos_adicionales.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto rounded-md border border-gray-200">
                {emailForm.archivos_adicionales.map((archivo, index) => (
                  <div
                    key={`${archivo.name}-${archivo.lastModified}-${index}`}
                    className="flex items-center justify-between px-3 py-2 text-sm border-b border-gray-100 last:border-b-0"
                  >
                    <span className="truncate pr-3">{archivo.name}</span>
                    <button
                      type="button"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleRemoveArchivoAdicional(index)}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500">
              El documento seleccionado se envía como adjunto principal y los
              archivos de esta sección se agregan como anexos adicionales.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => !emailSending && setShowEmailModal(false)}
              disabled={emailSending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSendEmailWithDocument}
              disabled={emailSending}
            >
              {emailSending ? "Enviando..." : "Enviar correo"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Agregar Contacto (desde el modal de envío) */}
      <Modal
        open={showNuevoContactoModal}
        onClose={() => setShowNuevoContactoModal(false)}
        title="Agregar contacto"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <Input
              label="Nombre"
              name="nuevo_contacto_nombre"
              value={nuevoContactoForm.nombre}
              onChange={(e) =>
                setNuevoContactoForm((prev) => ({
                  ...prev,
                  nombre: e.target.value,
                }))
              }
            />
            <Input
              label="Correo"
              name="nuevo_contacto_correo"
              type="email"
              value={nuevoContactoForm.correo}
              onChange={(e) =>
                setNuevoContactoForm((prev) => ({
                  ...prev,
                  correo: e.target.value,
                }))
              }
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowNuevoContactoModal(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleCrearNuevoContacto}
            >
              Guardar contacto
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de edición de descripción de hechos (solo última versión) */}
      <Modal
        open={showDescripcionModal}
        onClose={() => !savingDescripcionVersion && setShowDescripcionModal(false)}
        title={`Editar Descripción de los Hechos (${descripcionActual ? `v${descripcionActual.version}` : "última"})`}
        maxWidthClass="max-w-5xl"
      >
        <div className="space-y-4">
          <JoditEditor
            key={descripcionActual?.id || "descripcion-hechos-editor"}
            value={descripcionEditHtml}
            onChange={setDescripcionEditHtml}
            placeholder="Escribe la descripción de los hechos..."
          />

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
            <EmpresaButton
              variant="outline"
              onClick={() => setShowDescripcionModal(false)}
              disabled={savingDescripcionVersion}
            >
              Cancelar
            </EmpresaButton>
            <EmpresaButton
              variant="primary"
              onClick={handleSaveDescripcionVersion}
              loading={savingDescripcionVersion}
              disabled={savingDescripcionVersion}
            >
              <FiSave className="w-4 h-4 mr-2" />
              Guardar como nueva versión
            </EmpresaButton>
          </div>
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
              />
              <Input
                label="Fecha Asignacion"
                name="fecha_asignacion"
                type="date"
                value={editForm.fecha_asignacion}
                onChange={handleEditFormChange}
              />
              <Input
                label="Fecha Reporte"
                name="fecha_registro"
                type="date"
                value={editForm.fecha_registro}
                onChange={handleEditFormChange}
                required
              />
              <Input
                label="Fecha del siniestro (ocurrencia)"
                name="fecha_siniestro"
                type="date"
                value={editForm.fecha_siniestro}
                onChange={handleEditFormChange}
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

          {/* Asegurado */}
          <div>
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: empresaColors.primary }}
            >
              Asegurado
            </h3>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[200px]">
                <CustomSelect
                  label="Seleccionar asegurado"
                  name="asegurado_id_edit"
                  value={editForm.asegurado_id}
                  onChange={(v) =>
                    setEditForm((prev) => ({
                      ...prev,
                      asegurado_id: (v as string) || "",
                    }))
                  }
                  options={editModalAsegurados.map((a: any) => ({
                    value: a.id,
                    label:
                      [a.nombre, a.apellido_paterno, a.apellido_materno]
                        .filter(Boolean)
                        .join(" ") || "Sin nombre",
                  }))}
                  placeholder="Buscar asegurado..."
                  isSearchable
                  isClearable
                />
              </div>
              <EmpresaButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  setCrearAseguradoDesdeEditModal(true);
                  setShowCrearAseguradoModal(true);
                }}
              >
                <FiPlus className="w-4 h-4 mr-2" />
                Crear nuevo asegurado
              </EmpresaButton>
            </div>
          </div>

          {/* Relaciones institucionales */}
          <div>
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: empresaColors.primary }}
            >
              Relaciones del Siniestro
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CustomSelect
                label="Institución"
                name="institucion_id"
                value={editForm.institucion_id}
                onChange={(v) =>
                  setEditForm((prev) => ({
                    ...prev,
                    institucion_id: (v as string) || "",
                  }))
                }
                options={editModalInstituciones.map((institucion: any) => ({
                  value: institucion.id,
                  label: institucion.nombre || "Sin nombre",
                }))}
                placeholder="Seleccionar institución"
                isSearchable
                isClearable
                isCreatable
                onCreateOption={crearInstitucionEditModalDesdeNombre}
              />
              <CustomSelect
                label="Autoridad"
                name="autoridad_id"
                value={editForm.autoridad_id}
                onChange={(v) =>
                  setEditForm((prev) => ({
                    ...prev,
                    autoridad_id: (v as string) || "",
                  }))
                }
                options={editModalAutoridades.map((autoridad: any) => ({
                  value: autoridad.id,
                  label: autoridad.nombre || "Sin nombre",
                }))}
                placeholder="Seleccionar autoridad"
                isSearchable
                isClearable
                isCreatable
                onCreateOption={crearAutoridadEditModalDesdeNombre}
              />
              <CustomSelect
                label="Proveniente"
                name="proveniente_id"
                value={editForm.proveniente_id}
                onChange={(v) =>
                  setEditForm((prev) => ({
                    ...prev,
                    proveniente_id: (v as string) || "",
                  }))
                }
                options={editModalProvenientes.map((proveniente: any) => ({
                  value: proveniente.id,
                  label: proveniente.nombre || "Sin nombre",
                }))}
                placeholder="Seleccionar proveniente"
                isSearchable
                isClearable
              />
              <CustomSelect
                label="Estado del siniestro"
                name="estado_id"
                value={editForm.estado_id}
                onChange={(v) =>
                  setEditForm((prev) => ({
                    ...prev,
                    estado_id: (v as string) || "",
                  }))
                }
                options={editModalEstados.map((estado: any) => ({
                  value: estado.id,
                  label: estado.nombre || "Sin nombre",
                }))}
                placeholder="Seleccionar estado"
                isSearchable
                isClearable
              />
              <CustomSelect
                label="Calificación del siniestro"
                name="calificacion_id"
                value={editForm.calificacion_id}
                onChange={(v) =>
                  setEditForm((prev) => ({
                    ...prev,
                    calificacion_id: (v as string) || "",
                  }))
                }
                options={editModalCalificaciones.map((calificacion: any) => ({
                  value: calificacion.id,
                  label: calificacion.nombre || "Sin nombre",
                }))}
                placeholder="Seleccionar calificación"
                isSearchable
                isClearable
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
              <CustomSelect
                label="Prioridad"
                name="prioridad"
                value={editForm.prioridad}
                onChange={(val) =>
                  setEditForm((prev) => ({
                    ...prev,
                    prioridad:
                      typeof val === "string"
                        ? (val as typeof prev.prioridad)
                        : prev.prioridad,
                  }))
                }
                options={[
                  { value: "baja", label: "Baja" },
                  { value: "media", label: "Media" },
                  { value: "alta", label: "Alta" },
                  { value: "critica", label: "Crítica" },
                ]}
                placeholder="Prioridad"
                isSearchable={false}
                isClearable={false}
              />
              <CustomSelect
                label="Forma de Contacto"
                name="forma_contacto"
                value={editForm.forma_contacto}
                onChange={(val) =>
                  setEditForm((prev) => ({
                    ...prev,
                    forma_contacto:
                      typeof val === "string"
                        ? (val as typeof prev.forma_contacto)
                        : prev.forma_contacto,
                  }))
                }
                options={[
                  { value: "correo", label: "Correo" },
                  { value: "telefono", label: "Teléfono" },
                  { value: "directa", label: "Directa" },
                ]}
                placeholder="Forma de contacto"
                isSearchable={false}
                isClearable={false}
              />
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
        title="Administrar Pólizas"
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              La primera póliza de la lista se tomará como principal.
            </p>
            <Button variant="secondary" onClick={handleAddPoliza}>
              <FiPlus className="w-4 h-4 mr-2" />
              Agregar póliza
            </Button>
          </div>

          <div className="space-y-4">
            {polizaForm.map((poliza, index) => (
              <div
                key={poliza.id || poliza.tempId}
                className="rounded-lg border border-gray-200 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">
                    {index === 0
                      ? "Póliza principal"
                      : `Póliza adicional ${index}`}
                  </span>
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePoliza(index)}
                      className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                    >
                      <FiTrash2 className="w-4 h-4" />
                      Quitar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Número de Póliza"
                    name={`numero_poliza_${index}`}
                    value={poliza.numero_poliza}
                    onChange={(event) =>
                      handlePolizaFormChange(
                        index,
                        "numero_poliza",
                        event.target.value,
                      )
                    }
                    placeholder="Ej: POL-2024-001"
                  />
                  <Input
                    label="Suma Asegurada"
                    name={`suma_asegurada_${index}`}
                    type="number"
                    value={poliza.suma_asegurada}
                    onChange={(event) =>
                      handlePolizaFormChange(
                        index,
                        "suma_asegurada",
                        event.target.value,
                      )
                    }
                    step="0.01"
                    placeholder="0.00"
                  />
                  <Input
                    label="Deducible"
                    name={`deducible_${index}`}
                    type="number"
                    value={poliza.deducible}
                    onChange={(event) =>
                      handlePolizaFormChange(
                        index,
                        "deducible",
                        event.target.value,
                      )
                    }
                    step="0.01"
                    placeholder="0.00"
                  />
                  <Input
                    label="Reserva"
                    name={`reserva_${index}`}
                    type="number"
                    value={poliza.reserva}
                    onChange={(event) =>
                      handlePolizaFormChange(
                        index,
                        "reserva",
                        event.target.value,
                      )
                    }
                    step="0.01"
                    placeholder="0.00"
                  />
                  <Input
                    label="Coaseguro"
                    name={`coaseguro_${index}`}
                    type="number"
                    value={poliza.coaseguro}
                    onChange={(event) =>
                      handlePolizaFormChange(
                        index,
                        "coaseguro",
                        event.target.value,
                      )
                    }
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
              </div>
            ))}
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

      {/* Modal Agregar / Cambiar Asegurado */}
      <Modal
        open={showModalAsegurado}
        onClose={() => !asignandoAsegurado && setShowModalAsegurado(false)}
        title="Asignar Asegurado"
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-4">
          <CustomSelect
            label="Seleccionar asegurado"
            name="asegurado_modal"
            value={aseguradoSeleccionadoModal}
            onChange={(v) => setAseguradoSeleccionadoModal(v as string)}
            options={aseguradosCatalogo.map((a: any) => ({
              value: a.id,
              label:
                [a.nombre, a.apellido_paterno, a.apellido_materno]
                  .filter(Boolean)
                  .join(" ") || "Sin nombre",
            }))}
            placeholder="Buscar por nombre..."
            isSearchable
            isClearable
          />
          <div className="flex flex-wrap gap-2">
            <EmpresaButton
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowCrearAseguradoModal(true);
              }}
            >
              <FiPlus className="w-4 h-4 mr-2" />
              Crear nuevo asegurado
            </EmpresaButton>
            <EmpresaButton
              variant="primary"
              size="sm"
              onClick={asignarAsegurado}
              disabled={!aseguradoSeleccionadoModal || asignandoAsegurado}
            >
              {asignandoAsegurado ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block" />
                  Asignando...
                </>
              ) : (
                "Asignar"
              )}
            </EmpresaButton>
          </div>
        </div>
      </Modal>

      <CrearAseguradoModal
        open={showCrearAseguradoModal}
        onClose={() => {
          setCrearAseguradoDesdeEditModal(false);
          setShowCrearAseguradoModal(false);
        }}
        onAseguradoCreado={onAseguradoCreadoDesdeModal}
      />

      <LegacyDocumentClassificationModal
        siniestroId={siniestroId}
        areaId={activeAreaTab || undefined}
        enabled={!!siniestroId}
        assignedAreas={legacyAssignedAreas}
        onFinalized={async () => {
          await loadDocumentosSiniestro();
          let flujoTrabajoIdActual: string | undefined = undefined;
          if (activeFlujoTab.startsWith("general-")) {
            flujoTrabajoIdActual = activeFlujoTab.replace("general-", "");
          } else if (activeFlujoTab.startsWith("area-")) {
            flujoTrabajoIdActual = activeFlujoTab.replace("area-", "");
          }
          await loadDocumentosFiltrados(activeAreaTab || undefined, flujoTrabajoIdActual);
        }}
      />
    </div>
  );
}

/**
 * Componente para mostrar las etapas de un flujo en formato timeline/stepper
 */
const EtapasTimeline = React.memo(function EtapasTimeline({
  etapas,
  documentosExistentes,
  onOpenEditor,
  onViewDocument,
  onContinuar,
  onSubirArchivo,
  empresaColors,
  flujoTrabajoId,
  areaId,
  siniestroId,
  canVerPdf = true,
  canEditarDocumento = true,
  canCrearDocumento = true,
}: {
  etapas: EtapaFlujo[];
  documentosExistentes: DocumentoEtapa[];
  onOpenEditor: (etapa: EtapaFlujo) => void;
  onViewDocument: (etapa: EtapaFlujo) => void;
  onContinuar?: (etapa: EtapaFlujo, docExistente: any) => void;
  /** Abre el modal de carga de archivo (etapa PDF/imagen: tipo fijo y requisitos de la etapa) */
  onSubirArchivo?: (etapa: EtapaFlujo) => void;
  empresaColors: { primary: string; secondary: string; tertiary: string };
  flujoTrabajoId?: string;
  areaId?: string;
  siniestroId?: string;
  canVerPdf?: boolean;
  canEditarDocumento?: boolean;
  canCrearDocumento?: boolean;
}) {
  /** Tipo de documento principal = editor → abre el editor; pdf/imagen/otro → modal de subida */
  const esTipoEditor = (e: EtapaFlujo) =>
    (e.tipo_documento_principal?.tipo ?? "").toLowerCase() === "editor";

  const abrirDocumentoEtapa = (etapa: EtapaFlujo) => {
    if (!(canCrearDocumento || canEditarDocumento)) return;
    if (esTipoEditor(etapa)) {
      onOpenEditor(etapa);
      return;
    }
    onSubirArchivo?.(etapa);
  };

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
        {etapasOrdenadas.map((etapa, index) => {
          // Cómputos compartidos entre botones y contador de archivos
          const docsEtapa = documentosExistentes.filter(
            (d: any) =>
              d.etapa_flujo_id === etapa.id &&
              (!areaId || d.area_id === areaId),
          );
          const countEtapa = docsEtapa.length;
          const esEditor = esTipoEditor(etapa);
          const puedeAccion = canCrearDocumento || canEditarDocumento;
          const hayDoc = tieneDocumentoDisponible(etapa);

          return (
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
                            {etapa.tipo_documento_principal.tipo === "pdf" && (
                              <span className="ml-1 font-normal opacity-70">(PDF)</span>
                            )}
                            {etapa.tipo_documento_principal.tipo === "editor" && (
                              <span className="ml-1 font-normal opacity-70">(Editor)</span>
                            )}
                            {etapa.tipo_documento_principal.tipo === "imagen" && (
                              <span className="ml-1 font-normal opacity-70">(Imagen)</span>
                            )}
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

                    {/* Botones de acción según tipo de documento */}
                    <div className="ml-4 flex-shrink-0 flex items-center gap-2">
                      {hayDoc ? (
                        esEditor ? (
                          // ── Tipo EDITOR: Editar + Ver + Continuar ──────────────
                          <>
                            <button
                              type="button"
                              disabled={!puedeAccion}
                              onClick={() => onOpenEditor(etapa)}
                              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm text-white disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ backgroundColor: empresaColors.primary }}
                              onMouseEnter={(e) => {
                                if (!puedeAccion) return;
                                e.currentTarget.style.opacity = "0.88";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.opacity = puedeAccion ? "1" : "0.5";
                              }}
                              title={countEtapa > 0 ? "Editar documento existente" : "Crear documento"}
                            >
                              <FiEdit3 className="w-4 h-4" />
                              Editar
                            </button>

                            {countEtapa > 0 && canVerPdf && (
                              <button
                                type="button"
                                onClick={() => onViewDocument(etapa)}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                                title="Ver documento como PDF"
                              >
                                <FiEye className="w-4 h-4" />
                                Ver
                              </button>
                            )}

                            {Boolean(etapa.plantilla_documento?.plantilla_continuacion_id) && onContinuar && (
                              <button
                                type="button"
                                disabled={!puedeAccion}
                                onClick={() => {
                                  const docMasReciente =
                                    countEtapa > 0
                                      ? [...docsEtapa].sort(
                                          (a: any, b: any) =>
                                            new Date(b.creado_en).getTime() -
                                            new Date(a.creado_en).getTime(),
                                        )[0]
                                      : null;
                                  onContinuar(etapa, docMasReciente);
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Continuar con la segunda sección de la plantilla"
                              >
                                <FiChevronRight className="w-4 h-4" />
                                Continuar
                              </button>
                            )}
                          </>
                        ) : (
                          // ── Tipo PDF / Imagen: Subir + Ver ─────────────────────
                          <>
                            <button
                              type="button"
                              disabled={!puedeAccion}
                              onClick={() => abrirDocumentoEtapa(etapa)}
                              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm text-white disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ backgroundColor: empresaColors.primary }}
                              onMouseEnter={(e) => {
                                if (!puedeAccion) return;
                                e.currentTarget.style.opacity = "0.88";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.opacity = puedeAccion ? "1" : "0.5";
                              }}
                              title="Subir archivo"
                            >
                              <FiUpload className="w-4 h-4" />
                              Subir archivo
                            </button>
                          </>
                        )
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

                {/* Contador de archivos cargados — solo para tipo PDF/Imagen */}
                {!esEditor && hayDoc && countEtapa > 0 && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-gray-500">
                    <FiFile className="w-3 h-3 shrink-0" />
                    {countEtapa === 1
                      ? "1 archivo cargado"
                      : `${countEtapa} archivos cargados`}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

/**
 * Componente para mostrar la lista de documentos generados en formato tabla
 */
function DocumentosList({
  documentos,
  loading,
  onViewDocument,
  onEditDocument,
  onSendByEmail,
  onDownloadDocument,
  onDownloadInforme,
  onDeleteDocument,
  onUploadClick,
  siniestroId,
  empresaColors,
  etapas,
}: {
  documentos: any[];
  loading: boolean;
  onViewDocument: (documento: any) => void;
  onEditDocument: (documento: any) => void;
  onSendByEmail: (documento: any) => void;
  onDownloadDocument?: (documento: any) => void;
  onDownloadInforme?: (documento: any) => void;
  onDeleteDocument?: (documento: any) => void;
  onUploadClick?: () => void;
  siniestroId: string;
  empresaColors: { primary: string; secondary: string; tertiary: string };
  etapas?: { id: string; nombre: string }[];
}) {
  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        id: "acciones",
        header: "Acciones",
        cell: ({ row }) => {
          const documento = row.original;
          return (
            <DocumentoAcciones
              variant="tabla-fila"
              documento={documento}
              empresaColors={empresaColors}
              onViewDocument={onViewDocument}
              onEditDocument={onEditDocument}
              onSendByEmail={onSendByEmail}
              onDownloadDocument={onDownloadDocument}
              onDownloadInforme={onDownloadInforme}
              onDeleteDocument={onDeleteDocument}
            />
          );
        },
      },
      {
        accessorKey: "nombre_archivo",
        header: "Nombre del Archivo",
        cell: ({ row }) => {
          return (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900">
                {row.original.nombre_archivo}
              </span>
            </div>
          );
        },
      },
      {
        id: "etapa",
        header: "Etapa",
        cell: ({ row }) => {
          const catNombre = row.original.categoria_documento_nombre;
          const etapaNombre = etapas?.find(
            (e) => e.id === row.original.etapa_flujo_id
          )?.nombre;
          return etapaNombre ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
              {etapaNombre} / {catNombre || ""}
            </span>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          );
        },
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
    ],
    [
      onViewDocument,
      onEditDocument,
      onSendByEmail,
      onDownloadDocument,
      onDownloadInforme,
      onDeleteDocument,
      empresaColors,
      etapas,
    ],
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
      <div className="space-y-4">
        {onUploadClick && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onUploadClick}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
              style={{ backgroundColor: empresaColors.primary }}
            >
              <FiPaperclip className="w-4 h-4" />
              Subir archivo (fotos, PDF, etc.)
            </button>
          </div>
        )}
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <FiFileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            No hay documentos generados
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Los documentos generados desde las etapas o archivos subidos
            aparecerán aquí
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {onUploadClick && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onUploadClick}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
            style={{ backgroundColor: empresaColors.primary }}
          >
            <FiPaperclip className="w-4 h-4" />
            Subir archivo (fotos, PDF, etc.)
          </button>
        </div>
      )}
      <DataTable
        layoutStorageKey="aslin-datatable-siniestro-documentos-generados"
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
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingActividad, setEditingActividad] =
    useState<BitacoraActividad | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [horas, setHoras] = useState("");
  const [comentarios, setComentarios] = useState("");
  const [fechaActividad, setFechaActividad] = useState(
    new Date().toISOString().slice(0, 16), // para input datetime-local
  );
  const [saving, setSaving] = useState(false);

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

  const handleCreateActividad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descripcion.trim()) {
      swalError("La descripción es obligatoria");
      return;
    }
    try {
      setSaving(true);
      const horasNum = horas.trim() ? parseFloat(horas) : undefined;
      if (editingActividad) {
        await apiService.updateBitacoraActividad(editingActividad.id, {
          descripcion: descripcion.trim(),
          fecha_actividad: new Date(fechaActividad).toISOString(),
          horas_trabajadas:
            horasNum != null && !Number.isNaN(horasNum) ? horasNum : undefined,
          comentarios: comentarios.trim() || undefined,
        });
        swalSuccess("Actividad actualizada correctamente");
      } else {
        await apiService.createBitacoraActividad({
          siniestro_id: siniestroId,
          tipo_actividad: "otro",
          descripcion: descripcion.trim(),
          fecha_actividad: new Date(fechaActividad).toISOString(),
          horas_trabajadas:
            horasNum != null && !Number.isNaN(horasNum) ? horasNum : undefined,
          comentarios: comentarios.trim() || undefined,
          area_id: areaId,
          flujo_trabajo_id: flujoTrabajoId,
        });
        swalSuccess("Actividad registrada en la bitácora");
      }
      setDescripcion("");
      setHoras("");
      setComentarios("");
      setFechaActividad(new Date().toISOString().slice(0, 16));
      setEditingActividad(null);
      setShowFormModal(false);
      onRefresh();
    } catch (error: any) {
      console.error("Error al crear actividad de bitácora:", error);
      swalError(
        error?.response?.data?.detail ||
          "Error al crear la actividad de bitácora",
      );
    } finally {
      setSaving(false);
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
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => {
              setEditingActividad(null);
              setDescripcion("");
              setHoras("");
              setComentarios("");
              setFechaActividad(new Date().toISOString().slice(0, 16));
              setShowFormModal(true);
            }}
          >
            Agregar actividad
          </Button>
        </div>
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <FiClock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            No hay actividades registradas
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Las actividades de bitácora aparecerán aquí
          </p>
        </div>
        {/* Modal para nueva actividad */}
        <Modal
          open={showFormModal}
          onClose={() => setShowFormModal(false)}
          title="Registrar actividad en bitácora"
          maxWidthClass="max-w-lg"
        >
          <div className="space-y-4">
            <form onSubmit={handleCreateActividad} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha y hora
                </label>
                <input
                  type="datetime-local"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                  value={fechaActividad}
                  onChange={(e) => setFechaActividad(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción *
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Describe brevemente la actividad realizada"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Horas trabajadas
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                    value={horas}
                    onChange={(e) => setHoras(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Comentarios
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                    value={comentarios}
                    onChange={(e) => setComentarios(e.target.value)}
                    placeholder="Notas adicionales (opcional)"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowFormModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  disabled={saving}
                >
                  {saving ? "Guardando..." : "Guardar actividad"}
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-800">
          Actividades registradas
        </h3>
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={() => {
            setEditingActividad(null);
            setDescripcion("");
            setHoras("");
            setComentarios("");
            setFechaActividad(new Date().toISOString().slice(0, 16));
            setShowFormModal(true);
          }}
        >
          Agregar actividad
        </Button>
      </div>

      <DataTable
        layoutStorageKey="aslin-datatable-siniestro-bitacora-actividades"
        columns={[
          {
            id: "tipo_actividad",
            header: "Tipo",
            accessorKey: "tipo_actividad",
            cell: ({ row }: any) => {
              const tipo = row.original.tipo_actividad as string;
              return (
                <span
                  className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${getTipoActividadColor(
                    tipo,
                  )}`}
                >
                  {getTipoActividadIcon(tipo)}
                  <span className="ml-1 capitalize">{tipo}</span>
                </span>
              );
            },
          },
          {
            id: "descripcion",
            header: "Descripción",
            accessorKey: "descripcion",
            cell: ({ row }: any) => (
              <div className="flex flex-col">
                <span className="text-sm text-gray-900">
                  {row.original.descripcion}
                </span>
                {row.original.comentarios && (
                  <span className="text-xs text-gray-500 mt-0.5 italic">
                    {row.original.comentarios}
                  </span>
                )}
              </div>
            ),
          },
          {
            id: "fecha_actividad",
            header: "Fecha actividad",
            accessorKey: "fecha_actividad",
            cell: ({ row }: any) => (
              <span className="text-xs text-gray-700">
                {new Date(row.original.fecha_actividad).toLocaleDateString(
                  "es-MX",
                  {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )}
              </span>
            ),
          },
          {
            id: "creado_en",
            header: "Registrado",
            accessorKey: "creado_en",
            cell: ({ row }: any) => (
              <span className="text-xs text-gray-500">
                {new Date(row.original.creado_en).toLocaleDateString("es-MX")}
              </span>
            ),
          },
          {
            id: "horas_trabajadas",
            header: "Horas",
            accessorKey: "horas_trabajadas",
            cell: ({ row }: any) =>
              row.original.horas_trabajadas > 0 ? (
                <span className="text-xs text-gray-700">
                  {row.original.horas_trabajadas} hrs
                </span>
              ) : (
                <span className="text-xs text-gray-400">-</span>
              ),
          },
          {
            id: "verificado",
            header: "Verificada",
            accessorKey: "verificado",
            cell: ({ row }: any) =>
              row.original.verificado ? (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 border border-green-200">
                  Sí
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
                  No
                </span>
              ),
          },
          {
            id: "acciones",
            header: "Acciones",
            cell: ({ row }: any) => {
              const actividad = row.original as BitacoraActividad;
              const puedeEditar = !actividad.verificado;
              return (
                <div className="flex items-center gap-2">
                  {!actividad.verificado && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await apiService.updateBitacoraActividad(
                            actividad.id,
                            { verificado: true } as any,
                          );
                          swalSuccess("Actividad marcada como verificada");
                          onRefresh();
                        } catch (error: any) {
                          // console.error("Error al verificar actividad:", error);
                          swalError(
                            error?.response?.data?.detail ||
                              "Error al marcar como verificada",
                          );
                        }
                      }}
                    >
                      Verificar
                    </Button>
                  )}
                  {puedeEditar && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditingActividad(actividad);
                        setDescripcion(actividad.descripcion);
                        setHoras(
                          actividad.horas_trabajadas
                            ? String(actividad.horas_trabajadas)
                            : "",
                        );
                        setComentarios(actividad.comentarios || "");
                        setFechaActividad(
                          actividad.fecha_actividad.slice(0, 16),
                        );
                        setShowFormModal(true);
                      }}
                    >
                      Editar
                    </Button>
                  )}
                </div>
              );
            },
          },
        ]}
        data={bitacoras}
        emptyText="No hay actividades registradas"
        enableSearch={true}
        searchPlaceholder="Buscar en descripción o comentarios..."
        enablePagination={true}
        enableSorting={true}
        pageSize={10}
        size="default"
        maxTextLength={80}
      />

      {/* Modal para nueva actividad */}
      <Modal
        open={showFormModal}
        onClose={() => setShowFormModal(false)}
        title="Registrar actividad en bitácora"
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-4">
          <form onSubmit={handleCreateActividad} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha y hora
              </label>
              <input
                type="datetime-local"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                value={fechaActividad}
                onChange={(e) => setFechaActividad(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción *
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Describe brevemente la actividad realizada"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Horas trabajadas
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                  value={horas}
                  onChange={(e) => setHoras(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comentarios
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                  value={comentarios}
                  onChange={(e) => setComentarios(e.target.value)}
                  placeholder="Notas adicionales (opcional)"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowFormModal(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                variant="primary"
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar actividad"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
