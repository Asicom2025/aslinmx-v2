# Configuración de Tiptap Editor

## Instalación con Docker

Las dependencias ya están agregadas en `package.json`. Para instalarlas:

```bash
# Reconstruir el contenedor del frontend para instalar Tiptap
docker-compose build frontend

# O si prefieres instalar manualmente dentro del contenedor
docker-compose exec frontend npm install
```

## ¿Qué es Tiptap?

Tiptap es un editor WYSIWYG moderno y extensible basado en ProseMirror. Es:
- ✅ **Ligero y rápido** - Sin dependencias pesadas
- ✅ **Open Source** - Completamente gratuito, sin API keys
- ✅ **Extensible** - Fácil de personalizar y extender
- ✅ **Moderno** - Basado en React y TypeScript
- ✅ **Similar a Word** - Interfaz familiar y potente

## Características del Editor

- ✅ Formato de texto completo (negrita, cursiva, tachado)
- ✅ Encabezados (H1-H6)
- ✅ Listas (viñetas y numeradas)
- ✅ Tablas con herramientas avanzadas (insertar, eliminar, redimensionar)
- ✅ Imágenes (URL o base64)
- ✅ Enlaces
- ✅ Alineación de texto (izquierda, centro, derecha, justificar)
- ✅ Deshacer/Rehacer
- ✅ Placeholder personalizable
- ✅ Estilos de texto (colores)
- ✅ Código fuente (blockquote, code, code block)

## Uso en Plantillas

El editor se muestra automáticamente cuando el tipo de plantilla es "editor". El contenido se guarda como HTML en el campo `plantilla` de la base de datos.

## Variables Dinámicas

Puedes usar variables en el formato `{{variable}}` que se reemplazarán al generar documentos:
- `{{nombre}}` - Nombre del asegurado
- `{{fecha}}` - Fecha del siniestro
- `{{numero_siniestro}}` - Número de siniestro
- `{{descripcion}}` - Descripción de hechos
- etc.

## Personalización

Puedes personalizar el editor editando `frontend/components/ui/TiptapEditor.tsx`:
- Agregar/quitar extensiones
- Modificar la barra de herramientas
- Cambiar estilos con clases de Tailwind
- Agregar más funcionalidades

### Extensiones Disponibles

Tiptap tiene muchas extensiones opcionales que puedes agregar:
- `@tiptap/extension-underline` - Subrayado
- `@tiptap/extension-highlight` - Resaltado de texto
- `@tiptap/extension-task-list` - Listas de tareas
- `@tiptap/extension-mention` - Menciones
- `@tiptap/extension-collaboration` - Edición colaborativa
- Y muchas más en: https://tiptap.dev/docs/editor/extensions

## Comandos Docker Útiles

```bash
# Reconstruir solo el frontend (después de agregar dependencias)
docker-compose build frontend

# Reiniciar el frontend
docker-compose restart frontend

# Ver logs del frontend
docker-compose logs -f frontend

# Instalar dependencias manualmente dentro del contenedor
docker-compose exec frontend npm install

# Acceder al shell del contenedor frontend
docker-compose exec frontend sh

# Reconstruir y reiniciar todo
docker-compose up -d --build
```

## Verificación

Después de configurar, verifica que Tiptap funciona:

1. Ve a `http://localhost:3000/configuracion`
2. Haz clic en la pestaña "Plantillas"
3. Haz clic en "Nueva plantilla"
4. Selecciona tipo "Editor (contenido editable)"
5. Deberías ver el editor Tiptap con su barra de herramientas aparecer debajo del campo "Formato"

## Ventajas sobre TinyMCE

- ✅ **Sin API key** - Completamente gratuito y open source
- ✅ **Más ligero** - Menor tamaño del bundle
- ✅ **Mejor rendimiento** - Más rápido y fluido
- ✅ **Más moderno** - Basado en tecnologías actuales
- ✅ **Mejor integración con React** - Diseñado específicamente para React
- ✅ **Más fácil de personalizar** - API más limpia y extensible

