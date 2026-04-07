"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidthClass?: string; // e.g. max-w-2xl
  maxHeightClass?: string; // e.g. max-h-[90vh]
  contentClassName?: string;
}

export default function Modal({ 
  open, 
  onClose, 
  title, 
  children, 
  maxWidthClass = "max-w-2xl",
  maxHeightClass = "max-h-[90vh]",
  contentClassName = "flex-1 overflow-y-auto p-4 sm:p-6",
}: ModalProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", onKeyDown);
      // Prevenir scroll del body cuando el modal está abierto
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div 
          className={`relative w-full ${maxWidthClass} ${maxHeightClass} bg-white rounded-lg shadow-xl flex flex-col overflow-hidden`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "modal-title" : undefined}
        >
          {/* Header - Fixed */}
          {title && (
            <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 flex-shrink-0">
              <h3 
                id="modal-title"
                className="text-lg font-semibold text-gray-900 pr-4"
              >
                {title}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-md p-1 transition-colors flex-shrink-0"
                aria-label="Cerrar"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>
          )}
          
          {/* Content - Scrollable */}
          <div className={contentClassName}>
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}


