import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Sidebar from '../../../../components/layout/Sidebar';
import { useCan } from '../../../../rbac/PermissionsContext';
import {
  getInventoryAuditById,
  saveWarehouseAuditChanges,
  type AuditStatus,
  type ItemStatus,
  type AuditItem,
  type WarehouseInfo,
} from '../../../../services/inventoryCountsService';
import type { PendingReasonCode } from '../../../../types/inventory';
import { InventoryAuditExportButton } from './InventoryAuditExportButton';
import { showToastError, showToastSuccess } from '../../../../notifications';

type FilterTab = 'all' | ItemStatus;

const PAGE_SIZE = 50;

// Helper seguro para extraer mensajes de error
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const anyErr = err as {
      message?: string;
      error_description?: string;
      error?: string;
      code?: string;
    };
    return (
      anyErr.message ??
      anyErr.error_description ??
      anyErr.error ??
      anyErr.code ??
      'Ocurrió un error'
    );
  }
  return 'Ocurrió un error';
}

// Debounce simple (sin librerías) para evitar re-render “por tecla”.
function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}

// Normaliza para búsqueda: minúsculas, elimina acentos, trim
function normalizeForSearch(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export default function InventoryWarehouseAuditReviewPage() {
  const navigate = useNavigate();
  const { inventoryCountId } = useParams<{ inventoryCountId: string }>();

  // Solo auditores ven esta pantalla
  const canManageAudit = useCan([
    'inventory_adjustments:full_access',
    'inventory_adjustments:read',
  ]);

  const [warehouse, setWarehouse] = useState<WarehouseInfo | null>(null);
  const [auditStatus, setAuditStatus] = useState<AuditStatus>('in_progress');
  const [items, setItems] = useState<AuditItem[]>([]);
  const [inventoryCountIdState, setInventoryCountIdState] = useState<
    number | null
  >(null);
  const [isClosedFromDb, setIsClosedFromDb] = useState(false);

  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [currentPage, setCurrentPage] = useState(0);

  // Buscador
  const [searchText, setSearchText] = useState('');
  const debouncedSearchText = useDebouncedValue(searchText, 250);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const location = useLocation();

  const isReadOnly = isClosedFromDb;

  // Carga de datos inicial
  useEffect(() => {
    if (!canManageAudit) {
      setLoading(false);
      showToastError(
        'No tienes permisos para administrar las auditorías de almacenes.'
      );
      return;
    }

    let isMounted = true;

    async function load() {
      if (!inventoryCountId) {
        const msg = 'No se encontró el id de la jornada en la URL.';
        setError(msg);
        showToastError(msg);
        setLoading(false);
        return;
      }

      const numericId = Number(inventoryCountId);
      if (Number.isNaN(numericId)) {
        const msg = 'El id de la jornada no es válido.';
        setError(msg);
        showToastError(msg);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await getInventoryAuditById(numericId);

        if (!isMounted) return;

        setWarehouse(data.warehouse);
        setAuditStatus(data.auditStatus);
        setItems(data.items);
        setInventoryCountIdState(data.inventoryCountId);
        setIsClosedFromDb(data.auditStatus === 'completed');
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = extractErrorMessage(err);
        setError(msg);
        showToastError(`Error cargando la auditoría del almacén: ${msg}`);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [canManageAudit, inventoryCountId]);

  // Reset página cuando cambia el filtro o cambia la búsqueda (debounced)
  useEffect(() => {
    setCurrentPage(0);
  }, [activeFilter, debouncedSearchText]);

  // Stats (universo completo)
  const stats = useMemo(
    () => ({
      total: items.length,
      pending: items.filter((i) => i.status === 'pending').length,
      counted: items.filter((i) => i.status === 'counted').length,
      recount: items.filter((i) => i.status === 'recount').length,
    }),
    [items]
  );

  // filtro + búsqueda (case-insensitive, sin acentos)
  const filteredItems = useMemo(() => {
    const byTab =
      activeFilter === 'all'
        ? items
        : items.filter((item) => item.status === activeFilter);

    const q = normalizeForSearch(debouncedSearchText);
    if (q.length < 2) return byTab;

    return byTab.filter((item) => {
      const haystack = normalizeForSearch(
        [
          item.sku,
          item.name,
          item.uom,
          item.countedBy?.name ?? '',
          item.countedBy?.email ?? '',
          item.comment ?? '',
        ].join(' ')
      );

      return haystack.includes(q);
    });
  }, [items, activeFilter, debouncedSearchText]);

  // Paginación
  const totalItemsForFilter = filteredItems.length;
  const totalPages =
    totalItemsForFilter === 0 ? 1 : Math.ceil(totalItemsForFilter / PAGE_SIZE);

  const paginatedItems = useMemo(() => {
    const safePage =
      currentPage >= totalPages ? totalPages - 1 : Math.max(currentPage, 0);
    const from = safePage * PAGE_SIZE;
    const to = from + PAGE_SIZE;
    return filteredItems.slice(from, to);
  }, [filteredItems, currentPage, totalPages]);

  const currentRange = useMemo(() => {
    if (totalItemsForFilter === 0) return { from: 0, to: 0 };
    const from = currentPage * PAGE_SIZE + 1;
    const to = Math.min((currentPage + 1) * PAGE_SIZE, totalItemsForFilter);
    return { from, to };
  }, [currentPage, totalItemsForFilter]);

  // Cambiar estado de la auditoría
  const handleChangeAuditStatus = useCallback(
    (nextStatus: AuditStatus) => {
      if (isReadOnly) return;
      setAuditStatus(nextStatus);

      if (nextStatus === 'completed') {
        showToastSuccess(
          'La auditoría se ha marcado como Completada. Guarda para cerrar el conteo.'
        );
      }
    },
    [isReadOnly]
  );

  const handleChangeItemStatus = useCallback(
    (id: number, status: ItemStatus) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status } : item))
      );
    },
    []
  );

  const handleChangeItemComment = useCallback((id: number, comment: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, comment } : item))
    );
  }, []);

  const handleChangeItemQty = useCallback((id: number, countedQty: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const factor =
          item.availableUoms?.find((u) => u.id === item.uomId)?.factor ?? 1;

        const baseCountedQty = factor > 0 ? countedQty * factor : countedQty;

        return { ...item, countedQty, baseCountedQty };
      })
    );
  }, []);

  const handleChangeItemUom = useCallback(
    (id: number, uomId: number, uomCode: string) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;

          const available = item.availableUoms ?? [];

          const target = available.find((u) => u.id === uomId);
          const targetFactor = target?.factor ?? 1;

          const previous = available.find((u) => u.id === item.uomId);
          const previousFactor = previous?.factor ?? 1;

          let effectiveBase = item.baseCountedQty ?? 0;
          if (!Number.isFinite(effectiveBase) || effectiveBase <= 0) {
            const qty = Number(item.countedQty ?? 0);
            effectiveBase = previousFactor > 0 ? qty * previousFactor : qty;
          }

          const newCountedQty =
            targetFactor > 0 ? effectiveBase / targetFactor : item.countedQty;

          return {
            ...item,
            uomId,
            uom: uomCode,
            countedQty: newCountedQty,
            baseCountedQty: effectiveBase,
          };
        })
      );
    },
    []
  );

  const handleSaveChanges = async () => {
    if (isReadOnly) {
      showToastError(
        'Este conteo ya está cerrado; no se pueden guardar cambios.'
      );
      return;
    }

    if (!inventoryCountIdState) {
      showToastError(
        'No hay una jornada de inventario asociada a este almacén. No se pueden guardar cambios.'
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await saveWarehouseAuditChanges({
        inventoryCountId: inventoryCountIdState,
        auditStatus,
        items,
      });

      showToastSuccess(
        auditStatus === 'completed'
          ? 'Cambios guardados y auditoría marcada como Completada.'
          : 'Cambios de la auditoría guardados correctamente.'
      );
    } catch (err: unknown) {
      const baseMsg = extractErrorMessage(err);
      setError(baseMsg);
      showToastError(`Error al guardar cambios: ${baseMsg}`);
    } finally {
      setSaving(false);
    }
  };

  // Renderizado principal (sin permiso)
  if (!canManageAudit) {
    return (
      <div className="h-screen flex bg-gray-100">
        <Sidebar />
        <main className="flex flex-col flex-1 h-[100dvh] bg-gray-100 overflow-hidden">
          <header className="bg-blue-600 text-white shadow-sm pt-16 sm:pt-6">
            <div className="px-4 sm:px-6 lg:px-10 pb-4 sm:pb-5 max-w-6xl mx-auto w-full">
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
                Inventario Auditoría
              </h1>
              <p className="text-sm sm:text-base mt-1 opacity-90">
                Acceso restringido
              </p>
            </div>
          </header>
          <section className="flex-1 flex items-center justify-center px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <p className="text-gray-900 font-semibold">No autorizado</p>
              <p className="text-gray-600 text-sm mt-1">
                No tienes permisos para administrar las auditorías de almacenes.
              </p>
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/osalm/conteos_inventario/auditoria/almacenes${
                      location.search || '?tab=warehouses'
                    }`
                  )
                }
                className="mt-4 w-full rounded-xl bg-gray-900 text-white py-2 text-sm font-semibold hover:bg-black cursor-pointer"
              >
                Volver
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const showingCount = totalItemsForFilter;
  const hasActiveSearch = normalizeForSearch(searchText).length >= 2;

  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />

      <main className="flex flex-col flex-1 h-[100dvh] bg-gray-100 overflow-hidden">
        {/* TOP BAR */}
        <header className="bg-blue-600 text-white shadow-sm pt-16 sm:pt-6">
          <div className="px-4 sm:px-6 lg:px-10 pb-4 sm:pb-5 max-w-6xl mx-auto w-full flex flex-col gap-4">
            {/* Título */}
            <div className="flex flex-col gap-2">
              <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.16em] text-blue-100/80">
                Auditoría de inventario
              </p>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight break-words">
                {warehouse
                  ? warehouse.isArea && warehouse.areaName
                    ? `${warehouse.name} · ${warehouse.areaName}`
                    : warehouse.name
                  : 'Almacén'}
              </h1>
              <p className="text-sm sm:text-base text-blue-50/90 max-w-2xl">
                Cambia el estado de cada artículo, ajusta UoM y cantidades (si
                aplica) y deja comentarios claros.
              </p>

              {isReadOnly && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs sm:text-sm">
                  <span className="text-base">🔒</span>
                  <span className="font-semibold">Conteo cerrado</span>
                  <span className="opacity-90">(solo lectura)</span>
                </div>
              )}
            </div>

            {/* Acciones + estado */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <AuditStatusSelector
                status={auditStatus}
                onChange={handleChangeAuditStatus}
                readOnly={isReadOnly}
              />

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <InventoryAuditExportButton
                  warehouse={warehouse}
                  items={items}
                  inventoryCountId={inventoryCountIdState}
                  disabled={loading || inventoryCountIdState == null}
                />

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/osalm/conteos_inventario/auditoria/almacenes${
                        location.search || '?tab=warehouses'
                      }`
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white/95 text-blue-700 px-4 py-2 text-xs sm:text-sm font-semibold shadow-sm hover:bg-white transition cursor-pointer"
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-base">
                    ←
                  </span>
                  <span className="whitespace-nowrap">Volver</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <section className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 max-w-7xl 2xl:max-w-[1400px] mx-auto w-full">
            {/* Estado de carga / error */}
            {loading && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <p className="text-sm text-gray-500">Cargando auditoría…</p>
              </div>
            )}

            {error && !loading && (
              <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-4">
                <p className="text-sm text-red-600 font-semibold">
                  Ocurrió un error
                </p>
                <p className="text-sm text-red-500 mt-1">{error}</p>
              </div>
            )}

            {!loading && !error && inventoryCountIdState == null && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <p className="text-sm text-gray-700 font-semibold">
                  No hay jornada registrada
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  No existe ninguna jornada de inventario registrada para este
                  almacén.
                </p>
              </div>
            )}

            {!loading && !error && inventoryCountIdState != null && (
              <>
                {/* Resumen + filtros + buscador */}
                <div className="flex flex-col gap-4">
                  {/* Row principal */}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    {/* Tabs */}
                    <div className="w-full sm:w-auto">
                      <AuditItemsStatusTabs
                        stats={stats}
                        active={activeFilter}
                        onChange={setActiveFilter}
                      />

                      <p className="mt-2 text-[11px] sm:text-xs text-gray-500">
                        Tip: En <span className="font-semibold">Recontar</span>{' '}
                        puedes ajustar la cantidad.
                      </p>
                    </div>

                    {/* Search + contador */}
                    <div className="w-full sm:w-[420px] flex flex-col items-end gap-1">
                      <SearchBox
                        value={searchText}
                        onChange={setSearchText}
                        placeholder="Buscar por código, nombre, usuario, comentario…"
                      />

                      <p className="text-[11px] sm:text-xs text-gray-500 text-right">
                        Escribe al menos{' '}
                        <span className="font-semibold">2</span> caracteres.
                        Búsqueda no distingue mayúsculas/acentos.
                      </p>

                      {/* Contador */}
                      <div className="mt-1 text-xs sm:text-sm text-gray-600 text-right">
                        <span className="font-semibold text-gray-900">
                          Mostrando {showingCount}
                        </span>{' '}
                        resultado{showingCount === 1 ? '' : 's'}
                        {activeFilter !== 'all' && (
                          <>
                            {' '}
                            en{' '}
                            <span className="font-semibold">
                              {labelForTab(activeFilter)}
                            </span>
                          </>
                        )}
                        {hasActiveSearch && (
                          <>
                            {' '}
                            para{' '}
                            <span className="font-semibold">
                              “{debouncedSearchText.trim()}”
                            </span>
                          </>
                        )}
                        {items.length > 0 && (
                          <>
                            {' '}
                            <span className="text-gray-400">
                              (de {items.length})
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* LISTA RESPONSIVE */}
                <div className="mt-5">
                  {/* Mobile/Tablet: cards */}
                  <div className="grid gap-3 lg:hidden">
                    {paginatedItems.length === 0 ? (
                      <EmptyState />
                    ) : (
                      paginatedItems.map((item) => (
                        <AuditItemCard
                          key={item.id}
                          item={item}
                          readOnly={isReadOnly}
                          onChangeStatus={handleChangeItemStatus}
                          onChangeComment={handleChangeItemComment}
                          onChangeCountedQty={handleChangeItemQty}
                          onChangeUom={handleChangeItemUom}
                        />
                      ))
                    )}
                  </div>

                  {/* Desktop: tabla limpia */}
                  <div className="hidden lg:block bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                    <div className="overflow-x-hidden">
                      <div className="w-full">
                        <div
                          className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 backdrop-blur px-6 py-3 text-xs font-semibold text-gray-500
                          grid grid-cols-[100px_minmax(320px,2.2fr)_minmax(170px,1fr)_minmax(130px,0.8fr)_minmax(140px,0.8fr)_minmax(240px,1.4fr)] gap-4"
                        >
                          <div>SKU</div>
                          <div>Artículo</div>
                          <div>Usuario</div>
                          <div className="text-right">Conteo</div>
                          <div className="text-center">Estado</div>
                          <div>Comentario</div>
                        </div>

                        <div className="divide-y divide-gray-100">
                          {paginatedItems.length === 0 ? (
                            <EmptyState />
                          ) : (
                            paginatedItems.map((item) => (
                              <AuditItemRowDesktop
                                key={item.id}
                                item={item}
                                readOnly={isReadOnly}
                                onChangeStatus={handleChangeItemStatus}
                                onChangeComment={handleChangeItemComment}
                                onChangeCountedQty={handleChangeItemQty}
                                onChangeUom={handleChangeItemUom}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Paginador */}
                    {totalItemsForFilter > PAGE_SIZE && (
                      <Paginator
                        currentPage={currentPage}
                        setCurrentPage={setCurrentPage}
                        totalPages={totalPages}
                        from={currentRange.from}
                        to={currentRange.to}
                        total={totalItemsForFilter}
                      />
                    )}
                  </div>

                  {/* Paginador (mobile) */}
                  {totalItemsForFilter > PAGE_SIZE && (
                    <div className="lg:hidden mt-3">
                      <Paginator
                        currentPage={currentPage}
                        setCurrentPage={setCurrentPage}
                        totalPages={totalPages}
                        from={currentRange.from}
                        to={currentRange.to}
                        total={totalItemsForFilter}
                      />
                    </div>
                  )}
                </div>

                {/* Footer acciones */}
                <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs sm:text-sm text-gray-600">
                      <p className="font-semibold text-gray-900">
                        Antes de cerrar
                      </p>
                      <p className="mt-0.5">
                        Revisa <span className="font-semibold">Pendientes</span>{' '}
                        y <span className="font-semibold">Recontar</span>. Luego
                        marca la auditoría como{' '}
                        <span className="font-semibold">Completado</span> y
                        guarda.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveChanges}
                        disabled={saving || isReadOnly}
                        className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {isReadOnly
                          ? 'Conteo cerrado'
                          : saving
                          ? 'Guardando…'
                          : auditStatus === 'completed'
                          ? 'Guardar y cerrar'
                          : 'Guardar cambios'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

// ======================
// SUBCOMPONENTES
// ======================

function labelForTab(tab: FilterTab): string {
  if (tab === 'all') return 'Todos';
  if (tab === 'pending') return 'Pendientes';
  if (tab === 'counted') return 'Contados';
  return 'Recontar';
}

function SearchBox(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const { value, onChange, placeholder } = props;

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        🔎
      </span>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-gray-200 bg-white pl-9 pr-10 py-2.5 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
      />

      {value.trim().length > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100"
          aria-label="Limpiar búsqueda"
          title="Limpiar"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-4 sm:px-6 py-8 text-center">
      <p className="text-sm font-semibold text-gray-900">Sin resultados</p>
      <p className="text-sm text-gray-500 mt-1">
        No hay artículos para este filtro/búsqueda.
      </p>
    </div>
  );
}

function Paginator(props: {
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  from: number;
  to: number;
  total: number;
}) {
  const { currentPage, setCurrentPage, totalPages, from, to, total } = props;

  return (
    <div className="border-t border-gray-100 px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm text-gray-600 bg-white">
      <span>
        Mostrando <span className="font-semibold">{from}</span> –{' '}
        <span className="font-semibold">{to}</span> de{' '}
        <span className="font-semibold">{total}</span>
      </span>

      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))}
          disabled={currentPage === 0}
          className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Anterior
        </button>

        <span className="text-gray-500">
          Página <span className="font-semibold">{currentPage + 1}</span> de{' '}
          <span className="font-semibold">{totalPages}</span>
        </span>

        <button
          type="button"
          onClick={() =>
            setCurrentPage((p) => (p + 1 >= totalPages ? p : p + 1))
          }
          disabled={currentPage + 1 >= totalPages}
          className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

function AuditStatusSelector(props: {
  status: AuditStatus;
  onChange: (status: AuditStatus) => void;
  readOnly?: boolean;
}) {
  const { status, onChange, readOnly } = props;

  const [openMobile, setOpenMobile] = useState(false);

  // Si cambia a desktop, cerramos el accordion (por seguridad UX)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 640px)'); // tailwind sm
    const handler = () => {
      if (mql.matches) setOpenMobile(false);
    };
    handler();
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const statusMeta = useMemo(() => {
    const map: Record<
      AuditStatus,
      { label: string; icon: string; activeCls: string }
    > = {
      pending: {
        label: 'Pendiente',
        icon: '⏱',
        activeCls: 'bg-white text-amber-700 border-amber-300 shadow-sm',
      },
      in_progress: {
        label: 'En progreso',
        icon: '🔄',
        activeCls: 'bg-white text-blue-700 border-blue-300 shadow-sm',
      },
      completed: {
        label: 'Completado',
        icon: '✅',
        activeCls: 'bg-white text-green-700 border-green-300 shadow-sm',
      },
    };
    return map[status];
  }, [status]);

  const buttonBase =
    'px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition flex items-center justify-center gap-2 cursor-pointer';

  const inactiveBase = 'border-transparent text-blue-50/90 hover:bg-white/10';

  const handlePick = (next: AuditStatus) => {
    if (readOnly) return;
    onChange(next);
    setOpenMobile(false);
  };

  return (
    <div className="w-full sm:w-auto">
      {/* =========================
          MOBILE: COLLAPSABLE
          ========================= */}
      <div className="sm:hidden">
        <div className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur p-2">
          {/* Botón header */}
          <button
            type="button"
            onClick={() => !readOnly && setOpenMobile((v) => !v)}
            disabled={readOnly}
            className={[
              'w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2',
              'border border-white/15 text-blue-50/90',
              'transition',
              readOnly ? 'opacity-70 cursor-not-allowed' : 'hover:bg-white/10',
            ].join(' ')}
            aria-expanded={openMobile}
          >
            <span className="flex items-center gap-2">
              <span className="text-base">{statusMeta.icon}</span>
              <span className="text-xs font-semibold">Estado:</span>
              <span className="text-sm font-extrabold">{statusMeta.label}</span>
            </span>

            <span
              className={[
                'text-lg leading-none transition-transform',
                openMobile ? 'rotate-180' : 'rotate-0',
              ].join(' ')}
            >
              ▾
            </span>
          </button>

          {/* Panel colapsable */}
          <div
            className={[
              'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
              openMobile
                ? 'grid-rows-[1fr] opacity-100 mt-2'
                : 'grid-rows-[0fr] opacity-0',
            ].join(' ')}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handlePick('pending')}
                  className={[
                    buttonBase,
                    'w-full',
                    status === 'pending' ? statusMeta.activeCls : inactiveBase,
                    readOnly ? 'cursor-not-allowed opacity-70' : '',
                  ].join(' ')}
                >
                  <span className="text-base">⏱</span>
                  <span className="leading-none">Pendiente</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePick('in_progress')}
                  className={[
                    buttonBase,
                    'w-full',
                    status === 'in_progress'
                      ? 'bg-white text-blue-700 border-blue-300 shadow-sm'
                      : inactiveBase,
                    readOnly ? 'cursor-not-allowed opacity-70' : '',
                  ].join(' ')}
                >
                  <span className="text-base">🔄</span>
                  <span className="leading-none">En progreso</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePick('completed')}
                  className={[
                    buttonBase,
                    'w-full',
                    status === 'completed'
                      ? 'bg-white text-green-700 border-green-300 shadow-sm'
                      : inactiveBase,
                    readOnly ? 'cursor-not-allowed opacity-70' : '',
                  ].join(' ')}
                >
                  <span className="text-base">✅</span>
                  <span className="leading-none">Completado</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================
          DESKTOP: ORIGINAL (3 en fila)
          ========================= */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-3 gap-2 bg-white/10 border border-white/15 rounded-2xl p-2 backdrop-blur">
          <button
            type="button"
            onClick={() => !readOnly && onChange('pending')}
            className={[
              buttonBase,
              'flex-1',
              status === 'pending'
                ? 'bg-white text-amber-700 border-amber-300 shadow-sm'
                : inactiveBase,
              readOnly ? 'cursor-not-allowed opacity-70' : '',
            ].join(' ')}
          >
            <span className="text-base">⏱</span>
            <span className="leading-none">Pendiente</span>
          </button>

          <button
            type="button"
            onClick={() => !readOnly && onChange('in_progress')}
            className={[
              buttonBase,
              'flex-1',
              status === 'in_progress'
                ? 'bg-white text-blue-700 border-blue-300 shadow-sm'
                : inactiveBase,
              readOnly ? 'cursor-not-allowed opacity-70' : '',
            ].join(' ')}
          >
            <span className="text-base">🔄</span>
            <span className="leading-none">En progreso</span>
          </button>

          <button
            type="button"
            onClick={() => !readOnly && onChange('completed')}
            className={[
              buttonBase,
              'flex-1',
              status === 'completed'
                ? 'bg-white text-green-700 border-green-300 shadow-sm'
                : inactiveBase,
              readOnly ? 'cursor-not-allowed opacity-70' : '',
            ].join(' ')}
          >
            <span className="text-base">✅</span>
            <span className="leading-none">Completado</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function AuditItemsStatusTabs(props: {
  stats: { total: number; pending: number; counted: number; recount: number };
  active: FilterTab;
  onChange: (tab: FilterTab) => void;
}) {
  const { stats, active, onChange } = props;

  const tabs: Array<{
    key: FilterTab;
    label: string;
    value: number;
    tone: 'default' | 'warning' | 'success' | 'info';
  }> = [
    { key: 'all', label: 'Total', value: stats.total, tone: 'default' },
    {
      key: 'pending',
      label: 'Pendientes',
      value: stats.pending,
      tone: 'warning',
    },
    {
      key: 'counted',
      label: 'Contados',
      value: stats.counted,
      tone: 'success',
    },
    { key: 'recount', label: 'Recontar', value: stats.recount, tone: 'info' },
  ];

  const tones: Record<
    'default' | 'warning' | 'success' | 'info',
    {
      base: string;
      active: string;
      countBase: string;
      countActive: string;
    }
  > = {
    default: {
      base: 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 cursor-pointer',
      active: 'bg-gray-900 border-gray-900 text-white shadow-sm cursor-pointer',
      countBase: 'bg-gray-100 text-gray-800',
      countActive: 'bg-white/15 text-white',
    },
    warning: {
      base: 'bg-white border-amber-200 text-amber-800 hover:bg-amber-50 cursor-pointer',
      active:
        'bg-amber-500 border-amber-500 text-white shadow-sm cursor-pointer',
      countBase: 'bg-amber-50 text-amber-800',
      countActive: 'bg-white/15 text-white',
    },
    success: {
      base: 'bg-white border-green-200 text-green-800 hover:bg-green-50 cursor-pointer',
      active:
        'bg-green-600 border-green-600 text-white shadow-sm cursor-pointer',
      countBase: 'bg-green-50 text-green-800',
      countActive: 'bg-white/15 text-white',
    },
    info: {
      base: 'bg-white border-blue-200 text-blue-800 hover:bg-blue-50 cursor-pointer',
      active: 'bg-blue-600 border-blue-600 text-white shadow-sm cursor-pointer',
      countBase: 'bg-blue-50 text-blue-800',
      countActive: 'bg-white/15 text-white',
    },
  };

  return (
    <div className="w-full">
      {/* ✅ Mobile: grid (NO scroll) */}
      <div className="grid grid-cols-2 gap-2 sm:hidden">
        {tabs.map((t) => {
          const isActive = active === t.key;
          const cfg = tones[t.tone];

          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              className={[
                'w-full inline-flex items-center justify-between gap-2',
                'rounded-2xl border px-3 py-2',
                'text-xs font-semibold transition',
                isActive ? cfg.active : cfg.base,
              ].join(' ')}
              aria-pressed={isActive}
            >
              <span className="text-[11px] uppercase tracking-[0.14em] opacity-90">
                {t.label}
              </span>

              <span
                className={[
                  'inline-flex items-center justify-center',
                  'h-7 px-2 rounded-xl text-sm font-extrabold',
                  isActive ? cfg.countActive : cfg.countBase,
                ].join(' ')}
              >
                {t.value}
              </span>
            </button>
          );
        })}
      </div>

      {/* ✅ Desktop/Tablet: pills en fila, sin overflow */}
      <div className="hidden sm:flex sm:flex-wrap gap-2 rounded-2xl bg-white/60 border border-gray-200 p-2 shadow-sm">
        {tabs.map((t) => {
          const isActive = active === t.key;
          const cfg = tones[t.tone];

          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              className={[
                'inline-flex items-center gap-2 rounded-2xl border px-3 py-2',
                'text-sm font-semibold transition',
                isActive ? cfg.active : cfg.base,
              ].join(' ')}
              aria-pressed={isActive}
            >
              <span className="text-xs uppercase tracking-[0.14em] opacity-90">
                {t.label}
              </span>

              <span
                className={[
                  'inline-flex items-center justify-center min-w-[2.25rem]',
                  'h-7 px-2 rounded-xl text-sm font-extrabold',
                  isActive ? cfg.countActive : cfg.countBase,
                ].join(' ')}
              >
                {t.value}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge(props: { status: ItemStatus }) {
  const { status } = props;

  const cfg: Record<ItemStatus, { label: string; cls: string }> = {
    pending: {
      label: 'Pendiente',
      cls: 'bg-amber-50 text-amber-800 ring-amber-200',
    },
    counted: {
      label: 'Contado',
      cls: 'bg-green-50 text-green-800 ring-green-200',
    },
    recount: {
      label: 'Recontar',
      cls: 'bg-blue-50 text-blue-800 ring-blue-200',
    },
  };

  return (
    <span
      className={[
        'inline-flex items-center justify-center px-2.5 py-1 rounded-full ring-1 text-xs font-bold',
        cfg[status].cls,
      ].join(' ')}
    >
      {cfg[status].label}
    </span>
  );
}

function MotiveChip(props: { status: ItemStatus; reason?: PendingReasonCode }) {
  const { status, reason } = props;

  const pendingReasonLabel: Record<PendingReasonCode, string> = {
    UOM_DIFFERENT: 'UoM diferente',
    REVIEW: 'Revisión posterior',
  };

  if (!reason) {
    return <span className="text-[11px] text-gray-400">Sin motivo</span>;
  }

  const tone =
    status === 'pending'
      ? 'bg-amber-50 text-amber-800 ring-amber-200'
      : 'bg-gray-50 text-gray-700 ring-gray-200';

  return (
    <span
      className={[
        'inline-flex items-center gap-2 px-2.5 py-1 rounded-full ring-1 text-[11px] font-semibold',
        tone,
      ].join(' ')}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span className="truncate">{pendingReasonLabel[reason]}</span>
    </span>
  );
}

function UserPill({ name, email }: { name: string; email?: string }) {
  const safeName = (name || '—').trim() || '—';
  const initials = safeName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm min-w-0 overflow-hidden">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-900 text-white text-xs font-bold shrink-0">
          {initials || '—'}
        </span>

        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="text-sm font-bold text-gray-900 leading-tight truncate">
            {safeName}
          </p>
          <p className="text-xs text-gray-500 leading-tight truncate">
            {email || '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

function AuditItemCard(props: {
  item: AuditItem;
  readOnly?: boolean;
  onChangeStatus: (id: number, status: ItemStatus) => void;
  onChangeComment: (id: number, comment: string) => void;
  onChangeCountedQty: (id: number, countedQty: number) => void;
  onChangeUom: (id: number, uomId: number, uomCode: string) => void;
}) {
  const {
    item,
    readOnly,
    onChangeStatus,
    onChangeComment,
    onChangeCountedQty,
    onChangeUom,
  } = props;

  const statusClass: Record<ItemStatus, string> = {
    pending: 'border-amber-200',
    counted: 'border-green-200',
    recount: 'border-blue-200',
  };

  return (
    <div
      className={[
        'bg-white rounded-2xl shadow-sm border p-4',
        statusClass[item.status],
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm text-gray-700">{item.sku}</p>
          <p className="mt-1 text-base font-bold text-gray-900 leading-tight break-words">
            {item.name}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            <MotiveChip status={item.status} reason={item.pendingReasonCode} />
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[11px] uppercase tracking-[0.14em] text-gray-400">
            Contado
          </p>
          <p className="text-lg font-extrabold text-gray-900 leading-none mt-1">
            {Number(item.countedQty ?? 0).toLocaleString('es-DO')}
          </p>
          <p className="text-xs text-gray-500 mt-1">UoM: {item.uom || '—'}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Usuario */}
        <div className="sm:col-span-2">
          {item.countedBy ? (
            <UserPill name={item.countedBy.name} email={item.countedBy.email} />
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">
              Usuario: <span className="font-semibold">—</span>
            </div>
          )}
        </div>

        {/* Estado */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Estado del ítem
          </label>
          <select
            value={item.status}
            onChange={(e) =>
              onChangeStatus(item.id, e.target.value as ItemStatus)
            }
            disabled={readOnly}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:opacity-60"
          >
            <option value="pending">Pendiente</option>
            <option value="counted">Contado</option>
            <option value="recount">Recontar</option>
          </select>
        </div>

        {/* UoM */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Unidad de medida
          </label>

          {readOnly ||
          !item.availableUoms ||
          item.availableUoms.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {item.uom || '—'}
            </div>
          ) : (
            <select
              value={item.uomId}
              onChange={(e) => {
                const newUomId = Number(e.target.value);
                const selected = item.availableUoms?.find(
                  (u) => u.id === newUomId
                );
                if (!selected) return;
                onChangeUom(item.id, selected.id, selected.code);
              }}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            >
              {item.availableUoms?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} — {u.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Cantidad (editable solo en recount) */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Cantidad (solo editable en “Recontar”)
          </label>

          {item.status === 'recount' && !readOnly ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.0001"
                min={0}
                value={
                  Number.isNaN(Number(item.countedQty))
                    ? ''
                    : String(item.countedQty)
                }
                onChange={(e) => {
                  const value = e.target.value.replace(',', '.');
                  const numeric = value === '' ? 0 : Number(value);
                  if (Number.isNaN(numeric)) return;
                  onChangeCountedQty(item.id, numeric);
                }}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
              <span className="text-sm font-semibold text-gray-600">
                {item.uom}
              </span>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
              <span className="font-bold">
                {Number(item.countedQty ?? 0).toLocaleString('es-DO')}
              </span>{' '}
              <span className="text-gray-500">{item.uom}</span>
            </div>
          )}
        </div>

        {/* Comentario */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Comentario del auditor (opcional)
          </label>
          <textarea
            value={item.comment ?? ''}
            onChange={(e) => onChangeComment(item.id, e.target.value)}
            disabled={readOnly}
            rows={3}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none disabled:opacity-60"
            placeholder="Explica el motivo, hallazgos o acciones requeridas…"
          />
        </div>
      </div>
    </div>
  );
}

function AuditItemRowDesktop(props: {
  item: AuditItem;
  readOnly?: boolean;
  onChangeStatus: (id: number, status: ItemStatus) => void;
  onChangeComment: (id: number, comment: string) => void;
  onChangeCountedQty: (id: number, countedQty: number) => void;
  onChangeUom: (id: number, uomId: number, uomCode: string) => void;
}) {
  const {
    item,
    onChangeStatus,
    onChangeComment,
    onChangeCountedQty,
    onChangeUom,
    readOnly,
  } = props;

  return (
    <div className="px-6 py-3 grid grid-cols-[100px_minmax(320px,2.2fr)_minmax(170px,1fr)_minmax(130px,0.8fr)_minmax(140px,0.8fr)_minmax(240px,1.4fr)] gap-4 items-center">
      <div className="font-mono text-sm text-gray-700">{item.sku}</div>

      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
          {item.name}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
          <span>UoM:</span>
          {readOnly || !item.availableUoms?.length ? (
            <span className="font-medium">{item.uom}</span>
          ) : (
            <select
              value={item.uomId}
              onChange={(e) => {
                const id = Number(e.target.value);
                const u = item.availableUoms?.find((x) => x.id === id);
                if (u) onChangeUom(item.id, u.id, u.code);
              }}
              className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {item.availableUoms.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <div className="h-7 w-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
          {item.countedBy?.name?.[0] ?? '—'}
        </div>
        <p className="text-sm font-medium text-gray-900 truncate">
          {item.countedBy?.name ?? '—'}
        </p>
      </div>

      <div className="text-right">
        {item.status === 'recount' && !readOnly ? (
          <div className="inline-flex items-center gap-2">
            <input
              type="number"
              step="0.0001"
              value={Number(item.countedQty)}
              onChange={(e) =>
                onChangeCountedQty(item.id, Number(e.target.value))
              }
              className="w-20 rounded-md border border-gray-300 px-2 py-1 text-right text-sm font-semibold"
            />
            <span className="text-xs text-gray-500">{item.uom}</span>
          </div>
        ) : (
          <span className="text-sm font-semibold text-gray-900">
            {Number(item.countedQty).toLocaleString('es-DO')}{' '}
            <span className="text-xs text-gray-500">{item.uom}</span>
          </span>
        )}
      </div>

      <div className="flex justify-center">
        <select
          value={item.status}
          onChange={(e) =>
            onChangeStatus(item.id, e.target.value as ItemStatus)
          }
          disabled={readOnly}
          className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="pending">Pendiente</option>
          <option value="counted">Contado</option>
          <option value="recount">Recontar</option>
        </select>
      </div>

      <div className="min-w-0">
        <input
          type="text"
          value={item.comment ?? ''}
          onChange={(e) => onChangeComment(item.id, e.target.value)}
          disabled={readOnly}
          placeholder="Comentario…"
          className="w-full min-w-0 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
