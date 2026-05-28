import React, { useState, useEffect, useRef, type JSX } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
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

  const isReadOnly = forceReadOnly || !canFullAccess || inValidation;
  const canInventoryRead = useCan('inventory:read');
  const canInventoryOperate = useCan([
    'inventory:work',
    'inventory:create',
    'inventory:full_access',
  ]);
  const canUseTicketPartsPanel = canInventoryRead && canInventoryOperate;
  const canAssetsUpdate = useCan(['assets:update', 'assets:full_access']);
  const addDisabledCls = (base = '') =>
    base + (isReadOnly ? ' opacity-50 cursor-not-allowed bg-gray-100' : '');
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
      const [uid, requester, latest, approvers] = await Promise.all([
        getCurrentUserId(),
        amIApprovalRequester(),
        getLatestApprovalForTicket(tid),
        getTicketPendingApprovers(tid),
      ]);
      setCurrentUserId(uid);
      setIsRequester(requester);
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

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna 1 */}
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium">ID</label>
            <input
              name="id"
              value={edited.id}
              readOnly
              className="mt-1 p-2 w-full border rounded bg-gray-100 text-gray-800"
            />
            <div className="mt-1">{getSpecialIncidentAdornment?.(edited)}</div>
          </div>

          <div>
            <label className="block text-sm font-medium">Título</label>
            <textarea
              name="title"
              ref={titleRef}
              value={edited.title}
              readOnly
              rows={1}
              className="mt-1 p-2 w-full border rounded bg-gray-100 text-gray-800 wrap-anywhere resize-y min-h-[44px] max-h-[200px]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">
              Fecha del Incidente
            </label>
            <input
              type="text"
              name="incident_date"
              value={edited.incident_date}
              readOnly
              className="mt-1 p-2 w-full border rounded bg-gray-100 text-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Descripción</label>
            <textarea
              name="description"
              value={edited.description}
              readOnly
              className="mt-1 p-2 w-full border rounded bg-gray-100 text-gray-800 min-h-[100px] max-h-[150px] resize-y"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Comentarios</label>
            <textarea
              name="comments"
              maxLength={MAX_COMMENTS_LENGTH}
              value={edited.comments || ''}
              onChange={handleChange}
              placeholder="Agrega un comentario..."
              rows={3}
              disabled={isReadOnly}
              className={addDisabledCls(
                'mt-1 p-2 w-full border rounded min-h-[100px] max-h-[150px] resize-y'
              )}
            />
          </div>
        </div>

        {/* Columna 2 */}
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium">Solicitante</label>
            <input
              name="requester"
              value={edited.requester || ''}
              readOnly
              className="mt-1 p-2 w-full border rounded bg-gray-100 text-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              name="email"
              value={edited.email || ''}
              readOnly
              className="mt-1 p-2 w-full border rounded bg-gray-100 text-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Teléfono</label>
            <input
              name="telephone"
              value={edited.phone || ''}
              readOnly
              className="mt-1 p-2 w-full border rounded bg-gray-100 text-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Ubicación</label>
            <select
              name="location_id"
              value={selectedLocationId != null ? String(selectedLocationId) : ''}
              disabled
              className="mt-1 p-2 w-full border rounded bg-gray-100 text-gray-800"
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

        {/* Columna 3 */}
        <div className="flex flex-col gap-4">
          {/* === NUEVO: Responsable principal === */}
          <div>
            <label className="block text-sm font-medium">
              Responsable principal
            </label>
            <select
              name="primary_assignee_id"
              value={primaryId === '' ? '' : Number(primaryId)}
              onChange={(e) => setPrimaryId(Number(e.target.value) || '')}
              className={addDisabledCls(
                'mt-1 p-2 w-full border rounded cursor-pointer'
              )}
              disabled={loadingAssignees || isReadOnly}
            >
              <option value="">Selecciona responsable…</option>
              {renderAssigneeOptions()}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Solo técnicos con usuario en la plataforma
              {!edited.is_accepted ? ' · obligatorio para aceptar la orden.' : '.'}
            </p>
          </div>

          {/* === NUEVO: Técnicos secundarios (chips) === */}
          <div>
            <label className="block text-sm font-medium">
              Técnicos secundarios{' '}
              <span className="text-gray-500 text-xs">
                (máx. {maxSecondary})
              </span>
            </label>
            <div className="flex items-center gap-3 mt-1">
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
                className={addDisabledCls('p-2 border rounded w-full')}
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

            <div className="flex gap-2 flex-wrap mt-2">
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
                    className="px-2 py-1 rounded-full bg-slate-200 text-slate-800 text-sm inline-flex items-center gap-2"
                  >
                    {label}
                    {!isReadOnly && (
                      <button
                        type="button"
                        className="hover:text-red-600"
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
                <span className="text-xs text-gray-500">
                  Sin técnicos secundarios.
                </span>
              )}
            </div>
          </div>

          {/* Prioridad */}
          <div>
            <label className="block text-sm font-medium">Prioridad</label>
            <select
              name="priority"
              value={edited.priority}
              onChange={handleChange}
              className={addDisabledCls(
                'mt-1 p-2 w-full border rounded cursor-pointer'
              )}
              disabled={isReadOnly}
            >
              <option value="baja">🔻 Baja</option>
              <option value="media">🔸 Media</option>
              <option value="alta">🔺 Alta</option>
            </select>
          </div>

          {/* Estatus */}
          <div>
            <label className="block text-sm font-medium">Estatus</label>
            <select
              name="status"
              value={edited.status}
              onChange={handleChange}
              className={addDisabledCls(
                'mt-1 p-2 w-full border rounded cursor-pointer'
              )}
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
            <label className="block text-sm font-medium">
              Fecha estimada de entrega
            </label>
            <input
              type="date"
              name="deadline_date"
              value={edited.deadline_date ?? ''}
              onChange={handleChange}
              min={minForDeadline}
              disabled={isReadOnly}
              className={addDisabledCls(
                'mt-1 p-2 w-full border rounded text-gray-800'
              )}
            />
          </div>

          {/* Imágenes */}
          {ticket.image &&
            (() => {
              const imagePaths = getTicketImagePaths(ticket.image ?? '[]');
              if (imagePaths.length === 0) return null;
              return (
                <div className="flex gap-2 flex-wrap my-2">
                  {imagePaths.map((path, idx) => (
                    <img
                      key={idx}
                      src={getPublicImageUrl(path)}
                      alt={`Adjunto ${idx + 1}`}
                      className="w-20 h-20 object-contain rounded cursor-pointer border bg-gray-100 hover:scale-105 transition"
                      onClick={() => setFullImageIdx(idx)}
                    />
                  ))}
                </div>
              );
            })()}

          {/* Urgente */}
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_urgent"
                checked={edited.is_urgent || false}
                onChange={handleChange}
                disabled={isReadOnly}
                className={
                  'h-4 w-4 text-red-600 border-gray-300 rounded cursor-pointer' +
                  (isReadOnly ? ' opacity-50 cursor-not-allowed' : '')
                }
              />
              <label className="text-sm font-medium text-red-700">
                🚨 Urgente
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Validación de cierre (aprobación) */}
      {edited.is_accepted && (rejectedNote || inValidation || isRequester) && (
        <div className="rounded-2xl border border-teal-200 bg-teal-50/80 p-4 sm:p-5 dark:border-teal-400/40 dark:bg-teal-500/10">
          <h3 className="mb-2 text-base font-semibold text-teal-900 dark:text-teal-200">
            Validación de cierre
          </h3>

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
                      className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-400"
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
                      className="rounded border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-400/60 dark:text-rose-300 dark:hover:bg-rose-500/10"
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
                  className="rounded bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400"
                >
                  Finalizar (requiere validación)
                </button>
              </div>
            )
          )}
        </div>
      )}

      {/* ✅ Repuestos (solo si is_accepted=true) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">
            Repuestos y reservas
          </h3>
          {!edited.is_accepted && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              Disponible al aceptar (OT)
            </span>
          )}
          {inValidation && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
              🔒 Bloqueado durante la validación
            </span>
          )}
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
      </div>

      {/* ✅ Activos fijos vinculados al ticket */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">
            Activos fijos del ticket
          </h3>
          {!edited.is_accepted && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              Disponible al aceptar (OT)
            </span>
          )}
          {inValidation && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
              🔒 Bloqueado durante la validación
            </span>
          )}
        </div>

        <TicketAssetsPanel
          ticketId={Number(ticket.id)}
          isAccepted={Boolean(edited.is_accepted)}
          ticketTitle={edited.title}
          ticketStatus={edited.status}
          requester={edited.requester}
          canManageLinks={canAssetsUpdate && !inValidation}
        />
      </div>

      {edited.is_accepted && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Continuidad del chat
              </h3>
              <p className="text-sm text-slate-600">
                Esta orden usa el mismo chat interno del ticket para mantener la conversación entre solicitud, perfil y OT.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setChatModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 cursor-pointer"
            >
              <MessageSquare className="h-4 w-4" />
              Abrir chat interno
            </button>
          </div>
        </div>
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
      <div className="flex justify-end gap-2 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300 cursor-pointer"
        >
          Cancelar
        </button>

        {/* ACEPTAR (si aún no aceptada) */}
        {canFullAccess && !forceReadOnly && !edited.is_accepted && (
          <button
            type="button"
            onClick={handleAcceptWithPrimary}
            className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 cursor-pointer"
            title="Aceptar y asignar responsable principal"
          >
            Aceptar y asignar
          </button>
        )}

        {edited.is_accepted && (
          <button
            type="button"
            onClick={() => setChatModalOpen(true)}
            className="inline-flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 cursor-pointer"
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
              className="bg-slate-700 text-white px-4 py-2 rounded hover:bg-slate-800 cursor-pointer"
              title="Mover a archivadas"
            >
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
            className="bg-emerald-700 text-white px-4 py-2 rounded hover:bg-emerald-800 cursor-pointer"
            title="Sacar de archivadas"
          >
            Desarchivar
          </button>
        )}

        {/* Guardar (ediciones generales y secundarios si ya es OT) */}
        {!forceReadOnly && !inValidation && (
          <button
            type="submit"
            disabled={!canFullAccess}
            title={!canFullAccess ? 'No tienes permiso para editar' : undefined}
            className={
              'bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 cursor-pointer' +
              (!canFullAccess ? ' opacity-50 cursor-not-allowed' : '')
            }
          >
            Guardar Cambios
          </button>
        )}
      </div>
    </form>
  );
}
