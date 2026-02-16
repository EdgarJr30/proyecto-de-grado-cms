import type { PartCategoryRow } from '../../../../../types/inventory';
import type { CategoryHelpers } from './types';
import { Pencil, Trash2 } from 'lucide-react';
import { DangerButton, GhostButton } from './buttons';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function PartCategoriesMobileList({
  rows,
  helpers,
  isLoading,
  selectedRows,
  setSelectedRows,
  canManage,
  onEdit,
  onDelete,
}: {
  rows: PartCategoryRow[];
  helpers: CategoryHelpers;
  isLoading: boolean;
  selectedRows: PartCategoryRow[];
  setSelectedRows: React.Dispatch<React.SetStateAction<PartCategoryRow[]>>;
  canManage: boolean;
  onEdit: (r: PartCategoryRow) => void;
  onDelete: (r: PartCategoryRow) => void;
}) {
  if (isLoading) {
    return <div className="py-10 text-center text-slate-400">Cargando…</div>;
  }
  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-slate-400">Sin resultados.</div>
    );
  }

  return (
    <div className="md:hidden space-y-3">
      {rows.map((r) => {
        const selected = selectedRows.includes(r);
        const parent = helpers.labelOf(r.parent_id) ?? '—';
        const path = helpers.breadcrumbOf(r.id);

        return (
          <div
            key={r.id}
            className={cx(
              'rounded-2xl border bg-white shadow-sm transition',
              'border-slate-200',
              selected && 'ring-2 ring-blue-300/40'
            )}
          >
            <div className="h-10 rounded-t-2xl border-b border-slate-200 bg-blue-50/50" />

            <div className="p-4 -mt-5">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  checked={selected}
                  disabled={!canManage}
                  onChange={(e) => {
                    if (e.target.checked)
                      setSelectedRows((prev) => [...prev, r]);
                    else setSelectedRows((prev) => prev.filter((x) => x !== r));
                  }}
                />

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {r.name}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Padre:{' '}
                    <span className="font-medium text-slate-700">{parent}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400 line-clamp-2">
                    {path}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <GhostButton disabled={!canManage} onClick={() => onEdit(r)}>
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
