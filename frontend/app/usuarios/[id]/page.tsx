"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { usePermisos } from "@/hooks/usePermisos";
import { MODULO, ACCION } from "@/lib/permisosConstants";
import apiService from "@/lib/apiService";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import CustomSelect, { SelectOption } from "@/components/ui/Select";
import { swalSuccess, swalError, swalInfo } from "@/lib/swal";
import { getUserDisplayName, getUserInitial } from "@/lib/userName";
import { compressImageFileToDataUrl } from "@/lib/imageDataUrl";
import { FiArrowLeft, FiSave } from "react-icons/fi";

interface User {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  nombre?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  is_active: boolean;
  two_factor_enabled?: boolean;
  created_at: string;
  empresa?: { id: string; nombre: string } | null;
  empresas?: { id: string; nombre: string }[] | null;
  rol?: { id: string; nombre: string } | null;
  areas?: { id: string; nombre: string }[] | null;
  perfil?: {
    nombre?: string;
    apellido_paterno?: string;
    apellido_materno?: string;
    titulo?: string;
    cedula_profesional?: string;
    firma?: string | null;
    firma_digital?: string | null;
  } | null;
  contactos?: {
    telefono?: string;
    celular?: string;
  } | null;
  direccion?: {
    direccion?: string;
    ciudad?: string;
    estado?: string;
    codigo_postal?: string;
    pais?: string;
  } | null;
}

export default function EditarUsuarioPage() {
  const router = useRouter();
  const params = useParams();
  const { user: currentUser, loading } = useUser();
  const { can } = usePermisos();
  const puedeEditarUsuario = can(MODULO.usuarios, ACCION.update);
  const puedeListarRoles = can(MODULO.usuarios, ACCION.ver_roles);
  const [loadingUser, setLoadingUser] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const canEditFirmas = currentUser?.rol?.nivel === 0 || currentUser?.rol?.nivel === 1;

  const [twoFA, setTwoFA] = useState({ enable: false, code: "", otpauth: "" });
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [savingSecurity, setSavingSecurity] = useState(false);

  const [form, setForm] = useState({
    email: "",
    username: "",
    empresa_ids: [] as string[],
    area_ids: [] as string[],
    rol_id: "",
    is_active: true,
    two_factor_enabled: false,
    password: "",
    perfil: {
      nombre: "",
      apellido_paterno: "",
      apellido_materno: "",
      titulo: "",
      cedula_profesional: "",
      firma: "",
      firma_digital: "",
    },
    contactos: {
      telefono: "",
      celular: "",
    },
    direccion: {
      direccion: "",
      ciudad: "",
      estado: "",
      codigo_postal: "",
      pais: "",
    },
  });

  useEffect(() => {
    if (loading) return;
    const token = localStorage.getItem("token");
    if (!token || !currentUser) {
      router.push("/login");
      return;
    }
    loadUser();
    if (puedeListarRoles) loadRoles();
    loadEmpresas();
    loadAreas();
  }, [currentUser, loading, router, params.id, puedeListarRoles]);

  useEffect(() => {
    if (!user) return;
    setTwoFA((prev) => ({
      ...prev,
      enable: !!user.two_factor_enabled,
      code: "",
      otpauth: "",
    }));
    setQrDataUrl("");
  }, [user?.id, user?.two_factor_enabled]);

  useEffect(() => {
    let cancelled = false;
    async function genQR() {
      if (!twoFA.otpauth) {
        setQrDataUrl("");
        return;
      }
      try {
        const qr = await import("qrcode");
        const url = await qr.toDataURL(twoFA.otpauth);
        if (!cancelled) setQrDataUrl(url);
      } catch {
        if (!cancelled) {
          setQrDataUrl("");
          swalError("No se pudo generar el QR localmente");
        }
      }
    }
    genQR();
    return () => {
      cancelled = true;
    };
  }, [twoFA.otpauth]);

  const loadRoles = async () => {
    try {
      const data = await apiService.getRoles(true); // Solo activos
      setRoles(data);
    } catch (e: any) {
      console.error("Error al cargar roles:", e);
    }
  };

  const loadEmpresas = async () => {
    try {
      const data = await apiService.getEmpresas?.() || (await apiService.empresa.getEmpresas());
      setEmpresas(data || []);
    } catch (e: any) {
      console.error("Error al cargar empresas:", e);
      console.error("Error completo:", e.response?.data || e.message);
      swalError(e.response?.data?.detail || "Error al cargar empresas");
    }
  };

  const loadAreas = async () => {
    try {
      const data = await apiService.getAreas?.(true) ?? [];
      setAreas(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error("Error al cargar áreas:", e);
    }
  };

  const loadUser = async () => {
    try {
      setLoadingUser(true);
      const userId = params.id as string;
      const data = await apiService.getUserById(userId);
      setUser(data);
      setForm({
        email: data.email || "",
        username: data.username || "",
        empresa_ids: data.empresas?.map((empresa: any) => empresa.id) || (data.empresa ? [data.empresa.id] : []),
        area_ids: data.areas?.map((a: { id: string }) => a.id) || [],
        rol_id: data.rol?.id || "",
        is_active: data.is_active ?? true,
        two_factor_enabled: !!data.two_factor_enabled,
        password: "",
        perfil: {
          nombre: data.perfil?.nombre || data.nombre || "",
          apellido_paterno: data.perfil?.apellido_paterno || data.apellido_paterno || "",
          apellido_materno: data.perfil?.apellido_materno || data.apellido_materno || "",
          titulo: data.perfil?.titulo || "",
          cedula_profesional: data.perfil?.cedula_profesional || "",
          firma: data.perfil?.firma || "",
          firma_digital: data.perfil?.firma_digital || "",
        },
        contactos: {
          telefono: data.contactos?.telefono || "",
          celular: data.contactos?.celular || "",
        },
        direccion: {
          direccion: data.direccion?.direccion || "",
          ciudad: data.direccion?.ciudad || "",
          estado: data.direccion?.estado || "",
          codigo_postal: data.direccion?.codigo_postal || "",
          pais: data.direccion?.pais || "",
        },
      });
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      if (e.response?.status === 404) {
        swalError("Usuario no encontrado");
        router.push("/usuarios");
        return;
      }
      swalError(e.response?.data?.detail || "Error al cargar usuario");
    } finally {
      setLoadingUser(false);
    }
  };

  const onChange = (section: "perfil" | "contactos" | "direccion" | "main", field: string, value: any) => {
    if (section === "main") {
      setForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    } else {
      setForm((prev: any) => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value,
        },
      }));
    }
  };

  const handleFirmaFile = async (
    field: "firma" | "firma_digital",
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!canEditFirmas) {
      swalError("Solo los roles nivel 0 o 1 pueden editar firmas.");
      e.target.value = "";
      return;
    }
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      swalError("Selecciona un archivo de imagen (PNG, JPG, etc.)");
      e.target.value = "";
      return;
    }
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxEdge: 1400,
        mime: "image/jpeg",
        quality: 0.88,
      });
      setForm((prev) => ({
        ...prev,
        perfil: { ...prev.perfil, [field]: dataUrl },
      }));
    } catch {
      swalError("No se pudo procesar la imagen de firma. Prueba con otro archivo.");
    }
    e.target.value = "";
  };

  const clearFirma = (field: "firma" | "firma_digital") => {
    if (!canEditFirmas) return;
    setForm((prev) => ({
      ...prev,
      perfil: { ...prev.perfil, [field]: "" },
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeEditarUsuario) {
      swalError("No tienes permiso para modificar usuarios.");
      return;
    }
    setSaving(true);
    try {
      const userId = params.id as string;
      const updateData: any = {
        email: form.email,
        username: form.username,
        empresa_ids: form.empresa_ids || [],
        area_ids: form.area_ids || [],
        rol_id: form.rol_id || null,
        is_active: form.is_active,
        perfil: form.perfil,
        contactos: form.contactos,
        direccion: form.direccion,
      };
      if (!canEditFirmas) {
        updateData.two_factor_enabled = form.two_factor_enabled;
      }

      // Solo incluir password si se proporcionó uno nuevo
      if (form.password && form.password.trim() !== "") {
        updateData.password = form.password;
      }

      await apiService.updateUser(userId, updateData);
      await swalSuccess("Usuario actualizado correctamente");
      router.push("/usuarios");
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      const status = e.response?.status;
      if (status === 413) {
        swalError(
          "El servidor rechazó la petición por tamaño (413). Si subiste firmas, usa imágenes más pequeñas. " +
            "Si el error persiste, el administrador debe aumentar el límite del cuerpo HTTP en Apache (LimitRequestBody) o en el proxy.",
        );
      } else {
        swalError(e.response?.data?.detail || "Error al actualizar usuario");
      }
    } finally {
      setSaving(false);
    }
  };

  const onGuardarSeguridad2FA = async () => {
    if (!canEditFirmas) return;
    const userId = params.id as string;
    setSavingSecurity(true);
    try {
      if (twoFA.enable !== !!user?.two_factor_enabled) {
        await apiService.toggleUser2FA(userId, twoFA.enable);
        setTwoFA((prev) => ({ ...prev, code: "", otpauth: "" }));
        setQrDataUrl("");
        await loadUser();
        await swalSuccess("Estado de 2FA actualizado");
      } else {
        await swalInfo("No hay cambios de 2FA que guardar.");
      }
    } catch (err: any) {
      swalError(err.response?.data?.detail || "Error al actualizar 2FA");
    } finally {
      setSavingSecurity(false);
    }
  };

  if (loading || loadingUser || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/usuarios")}
            className="text-gray-600 hover:text-gray-900 transition-colors"
            title="Volver"
          >
            <FiArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {puedeEditarUsuario ? "Editar Usuario" : "Usuario"}
            </h1>
            <p className="text-sm text-gray-600">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Información de usuario */}
      <div className="rounded-xl bg-degradado-primario text-white shadow">
        <div className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/25 grid place-items-center text-2xl font-semibold">
              <span>
                {getUserInitial(user)}
              </span>
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold leading-tight">
                {getUserDisplayName(user, user.email)}
              </h2>
              <p className="text-white/80 text-sm md:text-base">
                {user.rol?.nombre || "Sin rol"} ·{" "}
                {(user.empresas && user.empresas.length > 0
                  ? user.empresas.map((empresa) => empresa.nombre).join(" · ")
                  : user.empresa?.nombre) || "Sin empresa"}
                {(user.areas && user.areas.length > 0) && (
                  <> · Áreas: {user.areas.map((a: { nombre: string }) => a.nombre).join(" · ")}</>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm ${
              user.is_active ? "" : "opacity-75"
            }`}>
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  user.is_active ? "bg-green-300" : "bg-red-300"
                }`}
              />
              {user.is_active ? "Cuenta activa" : "Cuenta inactiva"}
            </span>
            <span className="hidden sm:inline text-white/80">|</span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm">
              2FA: {user.two_factor_enabled ? "Habilitado" : "Deshabilitado"}
            </span>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={onSubmit} className="space-y-6">        
        <fieldset
          disabled={!puedeEditarUsuario}
          className="min-w-0 border-0 p-0 m-0 space-y-6 disabled:opacity-60"
        >
        {/* Información básica */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-black/5 p-6">
          <h2 className="font-semibold text-lg mb-4">Información de cuenta</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Email *"
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => onChange("main", "email", e.target.value)}
              required
            />
            <Input
              label="Username"
              name="username"
              value={form.username}
              onChange={(e) => onChange("main", "username", e.target.value)}
            />
            <CustomSelect
              label="Rol"
              name="rol_id"
              value={form.rol_id}
              onChange={(value) => onChange("main", "rol_id", value as string)}
              options={[
                { value: "", label: "Sin rol" },
                ...roles.map((rol) => ({
                  value: rol.id,
                  label: rol.nombre,
                })),
              ]}
              placeholder="Sin rol"
            />
            <div className="md:col-span-2">
              <CustomSelect
                label="Empresas asignadas"
                name="empresa_ids"
                value={form.empresa_ids}
                onChange={(value) => onChange("main", "empresa_ids", value as string[])}
                options={empresas.map((empresa) => ({
                  value: empresa.id,
                  label: empresa.nombre,
                }))}
                isMulti={true}
                placeholder="Selecciona una o varias empresas"
              />
            </div>
            <div className="md:col-span-2">
              <CustomSelect
                label="Áreas asignadas"
                name="area_ids"
                value={form.area_ids}
                onChange={(value) => onChange("main", "area_ids", value as string[])}
                options={areas.map((area: { id: string; nombre: string }) => ({
                  value: area.id,
                  label: area.nombre,
                }))}
                isMulti={true}
                placeholder="Selecciona una o varias áreas"
              />
            </div>
            <div>
              <Switch
                label="Usuario activo"
                checked={form.is_active}
                onChange={(checked) => onChange("main", "is_active", checked)}
              />
            </div>
          </div>
        </div>

        {/* Datos personales */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-black/5 p-6">
          <h2 className="font-semibold text-lg mb-4">Datos personales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <CustomSelect
                label="Trato Prof."
                name="titulo"
                value={form.perfil.titulo || ""}
                onChange={(value) => onChange("perfil", "titulo", value as string)}
                options={[
                  { value: "", label: "Sin trato" },
                  { value: "Lic.", label: "Lic. (Licenciado)" },
                  { value: "Licda.", label: "Licda. (Licenciada)" },
                  { value: "Ing.", label: "Ing. (Ingeniero)" },
                  { value: "Inga.", label: "Inga. (Ingeniera)" },
                  { value: "Dr.", label: "Dr. (Doctor)" },
                  { value: "Dra.", label: "Dra. (Doctora)" },
                  { value: "Mtro.", label: "Mtro. (Maestro)" },
                  { value: "Mtra.", label: "Mtra. (Maestra)" },
                  { value: "Arq.", label: "Arq. (Arquitecto)" },
                  { value: "Arqa.", label: "Arqa. (Arquitecta)" },
                  { value: "C.P.", label: "C.P. (Contador Público)" },
                  { value: "C.P.A.", label: "C.P.A. (Contadora Pública)" },
                  { value: "Q.F.B.", label: "Q.F.B. (Químico Farmacéutico Biólogo)" },  
                  { value: "Q.F.B.A.", label: "Q.F.B.A. (Química Farmacéutica Bióloga)" },
                  { value: "M.C.", label: "M.C. (Maestro en Ciencias)" },
                  { value: "M.C.A.", label: "M.C.A. (Maestra en Ciencias)" },
                  { value: "Ph.D.", label: "Ph.D. (Doctor en Filosofía)" },
                  { value: "M.D.", label: "M.D. (Doctor en Medicina)" },
                  { value: "Abog.", label: "Abog. (Abogado)" },
                  { value: "Abogda.", label: "Abogda. (Abogada)" },
                  { value: "Psic.", label: "Psic. (Psicólogo)" },
                  { value: "Psica.", label: "Psica. (Psicóloga)" },
                ]}
                placeholder="Sin trato"
              />
              <Input
                label="Nombre"
                name="nombre"
                value={form.perfil.nombre}
                onChange={(e) => onChange("perfil", "nombre", e.target.value)}
              />
            </div>
            <Input
              label="Apellido paterno"
              name="apellido_paterno"
              value={form.perfil.apellido_paterno}
              onChange={(e) => onChange("perfil", "apellido_paterno", e.target.value)}
            />
            <Input
              label="Apellido materno"
              name="apellido_materno"
              value={form.perfil.apellido_materno}
              onChange={(e) => onChange("perfil", "apellido_materno", e.target.value)}
            />
            <Input
              label="Cédula profesional"
              name="cedula_profesional"
              value={form.perfil.cedula_profesional}
              onChange={(e) => onChange("perfil", "cedula_profesional", e.target.value)}
            />
          </div>

          <div className="md:col-span-2 space-y-3 pt-2 border-t border-gray-100">
            <div>
              <h3 className="font-medium text-gray-900">Firmas</h3>
              <p className="text-sm text-gray-500">
                Imágenes de firma para documentos y correos (mismo criterio que Mi perfil).                
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-4 bg-gray-50/50">
                <label className="block text-sm font-medium text-gray-700 mb-2">Firma física</label>
                <p className="text-xs text-gray-500 mb-2">Firma literal en documentos y PDFs.</p>
                {form.perfil.firma ? (
                  <div className="flex flex-col gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.perfil.firma}
                      alt="Firma"
                      className="max-h-24 w-auto object-contain border rounded bg-white"
                    />
                    {canEditFirmas && (
                      <Button type="button" variant="secondary" size="sm" onClick={() => clearFirma("firma")}>
                        Quitar firma física
                      </Button>
                    )}
                  </div>
                ) : canEditFirmas ? (
                  <input
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary/90"
                    onChange={(e) => handleFirmaFile("firma", e)}
                  />
                ) : (
                  <p className="text-sm text-gray-400">Sin firma registrada</p>
                )}
              </div>
              <div className="border rounded-lg p-4 bg-gray-50/50">
                <label className="block text-sm font-medium text-gray-700 mb-2">Firma digital</label>
                <p className="text-xs text-gray-500 mb-2">Se puede incluir al enviar correos desde la plataforma.</p>
                {form.perfil.firma_digital ? (
                  <div className="flex flex-col gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.perfil.firma_digital}
                      alt="Firma digital"
                      className="max-h-24 w-auto object-contain border rounded bg-white"
                    />
                    {canEditFirmas && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => clearFirma("firma_digital")}
                      >
                        Quitar firma digital
                      </Button>
                    )}
                  </div>
                ) : canEditFirmas ? (
                  <input
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary/90"
                    onChange={(e) => handleFirmaFile("firma_digital", e)}
                  />
                ) : (
                  <p className="text-sm text-gray-400">Sin firma digital registrada</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Contacto */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-black/5 p-6">
          <h2 className="font-semibold text-lg mb-4">Contacto</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Teléfono"
              name="telefono"
              value={form.contactos.telefono}
              onChange={(e) => onChange("contactos", "telefono", e.target.value)}
            />
            <Input
              label="Celular"
              name="celular"
              value={form.contactos.celular}
              onChange={(e) => onChange("contactos", "celular", e.target.value)}
            />
          </div>
        </div>

        {/* Dirección */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-black/5 p-6">
          <h2 className="font-semibold text-lg mb-4">Dirección</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Dirección"
              name="direccion"
              value={form.direccion.direccion}
              onChange={(e) => onChange("direccion", "direccion", e.target.value)}
            />
            <Input
              label="Ciudad"
              name="ciudad"
              value={form.direccion.ciudad}
              onChange={(e) => onChange("direccion", "ciudad", e.target.value)}
            />
            <Input
              label="Estado"
              name="estado"
              value={form.direccion.estado}
              onChange={(e) => onChange("direccion", "estado", e.target.value)}
            />
            <Input
              label="Código postal"
              name="codigo_postal"
              value={form.direccion.codigo_postal}
              onChange={(e) => onChange("direccion", "codigo_postal", e.target.value)}
            />
            <Input
              label="País"
              name="pais"
              value={form.direccion.pais}
              onChange={(e) => onChange("direccion", "pais", e.target.value)}
            />
          </div>
        </div>
        </fieldset>

        {/* Seguridad: fuera del fieldset (nivel 0/1 puede configurar 2FA aunque el resto sea solo lectura) */}
        {(puedeEditarUsuario || canEditFirmas) && (
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-black/5 p-6 space-y-6">
            <div>
              <h2 className="font-semibold text-lg">Seguridad</h2>
              <p className="text-sm text-gray-500">
                Contraseña y autenticación de dos factores (mismo criterio que Mi perfil para nivel 0/1).
              </p>
            </div>

            {canEditFirmas && (
              <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="font-medium">Autenticación de dos factores (2FA)</h3>
                      <p className="text-sm text-gray-500">Protege la cuenta del usuario con un código TOTP</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTwoFA((s) => ({ ...s, enable: !s.enable }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                        twoFA.enable ? "bg-azul" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          twoFA.enable ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  {twoFA.enable && (
                    <div className="grid grid-cols-1 gap-4">
                      <div className="text-sm text-gray-600">
                        <p className="mb-2">1) Presiona &quot;Mostrar QR/clave&quot;</p>
                        <p className="mb-2">2) El usuario lo escanea con su app de autenticación</p>
                        <p className="mb-2">3) Usa &quot;Guardar seguridad&quot; para aplicar el estado de 2FA</p>
                        <p className="text-xs text-gray-500">
                          Tras habilitar, en el próximo inicio de sesión se pedirá el código 2FA.
                        </p>
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const data = await apiService.getUserOtpAuthUrl(params.id as string);
                                setTwoFA((s) => ({ ...s, otpauth: data.otpauth_url }));
                                await swalInfo("Escanea el QR con la app de autenticación del usuario");
                              } catch (err: any) {
                                swalError(err.response?.data?.detail || "No se pudo generar el QR");
                              }
                            }}
                            className="text-azul underline"
                          >
                            Mostrar QR/clave
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const data = await apiService.getUserOtpAuthUrl(params.id as string);
                                setTwoFA((s) => ({ ...s, otpauth: data.otpauth_url }));
                                await swalSuccess("QR refrescado");
                              } catch (err: any) {
                                swalError(err.response?.data?.detail || "No se pudo refrescar el QR");
                              }
                            }}
                            className="text-azul underline"
                          >
                            Refrescar QR
                          </button>
                          <button
                            type="button"
                            disabled={!qrDataUrl}
                            onClick={async () => {
                              try {
                                if (!qrDataUrl) return;
                                const link = document.createElement("a");
                                link.href = qrDataUrl;
                                link.download = "2fa-qr.png";
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              } catch {
                                swalError("No se pudo descargar el QR");
                              }
                            }}
                            className="text-azul underline disabled:opacity-50"
                          >
                            Descargar QR
                          </button>
                        </div>
                        {twoFA.otpauth && (
                          <div className="mt-2 flex flex-col items-start gap-4 md:flex-row md:items-center">
                            {qrDataUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={qrDataUrl}
                                alt="QR 2FA"
                                className="h-40 w-40 rounded border border-gray-200 object-contain sm:h-48 sm:w-48 md:h-52 md:w-52"
                              />
                            ) : (
                              <div className="grid h-40 w-40 place-items-center rounded border border-gray-200 text-xs text-gray-500 sm:h-48 sm:w-48 md:h-52 md:w-52">
                                Generando QR...
                              </div>
                            )}
                            <div className="max-w-full flex-1 overflow-auto rounded border border-gray-200 bg-gray-50 p-2 text-xs break-all">
                              {twoFA.otpauth}
                              <div className="mt-2">
                                <button
                                  type="button"
                                  className="text-azul underline"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(twoFA.otpauth);
                                      await swalSuccess("Clave copiada al portapapeles");
                                    } catch {
                                      swalError("No se pudo copiar");
                                    }
                                  }}
                                >
                                  Copiar clave
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {!twoFA.enable && user.two_factor_enabled && (
                    <p className="text-sm text-gray-500">Desactivar 2FA no requiere código</p>
                  )}
                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    loading={savingSecurity}
                    onClick={onGuardarSeguridad2FA}
                  >
                    Guardar seguridad
                  </Button>
                </div>
              </div>
            )}

            {!canEditFirmas && puedeEditarUsuario && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Switch
                  label="2FA habilitado"
                  checked={form.two_factor_enabled}
                  onChange={(checked) => onChange("main", "two_factor_enabled", checked)}
                />
              </div>
            )}

            {puedeEditarUsuario && (
              <div className="max-w-xl">
                <Input
                  label="Nueva contraseña (dejar vacío para no cambiar)"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => onChange("main", "password", e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* Botones */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/usuarios")}
          >
            {puedeEditarUsuario ? "Cancelar" : "Volver"}
          </Button>
          {puedeEditarUsuario && (
            <Button type="submit" variant="primary" loading={saving}>
              <FiSave className="w-4 h-4 mr-2" />
              Guardar cambios
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

