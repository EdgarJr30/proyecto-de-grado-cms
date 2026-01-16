import { useMemo, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/navigation/Navbar';
import WorkOrdersBoard from '../components/dashboard/workOrder/WorkOrdersBoard';
import WorkOrdersList from '../components/dashboard/workOrder/WorkOrdersList';
import WorkOrdersFiltersBar from '../components/dashboard/workOrder/WorkOrdersFiltersBar';
import Modal from '../components/ui/Modal';
import EditTicketModal from '../components/dashboard/workOrder/EditWorkOrdersModal';
import { updateTicket } from '../services/ticketService';
import { showToastError } from '../notifications/toast';
import type { FilterState } from '../types/filters';
import type { WorkOrdersFilterKey } from '../features/tickets/WorkOrdersFilters';
import type { WorkOrder } from '../types/Ticket';
import { toTicketUpdate } from '../utils/toTicketUpdate';

type ViewMode = 'WorkOrders' | 'list';

export default function WorkOrdersPage() {
  // 🔁 Filtros avanzados (ÚNICA fuente de verdad para filtros)
  const [filters, setFilters] = useState<Record<WorkOrdersFilterKey, unknown>>(
    {} as Record<WorkOrdersFilterKey, unknown>
  );

  // Vista actual
  const [view, setView] = useState<ViewMode>('WorkOrders');

  // Modal para LISTA (WorkOrders ya maneja su propio modal interno)
  const [selectedTicket, setSelectedTicket] = useState<WorkOrder | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [lastUpdatedTicket, setLastUpdatedTicket] = useState<WorkOrder | null>(
    null
  );

  // ✅ mergedFilters viene SOLO de FilterBar
  const mergedFilters = useMemo<FilterState<WorkOrdersFilterKey>>(
    () => filters as FilterState<WorkOrdersFilterKey>,
    [filters]
  );

  async function handleSave(patch: Partial<WorkOrder>) {
    try {
      const ticketUpdate = toTicketUpdate(patch);
      const id = Number(patch.id ?? selectedTicket?.id);
      if (!id) throw new Error('Falta el id del ticket.');

      await updateTicket(id, ticketUpdate);

      setLastUpdatedTicket(
        (prev) => ({ ...(prev ?? {}), ...(patch as WorkOrder) } as WorkOrder)
      );

      setModalOpen(false);
      setSelectedTicket(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToastError(`No se pudo actualizar el ticket. ${msg}`);
    }
  }

  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />
      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        {/* 🧭 Navbar PASIVO: no filtra ni ubicación ni búsqueda */}
        <Navbar
          onSearch={() => {}} // 👈 no-op
          onFilterLocation={() => {}} // 👈 no-op
          selectedLocation="" // 👈 siempre vacío
        />

        <header className="px-4 md:px-6 lg:px-8 pb-0 pt-4 md:pt-6 flex items-center gap-3">
          <h2 className="text-3xl font-bold">Órdenes de Trabajo</h2>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setView('WorkOrders')}
              className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium cursor-pointer
                ${
                  view === 'WorkOrders'
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              title="Vista WorkOrders"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zM3 11h6v6H3v-6zm8 6v-6h6v6h-6z" />
              </svg>
              WorkOrders
            </button>

            <button
              type="button"
              onClick={() => setView('list')}
              className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium cursor-pointer
                ${
                  view === 'list'
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              title="Vista de lista"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" />
              </svg>
              Lista
            </button>
          </div>
        </header>

        <div className="px-4 md:px-6 lg:px-8 pt-3">
          <WorkOrdersFiltersBar
            onApply={(vals) => {
              // ✅ ÚNICA sincronización de filtros
              setFilters((prev) =>
                JSON.stringify(prev) === JSON.stringify(vals) ? prev : vals
              );
            }}
          />
        </div>

        <section className="flex-1 overflow-x-auto px-4 md:px-6 lg:px-8 pt-4 pb-8">
          {view === 'WorkOrders' ? (
            <WorkOrdersBoard filters={mergedFilters} />
          ) : (
            <WorkOrdersList
              filters={mergedFilters}
              onOpen={(t) => {
                setSelectedTicket(t as WorkOrder);
                setModalOpen(true);
              }}
              lastUpdatedTicket={lastUpdatedTicket}
            />
          )}
        </section>

        {/* Modal (LISTA) */}
        <Modal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedTicket(null);
          }}
          isLocked={showFullImage}
        >
          {selectedTicket && (
            <EditTicketModal
              isOpen={modalOpen}
              onClose={() => {
                setModalOpen(false);
                setSelectedTicket(null);
              }}
              ticket={selectedTicket}
              onSave={handleSave}
              showFullImage={showFullImage}
              setShowFullImage={setShowFullImage}
            />
          )}
        </Modal>
      </main>
    </div>
  );
}
