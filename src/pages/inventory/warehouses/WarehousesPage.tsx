import { useEffect, useMemo, useRef, useState } from 'react';
import { usePermissions } from '../../../rbac/PermissionsContext';
import {
  showConfirmAlert,
  showToastError,
  showToastSuccess,
} from '../../../notifications';

import type {
  WarehouseInsert,
  WarehouseRow,
  WarehouseUpdate,
} from '../../../types/inventory';
import {
  createWarehouse,
  deleteWarehouse,
  listWarehouses,
  updateWarehouse,
} from '../../../services/inventory';

import { PageShell } from './components/PageShell';
import { WarehousesToolbar } from './components/WarehousesToolbar';
import { WarehousesMobileList } from './components/WarehousesMobileList';
import { WarehousesTable } from './components/WarehousesTable';
import { WarehouseModal } from './components/WarehouseModal';
import { toFormDefaults, type FormState } from './components/types';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado';
}

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

export default function WarehousesPage() {
  const { has } = usePermissions();
  const canRead = has('inventory:read');
  const canManage = has('inventory:full_access');

  const checkboxRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<WarehouseRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>(
    'active'
  );

  const [selectedRows, setSelectedRows] = useState<WarehouseRow[]>([]);
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<WarehouseRow | null>(null);
  const [form, setForm] = useState<FormState>(() => toFormDefaults());
  const [saving, setSaving] = useState(false);

  async function refresh() {
    if (!canRead) return;
    setLoading(true);
    try {
      const data = await listWarehouses({
        limit: 500,
        orderBy: 'code',
        ascending: true,
      });
      setRows(data);
      setSelectedRows([]);
    } catch (error: unknown) {
      showToastError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesQuery =
        !q ||
        row.code.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        (row.location_label ?? '').toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? row.is_active
            : !row.is_active;

      return matchesQuery && matchesStatus;
    });
  }, [rows, query, statusFilter]);

  useEffect(() => {
    setSelectedRows((prev) => prev.filter((row) => filteredRows.includes(row)));
  }, [filteredRows]);

  useEffect(() => {
    const total = filteredRows.length;
    const selected = selectedRows.length;

    const nextChecked = total > 0 && selected === total;
    const nextInd = selected > 0 && selected < total;

    setChecked(nextChecked);
    setIndeterminate(nextInd);

    if (checkboxRef.current) checkboxRef.current.indeterminate = nextInd;
  }, [filteredRows.length, selectedRows.length]);

  function toggleAll() {
    const shouldSelectAll = !(checked || indeterminate);
    setSelectedRows(shouldSelectAll ? filteredRows : []);
    setChecked(shouldSelectAll);
    setIndeterminate(false);
    if (checkboxRef.current) checkboxRef.current.indeterminate = false;
  }

  function openCreate() {
    if (!canManage) {
      showToastError('No tienes permisos para gestionar almacenes.');
      return;
    }
    setEditing(null);
    setForm(toFormDefaults());
    setIsModalOpen(true);
  }

  function openEdit(row: WarehouseRow) {
    if (!canManage) {
      showToastError('No tienes permisos para gestionar almacenes.');
      return;
    }
    setEditing(row);
    setForm(toFormDefaults(row));
    setIsModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setIsModalOpen(false);
  }

  async function onSave() {
    if (!canManage) return;

    const code = form.code.trim();
    const name = form.name.trim();

    if (!code || !name) {
      showToastError('Código y nombre son requeridos.');
      return;
    }

    setSaving(true);
    try {
      if (!editing) {
        const payload: WarehouseInsert = {
          code,
          name,
          location_label: form.location_label.trim() || null,
          is_active: form.is_active,
        };
        await createWarehouse(payload);
        showToastSuccess('Almacén creado.');
      } else {
        const patch: WarehouseUpdate = {
          code,
          name,
          location_label: form.location_label.trim() || null,
          is_active: form.is_active,
        };
        await updateWarehouse(editing.id, patch);
        showToastSuccess('Almacén actualizado.');
      }

      setIsModalOpen(false);
      await refresh();
    } catch (error: unknown) {
      showToastError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(row: WarehouseRow) {
    if (!canManage) {
      showToastError('No tienes permisos para gestionar almacenes.');
      return;
    }

    const ok = await showConfirmAlert({
      title: 'Eliminar almacén',
      text: `¿Eliminar el almacén "${row.code}"? La acción puede fallar si tiene ubicaciones o inventario asociado.`,
      confirmButtonText: 'Sí, eliminar',
    });
    if (!ok) return;

    try {
      await deleteWarehouse(row.id);
      showToastSuccess('Almacén eliminado.');
      await refresh();
    } catch (error: unknown) {
      showToastError(getErrorMessage(error));
    }
  }

  async function onBulkDelete() {
    if (!canManage) {
      showToastError('No tienes permisos para gestionar almacenes.');
      return;
    }
    if (selectedRows.length === 0) return;

    const ok = await showConfirmAlert({
      title: 'Eliminar selección',
      text: `¿Eliminar ${selectedRows.length} almacén(es) seleccionado(s)?`,
      confirmButtonText: 'Sí, eliminar',
    });
    if (!ok) return;

    try {
      for (const row of selectedRows) {
        await deleteWarehouse(row.id);
      }
      showToastSuccess(`Se eliminaron ${selectedRows.length} almacén(es).`);
      await refresh();
    } catch (error: unknown) {
      showToastError(getErrorMessage(error));
    }
  }

  if (!canRead) {
    return (
      <PageShell>
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1 p-6">
          <EmptyState
            title="Acceso restringido"
            description="No tienes permisos para acceder al módulo de almacenes."
          />
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        <section className="flex-1 min-h-0 overflow-auto">
          <div className="px-4 md:px-6 lg:px-8 py-6">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <WarehousesToolbar
                canManage={canManage}
                query={query}
                statusFilter={statusFilter}
                totalCount={filteredRows.length}
                selectedCount={selectedRows.length}
                loading={loading}
                onQueryChange={setQuery}
                onStatusFilterChange={setStatusFilter}
                onRefresh={() => void refresh()}
                onCreate={openCreate}
                onBulkDelete={() => void onBulkDelete()}
              />

              <WarehousesMobileList
                rows={filteredRows}
                loading={loading}
                canManage={canManage}
                selectedRows={selectedRows}
                setSelectedRows={setSelectedRows}
                onEdit={openEdit}
                onDelete={(row) => void onDelete(row)}
              />

              <WarehousesTable
                rows={filteredRows}
                loading={loading}
                canManage={canManage}
                selectedRows={selectedRows}
                setSelectedRows={setSelectedRows}
                checked={checked}
                onToggleAll={toggleAll}
                checkboxRef={checkboxRef}
                onEdit={openEdit}
                onDelete={(row) => void onDelete(row)}
              />

              <div className="px-5 py-4 border-t border-slate-100 bg-white">
                <div className="text-xs text-slate-500">
                  Tip: usa el botón "Ubicaciones" para administrar pasillos y
                  estantes de cada almacén.
                </div>
              </div>
            </div>
          </div>
        </section>

        <WarehouseModal
          open={isModalOpen}
          editing={Boolean(editing)}
          form={form}
          saving={saving}
          canManage={canManage}
          onClose={closeModal}
          onChangeForm={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          onSave={() => void onSave()}
        />
      </main>
    </PageShell>
  );
}
