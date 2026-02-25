"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import PDFGenerator from "@/components/pdf/PDFGenerator";
import apiService from "@/lib/apiService";
import { swalError } from "@/lib/swal";

interface PDFPreviewModalProps {
  plantillaId: string;
  plantillaNombre: string;
  onClose: () => void;
}

export default function PDFPreviewModal({
  plantillaId,
  plantillaNombre,
  onClose,
}: PDFPreviewModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generatePreview = async () => {
    try {
      setLoading(true);
      const requestData = {
        plantilla_id: plantillaId,
        page_size: "A4" as const,
        orientation: "portrait" as const,
        filename: plantillaNombre,
        // No se envían variables - se genera sin datos
      };

      const response = await apiService.generatePDFFromTemplate(requestData);

      if (response.success && response.pdf_base64) {
        const byteCharacters = atob(response.pdf_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);

        // Liberar URL anterior si existe
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }

        setPreviewUrl(url);
      }
    } catch (error: any) {
      swalError(
        error.response?.data?.detail || "Error al generar la previsualización"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Generar preview automáticamente al abrir
    generatePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantillaId]);

  useEffect(() => {
    // Limpiar URL al desmontar
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div className="space-y-4">
      {/* Información */}
      <div className="flex gap-2">
        <Button variant="primary" onClick={generatePreview} disabled={loading}>
          {loading ? "Generando..." : "Actualizar Vista Previa"}
        </Button>
      </div>

      {/* Vista previa del PDF */}
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <div className="bg-gray-100 px-4 py-2 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">
            Vista Previa del PDF
          </span>
          {previewUrl && (
            <PDFGenerator
              plantillaId={plantillaId}
              pageSize="A4"
              orientation="portrait"
              filename={plantillaNombre}
              buttonText="Descargar PDF"
              buttonVariant="primary"
              buttonSize="sm"
              showPreview={false}
            />
          )}
        </div>
        {previewUrl ? (
          <iframe
            src={previewUrl}
            className="w-full h-[600px] border-0"
            title="Vista previa del PDF"
          />
        ) : loading ? (
          <div className="flex items-center justify-center h-[600px]">
            <p className="text-gray-500">Generando vista previa...</p>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[600px]">
            <p className="text-gray-500">
              Haz clic en "Actualizar Vista Previa" para generar el PDF
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
