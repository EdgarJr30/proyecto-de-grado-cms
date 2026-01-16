import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { PERMISSIONS } from '../../../rbac/permissionRegistry';
import type { PermissionDef } from '../../../rbac/permissionRegistry';
import { Can, useCan } from '../../../rbac/PermissionsContext';
import { toast } from 'react-toastify';

type Role = { id: number; name: string; description?: string | null };
type RPIdRow = { permission_id: string };
type PermRow = { code: string };

// Paleta basada en tus imágenes
const BLUE = {
  base: '#1E5BFF', // sin hover
  hover: '#2F6BFF', // con hover
  ring: '#93B5FF', // anillo de foco suave
};

export default function RoleEditor() {
  const { id } = useParams<{ id: string }>();
  const roleId = Number(id);
  const navigate = useNavigate();
  const canManage = useCan('rbac:manage_roles');

  const [role, setRole] = useState<Role | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(roleId)) return;

    const load = async () => {
      const { data: r, error: er } = await supabase
        .from('roles')
        .select('id,name,description')
        .eq('id', roleId)
        .single();
      if (er) throw er;
      setRole(r as Role);

      const { data: rp, error: erp } = await supabase
        .from('role_permissions')
        .select('permission_id')
        .eq('role_id', roleId);
      if (erp) throw erp;

      const ids =
        (rp as RPIdRow[] | null)?.map((row) => row.permission_id) ?? [];

      let codes: string[] = [];
      if (ids.length > 0) {
        const { data: ps, error: eps } = await supabase
          .from('permissions')
          .select('code')
          .in('id', ids);
        if (eps) throw eps;
        codes = (ps as PermRow[] | null)?.map((p) => p.code) ?? [];
      }

      setChecked(new Set(codes));
    };

    load().catch((err) => {
      const m = err instanceof Error ? err.message : String(err);
      setMsg(`Error cargando rol: ${m}`);
      toast.error(`Error cargando rol: ${m}`);
    });
  }, [roleId]);

  const grouped = useMemo(() => {
    const byRes: Record<string, PermissionDef[]> = {};
    for (const p of PERMISSIONS) {
      const code = `${p.resource}:${p.action}`;
      if (filter) {
        const f = filter.toLowerCase();
        const matches =
          p.label.toLowerCase().includes(f) || code.toLowerCase().includes(f);
        if (!matches) continue;
      }
      (byRes[p.resource] ??= []).push(p);
    }
    return Object.entries(byRes).sort(([a], [b]) => a.localeCompare(b));
  }, [filter]);

  const toggle = (code: string) =>
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });

  const toggleGroup = (resource: string, selectAll: boolean) => {
    const perms = PERMISSIONS.filter((p) => p.resource === resource);
    setChecked((prev) => {
      const n = new Set(prev);
      perms.forEach((p) => {
        const code = `${p.resource}:${p.action}`;
        if (selectAll) n.add(code);
        else n.delete(code);
      });
      return n;
    });
  };

  const save = async () => {
    if (!Number.isFinite(roleId)) return;
    try {
      setSaving(true);
      const codes = Array.from(checked);
      const { error } = await supabase.rpc('set_role_permissions', {
        p_role_id: roleId,
        p_perm_codes: codes,
      });
      if (error) throw error;

      toast.success('Permisos guardados correctamente');
      navigate('/admin/permisos', { replace: true });
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : 'Error guardando permisos';
      setMsg(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!role)
    return (
      <div className="space-y-3">
        <div className="h-9 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-5 w-72 bg-gray-100 rounded animate-pulse" />
        <div className="h-40 bg-gray-50 rounded animate-pulse" />
      </div>
    );

  return (
    <div className="space-y-8">
      {/* Header limpio (sin transparencia ni sticky) */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            Permisos del rol
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 bg-muted/60">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {role.name}
            </span>
            {role.description && (
              <span className="truncate">{role.description}</span>
            )}
          </div>
        </div>

        {/* Acciones: Cancelar (izquierda donde estaba Volver) y Guardar (derecha) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-xl border transition cursor-pointer
             hover:bg-blue-50 hover:border-blue-200 text-blue-700
             focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93B5FF]"
          >
            Cancelar
          </button>
          <Can perm="rbac:manage_roles">
            <button
              onClick={save}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-white transition cursor-pointer shadow-sm
               focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93B5FF]"
              style={{ backgroundColor: BLUE.base }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = BLUE.hover)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = BLUE.base)
              }
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </Can>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative w-full sm:max-w-md">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Filtrar por nombre o code…"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border bg-background transition
             focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93B5FF]"
            style={{ boxShadow: '0 0 0 0 rgba(0,0,0,0)', outline: 'none' }}
            onChange={(e) => setFilter(e.target.value)}
            value={filter}
          />
        </div>
        <span className="text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1.5">
            <strong>{checked.size}</strong> seleccionados
          </span>
        </span>
      </div>

      {/* Mensaje de error en UI (además del toast) */}
      {msg && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {msg}
        </div>
      )}

      {/* Listado por grupos */}
      <div className="grid gap-5">
        {grouped.map(([resource, perms]) => (
          <section
            key={resource}
            className="rounded-2xl border bg-white shadow-sm p-4 transition hover:shadow-md"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="h-8 w-8 rounded-xl grid place-items-center"
                  style={{ backgroundColor: '#EEF3FF' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path
                      d="M4 7h16M4 12h16M4 17h16"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <h3 className="font-semibold capitalize tracking-tight">
                  {resource.replace(/_/g, ' ')}
                </h3>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className="text-xs px-3 py-1.5 rounded-md border transition cursor-pointer
                             hover:bg-blue-50 hover:border-blue-200 text-blue-700"
                  onClick={() => toggleGroup(resource, true)}
                >
                  Seleccionar todo
                </button>
                <button
                  className="text-xs px-3 py-1.5 rounded-md border transition cursor-pointer
                             hover:bg-blue-50 hover:border-blue-200 text-blue-700"
                  onClick={() => toggleGroup(resource, false)}
                >
                  Quitar todo
                </button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {perms.map((p) => {
                const code = `${p.resource}:${p.action}`;
                const isOn = checked.has(code);
                return (
                  <label
                    key={code}
                    className={[
                      'flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer',
                      isOn
                        ? 'bg-blue-50 border-blue-200'
                        : 'hover:bg-gray-50 hover:shadow-sm',
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 mt-0.5 cursor-pointer accent-blue-600"
                      checked={isOn}
                      onChange={() => toggle(code)}
                      disabled={!canManage}
                    />
                    <div className="leading-tight">
                      <div className="font-medium">{p.label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {code}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
