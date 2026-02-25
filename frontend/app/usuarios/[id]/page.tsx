"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/context/UserContext";
import apiService from "@/lib/apiService";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import CustomSelect, { SelectOption } from "@/components/ui/Select";
import { swalSuccess, swalError } from "@/lib/swal";
import { FiArrowLeft, FiSave } from "react-icons/fi";

interface User {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  is_active: boolean;
  created_at: string;
  empresa?: { id: string; nombre: string } | null;
  empresas?: { id: string; nombre: string }[] | null;
  rol?: { id: string; nombre: string } | null;
  perfil?: {
    nombre?: string;
    apellido_paterno?: string;
    apellido_materno?: string;
    titulo?: string;
    cedula_profesional?: string;
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
  const [loadingUser, setLoadingUser] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  
  const [form, setForm] = useState({
    email: "",
    username: "",
    full_name: "",
    empresa_ids: [] as string[],
    rol_id: "",
    is_active: true,
    password: "",
    perfil: {
      nombre: "",
      apellido_paterno: "",
      apellido_materno: "",
      titulo: "",
      cedula_profesional: "",
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
    loadRoles();
    loadEmpresas();
  }, [currentUser, loading, router, params.id]);

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

  const loadUser = async () => {
    try {
      setLoadingUser(true);
      const userId = params.id as string;
      const data = await apiService.getUserById(userId);
      setUser(data);
      setForm({
        email: data.email || "",
        username: data.username || "",
        full_name: data.full_name || "",
        empresa_ids: data.empresas?.map((empresa: any) => empresa.id) || (data.empresa ? [data.empresa.id] : []),
        rol_id: data.rol?.id || "",
        is_active: data.is_active ?? true,
        password: "",
        perfil: {
          nombre: data.perfil?.nombre || "",
          apellido_paterno: data.perfil?.apellido_paterno || "",
          apellido_materno: data.perfil?.apellido_materno || "",
          titulo: data.perfil?.titulo || "",
          cedula_profesional: data.perfil?.cedula_profesional || "",
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const userId = params.id as string;
      const updateData: any = {
        email: form.email,
        username: form.username,
        full_name: form.full_name,
        empresa_ids: form.empresa_ids || [],
        rol_id: form.rol_id || null,
        is_active: form.is_active,
        perfil: form.perfil,
        contactos: form.contactos,
        direccion: form.direccion,
      };

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
      swalError(e.response?.data?.detail || "Error al actualizar usuario");
    } finally {
      setSaving(false);
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
    <div className="p-6 space-y-6">
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
            <h1 className="text-2xl font-bold text-gray-900">Editar Usuario</h1>
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
                {(user.full_name || user.email || "?").charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold leading-tight">
                {user.full_name || user.email}
              </h2>
              <p className="text-white/80 text-sm md:text-base">
                {user.rol?.nombre || "Sin rol"} ·{" "}
                {(user.empresas && user.empresas.length > 0
                  ? user.empresas.map((empresa) => empresa.nombre).join(", ")
                  : user.empresa?.nombre) || "Sin empresa"}
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
          </div>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={onSubmit} className="space-y-6">
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
            <Input
              label="Nombre completo"
              name="full_name"
              value={form.full_name}
              onChange={(e) => onChange("main", "full_name", e.target.value)}
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
            <div>
              <Switch
                label="Usuario activo"
                checked={form.is_active}
                onChange={(checked) => onChange("main", "is_active", checked)}
              />
            </div>
            <Input
              label="Nueva contraseña (dejar vacío para no cambiar)"
              name="password"
              type="password"
              value={form.password}
              onChange={(e) => onChange("main", "password", e.target.value)}
            />
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

        {/* Botones */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/usuarios")}
          >
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            <FiSave className="w-4 h-4 mr-2" />
            Guardar cambios
          </Button>
        </div>
      </form>
    </div>
  );
}

