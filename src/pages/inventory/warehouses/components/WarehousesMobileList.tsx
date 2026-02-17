import { Link } from 'react-router-dom';
import type { WarehouseRow } from '../../../../types/inventory';
import { Pencil, Trash2 } from 'lucide-react';
import { DangerButton, GhostButton } from './buttons';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function WarehousesMobileList({
  rows,
  loading,
  canManage,
  onEdit,
  onDelete,
}: {
  rows: WarehouseRow[];
  loading: boolean;
  canManage: boolean;
  onEdit: (row: WarehouseRow) => void;
  onDelete: (row: WarehouseRow) => void;
}) {
  return (
    <div className="md:hidden space-y-3">
      {loading ? (
        <div className="py-10 text-center text-slate-400">Cargando...</div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-slate-400">Sin resultados.</div>
      ) : (
        rows.map((warehouse) => (
          <div
            key={warehouse.id}
            className={cx(
              'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm',
              !warehouse.is_active && 'bg-slate-50'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {warehouse.code} - {warehouse.name}
                </div>
                <div className="mt-1 text-xs text-slate-500 truncate">
                  {warehouse.location_label ?? 'Sin ubicación'}
                </div>
              </div>

              <span
                className={cx(
                  'inline-flex shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold',
                  warehouse.is_active
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-700'
                )}
              >
                {warehouse.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Link
                to={`/inventory/warehouses/${warehouse.id}/bins`}
                className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Bins
              </Link>

              <GhostButton
                disabled={!canManage}
                onClick={() => onEdit(warehouse)}
                icon={Pencil}
              >
                Editar
              </GhostButton>

              <DangerButton
                disabled={!canManage}
                onClick={() => onDelete(warehouse)}
                icon={Trash2}
              >
                Eliminar
              </DangerButton>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
