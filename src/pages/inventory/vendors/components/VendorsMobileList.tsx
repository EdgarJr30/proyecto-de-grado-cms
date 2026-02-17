import type { VendorRow } from '../../../../types/inventory';
import { Pencil, Trash2 } from 'lucide-react';
import { DangerButton, GhostButton } from './buttons';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function VendorsMobileList({
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
    <div className="md:hidden space-y-3">
      {loading ? (
        <div className="py-10 text-center text-slate-400">Cargando...</div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-slate-400">Sin proveedores.</div>
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            className={cx(
              'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm',
              !row.is_active && 'bg-slate-50'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {row.name}
                </div>
                <div className="mt-1 text-xs text-slate-500 truncate">
                  {row.email ?? 'Sin email'}
                </div>
                <div className="mt-1 text-xs text-slate-500 truncate">
                  {row.phone ?? 'Sin teléfono'}
                </div>
              </div>

              <span
                className={cx(
                  'inline-flex shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold',
                  row.is_active
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-700'
                )}
              >
                {row.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <div className="mt-3 flex justify-end gap-4">
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
          </div>
        ))
      )}
    </div>
  );
}
