import { type RefObject } from 'react';
import type { PartCategoryRow } from '../../../../../types/inventory';
import type { CategoryHelpers } from './types';
import { Pencil, Trash2 } from 'lucide-react';
import { DangerButton, GhostButton } from './buttons';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function PartCategoriesTable({
  rows,
  helpers,
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
  rows: PartCategoryRow[];
  helpers: CategoryHelpers;
  isLoading: boolean;
  selectedRows: PartCategoryRow[];
  setSelectedRows: React.Dispatch<React.SetStateAction<PartCategoryRow[]>>;
  canManage: boolean;
  checked: boolean;
  indeterminate: boolean;
  onToggleAll: () => void;
  checkboxRef: RefObject<HTMLInputElement | null>;
  onEdit: (r: PartCategoryRow) => void;
  onDelete: (r: PartCategoryRow) => void;
}) {
  return (
    <div className="hidden md:block">
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="h-11 border-b border-slate-200 bg-blue-50/50" />

        <div className="-mt-6 p-4">
          <div className="overflow-auto rounded-xl ring-1 ring-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 w-12">
                    <input
                      ref={checkboxRef}
                      type="checkbox"
                      disabled={!canManage}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                      checked={checked}
                      onChange={onToggleAll}
                      aria-label="Seleccionar todo"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Padre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Ruta
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
                      colSpan={5}
                      className="py-10 text-center text-slate-400"
                    >
                      Cargando…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-10 text-center text-slate-400"
                    >
                      Sin resultados.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const selected = selectedRows.includes(r);
                    const parent = helpers.labelOf(r.parent_id) ?? '—';
                    const breadcrumb = helpers.breadcrumbOf(r.id);

                    return (
                      <tr
                        key={r.id}
                        className={cx(
                          'transition',
                          selected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                        )}
                      >
                        <td className="relative px-6 w-12">
                          {selected && (
                            <div className="absolute inset-y-0 left-0 w-0.5 bg-blue-600" />
                          )}
                          <input
                            type="checkbox"
                            disabled={!canManage}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                            checked={selected}
                            onChange={(e) => {
                              if (e.target.checked)
                                setSelectedRows((prev) => [...prev, r]);
                              else
                                setSelectedRows((prev) =>
                                  prev.filter((x) => x !== r)
                                );
                            }}
                            aria-label={`Seleccionar ${r.name}`}
                          />
                        </td>

                        <td className="px-4 py-4 text-sm font-semibold text-slate-900">
                          {r.name}
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-700">
                          {parent}
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-500">
                          <span className="line-clamp-1">{breadcrumb}</span>
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
