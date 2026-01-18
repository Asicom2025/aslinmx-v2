/**
 * Parámetros - Tabs
 * Agrupa Flujos y catálogos en pestañas, similar a Configuración
 */

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import apiService from "@/lib/apiService";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Switch from "@/components/ui/Switch";
import { swalSuccess, swalError, swalConfirmDelete } from "@/lib/swal";
import { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/ui/DataTable";
import { FiDownload, FiUpload, FiPlus } from "react-icons/fi";

export default function ParametrosPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [activeTab, setActiveTab] = useState<
    "entidades" | "instituciones" | "autoridades" | "provenientes" | "estados" | "calificaciones"
  >("entidades");

  useEffect(() => {
    // Esperar a que termine la carga del usuario
    if (loading) return;
    
    // Si no hay token o el usuario no está autenticado, redirigir
    const token = localStorage.getItem("token");
    if (!token || !user) {
      router.push("/login");
    }
  }, [router, loading, user]);

  const TabButton = ({ id, label }: { id: typeof activeTab; label: string }) => (
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

  // No renderizar contenido hasta que se confirme la autenticación
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Cargando...</p>
      </div>
    );
  }

  // Si no hay usuario autenticado, no renderizar (ya se redirigió en useEffect)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Parámetros</h1>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6 overflow-x-auto">
          <nav className="-mb-px flex gap-6" aria-label="Tabs">
            <TabButton id="entidades" label="Entidades" />
            <TabButton id="instituciones" label="Instituciones" />
            <TabButton id="autoridades" label="Autoridades" />
            <TabButton id="provenientes" label="Provenientes" />
            <TabButton id="estados" label="Estados de Siniestro" />
            <TabButton id="calificaciones" label="Calificaciones" />
          </nav>
        </div>

        {activeTab === "entidades" && <EntidadesTab router={router} user={user} />}

        {activeTab === "instituciones" && <InstitucionesTab router={router} user={user} />}

        {activeTab === "autoridades" && <AutoridadesTab router={router} user={user} />}

        {activeTab === "provenientes" && <ProvenientesTab router={router} user={user} />}

        {activeTab === "estados" && <EstadosSiniestroTab router={router} user={user} />}

        {activeTab === "calificaciones" && <CalificacionesTab router={router} user={user} />}
      </div>
    </div>
  );
}

// ========== Componente Estados de Siniestro ==========
function EstadosSiniestroTab({ router, user }: { router: any; user: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ nombre: "", descripcion: "", color: "#007bff", orden: 0, activo: true });

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await apiService.getEstadosSiniestro();
      setItems(data);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al cargar estados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadItems();
  }, [user]);

  const openCreate = () => {
    setEditing(null);
    setForm({ nombre: "", descripcion: "", color: "#007bff", orden: 0, activo: true });
    setModalOpen(true);
  };
  const openEdit = (item: any) => {
    setEditing(item);
    setForm({ nombre: item.nombre || "", descripcion: item.descripcion || "", color: item.color || "#007bff", orden: item.orden || 0, activo: !!item.activo });
    setModalOpen(true);
  };
  const changeForm = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : type === "number" ? parseInt(value) || 0 : value }));
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await apiService.updateEstadoSiniestro(editing.id, form as any);
        await swalSuccess("Estado actualizado");
      } else {
        await apiService.createEstadoSiniestro(form as any);
        await swalSuccess("Estado creado");
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
  const deleteItem = async (id: string) => {
    const confirmed = await swalConfirmDelete("¿Está seguro de eliminar este estado? Esta acción no se puede deshacer.");
    if (!confirmed) return;
    try {
      await apiService.deleteEstadoSiniestro(id);
      await swalSuccess("Estado eliminado");
      loadItems();
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al eliminar");
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Estados de Siniestro</h2>
        <Button variant="primary" onClick={openCreate}>
          <FiPlus className="w-4 h-4 mr-1" />
          Nuevo Estado
        </Button>
      </div>
      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : (
        <EstadosTable data={items} onEdit={openEdit} onDelete={(id: string) => deleteItem(id)} />
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar Estado" : "Nuevo Estado"}>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Nombre" name="nombre" value={form.nombre} onChange={changeForm} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Orden" name="orden" type="number" value={form.orden} onChange={changeForm} required />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
              <div className="flex gap-2">
                <input type="color" name="color" value={form.color} onChange={changeForm} className="h-10 w-20 border border-gray-300 rounded" />
                <Input name="color" value={form.color} onChange={changeForm} placeholder="#007bff" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
            <textarea name="descripcion" value={form.descripcion || ""} onChange={changeForm} rows={3} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <Switch
            label="Activo"
            checked={!!form.activo}
            onChange={(checked) => setForm((prev) => ({ ...prev, activo: checked }))}
          />
          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">{editing ? "Guardar" : "Crear"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function EstadosTable({ data, onEdit, onDelete }: { data: any[]; onEdit: (row: any) => void; onDelete: (id: string) => void }) {
  const columns: ColumnDef<any>[] = [
    { header: "Orden", accessorKey: "orden", cell: (info) => <span className="text-sm text-gray-900">{info.getValue() as number}</span> },
    { header: "Nombre", accessorKey: "nombre", cell: (info) => <span className="text-sm text-gray-900">{info.getValue() as string}</span> },
    { header: "Color", accessorKey: "color", cell: (info) => {
      const color = (info.getValue() as string) || "#007bff";
      return (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded border border-gray-300" style={{ backgroundColor: color }}></div>
          <span className="text-gray-600">{color}</span>
        </div>
      );
    } },
    { header: "Activo", accessorKey: "activo", cell: (info) => <span className="text-sm text-gray-600">{info.getValue() ? "Sí" : "No"}</span> },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={() => onEdit(row.original)}>Editar</Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(row.original.id)}>Eliminar</Button>
        </div>
      ),
    },
  ];
  return <DataTable columns={columns} data={data} emptyText="Sin estados registrados" size="compact" />;
}

// ========== Componente Instituciones ==========
function InstitucionesTab({ router, user }: { router: any; user: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    nombre: "",
    codigo: "",
    email: "",
    activo: true,
  });

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await apiService.getInstituciones();
      setItems(data);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al cargar instituciones");
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
    setForm({
      nombre: "",
      codigo: "",
      email: "",
      activo: true,
    });
    setModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      nombre: item.nombre || "",
      codigo: item.codigo || "",
      email: item.email || "",
      activo: item.activo !== undefined ? !!item.activo : true,
    });
    setModalOpen(true);
  };

  const changeForm = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        nombre: form.nombre,
        activo: form.activo,
      };
      
      // Solo incluir campos opcionales si tienen valor
      if (form.codigo) {
        payload.codigo = form.codigo;
      }
      if (form.email) {
        payload.email = form.email;
      }

      if (editing) {
        await apiService.updateInstitucion(editing.id, payload);
        await swalSuccess("Institución actualizada");
      } else {
        await apiService.createInstitucion(payload);
        await swalSuccess("Institución creada");
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

  const deleteItem = async (id: string) => {
    const confirmed = await swalConfirmDelete(
      "¿Está seguro de eliminar esta institución? Esta acción no se puede deshacer."
    );
    if (!confirmed) return;
    try {
      await apiService.deleteInstitucion(id);
      await swalSuccess("Institución eliminada");
      loadItems();
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al eliminar");
    }
  };

  const [importing, setImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async () => {
    try {
      await apiService.downloadTemplateCSV("instituciones");
      await swalSuccess("Template descargado correctamente");
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al descargar template");
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const result = await apiService.importarCSV("instituciones", file);
      await swalSuccess(
        result.mensaje + (result.errores ? `\n\nErrores: ${result.errores.length}` : "")
      );
      if (result.errores && result.errores.length > 0) {
        console.error("Errores de importación:", result.errores);
      }
      loadItems();
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al importar CSV");
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Instituciones</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleDownloadTemplate}>
            <FiDownload className="w-4 h-4 mr-1" />
            Descargar Template
          </Button>
          <label className="cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              style={{ display: "none" }}
              disabled={importing}
            />
            <span>
              <Button variant="secondary" disabled={importing} onClick={() => fileInputRef.current?.click()}>
                <FiUpload className="w-4 h-4 mr-1" />
                {importing ? "Importando..." : "Importar CSV"}
              </Button>
            </span>
          </label>
          <Button variant="primary" onClick={openCreate}>
            <FiPlus className="w-4 h-4 mr-1" />
            Nueva Institución
          </Button>
        </div>
      </div>
      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : (
        <InstitucionesTable
          data={items}
          onEdit={openEdit}
          onDelete={(id: string) => deleteItem(id)}
        />
      )}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar Institución" : "Nueva Institución"}
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={submit} className="space-y-4">
          <Input
            label="Nombre"
            name="nombre"
            value={form.nombre}
            onChange={changeForm}
            required
            placeholder="Nombre de la institución"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Código"
              name="codigo"
              value={form.codigo}
              onChange={changeForm}
              placeholder="Código de la institución"
            />
            <Input
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={changeForm}
              placeholder="email@ejemplo.com"
            />
          </div>
          <Switch
            label="Activo"
            checked={form.activo}
            onChange={(checked) =>
              setForm((prev) => ({ ...prev, activo: checked }))
            }
          />
          <div className="pt-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              {editing ? "Guardar" : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function InstitucionesTable({
  data,
  onEdit,
  onDelete,
}: {
  data: any[];
  onEdit: (row: any) => void;
  onDelete: (id: string) => void;
}) {
  const columns: ColumnDef<any>[] = [
    {
      header: "Nombre",
      accessorKey: "nombre",
      cell: (info) => (
        <span className="text-sm text-gray-900">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      header: "Código",
      accessorKey: "codigo",
      cell: (info) => (
        <span className="text-sm text-gray-600">
          {(info.getValue() as string) || "-"}
        </span>
      ),
    },
    {
      header: "Email",
      accessorKey: "email",
      cell: (info) => (
        <span className="text-sm text-gray-600">
          {(info.getValue() as string) || "-"}
        </span>
      ),
    },
    {
      header: "Activo",
      accessorKey: "activo",
      cell: (info) => (
        <span className="text-sm text-gray-600">
          {info.getValue() ? "Sí" : "No"}
        </span>
      ),
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onEdit(row.original)}
          >
            Editar
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDelete(row.original.id)}
          >
            Eliminar
          </Button>
        </div>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={data}
      emptyText="Sin instituciones registradas"
      size="compact"
    />
  );
}

// ========== Componente Autoridades ==========
function AutoridadesTab({ router, user }: { router: any; user: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    nombre: "",
    codigo: "",
    email: "",
    activo: true,
  });

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await apiService.getAutoridades();
      setItems(data);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al cargar autoridades");
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
    setForm({
      nombre: "",
      codigo: "",
      email: "",
      activo: true,
    });
    setModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      nombre: item.nombre || "",
      codigo: item.codigo || "",
      email: item.email || "",
      activo: item.activo !== undefined ? !!item.activo : true,
    });
    setModalOpen(true);
  };

  const changeForm = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        nombre: form.nombre,
        activo: form.activo,
      };

      // Solo incluir campos opcionales si tienen valor
      if (form.codigo) {
        payload.codigo = form.codigo;
      }
      if (form.email) {
        payload.email = form.email;
      }

      if (editing) {
        await apiService.updateAutoridad(editing.id, payload);
        await swalSuccess("Autoridad actualizada");
      } else {
        await apiService.createAutoridad(payload);
        await swalSuccess("Autoridad creada");
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

  const deleteItem = async (id: string) => {
    const confirmed = await swalConfirmDelete(
      "¿Está seguro de eliminar esta autoridad? Esta acción no se puede deshacer."
    );
    if (!confirmed) return;
    try {
      await apiService.deleteAutoridad(id);
      await swalSuccess("Autoridad eliminada");
      loadItems();
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al eliminar");
    }
  };

  const [importing, setImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async () => {
    try {
      await apiService.downloadTemplateCSV("autoridades");
      await swalSuccess("Template descargado correctamente");
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al descargar template");
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const result = await apiService.importarCSV("autoridades", file);
      await swalSuccess(
        result.mensaje + (result.errores ? `\n\nErrores: ${result.errores.length}` : "")
      );
      if (result.errores && result.errores.length > 0) {
        console.error("Errores de importación:", result.errores);
      }
      loadItems();
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al importar CSV");
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Autoridades</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleDownloadTemplate}>
            <FiDownload className="w-4 h-4 mr-1" />
            Descargar Template
          </Button>
          <label className="cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              style={{ display: "none" }}
              disabled={importing}
            />
            <span>
              <Button variant="secondary" disabled={importing} onClick={() => fileInputRef.current?.click()}>
                <FiUpload className="w-4 h-4 mr-1" />
                {importing ? "Importando..." : "Importar CSV"}
              </Button>
            </span>
          </label>
          <Button variant="primary" onClick={openCreate}>
            <FiPlus className="w-4 h-4 mr-1" />
            Nueva Autoridad
          </Button>
        </div>
      </div>
      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : (
        <AutoridadesTable
          data={items}
          onEdit={openEdit}
          onDelete={(id: string) => deleteItem(id)}
        />
      )}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar Autoridad" : "Nueva Autoridad"}
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={submit} className="space-y-4">
          <Input
            label="Nombre"
            name="nombre"
            value={form.nombre}
            onChange={changeForm}
            required
            placeholder="Nombre de la autoridad"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Código"
              name="codigo"
              value={form.codigo}
              onChange={changeForm}
              placeholder="Código de la autoridad"
            />
            <Input
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={changeForm}
              placeholder="email@ejemplo.com"
            />
          </div>
          <Switch
            label="Activo"
            checked={form.activo}
            onChange={(checked) =>
              setForm((prev) => ({ ...prev, activo: checked }))
            }
          />
          <div className="pt-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              {editing ? "Guardar" : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function AutoridadesTable({
  data,
  onEdit,
  onDelete,
}: {
  data: any[];
  onEdit: (row: any) => void;
  onDelete: (id: string) => void;
}) {
  const columns: ColumnDef<any>[] = [
    {
      header: "Nombre",
      accessorKey: "nombre",
      cell: (info) => (
        <span className="text-sm text-gray-900">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      header: "Código",
      accessorKey: "codigo",
      cell: (info) => (
        <span className="text-sm text-gray-600">
          {(info.getValue() as string) || "-"}
        </span>
      ),
    },
    {
      header: "Email",
      accessorKey: "email",
      cell: (info) => (
        <span className="text-sm text-gray-600">
          {(info.getValue() as string) || "-"}
        </span>
      ),
    },
    {
      header: "Activo",
      accessorKey: "activo",
      cell: (info) => (
        <span className="text-sm text-gray-600">
          {info.getValue() ? "Sí" : "No"}
        </span>
      ),
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onEdit(row.original)}
          >
            Editar
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDelete(row.original.id)}
          >
            Eliminar
          </Button>
        </div>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={data}
      emptyText="Sin autoridades registradas"
      size="compact"
    />
  );
}

// ========== Componente Provenientes ==========
function ProvenientesTab({ router, user }: { router: any; user: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    nombre: "",
    codigo: "",
    telefono: "",
    email: "",
    direccion: "",
    contacto_principal: "",
    observaciones: "",
    activo: true,
  });

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await apiService.getProvenientes();
      setItems(data);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al cargar provenientes");
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
    setForm({
      nombre: "",
      codigo: "",
      telefono: "",
      email: "",
      direccion: "",
      contacto_principal: "",
      observaciones: "",
      activo: true,
    });
    setModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      nombre: item.nombre || "",
      codigo: item.codigo || "",
      telefono: item.telefono || "",
      email: item.email || "",
      direccion: item.direccion || "",
      contacto_principal: item.contacto_principal || "",
      observaciones: item.observaciones || "",
      activo: item.activo !== undefined ? !!item.activo : true,
    });
    setModalOpen(true);
  };

  const changeForm = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        nombre: form.nombre,
        activo: form.activo,
      };
      
      // Solo incluir campos opcionales si tienen valor
      if (form.codigo) {
        payload.codigo = form.codigo;
      }
      if (form.telefono) {
        payload.telefono = form.telefono;
      }
      if (form.email) {
        payload.email = form.email;
      }
      if (form.direccion) {
        payload.direccion = form.direccion;
      }
      if (form.contacto_principal) {
        payload.contacto_principal = form.contacto_principal;
      }
      if (form.observaciones) {
        payload.observaciones = form.observaciones;
      }

      if (editing) {
        await apiService.updateProveniente(editing.id, payload);
        await swalSuccess("Proveniente actualizado");
      } else {
        await apiService.createProveniente(payload);
        await swalSuccess("Proveniente creado");
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

  const deleteItem = async (id: string) => {
    const confirmed = await swalConfirmDelete(
      "¿Está seguro de eliminar este proveniente? Esta acción no se puede deshacer."
    );
    if (!confirmed) return;
    try {
      await apiService.deleteProveniente(id);
      await swalSuccess("Proveniente eliminado");
      loadItems();
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al eliminar");
    }
  };

  const [importing, setImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async () => {
    try {
      await apiService.downloadTemplateCSV("provenientes");
      await swalSuccess("Template descargado correctamente");
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al descargar template");
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const result = await apiService.importarCSV("provenientes", file);
      await swalSuccess(
        result.mensaje + (result.errores ? `\n\nErrores: ${result.errores.length}` : "")
      );
      if (result.errores && result.errores.length > 0) {
        console.error("Errores de importación:", result.errores);
      }
      loadItems();
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al importar CSV");
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Provenientes</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleDownloadTemplate}>
            <FiDownload className="w-4 h-4 mr-1" />
            Descargar Template
          </Button>
          <label className="cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              style={{ display: "none" }}
              disabled={importing}
            />
            <span>
              <Button variant="secondary" disabled={importing} onClick={() => fileInputRef.current?.click()}>
                <FiUpload className="w-4 h-4 mr-1" />
                {importing ? "Importando..." : "Importar CSV"}
              </Button>
            </span>
          </label>
          <Button variant="primary" onClick={openCreate}>
            <FiPlus className="w-4 h-4 mr-1" />
            Nuevo Proveniente
          </Button>
        </div>
      </div>
      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : (
        <ProvenientesTable
          data={items}
          onEdit={openEdit}
          onDelete={(id: string) => deleteItem(id)}
        />
      )}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar Proveniente" : "Nuevo Proveniente"}
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={submit} className="space-y-4">
          <Input
            label="Nombre"
            name="nombre"
            value={form.nombre}
            onChange={changeForm}
            required
            placeholder="Nombre del proveniente"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Código"
              name="codigo"
              value={form.codigo}
              onChange={changeForm}
              placeholder="Código del proveniente"
            />
            <Input
              label="Teléfono"
              name="telefono"
              value={form.telefono}
              onChange={changeForm}
              placeholder="Teléfono de contacto"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={changeForm}
              placeholder="email@ejemplo.com"
            />
            <Input
              label="Contacto Principal"
              name="contacto_principal"
              value={form.contacto_principal}
              onChange={changeForm}
              placeholder="Nombre del contacto principal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Dirección</label>
            <textarea
              name="direccion"
              value={form.direccion}
              onChange={changeForm}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Dirección completa"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Observaciones</label>
            <textarea
              name="observaciones"
              value={form.observaciones}
              onChange={changeForm}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Observaciones adicionales"
            />
          </div>
          <Switch
            label="Activo"
            checked={form.activo}
            onChange={(checked) =>
              setForm((prev) => ({ ...prev, activo: checked }))
            }
          />
          <div className="pt-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              {editing ? "Guardar" : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ProvenientesTable({
  data,
  onEdit,
  onDelete,
}: {
  data: any[];
  onEdit: (row: any) => void;
  onDelete: (id: string) => void;
}) {
  const columns: ColumnDef<any>[] = [
    {
      header: "Nombre",
      accessorKey: "nombre",
      cell: (info) => (
        <span className="text-sm text-gray-900">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      header: "Código",
      accessorKey: "codigo",
      cell: (info) => (
        <span className="text-sm text-gray-600">
          {(info.getValue() as string) || "-"}
        </span>
      ),
    },
    {
      header: "Teléfono",
      accessorKey: "telefono",
      cell: (info) => (
        <span className="text-sm text-gray-600">
          {(info.getValue() as string) || "-"}
        </span>
      ),
    },
    {
      header: "Email",
      accessorKey: "email",
      cell: (info) => (
        <span className="text-sm text-gray-600">
          {(info.getValue() as string) || "-"}
        </span>
      ),
    },
    {
      header: "Contacto Principal",
      accessorKey: "contacto_principal",
      cell: (info) => (
        <span className="text-sm text-gray-600">
          {(info.getValue() as string) || "-"}
        </span>
      ),
    },
    {
      header: "Activo",
      accessorKey: "activo",
      cell: (info) => (
        <span className="text-sm text-gray-600">
          {info.getValue() ? "Sí" : "No"}
        </span>
      ),
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onEdit(row.original)}
          >
            Editar
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDelete(row.original.id)}
          >
            Eliminar
          </Button>
        </div>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={data}
      emptyText="Sin provenientes registrados"
      size="compact"
    />
  );
}

// ========== Componente Calificaciones ==========
function CalificacionesTab({ router, user }: { router: any; user: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ nombre: "", descripcion: "", color: "#475569", orden: 0, activo: true });

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await apiService.getCalificacionesSiniestro();
      setItems(data);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al cargar calificaciones");
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
    setForm({ nombre: "", descripcion: "", color: "#475569", orden: 0, activo: true });
    setModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      nombre: item.nombre || "",
      descripcion: item.descripcion || "",
      color: item.color || "#475569",
      orden: item.orden || 0,
      activo: !!item.activo,
    });
    setModalOpen(true);
  };

  const changeForm = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : type === "number"
          ? parseInt(value, 10) || 0
          : value,
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await apiService.updateCalificacionSiniestro(editing.id, form);
        await swalSuccess("Calificación actualizada");
      } else {
        await apiService.createCalificacionSiniestro(form);
        await swalSuccess("Calificación creada");
      }
      setModalOpen(false);
      loadItems();
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al guardar calificación");
    }
  };

  const deleteItem = async (id: string) => {
    const confirmed = await swalConfirmDelete("¿Está seguro de eliminar esta calificación?");
    if (!confirmed) return;
    try {
      await apiService.deleteCalificacionSiniestro(id);
      await swalSuccess("Calificación eliminada");
      loadItems();
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al eliminar calificación");
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Calificaciones de Siniestro</h2>
        <Button variant="primary" onClick={openCreate}>
          <FiPlus className="w-4 h-4 mr-1" />
          Nueva Calificación
        </Button>
      </div>
      {loading ? (
        <p className="text-gray-500">Cargando calificaciones...</p>
      ) : (
        <CalificacionesTable data={items} onEdit={openEdit} onDelete={(id: string) => deleteItem(id)} />
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar Calificación" : "Nueva Calificación"}>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Nombre" name="nombre" value={form.nombre} onChange={changeForm} required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
            <textarea name="descripcion" value={form.descripcion || ""} onChange={changeForm} rows={3} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <Input label="Color (hex)" name="color" value={form.color} onChange={changeForm} placeholder="#475569" />
          <Input label="Orden" name="orden" type="number" value={form.orden} onChange={changeForm} />
          <Switch
            label="Activo"
            checked={!!form.activo}
            onChange={(checked) => setForm((prev) => ({ ...prev, activo: checked }))}
          />
          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">{editing ? "Guardar" : "Crear"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function CalificacionesTable({ data, onEdit, onDelete }: { data: any[]; onEdit: (row: any) => void; onDelete: (id: string) => void }) {
  const columns: ColumnDef<any>[] = [
    { header: "Nombre", accessorKey: "nombre", cell: (info) => <span className="text-sm text-gray-900">{info.getValue() as string}</span> },
    { header: "Color", accessorKey: "color", cell: (info) => <span className="text-sm text-gray-600">{info.getValue() as string}</span> },
    { header: "Orden", accessorKey: "orden", cell: (info) => <span className="text-sm text-gray-600">{info.getValue() as number}</span> },
    { header: "Activo", accessorKey: "activo", cell: (info) => <span className="text-sm text-gray-600">{info.getValue() ? "Sí" : "No"}</span> },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={() => onEdit(row.original)}>Editar</Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(row.original.id)}>Eliminar</Button>
        </div>
      ),
    },
  ];

  return <DataTable columns={columns} data={data} emptyText="Sin calificaciones registradas" size="compact" />;
}

// ========== Componente Entidades ==========
function EntidadesTab({ router, user }: { router: any; user: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [filtros, setFiltros] = useState({
    activo: true as boolean | undefined,
    es_institucion: undefined as boolean | undefined,
    es_autoridad: undefined as boolean | undefined,
    es_organo: undefined as boolean | undefined,
  });
  const [form, setForm] = useState({
    nombre: "",
    codigo: "",
    email: "",
    telefono: "",
    direccion: "",
    contacto_principal: "",
    observaciones: "",
    es_institucion: false,
    es_autoridad: false,
    es_organo: false,
    activo: true,
  });

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await apiService.getEntidades(
        filtros.activo,
        filtros.es_institucion,
        filtros.es_autoridad,
        filtros.es_organo
      );
      setItems(data);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al cargar entidades");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filtros]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      nombre: "",
      codigo: "",
      email: "",
      telefono: "",
      direccion: "",
      contacto_principal: "",
      observaciones: "",
      es_institucion: false,
      es_autoridad: false,
      es_organo: false,
      activo: true,
    });
    setModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      nombre: item.nombre || "",
      codigo: item.codigo || "",
      email: item.email || "",
      telefono: item.telefono || "",
      direccion: item.direccion || "",
      contacto_principal: item.contacto_principal || "",
      observaciones: item.observaciones || "",
      es_institucion: !!item.es_institucion,
      es_autoridad: !!item.es_autoridad,
      es_organo: !!item.es_organo,
      activo: !!item.activo,
    });
    setModalOpen(true);
  };

  const changeForm = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar que al menos un rol esté seleccionado
    if (!form.es_institucion && !form.es_autoridad && !form.es_organo) {
      swalError("Debes seleccionar al menos un rol (Institución, Autoridad u Órgano)");
      return;
    }

    try {
      if (editing) {
        await apiService.updateEntidad(editing.id, form);
        await swalSuccess("Entidad actualizada");
      } else {
        await apiService.createEntidad(form);
        await swalSuccess("Entidad creada");
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

  const deleteEntidad = async (id: string) => {
    const confirmed = await swalConfirmDelete("¿Eliminar entidad? Esta acción no se puede deshacer.");
    if (!confirmed) return;
    try {
      await apiService.deleteEntidad(id);
      await swalSuccess("Entidad eliminada");
      loadItems();
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al eliminar");
    }
  };

  const getRoles = (entidad: any) => {
    const roles: string[] = [];
    if (entidad.es_institucion) roles.push("Institución");
    if (entidad.es_autoridad) roles.push("Autoridad");
    if (entidad.es_organo) roles.push("Órgano");
    return roles.join(", ") || "-";
  };

  const [importing, setImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async () => {
    try {
      await apiService.downloadTemplateCSV("entidades");
      await swalSuccess("Template descargado correctamente");
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al descargar template");
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const result = await apiService.importarCSV("entidades", file);
      await swalSuccess(
        result.mensaje + (result.errores ? `\n\nErrores: ${result.errores.length}` : "")
      );
      if (result.errores && result.errores.length > 0) {
        console.error("Errores de importación:", result.errores);
      }
      loadItems();
    } catch (e: any) {
      swalError(e.response?.data?.detail || "Error al importar CSV");
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Entidades</h2>
          <p className="text-sm text-gray-500">
            Gestiona entidades unificadas que pueden ser instituciones, autoridades u órganos para evitar redundancia.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleDownloadTemplate}>
            <FiDownload className="w-4 h-4 mr-1" />
            Descargar Template
          </Button>
          <label className="cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              style={{ display: "none" }}
              disabled={importing}
            />
            <span>
              <Button variant="secondary" disabled={importing} onClick={() => fileInputRef.current?.click()}>
                <FiUpload className="w-4 h-4 mr-1" />
                {importing ? "Importando..." : "Importar CSV"}
              </Button>
            </span>
          </label>
          <Button variant="primary" onClick={openCreate}>
            <FiPlus className="w-4 h-4 mr-1" />
            Nueva Entidad
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
            <select
              value={filtros.activo === undefined ? "" : filtros.activo ? "true" : "false"}
              onChange={(e) =>
                setFiltros({
                  ...filtros,
                  activo: e.target.value === "" ? undefined : e.target.value === "true",
                })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Institución</label>
            <select
              value={filtros.es_institucion === undefined ? "" : filtros.es_institucion ? "true" : "false"}
              onChange={(e) =>
                setFiltros({
                  ...filtros,
                  es_institucion: e.target.value === "" ? undefined : e.target.value === "true",
                })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Autoridad</label>
            <select
              value={filtros.es_autoridad === undefined ? "" : filtros.es_autoridad ? "true" : "false"}
              onChange={(e) =>
                setFiltros({
                  ...filtros,
                  es_autoridad: e.target.value === "" ? undefined : e.target.value === "true",
                })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Órgano</label>
            <select
              value={filtros.es_organo === undefined ? "" : filtros.es_organo ? "true" : "false"}
              onChange={(e) =>
                setFiltros({
                  ...filtros,
                  es_organo: e.target.value === "" ? undefined : e.target.value === "true",
                })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button
              variant="secondary"
              onClick={() =>
                setFiltros({
                  activo: true,
                  es_institucion: undefined,
                  es_autoridad: undefined,
                  es_organo: undefined,
                })
              }
            >
              Limpiar filtros
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando entidades...</p>
      ) : (
        <EntidadesTable data={items} onEdit={openEdit} onDelete={deleteEntidad} getRoles={getRoles} />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar entidad" : "Nueva entidad"}
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={submit} className="space-y-4">
          <Input label="Nombre" name="nombre" value={form.nombre} onChange={changeForm} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Código" name="codigo" value={form.codigo} onChange={changeForm} />
            <Input label="Email" name="email" type="email" value={form.email} onChange={changeForm} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Teléfono" name="telefono" value={form.telefono} onChange={changeForm} />
            <Input label="Contacto principal" name="contacto_principal" value={form.contacto_principal} onChange={changeForm} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Dirección</label>
            <textarea
              name="direccion"
              value={form.direccion || ""}
              onChange={changeForm}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Observaciones</label>
            <textarea
              name="observaciones"
              value={form.observaciones || ""}
              onChange={changeForm}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          
          {/* Roles */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Roles <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="es_institucion"
                  checked={form.es_institucion}
                  onChange={changeForm}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Institución</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="es_autoridad"
                  checked={form.es_autoridad}
                  onChange={changeForm}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Autoridad</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="es_organo"
                  checked={form.es_organo}
                  onChange={changeForm}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Órgano</span>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Selecciona al menos un rol para la entidad
            </p>
          </div>

          <Switch
            label="Activo"
            checked={!!form.activo}
            onChange={(checked) => setForm((prev) => ({ ...prev, activo: checked }))}
          />
          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              {editing ? "Guardar" : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function EntidadesTable({
  data,
  onEdit,
  onDelete,
  getRoles,
}: {
  data: any[];
  onEdit: (row: any) => void;
  onDelete: (id: string) => void;
  getRoles: (row: any) => string;
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
      header: "Roles",
      id: "roles",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600">{getRoles(row.original)}</span>
      ),
    },
    {
      header: "Email",
      accessorKey: "email",
      cell: (info) => <span className="text-sm text-gray-600">{(info.getValue() as string) || "-"}</span>,
    },
    {
      header: "Teléfono",
      accessorKey: "telefono",
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
          <Button variant="secondary" size="sm" onClick={() => onEdit(row.original)}>
            Editar
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(row.original.id)}>
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  return <DataTable columns={columns} data={data} emptyText="No hay entidades registradas" size="compact" />;
}
