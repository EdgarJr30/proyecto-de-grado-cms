import type {
  PartRow,
  PartCategoryRow,
  UomRow,
} from '../../../../types/inventory';
import { Pencil, Ruler, Tag, Trash2 } from 'lucide-react';
import { Chip, CriticalityBadge } from './PartsBadges';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function PartsMobileList(props: {
  isLoading: boolean;
  parts: PartRow[];
  selectedRows: PartRow[];
  setSelectedRows: React.Dispatch<React.SetStateAction<PartRow[]>>;
  canManage: boolean;
  uomById: Map<string, UomRow>;
  catById: Map<string, PartCategoryRow>;
  onEdit: (row: PartRow) => void;
  onDelete: (row: PartRow) => void | Promise<void>;
}) {
  const {
    isLoading,
    parts,
    selectedRows,
    setSelectedRows,
    canManage,
    uomById,
    catById,
    onEdit,
    onDelete,
  } = props;

  return (
    <div className="md:hidden p-4 space-y-3">
      {isLoading ? (
        <div className="py-10 text-center text-slate-400">Cargando…</div>
      ) : parts.length === 0 ? (
        <div className="py-10 text-center text-slate-400">Sin resultados.</div>
      ) : (
        parts.map((p) => {
          const selected = selectedRows.includes(p);
          const u = uomById.get(p.uom_id)?.code ?? '—';
          const c = p.category_id
            ? (catById.get(p.category_id)?.name ?? '—')
            : '—';

          return (
            <div
              key={p.id}
              className={cx(
                'rounded-xl border border-slate-200 bg-white shadow-sm p-4',
                selected && 'ring-2 ring-blue-500/20'
              )}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  disabled={!canManage}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                  checked={selected}
                  onChange={(e) => {
                    if (e.target.checked)
                      setSelectedRows((prev) => [...prev, p]);
                    else setSelectedRows((prev) => prev.filter((x) => x !== p));
                  }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-mono text-slate-900">
                      {p.code}
                    </div>
                    <CriticalityBadge value={p.criticality} />
                  </div>

                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {p.name}
                  </div>

                  {p.description ? (
                    <div className="mt-1 text-xs text-slate-500 line-clamp-2">
                      {p.description}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Chip tone={p.is_active ? 'success' : 'danger'}>
                      {p.is_active ? 'Activo' : 'Inactivo'}
                    </Chip>
                    <Chip tone={p.is_stocked ? 'default' : 'muted'}>
                      {p.is_stocked ? 'Stocked' : 'No stocked'}
                    </Chip>
                    <Chip tone="muted">
                      <Ruler className="h-3.5 w-3.5 mr-1" />
                      {u}
                    </Chip>
                    <Chip tone="muted">
                      <Tag className="h-3.5 w-3.5 mr-1" />
                      {c}
                    </Chip>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  className={cx(
                    'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold border',
                    !canManage
                      ? 'border-slate-200 text-slate-400 bg-white cursor-not-allowed'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  )}
                  disabled={!canManage}
                  onClick={() => onEdit(p)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </button>

                <button
                  className={cx(
                    'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold',
                    !canManage
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  )}
                  disabled={!canManage}
                  onClick={() => void onDelete(p)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
