import type {
  InventoryDocStatus,
  InventoryDocType,
} from '../../../../types/inventory';

import { FileText, Filter, Plus, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { GhostButton, PrimaryButton } from './buttons';
import {
  DOC_STATUSES,
  DOC_TYPES,
  docTypeBadgeClass,
  docTypeIcon,
  labelType,
} from './docMeta';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function InventoryDocsToolbar({
  canWrite,
  isLoading,
  docType,
  status,
  q,
  onDocTypeChange,
  onStatusChange,
  onQChange,
  onCreate,
  onRefresh,
  onReset,
}: {
  canWrite: boolean;
  isLoading: boolean;
  docType: InventoryDocType | '';
  status: InventoryDocStatus | '';
  q: string;
  onDocTypeChange: (value: InventoryDocType | '') => void;
  onStatusChange: (value: InventoryDocStatus | '') => void;
  onQChange: (value: string) => void;
  onCreate: (type: InventoryDocType) => void;
  onRefresh: () => void;
  onReset: () => void;
}) {
  return (
    <div className="px-4 md:px-6 lg:px-8 py-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-blue-50">
                <Filter className="h-5 w-5 text-blue-700" />
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Filtros y acciones
                </div>
                <div className="text-xs text-slate-500">
                  Filtra documentos y crea nuevos movimientos por tipo.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <PrimaryButton
                onClick={onRefresh}
                disabled={isLoading}
                icon={RefreshCw}
                title={isLoading ? 'Cargando...' : 'Recargar resultados'}
              >
                Recargar
              </PrimaryButton>

              <GhostButton
                onClick={onReset}
                disabled={isLoading}
                icon={RotateCcw}
                title={isLoading ? 'Cargando...' : 'Limpiar filtros'}
              >
                Limpiar
              </GhostButton>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-3">
              <label className="text-[11px] font-semibold text-slate-700">
                Tipo
              </label>
              <select
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                value={docType}
                onChange={(e) =>
                  onDocTypeChange(e.target.value as InventoryDocType | '')
                }
              >
                <option value="">Todos</option>
                {DOC_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {labelType(type)}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="text-[11px] font-semibold text-slate-700">
                Estado
              </label>
              <select
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                value={status}
                onChange={(e) =>
                  onStatusChange(e.target.value as InventoryDocStatus | '')
                }
              >
                <option value="">Todos</option>
                {DOC_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-6">
              <label className="text-[11px] font-semibold text-slate-700">
                Búsqueda
              </label>
              <div className="relative mt-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="doc_no o reference..."
                  value={q}
                  onChange={(e) => onQChange(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 mr-1">
              <FileText className="h-4 w-4 text-blue-700" />
              Crear documento
            </span>

            {DOC_TYPES.map((type) => {
              const Icon = docTypeIcon(type);
              const pastel = docTypeBadgeClass(type);

              return (
                <GhostButton
                  key={type}
                  disabled={!canWrite}
                  onClick={() => onCreate(type)}
                  title={
                    canWrite ? `Crear ${type}` : 'No tienes inventory:create'
                  }
                >
                  <span
                    className={cx(
                      'inline-flex items-center justify-center h-6 w-6 rounded-md border mr-2',
                      pastel
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <Plus className="h-4 w-4 mr-1 text-slate-500" />
                  {type}
                </GhostButton>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
