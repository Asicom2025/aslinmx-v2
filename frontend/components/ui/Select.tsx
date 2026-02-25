/**
 * Componente Select reutilizable basado en React Select
 * Soporta selección única y múltiple
 */

"use client";

import React from "react";
import Select, { StylesConfig, GroupBase } from "react-select";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  name: string;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  isMulti?: boolean;
  isClearable?: boolean;
  isSearchable?: boolean;
}

export default function CustomSelect({
  label,
  name,
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  required = false,
  disabled = false,
  error,
  isMulti = false,
  isClearable = true,
  isSearchable = true,
}: SelectProps) {
  const handleChange = (selected: any) => {
    if (isMulti) {
      const values = selected ? selected.map((opt: SelectOption) => opt.value) : [];
      onChange(values);
    } else {
      onChange(selected ? selected.value : "");
    }
  };

  const getValue = () => {
    if (isMulti) {
      const valuesArray = Array.isArray(value) ? value : value ? [value] : [];
      return options.filter((opt) => valuesArray.includes(opt.value));
    } else {
      return options.find((opt) => opt.value === value) || null;
    }
  };

  const customStyles: StylesConfig<SelectOption, boolean, GroupBase<SelectOption>> = {
    control: (provided, state) => ({
      ...provided,
      borderColor: error
        ? "#ef4444"
        : state.isFocused
        ? "#3b82f6"
        : "#d1d5db",
      borderRadius: "0.5rem",
      padding: "0.125rem",
      boxShadow: state.isFocused
        ? error
          ? "0 0 0 3px rgba(239, 68, 68, 0.1)"
          : "0 0 0 3px rgba(59, 130, 246, 0.1)"
        : "none",
      "&:hover": {
        borderColor: error ? "#ef4444" : "#9ca3af",
      },
      backgroundColor: disabled ? "#f3f4f6" : "#ffffff",
      cursor: disabled ? "not-allowed" : "pointer",
    }),
    placeholder: (provided) => ({
      ...provided,
      color: "#9ca3af",
    }),
    singleValue: (provided) => ({
      ...provided,
      color: "#111827",
    }),
    multiValue: (provided) => ({
      ...provided,
      backgroundColor: "#e5e7eb",
    }),
    multiValueLabel: (provided) => ({
      ...provided,
      color: "#111827",
    }),
    multiValueRemove: (provided) => ({
      ...provided,
      color: "#6b7280",
      "&:hover": {
        backgroundColor: "#d1d5db",
        color: "#111827",
      },
    }),
    menu: (provided) => ({
      ...provided,
      borderRadius: "0.5rem",
      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? "#3b82f6"
        : state.isFocused
        ? "#eff6ff"
        : "#ffffff",
      color: state.isSelected ? "#ffffff" : "#111827",
      cursor: "pointer",
      "&:active": {
        backgroundColor: state.isSelected ? "#3b82f6" : "#dbeafe",
      },
    }),
  };

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <Select<SelectOption, boolean>
        name={name}
        value={getValue()}
        onChange={handleChange}
        options={options}
        placeholder={placeholder}
        isDisabled={disabled}
        isMulti={isMulti}
        isClearable={isClearable}
        isSearchable={isSearchable}
        styles={customStyles}
        classNamePrefix="react-select"
        noOptionsMessage={() => "No hay opciones disponibles"}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}
