import { Link } from 'react-router-dom';
import type { WarehouseRow } from '../../../../types/inventory';
import { Pencil, Trash2 } from 'lucide-react';
import { DangerButton, GhostButton } from './buttons';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function WarehousesTable({
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
    <div className="hidden md:block">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="h-11 border-b border-slate-200 bg-blue-50/60" />

        <div className="-mt-6 p-4">
          <div className="overflow-auto rounded-xl ring-1 ring-slate-200 bg-white">
            <div className="grid grid-cols-12 gap-0 border-b bg-slate-50 text-xs font-semibold text-slate-600">
              <div className="col-span-3 px-4 py-3">Código</div>
              <div className="col-span-4 px-4 py-3">Nombre</div>
              <div className="col-span-3 px-4 py-3">Ubicación</div>
              <div className="col-span-2 px-4 py-3 text-right">Acciones</div>
            </div>

            {loading ? (
              <div className="p-4 text-sm text-slate-600">Cargando...</div>
            ) : rows.length === 0 ? (
              <div className="p-4 text-sm text-slate-600">Sin resultados.</div>
            ) : (
              rows.map((warehouse) => (
                <div
                  key={warehouse.id}
                  className={cx(
                    'grid grid-cols-12 gap-0 border-b last:border-b-0 text-sm',
                    !warehouse.is_active && 'bg-slate-50'
                  )}
                >
                  <div className="col-span-3 px-4 py-3 font-medium text-slate-900">
                    {warehouse.code}
                  </div>
                  <div className="col-span-4 px-4 py-3 text-slate-800">
                    {warehouse.name}
                  </div>
                  <div className="col-span-3 px-4 py-3 text-slate-700">
                    {warehouse.location_label ?? (
                      <span className="text-slate-400">-</span>
                    )}
                  </div>
                  <div className="col-span-2 px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/inventory/warehouses/${warehouse.id}/bins`}
                        className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Ubicaciones
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
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
