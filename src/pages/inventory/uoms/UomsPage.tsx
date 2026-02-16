import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '../../../components/layout/Sidebar';
import { usePermissions } from '../../../rbac/PermissionsContext';
import { showToastError, showToastSuccess } from '../../../notifications';

import type { UomInsert, UomRow, UomUpdate } from '../../../types/inventory';
import {
  createUom,
  deleteUom,
  listUoms,
  updateUom,
} from '../../../services/inventory/uomsService';

import { PageShell } from './components/PageShell';
import { UomsHeader } from './components/UomsHeader';
import { UomsToolbar } from './components/UomsToolbar';
import { UomsMobileList } from './components/UomsMobileList';
import { UomsTable } from './components/UomsTable';
import { UomModal } from './components/UomModal';
import { EMPTY_FORM, type FormState } from './components/types';

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

export default function UomsPage() {
  const { has } = usePermissions();
  const canRead = has('inventory:read');
  const canManage = has('inventory:full_access');

  const checkboxRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<UomRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedRows, setSelectedRows] = useState<UomRow[]>([]);
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);

  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState('');

  const isEditing = typeof form.id === 'string';

  const filteredRows = useMemo(() => {
    const q = search.trim();
    if (q.length < 2) return rows;

    const needle = q.toLowerCase();
    return rows.filter((r) => {
      return (
        r.code.toLowerCase().includes(needle) ||
        r.name.toLowerCase().includes(needle)
      );
    });
  }, [rows, search]);

  async function reload() {
    if (!canRead) return;
    setIsLoading(true);
    try {
      const data = await listUoms({
        limit: 500,
        offset: 0,
        orderBy: 'code',
        ascending: true,
      });
      setRows(data);
      setSelectedRows([]);
    } catch (e) {
      showToastError(e instanceof Error ? e.message : 'Error cargando UoM');
    } finally {
      setIsLoading(false);
    }
  }

  // sync selection state + checkbox indeterminate
  useEffect(() => {
    const total = filteredRows.length;
    const selected = selectedRows.length;

    const nextChecked = total > 0 && selected === total;
    const nextInd = selected > 0 && selected < total;

    setChecked(nextChecked);
    setIndeterminate(nextInd);

    if (checkboxRef.current) checkboxRef.current.indeterminate = nextInd;
  }, [filteredRows.length, selectedRows.length]);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  function openCreate() {
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');
    setForm(EMPTY_FORM);
    setOpenForm(true);
  }

  function openEdit(row: UomRow) {
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');
    setForm({ id: row.id, code: row.code, name: row.name });
    setOpenForm(true);
  }

  function toggleAll() {
    const shouldSelectAll = !(checked || indeterminate);
    setSelectedRows(shouldSelectAll ? filteredRows : []);
    setChecked(shouldSelectAll);
    setIndeterminate(false);
    if (checkboxRef.current) checkboxRef.current.indeterminate = false;
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');

    if (!form.code.trim()) return showToastError('El código es obligatorio.');
    if (!form.name.trim()) return showToastError('El nombre es obligatorio.');

    setSubmitting(true);
    try {
      const payload: UomInsert = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
      };

      if (isEditing) {
        const patch: UomUpdate = { code: payload.code, name: payload.name };
        await updateUom(form.id!, patch);
        showToastSuccess('UoM actualizada.');
      } else {
        await createUom(payload);
        showToastSuccess('UoM creada.');
      }

      setOpenForm(false);
      await reload();
    } catch (e) {
      showToastError(e instanceof Error ? e.message : 'Error guardando UoM');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(row: UomRow) {
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');

    const ok = confirm(`¿Eliminar la UoM "${row.code}"?`);
    if (!ok) return;

    setIsLoading(true);
    try {
      await deleteUom(row.id);
      showToastSuccess('UoM eliminada.');
      await reload();
    } catch (e) {
      showToastError(e instanceof Error ? e.message : 'Error eliminando UoM');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBulkDelete() {
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');
    if (selectedRows.length === 0) return;

    const ok = confirm(`¿Eliminar ${selectedRows.length} UoM(s)?`);
    if (!ok) return;

    setIsLoading(true);
    try {
      for (const r of selectedRows) await deleteUom(r.id);
      showToastSuccess(`Se eliminaron ${selectedRows.length} UoM(s).`);
      await reload();
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error en eliminación masiva'
      );
    } finally {
      setIsLoading(false);
    }
  }

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
        <UomsHeader count={rows.length} canManage={canManage} />

        <UomsToolbar
          canManage={canManage}
          isLoading={isLoading}
          selectedCount={selectedRows.length}
          totalCount={rows.length}
          filteredCount={filteredRows.length}
          search={search}
          onSearchChange={setSearch}
          onCreate={openCreate}
          onBulkDelete={handleBulkDelete}
        />

        <section className="flex-1 min-h-0 overflow-auto px-4 md:px-6 lg:px-8 pb-6">
          <UomsMobileList
            rows={filteredRows}
            isLoading={isLoading}
            selectedRows={selectedRows}
            setSelectedRows={setSelectedRows}
            canManage={canManage}
            onEdit={openEdit}
            onDelete={handleDelete}
          />

          <UomsTable
            rows={filteredRows}
            isLoading={isLoading}
            selectedRows={selectedRows}
            setSelectedRows={setSelectedRows}
            canManage={canManage}
            checked={checked}
            indeterminate={indeterminate}
            onToggleAll={toggleAll}
            checkboxRef={checkboxRef}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        </section>

        <UomModal
          open={openForm}
          isEditing={isEditing}
          form={form}
          submitting={submitting}
          canManage={canManage}
          onClose={() => setOpenForm(false)}
          onChangeForm={(patch) => setForm((f) => ({ ...f, ...patch }))}
          onSubmit={submitForm}
        />
      </main>
    </PageShell>
  );
}
