# Sistema de Flujos de Trabajo Configurables por Empresa

## 📋 Visión General

Este sistema permite que **cada empresa configure su propio flujo de trabajo** para la gestión de siniestros, con etapas personalizables, orden configurable y control de documentos por etapa.

### Características Principales:
- ✅ **Configuración por empresa**: Cada empresa tiene sus propios flujos
- ✅ **Etapas configurables**: Nombre, orden, requisitos personalizables
- ✅ **Documento principal por etapa**: Cada etapa puede requerir un documento obligatorio
- ✅ **Documentos adicionales**: Se pueden agregar documentos extra en cada etapa
- ✅ **Control de avance**: Bloqueo de siguiente etapa si falta documento requerido
- ✅ **Seguimiento completo**: Estado de cada etapa por siniestro

---

## 🏗️ Estructura del Sistema

### Tablas Principales:

1. **`flujos_trabajo`**: Flujos de trabajo por empresa
2. **`etapas_flujo`**: Etapas/procesos dentro de cada flujo
3. **`siniestro_etapas`**: Seguimiento de etapas por siniestro
4. **`documentos`**: Extendida con relación a etapas y flags de principal/adicional

---

## 🔄 Flujos de Uso

### 1. **Configurar Flujo General de Empresa (Para todas las áreas)**

```sql
-- Paso 1: Crear flujo general de trabajo (area_id = NULL)
INSERT INTO flujos_trabajo (
    empresa_id,
    area_id,  -- NULL = flujo general de empresa
    nombre,
    descripcion,
    es_predeterminado,
    activo
) VALUES (
    'uuid-empresa-dxlegal',
    NULL,  -- Flujo general, aplica a todas las áreas
    'Flujo DX Legal General',
    'Flujo estándar de gestión de siniestros para DX Legal (aplica a todas las áreas)',
    TRUE,  -- Es el flujo predeterminado general
    TRUE
) RETURNING id;
-- Resultado: uuid-flujo-dxlegal-general

-- Paso 2: Obtener IDs de tipos de documento (si ya existen)
SELECT id INTO v_tipo_primera 
FROM tipos_documento 
WHERE empresa_id = 'uuid-empresa-dxlegal' 
AND nombre = 'Informe Primera Atención';

SELECT id INTO v_tipo_preliminar 
FROM tipos_documento 
WHERE empresa_id = 'uuid-empresa-dxlegal' 
AND nombre = 'Informe Preliminar';

SELECT id INTO v_tipo_actualizacion 
FROM tipos_documento 
WHERE empresa_id = 'uuid-empresa-dxlegal' 
AND nombre = 'Informe Actualización';

SELECT id INTO v_tipo_cancelacion 
FROM tipos_documento 
WHERE empresa_id = 'uuid-empresa-dxlegal' 
AND nombre = 'Informe Cancelación';

-- Paso 3: Crear etapas del flujo
INSERT INTO etapas_flujo (
    flujo_trabajo_id,
    nombre,
    descripcion,
    orden,
    es_obligatoria,
    tipo_documento_principal_id,
    inhabilita_siguiente,  -- Bloquea avanzar si no está completa
    activo
) VALUES
-- Etapa 1: Primera Atención
(
    'uuid-flujo-dxlegal',
    'Informe Primera Atención',
    'Primera evaluación del siniestro',
    1,
    TRUE,
    v_tipo_primera,
    TRUE,  -- Bloquea siguiente etapa si no está completa
    TRUE
),
-- Etapa 2: Preliminar
(
    'uuid-flujo-dxlegal',
    'Informe Preliminar',
    'Análisis técnico-legal inicial',
    2,
    TRUE,
    v_tipo_preliminar,
    TRUE,  -- Bloquea siguiente etapa
    TRUE
),
-- Etapa 3: Actualización
(
    'uuid-flujo-dxlegal',
    'Informe Actualización',
    'Seguimiento de avances del caso',
    3,
    TRUE,
    v_tipo_actualizacion,
    FALSE,  -- No bloquea, es opcional avanzar
    TRUE
),
-- Etapa 4: Cancelación
(
    'uuid-flujo-dxlegal',
    'Informe Cancelación',
    'Documentación de cierre del proceso',
    4,
    TRUE,
    v_tipo_cancelacion,
    TRUE,  -- Bloquea si no está completa
    TRUE
);
```

### 2. **Configurar Flujo Específico para un Área**

```sql
-- Ejemplo: Área "Penal" requiere un flujo diferente al general

-- Paso 1: Obtener ID del área
SELECT id INTO v_area_penal_id 
FROM areas 
WHERE empresa_id = 'uuid-empresa-dxlegal' 
AND codigo = 'PEN';

-- Paso 2: Crear flujo específico para el área Penal
INSERT INTO flujos_trabajo (
    empresa_id,
    area_id,  -- Específico del área
    nombre,
    descripcion,
    es_predeterminado,
    activo
) VALUES (
    'uuid-empresa-dxlegal',
    v_area_penal_id,  -- Flujo específico del área Penal
    'Flujo Área Penal',
    'Flujo especializado para casos penales',
    TRUE,  -- Es el predeterminado para esta área
    TRUE
) RETURNING id;
-- Resultado: uuid-flujo-area-penal

-- Paso 3: Crear etapas específicas para área Penal
INSERT INTO etapas_flujo (
    flujo_trabajo_id,
    nombre,
    descripcion,
    orden,
    es_obligatoria,
    tipo_documento_principal_id,
    inhabilita_siguiente,
    activo
) VALUES
-- Etapa 1: Recepción del caso penal
(
    'uuid-flujo-area-penal',
    'Recepción Penal',
    'Recepción y registro inicial del caso penal',
    1,
    TRUE,
    (SELECT id FROM tipos_documento WHERE nombre = 'Querella Penal'
     AND empresa_id = 'uuid-empresa-dxlegal' LIMIT 1),
    TRUE,
    TRUE
),
-- Etapa 2: Investigación preliminar
(
    'uuid-flujo-area-penal',
    'Investigación Preliminar',
    'Investigación inicial del caso',
    2,
    TRUE,
    NULL,  -- Sin documento principal requerido
    FALSE,
    TRUE
),
-- Etapa 3: Presentación ante autoridad
(
    'uuid-flujo-area-penal',
    'Presentación Ante Autoridad',
    'Presentación formal ante Ministerio Público',
    3,
    TRUE,
    NULL,
    TRUE,
    TRUE
),
-- Etapa 4: Seguimiento del proceso
(
    'uuid-flujo-area-penal',
    'Seguimiento Proceso Penal',
    'Seguimiento del proceso judicial',
    4,
    FALSE,  -- Opcional
    NULL,
    FALSE,
    TRUE
);

-- Nota: Cuando un siniestro se asigne al área Penal,
-- automáticamente usará este flujo en lugar del general
```

### 3. **Ejemplo: Configurar Flujo Alternativo para Otra Empresa**

```sql
-- Empresa que requiere flujo diferente:
-- Cotización → Primera Atención → Preliminar → Actualización → Cancelación

-- Paso 1: Crear flujo general
INSERT INTO flujos_trabajo (
    empresa_id,
    area_id,  -- NULL = flujo general
    nombre,
    descripcion,
    es_predeterminado,
    activo
) VALUES (
    'uuid-empresa-alternativa',
    NULL,  -- Flujo general
    'Flujo Completo con Cotización',
    'Flujo que incluye etapa de cotización inicial',
    TRUE,
    TRUE
) RETURNING id;

-- Paso 2: Crear tipos de documento necesarios (si no existen)
INSERT INTO tipos_documento (empresa_id, nombre, descripcion, area_id)
VALUES (
    'uuid-empresa-alternativa',
    'Cotización',
    'Cotización inicial de servicios',
    (SELECT id FROM areas WHERE empresa_id = 'uuid-empresa-alternativa' AND codigo = 'SIN')
) RETURNING id;

-- Paso 3: Crear etapas
INSERT INTO etapas_flujo (
    flujo_trabajo_id,
    nombre,
    descripcion,
    orden,
    es_obligatoria,
    tipo_documento_principal_id,
    inhabilita_siguiente,
    activo
) VALUES
-- Etapa 1: Cotización
(
    'uuid-flujo-alternativo',
    'Cotización',
    'Generación de cotización inicial',
    1,
    TRUE,
    (SELECT id FROM tipos_documento WHERE nombre = 'Cotización' 
     AND empresa_id = 'uuid-empresa-alternativa'),
    TRUE,
    TRUE
),
-- Etapa 2: Primera Atención
(
    'uuid-flujo-alternativo',
    'Informe Primera Atención',
    'Primera evaluación del siniestro',
    2,
    TRUE,
    (SELECT id FROM tipos_documento WHERE nombre = 'Informe Primera Atención'
     AND empresa_id = 'uuid-empresa-alternativa'),
    TRUE,
    TRUE
),
-- Etapa 3: Preliminar
(
    'uuid-flujo-alternativo',
    'Informe Preliminar',
    'Análisis técnico-legal inicial',
    3,
    TRUE,
    (SELECT id FROM tipos_documento WHERE nombre = 'Informe Preliminar'
     AND empresa_id = 'uuid-empresa-alternativo'),
    TRUE,
    TRUE
),
-- Etapa 4: Actualización
(
    'uuid-flujo-alternativo',
    'Informe Actualización',
    'Seguimiento de avances',
    4,
    FALSE,  -- Opcional
    (SELECT id FROM tipos_documento WHERE nombre = 'Informe Actualización'
     AND empresa_id = 'uuid-empresa-alternativa'),
    FALSE,  -- No bloquea
    TRUE
),
-- Etapa 5: Cancelación
(
    'uuid-flujo-alternativo',
    'Cancelación',
    'Cierre del proceso',
    5,
    TRUE,
    (SELECT id FROM tipos_documento WHERE nombre = 'Informe Cancelación'
     AND empresa_id = 'uuid-empresa-alternativa'),
    TRUE,
    TRUE
);
```

### 4. **Cómo Funciona la Selección Automática de Flujo**

```sql
-- Al crear un siniestro, el sistema automáticamente busca:
-- 1. Flujo específico del área asignada (area_principal_id)
-- 2. Si no existe, usa el flujo general de la empresa (area_id IS NULL)

-- Ejemplo práctico:
-- Siniestro asignado a área "Penal" (codigo = 'PEN')
-- 1. Busca flujo con area_id = 'uuid-area-penal'
-- 2. Si existe y está activo → Lo usa
-- 3. Si no existe → Busca flujo con area_id IS NULL (general)
-- 4. Si existe → Lo usa
-- 5. Si no existe → Error

-- Ver qué flujo se usará para un área específica:
SELECT 
    a.nombre as area,
    a.codigo,
    COALESCE(
        ft_area.nombre, 
        ft_general.nombre,
        'Sin flujo configurado'
    ) as flujo_aplicable,
    CASE 
        WHEN ft_area.id IS NOT NULL THEN 'Específico del área'
        WHEN ft_general.id IS NOT NULL THEN 'General de empresa'
        ELSE 'Sin flujo'
    END as tipo_flujo
FROM areas a
LEFT JOIN flujos_trabajo ft_area ON a.id = ft_area.area_id 
    AND ft_area.empresa_id = a.empresa_id
    AND ft_area.es_predeterminado = TRUE
    AND ft_area.activo = TRUE
LEFT JOIN flujos_trabajo ft_general ON ft_general.empresa_id = a.empresa_id
    AND ft_general.area_id IS NULL
    AND ft_general.es_predeterminado = TRUE
    AND ft_general.activo = TRUE
WHERE a.empresa_id = 'uuid-empresa-dxlegal'
AND a.activo = TRUE;
```

### 5. **Crear Siniestro e Inicializar Etapas**

```sql
-- IMPORTANTE: El usuario asigna manualmente, NO automático
-- Paso 1: Crear siniestro (usuario asigna manualmente)
INSERT INTO siniestros (
    empresa_id,
    numero_siniestro,
    fecha_siniestro,
    ubicacion,
    descripcion_hechos,
    numero_poliza,
    suma_asegurada,
    area_principal_id,
    estado_id,
    usuario_asignado,  -- USUARIO ASIGNA MANUALMENTE
    prioridad
) VALUES (
    'uuid-empresa-dxlegal',
    generar_numero_siniestro('uuid-empresa-dxlegal'),
    '2025-01-15 10:30:00',
    'Av. Reforma CJH-256, CDMX',
    'Colisión trasera en semáforo',
    'POL-2024-12345',
    500000.00,
    'uuid-area-siniestros',
    'uuid-estado-vigente',
    'uuid-usuario-abogado',  -- ASIGNACIÓN MANUAL
    'media'
) RETURNING id;
-- Resultado: uuid-siniestro-nuevo

-- Paso 2: Inicializar etapas del flujo (automáticamente detecta flujo por área)
SELECT inicializar_etapas_siniestro('uuid-siniestro-nuevo');
-- Esto automáticamente:
-- 1. Busca flujo específico del área "Siniestros" 
-- 2. Si no existe, usa flujo general de la empresa
-- 3. Crea registros en siniestro_etapas con estado 'pendiente'

-- Paso 3: Verificar qué flujo se aplicó
SELECT 
    s.numero_siniestro,
    a.nombre as area_asignada,
    ft.nombre as flujo_aplicado,
    CASE 
        WHEN ft.area_id IS NULL THEN 'Flujo General'
        ELSE 'Flujo Específico del Área'
    END as tipo_flujo,
    COUNT(ef.id) as total_etapas
FROM siniestros s
JOIN areas a ON s.area_principal_id = a.id
JOIN siniestro_etapas se ON s.id = se.siniestro_id
JOIN etapas_flujo ef ON se.etapa_flujo_id = ef.id
JOIN flujos_trabajo ft ON ef.flujo_trabajo_id = ft.id
WHERE s.id = 'uuid-siniestro-nuevo'
GROUP BY s.numero_siniestro, a.nombre, ft.nombre, ft.area_id;

-- Paso 4: Verificar etapas inicializadas
SELECT 
    ef.nombre as etapa,
    ef.orden,
    se.estado,
    se.fecha_inicio,
    td.nombre as documento_requerido
FROM siniestro_etapas se
JOIN etapas_flujo ef ON se.etapa_flujo_id = ef.id
LEFT JOIN tipos_documento td ON ef.tipo_documento_principal_id = td.id
WHERE se.siniestro_id = 'uuid-siniestro-nuevo'
ORDER BY ef.orden;
```

### 4. **Iniciar Primera Etapa (En Proceso)**

```sql
-- Cuando el abogado comienza a trabajar en la primera etapa
UPDATE siniestro_etapas
SET estado = 'en_proceso',
    fecha_inicio = NOW(),
    actualizado_en = NOW()
WHERE siniestro_id = 'uuid-siniestro-nuevo'
AND etapa_flujo_id = (
    SELECT id FROM etapas_flujo 
    WHERE flujo_trabajo_id = (
        SELECT flujo_trabajo_id FROM etapas_flujo
        JOIN siniestro_etapas ON etapas_flujo.id = siniestro_etapas.etapa_flujo_id
        WHERE siniestro_etapas.siniestro_id = 'uuid-siniestro-nuevo'
        LIMIT 1
    )
    ORDER BY orden
    LIMIT 1
);
```

### 5. **Subir Documento Principal de una Etapa**

```sql
-- Paso 1: Subir el documento principal
INSERT INTO documentos (
    siniestro_id,
    tipo_documento_id,
    nombre_archivo,
    ruta_archivo,
    tamaño_archivo,
    tipo_mime,
    usuario_subio,
    etapa_flujo_id,  -- NUEVO: Relacionar con etapa
    es_principal,    -- NUEVO: Marcar como principal
    es_adicional,    -- NUEVO: No es adicional
    descripcion,
    fecha_documento
) VALUES (
    'uuid-siniestro-nuevo',
    'uuid-tipo-informe-primera-atencion',
    'Informe_Primera_Atencion_SIN-2025-000001.pdf',
    '/uploads/documents/2025/01/sin-2025-000001/informe-primera-atencion.pdf',
    2456789,
    'application/pdf',
    'uuid-usuario-abogado',
    (SELECT id FROM etapas_flujo 
     WHERE nombre = 'Informe Primera Atención' 
     AND flujo_trabajo_id = obtener_flujo_predeterminado('uuid-empresa-dxlegal')
     LIMIT 1),
    TRUE,   -- Es el documento principal
    FALSE,  -- No es adicional
    'Informe de primera atención del siniestro',
    CURRENT_DATE
) RETURNING id;
-- Resultado: uuid-documento-principal

-- Paso 2: Completar la etapa con el documento principal
SELECT completar_etapa_siniestro(
    'uuid-siniestro-nuevo',           -- p_siniestro_id
    (SELECT id FROM etapas_flujo 
     WHERE nombre = 'Informe Primera Atención'
     AND flujo_trabajo_id = obtener_flujo_predeterminado('uuid-empresa-dxlegal')
     LIMIT 1),                         -- p_etapa_flujo_id
    'uuid-documento-principal',       -- p_documento_principal_id
    'uuid-usuario-abogado',           -- p_usuario_id
    'Primera atención completada exitosamente'  -- p_observaciones
);

-- La función automáticamente:
-- - Marca la etapa como 'completada'
-- - Establece fecha_completada
-- - Relaciona el documento principal
-- - Registra en bitácora
```

### 6. **Agregar Documentos Adicionales a una Etapa**

```sql
-- Subir documento adicional (fotos, evidencias, etc.) a una etapa
INSERT INTO documentos (
    siniestro_id,
    tipo_documento_id,
    nombre_archivo,
    ruta_archivo,
    tamaño_archivo,
    tipo_mime,
    usuario_subio,
    etapa_flujo_id,  -- Misma etapa
    es_principal,    -- FALSE: No es principal
    es_adicional,    -- TRUE: Es documento adicional
    descripcion,
    fecha_documento
) VALUES (
    'uuid-siniestro-nuevo',
    (SELECT id FROM tipos_documento WHERE nombre = 'Evidencia Fotográfica'
     AND empresa_id = 'uuid-empresa-dxlegal' LIMIT 1),
    'Fotos_danios_vehiculo.zip',
    '/uploads/documents/2025/01/sin-2025-000001/fotos-danios.zip',
    5678901,
    'application/zip',
    'uuid-usuario-abogado',
    (SELECT id FROM etapas_flujo 
     WHERE nombre = 'Informe Primera Atención'
     AND flujo_trabajo_id = obtener_flujo_predeterminado('uuid-empresa-dxlegal')
     LIMIT 1),
    FALSE,  -- No es principal
    TRUE,   -- Es adicional
    'Fotografías de daños del vehículo',
    CURRENT_DATE
);

-- Ver documentos de una etapa (principal + adicionales)
SELECT 
    d.nombre_archivo,
    d.descripcion,
    CASE 
        WHEN d.es_principal THEN 'Principal'
        WHEN d.es_adicional THEN 'Adicional'
        ELSE 'Sin clasificar'
    END as tipo_documento,
    up.nombre || ' ' || up.apellido_paterno as subido_por,
    d.creado_en
FROM documentos d
JOIN usuarios u ON d.usuario_subio = u.id
JOIN usuario_perfiles up ON u.id = up.usuario_id
WHERE d.siniestro_id = 'uuid-siniestro-nuevo'
AND d.etapa_flujo_id = (
    SELECT id FROM etapas_flujo 
    WHERE nombre = 'Informe Primera Atención'
    AND flujo_trabajo_id = obtener_flujo_predeterminado('uuid-empresa-dxlegal')
    LIMIT 1
)
AND d.eliminado = FALSE
ORDER BY d.es_principal DESC, d.creado_en DESC;
```

### 7. **Avanzar a la Siguiente Etapa**

```sql
-- Avanzar automáticamente a la siguiente etapa después de completar la actual
SELECT avanzar_etapa_siniestro(
    'uuid-siniestro-nuevo',           -- p_siniestro_id
    (SELECT id FROM etapas_flujo 
     WHERE nombre = 'Informe Primera Atención'
     AND flujo_trabajo_id = obtener_flujo_predeterminado('uuid-empresa-dxlegal')
     LIMIT 1),                         -- p_etapa_actual_id
    'uuid-usuario-abogado'            -- p_usuario_id
);
-- Retorna el UUID de la siguiente etapa o NULL si no hay más

-- La función automáticamente:
-- - Valida que la etapa actual esté completada
-- - Verifica documento principal si inhabilita_siguiente = TRUE
-- - Activa la siguiente etapa (estado = 'en_proceso')
-- - Registra en bitácora
```

### 8. **Ver Estado Completo del Flujo de un Siniestro**

```sql
-- Usar vista predefinida
SELECT 
    numero_siniestro,
    flujo_nombre,
    etapa_nombre,
    etapa_orden,
    etapa_estado,
    fecha_inicio,
    fecha_completada,
    tipo_documento_principal,
    etapa_completada,
    es_obligatoria,
    inhabilita_siguiente
FROM vista_flujo_siniestro
WHERE siniestro_id = 'uuid-siniestro-nuevo'
ORDER BY etapa_orden;

-- Consulta manual más detallada
SELECT 
    ef.nombre as etapa,
    ef.orden,
    se.estado,
    se.fecha_inicio,
    se.fecha_completada,
    se.fecha_vencimiento,
    td.nombre as documento_requerido,
    CASE 
        WHEN d.id IS NOT NULL THEN d.nombre_archivo
        ELSE 'Pendiente'
    END as documento_subido,
    COUNT(d_adicionales.id) as documentos_adicionales,
    se.observaciones,
    up_completo.nombre || ' ' || up_completo.apellido_paterno as completado_por
FROM siniestro_etapas se
JOIN etapas_flujo ef ON se.etapa_flujo_id = ef.id
LEFT JOIN tipos_documento td ON ef.tipo_documento_principal_id = td.id
LEFT JOIN documentos d ON se.documento_principal_id = d.id
LEFT JOIN documentos d_adicionales ON d_adicionales.etapa_flujo_id = ef.id
    AND d_adicionales.siniestro_id = se.siniestro_id
    AND d_adicionales.es_adicional = TRUE
    AND d_adicionales.eliminado = FALSE
LEFT JOIN usuarios u_completo ON se.completado_por = u_completo.id
LEFT JOIN usuario_perfiles up_completo ON u_completo.id = up_completo.usuario_id
WHERE se.siniestro_id = 'uuid-siniestro-nuevo'
GROUP BY ef.id, ef.nombre, ef.orden, se.id, se.estado, se.fecha_inicio, 
         se.fecha_completada, se.fecha_vencimiento, td.nombre, d.id, 
         d.nombre_archivo, se.observaciones, up_completo.nombre, up_completo.apellido_paterno
ORDER BY ef.orden;
```

### 9. **Validar Avance (Bloquear si Falta Documento)**

```sql
-- Verificar si se puede avanzar a la siguiente etapa
SELECT 
    ef.nombre as etapa_actual,
    se.estado,
    se.documento_principal_id,
    CASE 
        WHEN se.estado = 'completada' THEN 'Puede avanzar'
        WHEN se.estado = 'en_proceso' AND se.documento_principal_id IS NULL 
             AND ef.inhabilita_siguiente = TRUE THEN 'Bloqueado: Falta documento principal'
        WHEN se.estado = 'en_proceso' THEN 'En proceso, puede completar'
        ELSE 'Pendiente'
    END as estado_avance,
    ef.inhabilita_siguiente
FROM siniestro_etapas se
JOIN etapas_flujo ef ON se.etapa_flujo_id = ef.id
WHERE se.siniestro_id = 'uuid-siniestro-nuevo'
AND ef.orden = (
    SELECT MAX(orden) FROM etapas_flujo
    JOIN siniestro_etapas ON etapas_flujo.id = siniestro_etapas.etapa_flujo_id
    WHERE siniestro_etapas.siniestro_id = 'uuid-siniestro-nuevo'
    AND siniestro_etapas.estado IN ('en_proceso', 'completada')
);
```

### 10. **Omitir una Etapa (Si Está Permitido)**

```sql
-- Marcar etapa como omitida (solo si permite_omision = TRUE)
UPDATE siniestro_etapas
SET estado = 'omitida',
    observaciones = 'Etapa omitida por: [razón]',
    actualizado_en = NOW()
WHERE siniestro_id = 'uuid-siniestro-nuevo'
AND etapa_flujo_id = (
    SELECT id FROM etapas_flujo 
    WHERE nombre = 'Informe Actualización'
    AND flujo_trabajo_id = obtener_flujo_predeterminado('uuid-empresa-dxlegal')
    LIMIT 1
)
AND (SELECT permite_omision FROM etapas_flujo WHERE id = etapa_flujo_id) = TRUE;

-- Registrar en bitácora
INSERT INTO bitacora_actividades (
    siniestro_id,
    usuario_id,
    tipo_actividad,
    descripcion,
    fecha_actividad
) VALUES (
    'uuid-siniestro-nuevo',
    'uuid-usuario-abogado',
    'otro',
    'Etapa omitida: Informe Actualización',
    NOW()
);
```

---

## 📊 Consultas Útiles

### **Dashboard - Siniestros por Estado de Etapa**

```sql
-- Siniestros agrupados por etapa actual
SELECT 
    ef.nombre as etapa_actual,
    se.estado,
    COUNT(*) as cantidad_siniestros,
    COUNT(CASE WHEN se.fecha_vencimiento < NOW() THEN 1 END) as vencidos
FROM siniestro_etapas se
JOIN etapas_flujo ef ON se.etapa_flujo_id = ef.id
JOIN siniestros s ON se.siniestro_id = s.id
WHERE s.empresa_id = 'uuid-empresa-dxlegal'
AND s.activo = TRUE
AND s.eliminado = FALSE
AND se.estado IN ('en_proceso', 'pendiente')
GROUP BY ef.nombre, se.estado
ORDER BY ef.orden, se.estado;
```

### **Etapas Bloqueadas (Falta Documento Principal)**

```sql
-- Siniestros que no pueden avanzar porque falta documento principal
SELECT 
    s.numero_siniestro,
    ef.nombre as etapa_bloqueada,
    ef.orden,
    td.nombre as documento_faltante,
    se.fecha_inicio,
    EXTRACT(DAY FROM (NOW() - se.fecha_inicio)) as dias_bloqueado
FROM siniestro_etapas se
JOIN etapas_flujo ef ON se.etapa_flujo_id = ef.id
JOIN siniestros s ON se.siniestro_id = s.id
LEFT JOIN tipos_documento td ON ef.tipo_documento_principal_id = td.id
WHERE s.empresa_id = 'uuid-empresa-dxlegal'
AND s.activo = TRUE
AND s.eliminado = FALSE
AND se.estado = 'en_proceso'
AND se.documento_principal_id IS NULL
AND ef.inhabilita_siguiente = TRUE
ORDER BY dias_bloqueado DESC;
```

### **Tiempo Promedio por Etapa**

```sql
-- Calcular tiempo promedio de cada etapa
SELECT 
    ef.nombre as etapa,
    ef.orden,
    COUNT(*) as cantidad_completadas,
    AVG(EXTRACT(EPOCH FROM (se.fecha_completada - se.fecha_inicio))/86400) as dias_promedio,
    MIN(EXTRACT(EPOCH FROM (se.fecha_completada - se.fecha_inicio))/86400) as dias_minimo,
    MAX(EXTRACT(EPOCH FROM (se.fecha_completada - se.fecha_inicio))/86400) as dias_maximo
FROM siniestro_etapas se
JOIN etapas_flujo ef ON se.etapa_flujo_id = ef.id
JOIN siniestros s ON se.siniestro_id = s.id
WHERE s.empresa_id = 'uuid-empresa-dxlegal'
AND se.estado = 'completada'
AND se.fecha_completada IS NOT NULL
GROUP BY ef.id, ef.nombre, ef.orden
ORDER BY ef.orden;
```

---

## 🔧 Configuración y Mantenimiento

### **Cambiar Flujo Predeterminado de una Empresa**

```sql
-- Desactivar flujo actual predeterminado
UPDATE flujos_trabajo
SET es_predeterminado = FALSE,
    actualizado_en = NOW()
WHERE empresa_id = 'uuid-empresa-dxlegal'
AND es_predeterminado = TRUE;

-- Activar nuevo flujo predeterminado
UPDATE flujos_trabajo
SET es_predeterminado = TRUE,
    actualizado_en = NOW()
WHERE id = 'uuid-nuevo-flujo'
AND empresa_id = 'uuid-empresa-dxlegal';
```

### **Reordenar Etapas de un Flujo**

```sql
-- Cambiar orden de etapas
UPDATE etapas_flujo
SET orden = 2,
    actualizado_en = NOW()
WHERE id = 'uuid-etapa-2';

UPDATE etapas_flujo
SET orden = 3,
    actualizado_en = NOW()
WHERE id = 'uuid-etapa-3';
```

### **Agregar Nueva Etapa a un Flujo Existente**

```sql
-- Insertar nueva etapa en medio del flujo
-- Primero, aumentar orden de etapas posteriores
UPDATE etapas_flujo
SET orden = orden + 1,
    actualizado_en = NOW()
WHERE flujo_trabajo_id = 'uuid-flujo-dxlegal'
AND orden >= 3;  -- Después de la etapa 2

-- Luego insertar nueva etapa
INSERT INTO etapas_flujo (
    flujo_trabajo_id,
    nombre,
    descripcion,
    orden,
    es_obligatoria,
    tipo_documento_principal_id,
    inhabilita_siguiente,
    activo
) VALUES (
    'uuid-flujo-dxlegal',
    'Evaluación Médica',
    'Evaluación médica del asegurado',
    3,  -- Nueva posición
    FALSE,  -- Opcional
    NULL,  -- Sin documento principal requerido
    FALSE,  -- No bloquea
    TRUE
);
```

---

## 📝 Notas Importantes

1. **Asignación Manual**: Los siniestros se asignan manualmente, NO automáticamente
2. **Inicialización Automática**: Al crear un siniestro, se inicializan las etapas automáticamente
3. **Documento Principal**: Cada etapa puede requerir un documento principal obligatorio
4. **Documentos Adicionales**: Se pueden agregar múltiples documentos adicionales por etapa
5. **Control de Avance**: Si `inhabilita_siguiente = TRUE`, no se puede avanzar sin completar
6. **Multiempresa**: Cada empresa tiene sus propios flujos independientes
7. **RLS**: Las políticas de seguridad filtran automáticamente por empresa

---

## 🚀 Próximos Pasos Sugeridos

1. **API REST**: Endpoints para gestión de flujos y etapas
2. **UI Visual**: Editor visual de flujos de trabajo
3. **Plantillas**: Sistema de plantillas de documentos por etapa
4. **Notificaciones**: Alertas automáticas por etapas próximas a vencer
5. **Reportes**: Análisis de eficiencia por etapa y flujo

