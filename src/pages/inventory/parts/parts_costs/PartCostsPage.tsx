import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '../../../../components/layout/Sidebar';
import { usePermissions } from '../../../../rbac/PermissionsContext';
import { showToastError } from '../../../../notifications';

import type { UUID, VPartCostRow } from '../../../../types/inventory';
import { listPartCosts } from '../../../../services/inventory/partCostsService';

import { PageShell } from './components/PageShell';
import { PartCostsHeader } from './components/PartCostsHeader';
import { PartCostsToolbar } from './components/PartCostsToolbar';
import { PartCostsMobileList } from './components/PartCostsMobileList';
import { PartCostsTable } from './components/PartCostsTable';

type SortKey = 'updated_at' | 'avg_unit_cost' | 'part_code' | 'warehouse_code';
type SortDir = 'asc' | 'desc';

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
      <div className="font-semibold text-slate-900">{title}</div>
      <div className="mt-1">{description}</div>
    </div>
  );
}

export default function PartCostsPage() {
  const { has } = usePermissions();
  const canRead = has('inventory:read');
  const canManage = has('inventory:full_access'); // 👈 igual que en categories

  const checkboxRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<VPartCostRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedRows, setSelectedRows] = useState<VPartCostRow[]>([]);
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);

  // filtros
  const [warehouseId, setWarehouseId] = useState<UUID | ''>('');
  const [partId, setPartId] = useState<UUID | ''>('');
  const [q, setQ] = useState('');

  // sorting (client-side)
  const [sortKey, setSortKey] = useState<SortKey>('updated_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  async function reload() {
    if (!canRead) return;
    setIsLoading(true);
    try {
      const res = await listPartCosts({
        limit: 1000,
        offset: 0,
        warehouseId: warehouseId || undefined,
        partId: partId || undefined,
        q,
      });
      setRows(res.rows);
      setSelectedRows([]);
    } catch (e) {
      showToastError(e instanceof Error ? e.message : 'Error cargando costos');
    } finally {
      setIsLoading(false);
    }
  }

  // sync selection state + checkbox indeterminate
  useEffect(() => {
    const total = rows.length;
    const selected = selectedRows.length;

    const nextChecked = total > 0 && selected === total;
    const nextInd = selected > 0 && selected < total;

    setChecked(nextChecked);
    setIndeterminate(nextInd);

    if (checkboxRef.current) checkboxRef.current.indeterminate = nextInd;
  }, [rows.length, selectedRows.length]);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  function toggleAll() {
    const shouldSelectAll = !(checked || indeterminate);
    setSelectedRows(shouldSelectAll ? rows : []);
    setChecked(shouldSelectAll);
    setIndeterminate(false);
    if (checkboxRef.current) checkboxRef.current.indeterminate = false;
  }

  const viewRows = useMemo(() => {
    const copy = [...rows];

    copy.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;

      if (sortKey === 'updated_at') {
        return (
          dir *
          (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
        );
      }
      if (sortKey === 'avg_unit_cost') {
        return dir * (a.avg_unit_cost - b.avg_unit_cost);
      }
      if (sortKey === 'part_code') {
        return dir * a.part_code.localeCompare(b.part_code);
      }
      // warehouse_code
      return dir * a.warehouse_code.localeCompare(b.warehouse_code);
    });

    return copy;
  }, [rows, sortKey, sortDir]);

  if (!canRead) {
    return (
      <PageShell>
        <Sidebar />
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1 p-6">
          <EmptyState
            title="Acceso restringido"
            description="No tienes permisos para acceder al módulo de inventario."
          />
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Sidebar />

      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        {/* 👇 igual que categories: count + canManage */}
        <PartCostsHeader count={rows.length} canManage={canManage} />

        <PartCostsToolbar
          isLoading={isLoading}
          // filtros
          q={q}
          onChangeQ={setQ}
          warehouseId={warehouseId}
          onChangeWarehouseId={setWarehouseId}
          partId={partId}
          onChangePartId={setPartId}
          // sorting
          sortKey={sortKey}
          sortDir={sortDir}
          onChangeSortKey={setSortKey}
          onChangeSortDir={setSortDir}
          onReload={reload}
        />

        <section className="flex-1 min-h-0 overflow-auto px-4 md:px-6 lg:px-8 pb-6">
          <PartCostsMobileList
            rows={viewRows}
            isLoading={isLoading}
            selectedRows={selectedRows}
            setSelectedRows={setSelectedRows}
          />

          <PartCostsTable
            rows={viewRows}
            isLoading={isLoading}
            selectedRows={selectedRows}
            setSelectedRows={setSelectedRows}
            checked={checked}
            indeterminate={indeterminate}
            onToggleAll={toggleAll}
            checkboxRef={checkboxRef}
          />
        </section>
      </main>
    </PageShell>
  );
}
