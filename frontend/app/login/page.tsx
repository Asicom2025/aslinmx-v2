/**
 * Página de Login
 * Permite autenticación de usuarios
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { swalSuccess, swalError, swalInfo } from "@/lib/swal";
import apiService from "@/lib/apiService";
import {
  getRecaptchaToken,
  isRecaptchaAvailable,
  diagnoseRecaptcha,
} from "@/lib/recaptcha";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import RecaptchaScript from "@/components/RecaptchaScript";
import { useUser } from "@/context/UserContext";
import Image from "next/image";

import logoDxLegal from "@/assets/logos/logo_large_black.svg";
import logoMaslin from "@/assets/logos/logo_login.gif";
import { FiEye, FiEyeOff } from "react-icons/fi";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useUser();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Diagnóstico de reCAPTCHA en desarrollo
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      // Esperar un momento para que el script se cargue
      const timer = setTimeout(() => {
        diagnoseRecaptcha();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (requires2FA && tempToken) {
        // Paso 2: verificar 2FA (no requiere reCAPTCHA)
        const resp2 = await apiService.verify2FA(tempToken, code);
        localStorage.setItem("token", resp2.access_token);
        await refresh();
        // await swalSuccess("¡Inicio de sesión exitoso!"); para no mostrar el mensaje de éxito en desarrollo solamente
        router.push("/dashboard");
        return;
      }

      // Paso 1: login - Obtener token de reCAPTCHA
      let recaptchaToken: string | null = null;
      if (isRecaptchaAvailable()) {
        recaptchaToken = await getRecaptchaToken("login");
        if (!recaptchaToken) {
          swalError(
            "Error al verificar reCAPTCHA. Por favor, recarga la página e intenta nuevamente.",
          ); // aqui es valido mostrar error!
          setLoading(false);
          return;
        }
      }

      // Paso 1: login
      const response = await apiService.login(
        formData.username,
        formData.password,
        recaptchaToken || undefined,
      );

      if (response.requires_2fa) {
        setRequires2FA(true);
        setTempToken(response.temp_token);
        // await swalInfo("Ingresa tu código 2FA"); no mostrar en producción
        return;
      }

      // Guardar token en localStorage
      localStorage.setItem("token", response.access_token);

      // Hidratar datos del usuario inmediatamente
      await refresh();

      // Redirigir al dashboard
      router.push("/dashboard");
    } catch (error: any) {
      swalError(error.response?.data?.detail || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <RecaptchaScript />
      <div className="min-h-screen flex items-center justify-center bg-degradado-primario py-10 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-sm sm:max-w-md">
          <form
            className="space-y-6 rounded-lg bg-white p-6 shadow-md sm:p-8"
            onSubmit={handleSubmit}
          >
            {/* ASLIN arriba, DX Legal debajo, dentro del formulario */}
            <div className="flex flex-col items-center justify-center gap-3 sm:gap-4">
              <Image
                src={logoMaslin}
                alt="ASLIN"
                width={400}
                height={103}
                className="h-16 w-auto max-w-[min(100%,300px)] shrink-0 object-contain sm:h-20"
                unoptimized
                priority
              />
              {/* <div className="flex w-full max-w-[min(100%,300px)] justify-center rounded-xl border border-slate-200/90 bg-slate-50 px-6 py-3 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]">
                <Image
                  src={logoDxLegal}
                  alt="DX Legal"
                  width={200}
                  height={185}
                  className="h-[4.25rem] w-auto max-w-full object-contain sm:h-20 md:h-[5.25rem]"
                  unoptimized
                  priority
                />
              </div> */}
            </div>
            <p className="text-center text-sm text-slate-600">
              Inicia sesión en tu cuenta
            </p>

            <div className="space-y-4">
              {!requires2FA && (
                <>
                  <Input
                    label="Usuario o Email"
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="usuario@ejemplo.com"
                    required
                  />

                  <Input
                    label="Contraseña"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    endAdornment={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      >
                        {showPassword ? (
                          <FiEyeOff className="h-5 w-5" aria-hidden />
                        ) : (
                          <FiEye className="h-5 w-5" aria-hidden />
                        )}
                      </button>
                    }
                  />
                </>
              )}

              {requires2FA && (
                <Input
                  label="Código 2FA"
                  type="text"
                  name="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  required
                />
              )}
            </div>

            <Button type="submit" fullWidth variant="primary" loading={loading}>
              {requires2FA ? "Verificar 2FA" : "Iniciar Sesión"}
            </Button>

            {/* <div className="text-center">
              <p className="text-sm">
                ¿No tienes cuenta?{" "}
                <a
                  href="/register"
                  className="font-medium text-azul hover:opacity-90"
                >
                  Regístrate aquí
                </a>
              </p>
            </div> */}
          </form>
        </div>
      </div>
    </>
  );
}
