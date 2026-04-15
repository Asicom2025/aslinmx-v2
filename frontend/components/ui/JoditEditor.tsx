"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { decodeHtmlForEditor } from "@/lib/decodeHtmlForEditor";

// Importar Jodit dinámicamente para evitar problemas de SSR
const JoditEditor = dynamic(() => import("jodit-react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center border border-gray-300 rounded-md bg-white p-8">
      <div className="text-gray-500">Cargando editor...</div>
    </div>
  ),
});

type JoditEditorProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  height?: number;
};

export default function JoditEditorComponent({
  label,
  value,
  onChange,
  placeholder = "Escribe el contenido de la plantilla aquí...",
  disabled = false,
  height = 500,
}: JoditEditorProps) {
  const [mounted, setMounted] = useState(false);
  const normalizedValue = useMemo(() => decodeHtmlForEditor(value), [value]);
  // Mantener el contenido actual sin provocar re-renders en cada tecla
  const contentRef = useRef<string>(normalizedValue);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cuando cambia el valor externo (por ejemplo, al abrir una plantilla nueva),
  // actualizar el ref sin re-renderizar el editor.
  useEffect(() => {
    contentRef.current = normalizedValue;
  }, [normalizedValue]);

  // Configuración completa de Jodit con todas las opciones disponibles
  const config = useMemo(() => ({
    // Configuración básica
    readonly: disabled,
    placeholder,
    height: height,
    minHeight: 300,
    maxHeight: height,
    
    // Toolbar
    toolbar: true,
    toolbarButtonSize: "medium" as const,
    toolbarSticky: false,
    toolbarAdaptive: false, // Desactivar adaptativo para mostrar todos los botones
    showToolbar: true,
    showToolbarButtonSize: true,
    toolbarBreakpoint: 0, // Sin breakpoint para mostrar siempre todos los botones
    
    // Contadores y estado
    showCharsCounter: true,
    showWordsCounter: true,
    showXPathInStatusbar: false,
    showSpellcheck: true,
    
    // Editor
    editorCssClass: false,
    editorClassName: "",
    direction: "ltr" as const,
    textIcons: false,
    usePopup: true,
    
    // Pega de contenido
    askBeforePasteHTML: false,
    askBeforePasteFromWord: false,
    defaultActionOnPaste: "insert_as_html" as const,
    processPasteFromWord: true,
    removeEmptyElements: true,
    
    // Pantalla completa - Configuración corregida
    fullsize: false, // Desactivar pantalla completa automática
    fullsizeNative: false, // Usar modo nativo de Jodit en lugar del navegador
    zIndex: 10000, // Z-index alto para que esté por encima de todo cuando se active manualmente
    
    // Botones completos del toolbar
    buttons: [
      "source",
      "|",
      "bold",
      "italic",
      "underline",
      "strikethrough",
      "|",
      "superscript",
      "subscript",
      "|",
      "font",
      "fontsize",
      "paragraph",
      "|",
      "align",
      "|",
      "ul",
      "ol",
      "|",
      "outdent",
      "indent",
      "|",
      "link",
      "image",
      "video",
      "|",
      "table",
      "|",
      "brush",
      "|",
      "eraser",
      "|",
      "copyformat",
      "|",
      "hr",
      "|",
      "symbol",
      "|",
      "fullsize",
      "|",
      "undo",
      "redo",
      "|",
      "selectall",
      "|",
      "print",
      "|",
      "find",
      "|",
      "spellcheck",
      "|",
      "about",
    ] as any,
    
    // Botones para pantallas pequeñas
    buttonsXS: [
      "bold",
      "italic",
      "underline",
      "|",
      "ul",
      "ol",
      "|",
      "undo",
      "redo",
      "|",
      "fullsize",
    ],
    
    // Botones para pantallas medianas
    buttonsSM: [
      "bold",
      "italic",
      "underline",
      "strikethrough",
      "|",
      "ul",
      "ol",
      "|",
      "link",
      "image",
      "|",
      "undo",
      "redo",
      "|",
      "fullsize",
    ],
    
    // Botones para pantallas grandes
    buttonsMD: [
      "source",
      "|",
      "bold",
      "italic",
      "underline",
      "strikethrough",
      "|",
      "ul",
      "ol",
      "|",
      "link",
      "image",
      "table",
      "|",
      "undo",
      "redo",
      "|",
      "fullsize",
    ],
    
    // Botones removidos (ninguno, queremos todas las opciones)
    removeButtons: [],
    
    // Placeholder
    showPlaceholder: true,
    
    // Uploader de imágenes
    uploader: {
      insertImageAsBase64URI: true,
      imagesExtensions: ["jpg", "png", "jpeg", "gif", "svg", "webp"],
      filesExtensions: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip", "rar"],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      url: "",
      format: "json",
      method: "POST",
      prepareData: (formData: FormData) => formData,
      isSuccess: (resp: any) => resp.success !== false,
      getMessage: (resp: any) => resp.data?.message || resp.message || "",
      process: (resp: any) => ({
        files: resp.data?.files || [resp.data?.file] || [],
        path: resp.data?.path || "",
        baseurl: resp.data?.baseurl || "",
        error: resp.error || 0,
        message: resp.data?.message || resp.message || "",
      }),
      error: (e: Error) => {
        console.error("Error uploading file:", e);
      },
      defaultHandlerSuccess: (data: any) => {
        if (data.files && data.files.length) {
          data.files.forEach((filename: string) => {
            const tag = `<img style="max-width:100%" src="${data.baseurl}${filename}" alt="${filename}"/>`;
            // El editor insertará la imagen automáticamente
          });
        }
      },
      defaultHandlerError: (e: Error) => {
        console.error("Upload error:", e);
      },
    },
    
    // Configuración de imágenes
    image: {
      editSrc: true,
      editTitle: true,
      editAlt: true,
      editLink: true,
      editSize: true,
      editClass: true,
      editId: true,
      editStyle: true,
      editAlign: true,
      editBorderRadius: true,
      editMargin: true,
      editPadding: true,
      editBackground: true,
      editBorder: true,
      editFile: true,
      editInfo: true,
      editLinkOpenInNewTab: true,
      editLinkTitle: true,
      editLinkText: true,
      editLinkClassName: true,
      editLinkId: true,
      editLinkRel: true,
      editLinkTarget: true,
      editLinkDownload: true,
      editLinkHref: true,
      editLinkUrl: true,
      editLinkImage: true,
      editLinkImageSrc: true,
      editLinkImageAlt: true,
      editLinkImageTitle: true,
      editLinkImageClass: true,
      editLinkImageId: true,
      editLinkImageStyle: true,
      editLinkImageAlign: true,
      editLinkImageBorderRadius: true,
      editLinkImageMargin: true,
      editLinkImagePadding: true,
      editLinkImageBackground: true,
      editLinkImageBorder: true,
      editLinkImageFile: true,
      editLinkImageInfo: true,
      editLinkImageOpenInNewTab: true,
      editLinkImageText: true,
      editLinkImageClassName: true,
      editLinkImageRel: true,
      editLinkImageTarget: true,
      editLinkImageDownload: true,
      editLinkImageHref: true,
      editLinkImageUrl: true,
      openOnDblClick: true,
      useImageEditor: true,
      defaultSize: {
        width: 300,
        height: 300,
      },
    },
    
    // Configuración de enlaces
    link: {
      openInNewTab: true,
      followLinkOnDblClick: false,
      processPastedLink: true,
      processVideoLink: true,
      videoProviders: ["youtube", "vimeo", "dailymotion"],
    },
    
    // Configuración de tablas
    table: {
      insert: true,
      edit: true,
      remove: true,
      merge: true,
      split: true,
      addColumn: true,
      addRow: true,
      removeColumn: true,
      removeRow: true,
      selectColumns: true,
      selectRows: true,
      selectTable: true,
      resize: true,
      class: true,
      style: true,
      id: true,
      width: true,
      height: true,
      border: true,
      cellPadding: true,
      cellSpacing: true,
      backgroundColor: true,
      backgroundImage: true,
      color: true,
      fontSize: true,
      fontFamily: true,
      fontWeight: true,
      fontStyle: true,
      textAlign: true,
      verticalAlign: true,
      textDecoration: true,
      textTransform: true,
      letterSpacing: true,
      lineHeight: true,
      wordSpacing: true,
      whiteSpace: true,
      overflow: true,
      cursor: true,
      userSelect: true,
      pointerEvents: true,
      opacity: true,
      visibility: true,
      display: true,
      position: true,
      top: true,
      right: true,
      bottom: true,
      left: true,
      zIndex: true,
      margin: true,
      padding: true,
      borderWidth: true,
      borderStyle: true,
      borderColor: true,
      borderRadius: true,
      boxShadow: true,
      transform: true,
      transition: true,
      animation: true,
    },
    
    // Corrector ortográfico
    spellcheck: {
      lang: "es",
      enable: true,
      JSSpell: {
        apiKey: "",
        dict: "es_ES",
      },
    },
    
    // Idioma
    language: "es",
    
    // Traducciones al español
    i18n: {
      es: {
        "Insert Image": "Insertar Imagen",
        "Image URL": "URL de la Imagen",
        "Image Alt": "Texto Alternativo",
        "Image Title": "Título de la Imagen",
        "Image Width": "Ancho",
        "Image Height": "Alto",
        "Insert Link": "Insertar Enlace",
        "Link URL": "URL del Enlace",
        "Link Text": "Texto del Enlace",
        "Link Title": "Título del Enlace",
        "Open in new tab": "Abrir en nueva pestaña",
        "Insert Table": "Insertar Tabla",
        "Table Rows": "Filas",
        "Table Columns": "Columnas",
        "Bold": "Negrita",
        "Italic": "Cursiva",
        "Underline": "Subrayado",
        "Strikethrough": "Tachado",
        "Superscript": "Superíndice",
        "Subscript": "Subíndice",
        "Font": "Fuente",
        "Font Size": "Tamaño de Fuente",
        "Paragraph": "Párrafo",
        "Align": "Alinear",
        "Align Left": "Izquierda",
        "Align Center": "Centro",
        "Align Right": "Derecha",
        "Align Justify": "Justificar",
        "Unordered List": "Lista con Viñetas",
        "Ordered List": "Lista Numerada",
        "Outdent": "Disminuir Sangría",
        "Indent": "Aumentar Sangría",
        "Undo": "Deshacer",
        "Redo": "Rehacer",
        "Select All": "Seleccionar Todo",
        "Print": "Imprimir",
        "Find": "Buscar",
        "Spellcheck": "Corrector Ortográfico",
        "Source": "Código Fuente",
        "Fullsize": "Pantalla Completa",
        "Eraser": "Borrador de Formato",
        "Copy Format": "Copiar Formato",
        "Horizontal Rule": "Línea Horizontal",
        "Video": "Video",
        "Video URL": "URL del Video",
        "Symbol": "Símbolo",
        "About": "Acerca de",
        "Cut": "Cortar",
        "Copy": "Copiar",
        "Paste": "Pegar",
        "Paste as HTML": "Pegar como HTML",
        "Paste as Text": "Pegar como Texto",
        "Delete": "Eliminar",
        "Clear formatting": "Limpiar formato",
        "Format": "Formato",
        "Styles": "Estilos",
        "Colors": "Colores",
        "Background": "Fondo",
        "Text": "Texto",
        "Border": "Borde",
        "Width": "Ancho",
        "Height": "Alto",
        "Cell": "Celda",
        "Row": "Fila",
        "Column": "Columna",
        "Merge cells": "Combinar celdas",
        "Split cell": "Dividir celda",
        "Add row before": "Agregar fila arriba",
        "Add row after": "Agregar fila abajo",
        "Add column before": "Agregar columna izquierda",
        "Add column after": "Agregar columna derecha",
        "Delete row": "Eliminar fila",
        "Delete column": "Eliminar columna",
        "Delete table": "Eliminar tabla",
        "Select row": "Seleccionar fila",
        "Select column": "Seleccionar columna",
        "Select table": "Seleccionar tabla",
        "Resize table": "Redimensionar tabla",
        "Table properties": "Propiedades de tabla",
        "Cell properties": "Propiedades de celda",
      },
    },
    
    // Estilos CSS personalizados para el editor
    style: {
      editorCssClass: "",
      editorClassName: "",
    },
    
    // Opciones adicionales
    allowResizeX: true,
    allowResizeY: true,
    resize: true,
    resizeOptions: {
      minWidth: 300,
      minHeight: 200,
    },
    
    // Autofocus
    autofocus: false,
    
    // Cursor
    cursorAfterAutofocus: "end" as const,
    
    // Enter
    enter: "P" as const,
    enterBlock: "DIV" as const,
    
    // Edición
    editHTMLDocumentMode: false,
    allowTabNavigation: true,
    
    // Limpieza de HTML
    cleanHTML: {
      removeEmptyElements: true,
      fillEmptyParagraph: true,
      removeSpaces: false,
      removeNBSP: false,
      removeLineBreaks: false,
      removeComments: true,
      removeAttributes: [],
      removeStyles: [],
      removeClasses: [],
      removeTags: [],
      replace: [],
    },
    
    // Atributos permitidos
    allowAttributes: [],
    
    // Tags permitidos
    allowTags: [],
    
    // Tags prohibidos
    denyTags: [],
    
    // Atributos prohibidos
    denyAttributes: [],
    
    // Estilos prohibidos
    denyStyles: [],
    
    // Clases prohibidas
    denyClasses: [],
  }), [disabled, placeholder, height]);

  if (!mounted) {
    return (
      <div className="flex flex-col gap-2">
        {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
        <div
          className="border border-gray-300 rounded-md bg-white overflow-hidden"
          style={{ minHeight: `${height}px` }}
        >
          <div className="p-4 text-gray-400">Cargando editor...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Estilos globales para corregir el problema de pantalla completa y mostrar todos los botones */}
      <style jsx global>{`
        /* Asegurar que todos los botones del toolbar sean visibles */
        .jodit-toolbar {
          overflow-x: auto !important;
          overflow-y: visible !important;
          white-space: nowrap !important;
          flex-wrap: nowrap !important;
          display: flex !important;
          width: 100% !important;
        }
        
        .jodit-toolbar-editor-collection {
          display: flex !important;
          flex-wrap: nowrap !important;
          overflow-x: auto !important;
          overflow-y: visible !important;
        }
        
        .jodit-toolbar-editor-collection > * {
          flex-shrink: 0 !important;
        }
        
        /* Mostrar todos los botones sin ocultar */
        .jodit-toolbar-button {
          display: inline-flex !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        
        /* Asegurar que el toolbar no colapse botones */
        .jodit-toolbar-button_hidden {
          display: inline-flex !important;
          visibility: visible !important;
        }
        
        /* Scroll horizontal si es necesario */
        .jodit-container .jodit-toolbar-editor-collection {
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch !important;
        }
        
        /* Estilos para pantalla completa */
        .jodit-container.jodit_fullsize {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          max-width: 100vw !important;
          max-height: 100vh !important;
          min-width: 100vw !important;
          min-height: 100vh !important;
          z-index: 10000 !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
        
        .jodit-container.jodit_fullsize .jodit-toolbar {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
        
        .jodit-container.jodit_fullsize .jodit-workplace {
          width: 100% !important;
          height: calc(100vh - 60px) !important;
          max-height: calc(100vh - 60px) !important;
          min-height: calc(100vh - 60px) !important;
          box-sizing: border-box !important;
          overflow: auto !important;
        }
        
        .jodit-container.jodit_fullsize .jodit-wysiwyg {
          width: 100% !important;
          height: 100% !important;
          max-height: 100% !important;
          min-height: 100% !important;
          box-sizing: border-box !important;
          overflow: auto !important;
        }
        
        .jodit-container.jodit_fullsize .jodit-editor {
          width: 100% !important;
          height: 100% !important;
          max-height: 100% !important;
          min-height: 100% !important;
          box-sizing: border-box !important;
        }
        
        .jodit-container.jodit_fullsize .jodit-statusbar {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
        
        /* Asegurar que funcione en orientación vertical */
        @media screen and (orientation: portrait) {
          .jodit-container.jodit_fullsize {
            width: 100vw !important;
            height: 100vh !important;
            max-width: 100vw !important;
            max-height: 100vh !important;
          }
          
          .jodit-container.jodit_fullsize .jodit-workplace {
            height: calc(100vh - 60px) !important;
            max-height: calc(100vh - 60px) !important;
          }
        }
        
        /* Asegurar que funcione en orientación horizontal */
        @media screen and (orientation: landscape) {
          .jodit-container.jodit_fullsize {
            width: 100vw !important;
            height: 100vh !important;
            max-width: 100vw !important;
            max-height: 100vh !important;
          }
          
          .jodit-container.jodit_fullsize .jodit-workplace {
            height: calc(100vh - 60px) !important;
            max-height: calc(100vh - 60px) !important;
          }
        }
        
        /* Forzar que todos los elementos hijos respeten el tamaño */
        .jodit-container.jodit_fullsize * {
          box-sizing: border-box !important;
        }
      `}</style>
      
      <div className="flex flex-col gap-2">
        {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
        <div className="border border-gray-300 rounded-md overflow-hidden">
          <JoditEditor
            {...({ value: normalizedValue } as any)}
            config={config}
            onBlur={(newContent: string) => {
              // Al perder el foco, actualizar el valor externo UNA sola vez
              contentRef.current = newContent;
              if (newContent !== normalizedValue) {
                onChange(newContent);
              }
            }}
            onChange={(newContent: string) => {
              // Solo actualizamos el ref local, sin tocar estado de React
              contentRef.current = newContent;
            }}
          />
        </div>
        <p className="text-xs text-gray-500">
          💡 Tip: Puedes usar variables dinámicas como <code className="bg-gray-100 px-1 rounded">{`{{nombre}}`}</code>, <code className="bg-gray-100 px-1 rounded">{`{{fecha}}`}</code>, etc. que se reemplazarán al generar el documento.
        </p>
      </div>
    </>
  );
}
