import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../../components/layout/Sidebar';
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
  UUID,
} from '../../../types/inventory';
import {
  createWarehouse,
  deleteWarehouse,
  listWarehouses,
  updateWarehouse,
} from '../../../services/inventory';

import { PageShell } from './components/PageShell';
import { WarehousesHeader } from './components/WarehousesHeader';
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

  const [rows, setRows] = useState<WarehouseRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<WarehouseRow | null>(null);
  const [form, setForm] = useState<FormState>(() => toFormDefaults());
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const data = await listWarehouses({
        limit: 500,
        is_active: showInactive ? undefined : true,
        orderBy: 'code',
        ascending: true,
      });
      setRows(data);
    } catch (error: unknown) {
      showToastError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) => {
      return (
        row.code.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        (row.location_label ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, query]);

  function openCreate() {
    if (!canManage) return;
    setEditing(null);
    setForm(toFormDefaults());
    setIsModalOpen(true);
  }

  function openEdit(row: WarehouseRow) {
    if (!canManage) return;
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
      showToastError('Code y Name son requeridos.');
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
        showToastSuccess('Warehouse creado.');
      } else {
        const patch: WarehouseUpdate = {
          code,
          name,
          location_label: form.location_label.trim() || null,
          is_active: form.is_active,
        };
        await updateWarehouse(editing.id, patch);
        showToastSuccess('Warehouse actualizado.');
      }

      setIsModalOpen(false);
      await refresh();
    } catch (error: unknown) {
      showToastError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: UUID) {
    if (!canManage) return;

    const ok = await showConfirmAlert({
      title: 'Eliminar warehouse',
      text: 'Se eliminará este warehouse. La acción puede fallar si tiene bins o stock asociado.',
      confirmButtonText: 'Sí, eliminar',
    });
    if (!ok) return;

    try {
      await deleteWarehouse(id);
      showToastSuccess('Warehouse eliminado.');
      await refresh();
    } catch (error: unknown) {
      showToastError(getErrorMessage(error));
    }
  }

  if (!canRead) {
    return (
      <PageShell>
        <Sidebar />
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1 p-6">
          <EmptyState
            title="Acceso restringido"
            description="No tienes permisos para acceder al módulo de warehouses."
          />
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Sidebar />

      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        <WarehousesHeader count={rows.length} canManage={canManage} />

        <WarehousesToolbar
          canManage={canManage}
          query={query}
          showInactive={showInactive}
          onQueryChange={setQuery}
          onShowInactiveChange={setShowInactive}
          onRefresh={() => void refresh()}
          onCreate={openCreate}
        />

        <section className="flex-1 min-h-0 overflow-auto px-4 md:px-6 lg:px-8 pb-6">
          <WarehousesMobileList
            rows={filteredRows}
            loading={loading}
            canManage={canManage}
            onEdit={openEdit}
            onDelete={(row) => void onDelete(row.id)}
          />

          <WarehousesTable
            rows={filteredRows}
            loading={loading}
            canManage={canManage}
            onEdit={openEdit}
            onDelete={(row) => void onDelete(row.id)}
          />
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
