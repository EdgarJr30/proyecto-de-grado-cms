import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../../../components/layout/Sidebar';
import { useCan } from '../../../rbac/PermissionsContext';
import { showToastError, showToastSuccess } from '../../../notifications';

import type { UUID, VendorInsert, VendorRow } from '../../../types/inventory';
import {
  createVendor,
  deleteVendor,
  listVendors,
  updateVendor,
} from '../../../services/inventory/vendorsService';

import PartVendorsPage from '../PartVendorsPage';
import { PageShell } from './components/PageShell';
import { VendorsHeader } from './components/VendorsHeader';
import { VendorsToolbar } from './components/VendorsToolbar';
import { VendorsForm } from './components/VendorsForm';
import { VendorsTable } from './components/VendorsTable';
import { VendorsMobileList } from './components/VendorsMobileList';
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
  const isReadOnly = !canManage;

  const navigate = useNavigate();
  const location = useLocation();
  const tab = useQueryTab();

  const [rows, setRows] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyActive, setOnlyActive] = useState(true);

  const [editingId, setEditingId] = useState<UUID | null>(null);
  const [form, setForm] = useState<VendorInsert>(EMPTY_VENDOR_FORM);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((vendor) => vendor.name.toLowerCase().includes(q));
  }, [rows, search]);

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
        is_active: onlyActive ? true : undefined,
      });
      setRows(data);
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
  }, [onlyActive, canRead, canManage, tab]);

  const startEdit = (vendor: VendorRow) => {
    setEditingId(vendor.id);
    setForm({
      name: vendor.name,
      email: vendor.email,
      phone: vendor.phone,
      is_active: vendor.is_active,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_VENDOR_FORM);
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isReadOnly) return;

    const name = form.name.trim();
    if (!name) {
      showToastError('Nombre es requerido.');
      return;
    }

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

      resetForm();
      await refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showToastError(`No se pudo guardar: ${message}`);
    }
  };

  const onDelete = async (id: UUID) => {
    if (isReadOnly) return;

    try {
      await deleteVendor(id);
      showToastSuccess('Proveedor eliminado.');
      await refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showToastError(`No se pudo eliminar: ${message}`);
    }
  };

  if (!canSee) {
    return (
      <PageShell>
        <Sidebar />
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
      <Sidebar />

      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        <VendorsHeader count={rows.length} isReadOnly={isReadOnly} />

        <VendorsToolbar
          tab={tab}
          isLoading={loading}
          onChangeTab={setTab}
          search={search}
          onlyActive={onlyActive}
          onSearchChange={setSearch}
          onOnlyActiveChange={setOnlyActive}
          onRefresh={() => void refresh()}
        />

        <section className="flex-1 min-h-0 overflow-auto px-4 md:px-6 lg:px-8 pb-6">
          {tab === 'vendors' ? (
            <div className="space-y-4">
              <VendorsForm
                form={form}
                isReadOnly={isReadOnly}
                isEditing={Boolean(editingId)}
                onChangeForm={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
                onCancel={resetForm}
                onSubmit={onSubmit}
              />

              <VendorsMobileList
                rows={filteredRows}
                loading={loading}
                isReadOnly={isReadOnly}
                onEdit={startEdit}
                onDelete={(row) => void onDelete(row.id)}
              />

              <VendorsTable
                rows={filteredRows}
                loading={loading}
                isReadOnly={isReadOnly}
                onEdit={startEdit}
                onDelete={(row) => void onDelete(row.id)}
              />
            </div>
          ) : (
            <PartVendorsPage embedded />
          )}
        </section>
      </main>
    </PageShell>
  );
}
