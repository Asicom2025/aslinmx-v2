/**
 * Página de Empresas
 * Gestiona las empresas del sistema
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

export default function EmpresasPage() {
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
      <h1 className="mb-4 text-fluid-2xl font-bold text-gray-900 sm:mb-6 sm:text-3xl">Empresas</h1>
      <div className="rounded-lg bg-white p-4 text-center shadow sm:p-6 md:p-8">
        <p className="text-gray-600 mb-4">Gestión de Empresas</p>
        <p className="text-sm text-gray-500">
          Los endpoints de empresas aún no están implementados en el backend.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Esta funcionalidad estará disponible próximamente.
        </p>
      </div>
    </div>
  );
}

