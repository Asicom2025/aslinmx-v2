/**
 * Página de Histórico (Auditoría del sistema)
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import {
  FiDownload,
  FiEye,
  FiRefreshCw,
  FiShield,
} from "react-icons/fi";
import { useUser } from "@/context/UserContext";
import apiService from "@/lib/apiService";
import DataTable, { TruncatedText } from "@/components/ui/DataTable";
import Modal from "@/components/ui/Modal";
import CustomSelect, { SelectOption } from "@/components/ui/Select";

type AuditoriaUsuario = {
  id?: string;
  email?: string | null;
  correo?: string | null;
  full_name?: string | null;
};

type AuditoriaRegistro = {
  id: string;
  usuario_id?: string | null;
  usuario?: AuditoriaUsuario | null;
  accion?: string | null;
  modulo?: string | null;
  tabla?: string | null;
  registro_id?: string | null;
  descripcion?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  creado_en?: string | null;
  datos_anteriores?: Record<string, unknown> | null;
  datos_nuevos?: Record<string, unknown> | null;
};

type FiltrosAuditoria = {
  usuario_id: string;
  accion: string;
  modulo: string;
  tabla: string;
  fecha_desde: string;
  fecha_hasta: string;
};

const FILTROS_INICIALES: FiltrosAuditoria = {
  usuario_id: "",
  accion: "",
  modulo: "",
  tabla: "",
  fecha_desde: "",
  fecha_hasta: "",
};

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatJsonBlock(value: unknown): string {
  if (!value) return "{}";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function HistoricoPage() {
  const router = useRouter();
  const { user, loading } = useUser();

  const [rows, setRows] = useState<AuditoriaRegistro[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosAuditoria>(FILTROS_INICIALES);
  const [usersOptions, setUsersOptions] = useState<SelectOption[]>([]);
  const [selected, setSelected] = useState<AuditoriaRegistro | null>(null);
  const [errorText, setErrorText] = useState<string>("");

  useEffect(() => {
    if (loading) return;
    const token = localStorage.getItem("token");
    if (!token || !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const nivelRol = Number(user?.rol?.nivel ?? 99);
  const accesoHistorico = nivelRol === 0 || nivelRol === 1;

  const loadUsers = useCallback(async () => {
    try {
      const users = await apiService.getUsers(0, 1000);
      const opts = (users || []).map((u: any) => ({
        value: String(u.id),
        label: u.full_name || u.email || u.username || "Usuario",
      }));
      setUsersOptions(opts);
    } catch {
      setUsersOptions([]);
    }
  }, []);

  const loadAuditoria = useCallback(async () => {
    try {
      setLoadingRows(true);
      setErrorText("");
      const params: Record<string, unknown> = { limit: 500, offset: 0 };
      if (filtros.usuario_id) params.usuario_id = filtros.usuario_id;
      if (filtros.accion) params.accion = filtros.accion;
      if (filtros.modulo) params.modulo = filtros.modulo;
      if (filtros.tabla) params.tabla = filtros.tabla;
      if (filtros.fecha_desde) params.fecha_desde = `${filtros.fecha_desde}T00:00:00`;
      if (filtros.fecha_hasta) params.fecha_hasta = `${filtros.fecha_hasta}T23:59:59`;
      const data = await apiService.getAuditoria(params);
      setRows(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setRows([]);
      setErrorText(error?.response?.data?.detail || "No se pudo cargar el histórico.");
    } finally {
      setLoadingRows(false);
    }
  }, [filtros]);

  useEffect(() => {
    if (!user || !accesoHistorico) return;
    loadUsers();
    loadAuditoria();
  }, [user, accesoHistorico, loadUsers, loadAuditoria]);

  const opcionesAccion = useMemo<SelectOption[]>(() => {
    const values = Array.from(
      new Set((rows || []).map((r) => (r.accion || "").trim()).filter(Boolean)),
    );
    return values.sort((a, b) => a.localeCompare(b, "es")).map((v) => ({ value: v, label: v }));
  }, [rows]);

  const opcionesModulo = useMemo<SelectOption[]>(() => {
    const values = Array.from(
      new Set((rows || []).map((r) => (r.modulo || "").trim()).filter(Boolean)),
    );
    return values.sort((a, b) => a.localeCompare(b, "es")).map((v) => ({ value: v, label: v }));
  }, [rows]);

  const opcionesTabla = useMemo<SelectOption[]>(() => {
    const values = Array.from(
      new Set((rows || []).map((r) => (r.tabla || "").trim()).filter(Boolean)),
    );
    return values.sort((a, b) => a.localeCompare(b, "es")).map((v) => ({ value: v, label: v }));
  }, [rows]);

  const handleExport = async () => {
    try {
      const params: Record<string, unknown> = {};
      if (filtros.usuario_id) params.usuario_id = filtros.usuario_id;
      if (filtros.accion) params.accion = filtros.accion;
      if (filtros.modulo) params.modulo = filtros.modulo;
      if (filtros.tabla) params.tabla = filtros.tabla;
      if (filtros.fecha_desde) params.fecha_desde = `${filtros.fecha_desde}T00:00:00`;
      if (filtros.fecha_hasta) params.fecha_hasta = `${filtros.fecha_hasta}T23:59:59`;

      const blob = await apiService.exportarAuditoriaExcel(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      a.href = url;
      a.download = `historico_auditoria_${stamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      setErrorText("No se pudo exportar el histórico.");
    }
  };

  const columns = useMemo<ColumnDef<AuditoriaRegistro>[]>(
    () => [
      {
        id: "acciones",
        header: "Ver",
        cell: ({ row }) => (
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 p-1.5 text-gray-700 hover:bg-gray-50"
            title="Ver detalle"
            onClick={() => setSelected(row.original)}
          >
            <FiEye className="h-4 w-4" />
          </button>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "creado_en",
        header: "Fecha",
        cell: ({ row }) => formatDate(row.original.creado_en),
      },
      {
        accessorKey: "usuario",
        header: "Usuario",
        cell: ({ row }) => {
          const u = row.original.usuario;
          return (
            <TruncatedText
              text={u?.full_name || u?.email || u?.correo || row.original.usuario_id || "-"}
              maxLength={40}
            />
          );
        },
      },
      { accessorKey: "accion", header: "Acción" },
      { accessorKey: "modulo", header: "Módulo" },
      { accessorKey: "tabla", header: "Tabla" },
      {
        accessorKey: "descripcion",
        header: "Descripción",
        cell: ({ row }) => (
          <TruncatedText text={row.original.descripcion || "-"} maxLength={70} />
        ),
      },
    ],
    [],
  );

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando histórico...</p>
        </div>
      </div>
    );
  }

  if (!accesoHistorico) {
    return (
      <div className="container-app w-full py-4 sm:py-6">
        <div className="rounded-lg bg-white p-6 text-center shadow">
          <FiShield className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <h1 className="text-xl font-semibold text-gray-900">Histórico</h1>
          <p className="mt-2 text-sm text-gray-600">
            Solo usuarios con rol de nivel 0 o 1 pueden acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-app w-full py-4 sm:py-6 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-fluid-2xl font-bold text-gray-900 sm:text-3xl">Histórico</h1>
          <p className="text-sm text-gray-600">Auditoría de actividades y cambios del sistema</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadAuditoria}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <FiRefreshCw className="h-4 w-4" />
            Actualizar
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-700"
          >
            <FiDownload className="h-4 w-4" />
            Exportar Excel
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-white p-4 shadow sm:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <CustomSelect
            name="f_usuario"
            label="Usuario"
            value={filtros.usuario_id}
            onChange={(v) => setFiltros((p) => ({ ...p, usuario_id: String(v || "") }))}
            options={[{ value: "", label: "Todos" }, ...usersOptions]}
            usePortal={false}
          />
          <CustomSelect
            name="f_accion"
            label="Acción"
            value={filtros.accion}
            onChange={(v) => setFiltros((p) => ({ ...p, accion: String(v || "") }))}
            options={[{ value: "", label: "Todas" }, ...opcionesAccion]}
            usePortal={false}
          />
          <CustomSelect
            name="f_modulo"
            label="Módulo"
            value={filtros.modulo}
            onChange={(v) => setFiltros((p) => ({ ...p, modulo: String(v || "") }))}
            options={[{ value: "", label: "Todos" }, ...opcionesModulo]}
            usePortal={false}
          />
          <CustomSelect
            name="f_tabla"
            label="Tabla"
            value={filtros.tabla}
            onChange={(v) => setFiltros((p) => ({ ...p, tabla: String(v || "") }))}
            options={[{ value: "", label: "Todas" }, ...opcionesTabla]}
            usePortal={false}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha desde</label>
            <input
              type="date"
              value={filtros.fecha_desde}
              onChange={(e) => setFiltros((p) => ({ ...p, fecha_desde: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha hasta</label>
            <input
              type="date"
              value={filtros.fecha_hasta}
              onChange={(e) => setFiltros((p) => ({ ...p, fecha_hasta: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadAuditoria}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700"
          >
            Aplicar filtros
          </button>
          <button
            type="button"
            onClick={() => {
              setFiltros(FILTROS_INICIALES);
              setTimeout(() => loadAuditoria(), 0);
            }}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Limpiar
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-white p-4 shadow sm:p-6">
        {errorText ? (
          <p className="text-sm text-red-600 mb-3">{errorText}</p>
        ) : null}
        {loadingRows ? (
          <div className="py-8 text-center text-gray-500">Cargando registros...</div>
        ) : (
          <DataTable
            layoutStorageKey="aslin-historico-auditoria"
            enableColumnVisibility
            columns={columns}
            data={rows}
            pageSize={25}
            emptyText="No hay registros para los filtros aplicados"
          />
        )}
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Detalle de auditoría"
        maxWidthClass="max-w-5xl"
      >
        {selected ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <p><span className="font-semibold">Fecha:</span> {formatDate(selected.creado_en)}</p>
              <p><span className="font-semibold">Usuario:</span> {selected.usuario?.full_name || selected.usuario?.email || selected.usuario_id || "-"}</p>
              <p><span className="font-semibold">Acción:</span> {selected.accion || "-"}</p>
              <p><span className="font-semibold">Módulo:</span> {selected.modulo || "-"}</p>
              <p><span className="font-semibold">Tabla:</span> {selected.tabla || "-"}</p>
              <p><span className="font-semibold">Registro ID:</span> {selected.registro_id || "-"}</p>
              <p className="md:col-span-2"><span className="font-semibold">Descripción:</span> {selected.descripcion || "-"}</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-700">json_input (datos_anteriores)</h4>
                <pre className="max-h-80 overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-xs leading-5 text-gray-800">
                  {formatJsonBlock(selected.datos_anteriores)}
                </pre>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-700">json_out (datos_nuevos)</h4>
                <pre className="max-h-80 overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-xs leading-5 text-gray-800">
                  {formatJsonBlock(selected.datos_nuevos)}
                </pre>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

