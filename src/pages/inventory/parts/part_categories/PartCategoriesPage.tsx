import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '../../../../components/layout/Sidebar';
import { usePermissions } from '../../../../rbac/PermissionsContext';
import { showToastError, showToastSuccess } from '../../../../notifications';

import type {
  PartCategoryInsert,
  PartCategoryRow,
  PartCategoryUpdate,
} from '../../../../types/inventory';
import {
  listPartCategories,
  createPartCategory,
  updatePartCategory,
  deletePartCategory,
} from '../../../../services/inventory';

import { PageShell } from './components/PageShell';
import { PartCategoriesHeader } from './components/PartCategoriesHeader';
import { PartCategoriesToolbar } from './components/PartCategoriesToolbar';
import { PartCategoriesMobileList } from './components/PartCategoriesMobileList';
import { PartCategoriesTable } from './components/PartCategoriesTable';
import { PartCategoryModal } from './components/PartCategoryModal';

import { buildCategoryLabelMap } from './components/categoryHelpers';
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

export default function PartCategoriesPage() {
  const { has } = usePermissions();
  const canRead = has('inventory:read');
  const canManage = has('inventory:full_access');

  const checkboxRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<PartCategoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedRows, setSelectedRows] = useState<PartCategoryRow[]>([]);
  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);

  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const isEditing = typeof form.id === 'string';

  const helpers = useMemo(() => buildCategoryLabelMap(rows), [rows]);

  const parentOptions = useMemo(() => {
    const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    return isEditing ? sorted.filter((r) => r.id !== form.id) : sorted;
  }, [rows, isEditing, form.id]);

  async function reload() {
    if (!canRead) return;
    setIsLoading(true);
    try {
      const data = await listPartCategories({
        limit: 1000,
        offset: 0,
        orderBy: 'name',
        ascending: true,
      });
      setRows(data);
      setSelectedRows([]);
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error cargando categorías'
      );
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

  function openCreate() {
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');
    setForm(EMPTY_FORM);
    setOpenForm(true);
  }

  function openEdit(row: PartCategoryRow) {
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');
    setForm({ id: row.id, name: row.name, parent_id: row.parent_id });
    setOpenForm(true);
  }

  function toggleAll() {
    const shouldSelectAll = !(checked || indeterminate);
    setSelectedRows(shouldSelectAll ? rows : []);
    setChecked(shouldSelectAll);
    setIndeterminate(false);
    if (checkboxRef.current) checkboxRef.current.indeterminate = false;
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');
    if (!form.name.trim()) return showToastError('El nombre es obligatorio.');

    setSubmitting(true);
    try {
      const payload: PartCategoryInsert = {
        name: form.name.trim(),
        parent_id: form.parent_id ?? null,
      };

      if (isEditing) {
        const patch: PartCategoryUpdate = {
          name: payload.name,
          parent_id: payload.parent_id ?? null,
        };
        await updatePartCategory(form.id!, patch);
        showToastSuccess('Categoría actualizada.');
      } else {
        await createPartCategory(payload);
        showToastSuccess('Categoría creada.');
      }

      setOpenForm(false);
      await reload();
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error guardando categoría'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(row: PartCategoryRow) {
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');
    const ok = confirm(`¿Eliminar la categoría "${row.name}"?`);
    if (!ok) return;

    setIsLoading(true);
    try {
      await deletePartCategory(row.id);
      showToastSuccess('Categoría eliminada.');
      await reload();
    } catch (e) {
      showToastError(
        e instanceof Error ? e.message : 'Error eliminando categoría'
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBulkDelete() {
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');
    if (selectedRows.length === 0) return;

    const ok = confirm(`¿Eliminar ${selectedRows.length} categoría(s)?`);
    if (!ok) return;

    setIsLoading(true);
    try {
      for (const r of selectedRows) await deletePartCategory(r.id);
      showToastSuccess(`Se eliminaron ${selectedRows.length} categoría(s).`);
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
        <PartCategoriesHeader count={rows.length} canManage={canManage} />

        <PartCategoriesToolbar
          canManage={canManage}
          isLoading={isLoading}
          selectedCount={selectedRows.length}
          onCreate={openCreate}
          onBulkDelete={handleBulkDelete}
        />

        <section className="flex-1 min-h-0 overflow-auto px-4 md:px-6 lg:px-8 pb-6">
          <PartCategoriesMobileList
            rows={rows}
            helpers={helpers}
            isLoading={isLoading}
            selectedRows={selectedRows}
            setSelectedRows={setSelectedRows}
            canManage={canManage}
            onEdit={openEdit}
            onDelete={handleDelete}
          />

          <PartCategoriesTable
            rows={rows}
            helpers={helpers}
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

        <PartCategoryModal
          open={openForm}
          isEditing={isEditing}
          form={form}
          parentOptions={parentOptions}
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
