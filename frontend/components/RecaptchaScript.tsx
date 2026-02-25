"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

/**
 * Componente cliente para cargar el script de reCAPTCHA
 * Debe ser un Client Component porque usa event handlers
 */
export default function RecaptchaScript() {
  const [siteKey, setSiteKey] = useState<string | null>(null);

  useEffect(() => {
    // Obtener la clave desde las variables de entorno del cliente
    const key = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    setSiteKey(key || null);
  }, []);

  if (!siteKey) {
    // No renderizar nada si no hay clave configurada
    return null;
  }

  return (
    <Script
      src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`}
      strategy="afterInteractive"
      onError={(e) => {
        console.error("Error al cargar reCAPTCHA:", e);
      }}
      onLoad={() => {
        console.log("reCAPTCHA script cargado correctamente");
      }}
    />
  );
}

