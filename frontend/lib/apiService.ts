/**
 * Servicio de API
 * Maneja todas las llamadas al backend
 */

import axios from "axios";
import { getApiErrorMessage } from "./parseApiError";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_URL) {
  throw new Error(
    "Falta NEXT_PUBLIC_API_URL. Configura esta variable de entorno para conectar al backend.",
  );
}

/** Desenvuelve respuesta JSON homologada `{ success, data, trace_id, meta }` desde `/api/v1`. */
export function unwrapApiResponseData<T>(raw: unknown): T {
  if (
    raw &&
    typeof raw === "object" &&
    (raw as { success?: boolean }).success === true &&
    "data" in (raw as object)
  ) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

// Crear instancia de axios con configuración base
const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Gestión centralizada de expiración de sesión para:
// 1) evitar que el resto de la app redirija a /login inmediatamente
// 2) pausar requests hasta que el usuario confirme el modal
let sessionRenewalPromise: Promise<boolean> | null = null;
let sessionRenewalResolver: ((renew: boolean) => void) | null = null;

function notifySessionRenewalNeeded(): Promise<boolean> {
  if (sessionRenewalPromise) return sessionRenewalPromise;
  sessionRenewalPromise = new Promise<boolean>((resolve) => {
    sessionRenewalResolver = resolve;
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("sessionRenewalNeeded"));
  }
  return sessionRenewalPromise;
}

function resolveSessionRenewal(renew: boolean) {
  if (sessionRenewalResolver) {
    sessionRenewalResolver(renew);
  }
  sessionRenewalPromise = null;
  sessionRenewalResolver = null;
}

// Interceptor para agregar token a las peticiones
api.interceptors.request.use(
  (config) => {
    // Normalizar: espacios / cadena vacía no deben ir como "Bearer " (el backend
    // trata distinto 401 de auth y 403 de permisos; un token inválido evita
    // respuestas confusas y condiciones de carrera en el primer request).
    const raw = localStorage.getItem("token");
    const token = raw && String(raw).trim() ? String(raw).trim() : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor de éxito: desenvuelve envelope { success, data, trace_id, meta }
api.interceptors.response.use(
  (response) => {
    const d = response.data;
    if (
      d &&
      typeof d === "object" &&
      (d as { success?: boolean }).success === true &&
      "data" in d
    ) {
      const env = d as { data: unknown; trace_id?: string; meta?: unknown };
      (response as { envelope?: { trace_id?: string; meta?: unknown } }).envelope = {
        trace_id: env.trace_id,
        meta: env.meta,
      };
      response.data = env.data;
    }
    return response;
  },
  async (error) => {
    const status = error.response?.status;
    const url: string = error.config?.url || "";
    const isAuthRoute =
      url.includes("/users/login") ||
      url.includes("/users/register") ||
      url.includes("/users/2fa/verify") ||
      url.includes("/users/refresh") ||
      url.includes("/users/logout") ||
      url.includes("/users/impersonate/accept");

    // Homologar: siempre dejar response.data.detail como string legible para el usuario
    const data = error.response?.data;
    if (data) {
      const message = getApiErrorMessage(data, "Ha ocurrido un error. Intente de nuevo.");
      error.response.data.detail = message;
    }

    // Si el access token expiró, mostramos modal y pausamos requests hasta decisión del usuario
    if (status === 401) {
      const t0 = localStorage.getItem("token");
      const hadToken = !!(t0 && String(t0).trim());
      if (hadToken && !isAuthRoute) {
        const originalConfig = error.config;
        if (originalConfig && !(originalConfig as any).__sessionRenewalRetried) {
          (originalConfig as any).__sessionRenewalRetried = true;
          const shouldRenew = await notifySessionRenewalNeeded();
          if (!shouldRenew) return Promise.reject(error);

          // Reintentar con el nuevo token (modal ya lo actualizó)
          const rawT = localStorage.getItem("token");
          const token = rawT && String(rawT).trim() ? String(rawT).trim() : null;
          if (token) {
            originalConfig.headers = originalConfig.headers || {};
            originalConfig.headers.Authorization = `Bearer ${token}`;
          }
          return api.request(originalConfig);
        }

        // Si ya se intentó reintentar o no hay config, no bloqueamos más
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

const triggerDownloadFromAccess = async (access: any, preferredFilename?: string) => {
  const provider = String(access?.provider || "").toLowerCase();
  const finalFilename = preferredFilename || access?.filename || "archivo";
  if (!access?.url) {
    throw new Error("La respuesta de descarga no incluye una URL válida");
  }

  if (provider === "r2" && access?.url) {
    const link = document.createElement("a");
    link.href = access.url;
    link.download = finalFilename;
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return access;
  }

  const response = await api.get(access?.url, {
    responseType: "blob",
  });
  const blob = response.data as Blob;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = finalFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
  return access;
};

// Servicios de autenticación
const authService = {
  login: async (username: string, password: string, recaptchaToken?: string) => {
    const response = await api.post("/users/login", { 
      username, 
      password,
      recaptcha_token: recaptchaToken || null
    });
    return response.data;
  },
  verify2FA: async (temp_token: string, code: string) => {
    const response = await api.post("/users/2fa/verify", { temp_token, code });
    return response.data;
  },

  register: async (userData: {
    email: string;
    username?: string;
    password: string;
    nombre?: string;
    apellido_paterno?: string;
    apellido_materno?: string;
    full_name?: string;
  }) => {
    const response = await api.post("/users/register", userData);
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get("/users/me");
    return response.data;
  },
  updateMe: async (data: any) => {
    const response = await api.put("/users/me", data);
    return response.data;
  },
  changePassword: async (current_password: string, new_password: string) => {
    const response = await api.put("/users/me/password", { current_password, new_password });
    return response.data;
  },
  toggle2FA: async (enable: boolean, code?: string) => {
    const response = await api.post("/users/me/2fa/toggle", { enable, code });
    return response.data;
  },
  getOtpAuthUrl: async () => {
    const response = await api.get("/users/me/2fa/otpauth");
    return response.data;
  },
  setActiveEmpresa: async (empresaId: string) => {
    const response = await api.post("/users/me/empresa", { empresa_id: empresaId });
    return response.data;
  },

  refreshSession: async () => {
    const response = await api.post("/users/refresh", null);
    return response.data; // { access_token, token_type }
  },

  logout: async () => {
    const response = await api.post("/users/logout", null);
    return response.data;
  },

  /** Solo nivel 0: obtiene token de un paso para canjear sesión como otro usuario */
  requestImpersonationToken: async (userId: string) => {
    const response = await api.post(`/users/${userId}/impersonate`);
    return response.data as { impersonation_token: string; expires_in_minutes: number };
  },

  /** Canjea token (sin Authorization; usa cookie refresh al aceptar) */
  acceptImpersonation: async (impersonationToken: string) => {
    const response = await axios.post(
      `${API_URL}/api/v1/users/impersonate/accept`,
      { token: impersonationToken },
      { withCredentials: true, headers: { "Content-Type": "application/json" } }
    );
    return unwrapApiResponseData<{ access_token: string; token_type: string }>(
      response.data
    );
  },
};

// Servicios de usuarios
const userService = {
  getUsers: async (skip = 0, limit = 100) => {
    const response = await api.get(`/users?skip=${skip}&limit=${limit}`);
    return response.data;
  },
  getUserById: async (userId: string) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },
  registerUser: async (data: {
    email: string;
    username?: string;
    password: string;
    nombre?: string;
    apellido_paterno?: string;
    apellido_materno?: string;
    full_name?: string;
    empresa_id?: string;
    empresa_ids?: string[];
    rol_id?: string;
    is_active?: boolean;
  }) => {
    const response = await api.post("/users/register", data);
    return response.data;
  },
  updateUser: async (userId: string, data: {
    email?: string;
    username?: string;
    full_name?: string;
    nombre?: string;
    apellido_paterno?: string;
    apellido_materno?: string;
    empresa_id?: string;
    empresa_ids?: string[];
    rol_id?: string;
    area_ids?: string[];
    is_active?: boolean;
    two_factor_enabled?: boolean;
    password?: string;
    perfil?: {
      nombre?: string;
      apellido_paterno?: string;
      apellido_materno?: string;
      titulo?: string;
      cedula_profesional?: string;
    };
    contactos?: {
      telefono?: string;
      celular?: string;
    };
    direccion?: {
      direccion?: string;
      ciudad?: string;
      estado?: string;
      codigo_postal?: string;
      pais?: string;
    };
  }) => {
    const response = await api.put(`/users/${userId}`, data);
    return response.data;
  },
  deleteUser: async (userId: string) => {
    const response = await api.delete(`/users/${userId}`);
    return response.data;
  },
  /** Solo nivel 0/1: otpauth del usuario indicado (mismo criterio que firmas en edición de usuario). */
  getUserOtpAuthUrl: async (userId: string) => {
    const response = await api.get(`/users/${userId}/2fa/otpauth`);
    return response.data as { otpauth_url: string };
  },
  toggleUser2FA: async (userId: string, enable: boolean, code?: string) => {
    const response = await api.post(`/users/${userId}/2fa/toggle`, { enable, code });
    return response.data;
  },
  inviteUserCredential: async (userId: string) => {
    const response = await api.post(`/users/${userId}/invitar-credencial`);
    return response.data;
  },
  generateUserPasswordSuperadmin: async (userId: string) => {
    const response = await api.post<{
      success: boolean;
      detail: string;
      password_plain: string;
    }>(`/users/${userId}/generar-password`);
    return response.data;
  },
  exportInvitacionesCredenciales: async (params?: { desde?: string; hasta?: string }) => {
    const qs = new URLSearchParams();
    if (params?.desde) qs.set("desde", params.desde);
    if (params?.hasta) qs.set("hasta", params.hasta);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const response = await api.get(`/users/invitaciones-credenciales/export.csv${suffix}`, {
      responseType: "blob",
    });
    const blob = new Blob([response.data], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invitaciones_credenciales.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },
  exportCredencialesDefinitivasUsuarios: async () => {
    const response = await api.get("/users/credenciales-definitivas/export.xlsx", {
      responseType: "blob",
    });
    const blob = new Blob([response.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "usuarios_credenciales_definitivas.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },
};

// Servicios de roles
const rolService = {
  getRoles: async (activo?: boolean) => {
    const params = activo !== undefined ? `?activo=${activo}` : "";
    const response = await api.get(`/roles${params}`);
    return response.data;
  },
  getRolById: async (rolId: string) => {
    const response = await api.get(`/roles/${rolId}`);
    return response.data;
  },
  createRol: async (data: {
    nombre: string;
    descripcion?: string;
    nivel?: number;
    activo?: boolean;
  }) => {
    const response = await api.post("/roles", data);
    return response.data;
  },
  updateRol: async (rolId: string, data: {
    nombre?: string;
    descripcion?: string;
    nivel?: number;
    activo?: boolean;
  }) => {
    const response = await api.put(`/roles/${rolId}`, data);
    return response.data;
  },
  deleteRol: async (rolId: string) => {
    const response = await api.delete(`/roles/${rolId}`);
    return response.data;
  },
};

// Servicios de permisos
const permisoService = {
  /** Permisos del usuario actual (según su rol). También vienen en getCurrentUser().permisos */
  getMisPermisos: async (): Promise<{ modulo: string; accion: string }[]> => {
    const response = await api.get("/permisos/mis-permisos");
    return response.data;
  },
  getModulos: async (activo?: boolean) => {
    const params = activo !== undefined ? `?activo=${activo}` : "";
    const response = await api.get(`/permisos/modulos${params}`);
    return response.data;
  },
  createModulo: async (data: {
    nombre: string;
    nombre_tecnico: string;
    descripcion?: string;
    icono?: string;
    ruta?: string;
    orden?: number;
    activo?: boolean;
  }) => {
    const response = await api.post("/permisos/modulos", data);
    return response.data;
  },
  getAcciones: async (activo?: boolean) => {
    const params = activo !== undefined ? `?activo=${activo}` : "";
    const response = await api.get(`/permisos/acciones${params}`);
    return response.data;
  },
  createAccion: async (data: {
    modulo_id: string;
    nombre: string;
    nombre_tecnico: string;
    descripcion?: string;
    activo?: boolean;
  }) => {
    const response = await api.post("/permisos/acciones", data);
    return response.data;
  },
  getAccionesPorModulo: async (moduloId: string, activo?: boolean) => {
    const params = activo !== undefined ? `?activo=${activo}` : "";
    const response = await api.get(`/permisos/modulos/${moduloId}/acciones${params}`);
    return response.data;
  },
  asignarAccionModulo: async (rolId: string, moduloId: string, accionId: string) => {
    const response = await api.post(`/permisos/roles/${rolId}/modulos/${moduloId}/acciones/${accionId}`);
    return response.data;
  },
  desasignarAccionModulo: async (rolId: string, moduloId: string, accionId: string) => {
    const response = await api.delete(`/permisos/roles/${rolId}/modulos/${moduloId}/acciones/${accionId}`);
    return response.data;
  },
  getPermisosRol: async (rolId: string, activo?: boolean) => {
    const params = activo !== undefined ? `?activo=${activo}` : "";
    const response = await api.get(`/permisos/roles/${rolId}/permisos${params}`);
    return response.data;
  },
  getConfiguracionPermisos: async (rolId: string) => {
    const response = await api.get(`/permisos/roles/${rolId}/permisos/config`);
    return response.data;
  },
  actualizarPermisosBulk: async (rolId: string, permisos: any[], eliminarOtros: boolean = false) => {
    const response = await api.put(`/permisos/roles/${rolId}/permisos/bulk`, {
      permisos,
      eliminar_otros: eliminarOtros,
    });
    return response.data;
  },
  createPermiso: async (rolId: string, data: { modulo_id: string; accion_id: string; activo?: boolean }) => {
    const response = await api.post(`/permisos/roles/${rolId}/permisos`, {
      rol_id: rolId,
      ...data,
    });
    return response.data;
  },
  updatePermiso: async (permisoId: string, data: { activo?: boolean }) => {
    const response = await api.put(`/permisos/permisos/${permisoId}`, data);
    return response.data;
  },
  deletePermiso: async (permisoId: string) => {
    const response = await api.delete(`/permisos/permisos/${permisoId}`);
    return response.data;
  },
};

// Servicios de empresas
const empresaService = {
  getEmpresas: async (activo?: boolean) => {
    const params = activo !== undefined ? `?activo=${activo}` : "";
    const response = await api.get(`/empresas${params}`);
    return response.data;
  },
  getEmpresaById: async (empresaId: string) => {
    const response = await api.get(`/empresas/${empresaId}`);
    return response.data;
  },
  updateEmpresa: async (empresaId: string, data: any) => {
    const response = await api.put(`/empresas/${empresaId}`, data);
    return response.data;
  },
  createEmpresa: async (data: any) => {
    const response = await api.post(`/empresas`, data);
    return response.data;
  },
  deleteEmpresa: async (empresaId: string) => {
    const response = await api.delete(`/empresas/${empresaId}`);
    return response.data;
  },
};

// Servicios de flujos de trabajo
const flujoTrabajoService = {
  // Flujos
  getFlujos: async (areaId?: string, activo?: boolean) => {
    const params = new URLSearchParams();
    if (areaId) params.append("area_id", areaId);
    if (activo !== undefined) params.append("activo", activo.toString());
    const response = await api.get(`/flujos-trabajo?${params.toString()}`);
    return response.data;
  },

  getFlujoPredeterminado: async (areaId?: string) => {
    const params = areaId ? `?area_id=${areaId}` : "";
    const response = await api.get(`/flujos-trabajo/predeterminado${params}`);
    return response.data;
  },

  getFlujoById: async (flujoId: string) => {
    const response = await api.get(`/flujos-trabajo/${flujoId}`);
    return response.data;
  },

  createFlujo: async (data: {
    nombre: string;
    descripcion?: string;
    area_id?: string;
    activo?: boolean;
    es_predeterminado?: boolean;
  }) => {
    const response = await api.post("/flujos-trabajo", data);
    return response.data;
  },

  updateFlujo: async (flujoId: string, data: {
    nombre?: string;
    descripcion?: string;
    area_id?: string;
    activo?: boolean;
    es_predeterminado?: boolean;
  }) => {
    const response = await api.put(`/flujos-trabajo/${flujoId}`, data);
    return response.data;
  },

  deleteFlujo: async (flujoId: string) => {
    const response = await api.delete(`/flujos-trabajo/${flujoId}`);
    return response.data;
  },

  // Etapas
  getEtapasByFlujo: async (flujoId: string, activo?: boolean) => {
    const params = activo !== undefined ? `?activo=${activo}` : "";
    const response = await api.get(`/flujos-trabajo/${flujoId}/etapas${params}`);
    return response.data;
  },

  createEtapa: async (flujoId: string, data: {
    nombre: string;
    descripcion?: string;
    orden: number;
    es_obligatoria?: boolean;
    permite_omision?: boolean;
    tipo_documento_principal_id?: string;
    inhabilita_siguiente?: boolean;
    activo?: boolean;
  }) => {
    const response = await api.post(`/flujos-trabajo/${flujoId}/etapas`, data);
    return response.data;
  },

  updateEtapa: async (etapaId: string, data: {
    nombre?: string;
    descripcion?: string;
    orden?: number;
    es_obligatoria?: boolean;
    permite_omision?: boolean;
    tipo_documento_principal_id?: string;
    inhabilita_siguiente?: boolean;
    activo?: boolean;
  }) => {
    const response = await api.put(`/flujos-trabajo/etapas/${etapaId}`, data);
    return response.data;
  },

  deleteEtapa: async (flujoId: string, etapaId: string) => {
    const response = await api.delete(`/flujos-trabajo/${flujoId}/etapas/${etapaId}`);
    return response.data;
  },

  reordenarEtapas: async (flujoId: string, ordenes: Array<{ etapa_id: string; orden: number }>) => {
    const response = await api.post(`/flujos-trabajo/${flujoId}/etapas/reordenar`, ordenes);
    return response.data;
  },

  // Siniestro Etapas
  inicializarEtapasSiniestro: async (siniestroId: string, flujoTrabajoId?: string) => {
    const response = await api.post(`/flujos-trabajo/siniestros/${siniestroId}/inicializar`, {
      flujo_trabajo_id: flujoTrabajoId || null,
    });
    return response.data;
  },

  getEtapasSiniestro: async (siniestroId: string) => {
    const response = await api.get(`/flujos-trabajo/siniestros/${siniestroId}/etapas`);
    return response.data;
  },

  completarEtapa: async (
    siniestroId: string,
    etapaFlujoId: string,
    data: {
      documento_principal_id?: string;
      observaciones?: string;
    }
  ) => {
    const response = await api.post(
      `/flujos-trabajo/siniestros/${siniestroId}/etapas/${etapaFlujoId}/completar`,
      data
    );
    return response.data;
  },

  avanzarEtapa: async (siniestroId: string) => {
    const response = await api.post(`/flujos-trabajo/siniestros/${siniestroId}/avanzar`, {});
    return response.data;
  },

  // Requisitos documentales por etapa
  getRequisitosEtapa: async (flujoId: string, etapaId: string, soloActivos = true) => {
    const response = await api.get(
      `/flujos-trabajo/${flujoId}/etapas/${etapaId}/requisitos?solo_activos=${soloActivos}`
    );
    return response.data;
  },

  createRequisito: async (flujoId: string, etapaId: string, data: {
    nombre_documento: string;
    descripcion?: string | null;
    tipo_documento_id?: string | null;
    categoria_documento_id?: string | null;
    plantilla_documento_id?: string | null;
    es_obligatorio?: boolean;
    permite_upload?: boolean;
    permite_generar?: boolean;
    multiple?: boolean;
    orden?: number;
    clave?: string | null;
    activo?: boolean;
  }) => {
    const response = await api.post(
      `/flujos-trabajo/${flujoId}/etapas/${etapaId}/requisitos`,
      data
    );
    return response.data;
  },

  updateRequisito: async (reqId: string, data: {
    nombre_documento?: string;
    descripcion?: string | null;
    tipo_documento_id?: string | null;
    categoria_documento_id?: string | null;
    plantilla_documento_id?: string | null;
    es_obligatorio?: boolean;
    permite_upload?: boolean;
    permite_generar?: boolean;
    multiple?: boolean;
    orden?: number;
    clave?: string | null;
    activo?: boolean;
  }) => {
    const response = await api.put(`/flujos-trabajo/etapas/requisitos/${reqId}`, data);
    return response.data;
  },

  deleteRequisito: async (reqId: string) => {
    await api.delete(`/flujos-trabajo/etapas/requisitos/${reqId}`);
  },

  getChecklistEtapa: async (siniestroId: string, etapaId: string) => {
    const response = await api.get(
      `/flujos-trabajo/siniestros/${siniestroId}/etapas/${etapaId}/checklist`
    );
    return response.data;
  },
};

// Servicios de catálogos legales
const catalogService = {
  // Áreas
  getAreas: async (activo?: boolean) => {
    const params = activo !== undefined ? `?activo=${activo}` : "";
    const res = await api.get(`/catalogos/areas${params}`);
    return res.data;
  },
  createArea: async (data: { nombre: string; descripcion?: string; codigo?: string; activo?: boolean; usuario_id?: string | null }) => {
    const res = await api.post(`/catalogos/areas`, data);
    return res.data;
  },
  updateArea: async (areaId: string, data: { nombre?: string; descripcion?: string; codigo?: string; activo?: boolean; usuario_id?: string | null }) => {
    const res = await api.put(`/catalogos/areas/${areaId}`, data);
    return res.data;
  },
  deleteArea: async (areaId: string) => {
    const res = await api.delete(`/catalogos/areas/${areaId}`);
    return res.data;
  },

  // Tipos de Institución
  getTiposInstitucion: async (activo?: boolean) => {
    const params = activo !== undefined ? `?activo=${activo}` : "";
    const res = await api.get(`/catalogos/tipos-institucion${params}`);
    return res.data;
  },
  createTipoInstitucion: async (data: { nombre: string; descripcion?: string; activo?: boolean }) => {
    const res = await api.post(`/catalogos/tipos-institucion`, data);
    return res.data;
  },
  updateTipoInstitucion: async (id: string, data: { nombre?: string; descripcion?: string; activo?: boolean }) => {
    const res = await api.put(`/catalogos/tipos-institucion/${id}`, data);
    return res.data;
  },
  deleteTipoInstitucion: async (id: string) => {
    const res = await api.delete(`/catalogos/tipos-institucion/${id}`);
    return res.data;
  },

  // Estados de Siniestro
  getEstadosSiniestro: async (activo?: boolean) => {
    const params = activo !== undefined ? `?activo=${activo}` : "";
    const res = await api.get(`/catalogos/estados-siniestro${params}`);
    return res.data;
  },
  createEstadoSiniestro: async (data: { nombre: string; descripcion?: string; color?: string; orden?: number; activo?: boolean }) => {
    const res = await api.post(`/catalogos/estados-siniestro`, data);
    return res.data;
  },
  updateEstadoSiniestro: async (id: string, data: { nombre?: string; descripcion?: string; color?: string; orden?: number; activo?: boolean }) => {
    const res = await api.put(`/catalogos/estados-siniestro/${id}`, data);
    return res.data;
  },
  deleteEstadoSiniestro: async (id: string) => {
    const res = await api.delete(`/catalogos/estados-siniestro/${id}`);
    return res.data;
  },

  // Calificaciones de Siniestro
  getCalificacionesSiniestro: async (activo?: boolean) => {
    const params = activo !== undefined ? `?activo=${activo}` : "";
    const res = await api.get(`/catalogos/calificaciones-siniestro${params}`);
    return res.data;
  },
  createCalificacionSiniestro: async (data: { nombre: string; descripcion?: string; color?: string; orden?: number; activo?: boolean }) => {
    const res = await api.post(`/catalogos/calificaciones-siniestro`, data);
    return res.data;
  },
  updateCalificacionSiniestro: async (id: string, data: { nombre?: string; descripcion?: string; color?: string; orden?: number; activo?: boolean }) => {
    const res = await api.put(`/catalogos/calificaciones-siniestro/${id}`, data);
    return res.data;
  },
  deleteCalificacionSiniestro: async (id: string) => {
    const res = await api.delete(`/catalogos/calificaciones-siniestro/${id}`);
    return res.data;
  },

  // Instituciones
  getInstituciones: async (activo?: boolean) => {
    const params = activo !== undefined ? `?activo=${activo}` : "";
    const res = await api.get(`/catalogos/instituciones${params}`);
    return res.data;
  },
  createInstitucion: async (data: any) => {
    const res = await api.post(`/catalogos/instituciones`, data);
    return res.data;
  },
  updateInstitucion: async (id: string, data: any) => {
    const res = await api.put(`/catalogos/instituciones/${id}`, data);
    return res.data;
  },
  deleteInstitucion: async (id: string) => {
    const res = await api.delete(`/catalogos/instituciones/${id}`);
    return res.data;
  },

  // Autoridades
  getAutoridades: async (activo?: boolean) => {
    const params = activo !== undefined ? `?activo=${activo}` : "";
    const res = await api.get(`/catalogos/autoridades${params}`);
    return res.data;
  },
  createAutoridad: async (data: any) => {
    const res = await api.post(`/catalogos/autoridades`, data);
    return res.data;
  },
  updateAutoridad: async (id: string, data: any) => {
    const res = await api.put(`/catalogos/autoridades/${id}`, data);
    return res.data;
  },
  deleteAutoridad: async (id: string) => {
    const res = await api.delete(`/catalogos/autoridades/${id}`);
    return res.data;
  },

  // Templates CSV
  downloadTemplateCSV: async (tipo: "instituciones" | "autoridades" | "provenientes" | "entidades") => {
    const res = await api.get(`/catalogos/${tipo}/template-csv`, {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `template_${tipo}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Importar CSV
  importarCSV: async (tipo: "instituciones" | "autoridades" | "provenientes" | "entidades", file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post(`/catalogos/${tipo}/importar-csv`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },

  // Entidades (unificadas)
  getEntidades: async (activo?: boolean, esInstitucion?: boolean, esAutoridad?: boolean, esOrgano?: boolean) => {
    const params = new URLSearchParams();
    if (activo !== undefined) params.append("activo", String(activo));
    if (esInstitucion !== undefined) params.append("es_institucion", String(esInstitucion));
    if (esAutoridad !== undefined) params.append("es_autoridad", String(esAutoridad));
    if (esOrgano !== undefined) params.append("es_organo", String(esOrgano));
    const res = await api.get(`/catalogos/entidades?${params.toString()}`);
    return res.data;
  },
  createEntidad: async (data: any) => {
    const res = await api.post(`/catalogos/entidades`, data);
    return res.data;
  },
  updateEntidad: async (id: string, data: any) => {
    const res = await api.put(`/catalogos/entidades/${id}`, data);
    return res.data;
  },
  deleteEntidad: async (id: string) => {
    const res = await api.delete(`/catalogos/entidades/${id}`);
    return res.data;
  },

  // Asegurados
  getAsegurados: async (activo?: boolean) => {
    const params = activo !== undefined ? `?activo=${activo}` : "";
    const res = await api.get(`/catalogos/asegurados${params}`);
    return res.data;
  },
  getAseguradoById: async (id: string) => {
    const res = await api.get(`/catalogos/asegurados/${id}`);
    return res.data;
  },
  createAsegurado: async (data: any) => {
    const res = await api.post(`/catalogos/asegurados`, data);
    return res.data;
  },
  updateAsegurado: async (id: string, data: any) => {
    const res = await api.put(`/catalogos/asegurados/${id}`, data);
    return res.data;
  },
  deleteAsegurado: async (id: string) => {
    const res = await api.delete(`/catalogos/asegurados/${id}`);
    return res.data;
  },

  // Provenientes
  getProvenientes: async (activo?: boolean) => {
    const params = activo !== undefined ? `?activo=${activo}` : "";
    const res = await api.get(`/catalogos/provenientes${params}`);
    return res.data;
  },
  createProveniente: async (data: any) => {
    const res = await api.post(`/catalogos/provenientes`, data);
    return res.data;
  },
  updateProveniente: async (id: string, data: any) => {
    const res = await api.put(`/catalogos/provenientes/${id}`, data);
    return res.data;
  },
  deleteProveniente: async (id: string) => {
    const res = await api.delete(`/catalogos/provenientes/${id}`);
    return res.data;
  },
  getProvenienteContactos: async (provenienteId: string) => {
    const res = await api.get(`/catalogos/provenientes/${provenienteId}/contactos`);
    return res.data;
  },
  createProvenienteContacto: async (
    provenienteId: string,
    data: { nombre: string; correo: string; activo?: boolean },
  ) => {
    const res = await api.post(`/catalogos/provenientes/${provenienteId}/contactos`, data);
    return res.data;
  },
  deleteProvenienteContacto: async (provenienteId: string, contactoId: string) => {
    const res = await api.delete(`/catalogos/provenientes/${provenienteId}/contactos/${contactoId}`);
    return res.data;
  },

  // Plantillas de Documento (legacy - tipos de documento)
  getPlantillas: async (activo?: boolean, areaId?: string) => {
    const params = new URLSearchParams();
    if (activo !== undefined) params.append("activo", String(activo));
    if (areaId) params.append("area_id", areaId);
    const res = await api.get(`/catalogos/tipos-documento?${params.toString()}`);
    return res.data;
  },
  createPlantilla: async (data: any) => {
    const res = await api.post(`/catalogos/tipos-documento`, data);
    return res.data;
  },
  updatePlantilla: async (id: string, data: any) => {
    const res = await api.put(`/catalogos/tipos-documento/${id}`, data);
    return res.data;
  },
  deletePlantilla: async (id: string) => {
    const res = await api.delete(`/catalogos/tipos-documento/${id}`);
    return res.data;
  },

  // Categorías de Documento
  getCategoriasDocumento: async (tipoDocumentoId?: string, activo?: boolean) => {
    const params = new URLSearchParams();
    if (tipoDocumentoId) params.append("tipo_documento_id", tipoDocumentoId);
    if (activo !== undefined) params.append("activo", String(activo));
    const res = await api.get(`/catalogos/categorias-documento?${params.toString()}`);
    return res.data;
  },
  createCategoriaDocumento: async (data: any) => {
    const res = await api.post(`/catalogos/categorias-documento`, data);
    return res.data;
  },
  updateCategoriaDocumento: async (id: string, data: any) => {
    const res = await api.put(`/catalogos/categorias-documento/${id}`, data);
    return res.data;
  },
  deleteCategoriaDocumento: async (id: string) => {
    const res = await api.delete(`/catalogos/categorias-documento/${id}`);
    return res.data;
  },

  // Plantillas de Documento (nuevo sistema)
  getPlantillasDocumento: async (tipoDocumentoId?: string, categoriaId?: string, activo?: boolean) => {
    const params = new URLSearchParams();
    if (tipoDocumentoId) params.append("tipo_documento_id", tipoDocumentoId);
    if (categoriaId) params.append("categoria_id", categoriaId);
    if (activo !== undefined) params.append("activo", String(activo));
    const res = await api.get(`/catalogos/plantillas-documento?${params.toString()}`);
    return res.data;
  },
  getPlantillaDocumentoById: async (id: string) => {
    const res = await api.get(`/catalogos/plantillas-documento/${id}`);
    return res.data;
  },
  createPlantillaDocumento: async (data: any) => {
    const res = await api.post(`/catalogos/plantillas-documento`, data);
    return res.data;
  },
  updatePlantillaDocumento: async (id: string, data: any) => {
    const res = await api.put(`/catalogos/plantillas-documento/${id}`, data);
    return res.data;
  },
  deletePlantillaDocumento: async (id: string) => {
    const res = await api.delete(`/catalogos/plantillas-documento/${id}`);
    return res.data;
  },

  // ─── Respuestas de formulario personalizado ───────────────────────────────
  getRespuestaFormulario: async (plantillaId: string, siniestroId: string, areaId?: string) => {
    const params = new URLSearchParams();
    if (areaId) params.set("area_id", areaId);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const res = await api.get(
      `/catalogos/plantillas-documento/${plantillaId}/respuesta/${siniestroId}${suffix}`
    );
    return res.data;
  },

  upsertRespuestaFormulario: async (
    plantillaId: string,
    siniestroId: string,
    valores: Record<string, any>,
    areaId?: string,
  ) => {
    const params = new URLSearchParams();
    if (areaId) params.set("area_id", areaId);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const res = await api.put(
      `/catalogos/plantillas-documento/${plantillaId}/respuesta/${siniestroId}${suffix}`,
      { valores }
    );
    return res.data;
  },

  getRespuestasByPosSiniestro: async (siniestroId: string, areaId?: string) => {
    const params = new URLSearchParams();
    if (areaId) params.set("area_id", areaId);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const res = await api.get(`/catalogos/respuestas-formulario/siniestro/${siniestroId}${suffix}`);
    return res.data;
  },
};

// Servicios de siniestros
const siniestroService = {
  getSiniestros: async (filters?: {
    activo?: boolean;
    /** Si true, el backend no filtra por activo/inactivo (listado “Todos”, búsqueda navbar, etc.). */
    sin_filtrar_activo?: boolean;
    estado_id?: string;
    proveniente_id?: string;
    area_id?: string;
    usuario_asignado?: string;
    prioridad?: "baja" | "media" | "alta" | "critica";
    calificacion_id?: string;
    asegurado_estado?: string;
    fecha_registro_mes?: string;
    busqueda_id?: string;
    numero_siniestro?: string;
    asegurado_nombre?: string;
    skip?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.sin_filtrar_activo === true) {
      params.append("sin_filtrar_activo", "true");
    }
    if (filters?.activo !== undefined) {
      params.append("activo", filters.activo === true ? "true" : "false");
    }
    if (filters?.estado_id) params.append("estado_id", filters.estado_id);
    if (filters?.proveniente_id) params.append("proveniente_id", filters.proveniente_id);
    if (filters?.area_id) params.append("area_id", filters.area_id);
    if (filters?.usuario_asignado) params.append("usuario_asignado", filters.usuario_asignado);
    if (filters?.prioridad) params.append("prioridad", filters.prioridad);
    if (filters?.calificacion_id) params.append("calificacion_id", filters.calificacion_id);
    if (filters?.asegurado_estado?.trim()) params.append("asegurado_estado", filters.asegurado_estado.trim());
    if (filters?.fecha_registro_mes?.trim()) params.append("fecha_registro_mes", filters.fecha_registro_mes.trim());
    if (filters?.busqueda_id?.trim()) params.append("busqueda_id", filters.busqueda_id.trim());
    if (filters?.numero_siniestro?.trim()) params.append("numero_siniestro", filters.numero_siniestro.trim());
    if (filters?.asegurado_nombre?.trim()) params.append("asegurado_nombre", filters.asegurado_nombre.trim());
    if (filters?.skip !== undefined) params.append("skip", String(filters.skip));
    if (filters?.limit !== undefined) params.append("limit", String(filters.limit));
    
    const response = await api.get(`/siniestros?${params.toString()}`);
    return response.data;
  },

  getSiniestroById: async (siniestroId: string) => {
    const response = await api.get(`/siniestros/${siniestroId}`);
    return response.data;
  },

  createSiniestro: async (data: {
    numero_siniestro?: string | null;
    fecha_registro: string;
    fecha_reporte?: string;
    fecha_asignacion?: string;
    fecha_siniestro?: string;
    ubicacion?: string;
    tipo_intervencion?: string | null;
    tercero?: string | null;
    nicho?: string | null;
    materia?: string | null;
    expediente?: string | null;
    descripcion_hechos: string;
    polizas?: Array<{
      id?: string;
      numero_poliza?: string | null;
      deducible?: number;
      reserva?: number;
      coaseguro?: number;
      suma_asegurada?: number;
      es_principal?: boolean;
      orden?: number;
    }>;
    asegurado_id?: string;
    estado_id?: string;
    institucion_id?: string;
    autoridad_id?: string;
    proveniente_id?: string | null;
    numero_reporte?: string | null;
    /** Consecutivo del ID legible (mismo que backend `codigo`). Opcional. */
    codigo?: string;
    calificacion_id?: string;
    forma_contacto?: string | null;
    prioridad?: "baja" | "media" | "alta" | "critica";
    observaciones?: string;
    activo?: boolean;
  }) => {
    const response = await api.post("/siniestros", data);
    return response.data;
  },

  updateSiniestro: async (siniestroId: string, data: {
    numero_siniestro?: string;
    fecha_registro?: string;
    fecha_reporte?: string;
    fecha_asignacion?: string;
    fecha_siniestro?: string;
    ubicacion?: string;
    tipo_intervencion?: string | null;
    tercero?: string | null;
    nicho?: string | null;
    materia?: string | null;
    expediente?: string | null;
    descripcion_hechos?: string;
    polizas?: Array<{
      id?: string;
      numero_poliza?: string | null;
      deducible?: number;
      reserva?: number;
      coaseguro?: number;
      suma_asegurada?: number;
      es_principal?: boolean;
      orden?: number;
    }>;
    asegurado_id?: string;
    estado_id?: string;
    institucion_id?: string;
    autoridad_id?: string;
    proveniente_id?: string;
    numero_reporte?: string;
    codigo?: string;
    calificacion_id?: string;
    forma_contacto?: "correo" | "telefono" | "directa";
    prioridad?: "baja" | "media" | "alta" | "critica";
    observaciones?: string;
    activo?: boolean;
  }) => {
    const response = await api.put(`/siniestros/${siniestroId}`, data);
    return response.data;
  },

  deleteSiniestro: async (siniestroId: string) => {
    const response = await api.delete(`/siniestros/${siniestroId}`);
    return response.data;
  },

  // Versiones de descripción de hechos
  getVersionesDescripcion: async (siniestroId: string) => {
    const response = await api.get(`/siniestros/${siniestroId}/versiones-descripcion`);
    return response.data;
  },

  getVersionActualDescripcion: async (siniestroId: string) => {
    const response = await api.get(`/siniestros/${siniestroId}/versiones-descripcion/actual`);
    return response.data;
  },

  createVersionDescripcion: async (siniestroId: string, data: {
    descripcion_html: string;
    observaciones?: string;
  }) => {
    const response = await api.post(`/siniestros/${siniestroId}/versiones-descripcion`, data);
    return response.data;
  },

  restaurarVersionDescripcion: async (versionId: string) => {
    const response = await api.post(`/siniestros/versiones-descripcion/${versionId}/restaurar`);
    return response.data;
  },

  // Relaciones: Involucrados
  getInvolucrados: async (siniestroId: string, activo?: boolean) => {
    const params = activo !== undefined ? `?activo=${activo}` : "";
    const response = await api.get(`/siniestros/${siniestroId}/involucrados${params}`);
    return response.data;
  },
  addInvolucrado: async (
    siniestroId: string,
    data: {
      usuario_id: string;
      es_principal?: boolean;
      observaciones?: string;
      activo?: boolean;
    }
  ) => {
    // Algunos endpoints esperan siniestro_id en el body además del path,
    // así que lo incluimos siempre para compatibilidad.
    const payload = {
      siniestro_id: siniestroId,
      ...data,
    };
    const response = await api.post(
      `/siniestros/${siniestroId}/involucrados`,
      payload
    );
    return response.data;
  },
  updateInvolucrado: async (relacionId: string, data: {
    es_principal?: boolean;
    observaciones?: string;
    activo?: boolean;
  }) => {
    const response = await api.put(`/siniestros/involucrados/${relacionId}`, data);
    return response.data;
  },
  removeInvolucrado: async (relacionId: string) => {
    const response = await api.delete(`/siniestros/involucrados/${relacionId}`);
    return response.data;
  },

  // Relaciones: Áreas Adicionales
  getAreasAdicionales: async (siniestroId: string, activo?: boolean) => {
    const params = activo !== undefined ? `?activo=${activo}` : "";
    const response = await api.get(`/siniestros/${siniestroId}/areas-adicionales${params}`);
    return response.data;
  },
  addAreaAdicional: async (siniestroId: string, data: {
    area_id: string;
    usuario_responsable?: string;
    observaciones?: string;
    fecha_asignacion?: string;
    activo?: boolean;
  }) => {
    const response = await api.post(`/siniestros/${siniestroId}/areas-adicionales`, data);
    return response.data;
  },
  updateAreaAdicional: async (relacionId: string, data: {
    fecha_asignacion?: string;
    usuario_responsable?: string;
    observaciones?: string;
    activo?: boolean;
    abogado_principal_informe_id?: string | null;
  }) => {
    const response = await api.put(`/siniestros/areas-adicionales/${relacionId}`, data);
    return response.data;
  },
  removeAreaAdicional: async (relacionId: string) => {
    const response = await api.delete(`/siniestros/areas-adicionales/${relacionId}`);
    return response.data;
  },

  // Dashboard
  getDashboardStats: async (): Promise<any> => {
    const response = await api.get("/dashboard/stats");
    return response.data;
  },
  getRecentSiniestros: async (limit: number = 5): Promise<any[]> => {
    const response = await api.get(`/dashboard/recent-siniestros?limit=${limit}`);
    return response.data;
  },
  getSiniestrosByMonth: async (months: number = 6): Promise<any[]> => {
    const response = await api.get(`/dashboard/siniestros-by-month?months=${months}`);
    return response.data;
  },
};

// Servicios de bitácora
const bitacoraService = {
  getBitacoraSiniestro: async (siniestroId: string, filters?: {
    usuario_id?: string;
    tipo_actividad?: string;
    area_id?: string;
    flujo_trabajo_id?: string;
    skip?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.usuario_id) params.append("usuario_id", filters.usuario_id);
    if (filters?.tipo_actividad) params.append("tipo_actividad", filters.tipo_actividad);
    if (filters?.area_id) params.append("area_id", filters.area_id);
    if (filters?.flujo_trabajo_id) params.append("flujo_trabajo_id", filters.flujo_trabajo_id);
    if (filters?.skip !== undefined) params.append("skip", String(filters.skip));
    if (filters?.limit !== undefined) params.append("limit", String(filters.limit));
    
    const response = await api.get(`/bitacora/siniestros/${siniestroId}?${params.toString()}`);
    return response.data;
  },

  getBitacoraActividad: async (actividadId: string) => {
    const response = await api.get(`/bitacora/${actividadId}`);
    return response.data;
  },

  createBitacoraActividad: async (data: {
    siniestro_id: string;
    usuario_id?: string;
    tipo_actividad: "documento" | "llamada" | "reunion" | "inspeccion" | "otro";
    descripcion: string;
    horas_trabajadas?: number;
    fecha_actividad: string;
    documento_adjunto?: string;
    comentarios?: string;
    area_id?: string;
    flujo_trabajo_id?: string;
  }) => {
    const response = await api.post("/bitacora", data);
    return response.data;
  },

  updateBitacoraActividad: async (actividadId: string, data: {
    tipo_actividad?: "documento" | "llamada" | "reunion" | "inspeccion" | "otro";
    descripcion?: string;
    horas_trabajadas?: number;
    fecha_actividad?: string;
    documento_adjunto?: string;
    comentarios?: string;
    verificado?: boolean;
    area_id?: string;
    flujo_trabajo_id?: string;
  }) => {
    const response = await api.put(`/bitacora/${actividadId}`, data);
    return response.data;
  },

  deleteBitacoraActividad: async (actividadId: string) => {
    const response = await api.delete(`/bitacora/${actividadId}`);
    return response.data;
  },
};

// Servicios de documentos
const documentoService = {
  getDocumentosSiniestro: async (siniestroId: string, filters?: {
    tipo_documento_id?: string;
    activo?: boolean;
    area_id?: string;
    flujo_trabajo_id?: string;
    skip?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.tipo_documento_id) params.append("tipo_documento_id", filters.tipo_documento_id);
    if (filters?.activo !== undefined) params.append("activo", String(filters.activo));
    if (filters?.area_id) params.append("area_id", filters.area_id);
    if (filters?.flujo_trabajo_id) params.append("flujo_trabajo_id", filters.flujo_trabajo_id);
    if (filters?.skip !== undefined) params.append("skip", String(filters.skip));
    if (filters?.limit !== undefined) params.append("limit", String(filters.limit));
    
    const response = await api.get(`/documentos/siniestros/${siniestroId}?${params.toString()}`);
    return response.data;
  },

  getDocumento: async (documentoId: string) => {
    const response = await api.get(`/documentos/${documentoId}`);
    return response.data;
  },

  getDocumentoArchivoUrl: async (documentoId: string) => {
    const response = await api.get(`/documentos/${documentoId}/archivo-url`);
    return response.data;
  },

  createDocumento: async (data: {
    siniestro_id: string;
    tipo_documento_id?: string;
    etapa_flujo_id?: string;
    plantilla_documento_id?: string;
    area_id?: string;
    flujo_trabajo_id?: string;
    nombre_archivo: string;
    ruta_archivo?: string | null;
    contenido?: string;
    tamaño_archivo?: number;
    tipo_mime?: string;
    usuario_subio?: string;
    version?: number;
    descripcion?: string;
    fecha_documento?: string;
    es_principal?: boolean;
    es_adicional?: boolean;
    activo?: boolean;
    horas_trabajadas_bitacora?: number;
    comentarios_bitacora?: string;
  }) => {
    const response = await api.post("/documentos", data);
    return response.data;
  },

  updateDocumento: async (documentoId: string, data: {
    nombre_archivo?: string;
    contenido?: string;
    descripcion?: string;
    fecha_documento?: string;
    es_principal?: boolean;
    es_adicional?: boolean;
    tipo_documento_id?: string;
    etapa_flujo_id?: string;
    plantilla_documento_id?: string;
    area_id?: string;
    flujo_trabajo_id?: string;
    activo?: boolean;
    horas_trabajadas_bitacora?: number;
    comentarios_bitacora?: string;
  }) => {
    const response = await api.put(`/documentos/${documentoId}`, data);
    return response.data;
  },

  deleteDocumento: async (documentoId: string) => {
    const response = await api.delete(`/documentos/${documentoId}`);
    return response.data;
  },

  /** Sube un archivo (foto, PDF, etc.) como documento del siniestro. */
  uploadDocumento: async (
    siniestroId: string,
    file: File,
    options?: {
      descripcion?: string;
      area_id?: string;
      flujo_trabajo_id?: string;
      etapa_flujo_id?: string;
      tipo_documento_id?: string;
      plantilla_documento_id?: string;
      requisito_documento_id?: string;
      horas_trabajadas?: number;
      comentarios?: string;
    }
  ) => {
    const form = new FormData();
    form.append("siniestro_id", siniestroId);
    form.append("file", file);
    if (options?.descripcion) form.append("descripcion", options.descripcion);
    if (options?.area_id) form.append("area_id", options.area_id);
    if (options?.flujo_trabajo_id) form.append("flujo_trabajo_id", options.flujo_trabajo_id);
    if (options?.etapa_flujo_id) form.append("etapa_flujo_id", options.etapa_flujo_id);
    if (options?.tipo_documento_id) form.append("tipo_documento_id", options.tipo_documento_id);
    if (options?.plantilla_documento_id) form.append("plantilla_documento_id", options.plantilla_documento_id);
    if (options?.requisito_documento_id) form.append("requisito_documento_id", options.requisito_documento_id);
    if (options?.horas_trabajadas != null && !Number.isNaN(Number(options.horas_trabajadas))) form.append("horas_trabajadas", String(options.horas_trabajadas));
    if (options?.comentarios != null && String(options.comentarios).trim() !== "") form.append("comentarios", options.comentarios);
    const response = await api.post("/documentos/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  /** Descarga o abre el archivo de un documento (documentos subidos). */
  downloadDocumentoArchivo: async (documentoId: string, nombreArchivo?: string) => {
    const access = await documentoService.getDocumentoArchivoUrl(documentoId);
    const provider = String(access?.provider || "").toLowerCase();
    const finalFilename = nombreArchivo || access?.filename || "archivo";

    if (provider === "r2" && access?.url) {
      const a = document.createElement("a");
      a.href = access.url;
      a.download = finalFilename;
      a.rel = "noopener noreferrer";
      a.click();
      return;
    }

    const response = await api.get(access?.url || `/documentos/${documentoId}/archivo`, {
      responseType: "blob",
    });
    const blob = response.data as Blob;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = finalFilename;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  /** Obtiene el archivo como Blob (p. ej. vista previa en modal sin forzar descarga). */
  fetchDocumentoArchivoBlob: async (
    documentoId: string
  ): Promise<{ blob: Blob; contentType: string }> => {
    const access = await documentoService.getDocumentoArchivoUrl(documentoId);
    const provider = String(access?.provider || "").toLowerCase();
    const response =
      provider === "r2" && access?.url
        ? await axios.get(access.url, { responseType: "blob" })
        : await api.get(access?.url || `/documentos/${documentoId}/archivo`, {
            responseType: "blob",
          });
    const raw =
      (response.headers["content-type"] as string | undefined) ||
      (response.headers["Content-Type"] as string | undefined) ||
      "application/octet-stream";
    const contentType = raw.split(";")[0].trim();
    return { blob: response.data as Blob, contentType };
  },
};

// Servicios de migración documental legacy
const legacyDocumentMigrationService = {
  getLegacyDocumentMigrationContext: async (siniestroId: string, areaId?: string) => {
    const params = new URLSearchParams();
    if (areaId) params.append("area_id", areaId);
    const query = params.toString();
    const response = await api.get(
      `/siniestros/${siniestroId}/migracion-documental/contexto${query ? `?${query}` : ""}`
    );
    return response.data;
  },
  rescanLegacyDocumentMigration: async (siniestroId: string, areaId?: string) => {
    const params = new URLSearchParams();
    if (areaId) params.append("area_id", areaId);
    const query = params.toString();
    const response = await api.post(`/siniestros/${siniestroId}/migracion-documental/scan${query ? `?${query}` : ""}`);
    return response.data;
  },
  getLegacyDocumentMigrationFiles: async (siniestroId: string, areaId?: string) => {
    const params = new URLSearchParams();
    if (areaId) params.append("area_id", areaId);
    const query = params.toString();
    const response = await api.get(
      `/siniestros/${siniestroId}/migracion-documental/archivos${query ? `?${query}` : ""}`
    );
    return response.data;
  },
  getLegacyDocumentMigrationDestinations: async (siniestroId: string, areaId?: string) => {
    const params = new URLSearchParams();
    if (areaId) params.append("area_id", areaId);
    const query = params.toString();
    const response = await api.get(
      `/siniestros/${siniestroId}/migracion-documental/destinos${query ? `?${query}` : ""}`
    );
    return response.data;
  },
  fetchLegacyDocumentPreviewBlob: async (
    siniestroId: string,
    archivoId: string
  ): Promise<{ blob: Blob; contentType: string }> => {
    const response = await api.get(
      `/siniestros/${siniestroId}/migracion-documental/archivos/${archivoId}/preview`,
      { responseType: "blob" }
    );
    const raw =
      (response.headers["content-type"] as string | undefined) ||
      (response.headers["Content-Type"] as string | undefined) ||
      "application/octet-stream";
    return {
      blob: response.data as Blob,
      contentType: raw.split(";")[0].trim(),
    };
  },
  finalizeLegacyDocumentMigration: async (
    siniestroId: string,
    data: {
      items: Array<{
        legacy_file_id: string;
        flujo_trabajo_id?: string | null;
        categoria_documento_id?: string | null;
        etapa_flujo_id?: string | null;
        tipo_documento_id: string;
        requisito_documento_id?: string | null;
      }>;
    },
    areaId?: string
  ) => {
    const params = new URLSearchParams();
    if (areaId) params.append("area_id", areaId);
    const query = params.toString();
    const response = await api.post(
      `/siniestros/${siniestroId}/migracion-documental/finalizar${query ? `?${query}` : ""}`,
      data
    );
    return response.data;
  },
};

// Servicios de notificaciones
const notificacionService = {
  getNotificaciones: async (filters?: {
    leida?: boolean;
    tipo?: string;
    skip?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.leida !== undefined) params.append("leida", String(filters.leida));
    if (filters?.tipo) params.append("tipo", filters.tipo);
    if (filters?.skip !== undefined) params.append("skip", String(filters.skip));
    if (filters?.limit !== undefined) params.append("limit", String(filters.limit));
    
    const response = await api.get(`/notificaciones?${params.toString()}`);
    return response.data;
  },

  getNotificacion: async (notificacionId: string) => {
    const response = await api.get(`/notificaciones/${notificacionId}`);
    return response.data;
  },

  createNotificacion: async (data: {
    usuario_id: string;
    siniestro_id?: string;
    tipo: "plazo_vencido" | "cambio_estado" | "asignacion" | "recordatorio" | "general";
    titulo: string;
    mensaje: string;
    fecha_vencimiento?: string;
  }) => {
    const response = await api.post("/notificaciones", data);
    return response.data;
  },

  updateNotificacion: async (notificacionId: string, data: {
    leida?: boolean;
    titulo?: string;
    mensaje?: string;
    fecha_vencimiento?: string;
  }) => {
    const response = await api.put(`/notificaciones/${notificacionId}`, data);
    return response.data;
  },

  marcarLeida: async (notificacionId: string) => {
    const response = await api.post(`/notificaciones/${notificacionId}/marcar-leida`);
    return response.data;
  },

  marcarTodasLeidas: async () => {
    const response = await api.post("/notificaciones/marcar-todas-leidas");
    return response.data;
  },

  deleteNotificacion: async (notificacionId: string) => {
    const response = await api.delete(`/notificaciones/${notificacionId}`);
    return response.data;
  },
};

// Servicios de evidencias
const evidenciaService = {
  getEvidenciasSiniestro: async (siniestroId: string, filters?: {
    activo?: boolean;
    skip?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.activo !== undefined) params.append("activo", String(filters.activo));
    if (filters?.skip !== undefined) params.append("skip", String(filters.skip));
    if (filters?.limit !== undefined) params.append("limit", String(filters.limit));
    
    const response = await api.get(`/evidencias/siniestros/${siniestroId}?${params.toString()}`);
    return response.data;
  },

  getEvidencia: async (evidenciaId: string) => {
    const response = await api.get(`/evidencias/${evidenciaId}`);
    return response.data;
  },

  createEvidencia: async (data: {
    siniestro_id: string;
    nombre_archivo: string;
    ruta_archivo: string;
    tamaño_archivo?: number;
    tipo_mime?: string;
    latitud?: number;
    longitud?: number;
    fecha_toma?: string;
    usuario_subio?: string;
    descripcion?: string;
    activo?: boolean;
  }) => {
    const response = await api.post("/evidencias", data);
    return response.data;
  },

  updateEvidencia: async (evidenciaId: string, data: {
    nombre_archivo?: string;
    descripcion?: string;
    latitud?: number;
    longitud?: number;
    fecha_toma?: string;
    activo?: boolean;
  }) => {
    const response = await api.put(`/evidencias/${evidenciaId}`, data);
    return response.data;
  },

  deleteEvidencia: async (evidenciaId: string) => {
    const response = await api.delete(`/evidencias/${evidenciaId}`);
    return response.data;
  },
};

// Servicio de generación de PDFs
const pdfService = {
  generatePDF: async (data: {
    html_content: string;
    plantilla_id?: string;
    siniestro_id?: string;
    page_size?: "A4" | "Letter" | "Legal" | "A3" | "A5";
    orientation?: "portrait" | "landscape";
    margin_top?: string;
    margin_bottom?: string;
    margin_left?: string;
    margin_right?: string;
    custom_css?: string;
    variables?: Record<string, any>;
    filename?: string;
  }) => {
    const response = await api.post("/pdf/generate", data);
    return response.data;
  },

  generatePDFFromTemplate: async (data: {
    plantilla_id: string;
    variables?: Record<string, any>;
    page_size?: "A4" | "Letter" | "Legal" | "A3" | "A5";
    orientation?: "portrait" | "landscape";
    margin_top?: string;
    margin_bottom?: string;
    margin_left?: string;
    margin_right?: string;
    custom_css?: string;
    filename?: string;
  }) => {
    const response = await api.post("/pdf/generate-from-template", data);
    return response.data;
  },

  downloadPDF: async (data: {
    html_content: string;
    plantilla_id?: string;
    siniestro_id?: string;
    page_size?: "A4" | "Letter" | "Legal" | "A3" | "A5";
    orientation?: "portrait" | "landscape";
    margin_top?: string;
    margin_bottom?: string;
    margin_left?: string;
    margin_right?: string;
    custom_css?: string;
    variables?: Record<string, any>;
    filename?: string;
  }) => {
    const response = await api.post("/pdf/download", data);
    await triggerDownloadFromAccess(response.data, data.filename);
    return response.data;
  },

  downloadPDFFromTemplate: async (data: {
    plantilla_id: string;
    siniestro_id?: string;
    variables?: Record<string, any>;
    page_size?: "A4" | "Letter" | "Legal" | "A3" | "A5";
    orientation?: "portrait" | "landscape";
    margin_top?: string;
    margin_bottom?: string;
    margin_left?: string;
    margin_right?: string;
    custom_css?: string;
    filename?: string;
  }) => {
    const response = await api.post("/pdf/download-from-template", data);
    await triggerDownloadFromAccess(response.data, data.filename);
    return response.data;
  },
};

// Servicios generales
const generalService = {
  healthCheck: async () => {
    const response = await axios.get(`${API_URL}/health`);
    return response.data;
  },
};


// ========== Configuración SMTP ==========
const configService = {
  // SMTP
  getConfiguracionesSMTP: async (activo?: boolean) => {
    const params = activo !== undefined ? { activo } : {};
    const response = await api.get("/configuracion/smtp", { params });
    return response.data;
  },
  createConfiguracionSMTP: async (data: any) => {
    const response = await api.post("/configuracion/smtp", data);
    return response.data;
  },
  updateConfiguracionSMTP: async (id: string, data: any) => {
    const response = await api.put(`/configuracion/smtp/${id}`, data);
    return response.data;
  },
  deleteConfiguracionSMTP: async (id: string) => {
    await api.delete(`/configuracion/smtp/${id}`);
  },
  testConfiguracionSMTP: async (id: string, data: any) => {
    const response = await api.post(`/configuracion/smtp/${id}/test`, data);
    return response.data;
  },

  // Plantillas de Correo
  getPlantillasCorreo: async (activo?: boolean) => {
    const params = activo !== undefined ? { activo } : {};
    const response = await api.get("/configuracion/plantillas-correo", { params });
    return response.data;
  },
  createPlantillaCorreo: async (data: any) => {
    const response = await api.post("/configuracion/plantillas-correo", data);
    return response.data;
  },
  updatePlantillaCorreo: async (id: string, data: any) => {
    const response = await api.put(`/configuracion/plantillas-correo/${id}`, data);
    return response.data;
  },
  deletePlantillaCorreo: async (id: string) => {
    await api.delete(`/configuracion/plantillas-correo/${id}`);
  },
  enviarCorreo: async (data: {
    configuracion_smtp_id: string;
    plantilla_id?: string | null;
    destinatarios: string[];
    cc?: string[];
    cco?: string[];
    asunto?: string | null;
    cuerpo_html?: string | null;
    variables?: Record<string, any>;
    adjuntos?: string[];
  }) => {
    const response = await api.post("/configuracion/enviar-correo", data);
    return response.data;
  },
  /** Envío con plantilla "Te envían un archivo". Si documento_id es un informe, se adjunta PDF. */
  enviarArchivoCorreo: async (data: {
    siniestro_id: string;
    configuracion_smtp_id: string;
    destinatarios: string[];
    cc?: string[];
    cco?: string[];
    mensaje: string;
    /** Sustituye {{ asunto }} en la plantilla de correo y el asunto renderizado */
    asunto?: string | null;
    documento_id?: string | null;
    /** Mismo correo con varios documentos (cada uno: PDF si es informe + archivo en disco si existe). */
    documentos_ids?: string[];
    tipo_documento_nombre?: string;
    categoria_nombre?: string;
    archivos_adjuntos?: Array<{
      nombre: string;
      contenido_base64: string;
      tipo_mime?: string;
    }>;
  }) => {
    const response = await api.post("/configuracion/enviar-archivo-correo", data);
    return response.data;
  },

  // Historial de Correos
  getHistorialCorreos: async (filtros?: any) => {
    const response = await api.get("/configuracion/historial-correos", { params: filtros });
    return response.data;
  },
};

// ========== Reportes ==========
const reporteService = {
  getReportesDisponibles: async () => {
    const response = await api.get("/reportes/disponibles");
    return response.data;
  },
  generarReporte: async (data: any) => {
    const response = await api.post("/reportes/generar", data);
    return response.data;
  },
  descargarReporte: async (data: any) => {
    const response = await api.post("/reportes/generar/descargar", data);
    await triggerDownloadFromAccess(response.data, response.data?.filename || response.data?.nombre_archivo);
    return response.data;
  },
  getEstadisticasModulo: async (modulo: string, filtros?: any) => {
    const response = await api.get(`/reportes/estadisticas/${modulo}`, { params: filtros });
    return response.data;
  },
};

// ========== Exportación ==========
const exportService = {
  exportarDatos: async (modulo: string, formato: "excel" | "csv", filtros?: any) => {
    const response = await api.post(`/exportar/exportar/${modulo}`, filtros || {}, {
      params: { formato },
    });
    await triggerDownloadFromAccess(response.data);
    return response.data;
  },
  exportarExcel: async (modulo: string, filtros?: any) => {
    const response = await api.get(`/exportar/exportar/${modulo}/excel`, {
      params: filtros,
    });
    await triggerDownloadFromAccess(response.data);
    return response.data;
  },
  exportarCSV: async (modulo: string, filtros?: any) => {
    const response = await api.get(`/exportar/exportar/${modulo}/csv`, {
      params: filtros,
    });
    await triggerDownloadFromAccess(response.data);
    return response.data;
  },
};

// ========== Auditoría ==========
const auditoriaService = {
  getAuditoria: async (filtros?: any) => {
    const response = await api.get("/auditoria", { params: filtros });
    return response.data;
  },
  /** Un registro con datos_anteriores / datos_nuevos (listado en ligero) */
  getAuditoriaFila: async (auditoriaId: string) => {
    const response = await api.get(`/auditoria/fila/${auditoriaId}`);
    return response.data;
  },
  getHistorialRegistro: async (tabla: string, registroId: string) => {
    const response = await api.get(`/auditoria/registro/${tabla}/${registroId}`);
    return response.data;
  },
  exportarAuditoriaExcel: async (filtros?: any) => {
    const response = await api.get("/auditoria/exportar/excel", {
      params: filtros,
      responseType: "blob",
    });
    return response.data;
  },
  getEstadisticasAuditoria: async (filtros?: any) => {
    const response = await api.get("/auditoria/estadisticas", { params: filtros });
    return response.data;
  },
};

// ========== Backup ==========
const backupService = {
  getBackups: async (tipo?: string, estado?: string) => {
    const params: any = {};
    if (tipo) params.tipo = tipo;
    if (estado) params.estado = estado;
    const response = await api.get("/backups", { params });
    return response.data;
  },
  createBackup: async (data: any) => {
    const response = await api.post("/backups", data);
    return response.data;
  },
  getBackup: async (id: string) => {
    const response = await api.get(`/backups/${id}`);
    return response.data;
  },
  deleteBackup: async (id: string) => {
    await api.delete(`/backups/${id}`);
  },
  restaurarBackup: async (id: string, confirmar: boolean) => {
    const response = await api.post(`/backups/${id}/restore`, { confirmar });
    return response.data;
  },
  getConfiguracionBackup: async () => {
    const response = await api.get("/configuracion-backup");
    return response.data;
  },
  createConfiguracionBackup: async (data: any) => {
    const response = await api.post("/configuracion-backup", data);
    return response.data;
  },
  updateConfiguracionBackup: async (data: any) => {
    const response = await api.put("/configuracion-backup", data);
    return response.data;
  },
  limpiarBackupsAntiguos: async (diasRetener: number = 30) => {
    const response = await api.post("/limpiar-backups-antiguos", null, {
      params: { dias_retener: diasRetener },
    });
    return response.data;
  },
};

const apiService = {
  ...authService,
  ...userService,
  // Esparcir servicios directos (NO esparcir rolService, permisoService, empresaService aquí)
  ...siniestroService,
  ...flujoTrabajoService,
  ...catalogService,
  ...documentoService,
  ...legacyDocumentMigrationService,
  ...bitacoraService,
  ...notificacionService,
  ...evidenciaService,
  ...configService,
  ...reporteService,
  ...exportService,
  ...pdfService,
  ...auditoriaService,
  ...backupService,
  // Servicios directos de roles (mantener compatibilidad con código existente)
  getRoles: rolService.getRoles,
  getRolById: rolService.getRolById,
  createRol: rolService.createRol,
  updateRol: rolService.updateRol,
  deleteRol: rolService.deleteRol,
  // Servicios directos de empresa (mantener compatibilidad con código existente)
  getEmpresas: empresaService.getEmpresas,
  getEmpresaById: empresaService.getEmpresaById,
  createEmpresa: empresaService.createEmpresa,
  updateEmpresa: empresaService.updateEmpresa,
  deleteEmpresa: empresaService.deleteEmpresa,
  // Servicios anidados (definir DESPUÉS de todos los esparcimientos para evitar sobrescritura)
  rol: {
    getRoles: rolService.getRoles,
    getRolById: rolService.getRolById,
    createRol: rolService.createRol,
    updateRol: rolService.updateRol,
    deleteRol: rolService.deleteRol,
  },
  permiso: permisoService,
  empresa: empresaService,

  // Para que el modal resuelva la promesa que deja en pausa el interceptor
  resolveSessionRenewal,
};

export default apiService;
