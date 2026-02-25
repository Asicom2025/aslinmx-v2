# Análisis y Ejemplos de Uso - Extensión Legal para Sistema Multiempresa

## 📋 Estructura General

Esta extensión agrega funcionalidades específicas de gestión legal de siniestros a la estructura base multiempresa:

### Características Principales:
- **Multiempresa**: Todas las tablas están vinculadas a `empresa_id`
- **Row Level Security (RLS)**: Seguridad a nivel de fila por empresa
- **UUIDs**: Identificadores universales en lugar de INT
- **Normalización mejorada**: Tabla `siniestro_usuarios` para relaciones normalizadas
- **PostgreSQL**: Funciones PL/pgSQL nativas
- **Soft Delete**: Campos `eliminado` y `eliminado_en` en lugar de DELETE físico

---

## 🔄 Flujos Principales de Trabajo

### 1. **Flujo de Creación de Siniestro (Multiempresa)**

```sql
-- Paso 1: Establecer contexto de empresa (vía RLS o variable)
SET app.current_empresa = 'uuid-de-la-empresa';

-- Paso 2: Generar número de siniestro automáticamente
SELECT generar_numero_siniestro('uuid-de-la-empresa');
-- Resultado: SIN-2025-000001

-- Paso 3: Obtener IDs necesarios (área, estado)
SELECT id INTO v_area_id FROM areas 
WHERE empresa_id = 'uuid-de-la-empresa' AND codigo = 'SIN';

SELECT id INTO v_estado_id FROM estados_siniestro 
WHERE empresa_id = 'uuid-de-la-empresa' AND nombre = 'Vigente';

-- Paso 4: Crear el siniestro
INSERT INTO siniestros (
    empresa_id,
    numero_siniestro,
    fecha_siniestro,
    ubicacion,
    descripcion_hechos,
    numero_poliza,
    suma_asegurada,
    deducible,
    area_principal_id,
    estado_id,
    prioridad
) VALUES (
    'uuid-de-la-empresa',
    generar_numero_siniestro('uuid-de-la-empresa'),
    '2025-01-15 10:30:00',
    'Av. Reforma CJH-256, Delegación Cuauhtémoc, CDMX',
    'Colisión trasera en semáforo. El asegurado fue impactado por vehículo particular.',
    'POL-2024-12345',
    500000.00,
    5000.00,
    v_area_id,
    v_estado_id,
    'media'
) RETURNING id;
-- El trigger automáticamente registra en auditoría_siniestros
```

### 2. **Flujo de Asignación de Usuarios Normalizada**

```sql
-- IMPORTANTE: Esta estructura permite múltiples usuarios por siniestro
-- con diferentes tipos de relación (asegurado, proveniente, testigo, tercero)

-- Paso 1: Agregar asegurado principal
SELECT agregar_usuario_siniestro(
    'uuid-siniestro',          -- p_siniestro_id
    'uuid-usuario-asegurado',  -- p_usuario_id
    'asegurado',               -- p_tipo_relacion
    TRUE,                      -- p_es_principal
    'Asegurado principal del siniestro' -- p_observaciones
);
-- La función automáticamente registra en bitácora

-- Paso 2: Agregar proveniente
SELECT agregar_usuario_siniestro(
    'uuid-siniestro',
    'uuid-usuario-proveniente',
    'proveniente',
    FALSE,  -- No es principal
    'Conductor que impactó al asegurado'
);

-- Paso 3: Agregar testigo
SELECT agregar_usuario_siniestro(
    'uuid-siniestro',
    'uuid-usuario-testigo',
    'testigo',
    FALSE,
    'Testigo presencial del accidente'
);

-- Paso 4: Verificar usuarios del siniestro
SELECT 
    u.correo,
    up.nombre || ' ' || up.apellido_paterno as nombre_completo,
    su.tipo_relacion,
    su.es_principal,
    su.observaciones
FROM siniestro_usuarios su
JOIN usuarios u ON su.usuario_id = u.id
JOIN usuario_perfiles up ON u.id = up.usuario_id
WHERE su.siniestro_id = 'uuid-siniestro'
AND su.activo = TRUE;
```

### 3. **Flujo de Obtener Asegurado Principal**

```sql
-- Usar función predefinida para obtener información completa幸福
SELECT * FROM obtener_asegurado_principal('uuid-siniestro');

-- Resultado:
-- usuario_id | nombre_completo      | email              | telefono
-- -----------|---------------------|-------------------|----------
-- uuid-123   | Juan Pérez García   | juan@email.com    | 5551234
```

### 4. **Flujo de Asignación Automática con Función**

```sql
-- Obtener área para asignación
SELECT id INTO v_area_id FROM areas 
WHERE empresa_id = 'uuid-de-la-empresa' AND codigo = 'SIN';

-- Asignar automáticamente al abogado con menor carga
SELECT asignar_siniestro_automatico(
    'uuid-siniestro',  -- ID del siniestro recién creado
    v_area_id          -- Área objetivo
);
-- Retorna el UUID del usuario asignado
-- Automáticamente registra en bitácora
```

### 5. **Flujo Multi-área (Siniestro Complejo)**

```sql
-- Un siniestro que requiere atención de múltiples áreas
-- Ejemplo: Accidente con lesiones (Siniestros + Penal)

-- Paso 1: Siniestro principal ya creado con área "Siniestros"

-- Paso 2: Obtener IDs de áreas adicionales
SELECT id INTO v_area_penal FROM areas 
WHERE empresa_id = 'uuid-de-la-empresa' AND codigo = 'PEN';

SELECT id INTO v_area_admin FROM areas 
WHERE empresa_id = 'uuid-de-la-empresa' AND codigo = 'ADM';

-- Paso 3: Asignar áreas adicionales
INSERT INTO siniestro_areas (
    siniestro_id,
    area_id,
    usuario_responsable,
    observaciones
) VALUES (
    'uuid-siniestro',
    v_area_penal,
    NULL,  -- Se asignará después
    'Caso requiere investigación penal por lesiones'
),
(
    'uuid-siniestro',
    v_area_admin,
    NULL,
    'Coordinación administrativa para gestión de pagos'
);

-- Paso 4: Asignar responsables por área
UPDATE siniestro_areas
SET usuario_responsable = 'uuid-abogado-penal',
    fecha_asignacion = NOW()
WHERE siniestro_id = 'uuid-siniestro' 
AND area_id = v_area_penal;

-- Paso 5: Ver todas las áreas asignadas
SELECT 
    a.nombre as area,
    a.codigo,
    up.nombre || ' ' || up.apellido_paterno as responsable,
    sa.fecha_asignacion,
    sa.observaciones
FROM siniestro_areas sa
JOIN areas a ON sa.area_id = a.id
LEFT JOIN usuarios u ON sa.usuario_responsable = u.id
LEFT JOIN usuario_perfiles up ON u.id = up.usuario_id
WHERE sa.siniestro_id = 'uuid-siniestro'
AND sa.activo = TRUE;
```

### 6. **Flujo de Registro de Actividades (Bitácora)**

```sql
-- Registro de llamada telefónica
INSERT INTO bitacora_actividades (
    siniestro_id,
    usuario_id,
    tipo_actividad,
    descripcion,
    horas_trabajadas,
    fecha_actividad,
    comentarios
) VALUES (
    'uuid-siniestro',
    'uuid-usuario-abogado',
    'llamada',
    'Llamada al asegurado para solicitar documentación médica',
    0.25,  -- 15 minutos
    NOW(),
    'Cliente confirmó envío de documentos por correo'
);

-- Registro de inspección con documento adjunto
INSERT INTO bitacora_actividades (
    siniestro_id,
    usuario_id,
    tipo_actividad,
    descripcion,
    horas_trabajadas,
    fecha_actividad,
    documento_adjunto,
    comentarios
) VALUES (
    'uuid-siniestro',
    'uuid-usuario-abogado',
    'inspeccion',
    'Inspección física del vehículo siniestrado',
    2.50,  -- 2.5 horas
    NOW(),
    '/uploads/inspections/sin-2025-000001-reporte.pdf',
    'Vehículo con daños moderados en parte trasera'
);

-- Ver historial completo de actividades
SELECT 
    ba.fecha_actividad,
    ba.tipo_actividad,
    ba.descripcion,
    ba.horas_trabajadas,
    up.nombre || ' ' || up.apellido_paterno as usuario,
    ba.documento_adjunto,
    ba.comentarios
FROM bitacora_actividades ba
JOIN usuarios u ON ba.usuario_id = u.id
JOIN usuario_perfiles up ON u.id = up.usuario_id
WHERE ba.siniestro_id = 'uuid-siniestro'
ORDER BY ba.fecha_actividad DESC;
```

### 7. **Flujo de Gestión de Documentos con Versionado**

```sql
-- Subir documento de informe preliminar (versión 1)
INSERT INTO documentos (
    siniestro_id,
    tipo_documento_id,
    nombre_archivo,
    ruta_archivo,
    tamaño_archivo,
    tipo_mime,
    usuario_subio,
    descripcion,
    fecha_documento
) VALUES (
    'uuid-siniestro',
    'uuid-tipo-informe-preliminar',
    'Informe_Preliminar_SIN-2025-000001_v1.pdf',
    '/uploads/documents/2025/01/sin-2025-000001/informe-preliminar-v1.pdf',
    2456789,  -- Bytes
    'application/pdf',
    'uuid-usuario-abogado',
    'Análisis técnico-legal inicial del siniestro',
    CURRENT_DATE
) RETURNING id, version;

-- Actualizar documento (nueva versión)
-- Primero marcar versión anterior como eliminada (soft delete)
UPDATE documentos
SET eliminado = TRUE,
    eliminado_en = NOW()
WHERE siniestro_id = 'uuid-siniestro'
AND tipo_documento_id = 'uuid-tipo-informe-preliminar'
AND activo = TRUE
AND eliminado = FALSE;

-- Insertar nueva versión
INSERT INTO documentos (
    siniestro_id,
    tipo_documento_id,
    nombre_archivo,
    ruta_archivo,
    tamaño_archivo,
    tipo_mime,
    usuario_subio,
    version,
    descripcion,
    fecha_documento
) 
SELECT 
    siniestro_id,
    tipo_documento_id,
    REPLACE(nombre_archivo, '_v1', '_v2'),
    REPLACE(ruta_archivo, 'v1', 'v2'),
    tamaño_archivo,
    tipo_mime,
    'uuid-usuario-abogado',
    (SELECT COALESCE(MAX(version), 0) + 1 
     FROM documentos 
     WHERE siniestro_id = 'uuid-siniestro' 
     AND tipo_documento_id = 'uuid-tipo-informe-preliminar'),
    descripcion || ' - Versión actualizada',
    CURRENT_DATE
FROM documentos
WHERE id = 'uuid-documento-anterior';

-- Ver todas las versiones de un documento
SELECT 
    version,
    nombre_archivo,
    ruta_archivo,
    fecha_documento,
    up.nombre || ' ' || up.apellido_paterno as subido_por,
    CASE 
        WHEN eliminado = TRUE THEN 'Eliminado'
        WHEN activo = FALSE THEN 'Inactivo'
        ELSE 'Activo'
    END as estado
FROM documentos d
JOIN usuarios u ON d.usuario_subio = u.id
JOIN usuario_perfiles up ON u.id = up.usuario_id
WHERE d.siniestro_id = 'uuid-siniestro'
AND d.tipo_documento_id = 'uuid-tipo-informe-preliminar'
ORDER BY d.version DESC;
```

### 8. **Flujo de Evidencias Fotográficas con Geolocalización**

```sql
-- Subir evidencia fotográfica con coordenadas GPS
INSERT INTO evidencias_fotograficas (
    siniestro_id,
    nombre_archivo,
    ruta_archivo,
    tamaño_archivo,
    tipo_mime,
    latitud,
    longitud,
    fecha_toma,
    usuario_subio,
    descripcion
) VALUES (
    'uuid-siniestro',
    'IMG_20250115_103045.jpg',
    '/uploads/evidences/2025/01/sin-2025-000001/frontal-accidente.jpg',
    3456789,
    'image/jpeg',
    19.432608,  -- Latitud CDMX
    -99.133209, -- Longitud CDMX
    '2025-01-15 10:30:45',
    'uuid-usuario-abogado',
    'Foto frontal del vehículo siniestrado'
);

-- Buscar evidencias por ubicación (radio de búsqueda)
SELECT 
    ef.nombre_archivo,
    ef.descripcion,
    ef.latitud,
    ef.longitud,
    ef.fecha_toma,
    -- Calcular distancia (simplificado, usar PostGIS para precisión)
    (
        6371 * acos(
            cos(radians(19.432608)) * 
            cos(radians(ef.latitud)) * 
            cos(radians(ef.longitud) - radians(-99.133209)) + 
            sin(radians(19.432608)) * 
            sin(radians(ef.latitud))
        )
    ) as distancia_km
FROM evidencias_fotograficas ef
WHERE ef.siniestro_id = 'uuid-siniestro'
AND ef.activo = TRUE
AND ef.eliminado = FALSE
ORDER BY ef.fecha_toma;
```

### 9. **Flujo de Cambio de Estado con Auditoría**

```sql
-- Cambiar estado a "Proceso de Cancelación"
UPDATE siniestros
SET estado_id = (
    SELECT id FROM estados_siniestro 
    WHERE empresa_id = 'uuid-de-la-empresa' 
    AND nombre = 'Proceso de Cancelación'
),
observaciones = COALESCE(observaciones, '') || E'\n--- Actualización ' || 
    TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') || E' ---\n' ||
    'Siniestro en proceso de cancelación. Cliente aceptó indemnización.',
actualizado_en = NOW()
WHERE id = 'uuid-siniestro'
RETURNING *;

-- El trigger automáticamente registra en auditoria_siniestros
-- Ver historial de cambios
SELECT 
    accion,
    datos_anteriores->>'estado_id' as estado_anterior,
    datos_nuevos->>'estado_id' as estado_nuevo,
    creado_en,
    up.nombre || ' ' || up.apellido_paterno as usuario
FROM auditoria_siniestros aud
LEFT JOIN usuarios u ON aud.usuario_id = u.id
LEFT JOIN usuario_perfiles up ON u.id = up.usuario_id
WHERE aud.tabla_afectada = 'siniestros'
AND aud.registro_id = 'uuid-siniestro'
ORDER BY aud.creado_en DESC;
```

### 10. **Flujo de Notificaciones Multi-usuario**

```sql
-- Crear notificación para el abogado asignado
INSERT INTO九 notificaciones (
    usuario_id,
    siniestro_id,
    tipo,
    titulo,
    mensaje,
    fecha_vencimiento
) VALUES (
    'uuid-abogado-asignado',
    'uuid-siniestro',
    'plazo_vencido',
    'Plazo por vencer - SIN-2025-000001',
    'El siniestro SIN-2025-000001 tiene un plazo próximo a vencer. Requiere atención inmediata.',
    NOW() + INTERVAL '3 days'
);

-- Crear notificación para el asegurado (si tiene cuenta)
INSERT INTO notificaciones (
    usuario_id,
    siniestro_id,
    tipo,
    titulo,
    mensaje
)
SELECT 
    su.usuario_id,
    'uuid-siniestro',
    'cambio_estado',
    'Actualización de estado - SIN-2025-000001',
    'El estado de su siniestro ha cambiado a "Proceso de Cancelación"'
FROM siniestro_usuarios su
WHERE su.siniestro_id = 'uuid-siniestro'
AND su.tipo_relacion = 'asegurado'
AND su.es_principal = TRUE
AND su.activo = TRUE;

-- Consultar notificaciones no leídas de un usuario
SELECT 
    n.id,
    n.tipo,
    n.titulo,
    n.mensaje,
    n.fecha_vencimiento,
    s.numero_siniestro,
    n.creado_en
FROM notificaciones n
LEFT JOIN siniestros s ON n.siniestro_id = s.id
WHERE n.usuario_idงาน = 'uuid-usuario'
AND n.leida = FALSE
ORDER BY n.creado_en DESC;

-- Marcar notificación como leída
UPDATE notificaciones
SET leida = TRUE
WHERE id = 'uuid-notificacion'
AND usuario_id = 'uuid-usuario';
```

---

## 📊 Consultas Avanzadas con Vistas Predefinidas

### **Vista Completa de Siniestros (Multiempresa)**

```sql
-- Usar vista predefinida (ya incluye información de asegurado y proveniente)
SELECT * FROM vista_siniestros_completa
WHERE empresa_id = 'uuid-de-la-empresa'
ORDER BY creado_en DESC
LIMIT 50;

-- Filtrar por estado y área
SELECT 
    numero_siniestro,
    descripcion_hechos,
    estado_nombre,
    estado_color,
    area_nombre,
    usuario_asignado_nombre,
    asegurado_nombre,
    proveniente_nombre,
    suma_asegurada
FROM vista_siniestros_completa
WHERE empresa_id = 'uuid-de-la-empresa'
AND estado_nombre = 'Vigente'
AND area_nombre = 'Siniestros'
ORDER BY prioridad DESC, creado_en DESC;
```

### **Métricas por Área**

```sql
-- Usar vista predefinida
SELECT * FROM vista_metricas_area
WHERE empresa_id = (
    SELECT empresa_id FROM areas WHERE id = area_id
) = 'uuid-de-la-empresa'
ORDER BY total_siniestros DESC;
```

### **Carga de Trabajo por Abogado (Multiempresa)**

```sql
SELECT 
    u.id,
    up.nombre || ' ' || up.apellido_paterno as abogado,
    u.correo,
    COUNT(DISTINCT s.id) as siniestros_asignados,
    COUNT(DISTINCT CASE WHEN es.nombre = 'Vigente' THEN s.id END) as vigentes,
    COUNT(DISTINCT sa.area_id) as areas_involucradas,
    COALESCE(SUM(ba.horas_trabajadas), 0) as horas_totales_mes
FROM usuarios u
JOIN usuario_perfiles up ON u.id = up.usuario_id
JOIN roles r ON u.rol_id = r.id
LEFT JOIN siniestros s ON u.id = s.usuario_asignado 
    AND s.activo = TRUE 
    AND s.eliminado = FALSE
    AND s.empresa_id = 'uuid-de-la-empresa'
LEFT JOIN estados_siniestro es ON s.estado_id = es.id
LEFT JOIN siniestro_areas sa ON s.id = sa.siniestro_id AND sa.activo = TRUE
LEFT JOIN bitacora_actividades ba ON s.id = ba.siniestro_id 
    AND ba.fecha_actividad >= NOW() - INTERVAL '30 days'
WHERE r.nombre IN ('Abogado', 'Abogado JR')
AND u.empresa_id = 'uuid-de-la-empresa'
AND u.activo = TRUE
AND u.eliminado = FALSE
GROUP BY u.id, up.nombre, up.apellido_paterno, u.correo
HAVING COUNT(DISTINCT s.id) > 0
ORDER BY siniestros_asignados DESC;
```

### **Siniestros por Vencer (con RLS)**

```sql
-- Esta consulta respeta automáticamente las políticas RLS
SELECT 
    s.numero_siniestro,
    s.descripcion_hechos,
    es.nombre as estado,
    es.color,
    a.nombre as area,
    up.nombre || ' ' || up.apellido_paterno as abogado_asignado,
    EXTRACT(DAY FROM (NOW() - s.fecha_registro)) as dias_transcurridos,
    EXTRACT(DAY FROM (s.fecha_registro + INTERVAL '30 days' - NOW())) as dias_restantes
FROM siniestros s
JOIN estados_siniestro es ON s.estado_id = es.id
JOIN areas a ON s.area_principal_id = a.id
LEFT JOIN usuarios u ON s.usuario_asignado = u.id
LEFT JOIN usuario_perfiles up ON u.id = up.usuario_id
WHERE s.activo = TRUE
AND s.eliminado = FALSE
AND es.nombre = 'Vigente'
AND s.fecha_registro + INTERVAL '30 days' <= NOW() + INTERVAL '7 days'
-- RLS automáticamente filtra por empresa
ORDER BY dias_restantes ASC;
```

### **Historial Completo de un Siniestro**

```sql
-- Vista unificada de todo el historial
SELECT 
    'Siniestro' as tipo,
    s.numero_siniestro as referencia,
    s.fecha_registro as fecha,
    'Creado: ' || s.descripcion_hechos as descripcion,
    up.nombre || ' ' || up.apellido_paterno as usuario,
    NULL::VARCHAR as detalle
FROM siniestros s
LEFT JOIN usuarios u ON s.usuario_asignado = u.id
LEFT JOIN usuario_perfiles up ON u.id = up.usuario_id
WHERE s.id = 'uuid-siniestro'

UNION ALL

SELECT 
    'Bitácora' as tipo,
    s.numero_siniestro,
    ba.fecha_actividad,
    ba.tipo_actividad || ': ' || ba.descripcion,
    up.nombre || ' ' || up.apellido_paterno,
    ba.comentarios
FROM bitacora_actividades ba
JOIN siniestros s ON ba.siniestro_id = s.id
JOIN usuarios u ON ba.usuario_id = u.id
JOIN usuario_perfiles up ON u.id = up.usuario_id
WHERE ba.siniestro_id = 'uuid-siniestro'

UNION ALL

SELECT 
    'Documento' as tipo,
    s.numero_siniestro,
    d.creado_en,
    'Documento v' || d.version || ': ' || d.nombre_archivo,
    up.nombre || ' ' || up.apellido_paterno,
    d.descripcion
FROM documentos d
JOIN siniestros s ON d.siniestro_id = s.id
JOIN usuarios u ON d.usuario_subio = u.id
JOIN usuario_perfiles up ON u.id = up.usuario_id
WHERE d.siniestro_id = 'uuid-siniestro'
AND d.eliminado = FALSE

UNION ALL

SELECT 
    'Usuario agregado' as tipo,
    s.sunero_siniestro,
    su.creado_en,
    'Usuario agregado como ' || su.tipo_relacion,
    up_usuario.nombre || ' ' || up_usuario.apellido_paterno,
    su.observaciones
FROM siniestro_usuarios su
JOIN siniestros s ON su.siniestro_id = s.id
JOIN usuarios u_usuario ON su.usuario_id = u_usuario.id
JOIN usuario_perfiles up_usuario ON u_usuario.id = up_usuario.usuario_id
WHERE su.siniestro_id = 'uuid-siniestro'
AND su.activo = TRUE

ORDER BY fecha DESC;
```

---

## 🔐 Seguridad y Row Level Security (RLS)

### **Configuración de Contexto de Empresa**

```sql
-- Establecer empresa actual para RLS
SET app.current_empresa = 'uuid-de-la-empresa';

-- Verificar contexto actual
SHOW app.current_empresa;

-- En una aplicación, esto se haría automáticamente después del login
-- Ejemplo en función de aplicación:
CREATE OR REPLACE FUNCTION establecer_empresa_contexto(p_empresa_id UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_empresa', p_empresa_id::TEXT, FALSE);
END;
$$ LANGUAGE plpgsql;
```

### **Verificar Políticas RLS**

```sql
-- Ver políticas activas en una tabla
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'siniestros';
```

---

## 🎯 Casos de Uso Específicos

### **Caso 1: Siniestro Simple con Usuario Existente**

```sql
-- Usuario ya existe en el sistema (asegurado registrado)
-- Paso 1: Crear siniestro
INSERT INTO siniestros (...) VALUES (...) RETURNING id;

-- Paso 2: Agregar usuario existente como asegurado
SELECT agregar_usuario_siniestro(
    'uuid-siniestro-nuevo',
    'uuid-usuario-asegurado-existente',
    'asegurado',
    TRUE,
    'Usuario ya registrado en el sistema'
);

-- Paso 3: Asignar automáticamente
SELECT asignar_siniestro_automatico(
    'uuid-siniestro-nuevo',
    'uuid-area-siniestros'
);
```

### **Caso 2: Siniestro con Usuario Nuevo (Proveniente)**

```sql
-- El proveniente no está registrado, hay que crearlo primero
-- Paso 1: Crear usuario nuevo
INSERT INTO usuarios (
    empresa_id,
    correo,
    password_hash,
    rol_id,
    activo
) VALUES (
    'uuid-de-la-empresa',
    'maria.gonzalez@email.com',
    'hash-contraseña',
    (SELECT id FROM roles WHERE nombre = 'Proveniente' AND empresa_id = 'uuid-de-la-empresa'),
    TRUE
) RETURNING id;

-- Paso 2: Agregar perfil
INSERT INTO usuario_perfiles (
    usuario_id,
    nombre,
    apellido_paterno,
    apellido_materno
) VALUES (
    'uuid-usuario-nuevo',
    'María',
    'González',
    'López'
);

-- Paso 3: Agregar contacto
INSERT INTO usuario_contactos (
    usuario_id,
    telefono,
    celular
) VALUES (
    'uuid-usuario-nuevo',
    '5559876543',
    '5559876543'
);

-- Paso 4: Crear siniestro
INSERT INTO siniestros (...) VALUES (...) RETURNING id;

-- Paso 5: Agregar proveniente al siniestro
SELECT agregar_usuario_siniestro(
    'uuid-siniestro',
    'uuid-usuario-nuevo',
    'proveniente',
    FALSE,
    'Conductor que causó el accidente'
);
```

### **Caso 3: Gestión Multi-área Compleja**

```sql
-- Siniestro que requiere coordinación entre múltiples áreas
-- Paso 1: Crear siniestro base
INSERT INTO siniestros (...) VALUES (...) RETURNING id;

-- Paso 2: Asignar a área principal
UPDATE siniestros
SET area_principal_id = 'uuid-area-siniestros',
    usuario_asignado = 'uuid-abogado-siniestros'
WHERE id = 'uuid-siniestro';

-- Paso 3: Agregar áreas adicionales con responsables
INSERT INTO siniestro_areas (siniestro_id, area_id, usuario_responsable, observaciones)
VALUES 
    ('uuid-siniestro', 'uuid-area-penal', 'uuid-abogado-penal', 'Investigación penal'),
    ('uuid-siniestro', 'uuid-area-admin', 'uuid-admin', 'Gestión de pagos'),
    ('uuid-siniestro', 'uuid-area-contabilidad', 'uuid-contador', 'Control financiero');

-- Paso 4: Consultar todas las áreas y responsables
SELECT 
    a.nombre as area,
    a.codigo,
    up.nombre || ' ' || up.apellido_paterno as responsable,
    sa.fecha_asignacion,
    sa.observaciones,
    COUNT(DISTINCT ba.id) as actividades_registradas
FROM siniestro_areas sa
JOIN areas a ON sa.area_id = a.id
LEFT JOIN usuarios u ON sa.usuario_responsable = u.id
LEFT JOIN usuario_perfiles up ON u.id = up.usuario_id
LEFT JOIN bitacora_actividades ba ON sa.siniestro_id = ba.siniestro_id
WHERE sa.siniestro_id = 'uuid-siniestro'
AND sa.activo = TRUE
GROUP BY a.id, a.nombre, a.codigo, up.nombre, up.apellido_paterno, sa.fecha_asignacion, sa.observaciones;
```

---

## 📝 Notas Importantes

1. **Multiempresa**: Todas las tablas requieren `empresa_id` y respetan RLS
2. **RLS**: Las políticas filtran automáticamente por empresa usando `app.current_empresa`
3. **UUIDs**: Todos los IDs son UUIDs, no INTs
4. **Soft Delete**: Usar `eliminado = TRUE` en lugar de DELETE
5. **Normalización**: Usar `siniestro_usuarios` para relaciones con usuarios
6. **Funciones**: Funciones PostgreSQL reemplazan procedimientos almacenados
7. **Vistas**: Las vistas predefinidas optimizan consultas frecuentes
8. **Auditoría**: Triggers automáticos registran todos los cambios en `auditoria_siniestros`

---

## 🚀 Integración con Sistema Base

Este script extiende `main_db.sql` agregando:
- Tablas específicas del sistema legal
- Funciones PL/pgSQL
- Vistas optimizadas
- Políticas RLS
- Triggers de auditoría
- Índices estratégicos

**Orden de ejecución:**
1. `main_db.sql` (estructura base multiempresa)
2. `aslin_legal_extension.sql` (esta extensión)

---

## 🔄 Diferencias Clave vs Script MySQL Original

| Característica | MySQL Original | PostgreSQL Extension |
|---------------|----------------|---------------------|
| IDs | INT AUTO_INCREMENT | UUID |
| Multiempresa | No | Sí (RLS) |
| Seguridad | Manual | Row Level Security |
| Procedimientos | Stored Procedures | Functions (PL/pgSQL) |
| Usuarios siniestro | Campos en tabla | Tabla normalizada |
| Soft Delete | `activo = FALSE` | `eliminado = TRUE` + `eliminado_en` |
| JSON | Campos JSON | JSONB (optimizado) |
| Vistas | Básicas | Optimizadas con JOINs |

