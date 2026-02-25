"use client";

import { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import {
  FiList,
  FiAlignLeft,
  FiAlignCenter,
  FiAlignRight,
  FiAlignJustify,
  FiGrid,
  FiTrash2,
  FiLink,
  FiImage,
  FiRotateCcw,
  FiRotateCw,
  FiType,
  FiCode,
  FiMinus,
  FiCheckSquare,
  FiMessageSquare,
  FiPlus,
  FiArrowDown,
  FiArrowRight,
} from "react-icons/fi";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import FontFamily from "@tiptap/extension-font-family";
import Dropcursor from "@tiptap/extension-dropcursor";

type TiptapEditorProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  height?: number;
};

export default function TiptapEditor({
  label,
  value,
  onChange,
  placeholder = "Escribe el contenido de la plantilla aquí...",
  disabled = false,
  height = 500,
}: TiptapEditorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        codeBlock: {
          HTMLAttributes: {
            class: "bg-gray-100 rounded p-2 font-mono text-sm",
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: "border-l-4 border-gray-300 pl-4 italic my-4",
          },
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextStyle,
      Color,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Underline,
      Highlight.configure({
        multicolor: true,
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: "list-none pl-0",
        },
      }),
      TaskItem.configure({
        nested: true,
      }),
      HorizontalRule,
      Subscript,
      Superscript,
      Dropcursor,
      FontFamily.configure({
        types: ["textStyle"],
      }),
      Table.configure({
        resizable: true,
        draggable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline",
        },
      }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }: { editor: any }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4 text-gray-900",
      },
    },
  });

  // Sincronizar el contenido cuando value cambia desde afuera
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  // Evitar renderizado en el servidor
  if (!mounted || !editor) {
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

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    if (url === null) {
      return;
    }

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt("URL de la imagen");

    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border border-gray-300 rounded-t-md bg-white shadow-sm">
        {/* Formato de texto básico */}
        <div className="flex items-center gap-0.5 border-r border-gray-200 pr-2 mr-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run() || disabled}
            className={`px-2.5 py-1.5 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-sm ${
              editor.isActive("bold")
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Negrita (Ctrl+B)"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run() || disabled}
            className={`px-2.5 py-1.5 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed italic text-sm ${
              editor.isActive("italic")
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Cursiva (Ctrl+I)"
          >
            I
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            disabled={!editor.can().chain().focus().toggleUnderline().run() || disabled}
            className={`px-2.5 py-1.5 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed underline text-sm ${
              editor.isActive("underline")
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Subrayado (Ctrl+U)"
          >
            U
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            disabled={!editor.can().chain().focus().toggleStrike().run() || disabled}
            className={`px-2.5 py-1.5 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed line-through text-sm ${
              editor.isActive("strike")
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Tachado"
          >
            S
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            disabled={!editor.can().chain().focus().toggleHighlight().run() || disabled}
            className={`px-2.5 py-1.5 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-sm ${
              editor.isActive("highlight")
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Resaltar"
          >
            <span className="bg-yellow-300 px-1 rounded">A</span>
          </button>
        </div>

        {/* Subíndice y superíndice */}
        <div className="flex items-center gap-0.5 border-r border-gray-200 pr-2 mr-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            disabled={!editor.can().chain().focus().toggleSubscript().run() || disabled}
            className={`px-2.5 py-1.5 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-xs ${
              editor.isActive("subscript")
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Subíndice"
          >
            X<sub>2</sub>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
            disabled={!editor.can().chain().focus().toggleSuperscript().run() || disabled}
            className={`px-2.5 py-1.5 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-xs ${
              editor.isActive("superscript")
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Superíndice"
          >
            X<sup>2</sup>
          </button>
        </div>

        {/* Encabezados */}
        <div className="flex items-center gap-0.5 border-r border-gray-200 pr-2 mr-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            disabled={disabled}
            className={`px-2.5 py-1.5 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold ${
              editor.isActive("heading", { level: 1 })
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Encabezado 1"
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            disabled={disabled}
            className={`px-2.5 py-1.5 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold ${
              editor.isActive("heading", { level: 2 })
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Encabezado 2"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            disabled={disabled}
            className={`px-2.5 py-1.5 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold ${
              editor.isActive("heading", { level: 3 })
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Encabezado 3"
          >
            H3
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
            disabled={disabled}
            className={`px-2.5 py-1.5 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold ${
              editor.isActive("heading", { level: 4 })
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Encabezado 4"
          >
            H4
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
            disabled={disabled}
            className={`px-2.5 py-1.5 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold ${
              editor.isActive("heading", { level: 5 })
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Encabezado 5"
          >
            H5
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
            disabled={disabled}
            className={`px-2.5 py-1.5 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold ${
              editor.isActive("heading", { level: 6 })
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Encabezado 6"
          >
            H6
          </button>
        </div>

        {/* Listas */}
        <div className="flex items-center gap-0.5 border-r border-gray-200 pr-2 mr-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            disabled={disabled}
            className={`p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
              editor.isActive("bulletList")
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Lista con viñetas"
          >
            <FiList className="w-4 h-4" />
            <span className="sr-only">Lista con viñetas</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            disabled={disabled}
            className={`p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
              editor.isActive("orderedList")
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Lista numerada"
          >
            <FiList className="w-4 h-4" />
            <span className="sr-only">Lista numerada</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            disabled={disabled}
            className={`p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
              editor.isActive("taskList")
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Lista de tareas"
          >
            <FiCheckSquare className="w-4 h-4" />
            <span className="sr-only">Lista de tareas</span>
          </button>
        </div>

        {/* Código y cita */}
        <div className="flex items-center gap-0.5 border-r border-gray-200 pr-2 mr-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCode().run()}
            disabled={!editor.can().chain().focus().toggleCode().run() || disabled}
            className={`p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
              editor.isActive("code")
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Código inline"
          >
            <FiCode className="w-4 h-4" />
            <span className="sr-only">Código inline</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            disabled={disabled}
            className={`p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
              editor.isActive("codeBlock")
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Bloque de código"
          >
            <FiCode className="w-4 h-4" />
            <span className="sr-only">Bloque de código</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            disabled={disabled}
            className={`p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
              editor.isActive("blockquote")
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Cita"
          >
            <FiMessageSquare className="w-4 h-4" />
            <span className="sr-only">Cita</span>
          </button>
        </div>

        {/* Alineación */}
        <div className="flex items-center gap-0.5 border-r border-gray-200 pr-2 mr-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            disabled={disabled}
            className={`p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
              editor.isActive({ textAlign: "left" })
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Alinear izquierda"
          >
            <FiAlignLeft className="w-4 h-4" />
            <span className="sr-only">Alinear izquierda</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            disabled={disabled}
            className={`p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
              editor.isActive({ textAlign: "center" })
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Centrar"
          >
            <FiAlignCenter className="w-4 h-4" />
            <span className="sr-only">Centrar</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            disabled={disabled}
            className={`p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
              editor.isActive({ textAlign: "right" })
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Alinear derecha"
          >
            <FiAlignRight className="w-4 h-4" />
            <span className="sr-only">Alinear derecha</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
            disabled={disabled}
            className={`p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
              editor.isActive({ textAlign: "justify" })
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Justificar"
          >
            <FiAlignJustify className="w-4 h-4" />
            <span className="sr-only">Justificar</span>
          </button>
        </div>

        {/* Tabla */}
        <div className="flex items-center gap-0.5 border-r border-gray-200 pr-2 mr-1">
          <button
            type="button"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
            disabled={disabled}
            className="p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            title="Insertar tabla"
          >
            <FiGrid className="w-4 h-4" />
            <span className="sr-only">Insertar tabla</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().addRowBefore().run()}
            disabled={!editor.can().addRowBefore() || disabled}
            className="p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100 hover:text-gray-900 relative"
            title="Agregar fila arriba"
          >
            <FiPlus className="w-4 h-4" />
            <FiArrowDown className="w-2 h-2 absolute -bottom-0.5 -right-0.5" />
            <span className="sr-only">Agregar fila arriba</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().addRowAfter().run()}
            disabled={!editor.can().addRowAfter() || disabled}
            className="p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100 hover:text-gray-900 relative"
            title="Agregar fila abajo"
          >
            <FiPlus className="w-4 h-4" />
            <FiArrowDown className="w-2 h-2 absolute -top-0.5 -right-0.5" />
            <span className="sr-only">Agregar fila abajo</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteRow().run()}
            disabled={!editor.can().deleteRow() || disabled}
            className="p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100 hover:text-gray-900 relative"
            title="Eliminar fila"
          >
            <FiTrash2 className="w-4 h-4" />
            <FiArrowDown className="w-2 h-2 absolute -top-0.5 -right-0.5" />
            <span className="sr-only">Eliminar fila</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            disabled={!editor.can().addColumnBefore() || disabled}
            className="p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100 hover:text-gray-900 relative"
            title="Agregar columna izquierda"
          >
            <FiPlus className="w-4 h-4" />
            <FiArrowRight className="w-2 h-2 absolute -bottom-0.5 -right-0.5" />
            <span className="sr-only">Agregar columna izquierda</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            disabled={!editor.can().addColumnAfter() || disabled}
            className="p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100 hover:text-gray-900 relative"
            title="Agregar columna derecha"
          >
            <FiPlus className="w-4 h-4" />
            <FiArrowRight className="w-2 h-2 absolute -top-0.5 -right-0.5" />
            <span className="sr-only">Agregar columna derecha</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteColumn().run()}
            disabled={!editor.can().deleteColumn() || disabled}
            className="p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100 hover:text-gray-900 relative"
            title="Eliminar columna"
          >
            <FiTrash2 className="w-4 h-4" />
            <FiArrowRight className="w-2 h-2 absolute -top-0.5 -right-0.5" />
            <span className="sr-only">Eliminar columna</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteTable().run()}
            disabled={!editor.can().deleteTable() || disabled}
            className="p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            title="Eliminar tabla"
          >
            <FiTrash2 className="w-4 h-4" />
            <span className="sr-only">Eliminar tabla</span>
          </button>
        </div>

        {/* Enlace e Imagen */}
        <div className="flex items-center gap-0.5 border-r border-gray-200 pr-2 mr-1">
          <button
            type="button"
            onClick={setLink}
            disabled={disabled}
            className={`p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
              editor.isActive("link")
                ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Insertar enlace"
          >
            <FiLink className="w-4 h-4" />
            <span className="sr-only">Insertar enlace</span>
          </button>
          <button
            type="button"
            onClick={addImage}
            disabled={disabled}
            className="p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            title="Insertar imagen"
          >
            <FiImage className="w-4 h-4" />
            <span className="sr-only">Insertar imagen</span>
          </button>
        </div>

        {/* Línea horizontal */}
        <div className="flex items-center gap-0.5 border-r border-gray-200 pr-2 mr-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            disabled={disabled}
            className="p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            title="Insertar línea horizontal"
          >
            <FiMinus className="w-4 h-4" />
            <span className="sr-only">Insertar línea horizontal</span>
          </button>
        </div>

        {/* Colores */}
        <div className="flex items-center gap-0.5 border-r border-gray-200 pr-2 mr-1">
          <div className="relative">
            <input
              type="color"
              onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
              value={editor.getAttributes("textStyle").color || "#000000"}
              disabled={disabled}
              className="w-8 h-8 rounded border border-gray-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Color de texto"
            />
          </div>
        </div>

        {/* Fuente */}
        <div className="flex items-center gap-0.5 border-r border-gray-200 pr-2 mr-1">
          <select
            onChange={(e) => {
              if (e.target.value === "") {
                editor.chain().focus().unsetFontFamily().run();
              } else {
                editor.chain().focus().setFontFamily(e.target.value).run();
              }
            }}
            value={editor.getAttributes("textStyle").fontFamily || ""}
            disabled={disabled}
            className="px-2 py-1.5 text-sm rounded-md border border-gray-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
            title="Familia de fuente"
          >
            <option value="">Fuente predeterminada</option>
            <option value="Arial">Arial</option>
            <option value="Helvetica">Helvetica</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Courier New">Courier New</option>
            <option value="Verdana">Verdana</option>
            <option value="Georgia">Georgia</option>
            <option value="Palatino">Palatino</option>
            <option value="Garamond">Garamond</option>
            <option value="Comic Sans MS">Comic Sans MS</option>
            <option value="Impact">Impact</option>
            <option value="Trebuchet MS">Trebuchet MS</option>
          </select>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run() || disabled}
            className="p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            title="Deshacer (Ctrl+Z)"
          >
            <FiRotateCcw className="w-4 h-4" />
            <span className="sr-only">Deshacer</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run() || disabled}
            className="p-2 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            title="Rehacer (Ctrl+Y)"
          >
            <FiRotateCw className="w-4 h-4" />
            <span className="sr-only">Rehacer</span>
          </button>
        </div>
      </div>

      {/* Editor */}
      <div
        className="border border-t-0 border-gray-300 rounded-b-md bg-white overflow-auto"
        style={{ minHeight: `${height}px`, maxHeight: `${height}px` }}
      >
        <EditorContent editor={editor} />
      </div>

      <p className="text-xs text-gray-500">
        💡 Tip: Puedes usar variables dinámicas como <code className="bg-gray-100 px-1 rounded">{`{{nombre}}`}</code>, <code className="bg-gray-100 px-1 rounded">{`{{fecha}}`}</code>, etc. que se reemplazarán al generar el documento.
      </p>
    </div>
  );
}

