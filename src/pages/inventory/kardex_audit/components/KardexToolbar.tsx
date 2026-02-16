import { Filter, RefreshCw, RotateCcw, Search } from 'lucide-react';
import type {
  KardexSort,
  VInventoryKardexRow,
} from '../../../../types/inventory/inventoryKardex';
import type { OptionRow } from '../../../../services/inventory/lookupsService';
import type { UUID } from '../../../../types/inventory/common';
import { DangerButton, PrimaryButton } from './buttons';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type DocType = VInventoryKardexRow['doc_type'];
type Status = VInventoryKardexRow['status'];
type Side = Exclude<VInventoryKardexRow['movement_side'], null>;

export function KardexToolbar({
  isLoading,
  optionsLoading,
  selectedCount,

  // values
  q,
  partId,
  warehouseId,
  ticketId,
  docType,
  movementSide,
  status,
  dateFrom,
  dateTo,
  page,
  pageSize,
  totalPages,
  sort,

  // options
  parts,
  warehouses,
  docTypes,
  statuses,
  sides,

  // handlers
  onChangeQ,
  onChangePartId,
  onChangeWarehouseId,
  onChangeTicketId,
  onChangeDocType,
  onChangeMovementSide,
  onChangeStatus,
  onChangeDateFrom,
  onChangeDateTo,
  onApply,
  onReset,
  onRefresh,
  onChangeSort,
  onChangePageSize,
  onPrevPage,
  onNextPage,
  onGoToPage,
}: {
  isLoading: boolean;
  optionsLoading: boolean;
  selectedCount: number;

  q: string;
  partId: UUID | '';
  warehouseId: UUID | '';
  ticketId: string;
  docType: DocType | '';
  movementSide: Side | '';
  status: Status | '';
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
  page: number;
  pageSize: number;
  totalPages: number;
  sort: KardexSort;

  parts: OptionRow[];
  warehouses: OptionRow[];
  docTypes: DocType[];
  statuses: Status[];
  sides: Side[];

  onChangeQ: (v: string) => void;
  onChangePartId: (v: UUID | '') => void;
  onChangeWarehouseId: (v: UUID | '') => void;
  onChangeTicketId: (v: string) => void;
  onChangeDocType: (v: DocType | '') => void;
  onChangeMovementSide: (v: Side | '') => void;
  onChangeStatus: (v: Status | '') => void;
  onChangeDateFrom: (v: string) => void;
  onChangeDateTo: (v: string) => void;

  onApply: () => void;
  onReset: () => void;
  onRefresh: () => void;

  onChangeSort: (s: KardexSort) => void;
  onChangePageSize: (n: number) => void;

  onPrevPage: () => void;
  onNextPage: () => void;
  onGoToPage: (p: number) => void;
}) {
  return (
    <div className="px-4 md:px-6 lg:px-8 py-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-4">
          {/* Top / Title */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-indigo-50">
                <Filter className="h-5 w-5 text-indigo-700" />
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Filtros y acciones
                </div>
                <div className="text-xs text-slate-500">
                  Filtra por repuesto, almacén, fechas, documento, ticket y
                  tipo.
                  {selectedCount > 0 ? (
                    <span className="ml-1">
                      <span className="font-semibold text-slate-700">
                        {selectedCount}
                      </span>{' '}
                      seleccionado(s).
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <PrimaryButton
                onClick={onApply}
                disabled={isLoading}
                icon={Search}
                title={isLoading ? 'Cargando...' : undefined}
              >
                Aplicar
              </PrimaryButton>

              <PrimaryButton
                onClick={onRefresh}
                disabled={isLoading}
                icon={RefreshCw}
                title={isLoading ? 'Cargando...' : 'Recargar resultados'}
              >
                Recargar
              </PrimaryButton>

              <DangerButton
                onClick={onReset}
                disabled={isLoading}
                icon={RotateCcw}
                title={isLoading ? 'Cargando...' : 'Reiniciar filtros'}
              >
                Reiniciar
              </DangerButton>
            </div>
          </div>

          {/* Filters grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search */}
            <div className="md:col-span-4">
              <label className="text-[11px] font-semibold text-slate-700">
                Búsqueda
              </label>
              <input
                value={q}
                onChange={(e) => onChangeQ(e.target.value)}
                placeholder="doc_no, referencia, repuesto, almacén, bin..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            {/* Part */}
            <div className="md:col-span-3">
              <label className="text-[11px] font-semibold text-slate-700">
                Repuesto
              </label>
              <select
                value={partId}
                onChange={(e) => onChangePartId((e.target.value as UUID) || '')}
                disabled={optionsLoading}
                className={cx(
                  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200',
                  optionsLoading && 'cursor-not-allowed opacity-70'
                )}
              >
                <option value="">
                  {optionsLoading ? 'Cargando...' : 'Todos'}
                </option>
                {parts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id ? `${p.id} — ${p.label}` : p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Warehouse */}
            <div className="md:col-span-3">
              <label className="text-[11px] font-semibold text-slate-700">
                Almacén
              </label>
              <select
                value={warehouseId}
                onChange={(e) =>
                  onChangeWarehouseId((e.target.value as UUID) || '')
                }
                disabled={optionsLoading}
                className={cx(
                  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200',
                  optionsLoading && 'cursor-not-allowed opacity-70'
                )}
              >
                <option value="">
                  {optionsLoading ? 'Cargando...' : 'Todos'}
                </option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.id ? `${w.id} — ${w.label}` : w.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Ticket */}
            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-700">
                Ticket
              </label>
              <input
                value={ticketId}
                onChange={(e) => onChangeTicketId(e.target.value)}
                inputMode="numeric"
                placeholder="Ej: 10234"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            {/* Dates */}
            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-700">
                Desde
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => onChangeDateFrom(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-700">
                Hasta
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => onChangeDateTo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            {/* Doc Type */}
            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-700">
                Tipo
              </label>
              <select
                value={docType}
                onChange={(e) =>
                  onChangeDocType((e.target.value as DocType) || '')
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">Todos</option>
                {docTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Side */}
            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-700">
                Lado
              </label>
              <select
                value={movementSide}
                onChange={(e) =>
                  onChangeMovementSide((e.target.value as Side) || '')
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">Todos</option>
                {sides.map((s) => (
                  <option key={s} value={s}>
                    {s === 'IN' ? 'IN (Entrada)' : 'OUT (Salida)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-700">
                Estado
              </label>
              <select
                value={status}
                onChange={(e) =>
                  onChangeStatus((e.target.value as Status) || '')
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">Todos</option>
                {statuses.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-700">
                Ordenar por
              </label>
              <select
                value={sort.by ?? 'occurred_at'}
                onChange={(e) =>
                  onChangeSort({
                    ...sort,
                    by: e.target.value as KardexSort['by'],
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="occurred_at">Fecha</option>
                <option value="part_code">Código repuesto</option>
                <option value="warehouse_code">Código almacén</option>
                <option value="doc_no">No. documento</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-700">
                Dirección
              </label>
              <select
                value={sort.dir ?? 'desc'}
                onChange={(e) =>
                  onChangeSort({
                    ...sort,
                    dir: e.target.value as KardexSort['dir'],
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>

            {/* Page size */}
            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-700">
                Tamaño página
              </label>
              <select
                value={String(pageSize)}
                onChange={(e) => onChangePageSize(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                {[25, 50, 100, 200].map((n) => (
                  <option key={n} value={String(n)}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick page jump */}
            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-700">
                Página
              </label>

              <div className="mt-1 flex items-center gap-2">
                {/* Prev */}
                <button
                  type="button"
                  onClick={() => onGoToPage(Math.max(1, page - 1))}
                  disabled={isLoading || page <= 1}
                  className={cx(
                    'h-10 w-9 rounded-xl border text-slate-700',
                    'bg-white hover:bg-slate-50',
                    (isLoading || page <= 1) && 'opacity-40 cursor-not-allowed'
                  )}
                  aria-label="Página anterior"
                  title="Anterior"
                >
                  ‹
                </button>

                {/* Field */}
                <div className="min-w-0 flex-1">
                  <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-200">
                    <input
                      value={String(page)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^\d]/g, '');
                        if (raw === '') {
                          // evita NaN visual, pero no dispares goToPage vacío
                          onGoToPage(1);
                          return;
                        }
                        const v = Number(raw);
                        if (!Number.isFinite(v)) return;
                        onGoToPage(v);
                      }}
                      onBlur={() => {
                        if (page < 1) onGoToPage(1);
                        if (page > totalPages) onGoToPage(totalPages);
                      }}
                      inputMode="numeric"
                      className={cx(
                        'w-14 bg-transparent px-3 text-sm font-semibold text-slate-900 outline-none',
                        'text-center'
                      )}
                      aria-label="Ir a página"
                    />

                    <span className="h-5 w-px bg-slate-200" />

                    <div className="px-2 text-xs text-slate-500 whitespace-nowrap">
                      /{' '}
                      <span className="font-semibold text-slate-700">
                        {totalPages}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Next */}
                <button
                  type="button"
                  onClick={() => onGoToPage(Math.min(totalPages, page + 1))}
                  disabled={isLoading || page >= totalPages}
                  className={cx(
                    'h-10 w-9 rounded-xl border text-slate-700',
                    'bg-white hover:bg-slate-50',
                    (isLoading || page >= totalPages) &&
                      'opacity-40 cursor-not-allowed'
                  )}
                  aria-label="Página siguiente"
                  title="Siguiente"
                >
                  ›
                </button>
              </div>

              {/* Subhint opcional (se ve bien y no rompe layout) */}
              <div className="mt-1 text-[11px] text-slate-400">
                Rango: 1–{totalPages}
              </div>
            </div>
          </div>

          {/* Pagination buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-xs text-slate-500">
              Consejo: escribe en “Búsqueda” para filtrar por doc_no,
              referencia, repuesto, almacén o bin.
            </div>

            <div className="flex items-center gap-2 sm:justify-end">
              <button
                type="button"
                onClick={onPrevPage}
                disabled={isLoading || page <= 1}
                className={cx(
                  'rounded-xl border px-3 py-1.5 text-sm',
                  isLoading || page <= 1
                    ? 'cursor-not-allowed border-slate-200 text-slate-400'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                )}
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={onNextPage}
                disabled={isLoading || page >= totalPages}
                className={cx(
                  'rounded-xl border px-3 py-1.5 text-sm',
                  isLoading || page >= totalPages
                    ? 'cursor-not-allowed border-slate-200 text-slate-400'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                )}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
