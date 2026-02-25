/**
 * Exportación centralizada de componentes UI
 * Facilita la importación de componentes reutilizables
 */

// Componentes con colores de empresa
export { default as EmpresaButton } from "./EmpresaButton";
export { EmpresaTab, EmpresaTabs } from "./EmpresaTab";
export { default as EmpresaBadge } from "./EmpresaBadge";
export { default as EmpresaTimelineStep } from "./EmpresaTimelineStep";
export { default as EmpresaCard } from "./EmpresaCard";
export { default as EmpresaIconButton } from "./EmpresaIconButton";
export { default as EmpresaSelect } from "./EmpresaSelect";

// Componentes originales (mantienen compatibilidad)
export { default as Button } from "./Button";
export { default as Input } from "./Input";
export { default as Modal } from "./Modal";
export { default as DataTable } from "./DataTable";
export { default as Select } from "./Select";
export { default as Switch } from "./Switch";
export { default as JoditEditor } from "./JoditEditor";
export { default as TiptapEditor } from "./TiptapEditor"; // Mantener para compatibilidad temporal

// Hook para colores de empresa
export { useEmpresaColors } from "@/hooks/useEmpresaColors";
export type { EmpresaColors } from "@/hooks/useEmpresaColors";
