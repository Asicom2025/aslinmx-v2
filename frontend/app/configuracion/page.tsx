/**
 * Configuración - Tabs
 * General, Flujos, Áreas, Documentos y Tipos de Documento
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import FlujosTrabajoPage from "@/app/flujos-trabajo/page";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Switch from "@/components/ui/Switch";
import Modal from "@/components/ui/Modal";
import DataTable from "@/components/ui/DataTable";
import JoditEditor from "@/components/ui/JoditEditor";
import PDFGenerator from "@/components/pdf/PDFGenerator";
import PDFPreviewModal from "./components/PDFPreviewModal";
import CategoriasModal from "./components/CategoriasModal";
import PlantillasSinCategoriaModal from "./components/PlantillasSinCategoriaModal";
import apiService from "@/lib/apiService";
import { getUserDisplayName } from "@/lib/userName";
import { swalSuccess, swalError, swalConfirm, swalConfirmDelete } from "@/lib/swal";
import { ColumnDef } from "@tanstack/react-table";
import { FiFolder, FiFileText, FiEye } from "react-icons/fi";
import { useTour } from "@/hooks/useTour";
import { usePermisos } from "@/hooks/usePermisos";
import {
  MODULO,
  ACCION,
  canConfigSmtpLeer,
  canConfigSmtpCrear,
  canConfigSmtpActualizar,
  canConfigSmtpEliminar,
  canConfigAreasCrear,
  canConfigAreasActualizar,
  canConfigAreasEliminar,
  canCatalogoDocumentoLeer,
  canCatalogoDocumentoCrear,
  canCatalogoDocumentoActualizar,
  canCatalogoDocumentoEliminar,
} from "@/lib/permisosConstants";
import TourButton from "@/components/ui/TourButton";

type ConfigTab = "general" | "flujos" | "areas" | "documentos" | "tipos_documento";

// Wrapper para FlujosTrabajoPage que maneja mejor el estado de carga
function FlujosTrabajoPageWrapper() {
  const { user, loading: userLoading, activeEmpresa } = useUser();
  
  if (userLoading) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">No hay usuario autenticado</p>
      </div>
    );
  }
  
  if (!activeEmpresa && (!user.empresa?.id && (!user.empresas || user.empresas.length === 0))) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">No tienes una empresa activa asignada. Por favor, selecciona una empresa para gestionar flujos de trabajo.</p>
      </div>
    );
  }
  
  return <FlujosTrabajoPage />;
}

export default function ConfiguracionPage() {
  const router = useRouter();
  const { loading } = useUser();
  useTour("tour-configuracion", { autoStart: true });
  const [activeTab, setActiveTab] = useState<ConfigTab>("general");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token && !loading) {
      router.push("/login");
    }
  }, [router, loading]);

  const TabButton = ({ id, label }: { id: ConfigTab; label: string }) => (
    <button
      className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
        activeTab === id
          ? "border-primary-500 text-primary-600"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }`}
      onClick={() => setActiveTab(id)}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen w-full bg-gray-50 py-4 lg:py-6">
      <div className="container-app w-full">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:mb-6">
          <h1 className="text-fluid-2xl font-bold text-gray-900 sm:text-3xl">
            Configuración
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <TourButton tour="tour-configuracion" label="Ver guía" />
          </div>
        </div>

        {/* Tabs */}
        <div
          data-tour="config-tabs"
          className="mb-4 overflow-x-auto border-b border-gray-200 [-webkit-overflow-scrolling:touch] lg:mb-6"
        >
          <nav className="-mb-px flex w-max min-w-max gap-4 sm:gap-6" aria-label="Tabs">
            <TabButton id="general" label="General" />
            <TabButton id="flujos" label="Flujos" />
            <TabButton id="areas" label="Áreas" />
            <TabButton id="documentos" label="Documentos" />
            <TabButton id="tipos_documento" label="Tipos de Documento" />
          </nav>
        </div>

        {/* Content */}
        {activeTab === "general" && (
          <div data-tour="config-empresa">
            <GeneralTab />
          </div>
        )}

        {activeTab === "flujos" && (
          <div className="bg-white rounded-lg shadow p-2">
            <FlujosTrabajoPageWrapper />
          </div>
        )}

        {activeTab === "areas" && <AreasTab />}

        {activeTab === "documentos" && <DocumentosTab />}

        {activeTab === "tipos_documento" && <PlantillasTab />}
      </div>
    </div>
  );
}

function GeneralTab() {
  const { activeEmpresa, user, refresh } = useUser();
  const { can } = usePermisos();
  const canCfgUpdate = can(MODULO.configuracion, ACCION.update);
  const showSmtpConfig = canConfigSmtpLeer(can);
  const showPlantillasCorreo = can(MODULO.configuracion, ACCION.read);
  const [form, setForm] = useState({
    nombre: "",
    alias: "",
    dominio: "",
    logo_url: "",
    color_principal: "",
    color_secundario: "",
    color_terciario: "",
    activo: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>("");

  useEffect(() => {
    if (!activeEmpresa) {
      console.log("GeneralTab: No hay activeEmpresa, limpiando formulario");
      setForm({
        nombre: "",
        alias: "",
        dominio: "",
        logo_url: "",
        color_principal: "",
        color_secundario: "",
        color_terciario: "",
        activo: true,
      });
      setLoading(false);
      return;
    }

    if (!activeEmpresa.id) {
      console.error("GeneralTab: activeEmpresa no tiene ID válido", activeEmpresa);
      setLoading(false);
      return;
    }

    const loadEmpresa = async () => {
      try {
        setLoading(true);
        console.log("GeneralTab: Cargando empresa con ID:", activeEmpresa.id);
        const data = await apiService.getEmpresaById(activeEmpresa.id);
        console.log("GeneralTab: Datos de empresa recibidos:", data);
        setForm({
          nombre: data.nombre || "",
          alias: data.alias || "",
          dominio: data.dominio || "",
          logo_url: data.logo_url || "",
          color_principal: data.color_principal || "",
          color_secundario: data.color_secundario || "",
          color_terciario: data.color_terciario || "",
          activo: data.activo ?? true,
        });
        setLogoPreview(data.logo_url || "");
      } catch (e: any) {
        console.error("GeneralTab: Error al cargar empresa:", e);
        const errorMsg = e.response?.data?.detail || e.message || "Error al cargar la empresa";
        swalError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    loadEmpresa();
  }, [activeEmpresa]);

  const gradientPreview = useMemo(() => {
    const primary = form.color_principal || activeEmpresa?.color_principal || "#0A2E5C";
    const secondary = form.color_secundario || activeEmpresa?.color_secundario || "#2b4f83";
    const tertiary = form.color_terciario || activeEmpresa?.color_terciario || "#3098cb";
    return {
      backgroundImage: `linear-gradient(90deg, ${primary} 0%, ${secondary} 50%, ${tertiary} 100%)`,
    };
  }, [form.color_principal, form.color_secundario, form.color_terciario, activeEmpresa]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleColorChange = (name: "color_principal" | "color_secundario" | "color_terciario", value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e);
    setLogoPreview(e.target.value || "");
  };

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      swalError("Selecciona un archivo de imagen válido (PNG, JPG, SVG, etc.)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        setForm((prev) => ({ ...prev, logo_url: result }));
        setLogoPreview(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setForm((prev) => ({ ...prev, logo_url: "" }));
    setLogoPreview("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEmpresa) return;
    try {
      setSaving(true);
      await apiService.updateEmpresa(activeEmpresa.id, form);
      await swalSuccess("Empresa actualizada correctamente");
      await refresh();
    } catch (error: any) {
      swalError(error.response?.data?.detail || "Error al actualizar la empresa");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Datos de la empresa</h2>
        <p className="text-sm text-gray-500">
          Gestiona la identidad visual y la información básica de la empresa con la que estás operando.
        </p>
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando empresa...</p>
      ) : activeEmpresa ? (
        <form onSubmit={onSubmit} className="space-y-6">
          {!canCfgUpdate && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Solo lectura: tu rol no incluye permiso para editar la configuración de la empresa.
            </p>
          )}
          <fieldset disabled={!canCfgUpdate} className="min-w-0 border-0 p-0 m-0 space-y-6 disabled:opacity-60">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nombre" name="nombre" value={form.nombre} onChange={onChange} required />
            <Input label="Alias" name="alias" value={form.alias || ""} onChange={onChange} />
            <Input label="Dominio" name="dominio" value={form.dominio || ""} onChange={onChange} />
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Logo</label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  name="logo_url"
                  value={form.logo_url || ""}
                  onChange={handleLogoUrlChange}
                  placeholder="https://..."
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                  Cargar
                </label>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={clearLogo}
                    className="rounded-md border border-transparent bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                  >
                    Quitar
                  </button>
                )}
              </div>
              {logoPreview ? (
                <div className="mt-2 flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoPreview} alt="Logo preview" className="h-12 w-12 rounded object-contain" />
                  <p className="text-xs text-gray-500">Vista previa del logo</p>
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  Puedes pegar una URL pública o seleccionar un archivo de imagen (se enviará como base64).
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Color principal</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.color_principal || "#0A2E5C"}
                  onChange={(e) => handleColorChange("color_principal", e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded border border-gray-300"
                />
                <input
                  type="text"
                  name="color_principal"
                  value={form.color_principal || ""}
                  onChange={onChange}
                  placeholder="#0A2E5C"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Color secundario</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.color_secundario || "#2b4f83"}
                  onChange={(e) => handleColorChange("color_secundario", e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded border border-gray-300"
                />
                <input
                  type="text"
                  name="color_secundario"
                  value={form.color_secundario || ""}
                  onChange={onChange}
                  placeholder="#2b4f83"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Color terciario</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.color_terciario || "#3098cb"}
                  onChange={(e) => handleColorChange("color_terciario", e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded border border-gray-300"
                />
                <input
                  type="text"
                  name="color_terciario"
                  value={form.color_terciario || ""}
                  onChange={onChange}
                  placeholder="#3098cb"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Vista previa del degradado</p>
            <div className="h-16 rounded-md shadow-inner border border-gray-100" style={gradientPreview}></div>
          </div>

          <Switch
            label="Empresa activa"
            checked={form.activo}
            onChange={(checked) => setForm((prev) => ({ ...prev, activo: checked }))}
          />

          <div className="flex justify-end gap-3">
            <Button type="submit" variant="primary" disabled={saving || !canCfgUpdate}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
          </fieldset>
        </form>
      ) : (
        <p className="text-gray-500">No tienes una empresa activa asociada.</p>
      )}

      {/* Configuración SMTP para envío de correos */}
      {activeEmpresa && showSmtpConfig && <SmtpSection />}

      {activeEmpresa && showPlantillasCorreo && <PlantillasCorreoSection />}
    </div>
  );
}

const plantillaCorreoFormInitial = {
  nombre: "",
  asunto: "",
  cuerpo_html: "",
  cuerpo_texto: "",
  variables_texto: "", // comma-separated, se convierte a array al guardar
  activo: true,
};

function PlantillasCorreoSection() {
  const { activeEmpresa } = useUser();
  const { can } = usePermisos();
  const canCreate = can(MODULO.configuracion, ACCION.create);
  const canUpdate = can(MODULO.configuracion, ACCION.update);
  const canDelete = can(MODULO.configuracion, ACCION.delete);
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(plantillaCorreoFormInitial);
  const [saving, setSaving] = useState(false);

  const loadList = async () => {
    if (!activeEmpresa?.id) return;
    try {
      setLoading(true);
      const data = await apiService.getPlantillasCorreo();
      setList(Array.isArray(data) ? data : []);
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al cargar plantillas de correo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeEmpresa?.id) loadList();
  }, [activeEmpresa?.id]);

  const openCreate = () => {
    setEditing(null);
    setForm(plantillaCorreoFormInitial);
    setModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    const vars = item.variables_disponibles;
    setForm({
      nombre: item.nombre || "",
      asunto: item.asunto || "",
      cuerpo_html: item.cuerpo_html || "",
      cuerpo_texto: item.cuerpo_texto || "",
      variables_texto: Array.isArray(vars) ? vars.join(", ") : "",
      activo: item.activo ?? true,
    });
    setModalOpen(true);
  };

  const submitPlantilla = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEmpresa?.id) return;
    try {
      setSaving(true);
      const variables_disponibles = form.variables_texto
        ? form.variables_texto.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
      const payload = {
        nombre: form.nombre,
        asunto: form.asunto,
        cuerpo_html: form.cuerpo_html,
        cuerpo_texto: form.cuerpo_texto || undefined,
        variables_disponibles: variables_disponibles?.length ? variables_disponibles : undefined,
        activo: form.activo,
      };
      if (editing) {
        await apiService.updatePlantillaCorreo(editing.id, payload);
        await swalSuccess("Plantilla de correo actualizada");
      } else {
        await apiService.createPlantillaCorreo(payload);
        await swalSuccess("Plantilla de correo creada");
      }
      setModalOpen(false);
      loadList();
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al guardar plantilla");
    } finally {
      setSaving(false);
    }
  };

  const deletePlantilla = async (id: string) => {
    const ok = await swalConfirmDelete("¿Eliminar esta plantilla de correo?");
    if (!ok) return;
    try {
      await apiService.deletePlantillaCorreo(id);
      await swalSuccess("Plantilla eliminada");
      loadList();
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al eliminar");
    }
  };

  return (
    <div className="border-t border-gray-200 pt-6 mt-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Plantillas de correo</h2>
          <p className="text-sm text-gray-500">
            Crea plantillas reutilizables para notificaciones y envíos. Usa variables como {"{{nombre_destinatario}}"}, {"{{numero_siniestro}}"} en asunto y cuerpo.
          </p>
        </div>
        {canCreate && (
          <Button variant="primary" onClick={openCreate}>Nueva plantilla de correo</Button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : list.length === 0 ? (
        <p className="text-gray-500 py-4">No hay plantillas. Crea una para usarla al enviar correos (junto con una configuración SMTP).</p>
      ) : (
        <div className="space-y-2">
          {list.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3"
            >
              <div>
                <p className="font-medium text-gray-900">{item.nombre}</p>
                <p className="text-sm text-gray-500">
                  Asunto: {item.asunto}
                  {item.activo ? (
                    <span className="ml-2 text-green-600">Activa</span>
                  ) : (
                    <span className="ml-2 text-gray-400">Inactiva</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {canUpdate && (
                  <Button variant="secondary" size="sm" onClick={() => openEdit(item)}>Editar</Button>
                )}
                {canDelete && (
                  <Button variant="danger" size="sm" onClick={() => deletePlantilla(item.id)}>Eliminar</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar plantilla de correo" : "Nueva plantilla de correo"} maxWidthClass="max-w-4xl">
        <form onSubmit={submitPlantilla} className="space-y-4">
          <Input label="Nombre" name="nombre" value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej. Notificación de asignación" required />
          <Input label="Asunto" name="asunto" value={form.asunto} onChange={(e) => setForm((p) => ({ ...p, asunto: e.target.value }))} placeholder="Puedes usar {{variable}}" required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cuerpo (HTML)</label>
            <JoditEditor
              value={form.cuerpo_html}
              onChange={(v) => setForm((p) => ({ ...p, cuerpo_html: v }))}
              placeholder="Contenido del correo en HTML. Usa variables como {{nombre_destinatario}}, {{numero_siniestro}}."
              height={280}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cuerpo texto plano (opcional)</label>
            <textarea
              value={form.cuerpo_texto}
              onChange={(e) => setForm((p) => ({ ...p, cuerpo_texto: e.target.value }))}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Versión en texto plano para clientes de correo que no soportan HTML"
            />
          </div>
          <Input
            label="Variables disponibles (separadas por coma)"
            name="variables_texto"
            value={form.variables_texto}
            onChange={(e) => setForm((p) => ({ ...p, variables_texto: e.target.value }))}
            placeholder="nombre_destinatario, numero_siniestro, asunto, enlace"
          />
          <Switch label="Activa" checked={form.activo} onChange={(c) => setForm((p) => ({ ...p, activo: c }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              type="submit"
              variant="primary"
              disabled={saving || (editing ? !canUpdate : !canCreate)}
            >
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const smtpFormInitial = {
  nombre: "",
  servidor: "",
  puerto: 587,
  usuario: "",
  password: "",
  usar_tls: true,
  usar_ssl: false,
  remitente_nombre: "",
  remitente_email: "",
  activo: true,
};

function SmtpSection() {
  const { activeEmpresa } = useUser();
  const { can } = usePermisos();
  const canCreate = canConfigSmtpCrear(can);
  const canUpdate = canConfigSmtpActualizar(can);
  const canDelete = canConfigSmtpEliminar(can);
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(smtpFormInitial);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");

  const loadList = async () => {
    if (!activeEmpresa?.id) return;
    try {
      setLoading(true);
      const data = await apiService.getConfiguracionesSMTP();
      setList(Array.isArray(data) ? data : []);
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al cargar configuraciones SMTP");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeEmpresa?.id) loadList();
  }, [activeEmpresa?.id]);

  const openCreate = () => {
    setEditing(null);
    setForm(smtpFormInitial);
    setModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      nombre: item.nombre || "",
      servidor: item.servidor || "",
      puerto: item.puerto ?? 587,
      usuario: item.usuario || "",
      password: "", // no mostrar contraseña guardada
      usar_tls: item.usar_tls ?? true,
      usar_ssl: item.usar_ssl ?? false,
      remitente_nombre: item.remitente_nombre || "",
      remitente_email: item.remitente_email || "",
      activo: item.activo ?? true,
    });
    setModalOpen(true);
  };

  const changeSmtpForm = (field: string, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEmpresa?.id) return;
    try {
      setSaving(true);
      const payload = {
        nombre: form.nombre,
        servidor: form.servidor,
        puerto: Number(form.puerto),
        usuario: form.usuario,
        password: form.password || (editing ? undefined : ""),
        usar_tls: form.usar_tls,
        usar_ssl: form.usar_ssl,
        remitente_nombre: form.remitente_nombre || undefined,
        remitente_email: form.remitente_email,
        activo: form.activo,
      };
      if (editing) {
        if (!payload.password) delete (payload as any).password;
        await apiService.updateConfiguracionSMTP(editing.id, payload);
        await swalSuccess("Configuración SMTP actualizada");
      } else {
        if (!payload.password) {
          swalError("La contraseña es obligatoria al crear.");
          return;
        }
        await apiService.createConfiguracionSMTP(payload);
        await swalSuccess("Configuración SMTP creada");
      }
      setModalOpen(false);
      loadList();
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al guardar configuración SMTP");
    } finally {
      setSaving(false);
    }
  };

  const deleteSmtp = async (id: string) => {
    const ok = await swalConfirmDelete("¿Eliminar esta configuración SMTP?");
    if (!ok) return;
    try {
      await apiService.deleteConfiguracionSMTP(id);
      await swalSuccess("Configuración SMTP eliminada");
      loadList();
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al eliminar");
    }
  };

  const testSmtp = async (id: string) => {
    const email = testEmail.trim() || undefined;
    if (!email) {
      swalError("Indica un correo de destino para la prueba.");
      return;
    }
    try {
      setTesting(id);
      await apiService.testConfiguracionSMTP(id, {
        configuracion_smtp_id: id,
        destinatario: email,
        asunto: "Prueba de configuración SMTP",
        mensaje: "Este es un correo de prueba.",
      });
      await swalSuccess("Correo de prueba enviado correctamente.");
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al enviar correo de prueba");
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="border-t border-gray-200 pt-6 mt-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Envío de correos (SMTP)</h2>
          <p className="text-sm text-gray-500">
            Configura uno o más servidores SMTP para enviar correos desde la plataforma.
          </p>
        </div>
        {canCreate && (
          <Button variant="primary" onClick={openCreate}>Nueva configuración SMTP</Button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : list.length === 0 ? (
        <p className="text-gray-500 py-4">No hay configuraciones SMTP. Crea una para poder enviar correos.</p>
      ) : (
        <div className="space-y-2">
          {list.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3"
            >
              <div>
                <p className="font-medium text-gray-900">{item.nombre}</p>
                <p className="text-sm text-gray-500">
                  {item.servidor}:{item.puerto} · {item.remitente_email}
                  {item.activo ? (
                    <span className="ml-2 text-green-600">Activo</span>
                  ) : (
                    <span className="ml-2 text-gray-400">Inactivo</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  placeholder="Correo para prueba"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm w-40"
                  disabled={!canUpdate}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => testSmtp(item.id)}
                  disabled={!!testing || !canUpdate}
                >
                  {testing === item.id ? "Enviando..." : "Probar"}
                </Button>
                {canUpdate && (
                  <Button variant="secondary" size="sm" onClick={() => openEdit(item)}>Editar</Button>
                )}
                {canDelete && (
                  <Button variant="danger" size="sm" onClick={() => deleteSmtp(item.id)}>Eliminar</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar SMTP" : "Nueva configuración SMTP"}>
        <form onSubmit={submitSmtp} className="space-y-4">
          <Input label="Nombre (ej. Gmail, Office)" name="nombre" value={form.nombre} onChange={(e) => changeSmtpForm("nombre", e.target.value)} required />
          <Input label="Servidor" name="servidor" value={form.servidor} onChange={(e) => changeSmtpForm("servidor", e.target.value)} placeholder="smtp.ejemplo.com" required />
          <Input label="Puerto" name="puerto" type="number" value={String(form.puerto)} onChange={(e) => changeSmtpForm("puerto", e.target.value ? parseInt(e.target.value, 10) : 587)} required />
          <Input label="Usuario" name="usuario" value={form.usuario} onChange={(e) => changeSmtpForm("usuario", e.target.value)} required />
          <Input label="Contraseña" name="password" type="password" value={form.password} onChange={(e) => changeSmtpForm("password", e.target.value)} placeholder={editing ? "Dejar vacío para no cambiar" : ""} required={!editing} />
          <div className="grid grid-cols-2 gap-4">
            <Switch label="Usar TLS" checked={form.usar_tls} onChange={(c) => changeSmtpForm("usar_tls", c)} />
            <Switch label="Usar SSL" checked={form.usar_ssl} onChange={(c) => changeSmtpForm("usar_ssl", c)} />
          </div>
          <Input label="Remitente (nombre)" name="remitente_nombre" value={form.remitente_nombre} onChange={(e) => changeSmtpForm("remitente_nombre", e.target.value)} />
          <Input label="Remitente (email)" name="remitente_email" type="email" value={form.remitente_email} onChange={(e) => changeSmtpForm("remitente_email", e.target.value)} required />
          <Switch label="Activo" checked={form.activo} onChange={(c) => changeSmtpForm("activo", c)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              type="submit"
              variant="primary"
              disabled={saving || (editing ? !canUpdate : !canCreate)}
            >
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function AreasTab() {
  const { user } = useUser();
  const { can } = usePermisos();
  const canAreaCreate = canConfigAreasCrear(can);
  const canAreaUpdate = canConfigAreasActualizar(can);
  const canAreaDelete = canConfigAreasEliminar(can);
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ nombre: "", descripcion: "", codigo: "", activo: true, usuario_id: "" as string });

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await apiService.getAreas();
      setItems(data);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al cargar áreas");
    } finally {
      setLoading(false);
    }
  };

  const loadUsuarios = async () => {
    try {
      const data = await apiService.getUsers(0, 500);
      setUsuarios(Array.isArray(data) ? data : []);
    } catch {
      setUsuarios([]);
    }
  };

  useEffect(() => {
    if (user) {
      loadItems();
      loadUsuarios();
    }
  }, [user]);

  const openCreate = () => {
    setEditing(null);
    setForm({ nombre: "", descripcion: "", codigo: "", activo: true, usuario_id: "" });
    setModalOpen(true);
  };

  const openEdit = (area: any) => {
    setEditing(area);
    setForm({
      nombre: area.nombre || "",
      descripcion: area.descripcion || "",
      codigo: area.codigo || "",
      activo: !!area.activo,
      usuario_id: area.usuario_id || "",
    });
    setModalOpen(true);
  };

  const changeForm = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { nombre: form.nombre, descripcion: form.descripcion || undefined, codigo: form.codigo || undefined, activo: form.activo, usuario_id: form.usuario_id || null };
      if (editing) {
        await apiService.updateArea(editing.id, payload);
        await swalSuccess("Área actualizada");
      } else {
        await apiService.createArea(payload);
        await swalSuccess("Área creada");
      }
      setModalOpen(false);
      loadItems();
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al guardar área");
    }
  };

  const deleteItem = async (id: string) => {
    const confirmed = await swalConfirmDelete("¿Está seguro de eliminar esta área? Esta acción no se puede deshacer.");
    if (!confirmed) return;
    try {
      await apiService.deleteArea(id);
      await swalSuccess("Área eliminada");
      loadItems();
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al eliminar área");
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold">Áreas</h2>
          <p className="text-sm text-gray-500">Gestiona las áreas responsables dentro de la empresa.</p>
        </div>
        {canAreaCreate && (
          <Button variant="primary" onClick={openCreate}>Nueva área</Button>
        )}
      </div>
      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : (
        <AreasTable
          data={items}
          onEdit={openEdit}
          onDelete={deleteItem}
          canEdit={canAreaUpdate}
          canDelete={canAreaDelete}
        />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar área" : "Nueva área"}>
        <form onSubmit={submit} className="space-y-4">
          <fieldset
            disabled={editing ? !canAreaUpdate : !canAreaCreate}
            className="min-w-0 border-0 p-0 m-0 space-y-4 disabled:opacity-60"
          >
          <Input label="Nombre" name="nombre" value={form.nombre} onChange={changeForm} required />
          <Input label="Código" name="codigo" value={form.codigo || ""} onChange={changeForm} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Jefe de área</label>
            <select
              name="usuario_id"
              value={form.usuario_id}
              onChange={(e) => setForm((prev) => ({ ...prev, usuario_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
                <option value="">Sin asignar</option>
                {usuarios.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {getUserDisplayName(u, u.email)}
                  </option>
                ))}
              </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
            <textarea
              name="descripcion"
              value={form.descripcion || ""}
              onChange={changeForm}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <Switch
            label="Activo"
            checked={!!form.activo}
            onChange={(checked) => setForm((prev) => ({ ...prev, activo: checked }))}
          />
          </fieldset>
          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">{editing ? "Guardar" : "Crear"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function AreasTable({
  data,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: {
  data: any[];
  onEdit: (row: any) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const columns: ColumnDef<any>[] = [
    {
      header: "Nombre",
      accessorKey: "nombre",
      cell: (info) => <span className="text-sm text-gray-900">{info.getValue() as string}</span>,
    },
    {
      header: "Código",
      accessorKey: "codigo",
      cell: (info) => <span className="text-sm text-gray-600">{(info.getValue() as string) || "-"}</span>,
    },
    {
      header: "Jefe de área",
      accessorKey: "jefe_nombre",
      cell: (info) => <span className="text-sm text-gray-600">{(info.getValue() as string) || "-"}</span>,
    },
    {
      header: "Activo",
      accessorKey: "activo",
      cell: (info) => <span className="text-sm text-gray-600">{info.getValue() ? "Sí" : "No"}</span>,
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end">
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={() => onEdit(row.original)}>Editar</Button>
          )}
          {canDelete && (
            <Button variant="danger" size="sm" onClick={() => onDelete(row.original.id)}>Eliminar</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      layoutStorageKey="aslin-datatable-config-areas"
      columns={columns}
      data={data}
      emptyText="No hay áreas registradas"
    />
  );
}

function DocumentosTab() {
  const { can } = usePermisos();
  const canCfgCreate = can(MODULO.configuracion, ACCION.create);
  const canCfgUpdate = can(MODULO.configuracion, ACCION.update);
  const canCfgDelete = can(MODULO.configuracion, ACCION.delete);
  const router = useRouter();
  const [siniestroId, setSiniestroId] = useState("");
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    nombre_archivo: "",
    ruta_archivo: "",
    descripcion: "",
    version: 1,
    es_principal: false,
    es_adicional: false,
    activo: true,
  });

  const loadDocumentos = async () => {
    const objetivo = siniestroId.trim();
    if (!objetivo) {
      setDocumentos([]);
      return;
    }
    try {
      setLoading(true);
      const data = await apiService.getDocumentosSiniestro(objetivo, { limit: 200 });
      setDocumentos(data);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al cargar documentos");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      nombre_archivo: "",
      ruta_archivo: "",
      descripcion: "",
      version: 1,
      es_principal: false,
      es_adicional: false,
      activo: true,
    });
    setModalOpen(true);
  };

  const openEdit = (documento: any) => {
    setEditing(documento);
    setForm({
      nombre_archivo: documento.nombre_archivo || "",
      ruta_archivo: documento.ruta_archivo || "",
      descripcion: documento.descripcion || "",
      version: documento.version || 1,
      es_principal: !!documento.es_principal,
      es_adicional: !!documento.es_adicional,
      activo: !!documento.activo,
    });
    setModalOpen(true);
  };

  const changeForm = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const objetivo = siniestroId.trim();
    if (!objetivo) {
      swalError("Debes indicar un siniestro para gestionar documentos");
      return;
    }
    try {
      if (editing) {
        await apiService.updateDocumento(editing.id, {
          nombre_archivo: form.nombre_archivo,
          descripcion: form.descripcion,
          es_principal: form.es_principal,
          es_adicional: form.es_adicional,
          activo: form.activo,
        });
        await swalSuccess("Documento actualizado");
      } else {
        await apiService.createDocumento({
          siniestro_id: objetivo,
          nombre_archivo: form.nombre_archivo,
          ruta_archivo: form.ruta_archivo && form.ruta_archivo.trim() ? form.ruta_archivo : null,
          descripcion: form.descripcion,
          version: Number(form.version) || 1,
          es_principal: form.es_principal,
          es_adicional: form.es_adicional,
          activo: form.activo,
        });
        await swalSuccess("Documento creado");
      }
      setModalOpen(false);
      loadDocumentos();
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al guardar documento");
    }
  };

  const deleteDocumento = async (id: string) => {
    const confirmed = await swalConfirm(
      "Se eliminará el documento del expediente.",
      "Eliminar del expediente",
      "Sí, eliminar",
      "Cancelar",
    );
    if (!confirmed) return;
    try {
      await apiService.deleteDocumento(id);
      await swalSuccess("Documento eliminado");
      loadDocumentos();
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al eliminar documento");
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Documentos</h2>
          <p className="text-sm text-gray-500">
            Administra los documentos asociados a un siniestro específico.
          </p>
        </div>
        <div className="flex gap-3">
          <Input
            label="ID de siniestro"
            name="siniestro_id"
            value={siniestroId}
            onChange={(e) => {
              const value = e.target.value;
              setSiniestroId(value);
              if (!value.trim()) {
                setDocumentos([]);
              }
            }}
          />
          <Button variant="secondary" onClick={loadDocumentos}>
            Buscar
          </Button>
        </div>
      </div>

      {siniestroId && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">
            {documentos.length} documento(s) encontrados.
          </p>
          {canCfgCreate && (
            <Button variant="primary" onClick={openCreate}>
              Nuevo documento
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Cargando documentos...</p>
      ) : documentos.length > 0 ? (
        <DocumentosTable
          data={documentos}
          onEdit={openEdit}
          onDelete={deleteDocumento}
          canEdit={canCfgUpdate}
          canDelete={canCfgDelete}
        />
      ) : siniestroId ? (
        <p className="text-gray-500">No hay documentos para el siniestro indicado.</p>
      ) : (
        <p className="text-gray-500">Ingresa un siniestro para consultar documentos.</p>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar documento" : "Nuevo documento"}
      >
        <form onSubmit={submit} className="space-y-4">
          <Input
            label="Nombre del archivo"
            name="nombre_archivo"
            value={form.nombre_archivo}
            onChange={changeForm}
            required
          />
          <Input
            label="Ruta del archivo"
            name="ruta_archivo"
            value={form.ruta_archivo}
            onChange={changeForm}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
            <textarea
              name="descripcion"
              value={form.descripcion || ""}
              onChange={changeForm}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <Input
            label="Versión"
            name="version"
            type="number"
            value={String(form.version)}
            onChange={changeForm}
          />
          <div className="flex items-center gap-4">
            <Switch
              label="Principal"
              checked={form.es_principal}
              onChange={(checked) => setForm((prev) => ({ ...prev, es_principal: checked }))}
            />
            <Switch
              label="Adicional"
              checked={form.es_adicional}
              onChange={(checked) => setForm((prev) => ({ ...prev, es_adicional: checked }))}
            />
            <Switch
              label="Activo"
              checked={form.activo}
              onChange={(checked) => setForm((prev) => ({ ...prev, activo: checked }))}
            />
          </div>
          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              type="submit"
              variant="primary"
              disabled={editing ? !canCfgUpdate : !canCfgCreate}
            >
              {editing ? "Guardar" : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function DocumentosTable({
  data,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: {
  data: any[];
  onEdit: (row: any) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const columns: ColumnDef<any>[] = [
    {
      header: "Nombre",
      accessorKey: "nombre_archivo",
      cell: (info) => <span className="text-sm text-gray-900">{info.getValue() as string}</span>,
    },
    {
      header: "Descripción",
      accessorKey: "descripcion",
      cell: (info) => {
        const descripcion = (info.getValue() as string) || "-";
        return (
          <span className="text-sm text-gray-600" title={descripcion !== "-" ? descripcion : undefined}>
            {descripcion.length > 300 ? descripcion.substring(0, 300) + "..." : descripcion}
          </span>
        );
      },
    },
    {
      header: "Versión",
      accessorKey: "version",
      cell: (info) => <span className="text-sm text-gray-600">{info.getValue() as number}</span>,
    },
    {
      header: "Principal",
      accessorKey: "es_principal",
      cell: (info) => <span className="text-sm text-gray-600">{info.getValue() ? "Sí" : "No"}</span>,
    },
    {
      header: "Activo",
      accessorKey: "activo",
      cell: (info) => <span className="text-sm text-gray-600">{info.getValue() ? "Sí" : "No"}</span>,
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end">
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={() => onEdit(row.original)}>Editar</Button>
          )}
          {canDelete && (
            <Button variant="danger" size="sm" onClick={() => onDelete(row.original.id)}>Eliminar</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      layoutStorageKey="aslin-datatable-config-documentos"
      columns={columns}
      data={data}
      emptyText="No hay documentos disponibles"
    />
  );
}

function PlantillasTab() {
  const { user } = useUser();
  const { can } = usePermisos();
  const canCatCreate = canCatalogoDocumentoCrear(can);
  const canCatUpdate = canCatalogoDocumentoActualizar(can);
  const canCatDelete = canCatalogoDocumentoEliminar(can);
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [categoriasModalOpen, setCategoriasModalOpen] = useState(false);
  const [plantillasSinCategoriaModalOpen, setPlantillasSinCategoriaModalOpen] = useState(false);
  const [tipoDocumentoSeleccionado, setTipoDocumentoSeleccionado] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewPlantilla, setPreviewPlantilla] = useState<any | null>(null);
  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    area_id: "",
    formato: "",
    tipo: "editor",
    plantilla: "",
    activo: true,
  });

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await apiService.getPlantillas();
      setItems(data);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al cargar tipos de documento");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadItems();
    }
  }, [user]);

  const openCreate = () => {
    setEditing(null);
    setForm({ nombre: "", descripcion: "", area_id: "", formato: "", tipo: "editor", plantilla: "", activo: true });
    setModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      nombre: item.nombre || "",
      descripcion: item.descripcion || "",
      area_id: item.area_id || "",
      formato: item.formato || "",
      tipo: item.tipo || "editor",
      plantilla: item.plantilla || "",
      activo: !!item.activo,
    });
    setModalOpen(true);
  };

  const changeForm = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Convertir cadenas vacías a null para campos UUID opcionales
      const formData = {
        ...form,
        area_id: form.area_id && form.area_id.trim() !== "" ? form.area_id : null,
      };
      
      if (editing) {
        await apiService.updatePlantilla(editing.id, formData);
        await swalSuccess("Tipo de documento actualizado");
      } else {
        await apiService.createPlantilla(formData);
        await swalSuccess("Tipo de documento creado");
      }
      setModalOpen(false);
      loadItems();
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al guardar");
    }
  };

  const deletePlantilla = async (id: string) => {
    const confirmed = await swalConfirmDelete("¿Eliminar plantilla? Esta acción no se puede deshacer.");
    if (!confirmed) return;
    try {
      await apiService.deletePlantilla(id);
      await swalSuccess("Plantilla eliminada");
      loadItems();
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al eliminar");
    }
  };

  const openPreview = (plantilla: any) => {
    setPreviewPlantilla(plantilla);
    setPreviewModalOpen(true);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Tipos de documento</h2>
          <p className="text-sm text-gray-500">Define los tipos de documentos disponibles para generar documentos de siniestros.</p>
        </div>
        {canCatCreate && (
          <Button variant="primary" onClick={openCreate}>Nuevo tipo de documento</Button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando tipos de documento...</p>
      ) : (
        <PlantillasTable 
          data={items} 
          onEdit={openEdit} 
          onDelete={deletePlantilla} 
          onPreview={openPreview}
          canEdit={canCatUpdate}
          canDelete={canCatDelete}
          canOpenSubcatalogos={canCatalogoDocumentoLeer(can)}
          onVerCategorias={(tipo) => {
            setTipoDocumentoSeleccionado(tipo);
            setCategoriasModalOpen(true);
          }}
          onVerPlantillasSinCategoria={(tipo) => {
            setTipoDocumentoSeleccionado(tipo);
            setPlantillasSinCategoriaModalOpen(true);
          }}
        />
      )}

      <Modal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title={editing ? "Editar tipo de documento" : "Nuevo tipo de documento"}
        maxWidthClass="max-w-4xl"
        maxHeightClass="max-h-[95vh]"
      >
        <form onSubmit={submit} className="space-y-4">
          <Input label="Nombre" name="nombre" value={form.nombre} onChange={changeForm} required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
            <textarea
              name="descripcion"
              value={form.descripcion || ""}
              onChange={changeForm}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de plantilla</label>
              <select
                name="tipo"
                value={form.tipo}
                onChange={changeForm}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                required
              >
                <option value="editor">Editor (contenido editable)</option>
                <option value="pdf">PDF</option>
                <option value="imagen">Imagen</option>
              </select>
            </div>
            <div>
              <Input
                label="Formato (opcional)"
                name="formato"
                value={form.formato || ""}
                onChange={changeForm}
                placeholder="Ej. A4, oficio, carta"
              />
            </div>
          </div>          
          <Switch
            label="Activo"
            checked={!!form.activo}
            onChange={(checked) => setForm((prev) => ({ ...prev, activo: checked }))}
          />
          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              type="submit"
              variant="primary"
              disabled={editing ? !canCatUpdate : !canCatCreate}
            >
              {editing ? "Guardar" : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de previsualización de PDF */}
      <Modal
        open={previewModalOpen}
        onClose={() => {
          setPreviewModalOpen(false);
          setPreviewPlantilla(null);
        }}
        title={`Previsualizar PDF - ${previewPlantilla?.nombre || ""}`}
        maxWidthClass="max-w-6xl"
        maxHeightClass="max-h-[95vh]"
      >
        {previewPlantilla && (
          <PDFPreviewModal
            plantillaId={previewPlantilla.id}
            plantillaNombre={previewPlantilla.nombre}
            onClose={() => {
              setPreviewModalOpen(false);
              setPreviewPlantilla(null);
            }}
          />
        )}
      </Modal>

      {/* Modal de categorías */}
      {tipoDocumentoSeleccionado && (
        <CategoriasModal
          open={categoriasModalOpen}
          onClose={() => {
            setCategoriasModalOpen(false);
            setTipoDocumentoSeleccionado(null);
          }}
          tipoDocumento={tipoDocumentoSeleccionado}
        />
      )}

      {/* Modal de plantillas sin categoría */}
      {tipoDocumentoSeleccionado && (
        <PlantillasSinCategoriaModal
          open={plantillasSinCategoriaModalOpen}
          onClose={() => {
            setPlantillasSinCategoriaModalOpen(false);
            setTipoDocumentoSeleccionado(null);
          }}
          tipoDocumento={tipoDocumentoSeleccionado}
          onSuccess={loadItems}
        />
      )}
    </div>
  );
}

function PlantillasTable({ 
  data, 
  onEdit, 
  onDelete, 
  onPreview,
  onVerCategorias,
  onVerPlantillasSinCategoria,
  canEdit,
  canDelete,
  canOpenSubcatalogos,
}: { 
  data: any[]; 
  onEdit: (row: any) => void; 
  onDelete: (id: string) => void;
  onPreview: (row: any) => void;
  onVerCategorias: (row: any) => void;
  onVerPlantillasSinCategoria: (row: any) => void;
  canEdit: boolean;
  canDelete: boolean;
  canOpenSubcatalogos: boolean;
}) {
  const columns: ColumnDef<any>[] = [
    {
      header: "Nombre",
      accessorKey: "nombre",
      cell: (info) => <span className="text-sm text-gray-900">{info.getValue() as string}</span>,
    },
    {
      header: "Descripción",
      accessorKey: "descripcion",
      cell: (info) => {
        const descripcion = (info.getValue() as string) || "-";
        return (
          <span className="text-sm text-gray-600" title={descripcion !== "-" ? descripcion : undefined}>
            {descripcion.length > 300 ? descripcion.substring(0, 300) + "..." : descripcion}
          </span>
        );
      },
    },
    {
      header: "Tipo",
      accessorKey: "tipo",
      cell: (info) => {
        const value = info.getValue() as string | undefined;
        const label = value === "pdf" ? "PDF" : value === "imagen" ? "Imagen" : "Editor";
        return <span className="text-sm text-gray-600">{label}</span>;
      },
    },
    {
      header: "Formato",
      accessorKey: "formato",
      cell: (info) => <span className="text-sm text-gray-600">{(info.getValue() as string) || "-"}</span>,
    },
    {
      header: "Activo",
      accessorKey: "activo",
      cell: (info) => <span className="text-sm text-gray-600">{info.getValue() ? "Sí" : "No"}</span>,
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => {
        const tipo = row.original;
        const canPreview = tipo.tipo === "editor" && tipo.plantilla;
        
        return (
          <div className="flex gap-2 justify-end">
            {canOpenSubcatalogos && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onVerCategorias(tipo)}
                title="Ver categorías de este tipo de documento"
              >
                <FiFolder className="w-4 h-4 mr-1" />
                Categorías
              </Button>
            )}
            {canOpenSubcatalogos && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onVerPlantillasSinCategoria(tipo)}
                title="Ver plantillas sin categoría"
              >
                <FiFileText className="w-4 h-4 mr-1" />
                Plantillas
              </Button>
            )}
            {canPreview && (
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => onPreview(tipo)}
                title="Previsualizar PDF"
              >
                <FiEye className="w-4 h-4 mr-1" />
                Vista Previa
              </Button>
            )}
            {canEdit && (
              <Button variant="secondary" size="sm" onClick={() => onEdit(tipo)}>Editar</Button>
            )}
            {canDelete && (
              <Button variant="danger" size="sm" onClick={() => onDelete(tipo.id)}>Eliminar</Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      layoutStorageKey="aslin-datatable-config-plantillas"
      columns={columns}
      data={data}
      emptyText="No hay plantillas registradas"
    />
  );
}
