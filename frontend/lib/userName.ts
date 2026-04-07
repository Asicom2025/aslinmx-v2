type NameParts = {
  nombre?: string | null;
  apellido_paterno?: string | null;
  apellido_materno?: string | null;
};

type UserLike = NameParts & {
  full_name?: string | null;
  email?: string | null;
  correo?: string | null;
  username?: string | null;
  perfil?: NameParts | null;
};

function cleanPart(value?: string | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export function buildPersonFullName(parts?: NameParts | null): string {
  if (!parts) return "";
  return [
    cleanPart(parts.nombre),
    cleanPart(parts.apellido_paterno),
    cleanPart(parts.apellido_materno),
  ]
    .filter(Boolean)
    .join(" ");
}

export function getUserNameParts(user?: UserLike | null): Required<NameParts> {
  const perfil = user?.perfil ?? null;
  return {
    nombre: cleanPart(perfil?.nombre ?? user?.nombre),
    apellido_paterno: cleanPart(perfil?.apellido_paterno ?? user?.apellido_paterno),
    apellido_materno: cleanPart(perfil?.apellido_materno ?? user?.apellido_materno),
  };
}

export function getUserDisplayName(user?: UserLike | null, fallback = ""): string {
  const fromParts = buildPersonFullName(getUserNameParts(user));
  return (
    fromParts ||
    cleanPart(user?.full_name) ||
    cleanPart(user?.email) ||
    cleanPart(user?.correo) ||
    cleanPart(user?.username) ||
    fallback
  );
}

export function getUserInitial(user?: UserLike | null, fallback = "?"): string {
  const displayName = getUserDisplayName(user, fallback);
  return displayName.charAt(0).toUpperCase() || fallback;
}
