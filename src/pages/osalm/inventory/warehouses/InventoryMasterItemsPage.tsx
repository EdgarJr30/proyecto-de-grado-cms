import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../../../components/layout/Sidebar';
import { useCan } from '../../../../rbac/PermissionsContext';
import {
  getItemsPaginated,
  getBaseUomCodeByItemIds,
  getTotalCountedBaseQtyByItemIds,
} from '../../../../services/inventoryService';
import type { Item } from '../../../../types/inventory';

type MasterItemCard = {
  id: number;
  sku: string;
  name: string;
  uom: string;
  counted: number;
};

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;

function formatQty(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('es-DO', { maximumFractionDigits: 2 });
}

export default function InventoryMasterItemsPage() {
  const navigate = useNavigate();

  const canSeeMaster = useCan([
    'inventory_adjustments:full_access',
    'inventory_adjustments:read',
  ]);

  const [items, setItems] = useState<Item[]>([]);
  const [count, setCount] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [page, setPage] = useState(0);

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uomByItemId, setUomByItemId] = useState<Map<number, string>>(
    new Map()
  );
  const [countedByItemId, setCountedByItemId] = useState<Map<number, number>>(
    new Map()
  );

  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (!canSeeMaster) {
      navigate('/osalm/conteos_inventario', { replace: true });
    }
  }, [canSeeMaster, navigate]);

  useEffect(() => {
    const raw = searchInput.trim();

    const handle = window.setTimeout(() => {
      if (raw.length === 1) return;
      setPage(0);
      setSearchTerm(raw);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    let isMounted = true;
    const seq = ++requestSeqRef.current;

    async function fetchItems() {
      try {
        setError(null);

        setIsFetching(true);
        if (items.length === 0 && page === 0 && searchTerm === '') {
          setIsInitialLoading(true);
        }

        const res = await getItemsPaginated(page, PAGE_SIZE, searchTerm);

        const ids = res.data.map((x) => x.id);

        const [uomsMap, countedMap] = await Promise.all([
          getBaseUomCodeByItemIds(ids),
          getTotalCountedBaseQtyByItemIds(ids),
        ]);

        const isStale = !isMounted || seq !== requestSeqRef.current;
        if (isStale) return;

        setItems(res.data);
        setCount(res.count);
        setUomByItemId(uomsMap);
        setCountedByItemId(countedMap);
      } catch (err: unknown) {
        const isStale = !isMounted || seq !== requestSeqRef.current;
        if (isStale) return;

        if (err instanceof Error) setError(err.message);
        else setError('Ocurrió un error al cargar los artículos.');
      } finally {
        const isStale = !isMounted || seq !== requestSeqRef.current;
        if (!isStale) {
          setIsInitialLoading(false);
          setIsFetching(false);
        }
      }
    }

    fetchItems();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchTerm]);

  const totalPages = useMemo(() => {
    if (count <= 0) return 1;
    return Math.max(1, Math.ceil(count / PAGE_SIZE));
  }, [count]);

  const showMinCharsHint = useMemo(
    () => searchInput.trim().length === 1,
    [searchInput]
  );

  const headerCountText = useMemo(() => {
    if (isInitialLoading) return 'Cargando…';
    return `${count} artículos`;
  }, [count, isInitialLoading]);

  const cards: MasterItemCard[] = useMemo(
    () =>
      items.map((it) => ({
        id: it.id,
        sku: it.sku,
        name: it.name,
        uom: uomByItemId.get(it.id) ?? '—',
        counted: countedByItemId.get(it.id) ?? 0,
      })),
    [items, uomByItemId, countedByItemId]
  );

  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />

      <main className="flex flex-col flex-1 h-[100dvh] bg-gray-100 overflow-hidden">
        <header className="bg-blue-600 text-white shadow-sm pt-16 sm:pt-6">
          <div className="px-4 sm:px-6 lg:px-10 pb-4 sm:pb-5 max-w-6xl mx-auto w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight break-words">
                Maestra · Artículos
              </h1>

              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm sm:text-base opacity-90">
                  {headerCountText}
                </p>

                {isFetching && !isInitialLoading && (
                  <span className="inline-flex items-center gap-2 text-xs text-blue-100/90">
                    <span className="h-2 w-2 rounded-full bg-blue-100 animate-pulse" />
                    Actualizando…
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 rounded-full bg-white/95 text-blue-700 px-4 py-2 text-xs sm:text-sm font-semibold shadow-sm hover:bg-white transition shrink-0 cursor-pointer"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-base">
                  ←
                </span>
                <span className="whitespace-nowrap">Volver</span>
              </button>
            </div>
          </div>

          <div className="bg-blue-600 pb-4 px-4 sm:px-6 lg:px-10">
            <div className="max-w-6xl mx-auto w-full flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="w-full sm:w-[520px]">
                <div className="bg-white rounded-2xl shadow-sm flex items-center px-4 py-3 text-gray-500 w-full">
                  <span className="mr-3 text-xl">🔍</span>

                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Buscar por SKU, nombre o ID..."
                    className="w-full bg-transparent outline-none text-sm sm:text-base placeholder:text-gray-400"
                    aria-label="Buscar artículos"
                  />

                  {isFetching && (
                    <span
                      className="ml-3 h-4 w-4 rounded-full border-2 border-gray-300 border-t-transparent animate-spin"
                      aria-hidden="true"
                    />
                  )}
                </div>

                {showMinCharsHint && (
                  <p className="mt-2 text-[11px] sm:text-xs text-blue-100/90">
                    Escribe al menos <span className="font-semibold">2</span>{' '}
                    caracteres para buscar.
                  </p>
                )}
              </div>
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 max-w-6xl mx-auto w-full">
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs sm:text-sm text-red-700">
                {error}
              </div>
            )}

            {!isInitialLoading && !error && items.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-6 sm:px-6 sm:py-8 text-center text-sm sm:text-base text-gray-500">
                No se encontraron artículos con “{searchTerm || searchInput}”.
              </div>
            )}

            <div className="flex flex-col gap-3 sm:gap-4 pb-20">
              {isInitialLoading &&
                Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="animate-pulse w-full bg-white rounded-2xl shadow-sm px-4 py-4 sm:px-6 sm:py-5 flex items-center justify-between gap-4"
                  >
                    <div className="flex flex-col gap-2 w-2/3">
                      <div className="h-4 w-3/4 rounded bg-gray-200" />
                      <div className="h-3 w-1/2 rounded bg-gray-200" />
                    </div>
                    <div className="flex flex-col items-end gap-2 w-1/4">
                      <div className="h-6 w-12 rounded bg-gray-200" />
                      <div className="h-3 w-10 rounded bg-gray-200" />
                    </div>
                  </div>
                ))}

              {!isInitialLoading &&
                !error &&
                cards.map((it) => (
                  <MasterItemCardRow
                    key={it.id}
                    item={it}
                    onOpen={() => {
                      navigate(
                        `/osalm/conteos_inventario/maestra/articulos/${it.id}/conteo`,
                        {
                          state: {
                            item: {
                              id: String(it.id),
                              sku: it.sku,
                              name: it.name,
                            },
                          },
                        }
                      );
                    }}
                  />
                ))}
            </div>

            {!isInitialLoading && !error && count > 0 && (
              <div className="flex items-center justify-between mt-4">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page <= 0 || isFetching}
                  className="rounded-full bg-white border border-gray-200 px-4 py-2 text-xs sm:text-sm font-semibold text-gray-700 disabled:opacity-50 cursor-pointer"
                >
                  ← Anterior
                </button>

                <span className="text-xs sm:text-sm text-gray-600">
                  Página {page + 1} de {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={page >= totalPages - 1 || isFetching}
                  className="rounded-full bg-white border border-gray-200 px-4 py-2 text-xs sm:text-sm font-semibold text-gray-700 disabled:opacity-50 cursor-pointer"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function MasterItemCardRow({
  item,
  onOpen,
}: {
  item: MasterItemCard;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left bg-white rounded-2xl shadow-sm px-4 py-4 sm:px-6 sm:py-5 flex items-center justify-between gap-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900">
          {item.name}
        </h2>
        <p className="text-xs sm:text-sm text-gray-500 tracking-wide">
          <span className="font-medium">{item.sku}</span>
          <span className="text-gray-300 mx-2">•</span>
          ID: {item.id}
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex flex-col items-end leading-tight">
          <span className="text-2xl sm:text-3xl font-bold text-gray-900">
            {formatQty(item.counted)}
          </span>
          <span className="text-[11px] sm:text-xs text-gray-400 uppercase">
            {item.uom}
          </span>
          <span className="text-[10px] sm:text-[11px] text-gray-400">
            Total contado
          </span>
        </div>

        <span
          className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-400 text-lg"
          aria-hidden="true"
        >
          ›
        </span>
      </div>
    </button>
  );
}
