import type { VendorRow } from '../../../../types/inventory';
import { Pencil, Trash2 } from 'lucide-react';
import { DangerButton, GhostButton } from './buttons';

export function VendorsTable({
  rows,
  loading,
  isReadOnly,
  onEdit,
  onDelete,
}: {
  rows: VendorRow[];
  loading: boolean;
  isReadOnly: boolean;
  onEdit: (row: VendorRow) => void;
  onDelete: (row: VendorRow) => void;
}) {
  return (
    <div className="hidden md:block">
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="h-11 border-b border-slate-200 bg-blue-50/60" />

        <div className="-mt-6 p-4">
          <div className="overflow-auto rounded-xl ring-1 ring-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Teléfono
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 w-60">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      Cargando...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      Sin proveedores.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 font-medium text-slate-900">
                        {row.name}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {row.email ?? '—'}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {row.phone ?? '—'}
                      </td>
                      <td className="px-4 py-4">
                        {row.is_active ? (
                          <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-medium">
                            Activo
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <GhostButton
                            disabled={isReadOnly}
                            onClick={() => onEdit(row)}
                            icon={Pencil}
                          >
                            Editar
                          </GhostButton>
                          <DangerButton
                            disabled={isReadOnly}
                            onClick={() => onDelete(row)}
                            icon={Trash2}
                          >
                            Eliminar
                          </DangerButton>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
