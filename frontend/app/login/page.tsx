/**
 * Página de Login
 * Permite autenticación de usuarios
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { swalSuccess, swalError, swalInfo } from "@/lib/swal";
import apiService from "@/lib/apiService";
import { getRecaptchaToken, isRecaptchaAvailable, diagnoseRecaptcha } from "@/lib/recaptcha";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useUser } from "@/context/UserContext";

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
        await swalSuccess("¡Inicio de sesión exitoso!");
        router.push("/dashboard");
        return;
      }

      // Paso 1: login - Obtener token de reCAPTCHA
      let recaptchaToken: string | null = null;
      if (isRecaptchaAvailable()) {
        recaptchaToken = await getRecaptchaToken("login");
        if (!recaptchaToken) {
          swalError("Error al verificar reCAPTCHA. Por favor, recarga la página e intenta nuevamente.");
          setLoading(false);
          return;
        }
      }

      // Paso 1: login
      const response = await apiService.login(
        formData.username,
        formData.password,
        recaptchaToken || undefined
      );

      if (response.requires_2fa) {
        setRequires2FA(true);
        setTempToken(response.temp_token);
        await swalInfo("Ingresa tu código 2FA");
        return;
      }

      // Guardar token en localStorage
      localStorage.setItem("token", response.access_token);

      // Hidratar datos del usuario inmediatamente
      await refresh();
      await swalSuccess("¡Inicio de sesión exitoso!");

      // Redirigir al dashboard
      router.push("/dashboard");
    } catch (error: any) {
      swalError(error.response?.data?.detail || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-degradado-primario py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Aslin 2.0
          </h2>
          <p className="mt-2 text-center text-sm text-white/80">
            Inicia sesión en tu cuenta
          </p>
        </div>

        <form
          className="mt-8 space-y-6 bg-white p-8 rounded-lg shadow-md"
          onSubmit={handleSubmit}
        >
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
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
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

          <div className="text-center">
            <p className="text-sm">
              ¿No tienes cuenta?{" "}
              <a
                href="/register"
                className="text-azul hover:opacity-90 font-medium"
              >
                Regístrate aquí
              </a>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
