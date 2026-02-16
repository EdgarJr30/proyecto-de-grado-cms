import { Tags, Plus, Trash2 } from 'lucide-react';
import { DangerButton, PrimaryButton } from './buttons';

export function PartCategoriesToolbar({
  canManage,
  isLoading,
  selectedCount,
  onCreate,
  onBulkDelete,
}: {
  canManage: boolean;
  isLoading: boolean;
  selectedCount: number;
  onCreate: () => void;
  onBulkDelete: () => void;
}) {
  return (
    <div className="px-4 md:px-6 lg:px-8 py-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-blue-50">
              <Tags className="h-5 w-5 text-blue-700" />
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Acciones
              </div>
              <div className="text-xs text-slate-500">
                Crea, edita o elimina categorías. Usa padre/hijo para formar el
                árbol.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <PrimaryButton
              onClick={onCreate}
              disabled={!canManage}
              title={
                !canManage
                  ? 'No tienes permiso para gestionar maestros'
                  : undefined
              }
              icon={Plus}
            >
              Nueva categoría
            </PrimaryButton>

            <DangerButton
              onClick={onBulkDelete}
              disabled={!canManage || isLoading || selectedCount === 0}
              title={
                !canManage
                  ? 'No tienes permiso para gestionar maestros'
                  : selectedCount === 0
                    ? 'Selecciona al menos 1 categoría'
                    : undefined
              }
              icon={Trash2}
            >
              Eliminar selección
            </DangerButton>
          </div>
        </div>
      </div>
    </div>
  );
}
