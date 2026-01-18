/**
 * Componente TimelineStep que usa automáticamente los colores de la empresa
 * Para usar en timelines y steppers
 */

"use client";

import { useEmpresaColors } from "@/hooks/useEmpresaColors";

interface EmpresaTimelineStepProps {
  step: number | string;
  active?: boolean;
  completed?: boolean;
  isLast?: boolean;
  children: React.ReactNode;
  className?: string;
}

export default function EmpresaTimelineStep({
  step,
  active = false,
  completed = false,
  isLast = false,
  children,
  className = "",
}: EmpresaTimelineStepProps) {
  const colors = useEmpresaColors();

  return (
    <div className={`relative flex items-start group ${className}`}>
      {/* Línea conectora vertical */}
      {!isLast && (
        <div
          className="absolute left-5 top-10 w-0.5 h-full transition-colors"
          style={{
            height: "calc(100% - 8px)",
            backgroundColor: `${colors.secondary}40`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${colors.secondary}80`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `${colors.secondary}40`;
          }}
        />
      )}

      {/* Número de paso */}
      <div
        className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm shadow-md transition-all"
        style={{
          background: completed
            ? `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`
            : active
            ? `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`
            : `linear-gradient(135deg, ${colors.secondary}60 0%, ${colors.secondary}40 100%)`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        {step}
      </div>

      {/* Contenido */}
      <div className="ml-4 flex-1 pb-8">{children}</div>
    </div>
  );
}
