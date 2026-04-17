"use client";

import { createContext, useContext, useEffect, useState } from "react";
import apiService from "@/lib/apiService";

export interface EmpresaSummary {
  id: string;
  nombre: string;
  alias?: string | null;
  logo_url?: string | null;
  color_principal?: string | null;
  color_secundario?: string | null;
  color_terciario?: string | null;
  dominio?: string | null;
  activo?: boolean | null;
}

export interface CurrentUser {
  id: string;
  email: string;
  username?: string | null;
  full_name?: string | null;
  nombre?: string | null;
  apellido_paterno?: string | null;
  apellido_materno?: string | null;
  is_active: boolean;
  multiempresa?: boolean | null;
  ultimo_acceso?: string | null;
  empresa?: EmpresaSummary | null;
  empresas?: EmpresaSummary[];
  rol?: {
    id: string;
    nombre: string;
    descripcion?: string | null;
    nivel?: number | null;
  } | null;
  perfil?: {
    foto_de_perfil?: string | null;
    nombre?: string | null;
    apellido_paterno?: string | null;
    apellido_materno?: string | null;
    titulo?: string | null;
    cedula_profesional?: string | null;
    firma?: string | null;
    firma_digital?: string | null;
  } | null;
  contactos?: {
    telefono?: string | null;
    celular?: string | null;
  } | null;
  direccion?: {
    direccion?: string | null;
    ciudad?: string | null;
    estado?: string | null;
    codigo_postal?: string | null;
    pais?: string | null;
  } | null;
  two_factor_enabled?: boolean | null;
  two_factor_verified_at?: string | null;
  /** Permisos del rol (modulo_tecnico, accion_tecnico). Viene de /users/me */
  permisos?: { modulo: string; accion: string }[] | null;
  /** Áreas asignadas al usuario (multiárea). Viene de /users/me */
  areas?: { id: string; nombre: string }[] | null;
  /** Sesión como otro usuario (JWT con claim imp) */
  impersonated_by?: { id: string; email?: string | null } | null;
}

interface UserContextValue {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => void;
  /** Vuelve al token guardado antes de impersonar (sesión del desarrollador nivel 0). */
  exitImpersonation: () => Promise<void>;
  activeEmpresa: EmpresaSummary | null;
  setActiveEmpresa: (empresaId: string) => Promise<void>;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeEmpresaId, setActiveEmpresaId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const data = await apiService.getCurrentUser();
      setUser(data);
      setActiveEmpresaId((prev) => {
        if (prev) {
          const existsInList =
            (data.empresas && data.empresas.some((empresa: EmpresaSummary) => empresa.id === prev)) ||
            data.empresa?.id === prev;
          if (existsInList) {
            return prev;
          }
        }
        return (
          data.empresa?.id ||
          (data.empresas && data.empresas.length > 0 ? data.empresas[0].id : null)
        );
      });
    } catch (_) {
      setUser(null);
      setActiveEmpresaId(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setActiveEmpresaId(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("preImpersonateToken");
    }
  };

  const exitImpersonation = async () => {
    if (typeof window === "undefined") return;
    const prev = sessionStorage.getItem("preImpersonateToken");
    if (!prev) {
      return;
    }
    localStorage.setItem("token", prev);
    sessionStorage.removeItem("preImpersonateToken");
    await refresh();
  };

  const activeEmpresa =
    (user?.empresas || []).find((empresa) => empresa.id === activeEmpresaId) ||
    (user?.empresa && (!activeEmpresaId || user.empresa.id === activeEmpresaId)
      ? user.empresa
      : null);

  const setActiveEmpresa = async (empresaId: string) => {
    try {
      setLoading(true);
      await apiService.setActiveEmpresa(empresaId);
      setActiveEmpresaId(empresaId);
      await refresh();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setLoading(false);
      return;
    }
    refresh();
  }, []);

  return (
    <UserContext.Provider
      value={{ user, loading, refresh, logout, exitImpersonation, activeEmpresa, setActiveEmpresa }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser debe usarse dentro de UserProvider");
  return ctx;
}



