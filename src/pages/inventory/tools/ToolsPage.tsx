import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Edit2, Plus, RefreshCcw, Trash2, Wrench } from 'lucide-react';
import { usePermissions } from '../../../rbac/PermissionsContext';
import {
  formatError,
  showConfirmAlert,
  showToastError,
  showToastSuccess,
} from '../../../notifications';
import {
  createTool,
  deleteTool,
  listOpenTicketToolRequests,
  listToolCategories,
  listTools,
  listWarehouseBins,
  listWarehouses,
  updateTool,
} from '../../../services/inventory';
import type {
  ToolCategoryRow,
  ToolInsert,
  ToolRow,
  ToolStatus,
  TicketToolRequestRow,
  WarehouseBinRow,
  WarehouseRow,
} from '../../../types/inventory';

type FormState = {
  id?: string;
  code: string;
  name: string;
  description: string;
  category_id: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  asset_tag: string;
  current_warehouse_id: string;
  current_bin_id: string;
  status: ToolStatus;
  requires_calibration: boolean;
  calibration_due_on: string;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  description: '',
  category_id: '',
  manufacturer: '',
  model: '',
  serial_number: '',
  asset_tag: '',
  current_warehouse_id: '',
  current_bin_id: '',
  status: 'AVAILABLE',
  requires_calibration: false,
  calibration_due_on: '',
  is_active: true,
};

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

const STATUS_LABEL: Record<ToolStatus, string> = {
  AVAILABLE: 'Disponible',
  RESERVED: 'Reservada',
  CHECKED_OUT: 'Entregada',
  MAINTENANCE: 'Mantenimiento',
  DAMAGED: 'Dañada',
  RETIRED: 'Retirada',
};

const STATUS_TONE: Record<ToolStatus, string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  RESERVED: 'bg-amber-50 text-amber-700 border-amber-200',
  CHECKED_OUT: 'bg-sky-50 text-sky-700 border-sky-200',
  MAINTENANCE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  DAMAGED: 'bg-rose-50 text-rose-700 border-rose-200',
  RETIRED: 'bg-slate-100 text-slate-600 border-slate-200',
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function StatusBadge({ status }: { status: ToolStatus }) {
  return (
    <span
      className={cx(
        'inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold',
        STATUS_TONE[status]
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function ToolsPage() {
  const { has } = usePermissions();
  const canRead = has('inventory:read');
  const canManage = has('inventory:full_access');

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [toolReservations, setToolReservations] = useState<TicketToolRequestRow[]>(
    []
  );
  const [categories, setCategories] = useState<ToolCategoryRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [bins, setBins] = useState<WarehouseBinRow[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ToolStatus | ''>('');
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const isEditing = Boolean(form.id);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const warehouseById = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
    [warehouses]
  );
  const binById = useMemo(() => new Map(bins.map((bin) => [bin.id, bin])), [bins]);
  const reservationByToolId = useMemo(() => {
    const next = new Map<string, TicketToolRequestRow>();
    for (const reservation of toolReservations) {
      if (!next.has(reservation.tool_id)) {
        next.set(reservation.tool_id, reservation);
      }
    }
    return next;
  }, [toolReservations]);

  const filteredTools = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tools.filter((tool) => {
      if (statusFilter && tool.status !== statusFilter) return false;
      if (!q) return true;
      return [
        tool.code,
        tool.name,
        tool.serial_number ?? '',
        tool.asset_tag ?? '',
        tool.manufacturer ?? '',
        tool.model ?? '',
        categoryById.get(tool.category_id ?? '')?.name ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [categoryById, query, statusFilter, tools]);

  async function load() {
    setLoading(true);
    try {
      const [
        nextTools,
        nextCategories,
        nextWarehouses,
        nextReservations,
      ] = await Promise.all([
        listTools({ limit: 500 }),
        listToolCategories({ limit: 300 }),
        listWarehouses({ is_active: true, limit: 300 }),
        listOpenTicketToolRequests(),
      ]);
      setTools(nextTools);
      setCategories(nextCategories);
      setWarehouses(nextWarehouses);
      setToolReservations(nextReservations);
    } catch (error: unknown) {
      showToastError(
        error instanceof Error ? error.message : 'Error cargando herramientas'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canRead) return;
    void load();
  }, [canRead]);

  useEffect(() => {
    if (!form.current_warehouse_id) {
      setBins([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const next = await listWarehouseBins(form.current_warehouse_id, {
          is_active: true,
          limit: 300,
        });
        if (!cancelled) setBins(next);
      } catch (error: unknown) {
        if (!cancelled) {
          showToastError(
            error instanceof Error
              ? error.message
              : 'Error cargando ubicaciones'
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [form.current_warehouse_id]);

  function openCreate() {
    if (!canManage) {
      showToastError('No tienes permiso para gestionar herramientas.');
      return;
    }
    setForm({
      ...EMPTY_FORM,
      current_warehouse_id: warehouses[0]?.id ?? '',
    });
    setFormError(null);
    setOpenForm(true);
  }

  function openEdit(tool: ToolRow) {
    if (!canManage) {
      showToastError('No tienes permiso para gestionar herramientas.');
      return;
    }
    setForm({
      id: tool.id,
      code: tool.code,
      name: tool.name,
      description: tool.description ?? '',
      category_id: tool.category_id ?? '',
      manufacturer: tool.manufacturer ?? '',
      model: tool.model ?? '',
      serial_number: tool.serial_number ?? '',
      asset_tag: tool.asset_tag ?? '',
      current_warehouse_id: tool.current_warehouse_id,
      current_bin_id: tool.current_bin_id ?? '',
      status: tool.status,
      requires_calibration: tool.requires_calibration,
      calibration_due_on: tool.calibration_due_on ?? '',
      is_active: tool.is_active,
    });
    setFormError(null);
    setOpenForm(true);
  }

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    if (!canManage) {
      showToastError('No tienes permiso para gestionar herramientas.');
      return;
    }

    setFormError(null);

    const name = form.name.trim();
    if (!name) {
      showToastError('El nombre es obligatorio.');
      return;
    }
    if (!form.current_warehouse_id) {
      showToastError('Selecciona el almacén actual.');
      return;
    }

    const payload: ToolInsert = {
      ...(isEditing ? { code: form.code } : {}),
      name,
      description: nullable(form.description),
      category_id: form.category_id || null,
      manufacturer: nullable(form.manufacturer),
      model: nullable(form.model),
      serial_number: nullable(form.serial_number),
      asset_tag: nullable(form.asset_tag),
      current_warehouse_id: form.current_warehouse_id,
      current_bin_id: form.current_bin_id || null,
      status: form.status,
      requires_calibration: form.requires_calibration,
      calibration_due_on: form.requires_calibration
        ? nullable(form.calibration_due_on)
        : null,
      is_active: form.is_active,
    };

    setSubmitting(true);
    try {
      if (isEditing) {
        await updateTool(form.id!, payload);
        showToastSuccess('Herramienta actualizada.');
      } else {
        await createTool({
          ...payload,
          home_warehouse_id: payload.current_warehouse_id,
          home_bin_id: payload.current_bin_id,
        });
        showToastSuccess('Herramienta creada.');
      }
      setOpenForm(false);
      await load();
    } catch (error: unknown) {
      const message = formatError(error);
      console.error('[tools] Error guardando herramienta', error);
      setFormError(message);
      showToastError(`No se pudo guardar la herramienta: ${message}`, {
        autoClose: 9000,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(tool: ToolRow) {
    if (!canManage) {
      showToastError('No tienes permiso para gestionar herramientas.');
      return;
    }

    const ok = await showConfirmAlert({
      title: 'Eliminar herramienta',
      text: `¿Eliminar la herramienta "${tool.code}"?`,
      confirmButtonText: 'Sí, eliminar',
    });
    if (!ok) return;

    try {
      await deleteTool(tool.id);
      showToastSuccess('Herramienta eliminada.');
      await load();
    } catch (error: unknown) {
      showToastError(
        error instanceof Error ? error.message : 'Error eliminando herramienta'
      );
    }
  }

  if (!canRead) {
    return (
      <div className="h-screen flex bg-slate-50 text-slate-900">
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
      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        <section className="flex-1 min-h-0 overflow-auto bg-slate-100/60">
          <div className="px-4 py-6 md:px-6 lg:px-8">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-sky-700" />
                      <h2 className="text-base font-semibold text-slate-900">
                        Herramientas de trabajo
                      </h2>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Controla unidades físicas, ubicación, estado, calibración y disponibilidad.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Código, nombre, serial..."
                    />
                    <select
                      className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      value={statusFilter}
                      onChange={(e) =>
                        setStatusFilter(e.target.value as ToolStatus | '')
                      }
                    >
                      <option value="">Todos los estados</option>
                      {Object.entries(STATUS_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void load()}
                      disabled={loading}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Actualizar
                    </button>
                    <button
                      type="button"
                      onClick={openCreate}
                      disabled={!canManage}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
                    >
                      <Plus className="h-4 w-4" />
                      Nueva herramienta
                    </button>
                  </div>
                </div>
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Herramienta</th>
                      <th className="px-4 py-3 text-left font-semibold">Categoría</th>
                      <th className="px-4 py-3 text-left font-semibold">Ubicación</th>
                      <th className="px-4 py-3 text-left font-semibold">Serial / Tag</th>
                      <th className="px-4 py-3 text-left font-semibold">Estado</th>
                      <th className="px-4 py-3 text-left font-semibold">Calibración</th>
                      <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredTools.map((tool) => {
                      const warehouse = warehouseById.get(tool.current_warehouse_id);
                      const bin = tool.current_bin_id
                        ? binById.get(tool.current_bin_id)
                        : null;
                      const reservation = reservationByToolId.get(tool.id);
                      return (
                        <tr key={tool.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">{tool.code}</p>
                            <p className="text-slate-600">{tool.name}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {categoryById.get(tool.category_id ?? '')?.name ?? 'Sin categoría'}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {warehouse ? `${warehouse.code} — ${warehouse.name}` : '—'}
                            {bin ? (
                              <p className="text-xs text-slate-500">
                                {bin.code} {bin.name ? `— ${bin.name}` : ''}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            <p>{tool.serial_number || '—'}</p>
                            <p className="text-xs text-slate-500">{tool.asset_tag || 'Sin tag'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={tool.status} />
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {tool.requires_calibration
                              ? tool.calibration_due_on ?? 'Sin fecha'
                              : 'No aplica'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              {reservation ? (
                                <Link
                                  to={`/tickets/${reservation.ticket_id}`}
                                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-sky-200 px-2.5 text-xs font-semibold text-sky-700 hover:bg-sky-50"
                                  aria-label={`Ver ticket ${reservation.ticket_id} de ${tool.code}`}
                                >
                                  <ClipboardList className="h-4 w-4" />
                                  OT #{reservation.ticket_id}
                                </Link>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => openEdit(tool)}
                                disabled={!canManage}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                                aria-label={`Editar ${tool.code}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(tool)}
                                disabled={!canManage}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-rose-300"
                                aria-label={`Eliminar ${tool.code}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-200 lg:hidden">
                {filteredTools.map((tool) => {
                  const reservation = reservationByToolId.get(tool.id);

                  return (
                    <article key={tool.id} className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{tool.code}</p>
                          <p className="text-sm text-slate-600">{tool.name}</p>
                        </div>
                        <StatusBadge status={tool.status} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                          <p className="font-semibold text-slate-500">Serial</p>
                          <p>{tool.serial_number || '—'}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                          <p className="font-semibold text-slate-500">Tag</p>
                          <p>{tool.asset_tag || '—'}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        {reservation ? (
                          <Link
                            to={`/tickets/${reservation.ticket_id}`}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-sky-200 px-3 py-2 text-sm font-semibold text-sky-700"
                          >
                            <ClipboardList className="h-4 w-4" />
                            Ver OT #{reservation.ticket_id}
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openEdit(tool)}
                          disabled={!canManage}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
                        >
                          <Edit2 className="h-4 w-4" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(tool)}
                          disabled={!canManage}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:text-rose-300"
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {filteredTools.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500">
                  {loading ? 'Cargando herramientas...' : 'No hay herramientas para los filtros aplicados.'}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {openForm ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <form
              onSubmit={submitForm}
              className="max-h-[92dvh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-5 shadow-xl"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {isEditing ? 'Editar herramienta' : 'Nueva herramienta'}
                  </h3>
                  <p className="text-sm text-slate-500">
                    Registra una unidad física con ubicación y estado operativo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenForm(false)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cerrar
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Código">
                  <input
                    className={INPUT_CLASS}
                    value={
                      isEditing
                        ? form.code
                        : 'Se asignará automáticamente al guardar'
                    }
                    readOnly
                    aria-readonly="true"
                  />
                </Field>
                <Field label="Nombre">
                  <input
                    className={INPUT_CLASS}
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Categoría">
                  <select
                    className={INPUT_CLASS}
                    value={form.category_id}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        category_id: e.target.value,
                      }))
                    }
                  >
                    <option value="">Sin categoría</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Estado">
                  <select
                    className={INPUT_CLASS}
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        status: e.target.value as ToolStatus,
                      }))
                    }
                  >
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Fabricante">
                  <input
                    className={INPUT_CLASS}
                    value={form.manufacturer}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        manufacturer: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Modelo">
                  <input
                    className={INPUT_CLASS}
                    value={form.model}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, model: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Serial">
                  <input
                    className={INPUT_CLASS}
                    value={form.serial_number}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        serial_number: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Asset tag / QR">
                  <input
                    className={INPUT_CLASS}
                    value={form.asset_tag}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        asset_tag: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Almacén actual">
                  <select
                    className={INPUT_CLASS}
                    value={form.current_warehouse_id}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        current_warehouse_id: e.target.value,
                        current_bin_id: '',
                      }))
                    }
                  >
                    <option value="">Selecciona...</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.code} — {warehouse.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Ubicación actual">
                  <select
                    className={INPUT_CLASS}
                    value={form.current_bin_id}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        current_bin_id: e.target.value,
                      }))
                    }
                    disabled={!form.current_warehouse_id || bins.length === 0}
                  >
                    <option value="">Sin ubicación</option>
                    {bins.map((bin) => (
                      <option key={bin.id} value={bin.id}>
                        {bin.code} {bin.name ? `— ${bin.name}` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Calibración">
                  <div className="flex gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.requires_calibration}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            requires_calibration: e.target.checked,
                          }))
                        }
                      />
                      Requiere
                    </label>
                    <input
                      className={INPUT_CLASS}
                      type="date"
                      value={form.calibration_due_on}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          calibration_due_on: e.target.value,
                        }))
                      }
                      disabled={!form.requires_calibration}
                    />
                  </div>
                </Field>
                <Field label="Activo">
                  <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          is_active: e.target.checked,
                        }))
                      }
                    />
                    Disponible para operación
                  </label>
                </Field>
                <div className="md:col-span-2">
                  <Field label="Descripción">
                    <textarea
                      className={`${INPUT_CLASS} min-h-24`}
                      value={form.description}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
              </div>

              {formError ? (
                <div
                  role="alert"
                  className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                >
                  <p className="font-semibold">No se pudo guardar la herramienta.</p>
                  <p className="mt-1 break-words">{formError}</p>
                </div>
              ) : null}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpenForm(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
                >
                  {submitting ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
