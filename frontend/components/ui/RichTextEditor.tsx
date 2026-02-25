import { useEffect, useRef } from "react";

type RichTextEditorProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export default function RichTextEditor({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const handleCommand = (command: string) => {
    if (disabled) return;
    document.execCommand(command, false);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    onChange(editorRef.current.innerHTML);
  };

  const handleBlur = () => {
    if (!editorRef.current) return;
    onChange(editorRef.current.innerHTML);
  };

  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <div className={`flex items-center gap-2 rounded border px-3 py-2 ${disabled ? "bg-gray-100" : "bg-white"}`}>
        <button
          type="button"
          className="text-sm text-gray-600 hover:text-primary-600 disabled:text-gray-400"
          onClick={() => handleCommand("bold")}
          disabled={disabled}
        >
          Negrita
        </button>
        <button
          type="button"
          className="text-sm text-gray-600 hover:text-primary-600 disabled:text-gray-400"
          onClick={() => handleCommand("italic")}
          disabled={disabled}
        >
          Cursiva
        </button>
        <button
          type="button"
          className="text-sm text-gray-600 hover:text-primary-600 disabled:text-gray-400"
          onClick={() => handleCommand("underline")}
          disabled={disabled}
        >
          Subrayar
        </button>
        <button
          type="button"
          className="text-sm text-gray-600 hover:text-primary-600 disabled:text-gray-400"
          onClick={() => handleCommand("insertUnorderedList")}
          disabled={disabled}
        >
          Viñetas
        </button>
        <button
          type="button"
          className="text-sm text-gray-600 hover:text-primary-600 disabled:text-gray-400"
          onClick={() => handleCommand("insertOrderedList")}
          disabled={disabled}
        >
          Numerado
        </button>
      </div>
      <div
        ref={editorRef}
        className={`min-h-[160px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${disabled ? "bg-gray-100" : ""}`}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleBlur}
        data-placeholder={placeholder}
      />
      <style jsx>{`
        [contenteditable="true"]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
        }
      `}</style>
    </div>
  );
}

