"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
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
} from "react-icons/fi";
import TourButton from "@/components/ui/TourButton";
import { FaFileContract } from "react-icons/fa";

const baseLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/siniestros", label: "Siniestros" },
  { href: "/agenda", label: "Agenda" },
  { href: "/usuarios", label: "Usuarios y Roles" },
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

  return (
    <aside
      data-tour="sidebar"
      style={gradientStyle}
      className={`fixed z-40 inset-y-0 left-0 h-screen w-64 transform transition-transform duration-200 ease-in-out text-white lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="h-50 flex items-center justify-center font-semibold tracking-wide border-b border-white/10">
        <img
          src={logoSrc}
          onError={(e) => {
            e.currentTarget.src = LogoDx.src;
          }}
          alt={activeEmpresa?.nombre || "Logo"}
          className="h-full w-full object-contain"
        />
      </div>
      <nav className="py-4 flex-1">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/10"
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
  );
}
