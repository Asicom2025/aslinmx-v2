# Análisis y Ejemplos de Uso - Sistema de Gestión Legal de Siniestros

## 📋 Estructura General

El sistema está diseñado para gestionar siniestros legales con:
- **Gestión multi-área**: Un siniestro puede involucrar múltiples áreas organizacionales
- **Control de roles y permisos**: Sistema de niveles de acceso
- **Bitácora completa**: Registro de todas las actividades
- **Auditoría automática**: Trazabilidad de cambios
- **Estados configurables**: Estados personalizables por organización

---

## 🔄 Flujos Principales de Trabajo

### 1. **Flujo de Creación de Siniestro**

```sql
-- Paso 1: Generar número de siniestro automáticamente
CALL GenerarNumeroSiniestro(@numero_siniestro);
SELECT @numero_siniestro; -- Ejemplo: SIN-2025-000001

-- Paso 2: Crear el siniestro
INSERT INTO siniestros (
    numero_siniestro,
    fecha_siniestro,
    ubicacion,
    descripcion_hechos,
    nombre_asegurado,
    telefono_asegurado,
    email_asegurado,
    nombre_proveniente,
    numero_poliza,
    suma_asegurada,
    deducible,
    area_principal_id,
    estado_id,
    prioridad
) VALUES (
    @numero_siniestro,
    '2025-01-15 10:30:00',
    'Av. Reforma CJH-256, Delegación Cuauhtémoc, CDMX',
    'Colisión trasera en semáforo. El asegurado fue impactado por vehículo particular.',
    'Juan Pérez García',
    '5551234567',
    'juan.perez@email.com',
    'María González López',
    'POL-2024-12345',
    500000.00,
    5000.00,
    3, -- Área: Siniestros
    1, -- Estado: Vigente
    'media'
);

-- El trigger automáticamente registra en auditoría
```

### 2. **Flujo de Asignación Automática**

```sql
-- Asignar siniestro automáticamente al área con menor carga
CALL AsignarSiniestroAutomatico(1, 3); -- siniestro_id=1, area_id=3

-- Verificar asignación
SELECT 
    s.numero_siniestro,
    u.nombre as abogado_asignado,
    a.nombre as area
FROM siniestros s
JOIN usuarios u ON s.usuario_asignado = u.id
JOIN areas a ON s.area_principal_id = a.id
WHERE s.id = 1;
```

### 3. **Flujo de Multi-área (Siniestro Complejo)**

```sql
-- Un siniestro que requiere atención de múltiples áreas
-- Ejemplo: Accidente con lesiones (Siniestros + Penal)

-- Paso 1: Siniestro principal asignado a área "Siniestros"
-- (ya creado en ejemplo anterior)

-- Paso 2: Asignar área adicional "Penal"
INSERT INTO siniestro_areas (
    siniestro_id,
    area_id,
    usuario_responsable,
    observaciones
) VALUES (
    1, -- ID del siniestro
    2, -- Área: Penal
    NULL, -- Se asignará después
    'Caso requiere investigación penal por lesiones'
);

-- Paso 3: Asignar abogado de área Penal
UPDATE siniestro_areas
SET usuario_responsable = 5, -- ID del abogado penal
    fecha_asignacion = NOW()
WHERE siniestro_id = 1 AND area_id = 2;
```

### 4. **Flujo de Registro de Actividades (Bitácora)**

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
    1,
    3, -- Usuario que realiza la actividad
    'llamada',
    'Llamada al asegurado para solicitar documentación médica',
    0.25, -- 15 minutos
    NOW(),
    'Cliente confirmó envío de documentos por correo'
);

-- Registro de inspección
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
    1,
    3,
    'inspeccion',
    'Inspección física del vehículo siniestrado',
    2.50, -- 2.5 horas
    NOW(),
    '/uploads/inspections/sin-2025-000001-reporte.pdf',
    'Vehículo con daños moderados en parte trasera'
);
```

### 5. **Flujo de Gestión de Documentos**

```sql
-- Subir documento de informe preliminar
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
    1,
    2, -- Tipo: Informe Preliminar
    'Informe_Preliminar_SIN-2025-000001.pdf',
    '/uploads/documents/2025/01/sin-2025-000001/informe-preliminar.pdf',
    2456789, -- Bytes
    'application/pdf',
    3, -- Usuario que subió
    'Análisis técnico-legal inicial del siniestro',
    '2025-01-16'
);

-- Registrar actividad en bitácora
INSERT INTO bitacora_actividades (
    siniestro_id,
    usuario_id,
    tipo_actividad,
    descripcion,
    fecha_actividad,
    documento_adjunto
) VALUES (
    1,
    3,
    'documento',
    'Informe Preliminar generado y cargado al sistema',
    NOW(),
    '/uploads/documents/2025/01/sin-2025-000001/informe-preliminar.pdf'
);
```

### 6. **Flujo de Cambio de Estado**

```sql
-- Cambiar estado a "Proceso de Cancelación"
UPDATE siniestros
SET estado_id = 3, -- Proceso de Cancelación
    observaciones = CONCAT(
        COALESCE(observaciones, ''), 
        '\n--- Actualización 2025-01-20 ---\n',
        'Siniestro en proceso de cancelación. Cliente aceptó indemnización.'
    ),
    updated_at = NOW()
WHERE id = 1;

-- El trigger automáticamente registra en auditoría
-- Ver historial de cambios
SELECT * FROM auditoria 
WHERE tabla_afectada = 'siniestros' 
AND registro_id = 1
ORDER BY created_at DESC;
```

### 7. **Flujo de Cancelación de Siniestro**

```sql
-- Generar documento de cancelación
INSERT INTO documentos (
    siniestro_id,
    tipo_documento_id,
    nombre_archivo,
    ruta_archivo,
    usuario_subio,
    descripcion,
    fecha_documento
) VALUES (
    1,
    4, -- Tipo: Informe Cancelación
    'Informe_Cancelacion_SIN-2025-000001.pdf',
    '/uploads/documents/2025/01/sin-2025-000001/informe-cancelacion.pdf',
    3,
    'Documento final de cancelación del siniestro',
    CURDATE()
);

-- Cambiar estado final
UPDATE siniestros
SET estado_id = 2, -- Cancelado
    observaciones = CONCAT(
        observaciones,
        '\n--- CANCELADO ---\n',
        'Fecha cancelación: ', NOW(),
        '\nMotivo: Indemnización pagada y aceptada por asegurado'
    ),
    updated_at = NOW()
WHERE id = 1;

-- Registrar en bitácora
INSERT INTO bitacora_actividades (
    siniestro_id,
    usuario_id,
    tipo_actividad,
    descripcion,
    fecha_actividad
) VALUES (
    1,
    3,
    'otro',
    'Siniestro cancelado. Proceso completo finalizado.',
    NOW()
);
```

---

## 📊 Consultas Útiles

### **Dashboard - Vista General de Siniestros**

```sql
-- Siniestros activos por área con métricas
SELECT 
    a.nombre as area,
    COUNT(s.id) as total_siniestros,
    COUNT(CASE WHEN s.prioridad = 'critica' THEN 1 END) as criticos,
    COUNT(CASE WHEN s.prioridad = 'alta' THEN 1 END) as altos,
    SUM(s.suma_asegurada) as suma_total_asegurada,
    AVG(TIMESTAMPDIFF(DAY, s.fecha_registro, NOW())) as dias_promedio
FROM areas a
LEFT JOIN siniestros s ON a.id = s.area_principal_id AND s.activo = TRUE
GROUP BY a.id, a.nombre
ORDER BY total_siniestros DESC;
```

### **Carga de Trabajo por Abogado**

```sql
-- Abogados y su carga de trabajo
SELECT 
    u.nombre,
    u.email,
    COUNT(s.id) as siniestros_asignados,
    COUNT(CASE WHEN es.nombre = 'Vigente' THEN 1 END) as vigentes,
    SUM(ba.horas_trabajadas) as horas_totales_mes
FROM usuarios u
LEFT JOIN siniestros s ON u.id = s.usuario_asignado AND s.activo = TRUE
LEFT JOIN estados_siniestro es ON s.estado_id = es.id
LEFT JOIN bitacora_actividades ba ON s.id = ba.siniestro_id 
    AND ba.fecha_actividad >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY u.id, u.nombre, u.email
HAVING COUNT(s.id) > 0
ORDER BY siniestros_asignados DESC;
```

### **Siniestros por Vencer (Plazos)**

```sql
-- Siniestros con plazos próximos a vencer
SELECT 
    s.numero_siniestro,
    s.nombre_asegurado,
    es.nombre as estado,
    es.color,
    a.nombre as area,
    u.nombre as abogado_asignado,
    TIMESTAMPDIFF(DAY, NOW(), DATE_ADD(s.fecha_registro, INTERVAL 30 DAY)) as dias_restantes
FROM siniestros s
JOIN estados_siniestro es ON s.estado_id = es.id
JOIN areas a ON s.area_principal_id = a.id
LEFT JOIN usuarios u ON s.usuario_asignado = u.id
WHERE s.activo = TRUE 
AND es.nombre = 'Vigente'
AND TIMESTAMPDIFF(DAY, NOW(), DATE_ADD(s.fecha_registro, INTERVAL  Особенно DAY)) <= 7
ORDER BY dias_restantes ASC 날짜;
```

### **Historial Completo de un Siniestro**

```sql
-- Vista completa del historial de un siniestro
SELECT 
    'Siniestro' as tipo,
    s.numero_siniestro as referencia,
    s.fecha_registro as fecha,
    CONCAT('Creado: ', s.descripcion_hechos) as descripcion,
    u.nombre as usuario
FROM siniestros s
LEFT JOIN usuarios u ON s.usuario_asignado = u.id
WHERE s.id = 1

UNION ALL

SELECT 
    'Bitácora' as tipo,
    s.numero_siniestro,
    ba.fecha_actividad,
    CONCAT(ba.tipo_actividad, ': ', ba.descripcion) as descripcion,
    u.nombre
FROM bitacora_actividades ba
JOIN siniestros s ON ba.siniestro_id = s.id
JOIN usuarios u ON ba.usuario_id = u.id
WHERE ba.siniestro_id = 1

UNION ALL

SELECT 
    'Documento' as tipo,
    s.numero_siniestro,
    d.created_at,
    CONCAT('Documento: ', d.nombre_archivo) as descripcion,
    u.nombre
FROM documentos d
JOIN siniestros s ON d.siniestro_id = s.id
JOIN usuarios u ON d.usuario_subio = u.id
WHERE d.siniestro_id = 1

ORDER BY fecha DESC;
```

### **Métricas de Productividad por Área**

```sql
-- Usar vista predefinida
SELECT * FROM vista_metricas_area
ORDER BY total_siniestros DESC;
```

---

## 🎯 Casos de Uso Específicos

### **Caso 1: Siniestro Simple (Solo Daños Materiales)**

```sql
-- 1. Crear siniestro básico
CALL GenerarNumeroSiniestro(@num);
INSERT INTO siniestros (...) VALUES (...);

-- 2. Asignar automáticamente
CALL AsignarSiniestroAutomatico(LAST_INSERT_ID(), 3);

-- 3. Registrar evaluación inicial
INSERT INTO bitacora_actividades (...) VALUES (...);

-- 4. Subir fotos de daños
INSERT esos evidencias_fotograficas (...) VALUES (...);

-- 5. Generar informe y cancelar
```

### **Caso 2: Siniestro Complejo (Múltiples Áreas)**

```sql
-- Siniestro que requiere:
-- - Evaluación técnica (Área Siniestros)
-- - Investigación penal (Área Penal)
-- - Coordinación administrativa (Área Administración)

-- 1. Crear siniestro
-- 2. Asignar a área principal (Siniestros)
-- 3. Agregar áreas adicionales
INSERT INTO siniestro_areas (...) VALUES (...);
INSERT INTO siniestro_areas (...) VALUES (...);

-- 4. Asignar responsables por área
-- 5. Seguimiento coordinado
```

### **Caso 3: Gestión de Instituciones**

```sql
-- Registrar nueva institución médica
INSERT INTO instituciones (
    nombre,
    tipo_institucion_id,
    codigo,
    direccion,
    telefono,
    email,
    contacto_principal,
    convenio_vigente,
    tarifas_preferenciales
) VALUES (
    'Hospital General de la Ciudad de México',
    2, -- Instituciones Médicas
    'HOS-CDMX-001',
    'Av. Doctor Balmis 148, Doctores, CDMX',
    '5557890123',
    'contacto@hospitalcdmx.gob.mx',
    'Dr. Carlos Ramírez',
    TRUE,
    15.00 -- 15% de descuento
);

-- Asignar al siniestro
UPDATE siniestros
SET institucion_id = LAST_INSERT_ID()
WHERE id = 1;
```

### **Caso 4: Sistema de Notificaciones**

```sql
-- Crear notificación de plazo vencido
INSERT INTO notificaciones (
    usuario_id,
    siniestro_id,
    tipo,
    titulo,
    mensaje,
    fecha_vencimiento
) VALUES (
    3, -- Abogado asignado
    1, -- Siniestro
    'plazo_vencido',
    'Plazo por vencer - SIN-2025-000001',
    'El siniestro SIN-2025-000001 tiene un plazo próximo a vencer. Requiere atención inmediata.',
    DATE_ADD(NOW(), INTERVAL 3 DAY)
);

-- Notificación de cambio de estado
INSERT INTO notificaciones (
    usuario_id,
    siniestro_id,
    tipo,
    titulo,
    mensaje
) VALUES (
    3,
    1,
    'cambio_estado',
    'Cambio de estado - SIN-2025-000001',
    'El estado del siniestro ha cambiado a "Proceso de Cancelación"'
);
```

---

## 🔍 Consultas Avanzadas

### **Análisis de Tiempos de Resolución**

```sql
SELECT 
    a.nombre as area,
    AVG(TIMESTAMPDIFF(DAY, s.fecha_registro, 
        (SELECT MIN(updated_at) 
         FROM siniestros s2 
         WHERE s2.estado_id = 2 AND s2.id = s.id)
    )) as dias_promedio_resolucion
FROM siniestros s
JOIN areas a ON s.area_principal_id = a.id
JOIN estados_siniestro es ON s.estado_id = es.id
WHERE es.nombre = 'Cancelado'
GROUP BY a.id, a.nombre;
```

### **Documentos Faltantes por Siniestro**

```sql
-- Verificar qué tipos de documentos faltan para un siniestro
SELECT 
    td.nombre as tipo_documento_requerido,
    td.area_id,
    CASE 
        WHEN d.id IS NULL THEN 'FALTANTE'
        ELSE 'COMPLETO'
    END as estado
FROM tipos_documento td
LEFT JOIN documentos d ON td.id = d.tipo_documento_id AND d.siniestro_id = 1
WHERE td.activo = TRUE
ORDER BY estado, td.nombre;
```

---

## 📝 Notas Importantes

1. **Auditoría Automática**: Todos los cambios en `siniestros` se registran automáticamente en `auditoria`
2. **Números de Siniestro**: Se generan automáticamente con formato `SIN-YYYY-NNNNNN`
3. **Soft Delete**: Los registros usan `activo = FALSE` en lugar de DELETE
4. **Multi-área**: Un siniestro puede tener múltiples áreas asignadas simultáneamente
5. **Roles por Área**: Los usuarios pueden tener diferentes roles en diferentes áreas

---

## 🚀 Próximos Pasos Sugeridos

1. **API REST**: Crear endpoints para estos flujos
2. **Dashboard**: Interfaz para visualizar métricas
3. **Notificaciones en tiempo real**: Integrar WebSockets
4. **Reportes automáticos**: Generación de informes programados
5. **Integración de documentos**: OCR y procesamiento automático

