/**
 * Componente Switch reutilizable
 * Switch toggle moderno y bonito para reemplazar checkboxes
 */

interface SwitchProps {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function Switch({
  label,
  checked,
  onChange,
  disabled = false,
  size = "md",
}: SwitchProps) {
  const sizeClasses = {
    sm: {
      container: "h-5 w-9",
      circle: "h-3 w-3",
      translate: "translate-x-4",
    },
    md: {
      container: "h-6 w-11",
      circle: "h-4 w-4",
      translate: "translate-x-6",
    },
    lg: {
      container: "h-7 w-13",
      circle: "h-5 w-5",
      translate: "translate-x-7",
    },
  };

  const sizeConfig = sizeClasses[size];

  return (
    <label className={`flex items-center gap-3 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex ${sizeConfig.container} items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
          checked ? "bg-primary-600" : "bg-gray-300"
        } ${disabled ? "cursor-not-allowed" : ""}`}
      >
        <span
          className={`inline-block ${sizeConfig.circle} transform rounded-full bg-white transition-transform shadow-sm ${
            checked ? sizeConfig.translate : "translate-x-1"
          }`}
        />
      </button>
      {label && (
        <span className={`text-sm font-medium text-gray-700 ${disabled ? "cursor-not-allowed" : ""}`}>
          {label}
        </span>
      )}
    </label>
  );
}

