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
import { FiDownload, FiUpload, FiPlus, FiUsers } from "react-icons/fi";
import { useTour } from "@/hooks/useTour";
import TourButton from "@/components/ui/TourButton";

export default function ParametrosPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  useTour("tour-parametros", { autoStart: true });
  const [activeTab, setActiveTab] = useState<
    "instituciones" | "autoridades" | "provenientes" | "estados" | "calificaciones"
  >("instituciones");

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
    <div className="min-h-screen w-full bg-gray-50 py-4 sm:py-6">
      <div className="container-app w-full">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-fluid-2xl font-bold text-gray-900 sm:text-3xl">Parámetros</h1>
          <TourButton tour="tour-parametros" label="Ver guía" />
        </div>

        {/* Tabs */}
        <div data-tour="params-tabs" className="mb-6 overflow-x-auto border-b border-gray-200 [-webkit-overflow-scrolling:touch]">
          <nav className="-mb-px flex min-w-0 gap-4 sm:gap-6" aria-label="Tabs">
            <TabButton id="instituciones" label="Instituciones" />
            <TabButton id="autoridades" label="Autoridades" />
            <TabButton id="provenientes" label="Provenientes" />
            <TabButton id="estados" label="Estados de Siniestro" />
            <TabButton id="calificaciones" label="Calificaciones" />
          </nav>
        </div>

        <div data-tour="params-tabla">
        {activeTab === "instituciones" && <InstitucionesTab router={router} user={user} />}

        {activeTab === "autoridades" && <AutoridadesTab router={router} user={user} />}

        {activeTab === "provenientes" && <ProvenientesTab router={router} user={user} />}

        {activeTab === "estados" && <EstadosSiniestroTab router={router} user={user} />}

        {activeTab === "calificaciones" && <CalificacionesTab router={router} user={user} />}
        </div>
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
  return (
    <DataTable
      layoutStorageKey="aslin-datatable-param-estados"
      columns={columns}
      data={data}
      emptyText="Sin estados registrados"
      size="compact"
    />
  );
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
      layoutStorageKey="aslin-datatable-param-instituciones"
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
      layoutStorageKey="aslin-datatable-param-autoridades"
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
  const [contactosModalOpen, setContactosModalOpen] = useState(false);
  const [contactosLoading, setContactosLoading] = useState(false);
  const [contactosSaving, setContactosSaving] = useState(false);
  const [selectedProveniente, setSelectedProveniente] = useState<any | null>(null);
  const [contactos, setContactos] = useState<any[]>([]);
  const [editingContacto, setEditingContacto] = useState<any | null>(null);
  const [contactoForm, setContactoForm] = useState({
    nombre: "",
    correo: "",
    activo: true,
  });
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

  const resetContactoForm = () => {
    setEditingContacto(null);
    setContactoForm({
      nombre: "",
      correo: "",
      activo: true,
    });
  };

  const syncContactosInItems = (provenienteId: string, nextContactos: any[]) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === provenienteId ? { ...item, contactos: nextContactos } : item,
      ),
    );
  };

  const loadContactos = async (provenienteId: string) => {
    const data = await apiService.getProvenienteContactos(provenienteId);
    const next = (Array.isArray(data) ? data : []).filter(
      (contacto: any) => String(contacto?.proveniente_id || "") === String(provenienteId),
    );
    setContactos(next);
    syncContactosInItems(provenienteId, next);
  };

  const openContactos = async (proveniente: any) => {
    setSelectedProveniente(proveniente);
    setContactos([]);
    setContactosModalOpen(true);
    resetContactoForm();
    try {
      setContactosLoading(true);
      await loadContactos(proveniente.id);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al cargar contactos");
    } finally {
      setContactosLoading(false);
    }
  };

  const startCreateContacto = () => {
    resetContactoForm();
  };

  const startEditContacto = (contacto: any) => {
    setEditingContacto(contacto);
    setContactoForm({
      nombre: contacto.nombre || "",
      correo: contacto.correo || "",
      activo: contacto.activo !== false,
    });
  };

  const saveContacto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProveniente?.id) return;

    const nombre = contactoForm.nombre.trim();
    const correo = contactoForm.correo.trim().toLowerCase();
    if (!nombre || !correo) {
      swalError("Debes capturar nombre y correo");
      return;
    }

    const contactosDelProveniente = contactos.filter(
      (contacto) =>
        String(contacto?.proveniente_id || "") === String(selectedProveniente.id),
    );
    const duplicado = contactosDelProveniente.some(
      (contacto) =>
        contacto.id !== editingContacto?.id &&
        String(contacto.correo || "").trim().toLowerCase() === correo,
    );
    if (duplicado) {
      swalError("Ese correo ya existe en los contactos del proveniente");
      return;
    }

    try {
      setContactosSaving(true);
      if (editingContacto) {
        await apiService.updateProvenienteContacto(
          selectedProveniente.id,
          editingContacto.id,
          {
            nombre,
            correo,
            activo: contactoForm.activo,
          },
        );
        await swalSuccess("Contacto actualizado");
      } else {
        await apiService.createProvenienteContacto(selectedProveniente.id, {
          nombre,
          correo,
          activo: contactoForm.activo,
        });
        await swalSuccess("Contacto creado");
      }
      resetContactoForm();
      await loadContactos(selectedProveniente.id);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al guardar contacto");
    } finally {
      setContactosSaving(false);
    }
  };

  const toggleContactoActivo = async (contacto: any) => {
    if (!selectedProveniente?.id) return;
    try {
      setContactosSaving(true);
      await apiService.updateProvenienteContacto(
        selectedProveniente.id,
        contacto.id,
        { activo: contacto.activo === false },
      );
      await swalSuccess(contacto.activo === false ? "Contacto activado" : "Contacto inactivado");
      await loadContactos(selectedProveniente.id);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al cambiar estado del contacto");
    } finally {
      setContactosSaving(false);
    }
  };

  const deleteContacto = async (contacto: any) => {
    if (!selectedProveniente?.id) return;
    const confirmed = await swalConfirmDelete(
      `¿Está seguro de eliminar el contacto ${contacto.nombre || contacto.correo}?`,
    );
    if (!confirmed) return;
    try {
      setContactosSaving(true);
      await apiService.deleteProvenienteContacto(selectedProveniente.id, contacto.id);
      await swalSuccess("Contacto eliminado");
      if (editingContacto?.id === contacto.id) {
        resetContactoForm();
      }
      await loadContactos(selectedProveniente.id);
    } catch (e: any) {
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      swalError(e.response?.data?.detail || "Error al eliminar contacto");
    } finally {
      setContactosSaving(false);
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
          onManageContactos={openContactos}
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
      <Modal
        open={contactosModalOpen}
        onClose={() => {
          if (contactosSaving) return;
          setContactosModalOpen(false);
          setSelectedProveniente(null);
          setContactos([]);
          resetContactoForm();
        }}
        title="Editar contactos"
        maxWidthClass="max-w-4xl"
      >
        <div className="space-y-5">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-gray-900">
              {selectedProveniente?.nombre || "Proveniente"}
            </p>
            <p className="text-xs text-gray-500">
              Los contactos activos estarán disponibles como destinatarios externos.
            </p>
          </div>

          <form onSubmit={saveContacto} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
              <div className="md:col-span-4">
                <Input
                  label="Nombre"
                  name="contacto_nombre"
                  value={contactoForm.nombre}
                  onChange={(e) =>
                    setContactoForm((prev) => ({ ...prev, nombre: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="md:col-span-4">
                <Input
                  label="Correo"
                  name="contacto_correo"
                  type="email"
                  value={contactoForm.correo}
                  onChange={(e) =>
                    setContactoForm((prev) => ({ ...prev, correo: e.target.value }))
                  }
                  required
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2 md:pb-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={contactoForm.activo}
                  onChange={(e) =>
                    setContactoForm((prev) => ({ ...prev, activo: e.target.checked }))
                  }
                />
                Activo
              </label>
              <div className="flex gap-2 md:col-span-2 md:justify-end">
                {editingContacto && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={startCreateContacto}
                    disabled={contactosSaving}
                  >
                    Cancelar
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={contactosSaving}
                >
                  {contactosSaving
                    ? "Guardando..."
                    : editingContacto
                    ? "Guardar"
                    : "Nuevo contacto"}
                </Button>
              </div>
            </div>
          </form>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Nombre</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Correo</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {contactosLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      Cargando contactos...
                    </td>
                  </tr>
                ) : contactos.filter(
                    (contacto) =>
                      String(contacto?.proveniente_id || "") ===
                      String(selectedProveniente?.id || ""),
                  ).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No hay contactos registrados.
                    </td>
                  </tr>
                ) : (
                  contactos
                    .filter(
                      (contacto) =>
                        String(contacto?.proveniente_id || "") ===
                        String(selectedProveniente?.id || ""),
                    )
                    .map((contacto) => (
                      <tr key={contacto.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900">{contacto.nombre || "-"}</td>
                        <td className="px-4 py-3 text-gray-600">{contacto.correo || "-"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${
                              contacto.activo !== false
                                ? "border-green-200 bg-green-50 text-green-700"
                                : "border-gray-200 bg-gray-100 text-gray-600"
                            }`}
                          >
                            {contacto.activo !== false ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => startEditContacto(contacto)}
                              disabled={contactosSaving}
                            >
                              Editar
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => toggleContactoActivo(contacto)}
                              disabled={contactosSaving}
                            >
                              {contacto.activo !== false ? "Inactivar" : "Activar"}
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => deleteContacto(contacto)}
                              disabled={contactosSaving}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ProvenientesTable({
  data,
  onEdit,
  onDelete,
  onManageContactos,
}: {
  data: any[];
  onEdit: (row: any) => void;
  onDelete: (id: string) => void;
  onManageContactos: (row: any) => void;
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
      header: "Contactos",
      accessorKey: "contactos",
      cell: ({ row }) => {
        const contactos = (Array.isArray(row.original?.contactos)
          ? row.original.contactos
          : []
        ).filter(
          (contacto: any) =>
            String(contacto?.proveniente_id || "") === String(row.original?.id || ""),
        );
        if (contactos.length === 0) {
          return <span className="text-sm text-gray-500">-</span>;
        }
        const texto = contactos
          .map((c: any) => `${c?.nombre || "Sin nombre"} (${c?.correo || "-"})`)
          .join(", ");
        return (
          <span className="text-sm text-gray-600" title={texto}>
            {texto}
          </span>
        );
      },
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
            variant="outline"
            size="sm"
            onClick={() => onManageContactos(row.original)}
          >
            <FiUsers className="w-4 h-4 mr-1" />
            Contactos
          </Button>
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
      layoutStorageKey="aslin-datatable-param-provenientes"
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

  return (
    <DataTable
      layoutStorageKey="aslin-datatable-param-calificaciones"
      columns={columns}
      data={data}
      emptyText="Sin calificaciones registradas"
      size="compact"
    />
  );
}
