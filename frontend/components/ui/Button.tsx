/**
 * Componente Button reutilizable
 * Botón con diferentes variantes y estados
 * Ahora usa automáticamente los colores de la empresa
 */

"use client";

import EmpresaButton from "./EmpresaButton";

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "tertiary" | "danger" | "success" | "outline";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  loading?: boolean;
  className?: string;
}

/**
 * Button ahora usa EmpresaButton internamente para mantener compatibilidad
 * y usar automáticamente los colores de la empresa
 */
export default function Button(props: ButtonProps) {
  // Mapear variant "secondary" antiguo a "secondary" nuevo
  const variant = props.variant === "secondary" ? "secondary" : props.variant || "primary";
  
  return <EmpresaButton {...props} variant={variant} />;
}

