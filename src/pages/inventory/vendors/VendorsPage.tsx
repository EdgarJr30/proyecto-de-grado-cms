import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCan } from '../../../rbac/PermissionsContext';
import {
  showConfirmAlert,
  showToastError,
  showToastSuccess,
} from '../../../notifications';

import type { UUID, VendorInsert, VendorRow } from '../../../types/inventory';
import {
  createVendor,
  deleteVendor,
  listVendors,
  updateVendor,
} from '../../../services/inventory/vendorsService';

import PartVendorsPage from '../PartVendorsPage';
import { PageShell } from './components/PageShell';
import { VendorsToolbar } from './components/VendorsToolbar';
import { VendorsTable } from './components/VendorsTable';
import { VendorsMobileList } from './components/VendorsMobileList';
import { VendorModal } from './components/VendorModal';
import { EMPTY_VENDOR_FORM, type VendorsTab } from './components/types';

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

function useQueryTab(): VendorsTab {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const tab = params.get('tab');
  return tab === 'part-vendors' ? 'part-vendors' : 'vendors';
}

export default function VendorsPage() {
  const canRead = useCan('inventory:read');
  const canManage = useCan('inventory:full_access');
  const canSee = canRead || canManage;

  const navigate = useNavigate();
  const location = useLocation();
  const tab = useQueryTab();

  const checkboxRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>(
    'active'
  );

  const [selectedRows, setSelectedRows] = useState<VendorRow[]>([]);
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);

  const [openModal, setOpenModal] = useState(false);
  const [editingId, setEditingId] = useState<UUID | null>(null);
  const [form, setForm] = useState<VendorInsert>(EMPTY_VENDOR_FORM);
  const [submitting, setSubmitting] = useState(false);

  const isEditing = Boolean(editingId);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((vendor) => {
      const matchesSearch =
        !q ||
        vendor.name.toLowerCase().includes(q) ||
        (vendor.email ?? '').toLowerCase().includes(q) ||
        (vendor.phone ?? '').toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? vendor.is_active
            : !vendor.is_active;

      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const setTab = (next: VendorsTab) => {
    const params = new URLSearchParams(location.search);
    params.set('tab', next);
    navigate(
      { pathname: location.pathname, search: params.toString() },
      { replace: true }
    );
  };

  const refresh = async () => {
    if (!canSee) return;

    setLoading(true);
    try {
      const data = await listVendors({
        limit: 500,
        offset: 0,
        orderBy: 'name',
        ascending: true,
      });
      setRows(data);
      setSelectedRows([]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showToastError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab !== 'vendors') return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, canManage, tab]);

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
      showToastError('No tienes permiso para gestionar maestros.');
      return;
    }
    setEditingId(null);
    setForm(EMPTY_VENDOR_FORM);
    setOpenModal(true);
  }

  function startEdit(vendor: VendorRow) {
    if (!canManage) {
      showToastError('No tienes permiso para gestionar maestros.');
      return;
    }
    setEditingId(vendor.id);
    setForm({
      name: vendor.name,
      email: vendor.email,
      phone: vendor.phone,
      is_active: vendor.is_active,
    });
    setOpenModal(true);
  }

  function closeModal() {
    if (submitting) return;
    setOpenModal(false);
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) {
      showToastError('No tienes permiso para gestionar maestros.');
      return;
    }

    const name = form.name.trim();
    if (!name) {
      showToastError('Nombre es requerido.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await updateVendor(editingId, {
          name,
          email: form.email?.trim() ? form.email.trim() : null,
          phone: form.phone?.trim() ? form.phone.trim() : null,
          is_active: !!form.is_active,
        });
        showToastSuccess('Proveedor actualizado.');
      } else {
        await createVendor({
          name,
          email: form.email?.trim() ? form.email.trim() : null,
          phone: form.phone?.trim() ? form.phone.trim() : null,
          is_active: form.is_active ?? true,
        });
        showToastSuccess('Proveedor creado.');
      }

      setOpenModal(false);
      setEditingId(null);
      setForm(EMPTY_VENDOR_FORM);
      await refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showToastError(`No se pudo guardar: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (row: VendorRow) => {
    if (!canManage) {
      showToastError('No tienes permiso para gestionar maestros.');
      return;
    }

    const ok = await showConfirmAlert({
      title: 'Eliminar proveedor',
      text: `¿Eliminar el proveedor "${row.name}"? Esta acción no se puede deshacer.`,
      confirmButtonText: 'Sí, eliminar',
    });
    if (!ok) return;

    try {
      await deleteVendor(row.id);
      showToastSuccess('Proveedor eliminado.');
      await refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showToastError(`No se pudo eliminar: ${message}`);
    }
  };

  const onBulkDelete = async () => {
    if (!canManage) {
      showToastError('No tienes permiso para gestionar maestros.');
      return;
    }
    if (selectedRows.length === 0) return;

    const ok = await showConfirmAlert({
      title: 'Eliminar selección',
      text: `¿Eliminar ${selectedRows.length} proveedor(es) seleccionado(s)?`,
      confirmButtonText: 'Sí, eliminar',
    });
    if (!ok) return;

    try {
      for (const row of selectedRows) {
        await deleteVendor(row.id);
      }
      showToastSuccess(`Se eliminaron ${selectedRows.length} proveedor(es).`);
      await refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showToastError(`No se pudo completar la eliminación: ${message}`);
    }
  };

  if (!canSee) {
    return (
      <PageShell>
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1 p-6">
          <EmptyState
            title="Acceso restringido"
            description="No tienes permisos para acceder al módulo de proveedores."
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
              <VendorsToolbar
                tab={tab}
                isLoading={loading}
                onChangeTab={setTab}
                search={search}
                statusFilter={statusFilter}
                totalCount={filteredRows.length}
                selectedCount={selectedRows.length}
                canManage={canManage}
                onSearchChange={setSearch}
                onStatusFilterChange={setStatusFilter}
                onCreate={openCreate}
                onBulkDelete={onBulkDelete}
                onRefresh={() => void refresh()}
              />

              {tab === 'vendors' ? (
                <>
                  <VendorsMobileList
                    rows={filteredRows}
                    loading={loading}
                    canManage={canManage}
                    selectedRows={selectedRows}
                    setSelectedRows={setSelectedRows}
                    onEdit={startEdit}
                    onDelete={(row) => void onDelete(row)}
                  />

                  <VendorsTable
                    rows={filteredRows}
                    loading={loading}
                    canManage={canManage}
                    selectedRows={selectedRows}
                    setSelectedRows={setSelectedRows}
                    checked={checked}
                    onToggleAll={toggleAll}
                    checkboxRef={checkboxRef}
                    onEdit={startEdit}
                    onDelete={(row) => void onDelete(row)}
                  />

                  <div className="px-5 py-4 border-t border-slate-100 bg-white">
                    <div className="text-xs text-slate-500">
                      Tip: registra email y teléfono para compras y usa estado
                      activo para ocultar proveedores obsoletos.
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-4 md:p-5">
                  <PartVendorsPage embedded />
                </div>
              )}
            </div>
          </div>
        </section>

        <VendorModal
          open={openModal}
          isEditing={isEditing}
          form={form}
          submitting={submitting}
          canManage={canManage}
          onClose={closeModal}
          onChangeForm={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          onSubmit={onSubmit}
        />
      </main>
    </PageShell>
  );
}
