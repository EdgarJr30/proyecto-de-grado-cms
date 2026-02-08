import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import { usePermissions } from '../../rbac/PermissionsContext';
import { showToastError, showToastSuccess } from '../../notifications';

import type {
  InventoryDocRow,
  InventoryDocStatus,
  InventoryDocType,
  UUID,
} from '../../types/inventory';

import {
  createInventoryDoc,
  listInventoryDocs,
  type ListDocsFilters,
} from '../../services/inventory';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const DOC_TYPES: InventoryDocType[] = [
  'RECEIPT',
  'ISSUE',
  'TRANSFER',
  'ADJUSTMENT',
  'RETURN',
];

const DOC_STATUSES: InventoryDocStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];

function labelType(t: InventoryDocType) {
  switch (t) {
    case 'RECEIPT':
      return 'Entrada (RECEIPT)';
    case 'ISSUE':
      return 'Salida (ISSUE)';
    case 'TRANSFER':
      return 'Transferencia (TRANSFER)';
    case 'ADJUSTMENT':
      return 'Ajuste (ADJUSTMENT)';
    case 'RETURN':
      return 'Devolución (RETURN)';
  }
}

function badgeStatus(s: InventoryDocStatus) {
  switch (s) {
    case 'DRAFT':
      return 'bg-slate-100 text-slate-800 border-slate-200';
    case 'POSTED':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'CANCELLED':
      return 'bg-rose-100 text-rose-800 border-rose-200';
  }
}

function fmtDate(v: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  return d.toLocaleString();
}

export default function InventoryDocsPage() {
  const nav = useNavigate();
  const { has } = usePermissions();

  const canRead = has('inventory:read');
  const canWrite = has('inventory:create');

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<InventoryDocRow[]>([]);

  // filtros
  const [docType, setDocType] = useState<InventoryDocType | ''>('');
  const [status, setStatus] = useState<InventoryDocStatus | ''>('');
  const [q, setQ] = useState('');

  const filters: ListDocsFilters = useMemo(() => {
    const f: ListDocsFilters = {};
    if (docType) f.doc_type = docType;
    if (status) f.status = status;
    if (q.trim().length > 0) f.q = q.trim();
    return f;
  }, [docType, status, q]);

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
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, docType, status]);

  // debounce para q
  useEffect(() => {
    if (!canRead) return;
    const t = window.setTimeout(() => void refresh(), 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function onCreate(doc_type: InventoryDocType) {
    if (!canWrite) return;
    try {
      const created = await createInventoryDoc({ doc_type });
      showToastSuccess('Documento creado.');
      nav(`/inventory/docs/${created.id}`);
    } catch (error: unknown) {
      if (error instanceof Error) showToastError(error.message);
      else showToastError('No se pudo crear el documento.');
    }
  }

  if (!canRead) {
    return (
      <div className="h-screen flex bg-gray-100">
        <Sidebar />
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
          <div className="p-6">
            <div className="rounded-2xl border bg-white p-6 text-sm text-gray-700">
              No tienes permisos para acceder a Documentos de inventario.
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />

      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <header className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-bold">Documentos de inventario</h2>
              <p className="text-sm text-gray-600">
                DRAFT → líneas → Post. Cancel crea reversa y marca CANCELLED.
              </p>
            </div>

            <Link
              to="/inventario"
              className="text-sm text-gray-700 hover:text-gray-900"
            >
              ← Volver a Inventario
            </Link>
          </div>
        </header>

        <section className="px-4 md:px-6 lg:px-8 py-4 overflow-auto">
          <div className="rounded-2xl border bg-white shadow-sm">
            {/* Toolbar */}
            <div className="p-4 border-b">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">Tipo</label>
                    <select
                      className="h-9 rounded-xl border px-3 text-sm bg-white"
                      value={docType}
                      onChange={(e) =>
                        setDocType(e.target.value as InventoryDocType | '')
                      }
                    >
                      <option value="">Todos</option>
                      {DOC_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {labelType(t)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">Estado</label>
                    <select
                      className="h-9 rounded-xl border px-3 text-sm bg-white"
                      value={status}
                      onChange={(e) =>
                        setStatus(e.target.value as InventoryDocStatus | '')
                      }
                    >
                      <option value="">Todos</option>
                      {DOC_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">Buscar</label>
                    <input
                      className="h-9 w-full sm:w-[320px] rounded-xl border px-3 text-sm"
                      placeholder="doc_no o reference…"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {DOC_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={!canWrite}
                      onClick={() => void onCreate(t)}
                      className={cx(
                        'h-9 rounded-xl border px-3 text-sm transition',
                        'bg-gray-50 hover:bg-gray-100',
                        !canWrite && 'opacity-50 cursor-not-allowed'
                      )}
                      title={
                        canWrite
                          ? 'Crear documento'
                          : 'No tienes inventory:create'
                      }
                    >
                      + {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Doc</th>
                    <th className="text-left font-medium px-4 py-3">Tipo</th>
                    <th className="text-left font-medium px-4 py-3">Estado</th>
                    <th className="text-left font-medium px-4 py-3">Ticket</th>
                    <th className="text-left font-medium px-4 py-3">
                      Referencia
                    </th>
                    <th className="text-left font-medium px-4 py-3">Creado</th>
                    <th className="text-left font-medium px-4 py-3">Posted</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <Link
                          to={`/inventory/docs/${r.id}`}
                          className="font-medium text-gray-900 hover:underline"
                        >
                          {r.doc_no ?? (r.id as UUID).slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{r.doc_type}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cx(
                            'inline-flex items-center rounded-full border px-2.5 py-1 text-xs',
                            badgeStatus(r.status)
                          )}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.ticket_id ?? (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.reference ?? (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{fmtDate(r.created_at)}</td>
                      <td className="px-4 py-3">{fmtDate(r.posted_at)}</td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td
                        className="px-4 py-10 text-center text-gray-500"
                        colSpan={7}
                      >
                        {loading
                          ? 'Cargando…'
                          : 'No hay documentos con esos filtros.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 text-xs text-gray-500">
              Tip: Post asigna doc_no automáticamente y genera ledger/stock.
              Cancel crea reversa y luego marca CANCELLED.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
