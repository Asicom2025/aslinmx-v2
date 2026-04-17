/**
 * Reduce el tamaño de imágenes antes de enviarlas como data URL en JSON (evita 413 por cuerpo demasiado grande).
 */

export type CompressImageOptions = {
  /** Lado mayor máximo en píxeles (ancho o alto) */
  maxEdge?: number;
  /** Salida: JPEG ocupa mucho menos que PNG para fotos */
  mime?: "image/jpeg" | "image/png";
  quality?: number;
};

/**
 * Lee un archivo de imagen y devuelve un data URL redimensionado y re-codificado.
 */
export function compressImageFileToDataUrl(
  file: File,
  options?: CompressImageOptions
): Promise<string> {
  const maxEdge = options?.maxEdge ?? 1280;
  const mime = options?.mime ?? "image/jpeg";
  const quality = options?.quality ?? 0.85;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => URL.revokeObjectURL(objectUrl);

    img.onload = () => {
      try {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (!w || !h) {
          cleanup();
          reject(new Error("Imagen sin dimensiones válidas"));
          return;
        }
        const scale = Math.min(1, maxEdge / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          reject(new Error("No se pudo crear el contexto 2D"));
          return;
        }

        if (mime === "image/jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(img, 0, 0, w, h);

        const dataUrl = canvas.toDataURL(
          mime,
          mime === "image/jpeg" ? quality : undefined
        );
        cleanup();
        resolve(dataUrl);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    img.onerror = () => {
      cleanup();
      reject(new Error("No se pudo leer la imagen"));
    };

    img.src = objectUrl;
  });
}
