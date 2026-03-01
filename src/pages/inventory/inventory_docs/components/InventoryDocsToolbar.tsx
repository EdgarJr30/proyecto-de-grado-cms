import { Link } from 'react-router-dom';
import type {
  InventoryDocStatus,
  InventoryDocType,
  UUID,
} from '../../../../types/inventory';

import { Filter, Plus, RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react';
import { InventoryFiltersDropdown } from '../../components/InventoryFiltersDropdown';
import { GhostButton, PrimaryButton } from './buttons';
import {
  DOC_STATUSES,
  DOC_TYPES,
  labelStatus,
  labelType,
} from './docMeta';

export function InventoryDocsToolbar({
  isLoading,
  canWrite,
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
  canWrite: boolean;
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
      <InventoryFiltersDropdown
        icon={Filter}
        title="Filtros de documentos"
        description="Consulta documentos por tipo, estado, almacén, ticket y fecha."
        searchValue={q}
        searchPlaceholder="doc_no o referencia..."
        onSearchChange={onQChange}
        panelActions={
          <>
            {canWrite ? (
              <Link
                to="/inventory/docs/crear"
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold shadow-sm transition bg-blue-600 text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                title="Crear nuevo documento"
              >
                <Plus className="h-4 w-4" />
                Crear documento
              </Link>
            ) : (
              <GhostButton
                disabled
                icon={ShieldAlert}
                title="Necesitas inventory:create o inventory:full_access"
              >
                Crear documento
              </GhostButton>
            )}

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
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-2">
            <label className="text-[11px] font-semibold text-slate-700">
              Tipo
            </label>
            <select
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={docType}
              onChange={(e) => onDocTypeChange(e.target.value as InventoryDocType | '')}
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
              onChange={(e) => onStatusChange(e.target.value as InventoryDocStatus | '')}
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
      </InventoryFiltersDropdown>
    </div>
  );
}
