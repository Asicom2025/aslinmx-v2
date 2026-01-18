/**
 * Componente Select que usa automáticamente los colores de la empresa
 */

"use client";

import { useEmpresaColors } from "@/hooks/useEmpresaColors";

interface EmpresaSelectOption {
  value: string;
  label: string;
  color?: string;
}

interface EmpresaSelectProps {
  value?: string;
  onChange: (value: string) => void;
  options: EmpresaSelectOption[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export default function EmpresaSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  label,
  disabled = false,
  className = "",
}: EmpresaSelectProps) {
  const colors = useEmpresaColors();
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors appearance-none bg-white cursor-pointer ${
            disabled ? "bg-gray-100 cursor-not-allowed opacity-50" : ""
          }`}
          style={{
            borderColor: value ? `${colors.primary}60` : "rgba(0, 0, 0, 0.1)",
            ...(value && {
              boxShadow: `0 0 0 2px ${colors.primary}20`,
            }),
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = colors.primary;
            e.currentTarget.style.boxShadow = `0 0 0 2px ${colors.primary}20`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = value ? `${colors.primary}60` : "rgba(0, 0, 0, 0.1)";
            e.currentTarget.style.boxShadow = value ? `0 0 0 2px ${colors.primary}20` : "none";
          }}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {/* Icono de flecha personalizado */}
        <div
          className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none"
          style={{ color: colors.primary }}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
      {/* Badge del valor seleccionado con color */}
      {selectedOption && selectedOption.color && (
        <div className="mt-2 flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: selectedOption.color }}
          />
          <span className="text-xs text-gray-500">
            {selectedOption.label}
          </span>
        </div>
      )}
    </div>
  );
}
