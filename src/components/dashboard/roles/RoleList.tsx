import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Can } from '../../../rbac/PermissionsContext';
import { syncPermissions } from '../../../rbac/syncPermissions';
import { Plus, RefreshCw, ShieldCheck } from 'lucide-react';

export type Role = { id: number; name: string; description?: string | null };

interface Props {
  searchTerm?: string;
  /** Abre el modal de usuarios para el rol indicado */
  onOpenUsers?: (roleId: number) => void;
}

export default function RoleList({ searchTerm = '', onOpenUsers }: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    const { data, error } = await supabase
      .from('roles')
      .select('id,name,description')
      .order('name');

    if (error) setMsg(error.message);
    setRoles((data ?? []) as Role[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q)
    );
  }, [roles, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-indigo-600" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Roles</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Can perm="rbac:manage_permissions">
            <button
              type="button"
              onClick={async () => {
                try {
                  setSyncing(true);
                  await syncPermissions();
                  await load();
                } finally {
                  setSyncing(false);
                }
              }}
              title="Sincroniza permisos del registro en código hacia la BD"
              className="cursor-pointer inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium bg-white hover:bg-gray-50 active:scale-[0.99] transition disabled:opacity-60"
              disabled={syncing}
            >
              <RefreshCw
                className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`}
              />
              <span className="whitespace-nowrap">
                {syncing ? 'Sincronizando…' : 'Sincronizar permisos'}
              </span>
            </button>
          </Can>

          <Can perm="rbac:manage_roles">
            <Link
              to="/admin/roles/new"
              onClick={(e) => {
                e.preventDefault();
                setOpenCreate(true);
              }}
              className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-[0.99] transition"
            >
              <Plus className="h-4 w-4" />
              <span className="whitespace-nowrap">Nuevo rol</span>
            </Link>
          </Can>
        </div>
      </div>

      {/* Contenedor con borde y sombra suave */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        {/* Loading */}
        {loading ? (
          <div className="p-6 grid gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          // Empty state
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              🔎
            </div>
            <p className="text-sm text-muted-foreground">
              {searchTerm
                ? 'No hay roles que coincidan con tu búsqueda.'
                : 'Aún no hay roles.'}
            </p>
            <div className="mt-4 flex justify-center">
              <Can perm="rbac:manage_roles">
                <button
                  onClick={() => setOpenCreate(true)}
                  className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-[0.99] transition"
                >
                  <Plus className="h-4 w-4" />
                  Crear el primero
                </button>
              </Can>
            </div>
          </div>
        ) : (
          // Tabla
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="bg-gray-50 text-left p-3 font-semibold text-gray-700 border-b border-gray-200 rounded-tl-2xl">
                    Nombre
                  </th>
                  <th className="bg-gray-50 text-left p-3 font-semibold text-gray-700 border-b border-gray-200">
                    Descripción
                  </th>
                  <th className="bg-gray-50 text-right p-3 font-semibold text-gray-700 border-b border-gray-200 rounded-tr-2xl">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-medium text-gray-900 border-t border-gray-200">
                      {r.name}
                    </td>
                    <td className="p-3 text-gray-500 border-t border-gray-200">
                      {r.description?.trim() ? r.description : '—'}
                    </td>
                    <td className="p-3 border-t border-gray-200">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/admin/roles/${r.id}`}
                          className="cursor-pointer inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 hover:bg-gray-50"
                          title="Editar permisos del rol"
                        >
                          Editar permisos
                        </Link>

                        <button
                          type="button"
                          onClick={() => onOpenUsers?.(r.id)}
                          className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-white border px-3 py-1.5 text-indigo-700 hover:bg-indigo-50"
                          title="Ver y administrar usuarios del rol"
                        >
                          Usuarios
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {msg && (
          <div className="border-t p-3 text-sm text-red-600 bg-red-50 rounded-b-2xl">
            {msg}
          </div>
        )}
      </div>

      {openCreate && (
        <RoleCreateModal
          onClose={() => {
            setOpenCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}

/* Modal de creación (sin any) */
function RoleCreateModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const createRole = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMsg(null);
    if (!name.trim()) {
      setMsg('Escribe un nombre de rol.');
      return;
    }
    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('roles')
        .insert({ name: name.trim(), description: description.trim() || null });
      if (error) throw error;
      onClose();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error creando rol');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Nuevo rol</h2>
            <button
              onClick={onClose}
              className="cursor-pointer rounded p-1 text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Cerrar"
              title="Cerrar"
            >
              ✕
            </button>
          </div>

          <form onSubmit={createRole} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nombre
              </label>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="p.ej. Administrador"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Descripción (opcional)
              </label>
              <textarea
                className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Permite administrar usuarios, roles y permisos"
              />
            </div>

            {msg && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {msg}
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {submitting && (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-b-transparent" />
                )}
                {submitting ? 'Creando…' : 'Crear rol'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
