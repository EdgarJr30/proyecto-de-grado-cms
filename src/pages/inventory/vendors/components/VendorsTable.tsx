import { type RefObject } from 'react';
import type { VendorRow } from '../../../../types/inventory';
import { Pencil, Trash2 } from 'lucide-react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function VendorsTable({
  rows,
  loading,
  canManage,
  selectedRows,
  setSelectedRows,
  checked,
  onToggleAll,
  checkboxRef,
  onEdit,
  onDelete,
}: {
  rows: VendorRow[];
  loading: boolean;
  canManage: boolean;
  selectedRows: VendorRow[];
  setSelectedRows: React.Dispatch<React.SetStateAction<VendorRow[]>>;
  checked: boolean;
  onToggleAll: () => void;
  checkboxRef: RefObject<HTMLInputElement | null>;
  onEdit: (row: VendorRow) => void;
  onDelete: (row: VendorRow) => void;
}) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-white sticky top-0 z-10">
          <tr className="border-b border-slate-200">
            <th className="px-5 py-3 w-12">
              <input
                ref={checkboxRef}
                type="checkbox"
                disabled={!canManage || rows.length === 0 || loading}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                checked={checked}
                onChange={onToggleAll}
                aria-label="Seleccionar todo"
              />
            </th>
            <th className="text-left font-semibold text-slate-600 px-5 py-3">Nombre</th>
            <th className="text-left font-semibold text-slate-600 px-5 py-3">Email</th>
            <th className="text-left font-semibold text-slate-600 px-5 py-3">Teléfono</th>
            <th className="text-left font-semibold text-slate-600 px-5 py-3">Estado</th>
            <th className="text-right font-semibold text-slate-600 px-5 py-3">Acciones</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td colSpan={6} className="py-10 text-center text-slate-400">
                Cargando...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-10 text-center text-slate-400">
                Sin proveedores.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const selected = selectedRows.includes(row);

              return (
                <tr
                  key={row.id}
                  className={cx(
                    'hover:bg-slate-50/70 transition',
                    selected && 'bg-blue-50/50'
                  )}
                >
                  <td className="px-5 py-3 w-12">
                    <input
                      type="checkbox"
                      disabled={!canManage}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                      checked={selected}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedRows((prev) => [...prev, row]);
                          return;
                        }
                        setSelectedRows((prev) =>
                          prev.filter((item) => item !== row)
                        );
                      }}
                      aria-label={`Seleccionar ${row.name}`}
                    />
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-5 py-3 text-slate-700">{row.email ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-700">{row.phone ?? '—'}</td>
                  <td className="px-5 py-3">
                    {row.is_active ? (
                      <span className="inline-flex px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold">
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className={cx(
                          'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold border',
                          !canManage
                            ? 'border-slate-200 text-slate-400 bg-white cursor-not-allowed'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        )}
                        disabled={!canManage}
                        onClick={() => onEdit(row)}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </button>
                      <button
                        type="button"
                        className={cx(
                          'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold',
                          !canManage
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-rose-600 hover:bg-rose-700 text-white'
                        )}
                        disabled={!canManage}
                        onClick={() => onDelete(row)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
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
  );
}
