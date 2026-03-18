"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useUser } from "@/context/UserContext";
import apiService from "@/lib/apiService";

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // base64url -> base64
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getJwtExpEpochSeconds(token: string): number | null {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  return typeof exp === "number" ? exp : null;
}

export default function SessionRenewalModal() {
  const router = useRouter();
  const { refresh, logout } = useUser();

  const [open, setOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [processing, setProcessing] = useState(false);

  const countdownIntervalRef = useRef<number | null>(null);
  const openRef = useRef(false);

  const clearCountdown = () => {
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const startCountdown = useCallback(() => {
    clearCountdown();
    setSecondsLeft(30);

    countdownIntervalRef.current = window.setInterval(() => {
      setSecondsLeft((prev) => {
        const next = prev - 1;
        if (next <= 0) return 0;
        return next;
      });
    }, 1000);
  }, []);

  const handleLogout = useCallback(async () => {
    if (processing) return;
    setProcessing(true);
    try {
      try {
        await apiService.logout();
      } catch {
        // Si falla el endpoint, igual limpiamos sesión local
      }

      logout();
      apiService.resolveSessionRenewal(false);
      setOpen(false);
      openRef.current = false;
      router.push("/login");
    } finally {
      setProcessing(false);
      clearCountdown();
    }
  }, [clearCountdown, logout, processing, router]);

  const openModal = useCallback(() => {
    if (openRef.current) return;
    openRef.current = true;
    setOpen(true);
    startCountdown();
  }, [startCountdown]);

  const handleRenew = useCallback(async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const data = await apiService.refreshSession();
      if (!data?.access_token) {
        throw new Error("No se recibió access_token");
      }
      localStorage.setItem("token", data.access_token);
      await refresh();

      apiService.resolveSessionRenewal(true);
      setOpen(false);
      router.refresh?.();
    } catch {
      // Si falla la renovación, cerramos sesión.
      await handleLogout();
    } finally {
      setProcessing(false);
      clearCountdown();
      openRef.current = false;
    }
  }, [clearCountdown, handleLogout, processing, refresh, router]);

  // Abrir al expirar por proyección del JWT (cuando el usuario entra y espera).
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const exp = getJwtExpEpochSeconds(token);
    if (!exp) return;

    const msUntilExp = exp * 1000 - Date.now();
    const timeoutId = window.setTimeout(() => {
      openModal();
    }, Math.max(0, msUntilExp));

    return () => window.clearTimeout(timeoutId);
  }, [openModal]);

  // Abrir cuando el interceptor detecte 401.
  useEffect(() => {
    const handler = () => openModal();
    window.addEventListener("sessionRenewalNeeded", handler);
    return () => window.removeEventListener("sessionRenewalNeeded", handler);
  }, [openModal]);

  // Timeout del contador
  useEffect(() => {
    if (!open) return;
    if (secondsLeft > 0) return;

    handleLogout();
  }, [handleLogout, open, secondsLeft]);

  // Limpieza de timers al desmontar
  useEffect(() => {
    return () => {
      clearCountdown();
    };
  }, []);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={handleLogout}
      title="Renovar sesión"
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          Tu sesión está por expirar. Confirma que sigues usando el sistema.
        </p>

        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <div className="text-sm text-gray-800">
            Tiempo restante: <span className="font-bold">{secondsLeft}s</span>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="primary"
            className="flex-1"
            loading={processing}
            onClick={handleRenew}
            disabled={processing}
          >
            Renovar sesión
          </Button>
          <Button
            type="button"
            variant="danger"
            className="flex-1"
            loading={processing}
            onClick={handleLogout}
            disabled={processing}
          >
            Cerrar sesión
          </Button>
        </div>
      </div>
    </Modal>
  );
}

