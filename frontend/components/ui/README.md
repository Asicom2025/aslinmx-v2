# Componentes UI con Colores de Empresa

Esta carpeta contiene componentes reutilizables que **automáticamente** usan los colores de la empresa activa. No necesitas pasar colores manualmente, los componentes los obtienen del contexto de usuario.

## Hook: `useEmpresaColors`

Hook que retorna los colores de la empresa activa:

```tsx
import { useEmpresaColors } from "@/hooks/useEmpresaColors";

function MyComponent() {
  const colors = useEmpresaColors();
  
  // colors.primary - Color principal
  // colors.secondary - Color secundario
  // colors.tertiary - Color terciario
  // colors.gradient - Gradiente completo
  // colors.primaryRgb - RGB para usar en rgba()
}
```

## Componentes Disponibles

### 1. EmpresaButton

Botón que usa automáticamente los colores de la empresa.

```tsx
import { EmpresaButton } from "@/components/ui";

<EmpresaButton variant="primary" onClick={handleClick}>
  Guardar
</EmpresaButton>

<EmpresaButton variant="secondary" size="sm">
  Cancelar
</EmpresaButton>

<EmpresaButton variant="tertiary" loading={isLoading}>
  Procesar
</EmpresaButton>
```

**Variantes**: `primary`, `secondary`, `tertiary`, `danger`, `success`, `outline`

### 2. Button (Actualizado)

El componente `Button` original ahora usa automáticamente los colores de la empresa:

```tsx
import Button from "@/components/ui/Button";

<Button variant="primary">Guardar</Button>
```

### 3. EmpresaTab / EmpresaTabs

Tabs que usan colores de la empresa:

```tsx
import { EmpresaTabs } from "@/components/ui";

<EmpresaTabs
  tabs={[
    { id: "tab1", label: "Etapas", icon: <FiLayers />, count: 5 },
    { id: "tab2", label: "Documentos", icon: <FiFileText />, count: 10 },
  ]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>
```

### 4. EmpresaBadge

Badge con colores de la empresa:

```tsx
import { EmpresaBadge } from "@/components/ui";

<EmpresaBadge variant="primary">Nuevo</EmpresaBadge>
<EmpresaBadge variant="secondary" size="sm">5</EmpresaBadge>
```

### 5. EmpresaTimelineStep

Paso de timeline con colores de la empresa:

```tsx
import { EmpresaTimelineStep } from "@/components/ui";

<EmpresaTimelineStep
  step={1}
  active={true}
  completed={false}
  isLast={false}
>
  <div>Contenido del paso</div>
</EmpresaTimelineStep>
```

### 6. EmpresaCard

Tarjeta con efectos hover usando colores de la empresa:

```tsx
import { EmpresaCard } from "@/components/ui";

<EmpresaCard hoverable={true} onClick={handleClick}>
  <h3>Título</h3>
  <p>Contenido</p>
</EmpresaCard>
```

### 7. EmpresaIconButton

Botón pequeño con icono:

```tsx
import { EmpresaIconButton } from "@/components/ui";
import { FiEdit } from "react-icons/fi";

<EmpresaIconButton
  icon={<FiEdit />}
  variant="primary"
  onClick={handleEdit}
  title="Editar"
/>
```

## Migración

Para migrar código existente:

1. **Botones**: Reemplaza `<button>` con `<EmpresaButton>` o usa `<Button>` (ya actualizado)
2. **Tabs**: Reemplaza tabs manuales con `<EmpresaTabs>`
3. **Badges**: Reemplaza `<span>` con `<EmpresaBadge>`
4. **Cards**: Reemplaza `<div>` con `<EmpresaCard>`

## Ejemplo Completo

```tsx
"use client";

import { 
  EmpresaButton, 
  EmpresaTabs, 
  EmpresaBadge, 
  EmpresaCard,
  useEmpresaColors 
} from "@/components/ui";
import { FiLayers, FiFileText } from "react-icons/fi";

export default function MyPage() {
  const [activeTab, setActiveTab] = useState("tab1");
  const colors = useEmpresaColors();

  return (
    <div>
      <EmpresaTabs
        tabs={[
          { id: "tab1", label: "Etapas", icon: <FiLayers /> },
          { id: "tab2", label: "Documentos", icon: <FiFileText /> },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <EmpresaCard hoverable>
        <h3>Título</h3>
        <EmpresaBadge variant="primary">Nuevo</EmpresaBadge>
      </EmpresaCard>

      <EmpresaButton variant="primary" onClick={handleSave}>
        Guardar
      </EmpresaButton>
    </div>
  );
}
```

## Notas

- Todos los componentes obtienen los colores automáticamente del contexto
- Si no hay empresa activa, usan colores por defecto
- Los colores se actualizan automáticamente al cambiar de empresa
- Compatible con modo oscuro (si se implementa en el futuro)
