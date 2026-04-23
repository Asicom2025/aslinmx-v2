/**
 * Hook para obtener los colores de la empresa activa
 * Retorna los colores con valores por defecto si no están disponibles
 */

import { useMemo } from "react";
import { useUser } from "@/context/UserContext";

export interface EmpresaColors {
  primary: string;
  secondary: string;
  tertiary: string;
  primaryRgb: string; // Para usar en rgba
  secondaryRgb: string;
  tertiaryRgb: string;
  gradient: string; // Gradiente completo
}

const DEFAULT_COLORS = {
  primary: "#c43267",
  secondary: "#2b4f83",
  tertiary: "#3098cb",
};

/**
 * Convierte un color hex a RGB
 */
function hexToRgb(hex: string): string {
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(expanded);
  if (!result) return "0, 0, 0";
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

export function useEmpresaColors(): EmpresaColors {
  const { activeEmpresa } = useUser();

  return useMemo(() => {
    const primary = activeEmpresa?.color_principal || DEFAULT_COLORS.primary;
    const secondary = activeEmpresa?.color_secundario || DEFAULT_COLORS.secondary;
    const tertiary = activeEmpresa?.color_terciario || DEFAULT_COLORS.tertiary;

    return {
      primary,
      secondary,
      tertiary,
      primaryRgb: hexToRgb(primary),
      secondaryRgb: hexToRgb(secondary),
      tertiaryRgb: hexToRgb(tertiary),
      gradient: `linear-gradient(90deg, ${primary} 0%, ${secondary} 50%, ${tertiary} 100%)`,
    };
  }, [activeEmpresa]);
}
