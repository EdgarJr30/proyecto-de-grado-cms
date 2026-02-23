import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ClipboardCheck, RefreshCcw, Search } from 'lucide-react';
import Sidebar from '../../components/layout/Sidebar';
import { usePermissions } from '../../rbac/PermissionsContext';
import { showToastError } from '../../notifications';
import { listAcceptedWorkOrders } from '../../services/inventory/inventoryRequests';
import TicketPartsPanel from './parts/TicketPartsPanel';
import type { TicketWoPick } from '../../types/inventory/inventoryRequests';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function InventoryReservationsPage() {
  const { has } = usePermissions();
  const canRead = has('inventory:read');
  const canWork = has(['inventory:work', 'inventory:create', 'inventory:full_access']);

  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<TicketWoPick[]>([]);
  const [ticketId, setTicketId] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  async function loadTickets() {
    setLoading(true);
    try {
      const data = await listAcceptedWorkOrders(300);
      setTickets(data);
      setTicketId((prev) => {
        if (prev && data.some((t) => t.id === prev)) return prev;
        return data[0]?.id ?? null;
      });
    } catch (error: unknown) {
      if (error instanceof Error) showToastError(error.message);
      else showToastError('No se pudieron cargar las OT aceptadas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canRead) return;
    void loadTickets();
  }, [canRead]);

  const filteredTickets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((t) => {
      const haystack = [
        String(t.id),
        t.title ?? '',
        t.requester ?? '',
        t.status ?? '',
        t.priority ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [tickets, query]);

  const selectedTicket = useMemo(
    () => tickets.find((t) => t.id === ticketId) ?? null,
    [tickets, ticketId]
  );

  if (!canRead) {
    return (
      <div className="h-screen flex bg-slate-50 text-slate-900">
        <Sidebar />
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
          <div className="p-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              No tienes permisos para acceder al módulo de inventario.
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-slate-50 text-slate-900">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        <header className="shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="px-4 md:px-6 lg:px-8 py-4">
            <div className="flex flex-col gap-3">
              <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                <Link to="/inventario" className="hover:text-slate-900">
                  Inventario
                </Link>
                <ChevronRight className="h-3 w-3" />
                <span className="text-slate-900 font-medium">Reservas por OT</span>
              </nav>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-amber-100">
                    <ClipboardCheck className="h-5 w-5 text-amber-700" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-lg md:text-xl font-bold tracking-tight">
                      Reservas por OT (tickets)
                    </h1>
                    <p className="mt-1 text-xs md:text-sm text-slate-500">
                      Reserva, entrega, devolución y liberación de repuestos por
                      orden de trabajo.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void loadTickets()}
                  disabled={loading}
                  className={cx(
                    'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition',
                    loading
                      ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed'
                      : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50'
                  )}
                >
                  <RefreshCcw className={cx('h-4 w-4', loading && 'animate-spin')} />
                  Actualizar OT
                </button>
              </div>
            </div>
          </div>
        </header>

        <section className="flex-1 min-h-0 overflow-auto bg-slate-100/60">
          <div className="px-4 md:px-6 lg:px-8 py-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                <div className="lg:col-span-4">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Buscar OT aceptada
                  </label>
                  <div className="mt-1 relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      placeholder="ID, título, solicitante, estado..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="lg:col-span-5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    OT seleccionada
                  </label>
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    value={ticketId ?? ''}
                    onChange={(e) =>
                      setTicketId(e.target.value ? Number(e.target.value) : null)
                    }
                    disabled={loading}
                  >
                    {filteredTickets.length === 0 ? (
                      <option value="">Sin resultados</option>
                    ) : null}
                    {filteredTickets.map((t) => (
                      <option key={t.id} value={t.id}>
                        #{t.id} — {t.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 h-10 mt-6 text-xs text-slate-600 flex items-center">
                    {selectedTicket ? (
                      <span className="truncate">
                        Estado: <b>{selectedTicket.status ?? '—'}</b> ·
                        Prioridad: <b>{selectedTicket.priority ?? '—'}</b>
                      </span>
                    ) : (
                      <span>Selecciona una OT para gestionar reservas.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {!canWork ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Tienes permiso de lectura, pero no de operación (
                <span className="font-mono">inventory:work</span> /{' '}
                <span className="font-mono">inventory:create</span> /{' '}
                <span className="font-mono">inventory:full_access</span>).
              </div>
            ) : null}

            {selectedTicket ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900">
                    OT #{selectedTicket.id} — {selectedTicket.title}
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    Solicitante: {selectedTicket.requester ?? '—'}
                  </span>
                </div>

                {canWork ? (
                  <TicketPartsPanel
                    ticketId={selectedTicket.id}
                    isAccepted={true}
                    enableWorkflowActions={true}
                  />
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    No tienes permisos para operar reservas/consumos en esta OT.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
                {loading
                  ? 'Cargando OT aceptadas...'
                  : 'No hay OT aceptadas disponibles para operar.'}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
