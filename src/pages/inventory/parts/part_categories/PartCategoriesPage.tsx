import { useEffect, useMemo, useRef, useState } from 'react';
import { usePermissions } from '../../../../rbac/PermissionsContext';
import {
  showConfirmAlert,
  showToastError,
  showToastSuccess,
} from '../../../../notifications';

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
  const [search, setSearch] = useState('');

  const isEditing = typeof form.id === 'string';

  const helpers = useMemo(() => buildCategoryLabelMap(rows), [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) => {
      const parent = helpers.labelOf(row.parent_id)?.toLowerCase() ?? '';
      const breadcrumb = helpers.breadcrumbOf(row.id).toLowerCase();
      return (
        row.name.toLowerCase().includes(query) ||
        parent.includes(query) ||
        breadcrumb.includes(query)
      );
    });
  }, [rows, search, helpers]);

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
    const total = filteredRows.length;
    const selected = selectedRows.length;

    const nextChecked = total > 0 && selected === total;
    const nextInd = selected > 0 && selected < total;

    setChecked(nextChecked);
    setIndeterminate(nextInd);

    if (checkboxRef.current) checkboxRef.current.indeterminate = nextInd;
  }, [filteredRows.length, selectedRows.length]);

  useEffect(() => {
    setSelectedRows((prev) => prev.filter((row) => filteredRows.includes(row)));
  }, [filteredRows]);

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
    setSelectedRows(shouldSelectAll ? filteredRows : []);
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
    const ok = await showConfirmAlert({
      title: 'Eliminar categoría',
      text: `¿Eliminar la categoría "${row.name}"? Esta acción no se puede deshacer.`,
      confirmButtonText: 'Sí, eliminar',
    });
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

    const ok = await showConfirmAlert({
      title: 'Eliminar selección',
      text: `¿Eliminar ${selectedRows.length} categoría(s) seleccionada(s)?`,
      confirmButtonText: 'Sí, eliminar',
    });
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
      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        <section className="flex-1 min-h-0 overflow-auto">
          <div className="px-4 md:px-6 lg:px-8 py-6">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <PartCategoriesToolbar
                search={search}
                onSearchChange={setSearch}
                totalCount={filteredRows.length}
                canManage={canManage}
                isLoading={isLoading}
                selectedCount={selectedRows.length}
                onCreate={openCreate}
                onBulkDelete={handleBulkDelete}
              />

              <PartCategoriesMobileList
                rows={filteredRows}
                helpers={helpers}
                isLoading={isLoading}
                selectedRows={selectedRows}
                setSelectedRows={setSelectedRows}
                canManage={canManage}
                onEdit={openEdit}
                onDelete={handleDelete}
              />

              <PartCategoriesTable
                rows={filteredRows}
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

              <div className="px-5 py-4 border-t border-slate-100 bg-white">
                <div className="text-xs text-slate-500">
                  Tip: usa la búsqueda para encontrar categorías por nombre,
                  padre o ruta completa.
                </div>
              </div>
            </div>
          </div>
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
