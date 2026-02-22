import { useEffect, useMemo, useState } from 'react';
import {
  KeyRound,
  Loader2,
  Save,
  Ticket,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { getSession } from '../utils/auth';
import Sidebar from '../components/layout/Sidebar';
import { getTicketsByUserId } from '../services/ticketService';
import {
  getPublicImageUrl,
  getTicketImagePaths,
} from '../services/storageService';
import {
  changeCurrentUserPassword,
} from '../services/userService';
import type { Ticket as TicketRow } from '../types/Ticket';
import type { FilterState } from '../types/filters';
import type { MyTicketsFilterKey } from '../features/management/myTicketsFilters';
import MyTicketsFiltersBar from '../components/dashboard/ticket/MyTicketsFiltersBar';
import { useLocationCatalog } from '../hooks/useLocationCatalog';
import { usePermissions } from '../rbac/PermissionsContext';
import { useUser } from '../context/UserContext';
import { showToastError, showToastSuccess } from '../notifications/toast';
import PasswordInput from '../components/ui/password-input';
import '../styles/peopleAsana.css';

const PAGE_SIZE = 8;
const INPUT_CLASS =
  'block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';
const INPUT_READONLY_CLASS =
  'block w-full rounded-xl border border-gray-300 bg-gray-100 px-3 py-2.5 text-sm text-gray-600 shadow-sm';

type ProfileTab = 'tickets' | 'profile' | 'security';

function priorityChipClass(value?: TicketRow['priority']) {
  if (value === 'Alta') return 'bg-orange-50 text-orange-700 border-orange-200';
  if (value === 'Media') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

function statusChipClass(value?: TicketRow['status']) {
  if (value === 'En Ejecución') return 'bg-sky-50 text-sky-700 border-sky-200';
  if (value === 'Finalizadas')
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

function TabButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition cursor-pointer ${
        active
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

export default function MyTicketsPage() {
  const { getLocationLabel } = useLocationCatalog();
  const { profile, update, refresh } = useUser();
  const { roles } = usePermissions();

  const [activeTab, setActiveTab] = useState<ProfileTab>('tickets');

  // Estado para tickets
  const [userId, setUserId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [filters, setFilters] = useState<Record<MyTicketsFilterKey, unknown>>(
    {} as Record<MyTicketsFilterKey, unknown>
  );
  const [page, setPage] = useState(0);

  // Estado para datos personales
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Estado para contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const mergedFilters = useMemo<FilterState<MyTicketsFilterKey>>(
    () => filters as FilterState<MyTicketsFilterKey>,
    [filters]
  );

  const filtersKey = useMemo(() => JSON.stringify(mergedFilters), [mergedFilters]);

  const rolesString = useMemo(
    () => (roles.length > 0 ? roles.join(', ') : 'Sin roles asignados'),
    [roles]
  );
  const locationLabel = useMemo(
    () => getLocationLabel(profile?.location_id, 'Sin ubicación'),
    [getLocationLabel, profile?.location_id]
  );

  const initialName = (profile?.name ?? '').trim();
  const initialLastName = (profile?.last_name ?? '').trim();
  const normalizedName = name.trim();
  const normalizedLastName = lastName.trim();
  const profileChanged =
    normalizedName !== initialName || normalizedLastName !== initialLastName;
  const canSaveProfile =
    normalizedName.length > 0 &&
    normalizedLastName.length > 0 &&
    profileChanged &&
    !savingProfile;

  // 1) Obtiene userId desde sesión
  useEffect(() => {
    let active = true;

    (async () => {
      const { data } = await getSession();
      if (!active) return;
      setUserId(data.session?.user?.id ?? null);
    })();

    return () => {
      active = false;
    };
  }, []);

  // 2) Carga tickets del usuario actual
  useEffect(() => {
    let active = true;

    (async () => {
      if (!userId) {
        setTickets([]);
        setTicketsLoading(false);
        return;
      }

      setTicketsLoading(true);
      try {
        const rows = await getTicketsByUserId(userId);
        if (!active) return;
        setTickets(rows);
      } catch (error) {
        if (!active) return;
        console.error(error);
        showToastError('No se pudieron cargar tus tickets.');
        setTickets([]);
      } finally {
        if (active) setTicketsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  // Rehidrata form de perfil cuando cambian los datos
  useEffect(() => {
    setName(profile?.name ?? '');
    setLastName(profile?.last_name ?? '');
  }, [profile?.name, profile?.last_name]);

  const filteredTickets = useMemo(() => {
    const term =
      typeof mergedFilters.q === 'string'
        ? mergedFilters.q.trim().toLowerCase()
        : '';
    const statuses = Array.isArray(mergedFilters.status)
      ? mergedFilters.status.map(String)
      : [];
    const priorities = Array.isArray(mergedFilters.priority)
      ? mergedFilters.priority.map(String)
      : [];
    const createdRange =
      mergedFilters.created_at && typeof mergedFilters.created_at === 'object'
        ? (mergedFilters.created_at as { from?: string; to?: string })
        : undefined;

    return tickets.filter((ticket) => {
      if (term.length >= 2) {
        const haystack = [
          String(ticket.id ?? ''),
          ticket.title ?? '',
          ticket.description ?? '',
          ticket.requester ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      if (statuses.length > 0 && !statuses.includes(ticket.status)) {
        return false;
      }

      if (priorities.length > 0 && !priorities.includes(ticket.priority)) {
        return false;
      }

      if (createdRange?.from || createdRange?.to) {
        const createdDate =
          typeof ticket.created_at === 'string'
            ? ticket.created_at.slice(0, 10)
            : '';
        if (createdRange.from && createdDate < createdRange.from) return false;
        if (createdRange.to && createdDate > createdRange.to) return false;
      }

      return true;
    });
  }, [tickets, mergedFilters]);

  useEffect(() => {
    setPage(0);
  }, [filtersKey, tickets.length]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);

  const visibleTickets = useMemo(() => {
    const from = safePage * PAGE_SIZE;
    const to = from + PAGE_SIZE;
    return filteredTickets.slice(from, to);
  }, [filteredTickets, safePage]);

  const renderLocation = (ticket: TicketRow) => {
    const fromRow = (ticket as TicketRow & { location_name?: string | null })
      .location_name;
    if (fromRow) return fromRow;
    return getLocationLabel(ticket.location_id);
  };

  const handleSaveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!normalizedName || !normalizedLastName) {
      showToastError('Completa nombre y apellido para guardar.');
      return;
    }

    if (!profileChanged) {
      showToastSuccess('No hay cambios pendientes en el perfil.');
      return;
    }

    setSavingProfile(true);
    try {
      const result = await update({
        name: normalizedName,
        last_name: normalizedLastName,
      });

      if (!result.ok) {
        showToastError(result.error ?? 'No se pudo actualizar tu perfil.');
        return;
      }

      await refresh({ silent: true });
      showToastSuccess('Datos personales actualizados.');
    } catch (error) {
      showToastError(
        error instanceof Error
          ? error.message
          : 'Ocurrió un error al actualizar el perfil.'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const current = currentPassword.trim();
    const next = newPassword.trim();
    const confirm = confirmPassword.trim();

    if (!current) {
      showToastError('Debes indicar la contraseña actual.');
      return;
    }
    if (!next) {
      showToastError('Debes indicar una nueva contraseña.');
      return;
    }
    if (next.length < 8) {
      showToastError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (next === current) {
      showToastError(
        'La nueva contraseña debe ser diferente a la contraseña actual.'
      );
      return;
    }
    if (next !== confirm) {
      showToastError('La confirmación no coincide con la nueva contraseña.');
      return;
    }

    setSavingPassword(true);
    try {
      await changeCurrentUserPassword(current, next);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToastSuccess('Contraseña actualizada correctamente.');
    } catch (error) {
      showToastError(
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar la contraseña.'
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const profileTabs = (
    <div className="flex w-full flex-wrap items-center gap-1 rounded-2xl border border-gray-200 bg-white/90 p-1 shadow-sm md:w-fit">
      <TabButton
        active={activeTab === 'tickets'}
        label="Mis tickets"
        icon={Ticket}
        onClick={() => setActiveTab('tickets')}
      />
      <TabButton
        active={activeTab === 'profile'}
        label="Datos personales"
        icon={UserRound}
        onClick={() => setActiveTab('profile')}
      />
      <TabButton
        active={activeTab === 'security'}
        label="Seguridad"
        icon={KeyRound}
        onClick={() => setActiveTab('security')}
      />
    </div>
  );

  return (
    <div className="people-asana h-screen flex bg-[#f3f4f8]">
      <Sidebar />
      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <section className="people-content flex-1 overflow-auto px-4 md:px-6 lg:px-8 pt-3 pb-6">
          <div className="people-filters">
            <MyTicketsFiltersBar
              onApply={(vals) => {
                setFilters((prev) =>
                  JSON.stringify(prev) === JSON.stringify(vals) ? prev : vals
                );
              }}
              moduleTabs={profileTabs}
              showFilters={activeTab === 'tickets'}
            />
          </div>

          {activeTab === 'tickets' && (
            <div className="mt-3">
              <div className="people-table-toolbar flex items-center gap-3 rounded-xl border border-gray-200 bg-white/85 px-3 py-2 shadow-sm">
                <p className="text-sm font-medium text-gray-700">
                  Mis tickets - Página {safePage + 1} de {totalPages} -{' '}
                  {filteredTickets.length} total
                </p>
              </div>

              {ticketsLoading ? (
                <div className="mt-3 rounded-xl border border-gray-200 bg-white py-10 text-center text-gray-400">
                  Cargando tickets...
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="mt-3 rounded-xl border border-gray-200 bg-white py-10 text-center text-gray-400">
                  No tienes tickets con los filtros actuales.
                </div>
              ) : (
                <div className="mt-3">
                  <div className="md:hidden space-y-3">
                    {visibleTickets.map((ticket) => {
                      const firstImage = getTicketImagePaths(ticket.image ?? '')[0];
                      return (
                        <article
                          key={ticket.id}
                          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-base font-semibold text-gray-900 line-clamp-1">
                              {ticket.title}
                            </h3>
                            <div className="flex items-center gap-1">
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${priorityChipClass(
                                  ticket.priority
                                )}`}
                              >
                                {ticket.priority}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusChipClass(
                                  ticket.status
                                )}`}
                              >
                                {ticket.status}
                              </span>
                            </div>
                          </div>
                          <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                            {ticket.description || 'Sin descripción'}
                          </p>
                          {firstImage ? (
                            <img
                              src={getPublicImageUrl(firstImage)}
                              alt="Adjunto"
                              className="mt-3 h-24 w-full rounded-md border border-gray-200 object-cover"
                            />
                          ) : null}
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                            <span>ID: {ticket.id}</span>
                            <span>Ubicación: {renderLocation(ticket)}</span>
                            <span>Solicitante: {ticket.requester || '—'}</span>
                            <span>Fecha: {ticket.incident_date || '—'}</span>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <div className="hidden md:block">
                    <div className="overflow-auto rounded-2xl ring-1 ring-gray-200 bg-white shadow-sm">
                      <table className="people-table min-w-full border-separate border-spacing-0">
                        <thead className="people-table-head bg-white sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              ID
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              Ticket
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              Prioridad
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              Estado
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              Ubicación
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              Fecha
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              Creado
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              Adjunto
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {visibleTickets.map((ticket) => {
                            const firstImage = getTicketImagePaths(ticket.image ?? '')[0];
                            return (
                              <tr
                                key={ticket.id}
                                className="people-table-row hover:bg-indigo-50/40 transition"
                              >
                                <td className="px-4 py-3 border-b border-gray-100 text-sm font-medium text-gray-900 whitespace-nowrap">
                                  #{ticket.id}
                                </td>
                                <td className="px-4 py-3 border-b border-gray-100 min-w-[260px]">
                                  <div className="text-sm font-semibold text-gray-900 line-clamp-1">
                                    {ticket.title}
                                  </div>
                                  <div className="text-xs text-gray-500 line-clamp-1">
                                    {ticket.description || 'Sin descripción'}
                                  </div>
                                </td>
                                <td className="px-4 py-3 border-b border-gray-100 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${priorityChipClass(
                                      ticket.priority
                                    )}`}
                                  >
                                    {ticket.priority}
                                  </span>
                                </td>
                                <td className="px-4 py-3 border-b border-gray-100 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusChipClass(
                                      ticket.status
                                    )}`}
                                  >
                                    {ticket.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 border-b border-gray-100 text-sm text-gray-700 whitespace-nowrap">
                                  {renderLocation(ticket)}
                                </td>
                                <td className="px-4 py-3 border-b border-gray-100 text-sm text-gray-700 whitespace-nowrap">
                                  {ticket.incident_date || '—'}
                                </td>
                                <td className="px-4 py-3 border-b border-gray-100 text-sm text-gray-700 whitespace-nowrap">
                                  {ticket.created_at
                                    ? new Date(ticket.created_at).toLocaleDateString(
                                        'es-DO'
                                      )
                                    : '—'}
                                </td>
                                <td className="px-4 py-3 border-b border-gray-100 whitespace-nowrap">
                                  {firstImage ? (
                                    <img
                                      src={getPublicImageUrl(firstImage)}
                                      alt="Adjunto"
                                      className="h-9 w-14 rounded-md border border-gray-200 object-cover"
                                    />
                                  ) : (
                                    <span className="text-sm text-gray-400">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {!ticketsLoading && filteredTickets.length > 0 && (
                <div className="people-pagination mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium disabled:opacity-40 cursor-pointer hover:bg-gray-100 disabled:hover:bg-white"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((p) => (p + 1 < totalPages ? p + 1 : p))
                    }
                    disabled={safePage + 1 >= totalPages}
                    className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-40 cursor-pointer hover:bg-indigo-500 disabled:hover:bg-indigo-600"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <section className="mt-4 rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <UserRound className="h-5 w-5 text-indigo-600" />
                <h3 className="text-xl font-bold text-gray-900">Datos personales</h3>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Solo puedes actualizar tu nombre y apellido. Correo, ubicación y
                roles se muestran como referencia y no son editables.
              </p>

              <form className="mt-5 space-y-4" onSubmit={handleSaveProfile}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="profile-name"
                      className="mb-1.5 block text-sm font-semibold text-gray-800"
                    >
                      Nombre
                    </label>
                    <input
                      id="profile-name"
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className={INPUT_CLASS}
                      placeholder="Tu nombre"
                      maxLength={60}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="profile-last-name"
                      className="mb-1.5 block text-sm font-semibold text-gray-800"
                    >
                      Apellido
                    </label>
                    <input
                      id="profile-last-name"
                      type="text"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      className={INPUT_CLASS}
                      placeholder="Tu apellido"
                      maxLength={60}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="profile-email"
                      className="mb-1.5 block text-sm font-semibold text-gray-800"
                    >
                      Correo electrónico
                    </label>
                    <input
                      id="profile-email"
                      type="text"
                      readOnly
                      value={profile?.email ?? '—'}
                      className={INPUT_READONLY_CLASS}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="profile-location"
                      className="mb-1.5 block text-sm font-semibold text-gray-800"
                    >
                      Ubicación
                    </label>
                    <input
                      id="profile-location"
                      type="text"
                      readOnly
                      value={locationLabel}
                      className={INPUT_READONLY_CLASS}
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="profile-roles"
                    className="mb-1.5 block text-sm font-semibold text-gray-800"
                  >
                    Roles
                  </label>
                  <input
                    id="profile-roles"
                    type="text"
                    readOnly
                    value={rolesString}
                    className={INPUT_READONLY_CLASS}
                  />
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Nota: si necesitas cambiar correo, ubicación o permisos, debes
                  solicitarlo a un administrador.
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!canSaveProfile}
                    className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingProfile ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {savingProfile ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {activeTab === 'security' && (
            <section className="mt-4 rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-indigo-600" />
                <h3 className="text-xl font-bold text-gray-900">Cambiar contraseña</h3>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Primero debes confirmar tu contraseña actual. Luego define una nueva
                contraseña segura.
              </p>

              <form className="mt-5 space-y-4" onSubmit={handleChangePassword}>
                <div>
                  <label
                    htmlFor="current-password"
                    className="mb-1.5 block text-sm font-semibold text-gray-800"
                  >
                    Contraseña actual
                  </label>
                  <PasswordInput
                    id="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className={INPUT_CLASS}
                    autoComplete="current-password"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="new-password"
                      className="mb-1.5 block text-sm font-semibold text-gray-800"
                    >
                      Nueva contraseña
                    </label>
                    <PasswordInput
                      id="new-password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className={INPUT_CLASS}
                      autoComplete="new-password"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="confirm-password"
                      className="mb-1.5 block text-sm font-semibold text-gray-800"
                    >
                      Confirmar contraseña
                    </label>
                    <PasswordInput
                      id="confirm-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className={INPUT_CLASS}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Recomendación: usa al menos 8 caracteres, combinando letras,
                  números y símbolos.
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="inline-flex min-w-[210px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingPassword ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4" />
                    )}
                    {savingPassword
                      ? 'Actualizando contraseña...'
                      : 'Actualizar contraseña'}
                  </button>
                </div>
              </form>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}
