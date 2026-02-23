import type {
  InventoryDocStatus,
  InventoryDocType,
  UUID,
} from '../../../../types/inventory';

import { Filter, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { GhostButton, PrimaryButton } from './buttons';
import {
  DOC_STATUSES,
  DOC_TYPES,
  labelStatus,
  labelType,
} from './docMeta';

export function InventoryDocsToolbar({
  isLoading,
  docType,
  status,
  warehouseId,
  ticketId,
  createdFrom,
  createdTo,
  q,
  warehouseOptions,
  onDocTypeChange,
  onStatusChange,
  onWarehouseIdChange,
  onTicketIdChange,
  onCreatedFromChange,
  onCreatedToChange,
  onQChange,
  onRefresh,
  onReset,
}: {
  isLoading: boolean;
  docType: InventoryDocType | '';
  status: InventoryDocStatus | '';
  warehouseId: UUID | '';
  ticketId: string;
  createdFrom: string;
  createdTo: string;
  q: string;
  warehouseOptions: Array<{ id: UUID; label: string }>;
  onDocTypeChange: (value: InventoryDocType | '') => void;
  onStatusChange: (value: InventoryDocStatus | '') => void;
  onWarehouseIdChange: (value: UUID | '') => void;
  onTicketIdChange: (value: string) => void;
  onCreatedFromChange: (value: string) => void;
  onCreatedToChange: (value: string) => void;
  onQChange: (value: string) => void;
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
                  Filtros de documentos
                </div>
                <div className="text-xs text-slate-500">
                  Consulta documentos por tipo, estado, almacén, ticket y fecha.
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
            <div className="md:col-span-2">
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

            <div className="md:col-span-2">
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
                    {labelStatus(value)}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="text-[11px] font-semibold text-slate-700">
                Almacén
              </label>
              <select
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                value={warehouseId}
                onChange={(e) => onWarehouseIdChange((e.target.value as UUID) || '')}
              >
                <option value="">Todos</option>
                {warehouseOptions.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-700">
                ID de ticket
              </label>
              <input
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="Ej: 10234"
                inputMode="numeric"
                value={ticketId}
                onChange={(e) => onTicketIdChange(e.target.value)}
              />
            </div>

            <div className="md:col-span-3">
              <label className="text-[11px] font-semibold text-slate-700">
                Búsqueda
              </label>
              <div className="relative mt-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="doc_no o referencia..."
                  value={q}
                  onChange={(e) => onQChange(e.target.value)}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-700">
                Desde
              </label>
              <input
                type="date"
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                value={createdFrom}
                onChange={(e) => onCreatedFromChange(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-700">
                Hasta
              </label>
              <input
                type="date"
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                value={createdTo}
                onChange={(e) => onCreatedToChange(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
