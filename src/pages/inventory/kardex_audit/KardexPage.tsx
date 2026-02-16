import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '../../../components/layout/Sidebar';
import { usePermissions } from '../../../rbac/PermissionsContext';
import { showToastError, showToastSuccess } from '../../../notifications';

import type {
  KardexFilters,
  KardexListArgs,
  KardexSort,
  VInventoryKardexRow,
} from '../../../types/inventory/inventoryKardex';

import type { UUID } from '../../../types/inventory/common';

import { listKardex } from '../../../services/inventory/kardexService';

// lookups (usa tus mismos endpoints de opciones)
import type { OptionRow } from '../../../services/inventory/lookupsService';
import {
  listPartsOptions,
  listWarehousesOptions,
} from '../../../services/inventory/lookupsService';

// Shell / UI atoms (siguiendo tu patrón)
import { PageShell } from './components/PageShell';
import { KardexHeader } from './components/KardexHeader';
import { KardexToolbar } from './components/KardexToolbar';
import { KardexMobileList } from './components/KardexMobileList';
import { KardexTable } from './components/KardexTable';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
      <div className="font-semibold text-slate-900">{title}</div>
      <div className="mt-1">{description}</div>
    </div>
  );
}

const DOC_TYPES: Array<VInventoryKardexRow['doc_type']> = [
  'RECEIPT',
  'ISSUE',
  'TRANSFER',
  'ADJUSTMENT',
  'RETURN',
];

const STATUSES: Array<VInventoryKardexRow['status']> = [
  'DRAFT',
  'POSTED',
  'CANCELLED',
];

const SIDES: Array<Exclude<VInventoryKardexRow['movement_side'], null>> = [
  'IN',
  'OUT',
];

// function startOfTodayISO(): string {
//   const d = new Date();
//   d.setHours(0, 0, 0, 0);
//   return d.toISOString();
// }

// function endOfTodayISO(): string {
//   const d = new Date();
//   d.setHours(23, 59, 59, 999);
//   return d.toISOString();
// }

/** UI date input (YYYY-MM-DD) -> ISO */
function dateOnlyToISOStart(dateOnly: string): string {
  const [y, m, d] = dateOnly.split('-').map((x) => Number(x));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
  return dt.toISOString();
}
function dateOnlyToISOEnd(dateOnly: string): string {
  const [y, m, d] = dateOnly.split('-').map((x) => Number(x));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999);
  return dt.toISOString();
}

export default function KardexPage() {
  const { has } = usePermissions();
  const canRead = has('inventory:read');

  // ===== options
  const [parts, setParts] = useState<OptionRow[]>([]);
  const [warehouses, setWarehouses] = useState<OptionRow[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // ===== data
  const [rows, setRows] = useState<VInventoryKardexRow[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // ===== selection (para bulk actions futuras, export, etc.)
  const checkboxRef = useRef<HTMLInputElement>(null);
  const [selectedRows, setSelectedRows] = useState<VInventoryKardexRow[]>([]);
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);

  // ===== pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // ===== filters (UI state)
  const [q, setQ] = useState<string>('');
  const [partId, setPartId] = useState<UUID | ''>('');
  const [warehouseId, setWarehouseId] = useState<UUID | ''>('');
  const [ticketId, setTicketId] = useState<string>('');
  const [docType, setDocType] = useState<VInventoryKardexRow['doc_type'] | ''>(
    ''
  );
  const [movementSide, setMovementSide] = useState<
    Exclude<VInventoryKardexRow['movement_side'], null> | ''
  >('');
  const [status, setStatus] = useState<VInventoryKardexRow['status'] | ''>('');

  // fechas en UI como YYYY-MM-DD
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );

  // ===== sort
  const [sort, setSort] = useState<KardexSort>({
    by: 'occurred_at',
    dir: 'desc',
  });

  const totalPages = useMemo(() => {
    const t = Math.max(count, 0);
    return Math.max(Math.ceil(t / Math.max(pageSize, 1)), 1);
  }, [count, pageSize]);

  const activeFilters: KardexFilters = useMemo(() => {
    const tId = ticketId.trim();
    const parsedTicketId = tId ? Number(tId) : undefined;

    return {
      q: q.trim() || undefined,
      partId: partId || undefined,
      warehouseId: warehouseId || undefined,
      ticketId:
        typeof parsedTicketId === 'number' && Number.isFinite(parsedTicketId)
          ? parsedTicketId
          : undefined,

      docType: docType || undefined,
      movementSide: movementSide || undefined,
      status: status || undefined,

      dateFrom: dateFrom ? dateOnlyToISOStart(dateFrom) : undefined,
      dateTo: dateTo ? dateOnlyToISOEnd(dateTo) : undefined,
    };
  }, [
    q,
    partId,
    warehouseId,
    ticketId,
    docType,
    movementSide,
    status,
    dateFrom,
    dateTo,
  ]);

  async function loadOptions() {
    if (!canRead) return;
    setOptionsLoading(true);
    try {
      const [p, w] = await Promise.all([
        listPartsOptions(),
        listWarehousesOptions(),
      ]);
      setParts(p);
      setWarehouses(w);
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error cargando opciones de filtros'
      );
    } finally {
      setOptionsLoading(false);
    }
  }

  async function reload(nextPage?: number) {
    if (!canRead) return;

    const p = Math.max(nextPage ?? page, 1);

    setIsLoading(true);
    try {
      const args: KardexListArgs = {
        filters: activeFilters,
        sort,
        page: p,
        pageSize,
      };

      const res = await listKardex(args);

      setRows(res.rows);
      setCount(res.count);
      setSelectedRows([]);
      setPage(res.page);
      setPageSize(res.pageSize);
    } catch (e) {
      showToastError(e instanceof Error ? e.message : 'Error cargando Kardex');
    } finally {
      setIsLoading(false);
    }
  }

  function resetFilters() {
    setQ('');
    setPartId('');
    setWarehouseId('');
    setTicketId('');
    setDocType('');
    setMovementSide('');
    setStatus('');

    // últimos 7 días
    const from = new Date();
    from.setDate(from.getDate() - 7);

    setDateFrom(from.toISOString().slice(0, 10));
    setDateTo(new Date().toISOString().slice(0, 10));

    setSort({ by: 'occurred_at', dir: 'desc' });
    setPage(1);

    showToastSuccess('Filtros reiniciados.');
  }

  // sync selection state + checkbox indeterminate
  useEffect(() => {
    const total = rows.length;
    const selected = selectedRows.length;

    const nextChecked = total > 0 && selected === total;
    const nextInd = selected > 0 && selected < total;

    setChecked(nextChecked);
    setIndeterminate(nextInd);

    if (checkboxRef.current) checkboxRef.current.indeterminate = nextInd;
  }, [rows.length, selectedRows.length]);

  function toggleAll() {
    const shouldSelectAll = !(checked || indeterminate);
    setSelectedRows(shouldSelectAll ? rows : []);
    setChecked(shouldSelectAll);
    setIndeterminate(false);
    if (checkboxRef.current) checkboxRef.current.indeterminate = false;
  }

  function applyFiltersNow() {
    setPage(1);
    void reload(1);
  }

  function onChangeSort(next: KardexSort) {
    setSort(next);
    setPage(1);
    // recarga inmediata
    void (async () => {
      await reload(1);
    })();
  }

  function goToPage(p: number) {
    const clamped = Math.min(Math.max(p, 1), totalPages);
    void reload(clamped);
  }

  useEffect(() => {
    void loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  useEffect(() => {
    void reload(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  if (!canRead) {
    return (
      <PageShell>
        <Sidebar />
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1 p-6">
          <EmptyState
            title="Acceso restringido"
            description="No tienes permisos para acceder al módulo de inventario."
          />
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Sidebar />

      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        <KardexHeader count={count} />

        <KardexToolbar
          isLoading={isLoading}
          optionsLoading={optionsLoading}
          selectedCount={selectedRows.length}
          // values
          q={q}
          partId={partId}
          warehouseId={warehouseId}
          ticketId={ticketId}
          docType={docType}
          movementSide={movementSide}
          status={status}
          dateFrom={dateFrom}
          dateTo={dateTo}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          sort={sort}
          // options
          parts={parts}
          warehouses={warehouses}
          docTypes={DOC_TYPES}
          statuses={STATUSES}
          sides={SIDES}
          // handlers
          onChangeQ={setQ}
          onChangePartId={setPartId}
          onChangeWarehouseId={setWarehouseId}
          onChangeTicketId={setTicketId}
          onChangeDocType={setDocType}
          onChangeMovementSide={setMovementSide}
          onChangeStatus={setStatus}
          onChangeDateFrom={setDateFrom}
          onChangeDateTo={setDateTo}
          onApply={applyFiltersNow}
          onReset={resetFilters}
          onRefresh={() => void reload()}
          onChangeSort={onChangeSort}
          onChangePageSize={(n) => {
            setPageSize(n);
            setPage(1);
            void reload(1);
          }}
          onPrevPage={() => goToPage(page - 1)}
          onNextPage={() => goToPage(page + 1)}
          onGoToPage={(p) => goToPage(p)}
        />

        <section className="flex-1 min-h-0 overflow-auto px-4 md:px-6 lg:px-8 pb-6">
          <KardexMobileList
            rows={rows}
            isLoading={isLoading}
            selectedRows={selectedRows}
            setSelectedRows={setSelectedRows}
            onRowClick={(r) => {
              // placeholder: luego abrimos un drawer con detalle del movimiento/doc
              showToastSuccess(
                `Movimiento: ${r.doc_no ?? 'SIN-NO'} · ${r.part_code} · ${r.qty_delta}`
              );
            }}
          />

          <KardexTable
            rows={rows}
            isLoading={isLoading}
            selectedRows={selectedRows}
            setSelectedRows={setSelectedRows}
            checked={checked}
            indeterminate={indeterminate}
            onToggleAll={toggleAll}
            checkboxRef={checkboxRef}
            onRowClick={(r) => {
              // placeholder: luego abrimos un drawer con detalle del movimiento/doc
              showToastSuccess(
                `Movimiento: ${r.doc_no ?? 'SIN-NO'} · ${r.part_code} · ${r.qty_delta}`
              );
            }}
          />
        </section>

        {/* Footer paginación compacto (opcional, puedes moverlo a Toolbar si prefieres) */}
        <div className="border-t border-slate-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className="mx-auto max-w-[1400px] px-4 md:px-6 lg:px-8 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-600">
              Mostrando{' '}
              <span className="font-medium text-slate-900">
                {rows.length === 0 ? 0 : (page - 1) * pageSize + 1}
              </span>
              {' - '}
              <span className="font-medium text-slate-900">
                {Math.min(page * pageSize, count)}
              </span>{' '}
              de <span className="font-medium text-slate-900">{count}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className={cx(
                  'rounded-xl border px-3 py-1.5 text-sm',
                  isLoading || page <= 1
                    ? 'cursor-not-allowed border-slate-200 text-slate-400'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                )}
                disabled={isLoading || page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                Anterior
              </button>

              <div className="text-sm text-slate-700">
                Página{' '}
                <span className="font-semibold text-slate-900">{page}</span> /{' '}
                <span className="font-semibold text-slate-900">
                  {totalPages}
                </span>
              </div>

              <button
                type="button"
                className={cx(
                  'rounded-xl border px-3 py-1.5 text-sm',
                  isLoading || page >= totalPages
                    ? 'cursor-not-allowed border-slate-200 text-slate-400'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                )}
                disabled={isLoading || page >= totalPages}
                onClick={() => goToPage(page + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </main>
    </PageShell>
  );
}
