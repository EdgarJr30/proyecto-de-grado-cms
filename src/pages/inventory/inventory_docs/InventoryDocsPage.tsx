import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../../components/layout/Sidebar';
import { usePermissions } from '../../../rbac/PermissionsContext';
import { showToastError, showToastSuccess } from '../../../notifications';

import type {
  InventoryDocRow,
  InventoryDocStatus,
  InventoryDocType,
  UUID,
} from '../../../types/inventory';

import {
  createInventoryDoc,
  listInventoryDocs,
  listWarehouses,
  type ListDocsFilters,
} from '../../../services/inventory';
import { useNavigate } from 'react-router-dom';

import { Boxes } from 'lucide-react';
import { PageShell } from './components/PageShell';
import { InventoryDocsHeader } from './components/InventoryDocsHeader';
import { InventoryDocsToolbar } from './components/InventoryDocsToolbar';
import { InventoryDocsMobileList } from './components/InventoryDocsMobileList';
import { InventoryDocsTable } from './components/InventoryDocsTable';

function EmptyState({ loading }: { loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-4">
      <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-slate-100 mb-4">
        <Boxes className="h-7 w-7 text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">
        {loading ? 'Cargando...' : 'Sin resultados'}
      </h3>
      <p className="mt-1 text-xs text-slate-500 text-center max-w-sm">
        {loading
          ? 'Estamos consultando tus documentos.'
          : 'No hay documentos con esos filtros. Prueba cambiando Tipo/Estado o el texto de búsqueda.'}
      </p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 animate-pulse space-y-3">
      <div className="h-10 bg-slate-200 rounded-xl" />
      <div className="h-10 bg-slate-200 rounded-xl" />
      <div className="h-10 bg-slate-200 rounded-xl" />
      <div className="h-10 bg-slate-200 rounded-xl" />
    </div>
  );
}

function EmptyAccessState() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
      No tienes permisos para acceder a Documentos de inventario.
    </div>
  );
}

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

export default function InventoryDocsPage() {
  const navigate = useNavigate();
  const { has } = usePermissions();

  const canRead = has('inventory:read');
  const canWrite = has('inventory:create');

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<InventoryDocRow[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<
    Array<{ id: UUID; label: string }>
  >([]);

  const [docType, setDocType] = useState<InventoryDocType | ''>('');
  const [status, setStatus] = useState<InventoryDocStatus | ''>('');
  const [warehouseId, setWarehouseId] = useState<UUID | ''>('');
  const [ticketId, setTicketId] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [q, setQ] = useState('');

  const filters: ListDocsFilters = useMemo(() => {
    const next: ListDocsFilters = {};
    const parsedTicketId = ticketId.trim() ? Number(ticketId.trim()) : NaN;

    if (docType) next.doc_type = docType;
    if (status) next.status = status;
    if (warehouseId) next.warehouse_id = warehouseId;
    if (Number.isFinite(parsedTicketId) && parsedTicketId > 0)
      next.ticket_id = parsedTicketId;
    if (createdFrom) next.created_from = dateOnlyToISOStart(createdFrom);
    if (createdTo) next.created_to = dateOnlyToISOEnd(createdTo);
    if (q.trim().length > 0) next.q = q.trim();

    return next;
  }, [createdFrom, createdTo, docType, q, status, ticketId, warehouseId]);

  async function loadWarehouses() {
    try {
      const data = await listWarehouses({
        limit: 500,
        orderBy: 'code',
        ascending: true,
        is_active: true,
      });

      setWarehouseOptions(
        data.map((warehouse) => ({
          id: warehouse.id,
          label: `${warehouse.code} — ${warehouse.name}`,
        }))
      );
    } catch (error: unknown) {
      if (error instanceof Error) showToastError(error.message);
      else showToastError('No se pudieron cargar los almacenes.');
    }
  }

  function resetFilters() {
    setDocType('');
    setStatus('');
    setWarehouseId('');
    setTicketId('');
    setCreatedFrom('');
    setCreatedTo('');
    setQ('');
  }

  async function refresh() {
    setLoading(true);
    try {
      const data = await listInventoryDocs(filters, 200);
      setRows(data);
    } catch (error: unknown) {
      if (error instanceof Error) showToastError(error.message);
      else showToastError('No se pudieron cargar los documentos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canRead) return;
    void loadWarehouses();
  }, [canRead]);

  useEffect(() => {
    if (!canRead) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, createdFrom, createdTo, docType, status, warehouseId]);

  useEffect(() => {
    if (!canRead) return;
    const timeout = window.setTimeout(() => void refresh(), 350);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, ticketId]);

  async function onCreate(type: InventoryDocType) {
    if (!canWrite) return;

    try {
      const created = await createInventoryDoc({ doc_type: type });
      showToastSuccess('Documento creado.');
      navigate(`/inventory/docs/${created.id}`);
    } catch (error: unknown) {
      if (error instanceof Error) showToastError(error.message);
      else showToastError('No se pudo crear el documento.');
    }
  }

  if (!canRead) {
    return (
      <PageShell>
        <Sidebar />
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1 p-6">
          <EmptyAccessState />
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Sidebar />

      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        <InventoryDocsHeader
          total={rows.length}
          loading={loading}
          canWrite={canWrite}
        />

        <InventoryDocsToolbar
          canWrite={canWrite}
          isLoading={loading}
          docType={docType}
          status={status}
          warehouseId={warehouseId}
          ticketId={ticketId}
          createdFrom={createdFrom}
          createdTo={createdTo}
          q={q}
          warehouseOptions={warehouseOptions}
          onDocTypeChange={setDocType}
          onStatusChange={setStatus}
          onWarehouseIdChange={setWarehouseId}
          onTicketIdChange={setTicketId}
          onCreatedFromChange={setCreatedFrom}
          onCreatedToChange={setCreatedTo}
          onQChange={setQ}
          onCreate={(type) => void onCreate(type)}
          onRefresh={() => void refresh()}
          onReset={resetFilters}
        />

        <section className="flex-1 min-h-0 overflow-auto">
          <div className="px-4 md:px-6 lg:px-8 pb-6">
            {loading && rows.length === 0 ? (
              <LoadingRows />
            ) : rows.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white">
                <EmptyState loading={loading} />
              </div>
            ) : (
              <>
                <InventoryDocsMobileList rows={rows} />
                <InventoryDocsTable rows={rows} />
              </>
            )}

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-4">
              <div className="text-xs text-slate-500">
                Tip: Post asigna doc_no automáticamente y genera ledger/stock.
                Cancel crea reversa y luego marca CANCELLED.
              </div>
            </div>
          </div>
        </section>
      </main>
    </PageShell>
  );
}
