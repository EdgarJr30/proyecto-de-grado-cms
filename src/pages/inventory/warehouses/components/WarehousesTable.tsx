import { type RefObject } from 'react';
import { Link } from 'react-router-dom';
import type { WarehouseRow } from '../../../../types/inventory';
import { Pencil, Trash2 } from 'lucide-react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function WarehousesTable({
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
  rows: WarehouseRow[];
  loading: boolean;
  canManage: boolean;
  selectedRows: WarehouseRow[];
  setSelectedRows: React.Dispatch<React.SetStateAction<WarehouseRow[]>>;
  checked: boolean;
  onToggleAll: () => void;
  checkboxRef: RefObject<HTMLInputElement | null>;
  onEdit: (row: WarehouseRow) => void;
  onDelete: (row: WarehouseRow) => void;
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
            <th className="text-left font-semibold text-slate-600 px-5 py-3">Código</th>
            <th className="text-left font-semibold text-slate-600 px-5 py-3">Nombre</th>
            <th className="text-left font-semibold text-slate-600 px-5 py-3">Ubicación</th>
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
                Sin resultados.
              </td>
            </tr>
          ) : (
            rows.map((warehouse) => {
              const selected = selectedRows.includes(warehouse);

              return (
                <tr
                  key={warehouse.id}
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
                          setSelectedRows((prev) => [...prev, warehouse]);
                          return;
                        }
                        setSelectedRows((prev) =>
                          prev.filter((item) => item !== warehouse)
                        );
                      }}
                      aria-label={`Seleccionar ${warehouse.code}`}
                    />
                  </td>
                  <td className="px-5 py-3 font-mono font-semibold text-slate-900">{warehouse.code}</td>
                  <td className="px-5 py-3 text-slate-900">{warehouse.name}</td>
                  <td className="px-5 py-3 text-slate-700">
                    {warehouse.location_label ?? (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {warehouse.is_active ? (
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
                      <Link
                        to={`/inventory/warehouses/${warehouse.id}/bins`}
                        className="inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      >
                        Ubicaciones
                      </Link>

                      <button
                        type="button"
                        className={cx(
                          'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold border',
                          !canManage
                            ? 'border-slate-200 text-slate-400 bg-white cursor-not-allowed'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        )}
                        disabled={!canManage}
                        onClick={() => onEdit(warehouse)}
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
                        onClick={() => onDelete(warehouse)}
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
