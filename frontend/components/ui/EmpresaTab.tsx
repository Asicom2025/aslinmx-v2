/**
 * Componente Tab que usa automáticamente los colores de la empresa
 * Para usar en grupos de tabs
 */

"use client";

import { useEmpresaColors } from "@/hooks/useEmpresaColors";

interface EmpresaTabProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  count?: number;
  className?: string;
}

export function EmpresaTab({
  label,
  active,
  onClick,
  icon,
  count,
  className = "",
}: EmpresaTabProps) {
  const colors = useEmpresaColors();

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${className}`}
      style={{
        borderBottomColor: active ? colors.primary : "transparent",
        color: active ? colors.primary : colors.secondary,
        backgroundColor: active ? "white" : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = `${colors.secondary}08`;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = "transparent";
        }
      }}
    >
      <div className="flex items-center gap-2">
        {icon && <span>{icon}</span>}
        <span>{label}</span>
        {count !== undefined && count > 0 && (
          <span className="ml-1">({count})</span>
        )}
      </div>
    </button>
  );
}

interface EmpresaTabsProps {
  tabs: Array<{
    id: string;
    label: string;
    icon?: React.ReactNode;
    count?: number;
  }>;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function EmpresaTabs({
  tabs,
  activeTab,
  onTabChange,
  className = "",
}: EmpresaTabsProps) {
  const colors = useEmpresaColors();

  return (
    <div className={`flex border-b border-gray-200 ${className}`} style={{ backgroundColor: `${colors.secondary}08` }}>
      {tabs.map((tab) => (
        <EmpresaTab
          key={tab.id}
          label={tab.label}
          active={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          icon={tab.icon}
          count={tab.count}
        />
      ))}
    </div>
  );
}
