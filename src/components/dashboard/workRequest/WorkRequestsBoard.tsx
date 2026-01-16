import { useLayoutEffect, useRef, useState, useEffect, useMemo } from 'react';
import type { Ticket } from '../../../types/Ticket';
import type { SpecialIncident } from '../../../types/SpecialIncident';
import {
  acceptTickets,
  getTicketsByFiltersPaginated,
} from '../../../services/ticketService';
import {
  getAllSpecialIncidents,
  makeSpecialIncidentMap,
} from '../../../services/specialIncidentsService';
import {
  getPublicImageUrl,
  getTicketImagePaths,
} from '../../../services/storageService';
import { showToastError, showToastSuccess } from '../../../notifications';
import { formatDateInTimezone } from '../../../utils/formatDate';
import type { WorkRequestsFilterKey } from '../../../features/tickets/workRequestsFilters';
import type { FilterState } from '../../../types/filters';
import { useCan } from '../../../rbac/PermissionsContext';
import { useAssignees } from '../../../context/AssigneeContext';
import type { Assignee } from '../../../types/Assignee';
import { formatAssigneeFullName } from '../../../services/assigneeService';
import WorkRequestsDetailModal from './WorkRequestsDetailModal';

interface Props {
  filters: FilterState<WorkRequestsFilterKey>;
}

const PAGE_SIZE = 8;

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function PriorityChip({ value }: { value: string }) {
  const map: Record<string, string> = {
    Baja: 'bg-emerald-100 text-emerald-800',
    Media: 'bg-amber-100 text-amber-800',
    Alta: 'bg-orange-100 text-orange-800',
    Crítica: 'bg-rose-100 text-rose-800',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
        map[value] || 'bg-gray-100 text-gray-700'
      )}
    >
      {value}
    </span>
  );
}

function StatusChip({ value }: { value: string }) {
  const map: Record<string, string> = {
    Nueva: 'bg-gray-100 text-gray-800',
    'En Revisión': 'bg-yellow-100 text-yellow-800',
    Aprobada: 'bg-emerald-100 text-emerald-800',
    Rechazada: 'bg-rose-100 text-rose-800',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
        map[value] || 'bg-gray-100 text-gray-700'
      )}
    >
      {value}
    </span>
  );
}

export default function WorkRequestsBoard({ filters }: Props) {
  const checkbox = useRef<HTMLInputElement>(null);
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);
  const [specialIncidentsById, setSpecialIncidentsById] = useState<
    Record<number, SpecialIncident>
  >({});

  const canFullWR = useCan('work_requests:full_access');
  const { loading: loadingAssignees, bySectionActive } = useAssignees();
  const SECTIONS_ORDER: Array<
    'SIN ASIGNAR' | 'Internos' | 'TERCEROS' | 'OTROS'
  > = ['SIN ASIGNAR', 'Internos', 'TERCEROS', 'OTROS'];

  // Mapa local de responsables
  const [assigneesMap, setAssigneesMap] = useState<Record<number, number | ''>>(
    {}
  );
  const getAssigneeFor = (id: number) => assigneesMap[id] ?? '';
  const setAssigneeFor = (id: number, assigneeId: number) =>
    setAssigneesMap((prev) => ({ ...prev, [id]: assigneeId }));

  const ticketsToShow = tickets;

  // Checkbox maestro
  useLayoutEffect(() => {
    const isInd =
      selectedTicket.length > 0 && selectedTicket.length < ticketsToShow.length;
    setChecked(
      selectedTicket.length === ticketsToShow.length && ticketsToShow.length > 0
    );
    setIndeterminate(isInd);
    if (checkbox.current) checkbox.current.indeterminate = isInd;
  }, [selectedTicket, ticketsToShow.length]);

  function toggleAll() {
    if (!canFullWR) return;
    setSelectedTicket(checked || indeterminate ? [] : ticketsToShow);
    setChecked(!checked && !indeterminate);
    setIndeterminate(false);
  }

  const canMassAccept = useMemo(() => {
    if (!canFullWR) return false;
    if (selectedTicket.length === 0) return false;
    return selectedTicket.every((t) => Boolean(getAssigneeFor(Number(t.id))));
  }, [canFullWR, selectedTicket, assigneesMap]);

  async function handleAcceptSelected() {
    if (!canFullWR) {
      showToastError('No tienes permiso para aceptar solicitudes.');
      return;
    }
    if (selectedTicket.length === 0) return;

    const missing = selectedTicket
      .filter((t) => !getAssigneeFor(Number(t.id)))
      .map((t) => `#${t.id}`);
    if (missing.length) {
      showToastError(
        `Asigna responsable antes de aceptar. Faltan: ${missing.join(', ')}`
      );
      return;
    }

    setIsLoading(true);
    try {
      const payload = selectedTicket.map((t) => ({
        id: Number(t.id),
        assignee_id: Number(getAssigneeFor(Number(t.id))),
      }));
      await acceptTickets(payload);
      showToastSuccess(
        payload.length === 1
          ? 'Ticket aceptado correctamente.'
          : `Se aceptaron ${payload.length} tickets correctamente.`
      );
      setSelectedTicket([]);
      await reload();
    } catch (error) {
      showToastError(
        `Hubo un error al aceptar los tickets. Error: ${
          error instanceof Error ? error.message : 'Desconocido'
        }`
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAcceptOne(id: number) {
    if (!canFullWR) {
      showToastError('No tienes permiso para aceptar solicitudes.');
      return;
    }
    const assigneeId = getAssigneeFor(id);
    if (!assigneeId) {
      showToastError('Selecciona un responsable antes de aceptar.');
      return;
    }
    setIsLoading(true);
    try {
      await acceptTickets([{ id, assignee_id: Number(assigneeId) }]);
      showToastSuccess('Ticket aceptado correctamente.');
      await reload();
    } catch (error) {
      showToastError(
        `Hubo un error al aceptar el ticket. Error: ${
          error instanceof Error ? error.message : 'Desconocido'
        }`
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function reload() {
    const { data, count } = await getTicketsByFiltersPaginated(
      filters,
      page,
      PAGE_SIZE
    );
    setTickets(data);
    setSelectedTicket([]);
    setTotalCount(count);

    const next: Record<number, number | ''> = {};
    for (const t of data) {
      const idNum = Number(t.id);
      const current = assigneesMap[idNum];
      next[idNum] =
        typeof current !== 'undefined'
          ? current
          : (t as Ticket).assignee_id ?? '';
    }
    setAssigneesMap(next);
  }

  type TicketWithSpecialIncident = Ticket & {
    special_incident_id?: number | null;
  };

  function renderSpecialIncidentChip(specialIncidentId?: number | null) {
    if (!specialIncidentId) return null;
    const specialIncident = specialIncidentsById[Number(specialIncidentId)];
    if (!specialIncident) return null;
    return (
      <span className="ml-1 inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800">
        {specialIncident.name}
      </span>
    );
  }

  useEffect(() => {
    setSelectedTicket([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, JSON.stringify(filters)]);

  useEffect(() => {
    setIsLoading(true);
    void reload().finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, JSON.stringify(filters)]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getAllSpecialIncidents(); // incluye activas e inactivas
        if (!cancelled) setSpecialIncidentsById(makeSpecialIncidentMap(list));
      } catch {
        // opcional: console.error
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const disabledCtlCls = (cond: boolean) =>
    cond ? ' disabled:opacity-40 disabled:cursor-not-allowed' : '';

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Barra superior */}
      <div className="flex items-center gap-3">
        <p className="text-sm text-gray-700">
          Solicitudes pendientes de aprobación — Página {page + 1} de{' '}
          {Math.ceil(totalCount / PAGE_SIZE) || 1}
        </p>
        <div className="ml-auto">
          <button
            type="button"
            onClick={handleAcceptSelected}
            disabled={!canMassAccept || isLoading}
            title={
              !canFullWR
                ? 'No tienes permiso para aceptar'
                : !selectedTicket.length
                ? 'Selecciona al menos una solicitud'
                : !canMassAccept
                ? 'Todos los seleccionados deben tener responsable'
                : undefined
            }
            className={
              'inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500' +
              disabledCtlCls(!canMassAccept || isLoading)
            }
          >
            Aceptar Solicitudes
          </button>
        </div>
      </div>

      {/* Contenido scrollable */}
      <div className="mt-3 flex-1 min-h-0">
        {/* ===== Móvil: tarjetas ===== */}
        <div className="md:hidden space-y-3 overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center text-gray-400">Cargando…</div>
          ) : ticketsToShow.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              No hay tickets pendientes.
            </div>
          ) : (
            ticketsToShow.map((t) => {
              const imagePaths = getTicketImagePaths(t.image ?? '');
              const cover = imagePaths[0];
              const selected = selectedTicket.includes(t);
              const assigneeValue = getAssigneeFor(Number(t.id));

              return (
                <div
                  key={t.id}
                  className={`rounded-xl border bg-white p-4 shadow-sm ${
                    selected ? 'ring-1 ring-indigo-300' : ''
                  }`}
                  onClick={() => setDetailTicket(t)}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className={
                        'mt-1 h-5 w-5 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600' +
                        (canFullWR ? '' : ' opacity-40 cursor-not-allowed')
                      }
                      disabled={!canFullWR}
                      checked={selected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        if (e.target.checked)
                          setSelectedTicket((prev) => [...prev, t]);
                        else
                          setSelectedTicket((prev) =>
                            prev.filter((x) => x !== t)
                          );
                      }}
                      title={
                        !canFullWR
                          ? 'No tienes permiso para seleccionar'
                          : undefined
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500">
                        <div className="flex flex-col">
                          <span>#{t.id}</span>
                          {(() => {
                            const siId = (t as TicketWithSpecialIncident)
                              .special_incident_id;
                            const chip = renderSpecialIncidentChip(siId);
                            return chip ? (
                              <div className="mt-0.5 inline-flex items-center gap-1">
                                {chip}
                                <span
                                  role="img"
                                  aria-label="incidente especial"
                                  title="Incidente especial"
                                >
                                  🚨
                                </span>
                              </div>
                            ) : null;
                          })()}
                        </div>
                      </div>

                      <div className="mt-0.5 text-base font-semibold text-gray-900 wrap-anywhere line-clamp-1">
                        {t.title}
                      </div>
                      <div className="text-sm text-gray-500 wrap-anywhere line-clamp-2">
                        {t.description}
                      </div>

                      {/* Selector responsable (móvil) */}
                      <div className="mt-2">
                        <label className="block text-xs text-gray-600">
                          Responsable
                        </label>
                        <select
                          className={
                            'mt-1 w-full rounded border-gray-300 text-sm' +
                            (!canFullWR
                              ? ' opacity-50 cursor-not-allowed bg-gray-100'
                              : '')
                          }
                          disabled={loadingAssignees || !canFullWR}
                          value={assigneeValue}
                          onChange={(e) =>
                            setAssigneeFor(Number(t.id), Number(e.target.value))
                          }
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="" disabled>
                            Selecciona…
                          </option>
                          {SECTIONS_ORDER.map((g) => (
                            <optgroup key={g} label={g}>
                              {(bySectionActive[g] ?? []).map(
                                (a: Assignee | undefined) =>
                                  a ? (
                                    <option key={a.id} value={a.id}>
                                      {formatAssigneeFullName(a)}
                                    </option>
                                  ) : null
                              )}
                            </optgroup>
                          ))}
                        </select>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-gray-700">{t.requester}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-700">{t.location}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <PriorityChip value={t.priority ?? 'Media'} />
                        <StatusChip value={t.status ?? 'Nueva'} />
                      </div>
                      <div className="mt-3 text-xs text-gray-500">
                        {formatDateInTimezone(t.created_at)}
                      </div>
                    </div>
                    {cover ? (
                      <img
                        src={getPublicImageUrl(cover)}
                        alt="Activo"
                        className="h-14 w-20 rounded object-cover"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailTicket(t);
                        }}
                      />
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-4">
                    <button
                      className="text-indigo-600 hover:text-indigo-500 text-sm cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailTicket(t);
                      }}
                    >
                      Ver
                    </button>
                    <button
                      className={
                        'text-emerald-600 hover:text-emerald-500 text-sm cursor-pointer' +
                        (!canFullWR || !assigneeValue
                          ? ' opacity-40 cursor-not-allowed'
                          : '')
                      }
                      disabled={!canFullWR || !assigneeValue}
                      title={
                        !canFullWR
                          ? 'No tienes permiso para aceptar'
                          : !assigneeValue
                          ? 'Selecciona un responsable'
                          : undefined
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAcceptOne(Number(t.id));
                      }}
                    >
                      Aceptar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ===== md+: tabla ===== */}
        <div className="hidden md:block h-full min-h-0 overflow-auto">
          <div className="inline-block min-w-full align-middle">
            <div className="overflow-auto rounded-lg ring-1 ring-gray-200">
              <table className="min-w-full table-fixed divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 w-12">
                      <input
                        ref={checkbox}
                        type="checkbox"
                        className={
                          'h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer' +
                          (!canFullWR ? ' opacity-40 cursor-not-allowed' : '')
                        }
                        disabled={!canFullWR}
                        title={
                          !canFullWR
                            ? 'No tienes permiso para seleccionar'
                            : undefined
                        }
                        checked={checked}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleAll();
                        }}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Solicitud
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Solicitante
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Prioridad
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Ubicación
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Adjuntos
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Responsable
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="py-8 text-center text-gray-400"
                      >
                        Cargando…
                      </td>
                    </tr>
                  ) : ticketsToShow.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="py-8 text-center text-gray-400"
                      >
                        No hay tickets pendientes.
                      </td>
                    </tr>
                  ) : (
                    ticketsToShow.map((t) => {
                      const imagePaths = getTicketImagePaths(t.image ?? '');
                      const firstAsset = imagePaths[0];
                      const selected = selectedTicket.includes(t);
                      const assigneeValue = getAssigneeFor(Number(t.id));

                      return (
                        <tr
                          key={t.id}
                          className={cx(
                            'hover:bg-gray-50 transition cursor-pointer',
                            selected && 'bg-indigo-50'
                          )}
                          onClick={() => setDetailTicket(t)}
                        >
                          <td
                            className="relative px-6 w-12"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {selected && (
                              <div className="absolute inset-y-0 left-0 w-0.5 bg-indigo-600" />
                            )}
                            <input
                              type="checkbox"
                              className={
                                'h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer' +
                                (!canFullWR
                                  ? ' opacity-40 cursor-not-allowed'
                                  : '')
                              }
                              disabled={!canFullWR}
                              title={
                                !canFullWR
                                  ? 'No tienes permiso para seleccionar'
                                  : undefined
                              }
                              checked={selected}
                              onChange={(e) => {
                                if (e.target.checked)
                                  setSelectedTicket((prev) => [...prev, t]);
                                else
                                  setSelectedTicket((prev) =>
                                    prev.filter((x) => x !== t)
                                  );
                              }}
                            />
                          </td>
                          <td className="px-4 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span>#{t.id}</span>

                              {(() => {
                                const siId = (t as TicketWithSpecialIncident)
                                  .special_incident_id;
                                const chip = renderSpecialIncidentChip(siId);
                                return chip ? (
                                  <div className="mt-1 inline-flex items-center gap-1">
                                    {chip}
                                    <span
                                      role="img"
                                      aria-label="incidente especial"
                                      title="Incidente especial"
                                    >
                                      🚨
                                    </span>
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="text-sm font-medium text-gray-900 wrap-anywhere line-clamp-1">
                              {t.title}
                            </div>
                            <div className="text-sm text-gray-500 wrap-anywhere line-clamp-1">
                              {t.description}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                            {t.requester}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <PriorityChip value={t.priority ?? 'Media'} />
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <StatusChip value={t.status ?? 'Nueva'} />
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                            {t.location}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {firstAsset ? (
                              <img
                                src={getPublicImageUrl(firstAsset)}
                                alt="Activo"
                                className="h-10 w-20 object-cover rounded"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDetailTicket(t);
                                }}
                              />
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td
                            className="px-4 py-4 text-sm text-gray-700"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <select
                              className={
                                'w-full rounded border-gray-300' +
                                (!canFullWR
                                  ? ' opacity-50 cursor-not-allowed bg-gray-100'
                                  : '')
                              }
                              disabled={loadingAssignees || !canFullWR}
                              value={assigneeValue}
                              onChange={(e) =>
                                setAssigneeFor(
                                  Number(t.id),
                                  Number(e.target.value)
                                )
                              }
                            >
                              <option value="" disabled>
                                Selecciona…
                              </option>
                              {SECTIONS_ORDER.map((g) => (
                                <optgroup key={g} label={g}>
                                  {(bySectionActive[g] ?? []).map(
                                    (a: Assignee | undefined) =>
                                      a ? (
                                        <option key={a.id} value={a.id}>
                                          {formatAssigneeFullName(a)}
                                        </option>
                                      ) : null
                                  )}
                                </optgroup>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                            {formatDateInTimezone(t.created_at)}
                          </td>
                          <td
                            className="px-4 py-4 whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-3">
                              <button
                                className={
                                  'text-emerald-600 hover:text-emerald-500 cursor-pointer' +
                                  (!canFullWR || !assigneeValue
                                    ? ' opacity-40 cursor-not-allowed'
                                    : '')
                                }
                                disabled={!canFullWR || !assigneeValue}
                                title={
                                  !canFullWR
                                    ? 'No tienes permiso para aceptar'
                                    : !assigneeValue
                                    ? 'Selecciona un responsable'
                                    : undefined
                                }
                                onClick={() => handleAcceptOne(Number(t.id))}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth="1.5"
                                  stroke="currentColor"
                                  className="size-6"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 0 1 3.375 3.375M9 15l2.25 2.25L15 12"
                                  />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Paginación */}
      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-medium disabled:opacity-40 cursor-pointer hover:bg-gray-300 disabled:hover:bg-gray-200"
        >
          Anterior
        </button>
        <button
          onClick={() =>
            setPage((p) =>
              p + 1 < Math.ceil(totalCount / PAGE_SIZE) ? p + 1 : p
            )
          }
          disabled={page + 1 >= Math.ceil(totalCount / PAGE_SIZE)}
          className="px-4 py-2 rounded bg-indigo-600 text-white font-medium disabled:opacity-40 cursor-pointer hover:bg-indigo-500 disabled:hover:bg-indigo-600"
        >
          Siguiente
        </button>
      </div>

      {/* Modal (componente externo) */}
      {detailTicket && (
        <WorkRequestsDetailModal
          ticket={detailTicket}
          onClose={() => setDetailTicket(null)}
          canFullWR={canFullWR}
          getAssigneeFor={getAssigneeFor}
          setAssigneeFor={setAssigneeFor}
          onAccepted={async () => {
            await reload();
            setDetailTicket(null);
          }}
        />
      )}
    </div>
  );
}
