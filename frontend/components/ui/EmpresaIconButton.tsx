/**
 * Componente IconButton que usa automáticamente los colores de la empresa
 * Para botones pequeños con iconos
 */

"use client";

import { useEmpresaColors } from "@/hooks/useEmpresaColors";

interface EmpresaIconButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "tertiary" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  title?: string;
  className?: string;
}

export default function EmpresaIconButton({
  icon,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  title,
  className = "",
}: EmpresaIconButtonProps) {
  const colors = useEmpresaColors();

  const sizeClasses = {
    sm: "p-1.5",
    md: "p-2",
    lg: "p-3",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
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
      case "danger":
        return {
          backgroundColor: "#dc2626",
          color: "white",
        };
      case "success":
        return {
          backgroundColor: "#16a34a",
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
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center justify-center rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${sizeClasses[size]} ${className} ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
      style={{
        backgroundColor: variantStyle.backgroundColor,
        color: variantStyle.color,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.opacity = "0.9";
          e.currentTarget.style.transform = "scale(1.05)";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.opacity = "1";
          e.currentTarget.style.transform = "scale(1)";
        }
      }}
    >
      <span className={iconSizes[size]}>{icon}</span>
    </button>
  );
}
