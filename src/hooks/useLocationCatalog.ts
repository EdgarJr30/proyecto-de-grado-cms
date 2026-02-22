import { useCallback, useEffect, useMemo, useState } from 'react';
import { listLocations } from '../services/locationService';
import type { Location } from '../types/Location';

export type LocationFilterOption = {
  label: string;
  value: string;
};

type UseLocationCatalogArgs = {
  includeInactive?: boolean;
  activeOnlyOptions?: boolean;
};

export function useLocationCatalog(args: UseLocationCatalogArgs = {}) {
  const { includeInactive = true, activeOnlyOptions = true } = args;

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await listLocations({ includeInactive });
        if (cancelled) return;
        setLocations(rows);
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Error cargando ubicaciones';
        setError(message);
        setLocations([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [includeInactive]);

  const locationNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const location of locations) {
      map.set(location.id, location.name);
    }
    return map;
  }, [locations]);

  const filterOptions = useMemo<LocationFilterOption[]>(
    () =>
      locations
        .filter((location) => (activeOnlyOptions ? location.is_active : true))
        .map((location) => ({
          label: location.name,
          value: String(location.id),
        })),
    [activeOnlyOptions, locations]
  );

  const getLocationLabel = useCallback(
    (locationId: number | null | undefined, fallback = '—') => {
      if (typeof locationId !== 'number') return fallback;
      return locationNameById.get(locationId) ?? `Ubicación #${locationId}`;
    },
    [locationNameById]
  );

  return {
    locations,
    loading,
    error,
    filterOptions,
    locationNameById,
    getLocationLabel,
  };
}
