import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import { useCan } from '../../rbac/PermissionsContext';
import {
  showConfirmAlert,
  showToastError,
  showToastSuccess,
} from '../../notifications';
import type {
  UUID,
  PartRow,
  VendorRow,
  PartVendorInsert,
  PartVendorRow,
} from '../../types/inventory';

import { listVendors } from '../../services/inventory/vendorsService';
import {
  deletePartVendor,
  listPartVendors,
  updatePartVendor,
  upsertPartVendor,
} from '../../services/inventory/vendorsService';
import { listParts } from '../../services/inventory/partsService';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const emptyForm: Omit<PartVendorInsert, 'part_id'> = {
  vendor_id: '' as UUID,
  vendor_part_code: null,
  lead_time_days: null,
  moq: null,
  last_price: null,
  currency: 'DOP',
  is_preferred: false,
};

type Props = {
  embedded?: boolean;
};

function PartVendorsContent({ embedded }: Props) {
  const canRead = useCan('inventory:read');
  const canFull = useCan('inventory:full_access');
  const isReadOnly = !canFull;

  const [parts, setParts] = useState<PartRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);

  const [partId, setPartId] = useState<UUID | ''>('');
  const [rows, setRows] = useState<PartVendorRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] =
    useState<Omit<PartVendorInsert, 'part_id'>>(emptyForm);

  const vendorById = useMemo(() => {
    const m = new Map<UUID, VendorRow>();
    for (const v of vendors) m.set(v.id, v);
    return m;
  }, [vendors]);

  const partLabel = useMemo(() => {
    const p = parts.find((x) => x.id === partId);
    return p ? `${p.code} — ${p.name}` : '';
  }, [parts, partId]);

  const canSee = canRead || canFull;

  const refreshRows = async (pid: UUID) => {
    setLoading(true);
    try {
      const data = await listPartVendors(pid);
      const sorted = [...data].sort((a, b) => {
        if (a.is_preferred !== b.is_preferred) return a.is_preferred ? -1 : 1;
        return String(a.vendor_id).localeCompare(String(b.vendor_id));
      });
      setRows(sorted);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToastError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canSee) return;

    (async () => {
      try {
        const [p, v] = await Promise.all([
          listParts({
            limit: 500,
            offset: 0,
            orderBy: 'code',
            ascending: true,
          }),
          listVendors({
            limit: 500,
            offset: 0,
            orderBy: 'name',
            ascending: true,
            is_active: true,
          }),
        ]);
        setParts(p);
        setVendors(v);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        showToastError(msg);
      }
    })();
  }, [canSee]);

  useEffect(() => {
    if (!partId) return;
    void refreshRows(partId);
  }, [partId]);

  const resetForm = () => setForm(emptyForm);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!partId) return showToastError('Selecciona un repuesto.');
    if (!form.vendor_id) return showToastError('Selecciona un proveedor.');

    try {
      const created = await upsertPartVendor({
        part_id: partId,
        vendor_id: form.vendor_id,
        vendor_part_code: form.vendor_part_code?.trim() || null,
        lead_time_days: form.lead_time_days ?? null,
        moq: form.moq ?? null,
        last_price: form.last_price ?? null,
        currency: form.currency?.trim() || null,
        is_preferred: !!form.is_preferred,
      });

      if (created.is_preferred) {
        const others = rows.filter(
          (r) => r.id !== created.id && r.is_preferred
        );
        for (const o of others) {
          await updatePartVendor(o.id, { is_preferred: false });
        }
      }

      showToastSuccess('Proveedor asociado al repuesto.');
      resetForm();
      await refreshRows(partId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToastError(`No se pudo guardar: ${msg}`);
    }
  };

  const onSetPreferred = async (target: PartVendorRow) => {
    if (isReadOnly) return;
    if (!partId) return;

    try {
      const preferred = rows.filter((r) => r.is_preferred);
      for (const r of preferred) {
        if (r.id !== target.id) {
          await updatePartVendor(r.id, { is_preferred: false });
        }
      }

      await updatePartVendor(target.id, { is_preferred: true });

      showToastSuccess('Proveedor preferido actualizado.');
      await refreshRows(partId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToastError(msg);
    }
  };

  const onDelete = async (id: UUID) => {
    if (isReadOnly) return;
    if (!partId) return;
    const relation = rows.find((r) => r.id === id);
    const vendorName =
      relation ? vendorById.get(relation.vendor_id)?.name : null;
    const ok = await showConfirmAlert({
      title: 'Quitar relación',
      text: `¿Quitar la relación con "${vendorName ?? 'este proveedor'}"?`,
      confirmButtonText: 'Sí, quitar',
    });
    if (!ok) return;

    try {
      await deletePartVendor(id);
      showToastSuccess('Relación eliminada.');
      await refreshRows(partId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToastError(`No se pudo eliminar: ${msg}`);
    }
  };

  if (!canSee) {
    // embedded: devuelve solo el card
    if (embedded) {
      return (
        <div className="rounded-2xl border bg-white p-6 text-sm text-gray-700">
          No tienes permiso para ver Repuesto–Proveedor.
        </div>
      );
    }

    // standalone page
    return (
      <div className="h-screen flex bg-gray-100">
        <Sidebar />
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
          <div className="p-6">
            <div className="rounded-2xl border bg-white p-6 text-sm text-gray-700">
              No tienes permiso para ver Repuesto–Proveedor.
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ✅ contenido (sin p-6 externo si está embedded)
  const containerCls = embedded ? 'space-y-6' : 'p-6 space-y-6';

  return (
    <div className={containerCls}>
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Repuesto–Proveedor</h1>
        </div>
      )}

      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
        <label className="text-sm font-medium">Repuesto</label>
        <select
          value={partId}
          onChange={(e) => setPartId((e.target.value || '') as UUID | '')}
          className="mt-1 w-full px-3 py-2 border rounded-md bg-white"
        >
          <option value="">Selecciona un repuesto…</option>
          {parts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
        {partId && (
          <p className="text-xs text-gray-500">Seleccionado: {partLabel}</p>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className={cx(
          'rounded-2xl border bg-white p-4 shadow-sm space-y-3',
          isReadOnly && 'opacity-60'
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Proveedor</label>
            <select
              value={form.vendor_id}
              disabled={isReadOnly || !partId}
              onChange={(e) =>
                setForm((p) => ({ ...p, vendor_id: e.target.value as UUID }))
              }
              className={cx(
                'mt-1 w-full px-3 py-2 border rounded-md bg-white',
                (isReadOnly || !partId) && 'bg-gray-100 cursor-not-allowed'
              )}
            >
              <option value="">Selecciona proveedor…</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Código proveedor</label>
            <input
              value={form.vendor_part_code ?? ''}
              disabled={isReadOnly || !partId}
              onChange={(e) =>
                setForm((p) => ({ ...p, vendor_part_code: e.target.value }))
              }
              className={cx(
                'mt-1 w-full px-3 py-2 border rounded-md',
                (isReadOnly || !partId) && 'bg-gray-100 cursor-not-allowed'
              )}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Lead time (días)</label>
            <input
              type="number"
              min={0}
              value={form.lead_time_days ?? ''}
              disabled={isReadOnly || !partId}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  lead_time_days:
                    e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              className={cx(
                'mt-1 w-full px-3 py-2 border rounded-md',
                (isReadOnly || !partId) && 'bg-gray-100 cursor-not-allowed'
              )}
            />
          </div>

          <div>
            <label className="text-sm font-medium">MOQ</label>
            <input
              type="number"
              min={0}
              step="0.001"
              value={form.moq ?? ''}
              disabled={isReadOnly || !partId}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  moq: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              className={cx(
                'mt-1 w-full px-3 py-2 border rounded-md',
                (isReadOnly || !partId) && 'bg-gray-100 cursor-not-allowed'
              )}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Último precio</label>
            <input
              type="number"
              min={0}
              step="0.0001"
              value={form.last_price ?? ''}
              disabled={isReadOnly || !partId}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  last_price:
                    e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              className={cx(
                'mt-1 w-full px-3 py-2 border rounded-md',
                (isReadOnly || !partId) && 'bg-gray-100 cursor-not-allowed'
              )}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <label className="text-sm font-medium">Moneda</label>
              <input
                value={form.currency ?? ''}
                disabled={isReadOnly || !partId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, currency: e.target.value }))
                }
                className={cx(
                  'mt-1 w-32 px-3 py-2 border rounded-md',
                  (isReadOnly || !partId) && 'bg-gray-100 cursor-not-allowed'
                )}
              />
            </div>

            <label className="text-sm flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                checked={!!form.is_preferred}
                disabled={isReadOnly || !partId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, is_preferred: e.target.checked }))
                }
              />
              Preferido
            </label>
          </div>

          <button
            type="submit"
            disabled={isReadOnly || !partId}
            className={cx(
              'rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500',
              (isReadOnly || !partId) && 'opacity-50 cursor-not-allowed'
            )}
          >
            Guardar
          </button>
        </div>
      </form>

      <div className="overflow-auto rounded-xl ring-1 ring-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                Proveedor
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                Preferido
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                Lead time
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                MOQ
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                Último precio
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 w-44">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-gray-400">
                  Cargando…
                </td>
              </tr>
            ) : !partId ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-gray-400">
                  Selecciona un repuesto.
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-gray-400">
                  Sin proveedores asociados.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const v = vendorById.get(r.vendor_id) ?? null;
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900">
                        {v?.name ?? r.vendor_id}
                      </div>
                      <div className="text-xs text-gray-500">
                        {r.vendor_part_code
                          ? `Código: ${r.vendor_part_code}`
                          : '—'}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <button
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => void onSetPreferred(r)}
                        className={cx(
                          'px-2 py-1 rounded',
                          r.is_preferred
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-700',
                          isReadOnly && 'opacity-50 cursor-not-allowed'
                        )}
                        title="Marcar como preferido (único por repuesto)"
                      >
                        {r.is_preferred ? '⭐ Sí' : 'No'}
                      </button>
                    </td>

                    <td className="px-4 py-4 text-gray-700">
                      {r.lead_time_days ?? '—'}
                    </td>
                    <td className="px-4 py-4 text-gray-700">{r.moq ?? '—'}</td>

                    <td className="px-4 py-4 text-gray-700">
                      {r.last_price ?? '—'} {r.currency ?? ''}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => void onDelete(r.id)}
                          className={cx(
                            'text-rose-600 hover:text-rose-500 text-sm',
                            isReadOnly && 'opacity-40 cursor-not-allowed'
                          )}
                        >
                          Quitar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {partId && rows.length > 0 && (
        <p className="text-xs text-gray-500">
          Tip: si marcas “Preferido”, la UI desmarca cualquier otro preferido
          para ese repuesto.
        </p>
      )}
    </div>
  );
}

export default function PartVendorsPage(props: Props) {
  // Si se usa standalone, puedes envolverlo aquí igual que UomsPage.
  if (props.embedded) return <PartVendorsContent embedded />;

  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />
      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <header className="px-4 md:px-6 lg:px-8 pb-0 pt-4 md:pt-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl md:text-3xl font-bold">
              Repuesto–Proveedor
            </h2>
            <p className="text-sm text-gray-600">
              Lead time, MOQ, precio, moneda y preferido por repuesto.
            </p>
          </div>
        </header>

        <section className="px-4 md:px-6 lg:px-8 py-6 overflow-auto flex-1 min-h-0">
          <PartVendorsContent />
        </section>
      </main>
    </div>
  );
}
