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

import {
  ChevronRight,
  FileText,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRightLeft,
  SlidersHorizontal,
  RotateCcw,
  Plus,
  Search,
  Filter,
  ArrowLeft,
  CircleDot,
  Boxes,
} from 'lucide-react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function SeparatorLite(props: {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}) {
  const o = props.orientation ?? 'horizontal';
  return (
    <div
      className={cx(
        o === 'horizontal' ? 'h-px w-full' : 'w-px h-full',
        'bg-slate-200',
        props.className
      )}
    />
  );
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

function docTypeIcon(t: InventoryDocType) {
  switch (t) {
    case 'RECEIPT':
      return ArrowDownToLine;
    case 'ISSUE':
      return ArrowUpFromLine;
    case 'TRANSFER':
      return ArrowRightLeft;
    case 'ADJUSTMENT':
      return SlidersHorizontal;
    case 'RETURN':
      return RotateCcw;
  }
}

function docTypeBadgeClass(t: InventoryDocType) {
  switch (t) {
    case 'RECEIPT':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'ISSUE':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'TRANSFER':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'ADJUSTMENT':
      return 'bg-violet-50 text-violet-700 border-violet-200';
    case 'RETURN':
      return 'bg-rose-50 text-rose-700 border-rose-200';
  }
}

function statusBadge(s: InventoryDocStatus) {
  switch (s) {
    case 'DRAFT':
      return {
        text: 'BORRADOR',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
      };
    case 'POSTED':
      return {
        text: 'POSTEADO',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
      };
    case 'CANCELLED':
      return {
        text: 'CANCELADO',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500',
      };
  }
}

function fmtDate(v: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  return d.toLocaleString();
}

function LoadingRows() {
  return (
    <div className="p-5 animate-pulse space-y-3">
      <div className="h-10 bg-slate-200 rounded" />
      <div className="h-10 bg-slate-200 rounded" />
      <div className="h-10 bg-slate-200 rounded" />
      <div className="h-10 bg-slate-200 rounded" />
    </div>
  );
}

function EmptyState(props: { loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-4">
      <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-slate-100 mb-4">
        <Boxes className="h-7 w-7 text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">
        {props.loading ? 'Cargando…' : 'Sin resultados'}
      </h3>
      <p className="mt-1 text-xs text-slate-500 text-center max-w-sm">
        {props.loading
          ? 'Estamos consultando tus documentos.'
          : 'No hay documentos con esos filtros. Prueba cambiando Tipo/Estado o el texto de búsqueda.'}
      </p>
    </div>
  );
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

  async function onCreate(nextType: InventoryDocType) {
    if (!canWrite) return;
    try {
      const created = await createInventoryDoc({ doc_type: nextType });
      showToastSuccess('Documento creado.');
      nav(`/inventory/docs/${created.id}`);
    } catch (error: unknown) {
      if (error instanceof Error) showToastError(error.message);
      else showToastError('No se pudo crear el documento.');
    }
  }

  if (!canRead) {
    return (
      <div className="h-screen flex bg-slate-50 text-slate-900">
        <Sidebar />
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
          <div className="p-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              No tienes permisos para acceder a Documentos de inventario.
            </div>
          </div>
        </main>
      </div>
    );
  }

  const total = rows.length;

  return (
    <div className="h-screen flex bg-slate-50 text-slate-900">
      <Sidebar />

      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        {/* Header */}
        <header className="shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="px-4 md:px-6 lg:px-8 py-4">
            <div className="flex flex-col gap-3">
              <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                <Link to="/inventario" className="hover:text-slate-900">
                  Inventario
                </Link>
                <ChevronRight className="h-3 w-3" />
                <span className="text-slate-900 font-medium">Documentos</span>
              </nav>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-blue-50">
                    <FileText className="h-5 w-5 text-blue-700" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-lg md:text-xl font-bold tracking-tight">
                        Documentos de inventario
                      </h1>

                      <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        <span className="tabular-nums">{total}</span> resultados
                      </span>

                      {loading ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                          <CircleDot className="h-3 w-3" />
                          Cargando
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      DRAFT → líneas → Post. Cancel crea reversa y marca
                      CANCELLED.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Link
                    to="/inventory"
                    className="inline-flex items-center h-9 px-3 rounded-md border border-slate-200 bg-white text-sm font-semibold hover:bg-slate-50"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Body */}
        <section className="flex-1 min-h-0 overflow-auto">
          <div className="px-4 md:px-6 lg:px-8 py-6 space-y-5">
            {/* Toolbar card */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <Filter className="h-4 w-4 text-blue-700" />
                      Filtros
                    </span>
                  </div>

                  <SeparatorLite
                    orientation="vertical"
                    className="h-6 hidden sm:block"
                  />

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Tipo
                      </label>
                      <select
                        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Estado
                      </label>
                      <select
                        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Buscar
                      </label>
                      <div className="relative w-full sm:w-[340px]">
                        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          placeholder="doc_no o reference…"
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Create buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {DOC_TYPES.map((t) => {
                    const Icon = docTypeIcon(t);
                    const pastel = docTypeBadgeClass(t);

                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={!canWrite}
                        onClick={() => void onCreate(t)}
                        className={cx(
                          'inline-flex items-center h-9 px-3 rounded-md border text-sm font-semibold transition',
                          'bg-white hover:bg-slate-50 border-slate-200',
                          !canWrite && 'opacity-50 cursor-not-allowed'
                        )}
                        title={
                          canWrite ? `Crear ${t}` : 'No tienes inventory:create'
                        }
                      >
                        <span
                          className={cx(
                            'inline-flex items-center justify-center h-6 w-6 rounded-md border mr-2',
                            pastel
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <Plus className="h-4 w-4 mr-1.5 text-slate-500" />
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Table */}
              {loading && rows.length === 0 ? (
                <LoadingRows />
              ) : rows.length === 0 ? (
                <EmptyState loading={loading} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white sticky top-0 z-10">
                      <tr className="border-b border-slate-200">
                        <th className="text-left font-semibold text-slate-600 px-5 py-3">
                          Doc
                        </th>
                        <th className="text-left font-semibold text-slate-600 px-5 py-3">
                          Tipo
                        </th>
                        <th className="text-left font-semibold text-slate-600 px-5 py-3">
                          Estado
                        </th>
                        <th className="text-left font-semibold text-slate-600 px-5 py-3">
                          Ticket
                        </th>
                        <th className="text-left font-semibold text-slate-600 px-5 py-3">
                          Referencia
                        </th>
                        <th className="text-left font-semibold text-slate-600 px-5 py-3">
                          Creado
                        </th>
                        <th className="text-left font-semibold text-slate-600 px-5 py-3">
                          Posteado
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {rows.map((r) => {
                        const s = statusBadge(r.status);
                        const TypeIcon = docTypeIcon(r.doc_type);

                        return (
                          <tr
                            key={r.id}
                            className="hover:bg-slate-50/70 transition"
                          >
                            <td className="px-5 py-3">
                              <Link
                                to={`/inventory/docs/${r.id}`}
                                className="font-semibold text-slate-900 hover:underline"
                              >
                                {r.doc_no ?? (r.id as UUID).slice(0, 8)}
                              </Link>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {r.doc_no ? (r.id as UUID).slice(0, 8) : '—'}
                              </div>
                            </td>

                            <td className="px-5 py-3">
                              <span className="inline-flex items-center gap-2">
                                <span
                                  className={cx(
                                    'inline-flex items-center justify-center h-7 w-7 rounded-lg border',
                                    docTypeBadgeClass(r.doc_type)
                                  )}
                                >
                                  <TypeIcon className="h-4 w-4" />
                                </span>
                                <span className="font-medium text-slate-800">
                                  {r.doc_type}
                                </span>
                              </span>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {labelType(r.doc_type)}
                              </div>
                            </td>

                            <td className="px-5 py-3">
                              <span
                                className={cx(
                                  'inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-semibold',
                                  s.className
                                )}
                              >
                                <span
                                  className={cx(
                                    'h-1.5 w-1.5 rounded-full',
                                    s.dot
                                  )}
                                />
                                {s.text}
                              </span>
                            </td>

                            <td className="px-5 py-3">
                              {r.ticket_id ?? (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            <td className="px-5 py-3 max-w-[320px]">
                              <div className="truncate">
                                {r.reference ?? (
                                  <span className="text-slate-400">—</span>
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-3 text-slate-700">
                              {fmtDate(r.created_at)}
                            </td>

                            <td className="px-5 py-3 text-slate-700">
                              {fmtDate(r.posted_at)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="px-5 py-4 border-t border-slate-100 bg-white">
                <div className="text-xs text-slate-500">
                  Tip: Post asigna doc_no automáticamente y genera ledger/stock.
                  Cancel crea reversa y luego marca CANCELLED.
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
