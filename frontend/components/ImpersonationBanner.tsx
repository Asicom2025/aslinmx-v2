"use client";

import { useUser } from "@/context/UserContext";

/**
 * Aviso cuando la sesión es por impersonación (JWT con claim imp).
 */
export default function ImpersonationBanner() {
  const { user, exitImpersonation } = useUser();
  const actor = user?.impersonated_by;
  if (!actor?.id) return null;

  return (
    <div
      className="sticky top-16 z-40 flex flex-wrap items-center justify-center gap-3 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-950"
      role="status"
    >
      <span>
        Está navegando como otro usuario. Sesión real:{" "}
        <strong>{actor.email || actor.id}</strong>
      </span>
      <button
        type="button"
        onClick={() => exitImpersonation()}
        className="rounded bg-amber-800 px-3 py-1 text-white hover:bg-amber-900"
      >
        Volver a mi sesión
      </button>
    </div>
  );
}
