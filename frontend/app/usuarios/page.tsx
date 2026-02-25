/**
 * Página de Usuarios y Roles
 * Gestiona usuarios y roles del sistema
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import apiService from "@/lib/apiService";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import DataTable from "@/components/ui/DataTable";
import Switch from "@/components/ui/Switch";
import CustomSelect, { SelectOption } from "@/components/ui/Select";
import { swalSuccess, swalError, swalConfirmDelete } from "@/lib/swal";
import { ColumnDef } from "@tanstack/react-table";
import { FiEdit2, FiTrash2, FiPlus, FiUsers, FiShield, FiSettings } from "react-icons/fi";

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
}

export default function UsuariosPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [activeTab, setActiveTab] = useState<"usuarios" | "roles">("usuarios");
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [roles, setRoles] = useState<any[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [empresas, setEmpresas] = useState<any[]>([]);
  
  // Modals
  const [usuarioModalOpen, setUsuarioModalOpen] = useState(false);
  const [usuarioForm, setUsuarioForm] = useState<any>({});
  const [rolModalOpen, setRolModalOpen] = useState(false);
  const [rolForm, setRolForm] = useState<any>({});
  const [editingRol, setEditingRol] = useState<any>(null);

  useEffect(() => {
    if (loading) return;
    const token = localStorage.getItem("token");
    if (!token || !user) {
      router.push("/login");
      return;
    }
    loadUsuarios();
    loadRoles();
    loadEmpresas();
  }, [user, loading, router]);

  const loadUsuarios = async () => {
    try {
      setUsuariosLoading(true);
      const data = await apiService.getUsers();
      setUsuarios(data);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      console.error("Error al cargar usuarios:", e);
    } finally {
      setUsuariosLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      setRolesLoading(true);
      // Verificar que apiService esté disponible
      if (!apiService) {
        console.error("apiService no está disponible");
        swalError("Error: apiService no está disponible");
        return;
      }
      // Usar método directo que sabemos que existe (compatibilidad)
      if (typeof apiService.getRoles !== 'function') {
        console.error("apiService.getRoles no es una función", apiService);
        swalError("Error: getRoles no está disponible en apiService");
        return;
      }
      const data = await apiService.getRoles();
      setRoles(data || []);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      console.error("Error al cargar roles:", e);
      swalError(e.response?.data?.detail || "Error al cargar roles");
    } finally {
      setRolesLoading(false);
    }
  };

  const loadEmpresas = async () => {
    try {
      const data = await apiService.getEmpresas();
      setEmpresas(data || []);
    } catch (e: any) {
      console.error("Error al cargar empresas:", e);
      swalError(e.response?.data?.detail || "Error al cargar empresas");
    }
  };

  const openCreateUsuario = () => {
    setUsuarioForm({
      email: "",
      username: "",
      full_name: "",
      password: "",
      empresa_ids: [],
      rol_id: "",
      is_active: true,
    });
    setUsuarioModalOpen(true);
  };

  const openEditUsuario = (usuario: User) => {
    router.push(`/usuarios/${usuario.id}`);
  };

  const submitUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiService.registerUser(usuarioForm);
      await swalSuccess("Usuario creado correctamente");
      setUsuarioModalOpen(false);
      loadUsuarios();
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al crear usuario");
    }
  };

  const deleteUsuario = async (id: string) => {
    const confirmed = await swalConfirmDelete("¿Está seguro de eliminar este usuario?");
    if (!confirmed) return;
    try {
      await apiService.deleteUser(id);
      await swalSuccess("Usuario eliminado");
      loadUsuarios();
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al eliminar usuario");
    }
  };

  const usuariosColumns: ColumnDef<User>[] = [
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => <span className="font-medium">{row.original.email}</span>,
      enableSorting: true,
    },
    {
      accessorKey: "full_name",
      header: "Nombre Completo",
      cell: ({ row }) => row.original.full_name || "Sin nombre",
      enableSorting: true,
    },
    {
      accessorKey: "rol",
      header: "Rol",
      cell: ({ row }) => row.original.rol?.nombre || "Sin rol",
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        const rolA = rowA.original.rol?.nombre || "";
        const rolB = rowB.original.rol?.nombre || "";
        return rolA.localeCompare(rolB);
      },
    },
    {
      accessorKey: "empresas",
      header: "Empresas",
      cell: ({ row }) => {
        const empresas = row.original.empresas || (row.original.empresa ? [row.original.empresa] : []);
        if (!empresas || empresas.length === 0) return "Sin empresas";
        return empresas.map((empresa) => empresa.nombre).join(", ");
      },
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        const empresasA = rowA.original.empresas || (rowA.original.empresa ? [rowA.original.empresa] : []);
        const empresasB = rowB.original.empresas || (rowB.original.empresa ? [rowB.original.empresa] : []);
        const nombreA = empresasA[0]?.nombre || "";
        const nombreB = empresasB[0]?.nombre || "";
        return nombreA.localeCompare(nombreB);
      },
    },
    {
      accessorKey: "is_active",
      header: "Estado",
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          row.original.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}>
          {row.original.is_active ? "Activo" : "Inactivo"}
        </span>
      ),
      enableSorting: true,
    },
    {
      id: "acciones",
      header: "Acciones",
      cell: ({ row }) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openEditUsuario(row.original);
            }}
            className="text-blue-600 hover:text-blue-800 transition-colors"
            title="Editar"
          >
            <FiEdit2 className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              deleteUsuario(row.original.id);
            }}
            className="text-red-600 hover:text-red-800 transition-colors"
            title="Eliminar"
          >
            <FiTrash2 className="w-5 h-5" />
          </button>
        </div>
      ),
      enableSorting: false,
    },
  ];

  // Funciones para roles
  const openCreateRol = () => {
    setEditingRol(null);
    setRolForm({
      nombre: "",
      descripcion: "",
      nivel: 3,
      activo: true,
    });
    setRolModalOpen(true);
  };

  const openEditRol = (rol: any) => {
    setEditingRol(rol);
    setRolForm({
      nombre: rol.nombre || "",
      descripcion: rol.descripcion || "",
      nivel: rol.nivel ?? 3,
      activo: rol.activo ?? true,
    });
    setRolModalOpen(true);
  };

  const submitRol = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRol) {
        await apiService.updateRol(editingRol.id, rolForm);
        await swalSuccess("Rol actualizado correctamente");
      } else {
        await apiService.createRol(rolForm);
        await swalSuccess("Rol creado correctamente");
      }
      setRolModalOpen(false);
      loadRoles();
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al guardar rol");
    }
  };

  const deleteRol = async (id: string) => {
    const confirmed = await swalConfirmDelete("¿Está seguro de eliminar este rol?");
    if (!confirmed) return;
    try {
      await apiService.deleteRol(id);
      await swalSuccess("Rol eliminado");
      loadRoles();
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al eliminar rol");
    }
  };

  const rolesColumns: ColumnDef<any>[] = [
    {
      accessorKey: "nombre",
      header: "Nombre",
      cell: ({ row }) => <span className="font-medium">{row.original.nombre}</span>,
      enableSorting: true,
    },
    {
      accessorKey: "descripcion",
      header: "Descripción",
      cell: ({ row }) => row.original.descripcion || "Sin descripción",
      enableSorting: true,
    },
    {
      accessorKey: "nivel",
      header: "Nivel",
      cell: ({ row }) => row.original.nivel ?? "N/A",
      enableSorting: true,
    },
    {
      accessorKey: "activo",
      header: "Estado",
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          row.original.activo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}>
          {row.original.activo ? "Activo" : "Inactivo"}
        </span>
      ),
      enableSorting: true,
    },
    {
      id: "acciones",
      header: "Acciones",
      cell: ({ row }) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/usuarios/roles/${row.original.id}/permisos`);
            }}
            className="text-purple-600 hover:text-purple-800 transition-colors"
            title="Configurar Permisos"
          >
            <FiSettings className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openEditRol(row.original);
            }}
            className="text-blue-600 hover:text-blue-800 transition-colors"
            title="Editar"
          >
            <FiEdit2 className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              deleteRol(row.original.id);
            }}
            className="text-red-600 hover:text-red-800 transition-colors"
            title="Eliminar"
          >
            <FiTrash2 className="w-5 h-5" />
          </button>
        </div>
      ),
      enableSorting: false,
    },
  ];

  if (loading || !user) {
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
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Usuarios y Roles</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          <button
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === "usuarios"
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
            onClick={() => setActiveTab("usuarios")}
          >
            <FiUsers className="w-5 h-5" />
            Usuarios
          </button>
          <button
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === "roles"
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
            onClick={() => setActiveTab("roles")}
          >
            <FiShield className="w-5 h-5" />
            Roles
          </button>
        </nav>
      </div>

      {/* Contenido de pestañas */}
      {activeTab === "usuarios" && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Gestión de Usuarios</h2>
            <Button onClick={openCreateUsuario}>
              <FiPlus className="w-4 h-4 mr-2" />
              Nuevo Usuario
            </Button>
          </div>

          {usuariosLoading ? (
            <div className="text-center text-gray-500 py-8">Cargando usuarios...</div>
          ) : (
            <DataTable columns={usuariosColumns} data={usuarios} emptyText="No hay usuarios registrados" />
          )}
        </div>
      )}

      {activeTab === "roles" && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Gestión de Roles</h2>
            <Button onClick={openCreateRol}>
              <FiPlus className="w-4 h-4 mr-2" />
              Nuevo Rol
            </Button>
          </div>

          {rolesLoading ? (
            <div className="text-center text-gray-500 py-8">Cargando roles...</div>
          ) : (
            <DataTable columns={rolesColumns} data={roles} emptyText="No hay roles registrados" />
          )}
        </div>
      )}

      {/* Modal de Usuario */}
      <Modal
        open={usuarioModalOpen}
        onClose={() => setUsuarioModalOpen(false)}
        title="Nuevo Usuario"
      >
        <form onSubmit={submitUsuario} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <Input
              type="email"
              name="email"
              value={usuarioForm.email || ""}
              onChange={(e) => setUsuarioForm({ ...usuarioForm, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Usuario</label>
            <Input
              name="username"
              value={usuarioForm.username || ""}
              onChange={(e) => setUsuarioForm({ ...usuarioForm, username: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
            <Input
              name="full_name"
              value={usuarioForm.full_name || ""}
              onChange={(e) => setUsuarioForm({ ...usuarioForm, full_name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
            <Input
              type="password"
              name="password"
              value={usuarioForm.password || ""}
              onChange={(e) => setUsuarioForm({ ...usuarioForm, password: e.target.value })}
              required
            />
          </div>
          <CustomSelect
            label="Empresas"
            name="empresa_ids"
            value={usuarioForm.empresa_ids || []}
            onChange={(value) => setUsuarioForm({ ...usuarioForm, empresa_ids: value as string[] })}
            options={empresas.map((empresa: any) => ({
              value: empresa.id,
              label: empresa.nombre,
            }))}
            isMulti={true}
            placeholder="Selecciona una o varias empresas"
          />
          <CustomSelect
            label="Rol"
            name="rol_id"
            value={usuarioForm.rol_id || ""}
            onChange={(value) => setUsuarioForm({ ...usuarioForm, rol_id: value as string || null })}
            options={[
              { value: "", label: "Sin rol" },
              ...roles.map((rol: any) => ({
                value: rol.id,
                label: rol.nombre,
              })),
            ]}
            placeholder="Sin rol"
          />
          <div>
            <Switch
              label="Usuario activo"
              checked={usuarioForm.is_active !== false}
              onChange={(checked) => setUsuarioForm({ ...usuarioForm, is_active: checked })}
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="secondary" onClick={() => setUsuarioModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Crear</Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Rol */}
      <Modal
        open={rolModalOpen}
        onClose={() => setRolModalOpen(false)}
        title={editingRol ? "Editar Rol" : "Nuevo Rol"}
      >
        <form onSubmit={submitRol} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <Input
              name="nombre"
              value={rolForm.nombre || ""}
              onChange={(e) => setRolForm({ ...rolForm, nombre: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              name="descripcion"
              value={rolForm.descripcion || ""}
              onChange={(e) => setRolForm({ ...rolForm, descripcion: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Descripción del rol"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nivel</label>
            <input
              name="nivel"
              type="number"
              min="1"
              max="10"
              value={rolForm.nivel || 3}
              onChange={(e) => setRolForm({ ...rolForm, nivel: parseInt(e.target.value) || 3 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Nivel de acceso (1-10, donde 1 es el más alto)</p>
          </div>
          <div>
            <Switch
              label="Rol activo"
              checked={rolForm.activo !== false}
              onChange={(checked) => setRolForm({ ...rolForm, activo: checked })}
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="secondary" onClick={() => setRolModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">{editingRol ? "Actualizar" : "Crear"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

