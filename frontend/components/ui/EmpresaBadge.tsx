/**
 * Componente Badge que usa automáticamente los colores de la empresa
 */

"use client";

import { useEmpresaColors } from "@/hooks/useEmpresaColors";

interface EmpresaBadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "tertiary" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function EmpresaBadge({
  children,
  variant = "primary",
  size = "md",
  className = "",
}: EmpresaBadgeProps) {
  const colors = useEmpresaColors();

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-xs",
    md: "px-2 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  };

  const getVariantStyle = () => {
    switch (variant) {
      case "primary":
        return {
          backgroundColor: colors.primary,
          color: "white",
        };
      case "secondary":
        return {
          backgroundColor: colors.secondary,
          color: "white",
        };
      case "tertiary":
        return {
          backgroundColor: colors.tertiary,
          color: "white",
        };
      case "success":
        return {
          backgroundColor: "#16a34a",
          color: "white",
        };
      case "warning":
        return {
          backgroundColor: "#eab308",
          color: "white",
        };
      case "danger":
        return {
          backgroundColor: "#dc2626",
          color: "white",
        };
      case "info":
        return {
          backgroundColor: "#3b82f6",
          color: "white",
        };
      default:
        return {
          backgroundColor: colors.primary,
          color: "white",
        };
    }
  };

  const variantStyle = getVariantStyle();

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]} ${className}`}
      style={variantStyle}
    >
      {children}
    </span>
  );
}
