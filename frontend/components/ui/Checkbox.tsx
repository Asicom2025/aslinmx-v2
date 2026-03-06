/**
 * Componente Checkbox reutilizable
 * Checkbox con estilos consistentes para permisos y formularios
 */

"use client";

import { useEmpresaColors } from "@/hooks/useEmpresaColors";

interface CheckboxProps {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  description?: string;
}

export default function Checkbox({
  label,
  checked,
  onChange,
  disabled = false,
  size = "md",
  description,
}: CheckboxProps) {
  const colors = useEmpresaColors();

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  return (
    <label
      className={`flex items-start gap-3 ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
        className={`${sizeClasses[size]} rounded border-gray-300 focus:ring-2 focus:ring-offset-1 transition-colors flex-shrink-0 mt-0.5`}
        style={{
          accentColor: colors.primary,
        }}
      />
      <div className="flex flex-col">
        {label && (
          <span
            className={`font-medium text-gray-900 ${
              disabled ? "cursor-not-allowed" : ""
            }`}
          >
            {label}
          </span>
        )}
        {description && (
          <span className="text-sm text-gray-500 mt-0.5">{description}</span>
        )}
      </div>
    </label>
  );
}
