/**
 * Componente Input reutilizable
 * Campo de entrada con label y estilos consistentes
 */

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  type?: string;
  name: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  step?: string | number;
  /** Contenido a la derecha del campo (p. ej. botón mostrar contraseña) */
  endAdornment?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({
  label,
  type = "text",
  name,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  error,
  step,
  endAdornment,
  ...rest
}, ref) {
  const hasEnd = Boolean(endAdornment);

  const inputClassName = `w-full border rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
    hasEnd ? "pl-3 pr-10" : "px-3"
  } ${
    error ? "border-red-500 focus:ring-red-500" : "border-gray-300"
  } ${disabled ? "bg-gray-100 cursor-not-allowed" : ""}`;

  const inputEl = (
    <input
      ref={ref}
      type={type}
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      step={step}
      {...rest}
      className={inputClassName}
    />
  );

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {hasEnd ? (
        <div className="relative">
          {inputEl}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <div className="pointer-events-auto">{endAdornment}</div>
          </div>
        </div>
      ) : (
        inputEl
      )}
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
});

export default Input;

