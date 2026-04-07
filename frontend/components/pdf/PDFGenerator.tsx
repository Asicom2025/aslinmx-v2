"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import apiService from "@/lib/apiService";
import { swalError, swalSuccess } from "@/lib/swal";

interface PDFGeneratorProps {
  /** Contenido HTML a convertir a PDF */
  htmlContent?: string;
  /** ID de la plantilla a usar (alternativa a htmlContent) */
  plantillaId?: string;
  /** Variables para reemplazar en el HTML/plantilla (opcional, si no se proporciona se genera sin reemplazar variables) */
  variables?: Record<string, any> | undefined;
  /** Tamaño de página */
  pageSize?: "A4" | "Letter" | "Legal" | "A3" | "A5";
  /** Orientación de página */
  orientation?: "portrait" | "landscape";
  /** Márgenes personalizados */
  margins?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
  /** CSS adicional */
  customCSS?: string;
  /** Nombre del archivo PDF */
  filename?: string;
  /** Texto del botón */
  buttonText?: string;
  /** Variante del botón */
  buttonVariant?: "primary" | "secondary" | "danger" | "success";
  /** Tamaño del botón */
  buttonSize?: "sm" | "md" | "lg";
  /** Mostrar botón de vista previa */
  showPreview?: boolean;
  /** Callback cuando se genera el PDF exitosamente */
  onSuccess?: (filename: string) => void;
  /** Callback cuando hay un error */
  onError?: (error: string) => void;
}

export default function PDFGenerator({
  htmlContent,
  plantillaId,
  variables = {},
  pageSize = "A4",
  orientation = "portrait",
  margins = {},
  customCSS,
  filename,
  buttonText = "Generar PDF",
  buttonVariant = "primary",
  buttonSize = "md",
  showPreview = false,
  onSuccess,
  onError,
}: PDFGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const generatePDF = async (download: boolean = true) => {
    if (!htmlContent && !plantillaId) {
      const errorMsg = "Debe proporcionar htmlContent o plantillaId";
      swalError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    try {
      setLoading(true);

      const pdfData: any = {
        page_size: pageSize,
        orientation,
        margin_top: margins.top || "1cm",
        margin_bottom: margins.bottom || "1cm",
        margin_left: margins.left || "1cm",
        margin_right: margins.right || "1cm",
        custom_css: customCSS,
        filename: filename,
      };

      // Solo agregar variables si están definidas y no están vacías
      if (variables && Object.keys(variables).length > 0) {
        pdfData.variables = variables;
      }

      // Agregar plantilla_id o html_content
      if (plantillaId) {
        pdfData.plantilla_id = plantillaId;
      } else {
        pdfData.html_content = htmlContent!;
      }

      if (download) {
        // Descargar directamente
        const finalFilename = filename || "documento";
        if (plantillaId) {
          await apiService.downloadPDFFromTemplate(pdfData as any);
        } else {
          await apiService.downloadPDF(pdfData as any);
        }
        await swalSuccess("PDF generado y descargado exitosamente");
        onSuccess?.(finalFilename);
      } else {
        // Generar para vista previa
        const response = plantillaId
          ? await apiService.generatePDFFromTemplate(pdfData as any)
          : await apiService.generatePDF(pdfData as any);

        if (response.success && response.pdf_base64) {
          const url = URL.createObjectURL(
            new Blob(
              [
                Uint8Array.from(
                  atob(response.pdf_base64),
                  (c) => c.charCodeAt(0)
                ),
              ],
              { type: "application/pdf" }
            )
          );
          setPreviewUrl(url);
          onSuccess?.(response.filename || "documento.pdf");
        }
      }
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.detail || "Error al generar el PDF";
      swalError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => generatePDF(true);
  const handlePreview = () => generatePDF(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button
          variant={buttonVariant}
          size={buttonSize}
          onClick={handleDownload}
          disabled={loading}
          loading={loading}
        >
          {loading ? "Generando..." : buttonText}
        </Button>
        {showPreview && (
          <Button
            variant="secondary"
            size={buttonSize}
            onClick={handlePreview}
            disabled={loading}
          >
            Vista Previa
          </Button>
        )}
      </div>

      {previewUrl && (
        <div className="mt-4 border border-gray-300 rounded-lg overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">
              Vista Previa del PDF
            </span>
            <button
              onClick={() => {
                setPreviewUrl(null);
                URL.revokeObjectURL(previewUrl);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <iframe
            src={previewUrl}
            className="w-full h-[600px] border-0"
            title="Vista previa del PDF"
          />
        </div>
      )}
    </div>
  );
}

