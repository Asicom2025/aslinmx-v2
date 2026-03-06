"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { swalSuccess } from "@/lib/swal";
import { useUser } from "@/context/UserContext";
import type { EmpresaSummary } from "@/context/UserContext";
import { FaSpinner } from "react-icons/fa";
import { FiBell, FiMenu, FiSearch, FiChevronDown } from "react-icons/fi";
import apiService from "@/lib/apiService";
import { Notificacion } from "@/types/notificaciones";

export default function Navbar() {
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificacionesOpen, setNotificacionesOpen] = useState(false);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [notificacionesNoLeidas, setNotificacionesNoLeidas] = useState(0);
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

        <div data-tour="navbar-busqueda" className="hidden md:flex items-center flex-1 mx-4 max-w-xl">
          <div className="relative w-full">
            <input
              type="text"
              placeholder={`Buscar siniestros en ${(
                activeEmpresa?.nombre || "Aslin México"
              ).toLowerCase()}...`}
              className="w-full rounded-md bg-white/15 placeholder-white/70 text-white pl-10 pr-4 py-2 outline-none ring-1 ring-white/20 focus:ring-2 focus:ring-white/40"
            />
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-white/80">
              <FiSearch className="w-5 h-5" />
            </span>
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
                        <ul className="text-sm text-gray-700 flex flex-wrap gap-1">
                          {user.areas.map((a) => (
                            <li key={a.id}>{a.nombre}</li>
                          )).reduce((acc, curr) => acc.concat(curr, " · "), []).slice(0, -1)}
                        </ul>
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
