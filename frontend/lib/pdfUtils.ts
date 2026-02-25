/**
 * Utilidades para generación de PDFs
 * Funciones helper para trabajar con PDFs generados
 */

/**
 * Descarga un PDF desde un blob
 */
export const downloadPDFFromBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Descarga un PDF desde base64
 */
export const downloadPDFFromBase64 = (base64String: string, filename: string) => {
  // Convertir base64 a blob
  const byteCharacters = atob(base64String);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "application/pdf" });
  
  downloadPDFFromBlob(blob, filename);
};

/**
 * Abre un PDF en una nueva ventana desde base64
 */
export const openPDFInNewWindow = (base64String: string) => {
  const byteCharacters = atob(base64String);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  window.open(url, "_blank");
};

/**
 * Crea un objeto URL para mostrar un PDF en un iframe o embed
 */
export const createPDFObjectURL = (base64String: string): string => {
  const byteCharacters = atob(base64String);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "application/pdf" });
  return window.URL.createObjectURL(blob);
};

