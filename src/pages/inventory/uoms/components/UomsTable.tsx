import { type RefObject } from 'react';
import type { UomRow } from '../../../../types/inventory';
import { Pencil, Trash2 } from 'lucide-react';
import { DangerButton, GhostButton } from './buttons';

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
    <div className="hidden md:block">
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {/* top tint bar */}
        <div className="h-11 border-b border-slate-200 bg-indigo-50/60" />

        <div className="-mt-6 p-4">
          <div className="overflow-auto rounded-xl ring-1 ring-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 w-12">
                    <input
                      ref={checkboxRef}
                      type="checkbox"
                      disabled={!canManage || rows.length === 0 || isLoading}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
                      checked={checked}
                      onChange={onToggleAll}
                      aria-label="Seleccionar todo"
                    />
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Código
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Nombre
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-10 text-center text-slate-400"
                    >
                      Cargando…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-10 text-center text-slate-400"
                    >
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
                          'transition',
                          selected ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                        )}
                      >
                        <td className="relative px-6 w-12">
                          {selected && (
                            <div className="absolute inset-y-0 left-0 w-0.5 bg-indigo-600" />
                          )}
                          <input
                            type="checkbox"
                            disabled={!canManage}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
                            checked={selected}
                            onChange={(e) => {
                              if (e.target.checked)
                                setSelectedRows((prev) => [...prev, r]);
                              else
                                setSelectedRows((prev) =>
                                  prev.filter((x) => x !== r)
                                );
                            }}
                            aria-label={`Seleccionar ${r.code}`}
                          />
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-mono font-semibold text-slate-900">
                              {r.code}
                            </span>
                            <span className="text-xs text-slate-400">UoM</span>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-900">
                          <div className="font-semibold">{r.name}</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            Unidad de medida
                          </div>
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <GhostButton
                              disabled={!canManage}
                              onClick={() => onEdit(r)}
                            >
                              <span className="inline-flex items-center gap-2">
                                <Pencil className="h-4 w-4" />
                                Editar
                              </span>
                            </GhostButton>

                            <DangerButton
                              disabled={!canManage}
                              onClick={() => onDelete(r)}
                              icon={Trash2}
                            >
                              Eliminar
                            </DangerButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {indeterminate ? (
            <div className="mt-3 text-xs text-slate-500">
              Hay selección parcial (no todas las filas están seleccionadas).
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
