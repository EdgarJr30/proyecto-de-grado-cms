import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCan } from '../../../../rbac/PermissionsContext';
import {
  showConfirmAlert,
  showToastError,
  showToastSuccess,
} from '../../../../notifications';
import {
  listApprovalProcesses,
  createApprovalProcess,
  updateApprovalProcess,
  deleteApprovalProcess,
  getProcessMemberIds,
  setProcessApprovers,
  setProcessRequesters,
  type ApprovalProcess,
} from '../../../../services/approvalService';
import { getUsersForAssigneeLinking } from '../../../../services/userAdminService';

type UserLite = {
  id: string;
  name: string;
  last_name: string;
  email: string | null;
  is_active: boolean;
};

type FormState = {
  id?: number;
  name: string;
  description: string;
  require_evidence: boolean;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  require_evidence: true,
  is_active: true,
};

function cx(...c: Array<string | false | undefined>) {
  return c.filter(Boolean).join(' ');
}

function userLabel(u: UserLite) {
  const full = `${u.name ?? ''} ${u.last_name ?? ''}`.trim();
  return full.length > 0 ? full : (u.email ?? u.id);
}

const inputCls =
  'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-600 dark:bg-slate-950/40 dark:text-slate-100 dark:focus:ring-sky-500/30';

export default function ApprovalProcessesPanel() {
  const canManage = useCan('approvals:full_access');

  const [processes, setProcesses] = useState<ApprovalProcess[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  // Editor de miembros
  const [membersFor, setMembersFor] = useState<ApprovalProcess | null>(null);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [approverIds, setApproverIds] = useState<Set<string>>(new Set());
  const [requesterIds, setRequesterIds] = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState('');
  const [savingMembers, setSavingMembers] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProcesses(await listApprovalProcesses());
    } catch (e) {
      showToastError(e instanceof Error ? e.message : 'No se pudieron cargar los procesos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProcess = useCallback(async () => {
    if (!form) return;
    if (!form.name.trim()) {
      showToastError('El nombre es obligatorio.');
      return;
    }
    setSaving(true);
    try {
      if (form.id) {
        await updateApprovalProcess(form.id, form);
        showToastSuccess('Proceso actualizado.');
      } else {
        await createApprovalProcess(form);
        showToastSuccess('Proceso creado.');
      }
      setForm(null);
      await load();
    } catch (e) {
      showToastError(e instanceof Error ? e.message : 'No se pudo guardar el proceso.');
    } finally {
      setSaving(false);
    }
  }, [form, load]);

  const toggleActive = useCallback(
    async (p: ApprovalProcess) => {
      try {
        await updateApprovalProcess(p.id, { is_active: !p.is_active });
        await load();
      } catch (e) {
        showToastError(e instanceof Error ? e.message : 'No se pudo cambiar el estado.');
      }
    },
    [load]
  );

  const removeProcess = useCallback(
    async (p: ApprovalProcess) => {
      const ok = await showConfirmAlert({
        title: 'Eliminar proceso',
        text: `¿Eliminar el proceso "${p.name}"? Esta acción no se puede deshacer.`,
      });
      if (!ok) return;
      try {
        await deleteApprovalProcess(p.id);
        showToastSuccess('Proceso eliminado.');
        await load();
      } catch (e) {
        showToastError(e instanceof Error ? e.message : 'No se pudo eliminar.');
      }
    },
    [load]
  );

  const openMembers = useCallback(async (p: ApprovalProcess) => {
    setMembersFor(p);
    setMemberSearch('');
    try {
      const [allUsers, members] = await Promise.all([
        getUsersForAssigneeLinking() as Promise<UserLite[]>,
        getProcessMemberIds(p.id),
      ]);
      setUsers(allUsers);
      setApproverIds(new Set(members.approverIds));
      setRequesterIds(new Set(members.requesterIds));
    } catch (e) {
      showToastError(e instanceof Error ? e.message : 'No se pudieron cargar los miembros.');
      setMembersFor(null);
    }
  }, []);

  const saveMembers = useCallback(async () => {
    if (!membersFor) return;
    setSavingMembers(true);
    try {
      await setProcessApprovers(membersFor.id, [...approverIds]);
      await setProcessRequesters(membersFor.id, [...requesterIds]);
      showToastSuccess('Miembros actualizados.');
      setMembersFor(null);
    } catch (e) {
      showToastError(e instanceof Error ? e.message : 'No se pudieron guardar los miembros.');
    } finally {
      setSavingMembers(false);
    }
  }, [membersFor, approverIds, requesterIds]);

  const filteredUsers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        userLabel(u).toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q)
    );
  }, [users, memberSearch]);

  const toggleId = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  if (!canManage) {
    return (
      <p className="text-sm text-slate-500">
        No tienes permiso para administrar procesos de aprobación.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          Define procesos de validación y asigna aprobadores y solicitantes.
        </p>
        <button
          type="button"
          onClick={() => setForm({ ...EMPTY_FORM })}
          className="h-11 rounded-xl bg-sky-600 px-5 text-sm font-semibold text-white shadow-lg shadow-sky-900/10 transition hover:bg-sky-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:focus-visible:ring-offset-[#071426]"
        >
          Nuevo proceso
        </button>
      </div>

      {form && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/80 dark:bg-slate-950/25">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-500">Nombre</label>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Validación de cierre de OT"
              />
              <p className="mt-1 text-xs text-slate-400">
                El código se genera automáticamente a partir del nombre.
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-500">Descripción</label>
              <input
                className={inputCls}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.require_evidence}
                onChange={(e) => setForm({ ...form, require_evidence: e.target.checked })}
              />
              Requiere evidencia (imagen) obligatoria
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Activo
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setForm(null)}
              className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={saveProcess}
              disabled={saving}
              className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700/80 dark:bg-slate-950/10">
        <table className="min-w-[58rem] divide-y divide-slate-200 text-sm dark:divide-slate-700/80">
          <thead className="bg-slate-50 dark:bg-slate-950/20">
            <tr className="text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              <th className="px-5 py-4">Proceso</th>
              <th className="px-5 py-4">Código</th>
              <th className="px-5 py-4">Evidencia</th>
              <th className="px-5 py-4">Estado</th>
              <th className="px-5 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                  Cargando...
                </td>
              </tr>
            ) : processes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                  Aún no hay procesos de aprobación.
                </td>
              </tr>
            ) : (
              processes.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                  <td className="px-5 py-4">
                    <span className="font-medium text-slate-800 dark:text-slate-100">{p.name}</span>
                    {p.description && (
                      <span className="block text-xs text-slate-400">{p.description}</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{p.code}</td>
                  <td className="px-5 py-4 font-medium text-slate-700 dark:text-slate-100">
                    {p.require_evidence ? 'Obligatoria' : 'Opcional'}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={cx(
                        'inline-flex rounded-full px-3 py-1 text-xs font-medium',
                        p.is_active
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-100 dark:text-emerald-700'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200'
                      )}
                    >
                      {p.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void openMembers(p)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600/80 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Miembros
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            id: p.id,
                            name: p.name,
                            description: p.description ?? '',
                            require_evidence: p.require_evidence,
                            is_active: p.is_active,
                          })
                        }
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600/80 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleActive(p)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600/80 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {p.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeProcess(p)}
                        className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/80 dark:text-rose-300 dark:hover:bg-rose-500/10"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {membersFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Miembros — {membersFor.name}
              </h3>
              <p className="text-xs text-slate-500">
                Marca quién <strong>aprueba</strong> y quién <strong>solicita</strong> (técnicos).
              </p>
            </div>

            <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-700">
              <input
                type="search"
                className={inputCls}
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Buscar usuario por nombre o correo..."
              />
            </div>

            <div className="flex-1 overflow-auto px-5 py-3">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-2">Usuario</th>
                    <th className="py-2 text-center">Aprobador</th>
                    <th className="py-2 text-center">Solicitante</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-2">
                        <span className="text-slate-800 dark:text-slate-100">{userLabel(u)}</span>
                        {u.email && <span className="block text-xs text-slate-400">{u.email}</span>}
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="checkbox"
                          checked={approverIds.has(u.id)}
                          onChange={() => setApproverIds((s) => toggleId(s, u.id))}
                        />
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="checkbox"
                          checked={requesterIds.has(u.id)}
                          onChange={() => setRequesterIds((s) => toggleId(s, u.id))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setMembersFor(null)}
                className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-medium dark:border-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveMembers}
                disabled={savingMembers}
                className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {savingMembers ? 'Guardando...' : 'Guardar miembros'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
