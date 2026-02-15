import { useState } from 'react';
import Sidebar from '../../../components/layout/Sidebar';
import { usePermissions } from '../../../rbac/PermissionsContext';
import type {
  PartCriticality,
  PartInsert,
  PartRow,
  PartUpdate,
} from '../../../types/inventory';
import {
  createPart,
  deletePart,
  updatePart,
} from '../../../services/inventory';
import { showToastError, showToastSuccess } from '../../../notifications';

import PartsHeader from './components/PartsHeader';
import PartsToolbar from './components/PartsToolbar';
import PartsMobileList from './components/PartsMobileList';
import PartsTable from './components/PartsTable';
import PartsForm from './components/PartsForm';

import { usePartsData } from './hooks/usePartsData';
import { usePartsFilters } from './hooks/usePartsFilters';
import { useRowSelection } from './hooks/useRowSelection';

type FormState = {
  id?: string;
  code: string;
  name: string;
  description: string;
  uom_id: string;
  category_id: string | null;
  criticality: PartCriticality;
  is_active: boolean;
  is_stocked: boolean;
};

const DEFAULT_CRIT: PartCriticality = 'MEDIUM';

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  description: '',
  uom_id: '',
  category_id: null,
  criticality: DEFAULT_CRIT,
  is_active: true,
  is_stocked: true,
};

function normalizeCode(raw: string) {
  return raw.trim().toUpperCase();
}

export default function PartsPage() {
  const { has } = usePermissions();
  const canRead = has('inventory:read');
  const canManage = has('inventory:full_access');

  const { isLoading, parts, uoms, categories, uomById, catById, reload } =
    usePartsData({ canRead });

  const {
    q,
    setQ,
    activeFilter,
    setActiveFilter,
    critFilter,
    setCritFilter,
    filteredParts,
    totalCount,
  } = usePartsFilters({
    parts,
    uomById,
    catById,
  });

  const {
    checkboxRef,
    selectedRows,
    setSelectedRows,
    checked,
    indeterminate,
    toggleAll,
  } = useRowSelection<PartRow>({
    items: filteredParts,
  });

  const selectedCount = selectedRows.length;

  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const isEditing = typeof form.id === 'string';

  function openCreate() {
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');
    setForm(EMPTY_FORM);
    setOpenForm(true);
  }

  function openEdit(row: PartRow) {
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');
    setForm({
      id: row.id,
      code: row.code ?? '',
      name: row.name ?? '',
      description: row.description ?? '',
      uom_id: row.uom_id,
      category_id: row.category_id ?? null,
      criticality: row.criticality,
      is_active: row.is_active,
      is_stocked: row.is_stocked,
    });
    setOpenForm(true);
  }

  async function submitForm(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!canManage) {
      showToastError('No tienes permiso para gestionar maestros.');
      return;
    }

    const code = normalizeCode(form.code);
    const name = form.name.trim();
    const description = form.description.trim();

    if (!code) {
      showToastError('El código es obligatorio.');
      return;
    }
    if (!name) {
      showToastError('El nombre es obligatorio.');
      return;
    }
    if (!form.uom_id) {
      showToastError('Debes seleccionar una UoM.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: PartInsert = {
        code,
        name,
        description: description ? description : null,
        uom_id: form.uom_id,
        category_id: form.category_id ?? null,
        criticality: form.criticality,
        is_active: form.is_active,
        is_stocked: form.is_stocked,
      };

      if (isEditing) {
        const patch: PartUpdate = payload;
        await updatePart(form.id!, patch);
        showToastSuccess('Repuesto actualizado.');
      } else {
        await createPart(payload);
        showToastSuccess('Repuesto creado.');
      }

      setOpenForm(false);
      await reload();
    } catch (e: unknown) {
      showToastError(
        e instanceof Error ? e.message : 'Error guardando repuesto'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(row: PartRow): Promise<void> {
    if (!canManage) {
      showToastError('No tienes permiso para gestionar maestros.');
      return;
    }

    const ok = confirm(`¿Eliminar el repuesto "${row.code}"?`);
    if (!ok) return;

    try {
      await deletePart(row.id);
      showToastSuccess('Repuesto eliminado.');
      await reload();
    } catch (e: unknown) {
      showToastError(
        e instanceof Error ? e.message : 'Error eliminando repuesto'
      );
    }
  }

  async function handleBulkDelete() {
    if (!canManage)
      return showToastError('No tienes permiso para gestionar maestros.');
    if (selectedRows.length === 0) return;

    const ok = confirm(`¿Eliminar ${selectedRows.length} repuesto(s)?`);
    if (!ok) return;

    try {
      for (const r of selectedRows) await deletePart(r.id);
      showToastSuccess(`Se eliminaron ${selectedRows.length} repuesto(s).`);
      await reload();
      setSelectedRows([]);
    } catch (e: unknown) {
      showToastError(
        e instanceof Error ? e.message : 'Error en eliminación masiva'
      );
    }
  }

  if (!canRead) {
    return (
      <div className="h-screen flex bg-slate-50 text-slate-900">
        <Sidebar />
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
          <div className="p-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              No tienes permisos para acceder al módulo de inventario.
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-slate-50 text-slate-900">
      <Sidebar />

      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        <PartsHeader
          totalCount={totalCount}
          selectedCount={selectedCount}
          canManage={canManage}
          isLoading={isLoading}
          onCreate={openCreate}
          onBulkDelete={handleBulkDelete}
        />

        <section className="flex-1 min-h-0 overflow-auto">
          <div className="px-4 md:px-6 lg:px-8 py-6">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <PartsToolbar
                q={q}
                setQ={setQ}
                activeFilter={activeFilter}
                setActiveFilter={setActiveFilter}
                critFilter={critFilter}
                setCritFilter={setCritFilter}
                totalCount={totalCount}
                canManage={canManage}
              />

              <PartsMobileList
                isLoading={isLoading}
                parts={filteredParts}
                selectedRows={selectedRows}
                setSelectedRows={setSelectedRows}
                canManage={canManage}
                uomById={uomById}
                catById={catById}
                onEdit={openEdit}
                onDelete={handleDelete}
              />

              <PartsTable
                isLoading={isLoading}
                parts={filteredParts}
                checkboxRef={checkboxRef}
                checked={checked}
                indeterminate={indeterminate}
                toggleAll={toggleAll}
                selectedRows={selectedRows}
                setSelectedRows={setSelectedRows}
                canManage={canManage}
                uomById={uomById}
                catById={catById}
                onEdit={openEdit}
                onDelete={handleDelete}
              />

              <div className="px-5 py-4 border-t border-slate-100 bg-white">
                <div className="text-xs text-slate-500">
                  Tip: Parts code se normaliza a{' '}
                  <span className="font-mono">UPPERCASE</span>. Usa filtros para
                  encontrar rápido por código/nombre/categoría.
                </div>
              </div>
            </div>
          </div>
        </section>

        <PartsForm
          open={openForm}
          isEditing={isEditing}
          canManage={canManage}
          submitting={submitting}
          form={form}
          setForm={setForm}
          uoms={uoms}
          categories={categories}
          normalizeCode={normalizeCode}
          onClose={() => setOpenForm(false)}
          onSubmit={submitForm}
        />
      </main>
    </div>
  );
}
