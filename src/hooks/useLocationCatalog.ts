import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listLocations } from '../services/locationService';
import type { Location } from '../types/Location';
import { onDataInvalidated } from '../lib/dataInvalidation';
import { normalizeLocationId, type LocationIdLike } from '../utils/locationId';

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
  const aliveRef = useRef(true);

  useEffect(
    () => () => {
      aliveRef.current = false;
    },
    []
  );

  const loadLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listLocations({ includeInactive });
      if (!aliveRef.current) return;
      setLocations(rows);
    } catch (err: unknown) {
      if (!aliveRef.current) return;
      const message =
        err instanceof Error ? err.message : 'Error cargando ubicaciones';
      setError(message);
      setLocations([]);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    return onDataInvalidated('locations', () => {
      void loadLocations();
    });
  }, [loadLocations]);

  const locationNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const location of locations) {
      const locationId = normalizeLocationId(location.id);
      if (locationId != null) {
        map.set(locationId, location.name);
      }
    }
    return map;
  }, [locations]);

  const filterOptions = useMemo<LocationFilterOption[]>(
    () =>
      locations
        .filter((location) => (activeOnlyOptions ? location.is_active : true))
        .map((location) => {
          const locationId = normalizeLocationId(location.id);
          if (locationId == null) return null;
          return {
            label: location.name,
            value: String(locationId),
          };
        })
        .filter((option): option is LocationFilterOption => option != null),
    [activeOnlyOptions, locations]
  );

  const getLocationLabel = useCallback(
    (locationId: LocationIdLike, fallback = '—') => {
      const normalizedId = normalizeLocationId(locationId);
      if (normalizedId == null) return fallback;
      return locationNameById.get(normalizedId) ?? fallback;
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
