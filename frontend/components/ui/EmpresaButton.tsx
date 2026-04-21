/**
 * Componente Button que usa automáticamente los colores de la empresa
 * Reemplaza al Button original para usar colores dinámicos.
 * Reenvía atributos HTML del botón (data-tour, aria-*, id, etc.) para que driver.js y accesibilidad los detecten.
 */

"use client";

import { forwardRef } from "react";
import { FaSpinner } from "react-icons/fa";
import { useEmpresaColors } from "@/hooks/useEmpresaColors";

interface EmpresaButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "style"> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "tertiary" | "danger" | "success" | "outline";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  loading?: boolean;
  className?: string;
}

const EmpresaButton = forwardRef<HTMLButtonElement, EmpresaButtonProps>(function EmpresaButton({
  children,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  loading = false,
  className = "",
  title,
  ...rest
}, ref) {
  const colors = useEmpresaColors();

  const baseClasses =
    "font-semibold rounded-lg flex flex-row items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 touch-manipulation";

  const sizeClasses = {
    sm: "min-h-9 px-3 py-2 text-sm",
    md: "min-h-11 px-4 py-2.5 text-base",
    lg: "min-h-12 px-6 py-3 text-lg",
  };
  
  const widthClass = fullWidth ? "w-full" : "";
  const disabledClass = disabled || loading ? "opacity-50 cursor-not-allowed" : "";

  // Estilos según variante
  const getVariantStyle = () => {
    switch (variant) {
      case "primary":
        return {
          backgroundColor: colors.primary,
          color: "white",
          focusRingColor: colors.primary,
        };
      case "secondary":
        return {
          backgroundColor: colors.secondary,
          color: "white",
          focusRingColor: colors.secondary,
        };
      case "tertiary":
        return {
          backgroundColor: colors.tertiary,
          color: "white",
          focusRingColor: colors.tertiary,
        };
      case "danger":
        return {
          backgroundColor: "#dc2626",
          color: "white",
          focusRingColor: "#dc2626",
        };
      case "success":
        return {
          backgroundColor: "#16a34a",
          color: "white",
          focusRingColor: "#16a34a",
        };
      case "outline":
        return {
          backgroundColor: "transparent",
          color: colors.primary,
          border: `2px solid ${colors.primary}`,
          focusRingColor: colors.primary,
        };
      default:
        return {
          backgroundColor: colors.primary,
          color: "white",
          focusRingColor: colors.primary,
        };
    }
  };

  const variantStyle = getVariantStyle();

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`${baseClasses} ${sizeClasses[size]} ${widthClass} ${disabledClass} ${className}`}
      style={{
        backgroundColor: variantStyle.backgroundColor,
        color: variantStyle.color,
        border: variantStyle.border || "none",
        ...(variant !== "outline" && {
          boxShadow: `0 1px 2px 0 rgba(${colors.primaryRgb}, 0.1)`,
        }),
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading && variant !== "outline") {
          e.currentTarget.style.opacity = "0.9";
          e.currentTarget.style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.opacity = disabled || loading ? "0.5" : "1";
          e.currentTarget.style.transform = "translateY(0)";
        }
      }}
      {...rest}
    >
      {loading ? (
        <span className="flex items-center justify-center">
          <FaSpinner className="animate-spin -ml-1 mr-3 h-5 w-5" />
          Cargando...
        </span>
      ) : (
        children
      )}
    </button>
  );
});

export default EmpresaButton;
