// src/components/ui/filters/FilterBar.tsx
import { useEffect, useMemo, useState } from 'react';
import type {
  FilterSchema,
  FilterField,
  FilterValue,
} from '../../../types/filters';
import { useFilters } from '../../../hooks/useFilters';
import GlobalSearch from '../../common/GlobalSearch';
import { DateRangePreset } from './DateRangePreset';
import ExportTicketsCsvAdapter from './ExportTicketsCsvAdapter';

/* ============ helpers de UI ============ */
const control =
  'h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const pillBtn =
  'inline-flex items-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50';
const primaryBtn =
  'inline-flex items-center rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500';
const chipCls =
  'inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700';
const toolbar =
  'rounded-2xl border border-gray-200 bg-white p-3 md:p-4 shadow-sm';

/* ============ vistas guardadas (localStorage) ============ */
type SavedView<T extends string> = {
  id: string;
  name: string;
  values: Record<T, unknown>;
};
function loadViews<T extends string>(schemaId: string): SavedView<T>[] {
  try {
    const raw = localStorage.getItem(`filters:views:${schemaId}`);
    return raw ? (JSON.parse(raw) as SavedView<T>[]) : [];
  } catch {
    return [];
  }
}
function saveViews<T extends string>(schemaId: string, views: SavedView<T>[]) {
  localStorage.setItem(`filters:views:${schemaId}`, JSON.stringify(views));
}

/* ============ componentes atómicos ============ */
function SearchInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder?: string;
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative w-full">
      <svg
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M12.9 14.32a8 8 0 111.414-1.414l4.387 4.387a1 1 0 01-1.414 1.414l-4.387-4.387zM14 8a6 6 0 11-12 0 6 6 0 0112 0z"
          clipRule="evenodd"
        />
      </svg>
      <input
        type="search"
        className={`${control} pl-10`}
        placeholder={placeholder ?? 'Buscar…'}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Select({
  value,
  onChange,
  placeholder,
  options,
}: {
  value?: string | number;
  onChange: (v: string | number | undefined) => void;
  placeholder?: string;
  options: { label: string; value: string | number }[];
}) {
  return (
    <div className="relative">
      <select
        className={`${control} appearance-none pr-8`}
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">{placeholder ?? 'Seleccionar…'}</option>
        {options.map((op) => (
          <option key={String(op.value)} value={String(op.value)}>
            {op.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
      >
        <path d="M5.25 7.5L10 12.25 14.75 7.5H5.25z" />
      </svg>
    </div>
  );
}

/* ============ renderizador de campos del schema ============ */
function FieldRenderer<T extends string>({
  f,
  value,
  onChange,
  onSearchImmediate,
}: {
  f: FilterField<T>;
  value: unknown;
  onChange: (v: unknown) => void;
  onSearchImmediate?: (nextValue: unknown) => void;
}) {
  if (f.type === 'text') {
    if ((f.key as string) === 'q') {
      const min =
        'minChars' in f &&
        typeof (f as { minChars: number }).minChars === 'number'
          ? (f as { minChars: number }).minChars
          : 2;
      return (
        <GlobalSearch
          placeholder={f.placeholder ?? 'Buscar…'}
          value={(value as string) ?? ''}
          minChars={min}
          delay={500}
          onSearch={(term) => {
            onChange(term);
            onSearchImmediate?.(term);
          }}
        />
      );
    }
    return (
      <SearchInput
        placeholder={f.placeholder ?? 'Buscar…'}
        value={(value as string) ?? ''}
        onChange={(v) => {
          onChange(v);
          if (f.immediate) onSearchImmediate?.(v);
        }}
      />
    );
  }

  if (f.type === 'select') {
    return (
      <Select
        value={(value as string) ?? ''}
        onChange={(v) => {
          onChange(v);
          if (f.immediate) onSearchImmediate?.(v);
        }}
        placeholder={f.label}
        options={f.options}
      />
    );
  }

  if (f.type === 'multiselect') {
    const arr = (Array.isArray(value) ? value : []) as (string | number)[];
    const toggle = (v: string | number) => {
      const next = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
      onChange(next);
      if (f.immediate) onSearchImmediate?.(next);
    };
    return (
      <div className="flex flex-wrap gap-1">
        {f.options.map((op) => (
          <button
            key={String(op.value)}
            type="button"
            className={`rounded-xl border px-3 py-1.5 text-xs ${
              arr.includes(op.value)
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
            onClick={() => toggle(op.value)}
          >
            {op.label}
          </button>
        ))}
      </div>
    );
  }

  if (f.type === 'boolean') {
    return (
      <label className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 shadow-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
          checked={Boolean(value)}
          onChange={(e) => {
            onChange(e.target.checked);
            if (f.immediate) onSearchImmediate?.(e.target.checked);
          }}
        />
        {f.label}
      </label>
    );
  }

  if (f.type === 'daterange') {
    const v = (value ?? {}) as { from?: string; to?: string };
    const fire = (next: { from?: string; to?: string }) => {
      onChange(next);
      if (f.immediate) onSearchImmediate?.(next);
    };
    return (
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={v.from ?? ''}
          onChange={(e) => fire({ ...v, from: e.target.value || undefined })}
          className={control}
        />
        <span className="text-gray-400">—</span>
        <input
          type="date"
          value={v.to ?? ''}
          onChange={(e) => fire({ ...v, to: e.target.value || undefined })}
          className={control}
        />
      </div>
    );
  }

  return null;
}

/* ============ barra de filtros ============ */
type Props<T extends string> = {
  schema: FilterSchema<T>;
  onApply?: (values: Record<T, unknown>) => void;
  sticky?: boolean;
  exportMerge?: Record<string, unknown>;
  baseFilename?: string;
};

export default function FilterBar<T extends string>({
  schema,
  onApply,
  sticky,
  exportMerge,
  baseFilename,
}: Props<T>) {
  const { values, setValue, reset, activeCount } = useFilters(schema);

  // ✅ Un solo estado para móvil y desktop:
  // - Móvil: inicia cerrado
  // - Desktop (md+): inicia abierto (pero puede ocultarse)
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.('(min-width: 768px)');
    const initOpen = !!mq?.matches;
    setIsOpen(initOpen);
    const handler = (e: MediaQueryListEvent) => setIsOpen(e.matches || false);
    mq?.addEventListener?.('change', handler);
    return () => mq?.removeEventListener?.('change', handler);
  }, []);

  // Drawer (más filtros en móvil)
  const [openDrawer, setOpenDrawer] = useState(false);

  // Vistas guardadas
  const [views, setViews] = useState<SavedView<T>[]>(() =>
    loadViews<T>(schema.id)
  );

  const apply = () => onApply?.(values as Record<T, unknown>);

  // Separar campos por ubicación (bar vs drawer)
  const [barFields, drawerFields] = useMemo(() => {
    const bar: FilterField<T>[] = [];
    const drawer: FilterField<T>[] = [];
    schema.fields.forEach((field) => {
      if (field.hidden) return;
      if (field.responsive === 'bar') bar.push(field);
      else if (field.responsive === 'drawer') drawer.push(field);
      else {
        bar.push(field);
        drawer.push(field);
      }
    });
    return [bar, drawer];
  }, [schema.fields]);

  // presets de fecha si existe un campo 'daterange'
  const dateField = schema.fields.find((f) => f.type === 'daterange');

  function askAndSaveView() {
    const name = prompt('Nombre de la vista:');
    if (!name) return;
    const v: SavedView<T> = {
      id: crypto.randomUUID(),
      name,
      values: values as Record<T, unknown>,
    };
    const next = [...views, v];
    setViews(next);
    saveViews(schema.id, next);
  }
  function applyView(v: SavedView<T>) {
    onApply?.(v.values);
  }
  function removeView(id: string) {
    const next = views.filter((v) => v.id !== id);
    setViews(next);
    saveViews(schema.id, next);
  }

  return (
    <div className={`${sticky ? 'sticky top-0 z-10' : ''}`}>
      <div className={toolbar}>
        {/* ===== Encabezado con toggle en móvil y desktop ===== */}
        {/* ===== Encabezado ===== */}
        <div className="mb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpen((s) => !s)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50"
            aria-expanded={isOpen}
            aria-controls="filters-content"
            title={isOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
          >
            <svg
              className={`h-4 w-4 transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
            >
              <path d="M5.25 7.5L10 12.25 14.75 7.5H5.25z" />
            </svg>
            {isOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
            <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
              {activeCount}
            </span>
          </button>

          {/* 👉 Header limpio: solo Aplicar a la derecha */}
          <div className="ml-auto flex items-center gap-2">
            {/* Botón CSV, desacoplado de la lógica interna */}
            <ExportTicketsCsvAdapter
              filters={values as Record<T, unknown>}
              exportMerge={exportMerge}
              pillBtnClassName={pillBtn}
              baseFilename={baseFilename ?? schema.id}
            />
            <button
              type="button"
              onClick={apply}
              className={primaryBtn}
              title="Aplicar filtros"
            >
              Aplicar
            </button>
          </div>
        </div>

        {/* ===== Contenido completo: controlado por isOpen en todos los breakpoints ===== */}
        {isOpen && (
          <div id="filters-content">
            {/* fila principal */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              {barFields.slice(0, 4).map((f: FilterField<T>) => (
                <div key={f.key}>
                  <FieldRenderer
                    f={f}
                    value={(values as Record<T, unknown>)[f.key]}
                    onChange={(v) =>
                      setValue(f.key, v as FilterValue | undefined)
                    }
                    onSearchImmediate={(nextValue) => {
                      if (!onApply) return;
                      const merged = {
                        ...(values as Record<T, unknown>),
                        [f.key]: nextValue,
                      } as Record<T, unknown>;
                      onApply(merged);
                    }}
                  />
                </div>
              ))}
            </div>

            {/* fila secundaria: presets + acciones */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* presets de fecha */}
              {dateField && (
                <DateRangePreset
                  labelText="Últimos 30 días"
                  value={
                    (values as Record<T, unknown>)[dateField.key as T] as
                      | { from?: string; to?: string }
                      | undefined
                  }
                  pillBtnCls={pillBtn}
                  onPick={(nextRange) => {
                    setValue(dateField.key as T, nextRange as FilterValue);
                    if (onApply) {
                      onApply({
                        ...(values as Record<T, unknown>),
                        [dateField.key as T]: nextRange,
                      } as Record<T, unknown>);
                    }
                  }}
                />
              )}

              {/* botón para abrir drawer (más filtros) */}
              {drawerFields.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOpenDrawer(true)}
                  className={pillBtn}
                >
                  Más filtros ({activeCount})
                </button>
              )}

              {/* En móvil, mostramos Reset/Guardar aquí cuando está abierto */}
              {/* Acciones dentro del panel expandido */}
              <button
                type="button"
                onClick={reset}
                className={pillBtn} // ⬅️ quitamos 'md:hidden'
              >
                Reset
              </button>
              <button
                type="button"
                onClick={askAndSaveView}
                className={pillBtn} // ⬅️ quitamos 'md:hidden'
              >
                Guardar Vista
              </button>
            </div>

            {/* chips activos */}
            <div className="mt-3 flex flex-wrap gap-2">
              {schema.fields.map((f: FilterField<T>) => {
                if (f.hidden) return null;
                const v = (values as Record<T, unknown>)[f.key];
                const empty =
                  v === undefined ||
                  v === null ||
                  v === '' ||
                  (Array.isArray(v) && v.length === 0) ||
                  (typeof v === 'object' &&
                    v !== null &&
                    !('from' in v) &&
                    !('to' in v));
                if (empty) return null;

                let text = '';
                if (f.type === 'multiselect')
                  text = `${f.label}: ${(v as unknown[]).join(', ')}`;
                else if (f.type === 'daterange') {
                  const { from = '—', to = '—' } =
                    (v as { from?: string; to?: string }) ?? {};
                  text = `${f.label}: ${from} → ${to}`;
                } else if (f.type === 'boolean')
                  text = `${f.label}: ${v ? 'Sí' : 'No'}`;
                else text = `${f.label}: ${v}`;

                return (
                  <span key={f.key} className={chipCls}>
                    {text}
                    <button
                      onClick={() => setValue(f.key as T, undefined)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
            </div>

            {/* vistas guardadas (pills) */}
            {views.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-600">Vistas:</span>
                {views.map((v) => (
                  <span key={v.id} className={chipCls}>
                    <button
                      className="font-medium"
                      onClick={() => applyView(v)}
                    >
                      {v.name}
                    </button>
                    <button
                      className="text-gray-500 hover:text-gray-700"
                      title="Eliminar vista"
                      onClick={() => removeView(v.id)}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== Drawer móvil ===== */}
        {openDrawer && (
          <div
            className="fixed inset-0 z-50 md:hidden"
            onClick={() => setOpenDrawer(false)}
          >
            <div className="absolute inset-0 bg-black/30" />
            <div
              className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto max-w-xl">
                <div className="mb-3 h-1 w-10 rounded bg-gray-300 mx-auto" />
                <h3 className="text-base font-semibold mb-3">Filtros</h3>
                <div className="grid grid-cols-1 gap-3">
                  {schema.fields
                    .filter(
                      (f: FilterField<T>) =>
                        !f.hidden &&
                        (f.responsive === 'drawer' || f.responsive === 'both')
                    )
                    .map((f: FilterField<T>) => (
                      <div key={f.key}>
                        <div className="mb-1 text-xs font-medium text-gray-600">
                          {f.label}
                        </div>
                        <FieldRenderer
                          f={f}
                          value={(values as Record<T, unknown>)[f.key]}
                          onChange={(v) =>
                            setValue(f.key, v as FilterValue | undefined)
                          }
                          onSearchImmediate={(nextValue) => {
                            if (!onApply) return;
                            const merged = {
                              ...(values as Record<T, unknown>),
                              [f.key]: nextValue,
                            } as Record<T, unknown>;
                            onApply(merged);
                          }}
                        />
                      </div>
                    ))}
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button className={pillBtn} onClick={reset}>
                    Limpiar
                  </button>
                  <button
                    className={primaryBtn}
                    onClick={() => {
                      setOpenDrawer(false);
                      apply();
                    }}
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
