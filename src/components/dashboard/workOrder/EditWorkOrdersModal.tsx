import React, { useState, useEffect, useRef, type JSX } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  Archive,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  ImageIcon,
  Info,
  MapPin,
  MessageSquare,
  Package,
  Save,
  ShieldCheck,
  UserRound,
  Wrench,
} from 'lucide-react';
import type { WorkOrder } from '../../../types/Ticket';
import { toTicketUpdate } from '../../../utils/toTicketUpdate';
import { useAssignees } from '../../../context/AssigneeContext';
import { STATUSES } from '../../../constants/const_ticket';
import {
  getTicketImagePaths,
  getPublicImageUrl,
} from '../../../services/storageService';
import { MAX_COMMENTS_LENGTH } from '../../../utils/validators';
import { archiveTicket, unarchiveTicket } from '../../../services/ticketService';
import { formatAssigneeFullName } from '../../../services/assigneeService';
import type { Assignee } from '../../../types/Assignee';
import { useCan } from '../../../rbac/PermissionsContext';
import { useSettings } from '../../../context/SettingsContext';
import {
  acceptWorkOrderWithPrimary,
  setSecondaryAssignees,
} from '../../../services/ticketService';
import {
  showToastSuccess,
  showToastError,
  confirmArchiveWorkOrder,
} from '../../../notifications/index';
import TicketPartsPanel from '../../../pages/inventory/parts/TicketPartsPanel';
import TicketAssetsPanel from '../../../pages/inventory/assets/TicketAssetsPanel';
import { useLocationCatalog } from '../../../hooks/useLocationCatalog';
import { normalizeLocationId } from '../../../utils/locationId';
import AnimatedDialog from '../../ui/AnimatedDialog';
import TicketChatPanel from '../../tickets/TicketChatPanel';
import { getCurrentUserId } from '../../../services/userService';
import {
  amIApprovalRequester,
  amITicketApprover,
  getLatestApprovalForTicket,
  getTicketPendingApprovers,
  uploadApprovalEvidence,
  requestTicketApproval,
  decideTicketApproval,
  parseEvidencePaths,
  type ApprovalRequest,
  type TicketApprover,
} from '../../../services/approvalService';

interface EditWorkOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: WorkOrder;
  onSave: (patch: Partial<WorkOrder>) => void | Promise<void>;
  showFullImage: boolean;
  setShowFullImage: React.Dispatch<React.SetStateAction<boolean>>;
  getSpecialIncidentAdornment?: (t: WorkOrder) => JSX.Element | null;
  forceReadOnly?: boolean;
  onModalLockChange?: (locked: boolean) => void;
  /** Se llama tras enviar a validación / aprobar / rechazar para refrescar la vista. */
  onApprovalChanged?: () => void | Promise<void>;
  /** Abre directamente el modal de evidencia (p. ej. al intentar finalizar desde el tablero). */
  autoOpenEvidence?: boolean;
}

export default function EditWorkOrdersModal({
  onClose,
  ticket,
  onSave,
  setShowFullImage,
  getSpecialIncidentAdornment,
  forceReadOnly = false,
  onModalLockChange,
  onApprovalChanged,
  autoOpenEvidence = false,
}: EditWorkOrdersModalProps) {
  const [edited, setEdited] = useState<WorkOrder>(ticket);
  const [fullImageIdx, setFullImageIdx] = useState<number | null>(null);
  const [chatModalOpen, setChatModalOpen] = useState(false);

  // --- Aprobación / validación de cierre ---
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isRequester, setIsRequester] = useState(false);
  const [isTicketApprover, setIsTicketApprover] = useState(false);
  const [latestApproval, setLatestApproval] = useState<ApprovalRequest | null>(null);
  const [pendingApprovers, setPendingApprovers] = useState<TicketApprover[]>([]);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidenceNote, setEvidenceNote] = useState('');
  const [submittingEvidence, setSubmittingEvidence] = useState(false);
  const [decisionNote, setDecisionNote] = useState('');
  const [deciding, setDeciding] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const { loading: loadingAssignees, bySectionActive } = useAssignees();
  const { maxSecondary } = useSettings();
  const { filterOptions, locationNameById } = useLocationCatalog({
    includeInactive: true,
    activeOnlyOptions: false,
  });

  const SECTIONS_ORDER: Array<
    'SIN ASIGNAR' | 'Internos' | 'TERCEROS' | 'OTROS'
  > = ['SIN ASIGNAR', 'Internos', 'TERCEROS', 'OTROS'];

  const canFullAccess = useCan('work_orders:full_access');
  const canApprovalsFullAccess = useCan('approvals:full_access');

  const pendingApproval =
    latestApproval && latestApproval.status === 'pending' ? latestApproval : null;
  // Mientras está en validación, NADIE edita campos desde este modal.
  const inValidation = edited.status === 'En Validación' && !!pendingApproval;
  const viewerIsApprover =
    !!currentUserId && pendingApprovers.some((a) => a.id === currentUserId);
  const rejectedNote =
    latestApproval && latestApproval.status === 'rejected'
      ? latestApproval.decision_note
      : null;
  const evidencePaths = pendingApproval
    ? parseEvidencePaths(pendingApproval.evidence_image)
    : [];

  // Orden finalizada: un técnico/solicitante ya no puede actualizarla ni cambiar
  // su estado; solo un aprobador del ticket o un admin de aprobaciones puede.
  const finalizedLockedForTech =
    edited.status === 'Finalizadas' &&
    isRequester &&
    !isTicketApprover &&
    !canApprovalsFullAccess;

  const isReadOnly =
    forceReadOnly || !canFullAccess || inValidation || finalizedLockedForTech;
  const canInventoryRead = useCan('inventory:read');
  const canInventoryOperate = useCan([
    'inventory:work',
    'inventory:create',
    'inventory:full_access',
  ]);
  const canUseTicketPartsPanel = canInventoryRead && canInventoryOperate;
  const canAssetsUpdate = useCan(['assets:update', 'assets:full_access']);
  const selectedLocationId = normalizeLocationId(edited.location_id);
  const selectedLocationName = (() => {
    const fromTicket = (edited as WorkOrder & { location_name?: string | null })
      .location_name;
    if (fromTicket) return fromTicket;
    if (selectedLocationId != null) {
      return locationNameById.get(selectedLocationId) ?? 'Sin ubicación';
    }
    return 'No especificada';
  })();
  const hasSelectedLocationOption =
    selectedLocationId != null &&
    filterOptions.some((opt) => Number(opt.value) === selectedLocationId);

  // --- principal & secundarios ---
  const [primaryId, setPrimaryId] = useState<number | ''>(
    ticket.primary_assignee_id ?? ticket.assignee_id ?? ''
  );
  const [secondaryIds, setSecondaryIds] = useState<number[]>(
    ticket.secondary_assignee_ids ?? []
  );

  const addSecondary = (id: number) => {
    if (isReadOnly || !id) return;
    if (typeof primaryId === 'number' && id === primaryId) return;
    const next = uniqSorted([...secondaryIds, id]);
    if (next.length > maxSecondary) {
      showToastError(`Máximo ${maxSecondary} técnicos secundarios.`);
      return;
    }
    setSecondaryIds(next);
  };

  const removeSecondary = (id: number) =>
    setSecondaryIds(secondaryIds.filter((x) => x !== id));

  // === Helpers de normalización y comparación
  const uniqSorted = (arr: number[]) =>
    Array.from(new Set(arr)).sort((a, b) => a - b);

  const sameArray = (a: number[], b: number[]) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  };

  // Guardamos la lista inicial (normalizada) para detectar cambios reales
  const initialSecondaryRef = useRef<number[]>(
    uniqSorted(ticket.secondary_assignee_ids ?? [])
  );

  // Sincroniza refs cuando cambie el ticket
  useEffect(() => {
    setEdited(ticket);
    setChatModalOpen(false);
    setPrimaryId(ticket.primary_assignee_id ?? ticket.assignee_id ?? '');
    const initial = uniqSorted(ticket.secondary_assignee_ids ?? []);
    setSecondaryIds(initial);
    initialSecondaryRef.current = initial; // 👈 importante
  }, [ticket]);

  useEffect(() => {
    onModalLockChange?.(chatModalOpen);
    return () => onModalLockChange?.(false);
  }, [chatModalOpen, onModalLockChange]);

  const loadApprovalContext = async () => {
    try {
      const tid = Number(ticket.id);
      const [uid, requester, ticketApprover, latest, approvers] = await Promise.all([
        getCurrentUserId(),
        amIApprovalRequester(),
        amITicketApprover(tid),
        getLatestApprovalForTicket(tid),
        getTicketPendingApprovers(tid),
      ]);
      setCurrentUserId(uid);
      setIsRequester(requester);
      setIsTicketApprover(ticketApprover);
      setLatestApproval(latest);
      setPendingApprovers(approvers);
    } catch {
      /* best-effort: la validación de cierre no debe romper el modal */
    }
  };

  useEffect(() => {
    void loadApprovalContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id]);

  // Abre el modal de evidencia automáticamente cuando se solicita desde el tablero.
  useEffect(() => {
    if (autoOpenEvidence) setEvidenceOpen(true);
  }, [autoOpenEvidence]);

  // Si el principal es uno de los secundarios, lo quitamos de secundarios
  useEffect(() => {
    if (typeof primaryId === 'number') {
      setSecondaryIds((prev) => prev.filter((id) => id !== primaryId));
    }
  }, [primaryId]);

  // Cierra el lightbox con ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowFullImage(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowFullImage]);

  // Auto-ajusta altura del título
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [edited.title]);

  const handleChange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>
      | React.ChangeEvent<HTMLSelectElement>
  ) => {
    if (isReadOnly) return;
    const { name, type, value } = e.target;
    if (type === 'checkbox') {
      setEdited({
        ...edited,
        [name]: (e.target as HTMLInputElement).checked,
      } as WorkOrder);
      return;
    }
    if (name === 'deadline_date') {
      setEdited({
        ...edited,
        deadline_date: value?.trim() ? value : undefined,
      });
      return;
    }
    setEdited({ ...edited, [name]: value } as WorkOrder);
  };

  // Guardar cambios generales + secundarios
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Técnico dentro de un proceso de aprobación: no puede finalizar directo.
    if (
      isRequester &&
      edited.status === 'Finalizadas' &&
      ticket.status !== 'Finalizadas'
    ) {
      showToastError(
        'Debes cargar la evidencia del trabajo finalizado antes de cerrar la orden.'
      );
      setEvidenceOpen(true);
      return;
    }

    if (!canFullAccess) return;

    try {
      // Normaliza secundarios antes de comparar/enviar
      const normalizedCurrent = uniqSorted(
        secondaryIds.filter((id) =>
          typeof primaryId === 'number' ? id !== primaryId : true
        )
      );
      const normalizedInitial = initialSecondaryRef.current;
      const secondariesChanged = !sameArray(
        normalizedCurrent,
        normalizedInitial
      );

      if (edited.is_accepted && secondariesChanged) {
        // Validación de tope por si acaso
        if (normalizedCurrent.length > maxSecondary) {
          throw new Error(
            `Máximo ${maxSecondary} técnicos secundarios activos por work_order.`
          );
        }
        await setSecondaryAssignees(Number(edited.id), normalizedCurrent);
        // Actualiza baseline después de guardar
        initialSecondaryRef.current = normalizedCurrent;
      }

      // --- Fecha estimada: valida SOLO si cambió ---
      const todayISO = new Date().toISOString().slice(0, 10);
      const deadlineChanged = edited.deadline_date !== ticket.deadline_date;

      if (
        deadlineChanged &&
        edited.deadline_date &&
        edited.deadline_date < todayISO
      ) {
        showToastError('La fecha estimada debe ser hoy o posterior.');
        return;
      }

      // Patch (siempre incluye deadline_date para mantener estado/UI consistente)
      const patch: Partial<WorkOrder> = {
        ...toTicketUpdate({
          ...edited,
          assignee_id:
            typeof primaryId === 'number' ? primaryId : edited.assignee_id,
        }),
        id: edited.id,
        primary_assignee_id: typeof primaryId === 'number' ? primaryId : null,
        secondary_assignee_ids: normalizedCurrent,
        // 👇 importante: mantener la fecha actual (aunque no haya cambiado)
        deadline_date: edited.deadline_date ?? undefined,
      };

      await onSave(patch);

      showToastSuccess('Cambios guardados.');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToastError(`No se pudo guardar: ${msg}`);
    }
  };

  const handleAcceptWithPrimary = async () => {
    if (!canFullAccess) return;
    if (!primaryId || typeof primaryId !== 'number') {
      showToastError('Selecciona un responsable principal para aceptar.');
      return;
    }
    try {
      await acceptWorkOrderWithPrimary(Number(edited.id), primaryId);

      onSave({
        // columnas reales del ticket (si quieres reflejarlas)
        ...toTicketUpdate({
          ...edited,
          is_accepted: true,
          assignee_id: primaryId,
        }),
        // y los EXTRAS para la UI
        id: edited.id,
        is_accepted: true,
        primary_assignee_id: primaryId,
        // no toques secundarios aquí, deja los que ya tenga el estado/BD
      });

      showToastSuccess('Orden aceptada y responsable asignado.');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToastError(msg);
    }
  };

  const submitEvidence = async () => {
    if (evidenceFiles.length === 0) {
      showToastError('Debes adjuntar al menos una imagen del trabajo terminado.');
      return;
    }
    setSubmittingEvidence(true);
    try {
      const paths = await uploadApprovalEvidence(Number(ticket.id), evidenceFiles);
      await requestTicketApproval({
        ticketId: Number(ticket.id),
        evidencePaths: paths,
        note: evidenceNote,
      });
      showToastSuccess('Enviado a validación. El aprobador fue notificado.');
      setEvidenceOpen(false);
      setEvidenceFiles([]);
      setEvidenceNote('');
      // El RPC ya cambió el estado en BD; solo refrescamos la vista.
      await onApprovalChanged?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToastError(msg);
    } finally {
      setSubmittingEvidence(false);
    }
  };

  const handleDecision = async (approve: boolean) => {
    if (!pendingApproval) return;
    if (!approve && decisionNote.trim().length === 0) {
      showToastError('Debes indicar un comentario para rechazar la solicitud.');
      return;
    }
    setDeciding(true);
    try {
      await decideTicketApproval({
        requestId: pendingApproval.id,
        approve,
        note: decisionNote,
      });
      showToastSuccess(approve ? 'Orden validada y finalizada.' : 'Solicitud rechazada.');
      setDecisionNote('');
      // El RPC ya actualizó el estado en BD; solo refrescamos la vista.
      await onApprovalChanged?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToastError(msg);
    } finally {
      setDeciding(false);
    }
  };

  if (!ticket) return null;

  // Opciones de técnicos
  // El responsable principal debe ser un técnico CON usuario en la plataforma
  // (es quien podrá dar seguimiento y solicitar la validación de cierre).
  const renderAssigneeOptions = () =>
    SECTIONS_ORDER.map((grupo) => {
      const linked = (bySectionActive[grupo] ?? []).filter(
        (a: Assignee | undefined): a is Assignee => Boolean(a && a.user_id)
      );
      if (linked.length === 0) return null;
      return (
        <optgroup key={grupo} label={grupo}>
          {linked.map((a) => (
            <option key={a.id} value={a.id}>
              {formatAssigneeFullName(a)}
            </option>
          ))}
        </optgroup>
      );
    });

  // === deadline helpers ===
  const todayISO = new Date().toISOString().slice(0, 10);
  const hasExistingDeadline = !!ticket.deadline_date;
  // Si ya existe fecha, NO aplicamos min para evitar el tooltip del navegador.
  // Si NO existe, obligamos a que sea >= hoy.
  const minForDeadline = hasExistingDeadline ? undefined : todayISO;
  const statusTone =
    edited.status === 'Finalizadas'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
      : edited.status === 'En Validación'
        ? 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200'
        : edited.status === 'En Ejecución'
          ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200'
          : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200';
  const sectionCard =
    'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 sm:p-5';
  const sectionHeader =
    'mb-4 flex items-start gap-3 border-b border-slate-100 pb-3 dark:border-slate-800';
  const sectionIcon =
    'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  const labelClass =
    'block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
  const readOnlyControlClass =
    'mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 shadow-inner outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100';
  const editableControlClass =
    'mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-600 dark:bg-slate-950/50 dark:text-slate-100 dark:focus:ring-indigo-500/25 dark:disabled:bg-slate-800/70';
  const disabledSoftClass = isReadOnly ? ' opacity-60 cursor-not-allowed' : '';

  return (
    <form onSubmit={handleSave} className="space-y-5 text-slate-900 dark:text-slate-100">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-5 pr-16 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 sm:pr-20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <ClipboardList className="h-3.5 w-3.5" />
                OT #{edited.id}
              </span>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusTone}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {edited.status}
              </span>
              {edited.is_urgent && (
                <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Urgente
                </span>
              )}
              {isReadOnly && (
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Solo lectura
                </span>
              )}
            </div>
            <h2 className="wrap-anywhere text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              {edited.title || 'Orden de trabajo'}
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              Revisa la solicitud, asigna responsables, planifica la atención y conserva la trazabilidad operativa de esta orden.
            </p>
          </div>

          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-950/50 sm:min-w-[17rem]">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <UserRound className="h-4 w-4 text-indigo-500 dark:text-indigo-300" />
                Responsable
              </span>
              <span className="min-w-0 truncate font-semibold text-slate-900 dark:text-slate-100">
                {typeof primaryId === 'number'
                  ? (() => {
                      for (const g of SECTIONS_ORDER) {
                        const hit = (bySectionActive[g] ?? []).find((a) => a?.id === primaryId);
                        if (hit) return formatAssigneeFullName(hit);
                      }
                      return `#${primaryId}`;
                    })()
                  : 'Sin asignar'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <MapPin className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />
                Ubicación
              </span>
              <span className="min-w-0 truncate font-semibold text-slate-900 dark:text-slate-100">
                {selectedLocationName}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <div className="space-y-5">
          <section className={sectionCard}>
            <div className={sectionHeader}>
              <span className={sectionIcon}>
                <ClipboardList className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                  Datos de la solicitud
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Información original registrada por el solicitante.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>ID</label>
            <input
              name="id"
              value={edited.id}
              readOnly
              className={readOnlyControlClass}
            />
            <div className="mt-1">{getSpecialIncidentAdornment?.(edited)}</div>
          </div>

          <div>
            <label className={labelClass}>Título</label>
            <textarea
              name="title"
              ref={titleRef}
              value={edited.title}
              readOnly
              rows={1}
              className={`${readOnlyControlClass} wrap-anywhere min-h-[46px] max-h-[200px] resize-y`}
            />
          </div>

          <div>
            <label className={labelClass}>
              Fecha del Incidente
            </label>
            <input
              type="text"
              name="incident_date"
              value={edited.incident_date}
              readOnly
              className={readOnlyControlClass}
            />
          </div>

          <div>
            <label className={labelClass}>Solicitante</label>
            <input
              name="requester"
              value={edited.requester || ''}
              readOnly
              className={readOnlyControlClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>Descripción</label>
            <textarea
              name="description"
              value={edited.description}
              readOnly
              className={`${readOnlyControlClass} wrap-anywhere min-h-[112px] max-h-[180px] resize-y`}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>Comentarios</label>
            <textarea
              name="comments"
              maxLength={MAX_COMMENTS_LENGTH}
              value={edited.comments || ''}
              onChange={handleChange}
              placeholder="Agrega un comentario..."
              rows={3}
              disabled={isReadOnly}
              className={`${editableControlClass} min-h-[104px] max-h-[180px] resize-y${disabledSoftClass}`}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Nota interna para seguimiento de la orden.
            </p>
          </div>
            </div>
          </section>

          <section className={sectionCard}>
            <div className={sectionHeader}>
              <span className={sectionIcon}>
                <UserRound className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                  Contacto y ubicación
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Datos para contactar al solicitante y localizar el trabajo.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Email</label>
            <input
              name="email"
              value={edited.email || ''}
              readOnly
              className={readOnlyControlClass}
            />
          </div>

          <div>
            <label className={labelClass}>Teléfono</label>
            <input
              name="telephone"
              value={edited.phone || ''}
              readOnly
              className={readOnlyControlClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>Ubicación</label>
            <select
              name="location_id"
              value={selectedLocationId != null ? String(selectedLocationId) : ''}
              disabled
              className={readOnlyControlClass}
            >
              <option value="" disabled>
                Selecciona una ubicación
              </option>
              {selectedLocationId != null && !hasSelectedLocationOption && (
                <option value={selectedLocationId}>{selectedLocationName}</option>
              )}
              {filterOptions.map((loc) => (
                <option key={loc.value} value={loc.value}>
                  {loc.label}
                </option>
              ))}
            </select>
          </div>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className={sectionCard}>
            <div className={sectionHeader}>
              <span className={sectionIcon}>
                <Wrench className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                  Asignación y planificación
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Define quién ejecuta, prioridad y fechas de entrega.
                </p>
              </div>
            </div>

            <div className="space-y-4">
          {/* === NUEVO: Responsable principal === */}
          <div>
            <label className={labelClass}>
              Responsable principal
            </label>
            <select
              name="primary_assignee_id"
              value={primaryId === '' ? '' : Number(primaryId)}
              onChange={(e) => setPrimaryId(Number(e.target.value) || '')}
              className={`${editableControlClass} cursor-pointer${disabledSoftClass}`}
              disabled={loadingAssignees || isReadOnly}
            >
              <option value="">Selecciona responsable…</option>
              {renderAssigneeOptions()}
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Solo técnicos con usuario en la plataforma
              {!edited.is_accepted ? ' · obligatorio para aceptar la orden.' : '.'}
            </p>
          </div>

          {/* === NUEVO: Técnicos secundarios (chips) === */}
          <div>
            <label className={labelClass}>
              Técnicos secundarios{' '}
              <span className="text-slate-400">
                (máx. {maxSecondary})
              </span>
            </label>
            <div className="mt-1 flex items-center gap-3">
              <select
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val) addSecondary(val);
                  e.currentTarget.value = '';
                }}
                disabled={
                  loadingAssignees ||
                  isReadOnly ||
                  secondaryIds.length >= maxSecondary
                }
                className={`${editableControlClass} cursor-pointer${disabledSoftClass}`}
                value=""
              >
                <option value="">Añadir técnico…</option>
                {SECTIONS_ORDER.map((grupo) => (
                  <optgroup key={grupo} label={grupo}>
                    {(bySectionActive[grupo] ?? []).map(
                      (a: Assignee | undefined) =>
                        a ? (
                          <option
                            key={a.id}
                            value={a.id}
                            disabled={
                              a.id === primaryId || secondaryIds.includes(a.id)
                            }
                          >
                            {formatAssigneeFullName(a)}
                          </option>
                        ) : null
                    )}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {secondaryIds.map((id) => {
                // Busca nombre
                let label = `#${id}`;
                for (const g of SECTIONS_ORDER) {
                  const hit = (bySectionActive[g] ?? []).find(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (a: any) => a?.id === id
                  );
                  if (hit) {
                    label = formatAssigneeFullName(hit);
                    break;
                  }
                }
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {label}
                    {!isReadOnly && (
                      <button
                        type="button"
                        className="hover:text-rose-600"
                        onClick={() => removeSecondary(id)}
                        title="Quitar"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                );
              })}
              {secondaryIds.length === 0 && (
                <span className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Sin técnicos secundarios.
                </span>
              )}
            </div>
          </div>

          {/* Prioridad */}
          <div>
            <label className={labelClass}>Prioridad</label>
            <select
              name="priority"
              value={edited.priority}
              onChange={handleChange}
              className={`${editableControlClass} cursor-pointer${disabledSoftClass}`}
              disabled={isReadOnly}
            >
              <option value="baja">🔻 Baja</option>
              <option value="media">🔸 Media</option>
              <option value="alta">🔺 Alta</option>
            </select>
          </div>

          {/* Estatus */}
          <div>
            <label className={labelClass}>Estatus</label>
            <select
              name="status"
              value={edited.status}
              onChange={handleChange}
              className={`${editableControlClass} cursor-pointer${disabledSoftClass}`}
              disabled={isReadOnly}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {/* Fecha estimada de entrega */}
          <div>
            <label className={`${labelClass} inline-flex items-center gap-1.5`}>
              <CalendarDays className="h-3.5 w-3.5" />
              Fecha estimada de entrega
            </label>
            <input
              type="date"
              name="deadline_date"
              value={edited.deadline_date ?? ''}
              onChange={handleChange}
              min={minForDeadline}
              disabled={isReadOnly}
              className={`${editableControlClass}${disabledSoftClass}`}
            />
          </div>
            </div>
          </section>

          {/* Imágenes */}
          {ticket.image &&
            (() => {
              const imagePaths = getTicketImagePaths(ticket.image ?? '[]');
              if (imagePaths.length === 0) return null;
              return (
                <section className={sectionCard}>
                  <div className={sectionHeader}>
                    <span className={sectionIcon}>
                      <ImageIcon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                        Adjuntos
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Evidencia inicial registrada en el ticket.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {imagePaths.map((path, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-950"
                        onClick={() => setFullImageIdx(idx)}
                      >
                        <img
                          src={getPublicImageUrl(path)}
                          alt={`Adjunto ${idx + 1}`}
                          className="h-24 w-24 rounded-lg object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </section>
              );
            })()}

          {/* Urgente */}
          <section className={sectionCard}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                  Señalización operativa
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Marca la orden como urgente cuando requiere atención prioritaria.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              <input
                type="checkbox"
                name="is_urgent"
                checked={edited.is_urgent || false}
                onChange={handleChange}
                disabled={isReadOnly}
                className={
                  'h-4 w-4 rounded border-rose-300 text-rose-600 cursor-pointer' +
                  (isReadOnly ? ' opacity-50 cursor-not-allowed' : '')
                }
              />
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Urgente
                </span>
              </label>
            </div>
          </section>
        </div>
      </div>

      {/* ✅ Validación de cierre (aprobación) */}
      {edited.is_accepted && (rejectedNote || inValidation || isRequester) && (
        <section className="rounded-2xl border border-teal-200 bg-teal-50/80 p-4 shadow-sm dark:border-teal-400/40 dark:bg-teal-500/10 sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-teal-950 dark:text-teal-100">
                Validación de cierre
              </h3>
              <p className="text-sm text-teal-800/80 dark:text-teal-200/80">
                Controla la evidencia requerida para cerrar la orden sin perder trazabilidad.
              </p>
            </div>
          </div>

          {/* Comentario de rechazo (vuelve al técnico) */}
          {rejectedNote && !inValidation && (
            <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200">
              <span className="font-semibold">Rechazada por el aprobador:</span>{' '}
              {rejectedNote}
            </div>
          )}

          {inValidation ? (
            <div className="space-y-3">
              <p className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                En validación — esperando aprobación
              </p>

              {pendingApprovers.length > 0 && (
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  <span className="font-semibold">Aprobador(es):</span>{' '}
                  {pendingApprovers.map((a) => a.label).join(', ')}
                </p>
              )}

              {pendingApproval?.note && (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">Nota del técnico:</span>{' '}
                  {pendingApproval.note}
                </p>
              )}

              {evidencePaths.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {evidencePaths.map((path) => (
                    <a
                      key={path}
                      href={getPublicImageUrl(path)}
                      target="_blank"
                      rel="noreferrer"
                      className="block h-20 w-20 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600"
                    >
                      <img
                        src={getPublicImageUrl(path)}
                        alt="Evidencia"
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}

              {viewerIsApprover ? (
                <div className="space-y-2">
                  <textarea
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    rows={2}
                    placeholder="Comentario de la decisión (obligatorio si rechazas)"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:border-slate-600 dark:bg-slate-950/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-teal-500/25"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleDecision(true)}
                      disabled={deciding}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                    >
                      Validar y finalizar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDecision(false)}
                      disabled={deciding || decisionNote.trim().length === 0}
                      title={
                        decisionNote.trim().length === 0
                          ? 'Escribe un comentario para poder rechazar'
                          : undefined
                      }
                      className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-400/60 dark:bg-slate-950/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  La orden está bloqueada para edición hasta que un aprobador la valide.
                </p>
              )}
            </div>
          ) : finalizedLockedForTech ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Esta orden ya fue finalizada y validada. Solo un aprobador puede
              reabrirla o cambiar su estado.
            </p>
          ) : (
            isRequester &&
            edited.status !== 'Finalizadas' && (
              <div className="space-y-2">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Para finalizar esta orden debes enviarla a validación adjuntando una
                  imagen del trabajo terminado.
                </p>
                <button
                  type="button"
                  onClick={() => setEvidenceOpen(true)}
                  className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400"
                >
                  Finalizar (requiere validación)
                </button>
              </div>
            )
          )}
        </section>
      )}

      {/* ✅ Repuestos (solo si is_accepted=true) */}
      <section className={sectionCard}>
        <div className={sectionHeader}>
          <span className={sectionIcon}>
            <Package className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                Repuestos y reservas
              </h3>
              <div className="flex flex-wrap gap-2">
                {!edited.is_accepted && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    Disponible al aceptar (OT)
                  </span>
                )}
                {inValidation && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                    Bloqueado durante la validación
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Reserva materiales necesarios para ejecutar la orden y consulta su disponibilidad.
            </p>
          </div>
        </div>

        <div
          className={inValidation ? 'pointer-events-none select-none opacity-60' : ''}
          aria-disabled={inValidation}
        >
        {edited.is_accepted && !canUseTicketPartsPanel ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {canInventoryRead ? (
              <>
                Tienes lectura de inventario, pero no permiso de operación para
                repuestos de OT (
                <span className="font-mono">inventory:work</span> /{' '}
                <span className="font-mono">inventory:create</span> /{' '}
                <span className="font-mono">inventory:full_access</span>).
              </>
            ) : (
              <>
                No tienes permisos de inventario para operar repuestos de OT (
                <span className="font-mono">inventory:read</span> + permisos de
                trabajo).
              </>
            )}
          </div>
        ) : (
          <TicketPartsPanel
            ticketId={Number(ticket.id)}
            isAccepted={Boolean(edited.is_accepted)}
          />
        )}
        </div>
      </section>

      {/* ✅ Activos fijos vinculados al ticket */}
      <section className={sectionCard}>
        <div className={sectionHeader}>
          <span className={sectionIcon}>
            <Boxes className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                Activos fijos del ticket
              </h3>
              <div className="flex flex-wrap gap-2">
                {!edited.is_accepted && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    Disponible al aceptar (OT)
                  </span>
                )}
                {inValidation && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                    Bloqueado durante la validación
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Vincula equipos afectados para conservar historial de mantenimiento por activo.
            </p>
          </div>
        </div>

        <TicketAssetsPanel
          ticketId={Number(ticket.id)}
          isAccepted={Boolean(edited.is_accepted)}
          ticketTitle={edited.title}
          ticketStatus={edited.status}
          requester={edited.requester}
          canManageLinks={canAssetsUpdate && !inValidation}
        />
      </section>

      {edited.is_accepted && (
        <section className={sectionCard}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className={sectionIcon}>
                <MessageSquare className="h-5 w-5" />
              </span>
              <div>
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                Continuidad del chat
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Esta orden usa el mismo chat interno del ticket para mantener la conversación entre solicitud, perfil y OT.
              </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setChatModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 cursor-pointer"
            >
              <MessageSquare className="h-4 w-4" />
              Abrir chat interno
            </button>
          </div>
        </section>
      )}

      {/* Lightbox imágenes */}
      <AnimatePresence>
        {fullImageIdx !== null &&
          (() => {
            const imagePaths = getTicketImagePaths(ticket.image ?? '[]');
            const path = imagePaths[fullImageIdx];
            if (!path) return null;
            return (
              <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/20"
                onClick={() => setFullImageIdx(null)}
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
                transition={
                  prefersReducedMotion ? { duration: 0 } : { duration: 0.18 }
                }
              >
                <motion.div
                  className="relative"
                  onClick={(e) => e.stopPropagation()}
                  initial={
                    prefersReducedMotion
                      ? { opacity: 1, scale: 1 }
                      : { opacity: 0, scale: 0.97 }
                  }
                  animate={{ opacity: 1, scale: 1 }}
                  exit={
                    prefersReducedMotion
                      ? { opacity: 1, scale: 1 }
                      : { opacity: 0, scale: 0.98 }
                  }
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }
                  }
                >
                  <button
                    onClick={() => setFullImageIdx(null)}
                    className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur-md text-gray-800 shadow-lg flex items-center justify-center transition-all duration-200 hover:bg-white hover:text-red-500 cursor-pointer"
                    aria-label="Cerrar"
                    type="button"
                  >
                    ✕
                  </button>
                  <img
                    src={getPublicImageUrl(path)}
                    alt="Vista ampliada"
                    className="max-w-full max-h-[80vh] rounded shadow-lg"
                  />
                  {imagePaths.length > 1 && (
                    <>
                      <button
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white p-2 rounded-full"
                        onClick={() =>
                          setFullImageIdx((prev) =>
                            prev! > 0 ? prev! - 1 : imagePaths.length - 1
                          )
                        }
                        type="button"
                      >
                        ◀️
                      </button>
                      <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white p-2 rounded-full"
                        onClick={() =>
                          setFullImageIdx((prev) =>
                            prev! < imagePaths.length - 1 ? prev! + 1 : 0
                          )
                        }
                        type="button"
                      >
                        ▶️
                      </button>
                    </>
                  )}
                </motion.div>
              </motion.div>
            );
          })()}
      </AnimatePresence>

      <AnimatedDialog
        open={chatModalOpen}
        onClose={() => setChatModalOpen(false)}
        zIndexClassName="z-[160]"
        overlayClassName="bg-slate-950/45 backdrop-blur-sm"
        panelClassName="w-full max-w-3xl rounded-2xl bg-white shadow-2xl"
        containerClassName="fixed inset-0 flex items-center justify-center p-4"
        lockScroll
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Chat interno de la OT #{edited.id}
              </h3>
              <p className="text-sm text-slate-600">
                Conversación compartida con la solicitud original y el perfil del usuario.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setChatModalOpen(false)}
              className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 cursor-pointer"
              aria-label="Cerrar chat"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-5 py-5">
          <TicketChatPanel
            ticketId={Number(edited.id)}
            title="Chat interno"
            composerPlaceholder="Escribe un mensaje para continuar la conversación de esta orden..."
            maxHeightClassName="max-h-[50vh]"
          />
        </div>
      </AnimatedDialog>

      {/* Modal: evidencia obligatoria para enviar a validación */}
      <AnimatedDialog
        open={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
        zIndexClassName="z-[160]"
        overlayClassName="bg-slate-950/45 backdrop-blur-sm"
        panelClassName="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
        containerClassName="fixed inset-0 flex items-center justify-center p-4"
        lockScroll
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Evidencia del trabajo finalizado
          </h3>
          <p className="text-sm text-slate-600">
            Adjunta una imagen del trabajo terminado. Al enviar, la orden pasará a
            validación de tu aprobador.
          </p>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="text-xs font-semibold text-slate-500">
              Imagen del trabajo terminado (obligatoria)
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setEvidenceFiles(Array.from(e.target.files ?? []))}
              className="mt-1 block w-full text-sm"
            />
            {evidenceFiles.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                {evidenceFiles.length} archivo(s) seleccionado(s).
              </p>
            )}
          </div>
          <textarea
            value={evidenceNote}
            onChange={(e) => setEvidenceNote(e.target.value)}
            rows={2}
            placeholder="Nota para el aprobador (opcional)"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={() => setEvidenceOpen(false)}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void submitEvidence()}
            disabled={submittingEvidence || evidenceFiles.length === 0}
            className="rounded bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {submittingEvidence ? 'Enviando...' : 'Enviar a validación'}
          </button>
        </div>
      </AnimatedDialog>

      {/* Footer acciones */}
      <div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-6 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Los cambios se aplican a la orden actual y se reflejan en tablero, lista, inventario y activos vinculados.
            </span>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 cursor-pointer dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Cancelar
        </button>

        {/* ACEPTAR (si aún no aceptada) */}
        {canFullAccess && !forceReadOnly && !edited.is_accepted && (
          <button
            type="button"
            onClick={handleAcceptWithPrimary}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 cursor-pointer"
            title="Aceptar y asignar responsable principal"
          >
            <CheckCircle2 className="h-4 w-4" />
            Aceptar y asignar
          </button>
        )}

        {edited.is_accepted && (
          <button
            type="button"
            onClick={() => setChatModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 cursor-pointer"
          >
            <MessageSquare className="h-4 w-4" />
            Chat interno
          </button>
        )}

        {/* Archivar: solo en Finalizadas y no archivada */}
        {canFullAccess &&
          !forceReadOnly &&
          edited.status === 'Finalizadas' &&
          !edited.is_archived && (
            <button
              type="button"
              onClick={async () => {
                const ok = await confirmArchiveWorkOrder(Number(edited.id));
                if (!ok) return;
                try {
                  await archiveTicket(Number(edited.id));
                  onSave({ ...edited, is_archived: true });
                  showToastSuccess('Orden archivada.');
                  onClose();
                } catch (e: unknown) {
                  const msg = e instanceof Error ? e.message : String(e);
                  showToastError(`No se pudo archivar: ${msg}`);
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 cursor-pointer"
              title="Mover a archivadas"
            >
              <Archive className="h-4 w-4" />
              Archivar
            </button>
          )}

        {/* Desarchivar: solo usuarios con full_access */}
        {canFullAccess && edited.is_archived && (
          <button
            type="button"
            onClick={async () => {
              try {
                await unarchiveTicket(Number(edited.id));
                await onSave({ ...edited, is_archived: false });
                showToastSuccess('Orden desarchivada.');
                onClose();
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                showToastError(`No se pudo desarchivar: ${msg}`);
              }
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 cursor-pointer"
            title="Sacar de archivadas"
          >
            <Archive className="h-4 w-4" />
            Desarchivar
          </button>
        )}

        {/* Guardar (ediciones generales y secundarios si ya es OT) */}
        {!forceReadOnly && !inValidation && !finalizedLockedForTech && (
          <button
            type="submit"
            disabled={!canFullAccess}
            title={!canFullAccess ? 'No tienes permiso para editar' : undefined}
            className={
              'inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 cursor-pointer' +
              (!canFullAccess ? ' opacity-50 cursor-not-allowed' : '')
            }
          >
            <Save className="h-4 w-4" />
            Guardar Cambios
          </button>
        )}
          </div>
        </div>
      </div>
    </form>
  );
}
