/**
 * Página de Ayuda y Soporte
 * Documentación y soporte técnico
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

export default function SoportePage() {
  const router = useRouter();
  const { user, loading } = useUser();

  useEffect(() => {
    if (loading) return;
    const token = localStorage.getItem("token");
    if (!token || !user) {
      router.push("/login");
      return;
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-app w-full py-4 sm:py-6">
      <h1 className="mb-4 text-fluid-2xl font-bold text-gray-900 sm:mb-6 sm:text-3xl">
        Ayuda y Soporte
      </h1>
      <div className="rounded-lg bg-white p-4 shadow sm:p-6 md:p-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Documentación</h2>
            <p className="text-gray-600">
              Consulta la documentación completa del sistema para aprender a usar todas las funcionalidades.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-4">Contacto</h2>
            <p className="text-gray-600">
              Para soporte técnico, contacta al equipo de desarrollo.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-4">Versión</h2>
            <p className="text-gray-600">
              Aslin 2.0.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

