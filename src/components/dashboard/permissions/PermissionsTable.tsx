import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { PERMISSIONS } from '../../../rbac/permissionRegistry';
import { Can } from '../../../rbac/PermissionsContext';
import { syncPermissions } from '../../../rbac/syncPermissions';
import { ListChecks, RefreshCw, Info } from 'lucide-react';

type DbPerm = {
  id: string;
  code: string;
  label?: string | null;
  description?: string | null;
};

interface Props {
  searchTerm?: string;
}

export default function PermissionsTable({ searchTerm = '' }: Props) {
  const [rows, setRows] = useState<DbPerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    const { data, error } = await supabase
      .from('permissions')
      .select('id,code,label,description')
      .order('code');

    if (error) setMsg(error.message);
    setRows((data ?? []) as DbPerm[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        (r.label ?? '').toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q)
    );
  }, [rows, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-6 w-6 text-indigo-600" aria-hidden />
          <h3 className="text-2xl font-semibold tracking-tight">Permisos</h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Can perm="rbac:manage_permissions">
            <button
              className="cursor-pointer inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 active:scale-[0.99] transition disabled:opacity-60"
              title="Sincroniza permisos del registro en código hacia la BD"
              disabled={syncing}
              onClick={async () => {
                try {
                  setSyncing(true);
                  await syncPermissions();
                  await load();
                } finally {
                  setSyncing(false);
                }
              }}
              type="button"
            >
              <RefreshCw
                className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`}
              />
              <span className="whitespace-nowrap">
                {syncing ? 'Sincronizando…' : 'Sincronizar'}
              </span>
            </button>
          </Can>
        </div>
      </div>

      {/* Tabla / Card */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 grid gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              🔎
            </div>
            <p className="text-sm text-muted-foreground">No hay permisos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Borde superior perfecto: usamos border-separate + border-spacing-0
               y redondeamos directamente los TH */}
            <table className="w-full text-sm table-fixed border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="bg-gray-50 text-left p-3 font-semibold text-gray-700 border-b border-gray-200 rounded-tl-2xl">
                    Code
                  </th>
                  <th className="bg-gray-50 text-left p-3 font-semibold text-gray-700 border-b border-gray-200">
                    Label
                  </th>
                  <th className="bg-gray-50 text-left p-3 font-semibold text-gray-700 border-b border-gray-200 rounded-tr-2xl">
                    Descripción
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-mono text-xs text-gray-900 border-t border-gray-200">
                      {p.code}
                    </td>
                    <td className="p-3 border-t border-gray-200">
                      {p.label?.trim() ? p.label : '—'}
                    </td>
                    <td className="p-3 text-gray-500 border-t border-gray-200">
                      {p.description?.trim() ? p.description : '—'}
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

      {/* Help / Details */}
      <details className="rounded-xl border bg-white p-4 shadow-sm">
        <summary className="cursor-pointer font-medium inline-flex items-center gap-2">
          <Info className="h-4 w-4 text-indigo-600" />
          ¿Qué se sincroniza?
        </summary>
        <p className="mt-3 text-sm text-muted-foreground">
          Se comparan los permisos definidos en{' '}
          <code className="font-mono">permissionRegistry.ts</code> con la tabla{' '}
          <code className="font-mono">permissions</code> y se
          insertan/actualizan los faltantes. No elimina registros manuales.
        </p>
        <div className="mt-3 text-xs text-muted-foreground">
          <strong>Total en código:</strong> {PERMISSIONS.length}
        </div>
      </details>
    </div>
  );
}
