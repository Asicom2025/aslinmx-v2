"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { usePermisos } from "@/hooks/usePermisos";
import LogoDx from "@/assets/logos/logo_dx-legal.png";
import {
  FiHome,
  FiCalendar,
  FiUsers,
  FiSliders,
  FiBarChart2,
  FiSettings,
  FiClock,
  FiHelpCircle,
  FiX,
} from "react-icons/fi";
import TourButton from "@/components/ui/TourButton";
import { FaFileContract } from "react-icons/fa";

const baseLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/siniestros", label: "Siniestros" },
  { href: "/agenda", label: "Agenda" },
  { href: "/usuarios", label: "Usuarios" },
  { href: "/parametros", label: "Parámetros" },
  { href: "/reportes", label: "Reportes" },
  { href: "/configuracion", label: "Configuración" },
  { href: "/historico", label: "Histórico" },
  { href: "/soporte", label: "Ayuda y Soporte" },
];

const iconMap: Record<string, JSX.Element> = {
  "/dashboard": <FiHome className="w-5 h-5" />,
  "/siniestros": <FaFileContract className="w-5 h-5" />,
  "/agenda": <FiCalendar className="w-5 h-5" />,
  "/usuarios": <FiUsers className="w-5 h-5" />,
  "/parametros": <FiSliders className="w-5 h-5" />,
  "/reportes": <FiBarChart2 className="w-5 h-5" />,
  "/configuracion": <FiSettings className="w-5 h-5" />,
  "/historico": <FiClock className="w-5 h-5" />,
  "/soporte": <FiHelpCircle className="w-5 h-5" />,
};

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { activeEmpresa } = useUser();
  const { canAccessRoute } = usePermisos();

  const gradientStyle = useMemo(() => {
    const primary = activeEmpresa?.color_secundario || "#0A2E5C";
    return {
      backgroundColor: primary,
    };
  }, [activeEmpresa]);

  const logoSrc = activeEmpresa?.logo_url || LogoDx.src;
  const links = useMemo(() => {
    return baseLinks
      .filter((link) => link.href !== "/empresas")
      .filter((link) => canAccessRoute(link.href));
  }, [canAccessRoute]);

  useEffect(() => {
    const handler = (e: any) => {
      const toggleEl = (e.target as HTMLElement).closest(
        "[data-sidebar-toggle]"
      );
      if (toggleEl) setOpen((prev: boolean) => !prev);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => {
      if (mq.matches && open) document.body.style.overflow = "hidden";
      else document.body.style.overflow = "";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 top-16 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        data-tour="sidebar"
        style={gradientStyle}
        className={`fixed z-40 left-0 top-16 bottom-0 flex w-64 flex-col transform transition-transform duration-200 ease-in-out text-white lg:inset-y-0 lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      <div className="relative flex h-50 items-center justify-center border-b border-white/10 font-semibold tracking-wide">
        <button
          type="button"
          aria-label="Cerrar menú"
          className="absolute right-2 top-2 rounded-md p-2 hover:bg-white/10 lg:hidden"
          onClick={() => setOpen(false)}
        >
          <FiX className="h-5 w-5" />
        </button>
        <img
          src={logoSrc}
          onError={(e) => {
            e.currentTarget.src = LogoDx.src;
          }}
          alt={activeEmpresa?.nombre || "Logo"}
          className="h-full w-full object-contain"
        />
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/10"
            onClick={() => setOpen(false)}
          >
            {iconMap[item.href]}
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </nav>
      {/* Botón de tour general en el pie del sidebar */}
      <div className="px-4 pb-4 border-t border-white/10 pt-3">
        <TourButton
          tour="tour-general"
          label="Tour de bienvenida"
          className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors w-full"
        />
      </div>
    </aside>
    </>
  );
}
