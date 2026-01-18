/**
 * Componente Card que usa automáticamente los colores de la empresa
 * Con hover effects usando los colores de la empresa
 */

"use client";

import { useEmpresaColors } from "@/hooks/useEmpresaColors";
import { useState } from "react";

interface EmpresaCardProps {
  children: React.ReactNode;
  hoverable?: boolean;
  className?: string;
  onClick?: () => void;
}

export default function EmpresaCard({
  children,
  hoverable = true,
  className = "",
  onClick,
}: EmpresaCardProps) {
  const colors = useEmpresaColors();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm transition-all ${
        hoverable ? "cursor-pointer" : ""
      } ${className}`}
      style={{
        borderColor: isHovered && hoverable ? `${colors.primary}60` : "rgba(0, 0, 0, 0.1)",
        boxShadow: isHovered && hoverable
          ? `0 4px 6px -1px rgba(${colors.primaryRgb}, 0.1), 0 2px 4px -1px rgba(${colors.primaryRgb}, 0.06)`
          : "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        transform: isHovered && hoverable ? "translateY(-2px)" : "translateY(0)",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
