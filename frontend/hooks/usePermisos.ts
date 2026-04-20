"use client";

import { useMemo } from "react";
import { useUser } from "@/context/UserContext";

/** Mapeo ruta (href) -> nombre técnico del módulo (para permiso "leer") */
export const RUTA_A_MODULO: Record<string, string> = {
  "/dashboard": "dashboard",
  "/siniestros": "siniestros",
  "/agenda": "agenda",
  "/usuarios": "usuarios",
  "/parametros": "parametros",
  "/reportes": "reportes",
  "/configuracion": "configuracion",
  "/historico": "historico",
  "/soporte": "soporte",
};

export interface UsePermisosReturn {
  /** Lista de permisos del usuario (modulo, accion) */
  permisos: { modulo: string; accion: string }[];
  /** Indica si el usuario tiene el permiso (modulo_tecnico, accion_tecnico) */
  can: (modulo: string, accion: string) => boolean;
  /** Indica si puede acceder a la ruta (tiene permiso "leer" en el módulo de esa ruta) */
  canAccessRoute: (pathname: string) => boolean;
  /** Si el usuario no tiene rol o no hay permisos cargados aún */
  loading: boolean;
}

/**
 * Hook para manejo de permisos del usuario actual.
 * Usa los permisos que vienen en user.permisos (cargados con /users/me).
 * - can("siniestros", "crear") → true/false
 * - canAccessRoute("/siniestros") → true si tiene siniestros.leer
 */
export function usePermisos(): UsePermisosReturn {
  const { user, loading: userLoading } = useUser();

  const permisos = useMemo(() => {
    return user?.permisos ?? [];
  }, [user?.permisos]);

  const setPermisos = useMemo(() => {
    const set = new Set(permisos.map((p) => `${p.modulo}:${p.accion}`));
    return set;
  }, [permisos]);

  const can = useMemo(
    () => (modulo: string, accion: string) => {
      if (!user) return false;
      // Nivel 0 (SuperAdmin desarrollador): todos los permisos
      if (user.rol?.nivel === 0) return true;
      return setPermisos.has(`${modulo}:${accion}`);
    },
    [user, setPermisos]
  );

  const canAccessRoute = useMemo(
    () => (pathname: string) => {
      // Mientras se cargan los datos del usuario, evitamos mostrar enlaces
      // que luego puedan desaparecer por permisos, devolviendo false.
      if (userLoading) return false;
      if (user?.rol?.nivel === 0) return true;
      const path = pathname.split("?")[0].replace(/\/$/, "") || "/";
      const modulo = RUTA_A_MODULO[path];
      if (!modulo) return true;
      if (modulo === "usuarios") {
        return can(modulo, "read") || can(modulo, "ver_roles");
      }
      return can(modulo, "read");
    },
    [can, userLoading, user?.rol?.nivel]
  );

  return {
    permisos,
    can,
    canAccessRoute,
    loading: userLoading,
  };
}
