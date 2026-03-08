import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import WorkOrdersBoard from '../components/dashboard/workOrder/WorkOrdersBoard';
import WorkOrdersList from '../components/dashboard/workOrder/WorkOrdersList';
import WorkOrdersFiltersBar from '../components/dashboard/workOrder/WorkOrdersFiltersBar';
import Modal from '../components/ui/Modal';
import EditTicketModal from '../components/dashboard/workOrder/EditWorkOrdersModal';
import WorkOrdersSettingsModal from '../components/dashboard/workOrder/WorkOrdersSettingsModal';
import { updateTicket } from '../services/ticketService';
import { showToastError } from '../notifications/toast';
import type { FilterState } from '../types/filters';
import type { WorkOrdersFilterKey } from '../features/tickets/WorkOrdersFilters';
import type { WorkOrder } from '../types/Ticket';
import { toTicketUpdate } from '../utils/toTicketUpdate';
import { motion, useReducedMotion } from 'framer-motion';
import { useCan } from '../rbac/PermissionsContext';
import { useUser } from '../context/UserContext';
import { getAssigneeByUserId } from '../services/assigneeService';
import '../styles/workOrdersAsana.css';

type ViewMode = 'board' | 'list';
type GroupMode = 'manual' | 'dateAsc' | 'dateDesc';
type AssignmentScope = 'all' | 'mine';

export default function WorkOrdersPage() {
  const prefersReducedMotion = useReducedMotion();
  const canManageWorkOrderSettings = useCan('work_orders:full_access');
  const { profile } = useUser();
  // 🔁 Filtros avanzados (ÚNICA fuente de verdad para filtros)
  const [filters, setFilters] = useState<Record<WorkOrdersFilterKey, unknown>>(
    {} as Record<WorkOrdersFilterKey, unknown>
  );
  const [assignmentScope, setAssignmentScope] =
    useState<AssignmentScope>('all');
  const [linkedAssigneeId, setLinkedAssigneeId] = useState<number | null>(null);
  const [loadingLinkedAssignee, setLoadingLinkedAssignee] = useState(false);

  // Vista actual
  const [view, setView] = useState<ViewMode>('board');
  const [groupMode, setGroupMode] = useState<GroupMode>('manual');
  const [showArchivedColumn, setShowArchivedColumn] = useState(false);

  // Modal para LISTA (WorkOrders ya maneja su propio modal interno)
  const [selectedTicket, setSelectedTicket] = useState<WorkOrder | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [nestedModalLocked, setNestedModalLocked] = useState(false);
  const [lastUpdatedTicket, setLastUpdatedTicket] = useState<WorkOrder | null>(
    null
  );

  useEffect(() => {
    const userId = profile?.id?.trim();
    if (!userId) {
      setLinkedAssigneeId(null);
      setLoadingLinkedAssignee(false);
      return;
    }

    let cancelled = false;
    setLoadingLinkedAssignee(true);

    void (async () => {
      try {
        const assignee = await getAssigneeByUserId(userId);
        if (!cancelled) {
          setLinkedAssigneeId(assignee?.id ?? null);
        }
      } catch {
        if (!cancelled) {
          setLinkedAssigneeId(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingLinkedAssignee(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const effectiveAssigneeFilter = useMemo(() => {
    if (assignmentScope !== 'mine') return undefined;
    return linkedAssigneeId ?? -1;
  }, [assignmentScope, linkedAssigneeId]);

  // ✅ mergedFilters viene SOLO de FilterBar
  const mergedFilters = useMemo<FilterState<WorkOrdersFilterKey>>(
    () =>
      ({
        ...filters,
        ...(typeof effectiveAssigneeFilter === 'number'
          ? { assignee_id: effectiveAssigneeFilter }
          : {}),
      }) as FilterState<WorkOrdersFilterKey>,
    [effectiveAssigneeFilter, filters]
  );

  const viewSwitcher = (
    <div className="wo-module-actions flex flex-wrap items-center gap-2">
      <div className="wo-view-switch inline-flex items-center gap-2 rounded-xl border border-gray-300/80 bg-white/85 px-1.5 py-1 shadow-sm">
        <button
          type="button"
          onClick={() => setAssignmentScope('all')}
          className={`wo-view-btn inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium cursor-pointer ${
            assignmentScope === 'all'
              ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
              : 'bg-transparent border-transparent text-gray-600 hover:bg-gray-50'
          }`}
          title="Ver todas las órdenes"
        >
          Todas
        </button>
        <button
          type="button"
          onClick={() => {
            if (!linkedAssigneeId) return;
            setAssignmentScope('mine');
          }}
          disabled={!linkedAssigneeId || loadingLinkedAssignee}
          className={`wo-view-btn inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium ${
            assignmentScope === 'mine'
              ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
              : 'bg-transparent border-transparent text-gray-600 hover:bg-gray-50'
          } disabled:cursor-not-allowed disabled:opacity-50`}
          title={
            linkedAssigneeId
              ? 'Ver solo las órdenes asignadas a mí'
              : 'Este usuario aún no está vinculado a un técnico'
          }
        >
          Asignadas a mí
        </button>
      </div>

      <div className="wo-view-switch inline-flex items-center gap-2 rounded-xl border border-gray-300/80 bg-white/85 px-1.5 py-1 shadow-sm">
        <button
          type="button"
          onClick={() => setView('board')}
          className={`wo-view-btn inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium cursor-pointer
            ${
              view === 'board'
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-transparent border-transparent text-gray-600 hover:bg-gray-50'
            }`}
          title="Vista Board"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zM3 11h6v6H3v-6zm8 6v-6h6v6h-6z" />
          </svg>
          Board
        </button>

        <button
          type="button"
          onClick={() => setView('list')}
          className={`wo-view-btn inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium cursor-pointer
            ${
              view === 'list'
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-transparent border-transparent text-gray-600 hover:bg-gray-50'
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

      <div className="wo-group-switch inline-flex items-center gap-1 rounded-xl border border-gray-300/80 bg-white/85 px-1.5 py-1 shadow-sm">
        <button
          type="button"
          onClick={() => setGroupMode('manual')}
          className={`wo-view-btn inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium cursor-pointer ${
            groupMode === 'manual'
              ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
              : 'bg-transparent border-transparent text-gray-600 hover:bg-gray-50'
          }`}
          title="Organización manual"
        >
          Manual
        </button>
        <button
          type="button"
          onClick={() => setGroupMode('dateAsc')}
          className={`wo-view-btn inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium cursor-pointer ${
            groupMode === 'dateAsc'
              ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
              : 'bg-transparent border-transparent text-gray-600 hover:bg-gray-50'
          }`}
          title="Agrupar por fecha ascendente"
        >
          Fecha ↑
        </button>
        <button
          type="button"
          onClick={() => setGroupMode('dateDesc')}
          className={`wo-view-btn inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium cursor-pointer ${
            groupMode === 'dateDesc'
              ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
              : 'bg-transparent border-transparent text-gray-600 hover:bg-gray-50'
          }`}
          title="Agrupar por fecha descendente"
        >
          Fecha ↓
        </button>
      </div>

      {canManageWorkOrderSettings && (
        <button
          type="button"
          onClick={() => setSettingsModalOpen(true)}
          className="wo-view-btn inline-flex items-center gap-2 rounded-xl border border-gray-300/80 bg-white/85 px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 cursor-pointer"
          title="Configurar limite de tecnicos por orden"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Zm7.4-3.5a7.4 7.4 0 0 0-.08-1l2.02-1.58-2-3.46-2.45.72a7.87 7.87 0 0 0-1.73-1L14.8 2h-4l-.36 2.68c-.62.24-1.2.58-1.73 1l-2.45-.72-2 3.46L6.28 11c-.05.33-.08.66-.08 1s.03.67.08 1l-2.02 1.58 2 3.46 2.45-.72c.53.42 1.11.76 1.73 1L10.8 22h4l.36-2.68c.62-.24 1.2-.58 1.73-1l2.45.72 2-3.46L19.32 13c.05-.33.08-.66.08-1Z"
            />
          </svg>
          Configurar tecnicos
        </button>
      )}

      {view === 'board' && (
        <button
          type="button"
          onClick={() => setShowArchivedColumn((v) => !v)}
          className={`wo-view-btn inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium cursor-pointer shadow-sm ${
            showArchivedColumn
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white/85 text-gray-700 border-gray-300/80 hover:bg-gray-50'
          }`}
          title={
            showArchivedColumn
              ? 'Ocultar columna de archivadas'
              : 'Mostrar columna de archivadas'
          }
        >
          Archivadas
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${
              showArchivedColumn
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {showArchivedColumn ? 'ON' : 'OFF'}
          </span>
        </button>
      )}
    </div>
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
    <div className="wo-asana h-screen flex bg-[#f3f4f8] dark:bg-slate-950">
      <Sidebar />
      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <motion.div
          className="wo-filters px-4 md:px-6 lg:px-8 pt-3"
          initial={
            prefersReducedMotion ? false : { opacity: 0, y: 8, scale: 0.998 }
          }
          animate={
            prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.32, ease: [0.2, 0.8, 0.2, 1], delay: 0.05 }
          }
        >
          <WorkOrdersFiltersBar
            onApply={(vals) => {
              // ✅ ÚNICA sincronización de filtros
              setFilters((prev) =>
                JSON.stringify(prev) === JSON.stringify(vals) ? prev : vals
              );
            }}
            moduleActions={viewSwitcher}
            exportMerge={
              typeof effectiveAssigneeFilter === 'number'
                ? { assignee_id: effectiveAssigneeFilter }
                : undefined
            }
          />
        </motion.div>

        <WorkOrdersSettingsModal
          open={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
        />

        <motion.section
          className="wo-content flex-1 overflow-x-auto px-4 md:px-6 lg:px-8 pt-3 pb-6"
          initial={
            prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.998 }
          }
          animate={
            prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.35, ease: [0.2, 0.8, 0.2, 1], delay: 0.1 }
          }
        >
          {view === 'board' ? (
            <WorkOrdersBoard
              filters={mergedFilters}
              groupMode={groupMode}
              showArchivedColumn={showArchivedColumn}
            />
          ) : (
            <WorkOrdersList
              filters={mergedFilters}
              groupMode={groupMode}
              onOpen={(t) => {
                setSelectedTicket(t as WorkOrder);
                setModalOpen(true);
              }}
              lastUpdatedTicket={lastUpdatedTicket}
            />
          )}
        </motion.section>

        {/* Modal (LISTA) */}
        <Modal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedTicket(null);
            setNestedModalLocked(false);
          }}
          isLocked={showFullImage || nestedModalLocked}
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
              onModalLockChange={setNestedModalLocked}
            />
          )}
        </Modal>
      </main>
    </div>
  );
}
