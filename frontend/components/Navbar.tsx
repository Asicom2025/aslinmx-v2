"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { swalSuccess } from "@/lib/swal";
import { useUser } from "@/context/UserContext";
import type { EmpresaSummary } from "@/context/UserContext";
import { FaSpinner } from "react-icons/fa";
import { FiBell, FiMenu, FiSearch, FiChevronDown } from "react-icons/fi";
import apiService from "@/lib/apiService";
import { Notificacion } from "@/types/notificaciones";

type BusquedaTab = "id" | "numero_siniestro" | "asegurado";

/**
 * ID = clave proveniente - consecutivo - anualidad (ej. 102-001-25 o 1-001-25).
 * Acepta con guiones o sin ellos; el backend parsea ambos.
 */

export default function Navbar() {
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificacionesOpen, setNotificacionesOpen] = useState(false);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [notificacionesNoLeidas, setNotificacionesNoLeidas] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const [activeSearchTab, setActiveSearchTab] = useState<BusquedaTab>("id");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const { user, logout, activeEmpresa, setActiveEmpresa } = useUser();
  const empresasDisponibles = useMemo<EmpresaSummary[]>(() => {
    const lista = user?.empresas ?? [];
    const empresaActual = user?.empresa ?? null;
    if (empresaActual && !lista.some((emp) => emp.id === empresaActual.id)) {
      return [empresaActual, ...lista];
    }
    return lista;
  }, [user]);

  const gradientStyle = useMemo(() => {
    const primary = activeEmpresa?.color_principal || "#c43267";
    const secondary = activeEmpresa?.color_secundario || "#2b4f83";
    const tertiary = activeEmpresa?.color_terciario || "#3098cb";
    return {
      backgroundImage: `linear-gradient(90deg, ${primary} 0%, ${secondary} 50%, ${tertiary} 100%)`,
    };
  }, [activeEmpresa]);

  // Cargar notificaciones
  useEffect(() => {
    if (user) {
      loadNotificaciones();
      // Refrescar cada 30 segundos
      const interval = setInterval(loadNotificaciones, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadNotificaciones = async () => {
    try {
      const data = await apiService.getNotificaciones({ leida: false, limit: 10 });
      setNotificaciones(data);
      setNotificacionesNoLeidas(data.length);
    } catch (e: any) {
      // Error silencioso para no interrumpir la experiencia
      console.error("Error al cargar notificaciones:", e);
    }
  };

  const marcarLeida = async (id: string) => {
    try {
      await apiService.marcarLeida(id);
      loadNotificaciones();
    } catch (e: any) {
      console.error("Error al marcar notificación como leída:", e);
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem("token");
      logout();
      await swalSuccess("Sesión cerrada");
      router.push("/login");
    } catch (_) {
      router.push("/login");
    }
  };

  const runSearch = useCallback(async () => {
    const q = searchValue.trim();
    if (!q) {
      setSearchResults([]);
      setShowSearchDropdown(true);
      return;
    }
    setSearchLoading(true);
    try {
      const filters: any = { limit: 15 };
      if (activeSearchTab === "id") filters.busqueda_id = q;
      else if (activeSearchTab === "numero_siniestro") filters.numero_siniestro = q;
      else if (activeSearchTab === "asegurado") filters.asegurado_nombre = q;
      const data = await apiService.getSiniestros(filters);
      setSearchResults(Array.isArray(data) ? data : []);
      setShowSearchDropdown(true);
    } catch (e) {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [searchValue, activeSearchTab]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!searchValue.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    searchDebounceRef.current = setTimeout(runSearch, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchValue, activeSearchTab, runSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  const handleSelectResult = (siniestroId: string) => {
    setShowSearchDropdown(false);
    setSearchValue("");
    setSearchResults([]);
    router.push(`/siniestros/${siniestroId}`);
  };

  const placeholderByTab =
    activeSearchTab === "id"
      ? "Ej. 102-001-25 (proveniente-consecutivo-año)"
      : activeSearchTab === "numero_siniestro"
        ? "Núm. siniestro..."
        : "Nombre del asegurado...";

  return (
    <header
      className="fixed top-0 left-0 right-0 lg:left-64 z-30 text-white h-16"
      style={gradientStyle}
    >
      <div className="px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            aria-label="Abrir menú"
            className="p-2 rounded-md hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40 lg:hidden"
            onClick={() => {}}
            data-sidebar-toggle
          >
            <FiMenu className="w-6 h-6" />
          </button>
          <div data-tour="navbar-empresa" className="flex items-center gap-2">
            {empresasDisponibles.length > 1 ? (
              <select
                className="bg-white/15 text-white text-sm font-semibold rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-white/40"
                value={activeEmpresa?.id || empresasDisponibles[0]?.id || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setActiveEmpresa(value).catch((error) => {
                    console.error("Error al cambiar de empresa:", error);
                  });
                }}
              >
                {empresasDisponibles.map((empresa: EmpresaSummary) => (
                  <option key={empresa.id} value={empresa.id} className="text-gray-900">
                    {empresa.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-bold tracking-wide truncate">
                {activeEmpresa?.nombre || <FaSpinner className="animate-spin w-4 h-4" />}
              </span>
            )}
          </div>
        </div>

        <div data-tour="navbar-busqueda" className="hidden md:flex items-center flex-1 mx-4 max-w-xl" ref={searchContainerRef}>
          <div className="relative w-full">
            <input
              type="text"
              value={searchValue}
              onChange={handleSearchInputChange}
              onFocus={() => searchValue.trim() && setShowSearchDropdown(true)}
              placeholder={placeholderByTab}
              className={`w-full bg-white/15 placeholder-white/70 text-white pl-10 pr-4 py-2 outline-none ring-1 ring-white/20 focus:ring-2 focus:ring-white/40 ${showSearchDropdown ? "rounded-t-md" : "rounded-md"}`}
            />
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-white/80 pointer-events-none">
              <FiSearch className="w-5 h-5" />
            </span>
            {showSearchDropdown && (
              <div className="absolute top-full left-0 right-0 mt-0 bg-white text-gray-800 rounded-b-md shadow-lg ring-1 ring-black/10 z-50 max-h-[360px] flex flex-col">
                <div className="flex border-b border-gray-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveSearchTab("id")}
                    className={`px-4 py-2.5 text-sm font-medium ${activeSearchTab === "id" ? "text-white bg-gray-700" : "text-gray-600 hover:bg-gray-100"}`}
                  >
                    Por ID
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSearchTab("numero_siniestro")}
                    className={`px-4 py-2.5 text-sm font-medium ${activeSearchTab === "numero_siniestro" ? "text-white bg-gray-700" : "text-gray-600 hover:bg-gray-100"}`}
                  >
                    Num. Siniestro
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSearchTab("asegurado")}
                    className={`px-4 py-2.5 text-sm font-medium ${activeSearchTab === "asegurado" ? "text-white bg-gray-700" : "text-gray-600 hover:bg-gray-100"}`}
                  >
                    Asegurado
                  </button>
                </div>
                <div className="overflow-y-auto min-h-0 p-1">
                  {searchLoading ? (
                    <div className="flex items-center justify-center py-8 text-gray-500">
                      <FaSpinner className="animate-spin w-6 h-6" />
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="py-6 text-center text-gray-500 text-sm">
                      {searchValue.trim() ? "Sin resultados" : "Escribe para buscar"}
                    </div>
                  ) : (
                    <ul className="py-1">
                      {searchResults.map((s: any) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2.5 rounded hover:bg-gray-100 flex flex-col gap-0.5"
                            onClick={() => handleSelectResult(s.id)}
                          >
                            <span className="font-medium text-gray-900">
                              {s.id_formato || s.numero_reporte || s.numero_siniestro || s.id}
                            </span>
                            {(s.numero_siniestro || s.numero_reporte) && (
                              <span className="text-xs text-gray-500">
                                {s.numero_siniestro ? `Núm. siniestro: ${s.numero_siniestro}` : s.numero_reporte}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notificaciones */}
          <div data-tour="navbar-notificaciones" className="relative">
            <button
              className="relative p-2 rounded-md hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
              onClick={() => {
                setNotificacionesOpen((prev) => !prev);
                setProfileOpen(false);
              }}
            >
              <FiBell className="w-6 h-6" />
              {notificacionesNoLeidas > 0 && (
                <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {notificacionesNoLeidas > 9 ? "9+" : notificacionesNoLeidas}
                </span>
              )}
            </button>

            {notificacionesOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white text-gray-800 rounded-md shadow-lg ring-1 ring-black/5 z-50 max-h-96 overflow-y-auto">
                <div className="px-4 py-3 border-b flex justify-between items-center">
                  <h3 className="font-semibold">Notificaciones</h3>
                  {notificacionesNoLeidas > 0 && (
                    <button
                      onClick={async () => {
                        try {
                          await apiService.marcarTodasLeidas();
                          loadNotificaciones();
                        } catch (e) {
                          console.error("Error al marcar todas como leídas:", e);
                        }
                      }}
                      className="text-sm text-primary-600 hover:text-primary-800"
                    >
                      Marcar todas como leídas
                    </button>
                  )}
                </div>
                {notificaciones.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500">
                    No hay notificaciones nuevas
                  </div>
                ) : (
                  <ul className="py-1">
                    {notificaciones.map((notif) => (
                      <li
                        key={notif.id}
                        className={`px-4 py-3 hover:bg-gray-50 cursor-pointer border-l-4 ${
                          !notif.leida ? "border-primary-500 bg-blue-50/50" : "border-transparent"
                        }`}
                        onClick={() => {
                          marcarLeida(notif.id);
                          if (notif.siniestro_id) {
                            router.push(`/siniestros/${notif.siniestro_id}`);
                          }
                          setNotificacionesOpen(false);
                        }}
                      >
                        <p className="font-medium text-sm">{notif.titulo}</p>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{notif.mensaje}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(notif.creado_en).toLocaleString("es-MX", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Perfil */}
          <div data-tour="navbar-perfil" className="relative">
            <button
              className="flex items-center gap-2 p-2 rounded-md hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
              onClick={() => {
                setProfileOpen((prev) => !prev);
                setNotificacionesOpen(false);
              }}
            >
              <div className="w-8 h-8 rounded-full bg-white/30 overflow-hidden grid place-items-center font-semibold shrink-0">
                {user?.perfil?.foto_de_perfil ? (
                  <img
                    src={user.perfil.foto_de_perfil}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{user?.full_name?.charAt(0).toUpperCase() || <FaSpinner className="animate-spin w-4 h-4" />}</span>
                )}
              </div>
              <span className="hidden sm:inline line-clamp-1 truncate max-w-[200px]">
                {user?.full_name || user?.email || <FaSpinner className="animate-spin w-4 h-4" />}
              </span>
              <FiChevronDown className={`w-4 h-4 transition-transform ${
                profileOpen ? "rotate-180" : "rotate-0"
              }`} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-auto bg-white text-gray-800 rounded-md shadow-lg ring-1 ring-black/5 z-50">
                <div className="px-4 py-3 border-b">
                  <p className="font-medium">
                    {user?.full_name || user?.email || "Mi Cuenta"}
                  </p>
                  <p className="text-sm text-gray-500 line-clamp-1">
                    {user?.email}
                  </p>
                  <p className="text-sm text-gray-500 line-clamp-1">
                    {user?.rol?.nombre || "Sin rol"}
                  </p>
                </div>
                <ul className="py-1">
                  <li>
                    <a
                      className="block px-4 py-2 hover:bg-gray-50"
                      href="/perfil"
                    >
                      Mi perfil
                    </a>
                  </li>
                  <li>
                    <div className="px-4 py-2 border-t border-gray-100 first:border-t-0">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Áreas asignadas</p>
                      {user?.areas && user.areas.length > 0 ? (
                        <p className="text-sm text-gray-700">
                          {user.areas.map((a) => a.nombre).join(" · ")}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">Sin áreas asignadas</p>
                      )}
                    </div>
                  </li>
                  <li>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50"
                    >
                      Cerrar sesión
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
