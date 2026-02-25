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
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Empresas</h1>
      <div className="bg-white rounded-lg shadow p-8 text-center">
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

