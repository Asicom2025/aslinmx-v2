/**
 * Utilidades para reCAPTCHA v3
 */

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

/**
 * Obtiene un token de reCAPTCHA v3 para una acción específica
 * @param action - Acción a verificar (default: "login")
 * @returns Promise con el token de reCAPTCHA
 */
export const getRecaptchaToken = async (action: string = "login"): Promise<string | null> => {
  return new Promise((resolve) => {
    // Si no hay clave configurada, retornar null (modo desarrollo)
    if (!RECAPTCHA_SITE_KEY) {
      console.warn("reCAPTCHA no está configurado: NEXT_PUBLIC_RECAPTCHA_SITE_KEY no está definida");
      resolve(null);
      return;
    }

    if (typeof window === "undefined" || !window.grecaptcha) {
      // Si no está disponible (SSR o script no cargado), retornar null
      console.warn("reCAPTCHA no está disponible - el script puede no haberse cargado aún");
      resolve(null);
      return;
    }

    // Esperar a que reCAPTCHA esté listo
    window.grecaptcha.ready(() => {
      window.grecaptcha
        .execute(RECAPTCHA_SITE_KEY, { action })
        .then((token) => {
          resolve(token);
        })
        .catch((error) => {
          console.error("Error al obtener token de reCAPTCHA:", error);
          // Si el error es de clave inválida, mostrar mensaje más descriptivo
          if (error.toString().includes("Invalid site key") || error.toString().includes("site key")) {
            console.error(
              `La clave de reCAPTCHA puede ser inválida o el dominio no está autorizado. ` +
              `Clave: ${RECAPTCHA_SITE_KEY?.substring(0, 10)}... ` +
              `Verifica en Google Cloud Console que el dominio esté autorizado.`
            );
          }
          resolve(null);
        });
    });
  });
};

/**
 * Verifica si reCAPTCHA está disponible
 */
export const isRecaptchaAvailable = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  
  // Verificar que el script se haya cargado
  if (!window.grecaptcha) {
    return false;
  }
  
  // Verificar que la clave esté configurada
  if (!RECAPTCHA_SITE_KEY) {
    console.warn("reCAPTCHA no está configurado: NEXT_PUBLIC_RECAPTCHA_SITE_KEY no está definida");
    return false;
  }
  
  return true;
};

/**
 * Verifica la configuración de reCAPTCHA y muestra información de diagnóstico
 */
export const diagnoseRecaptcha = (): void => {
  if (typeof window === "undefined") {
    console.log("🔍 Diagnóstico reCAPTCHA: Entorno SSR (no disponible)");
    return;
  }
  
  console.log("🔍 Diagnóstico de reCAPTCHA:");
  console.log("  - Clave configurada:", RECAPTCHA_SITE_KEY ? "✅ Sí" : "❌ No");
  console.log("  - Clave (primeros 10 chars):", RECAPTCHA_SITE_KEY?.substring(0, 10) || "N/A");
  console.log("  - grecaptcha disponible:", window.grecaptcha ? "✅ Sí" : "❌ No");
  
  if (window.grecaptcha) {
    console.log("  - Tipo de grecaptcha:", typeof window.grecaptcha);
  }
  
  // Verificar si el script está cargado
  const script = document.querySelector('script[src*="recaptcha"]');
  console.log("  - Script cargado:", script ? "✅ Sí" : "❌ No");
  
  if (script) {
    console.log("  - URL del script:", script.getAttribute("src"));
  }
};

