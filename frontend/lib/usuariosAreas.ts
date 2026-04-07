function normalizeId(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

export function getUsuarioAreaIds(usuario: any): string[] {
  const areas = Array.isArray(usuario?.areas) ? usuario.areas : [];
  return areas
    .map((area: any) => normalizeId(area?.id))
    .filter(Boolean);
}

export function usuarioComparteAlgunaArea(
  usuario: any,
  areaIds: string[],
): boolean {
  const normalizedAreaIds = areaIds.map(normalizeId).filter(Boolean);
  if (normalizedAreaIds.length === 0) return false;

  const usuarioAreaIds = getUsuarioAreaIds(usuario);
  if (usuarioAreaIds.length === 0) return false;

  const allowedAreaIds = new Set(normalizedAreaIds);
  return usuarioAreaIds.some((areaId) => allowedAreaIds.has(areaId));
}

export function filtrarAbogadosPorAreas(
  usuarios: any[],
  areaIds: string[],
): any[] {
  const normalizedAreaIds = areaIds.map(normalizeId).filter(Boolean);
  if (normalizedAreaIds.length === 0) return [];

  return (usuarios || []).filter(
    (usuario) => usuarioComparteAlgunaArea(usuario, normalizedAreaIds),
  );
}
