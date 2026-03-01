import { type RefObject } from 'react';
import type { UomRow } from '../../../../types/inventory';
import { Pencil, Trash2 } from 'lucide-react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function UomsTable({
  rows,
  isLoading,
  selectedRows,
  setSelectedRows,
  canManage,
  checked,
  indeterminate,
  onToggleAll,
  checkboxRef,
  onEdit,
  onDelete,
}: {
  rows: UomRow[];
  isLoading: boolean;
  selectedRows: UomRow[];
  setSelectedRows: React.Dispatch<React.SetStateAction<UomRow[]>>;
  canManage: boolean;
  checked: boolean;
  indeterminate: boolean;
  onToggleAll: () => void;
  checkboxRef: RefObject<HTMLInputElement | null>;
  onEdit: (row: UomRow) => void;
  onDelete: (row: UomRow) => void;
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
                disabled={!canManage || rows.length === 0 || isLoading}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                checked={checked}
                onChange={onToggleAll}
                aria-label="Seleccionar todo"
              />
            </th>

            <th className="text-left font-semibold text-slate-600 px-5 py-3">
              Código
            </th>
            <th className="text-left font-semibold text-slate-600 px-5 py-3">
              Nombre
            </th>
            <th className="text-right font-semibold text-slate-600 px-5 py-3">
              Acciones
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {isLoading ? (
            <tr>
              <td colSpan={4} className="py-10 text-center text-slate-400">
                Cargando…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-10 text-center text-slate-400">
                Sin resultados.
              </td>
            </tr>
          ) : (
            rows.map((r) => {
              const selected = selectedRows.includes(r);

              return (
                <tr
                  key={r.id}
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
                          setSelectedRows((prev) => [...prev, r]);
                          return;
                        }
                        setSelectedRows((prev) => prev.filter((x) => x !== r));
                      }}
                      aria-label={`Seleccionar ${r.code}`}
                    />
                  </td>

                  <td className="px-5 py-3">
                    <div className="font-mono font-semibold text-slate-900">{r.code}</div>
                  </td>

                  <td className="px-5 py-3 text-slate-900">
                    <div className="font-semibold">{r.name}</div>
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
                        onClick={() => onEdit(r)}
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
                        onClick={() => onDelete(r)}
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

      {indeterminate ? (
        <div className="px-5 py-3 text-xs text-slate-500 border-t border-slate-100 bg-white">
          Hay selección parcial (no todas las filas están seleccionadas).
        </div>
      ) : null}
    </div>
  );
}
