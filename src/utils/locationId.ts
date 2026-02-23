export type LocationIdLike = number | string | bigint | null | undefined;

/**
 * Normaliza IDs de ubicación (bigint/int) para uso consistente en UI.
 * Acepta string numérico, number o bigint y devuelve number seguro.
 */
export function normalizeLocationId(value: LocationIdLike): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value;
  }

  if (typeof value === 'bigint') {
    if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
