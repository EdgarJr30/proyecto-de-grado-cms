import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  FilterSchema,
  FilterState,
  FilterField,
  FilterValue,
} from '../types/filters';

function getWindowLocation() {
  if (typeof window === 'undefined') return null;
  return window.location;
}

function parseFromURL<T extends string>(
  fields: FilterField<T>[]
): FilterState<T> {
  const loc = getWindowLocation();
  const params = new URLSearchParams(loc?.search ?? '');
  const state: FilterState<T> = {};

  for (const f of fields) {
    if (f.hidden) continue;

    const raw = params.get(String(f.key));
    if (!raw) continue;

    if (f.type === 'multiselect') state[f.key] = raw.split(',').filter(Boolean);
    else if (f.type === 'boolean') state[f.key] = raw === 'true';
    else if (f.type === 'daterange') {
      const [from, to] = raw.split('|');
      state[f.key] = { from: from || undefined, to: to || undefined };
    } else state[f.key] = raw;
  }

  return state;
}

function writeToURL<T extends string>(
  fields: FilterField<T>[],
  values: FilterState<T>
) {
  const loc = getWindowLocation();
  if (!loc) return; // SSR / tests

  const params = new URLSearchParams(loc.search);

  for (const f of fields) {
    const key = String(f.key);

    if (f.hidden) {
      params.delete(key);
      continue;
    }

    const v = values[f.key];
    const empty =
      v === undefined ||
      v === null ||
      v === '' ||
      (Array.isArray(v) && v.length === 0);

    if (empty) {
      params.delete(key);
      continue;
    }

    if (f.type === 'multiselect' && Array.isArray(v)) {
      params.set(key, v.join(','));
    } else if (f.type === 'boolean' && typeof v === 'boolean') {
      params.set(key, String(v));
    } else if (f.type === 'daterange' && typeof v === 'object' && v) {
      const { from = '', to = '' } = v as { from?: string; to?: string };
      params.set(key, `${from}|${to}`);
    } else {
      params.set(key, String(v));
    }
  }

  const qs = params.toString();
  const newUrl = `${loc.pathname}${qs ? `?${qs}` : ''}${loc.hash ?? ''}`;
  window.history.replaceState(null, '', newUrl);
}

function stableString(v: unknown) {
  try {
    return JSON.stringify(v);
  } catch {
    return '';
  }
}

export function useFilters<T extends string>(schema: FilterSchema<T>) {
  const defaults: FilterState<T> = useMemo(() => {
    const out: FilterState<T> = {};
    for (const f of schema.fields) {
      if (f.defaultValue !== undefined) out[f.key] = f.defaultValue;
    }
    return out;
  }, [schema.fields]);

  const [values, setValues] = useState<FilterState<T>>(() => ({
    ...defaults,
    ...parseFromURL(schema.fields),
  }));

  // Clave estable para comparar cambios reales
  const valuesKey = useMemo(() => stableString(values), [values]);

  // Sincroniza URL solo si cambió realmente
  const prevSyncKeyRef = useRef<string>('');
  useEffect(() => {
    if (prevSyncKeyRef.current === valuesKey) return;
    prevSyncKeyRef.current = valuesKey;
    writeToURL(schema.fields, values);
  }, [schema.fields, valuesKey, values]);

  const setValue = <K extends T>(key: K, v: FilterValue | undefined) => {
    setValues((prev) => {
      const prevVal = prev[key];
      const same =
        (Array.isArray(prevVal) &&
          Array.isArray(v) &&
          stableString(prevVal) === stableString(v)) ||
        prevVal === v;

      if (same) return prev;
      return { ...prev, [key]: v };
    });
  };

  const reset = () => setValues(defaults);

  const activeCount = useMemo(() => {
    return schema.fields.reduce((acc, f) => {
      const v = values[f.key];
      const isActive =
        v !== undefined &&
        v !== null &&
        v !== '' &&
        (!Array.isArray(v) || v.length > 0) &&
        (typeof v !== 'object' ||
          (v && typeof v === 'object' && ('from' in v || 'to' in v)));
      return acc + (isActive ? 1 : 0);
    }, 0);
  }, [schema.fields, valuesKey]); // 👈 depende del hash, no del objeto vivo

  return { values, setValue, reset, activeCount };
}
