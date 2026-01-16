import React, { useState, useEffect, useRef, type JSX } from 'react';
import type { WorkOrder } from '../../../types/Ticket';
import { toTicketUpdate } from '../../../utils/toTicketUpdate';
import { useAssignees } from '../../../context/AssigneeContext';
import { LOCATIONS } from '../../../constants/locations';
import { STATUSES } from '../../../constants/const_ticket';
import {
  getTicketImagePaths,
  getPublicImageUrl,
} from '../../../services/storageService';
import { MAX_COMMENTS_LENGTH } from '../../../utils/validators';
import { archiveTicket } from '../../../services/ticketService';
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

interface EditWorkOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: WorkOrder;
  onSave: (patch: Partial<WorkOrder>) => void | Promise<void>;
  showFullImage: boolean;
  setShowFullImage: React.Dispatch<React.SetStateAction<boolean>>;
  getSpecialIncidentAdornment?: (t: WorkOrder) => JSX.Element | null;
}

export default function EditWorkOrdersModal({
  onClose,
  ticket,
  onSave,
  setShowFullImage,
  getSpecialIncidentAdornment,
}: EditWorkOrdersModalProps) {
  const [edited, setEdited] = useState<WorkOrder>(ticket);
  const [fullImageIdx, setFullImageIdx] = useState<number | null>(null);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const { loading: loadingAssignees, bySectionActive } = useAssignees();
  const { maxSecondary } = useSettings();

  const SECTIONS_ORDER: Array<
    'SIN ASIGNAR' | 'Internos' | 'TERCEROS' | 'OTROS'
  > = ['SIN ASIGNAR', 'Internos', 'TERCEROS', 'OTROS'];

  const canFullAccess = useCan('work_orders:full_access');
  const isReadOnly = !canFullAccess;
  const addDisabledCls = (base = '') =>
    base + (isReadOnly ? ' opacity-50 cursor-not-allowed bg-gray-100' : '');

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
    setPrimaryId(ticket.primary_assignee_id ?? ticket.assignee_id ?? '');
    const initial = uniqSorted(ticket.secondary_assignee_ids ?? []);
    setSecondaryIds(initial);
    initialSecondaryRef.current = initial; // 👈 importante
  }, [ticket]);

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

  if (!ticket) return null;

  // Opciones de técnicos
  const renderAssigneeOptions = () =>
    SECTIONS_ORDER.map((grupo) => (
      <optgroup key={grupo} label={grupo}>
        {(bySectionActive[grupo] ?? []).map((a: Assignee | undefined) =>
          a ? (
            <option key={a.id} value={a.id}>
              {formatAssigneeFullName(a)}
            </option>
          ) : null
        )}
      </optgroup>
    ));

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
              name="location"
              value={edited.location || ''}
              disabled
              className="mt-1 p-2 w-full border rounded bg-gray-100 text-gray-800"
            >
              <option value="" disabled>
                Selecciona una ubicación
              </option>
              {LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
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
            {!edited.is_accepted && (
              <p className="text-xs text-gray-500 mt-1">
                Obligatorio para aceptar la orden.
              </p>
            )}
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

      {/* Lightbox imágenes */}
      {fullImageIdx !== null &&
        (() => {
          const imagePaths = getTicketImagePaths(ticket.image ?? '[]');
          const path = imagePaths[fullImageIdx];
          if (!path) return null;
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/20"
              onClick={() => setFullImageIdx(null)}
            >
              <div className="relative" onClick={(e) => e.stopPropagation()}>
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
              </div>
            </div>
          );
        })()}

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
        {canFullAccess && !edited.is_accepted && (
          <button
            type="button"
            onClick={handleAcceptWithPrimary}
            className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 cursor-pointer"
            title="Aceptar y asignar responsable principal"
          >
            Aceptar y asignar
          </button>
        )}

        {/* Archivar: solo en Finalizadas y no archivada */}
        {canFullAccess &&
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

        {/* Guardar (ediciones generales y secundarios si ya es OT) */}
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
      </div>
    </form>
  );
}
