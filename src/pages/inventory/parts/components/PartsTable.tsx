import type { Dispatch, RefObject, SetStateAction } from 'react';
import type {
  PartRow,
  PartCategoryRow,
  UomRow,
  UUID,
} from '../../../../types/inventory';
import {
  CheckCircle2,
  Layers,
  Pencil,
  Ruler,
  Tag,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Chip, CriticalityBadge } from './PartsBadges';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function PartsTable(props: {
  isLoading: boolean;
  parts: PartRow[];
  checkboxRef: RefObject<HTMLInputElement | null>;
  checked: boolean;
  indeterminate: boolean;
  toggleAll: () => void;
  selectedRows: PartRow[];
  setSelectedRows: Dispatch<SetStateAction<PartRow[]>>;
  canManage: boolean;
  uomById: Map<string, UomRow>;
  catById: Map<string, PartCategoryRow>;
  onEdit: (row: PartRow) => void;
  onDelete: (row: PartRow) => void | Promise<void>;
}) {
  const {
    isLoading,
    parts,
    checkboxRef,
    checked,
    toggleAll,
    selectedRows,
    setSelectedRows,
    canManage,
    uomById,
    catById,
    onEdit,
    onDelete,
  } = props;

  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-white sticky top-0 z-10">
          <tr className="border-b border-slate-200">
            <th className="px-5 py-3 w-12">
              <input
                ref={checkboxRef}
                type="checkbox"
                disabled={!canManage}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                checked={checked}
                onChange={toggleAll}
              />
            </th>

            <th className="text-left font-semibold text-slate-600 px-5 py-3">
              Código
            </th>
            <th className="text-left font-semibold text-slate-600 px-5 py-3">
              Nombre
            </th>
            <th className="text-left font-semibold text-slate-600 px-5 py-3">
              UoM
            </th>
            <th className="text-left font-semibold text-slate-600 px-5 py-3">
              Categoría
            </th>
            <th className="text-left font-semibold text-slate-600 px-5 py-3">
              Estado
            </th>
            <th className="text-left font-semibold text-slate-600 px-5 py-3">
              Stock
            </th>
            <th className="text-left font-semibold text-slate-600 px-5 py-3">
              Criticidad
            </th>
            <th className="text-right font-semibold text-slate-600 px-5 py-3">
              Acciones
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {isLoading ? (
            <tr>
              <td colSpan={9} className="py-10 text-center text-slate-400">
                Cargando…
              </td>
            </tr>
          ) : parts.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-10 text-center text-slate-400">
                Sin resultados.
              </td>
            </tr>
          ) : (
            parts.map((p) => {
              const selected = selectedRows.includes(p);
              const u = uomById.get(p.uom_id)?.code ?? '—';
              const c = p.category_id
                ? (catById.get(p.category_id)?.name ?? '—')
                : '—';

              return (
                <tr
                  key={p.id}
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
                      onChange={(e) => {
                        if (e.target.checked)
                          setSelectedRows((prev) => [...prev, p]);
                        else
                          setSelectedRows((prev) =>
                            prev.filter((x) => x !== p)
                          );
                      }}
                    />
                  </td>

                  <td className="px-5 py-3">
                    <div className="font-mono font-semibold text-slate-900">
                      {p.code}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {(p.id as UUID).slice(0, 8)}
                    </div>
                  </td>

                  <td className="px-5 py-3">
                    <div className="font-semibold text-slate-900">{p.name}</div>
                    {p.description ? (
                      <div className="text-[11px] text-slate-500 line-clamp-1">
                        {p.description}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400">—</div>
                    )}
                  </td>

                  <td className="px-5 py-3 text-slate-700">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                        <Ruler className="h-4 w-4 text-blue-700" />
                      </span>
                      <span className="font-medium">{u}</span>
                    </span>
                  </td>

                  <td className="px-5 py-3 text-slate-700">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                        <Tag className="h-4 w-4 text-blue-700" />
                      </span>
                      <span className="truncate max-w-[220px]">{c}</span>
                    </span>
                  </td>

                  <td className="px-5 py-3">
                    <Chip tone={p.is_active ? 'success' : 'danger'}>
                      {p.is_active ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Activo
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Inactivo
                        </>
                      )}
                    </Chip>
                  </td>

                  <td className="px-5 py-3">
                    <Chip tone={p.is_stocked ? 'default' : 'muted'}>
                      <Layers className="h-3.5 w-3.5 mr-1" />
                      {p.is_stocked ? 'Stocked' : 'No stocked'}
                    </Chip>
                  </td>

                  <td className="px-5 py-3">
                    <CriticalityBadge value={p.criticality} />
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
                        onClick={() => onEdit(p)}
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
                        onClick={() => void onDelete(p)}
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
