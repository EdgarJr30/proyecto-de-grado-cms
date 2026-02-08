import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import { usePermissions } from '../../rbac/PermissionsContext';
import {
  showToastError,
  showToastSuccess,
  formatError,
} from '../../notifications';

import type {
  InventoryDocLineInsert,
  InventoryDocLineRow,
  InventoryDocRow,
  InventoryDocType,
  UUID,
} from '../../types/inventory';

import {
  addInventoryDocLines,
  cancelInventoryDoc,
  deleteInventoryDoc,
  deleteInventoryDocLine,
  getInventoryDoc,
  listInventoryDocLines,
  postInventoryDoc,
  updateInventoryDoc,
  updateInventoryDocLine,
} from '../../services/inventory';

import { inv } from '../../services/inventory/inventoryClient';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/** ===== Lookups mínimos ===== */
type Option = { id: UUID; label: string };
type Warehouse = { id: UUID; code: string; name: string; is_active: boolean };
type Vendor = { id: UUID; name: string; is_active: boolean };
type Part = {
  id: UUID;
  code: string;
  name: string;
  uom_id: UUID;
  is_active: boolean;
};
type Bin = {
  id: UUID;
  warehouse_id: UUID;
  code: string;
  name: string | null;
  is_active: boolean;
};

async function listWarehouses(): Promise<Warehouse[]> {
  const { data, error } = await inv()
    .from('warehouses')
    .select('id,code,name,is_active')
    .eq('is_active', true)
    .order('code', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Warehouse[];
}

async function listVendors(): Promise<Vendor[]> {
  const { data, error } = await inv()
    .from('vendors')
    .select('id,name,is_active')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Vendor[];
}

async function listParts(): Promise<Part[]> {
  const { data, error } = await inv()
    .from('parts')
    .select('id,code,name,uom_id,is_active')
    .eq('is_active', true)
    .order('code', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Part[];
}

async function listBinsByWarehouse(warehouseId: UUID): Promise<Bin[]> {
  const { data, error } = await inv()
    .from('warehouse_bins')
    .select('id,warehouse_id,code,name,is_active')
    .eq('warehouse_id', warehouseId)
    .eq('is_active', true)
    .order('code', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Bin[];
}
/** ========================================================= */

function labelType(t: InventoryDocType) {
  switch (t) {
    case 'RECEIPT':
      return 'Entrada (RECEIPT)';
    case 'ISSUE':
      return 'Salida (ISSUE)';
    case 'TRANSFER':
      return 'Transferencia (TRANSFER)';
    case 'ADJUSTMENT':
      return 'Ajuste (ADJUSTMENT)';
    case 'RETURN':
      return 'Devolución (RETURN)';
  }
}

function statusBadge(status: InventoryDocRow['status']) {
  switch (status) {
    case 'DRAFT':
      return {
        text: 'DRAFT',
        cls: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    case 'POSTED':
      return {
        text: 'POSTED',
        cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      };
    case 'CANCELLED':
      return {
        text: 'CANCELLED',
        cls: 'bg-rose-50 text-rose-800 border-rose-200',
      };
  }
}

function canEditDoc(doc: InventoryDocRow) {
  return doc.status === 'DRAFT';
}

function needsSingleWarehouse(t: InventoryDocType) {
  return (
    t === 'RECEIPT' || t === 'ISSUE' || t === 'RETURN' || t === 'ADJUSTMENT'
  );
}
function needsTransferWarehouses(t: InventoryDocType) {
  return t === 'TRANSFER';
}
function needsVendor(t: InventoryDocType) {
  return t === 'RECEIPT';
}
function needsTicket(t: InventoryDocType) {
  return t === 'ISSUE' || t === 'RETURN';
}

type DocHeaderPatch = Partial<
  Pick<
    InventoryDocRow,
    | 'warehouse_id'
    | 'from_warehouse_id'
    | 'to_warehouse_id'
    | 'ticket_id'
    | 'vendor_id'
    | 'reference'
    | 'notes'
  >
>;

function SectionTitle(props: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-900">{props.title}</div>
        {props.subtitle ? (
          <div className="mt-0.5 text-xs text-gray-500">{props.subtitle}</div>
        ) : null}
      </div>
      {props.right ? <div className="shrink-0">{props.right}</div> : null}
    </div>
  );
}

function Field(props: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700">
        {props.label}
      </label>
      <div className="mt-1">{props.children}</div>
      {props.hint ? (
        <p className="mt-1 text-[11px] text-gray-500">{props.hint}</p>
      ) : null}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-gray-100" />;
}

export default function InventoryDocEditorPage() {
  const { docId } = useParams();
  const nav = useNavigate();
  const { has } = usePermissions();

  const canRead = has('inventory:read');
  const canWrite =
    has('inventory:write') ||
    has('inventory:full_access') ||
    has('inventory:create');

  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<InventoryDocRow | null>(null);
  const [lines, setLines] = useState<InventoryDocLineRow[]>([]);

  // Draft (edición local)
  const [draftDoc, setDraftDoc] = useState<InventoryDocRow | null>(null);
  const [draftLines, setDraftLines] = useState<InventoryDocLineRow[]>([]);
  const [isDirtyHeader, setIsDirtyHeader] = useState(false);
  const [dirtyLineIds, setDirtyLineIds] = useState<Set<UUID>>(new Set());
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const hasDirtyLines = dirtyLineIds.size > 0;
  const hasUnsavedChanges = isDirtyHeader || hasDirtyLines;

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [binsMap, setBinsMap] = useState<Record<string, Bin[]>>({});

  const editable = doc ? canEditDoc(doc) : false;

  const whOptions: Option[] = useMemo(
    () => warehouses.map((w) => ({ id: w.id, label: `${w.code} — ${w.name}` })),
    [warehouses]
  );

  const vendorOptions: Option[] = useMemo(
    () => vendors.map((v) => ({ id: v.id, label: v.name })),
    [vendors]
  );

  const partOptions: Array<Option & { uom_id: UUID }> = useMemo(
    () =>
      parts.map((p) => ({
        id: p.id,
        label: `${p.code} — ${p.name}`,
        uom_id: p.uom_id,
      })),
    [parts]
  );

  function getBinsForWarehouse(warehouseId: UUID | null | undefined): Option[] {
    if (!warehouseId) return [];
    const bins = binsMap[warehouseId] ?? [];
    return bins.map((b) => ({
      id: b.id,
      label: b.name ? `${b.code} — ${b.name}` : b.code,
    }));
  }

  async function ensureBinsLoaded(warehouseId: UUID | null | undefined) {
    if (!warehouseId) return;
    if (binsMap[warehouseId]) return;
    const data = await listBinsByWarehouse(warehouseId);
    setBinsMap((prev) => ({ ...prev, [warehouseId]: data }));
  }

  function patchDraftDoc(patch: DocHeaderPatch) {
    setDraftDoc((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch } as InventoryDocRow;

      // lookups bins (solo UI)
      if (needsSingleWarehouse(next.doc_type)) {
        void ensureBinsLoaded(next.warehouse_id ?? undefined);
      }
      if (needsTransferWarehouses(next.doc_type)) {
        void ensureBinsLoaded(next.from_warehouse_id ?? undefined);
        void ensureBinsLoaded(next.to_warehouse_id ?? undefined);
      }

      return next;
    });
    setIsDirtyHeader(true);
  }

  function patchDraftLine(lineId: UUID, patch: Partial<InventoryDocLineRow>) {
    setDraftLines((prev) =>
      prev.map((l) =>
        l.id === lineId ? ({ ...l, ...patch } as InventoryDocLineRow) : l
      )
    );
    setDirtyLineIds((prev) => {
      const next = new Set(prev);
      next.add(lineId);
      return next;
    });
  }

  async function loadAll() {
    if (!docId) return;
    setLoading(true);
    try {
      const [d, ls, whs, vs, ps] = await Promise.all([
        getInventoryDoc(docId as UUID),
        listInventoryDocLines(docId as UUID),
        listWarehouses(),
        listVendors(),
        listParts(),
      ]);

      setDoc(d);
      setLines(ls);

      // drafts
      setDraftDoc(d);
      setDraftLines(ls);
      setIsDirtyHeader(false);
      setDirtyLineIds(new Set());

      setWarehouses(whs);
      setVendors(vs);
      setParts(ps);

      if (needsSingleWarehouse(d.doc_type)) {
        await ensureBinsLoaded(d.warehouse_id ?? undefined);
      } else if (needsTransferWarehouses(d.doc_type)) {
        await ensureBinsLoaded(d.from_warehouse_id ?? undefined);
        await ensureBinsLoaded(d.to_warehouse_id ?? undefined);
      }
    } catch (error: unknown) {
      showToastError(formatError(error));
      console.error('[InventoryDocEditorPage] error raw:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canRead) return;
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, docId]);

  async function onSaveDraft() {
    if (!doc || !draftDoc) return;
    if (!editable || !canWrite) return;
    if (!hasUnsavedChanges) return;

    setIsSavingDraft(true);
    try {
      // 1) Header
      if (isDirtyHeader) {
        const patch: DocHeaderPatch = {
          warehouse_id: draftDoc.warehouse_id ?? null,
          from_warehouse_id: draftDoc.from_warehouse_id ?? null,
          to_warehouse_id: draftDoc.to_warehouse_id ?? null,
          ticket_id: draftDoc.ticket_id ?? null,
          vendor_id: draftDoc.vendor_id ?? null,
          reference: draftDoc.reference ?? null,
          notes: draftDoc.notes ?? null,
        };
        await updateInventoryDoc(doc.id, patch);
      }

      // 2) Lines (solo dirty)
      if (dirtyLineIds.size > 0) {
        const dirtyIds = Array.from(dirtyLineIds);

        await Promise.all(
          dirtyIds.map(async (id) => {
            const l = draftLines.find((x) => x.id === id);
            if (!l) return;

            // validación mínima
            const qty = Number(l.qty);
            if (!Number.isFinite(qty)) {
              throw new Error(`Qty inválido en línea #${l.line_no}`);
            }

            const unitCost = l.unit_cost === null ? null : Number(l.unit_cost);
            if (unitCost !== null && !Number.isFinite(unitCost)) {
              throw new Error(`Unit cost inválido en línea #${l.line_no}`);
            }

            await updateInventoryDocLine(id, {
              part_id: l.part_id,
              uom_id: l.uom_id,
              qty,
              unit_cost: unitCost,
              from_bin_id: l.from_bin_id ?? null,
              to_bin_id: l.to_bin_id ?? null,
              notes: l.notes ?? null,
            });
          })
        );
      }

      showToastSuccess('Borrador guardado.');
      await loadAll();
    } catch (error: unknown) {
      showToastError(formatError(error));
      console.error('[InventoryDocEditorPage] error raw:', error);
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function onAddLine() {
    if (!doc) return;
    if (!editable || !canWrite) return;

    const nextNo = (lines[lines.length - 1]?.line_no ?? 0) + 1;
    const defaultPart = partOptions[0];
    if (!defaultPart) {
      showToastError('No hay repuestos disponibles para agregar líneas.');
      return;
    }

    const payload: InventoryDocLineInsert = {
      doc_id: doc.id,
      line_no: nextNo,
      part_id: defaultPart.id,
      uom_id: defaultPart.uom_id,
      qty: 1,
      unit_cost: null,
      from_bin_id: null,
      to_bin_id: null,
      notes: null,
    };

    if (doc.doc_type === 'RECEIPT' || doc.doc_type === 'RETURN') {
      const bins = getBinsForWarehouse(doc.warehouse_id);
      payload.to_bin_id = bins[0]?.id ?? null;
    } else if (doc.doc_type === 'ISSUE') {
      const bins = getBinsForWarehouse(doc.warehouse_id);
      payload.from_bin_id = bins[0]?.id ?? null;
    } else if (doc.doc_type === 'TRANSFER') {
      const binsFrom = getBinsForWarehouse(doc.from_warehouse_id);
      const binsTo = getBinsForWarehouse(doc.to_warehouse_id);
      payload.from_bin_id = binsFrom[0]?.id ?? null;
      payload.to_bin_id = binsTo[0]?.id ?? null;
    } else if (doc.doc_type === 'ADJUSTMENT') {
      const bins = getBinsForWarehouse(doc.warehouse_id);
      payload.to_bin_id = bins[0]?.id ?? null;
    }

    try {
      const inserted = await addInventoryDocLines([payload]);

      const merged = (prev: InventoryDocLineRow[]) =>
        [...prev, ...inserted].sort((a, b) => a.line_no - b.line_no);

      setLines(merged);
      setDraftLines(merged);

      showToastSuccess('Línea agregada.');
    } catch (error: unknown) {
      showToastError(formatError(error));
      console.error('[InventoryDocEditorPage] error raw:', error);
    }
  }

  async function onDeleteLine(lineId: UUID) {
    if (!editable || !canWrite) return;
    try {
      await deleteInventoryDocLine(lineId);

      setLines((prev) => prev.filter((l) => l.id !== lineId));
      setDraftLines((prev) => prev.filter((l) => l.id !== lineId));
      setDirtyLineIds((prev) => {
        const next = new Set(prev);
        next.delete(lineId);
        return next;
      });

      showToastSuccess('Línea eliminada.');
    } catch (error: unknown) {
      showToastError(formatError(error));
      console.error('[InventoryDocEditorPage] error raw:', error);
    }
  }

  async function onPost() {
    if (!doc) return;
    if (!editable) return;

    try {
      await postInventoryDoc(doc.id);
      showToastSuccess('Documento posteado.');
      await loadAll();
    } catch (error: unknown) {
      showToastError(formatError(error));
      console.error('[InventoryDocEditorPage] error raw:', error);
    }
  }

  async function onCancel() {
    if (!doc) return;
    if (doc.status !== 'POSTED') return;

    try {
      const revId = await cancelInventoryDoc(doc.id);
      showToastSuccess('Documento cancelado. Reversa generada.');
      nav(`/inventory/docs/${revId}`);
    } catch (error: unknown) {
      showToastError(formatError(error));
      console.error('[InventoryDocEditorPage] error raw:', error);
    }
  }

  async function onDeleteDoc() {
    if (!doc) return;
    if (!editable || !canWrite) return;

    const ok = window.confirm(
      '¿Eliminar este documento DRAFT? (no se puede deshacer)'
    );
    if (!ok) return;

    try {
      await deleteInventoryDoc(doc.id);
      showToastSuccess('Documento eliminado.');
      nav('/inventory/docs');
    } catch (error: unknown) {
      showToastError(formatError(error));
      console.error('[InventoryDocEditorPage] error raw:', error);
    }
  }

  if (!canRead) {
    return (
      <div className="h-screen flex bg-gray-100">
        <Sidebar />
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
          <div className="p-6">
            <div className="rounded-2xl border bg-white p-6 text-sm text-gray-700">
              No tienes permisos para acceder a este módulo.
            </div>
          </div>
        </main>
      </div>
    );
  }

  const badge = doc ? statusBadge(doc.status) : null;

  // Para UI editable usamos draft, pero el estado real (POSTED/CANCELLED) viene de doc
  const uiDoc = draftDoc ?? doc;

  // Bloquea POST si hay cambios sin guardar (flujo simple)
  const postDisabled =
    !canWrite || draftLines.length === 0 || hasUnsavedChanges;

  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />

      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        {/* Top bar */}
        <header className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6">
          <div className="rounded-2xl border bg-white shadow-sm px-4 py-3 md:px-5 md:py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <Link to="/inventory" className="hover:underline">
                    Inventario
                  </Link>
                  <span>/</span>
                  <Link to="/inventory/docs" className="hover:underline">
                    Documentos
                  </Link>
                  <span>/</span>
                  <span className="text-gray-700">Editor</span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                    {doc?.doc_no ? `Documento ${doc.doc_no}` : 'Documento'}
                  </h2>

                  {badge ? (
                    <span
                      className={cx(
                        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
                        badge.cls
                      )}
                    >
                      {badge.text}
                    </span>
                  ) : null}

                  {doc ? (
                    <span className="text-sm text-gray-600">
                      • {labelType(doc.doc_type)}
                    </span>
                  ) : null}

                  {doc?.status === 'DRAFT' && hasUnsavedChanges ? (
                    <span className="text-xs text-amber-700">
                      • Cambios sin guardar
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/inventory/docs"
                  className="h-9 inline-flex items-center rounded-xl border bg-white px-3 text-sm hover:bg-gray-50"
                >
                  ← Volver
                </Link>

                {doc?.reversal_doc_id ? (
                  <Link
                    to={`/inventory/docs/${doc.reversal_doc_id}`}
                    className="h-9 inline-flex items-center rounded-xl border bg-white px-3 text-sm hover:bg-gray-50"
                  >
                    Ver reversa →
                  </Link>
                ) : null}

                {doc?.status === 'DRAFT' ? (
                  <button
                    type="button"
                    onClick={() => void onSaveDraft()}
                    disabled={!canWrite || !hasUnsavedChanges || isSavingDraft}
                    className={cx(
                      'h-9 rounded-xl px-4 text-sm font-medium transition',
                      'bg-gray-900 text-white hover:bg-gray-800',
                      (!canWrite || !hasUnsavedChanges || isSavingDraft) &&
                        'opacity-50 cursor-not-allowed'
                    )}
                    title={
                      !hasUnsavedChanges
                        ? 'No hay cambios por guardar'
                        : 'Guardar borrador'
                    }
                  >
                    {isSavingDraft ? 'Guardando…' : 'Guardar borrador'}
                  </button>
                ) : null}

                {doc?.status === 'DRAFT' ? (
                  <button
                    type="button"
                    onClick={() => void onPost()}
                    disabled={postDisabled}
                    className={cx(
                      'h-9 rounded-xl px-4 text-sm font-medium transition',
                      'bg-emerald-600 text-white hover:bg-emerald-700',
                      postDisabled && 'opacity-50 cursor-not-allowed'
                    )}
                    title={
                      hasUnsavedChanges
                        ? 'Guarda el borrador antes de postear'
                        : draftLines.length === 0
                          ? 'Agrega líneas antes de postear'
                          : 'Post'
                    }
                  >
                    Post
                  </button>
                ) : null}

                {doc?.status === 'POSTED' ? (
                  <button
                    type="button"
                    onClick={() => void onCancel()}
                    disabled={!canWrite}
                    className={cx(
                      'h-9 rounded-xl px-4 text-sm font-medium transition',
                      'bg-rose-600 text-white hover:bg-rose-700',
                      !canWrite && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    Cancelar
                  </button>
                ) : null}

                {doc?.status === 'DRAFT' ? (
                  <button
                    type="button"
                    onClick={() => void onDeleteDoc()}
                    disabled={!canWrite}
                    className={cx(
                      'h-9 rounded-xl border bg-white px-4 text-sm hover:bg-gray-50',
                      !canWrite && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    Eliminar
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <section className="px-4 md:px-6 lg:px-8 py-6 overflow-auto">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            {/* Header card */}
            <div className="xl:col-span-4">
              <div className="rounded-2xl border bg-white shadow-sm">
                <div className="p-4 md:p-5">
                  <SectionTitle
                    title="Header"
                    subtitle={doc ? `Estado: ${doc.status}` : 'Cargando…'}
                  />
                </div>
                <Divider />
                <div className="p-4 md:p-5 space-y-4">
                  {loading && (
                    <div className="text-sm text-gray-500">Cargando…</div>
                  )}

                  {!loading && uiDoc && (
                    <>
                      <Field label="Tipo">
                        <div className="h-10 flex items-center rounded-xl border bg-gray-50 px-3 text-sm font-medium text-gray-900">
                          {labelType(uiDoc.doc_type)}
                        </div>
                      </Field>

                      {needsSingleWarehouse(uiDoc.doc_type) ? (
                        <Field
                          label="Warehouse"
                          hint={`Requerido para ${uiDoc.doc_type} (según tu SQL).`}
                        >
                          <select
                            className="h-10 w-full rounded-xl border px-3 text-sm bg-white"
                            disabled={!editable}
                            value={uiDoc.warehouse_id ?? ''}
                            onChange={(e) =>
                              patchDraftDoc({
                                warehouse_id: (e.target.value ||
                                  null) as UUID | null,
                              })
                            }
                          >
                            <option value="">— Seleccionar —</option>
                            {whOptions.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ) : null}

                      {needsTransferWarehouses(uiDoc.doc_type) ? (
                        <div className="grid grid-cols-1 gap-3">
                          <Field label="From warehouse">
                            <select
                              className="h-10 w-full rounded-xl border px-3 text-sm bg-white"
                              disabled={!editable}
                              value={uiDoc.from_warehouse_id ?? ''}
                              onChange={(e) =>
                                patchDraftDoc({
                                  from_warehouse_id: (e.target.value ||
                                    null) as UUID | null,
                                })
                              }
                            >
                              <option value="">— Seleccionar —</option>
                              {whOptions.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </Field>

                          <Field label="To warehouse">
                            <select
                              className="h-10 w-full rounded-xl border px-3 text-sm bg-white"
                              disabled={!editable}
                              value={uiDoc.to_warehouse_id ?? ''}
                              onChange={(e) =>
                                patchDraftDoc({
                                  to_warehouse_id: (e.target.value ||
                                    null) as UUID | null,
                                })
                              }
                            >
                              <option value="">— Seleccionar —</option>
                              {whOptions.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>
                      ) : null}

                      {needsVendor(uiDoc.doc_type) ? (
                        <Field
                          label="Proveedor"
                          hint="Recomendado para RECEIPT."
                        >
                          <select
                            className="h-10 w-full rounded-xl border px-3 text-sm bg-white"
                            disabled={!editable}
                            value={uiDoc.vendor_id ?? ''}
                            onChange={(e) =>
                              patchDraftDoc({
                                vendor_id: (e.target.value ||
                                  null) as UUID | null,
                              })
                            }
                          >
                            <option value="">— Opcional —</option>
                            {vendorOptions.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ) : null}

                      {needsTicket(uiDoc.doc_type) ? (
                        <Field
                          label="Ticket (WO)"
                          hint="En ISSUE/RETURN tu trigger exige que el ticket esté aceptado."
                        >
                          <input
                            className="h-10 w-full rounded-xl border px-3 text-sm"
                            disabled={!editable}
                            value={uiDoc.ticket_id ?? ''}
                            onChange={(e) => {
                              const v = e.target.value.trim();
                              const n = v.length ? Number(v) : null;
                              patchDraftDoc({
                                ticket_id: Number.isFinite(n) ? n : null,
                              });
                            }}
                            placeholder="Ej: 12345"
                          />
                        </Field>
                      ) : null}

                      <Field label="Referencia">
                        <input
                          className="h-10 w-full rounded-xl border px-3 text-sm"
                          disabled={!editable}
                          value={uiDoc.reference ?? ''}
                          onChange={(e) =>
                            patchDraftDoc({ reference: e.target.value })
                          }
                          placeholder="Factura, nota, motivo…"
                        />
                      </Field>

                      <Field label="Notas">
                        <textarea
                          className="min-h-[120px] w-full rounded-xl border px-3 py-2 text-sm"
                          disabled={!editable}
                          value={uiDoc.notes ?? ''}
                          onChange={(e) =>
                            patchDraftDoc({ notes: e.target.value })
                          }
                          placeholder="Observaciones…"
                        />
                      </Field>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Lines card */}
            <div className="xl:col-span-8">
              <div className="rounded-2xl border bg-white shadow-sm">
                <div className="p-4 md:p-5">
                  <SectionTitle
                    title="Líneas"
                    subtitle="Repuesto / Qty / Bins / Unit cost (según tipo)"
                    right={
                      <button
                        type="button"
                        onClick={() => void onAddLine()}
                        disabled={!editable || !canWrite || !doc}
                        className={cx(
                          'h-9 rounded-xl px-3 text-sm font-medium transition',
                          'bg-gray-900 text-white hover:bg-gray-800',
                          (!editable || !canWrite || !doc) &&
                            'opacity-50 cursor-not-allowed'
                        )}
                      >
                        + Agregar
                      </button>
                    }
                  />
                </div>
                <Divider />

                <div className="p-4 md:p-5">
                  {!doc ? (
                    <div className="text-sm text-gray-500">Cargando…</div>
                  ) : null}

                  {doc && draftLines.length === 0 ? (
                    <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-700">
                      Este documento no tiene líneas. Agrega al menos 1 para
                      poder postear.
                    </div>
                  ) : null}

                  {uiDoc ? (
                    <LinesResponsive
                      doc={uiDoc}
                      editable={editable && canWrite}
                      lines={draftLines}
                      partOptions={partOptions}
                      binsForSingleWarehouse={getBinsForWarehouse(
                        uiDoc.warehouse_id
                      )}
                      binsForFromWarehouse={getBinsForWarehouse(
                        uiDoc.from_warehouse_id
                      )}
                      binsForToWarehouse={getBinsForWarehouse(
                        uiDoc.to_warehouse_id
                      )}
                      onChangeLine={patchDraftLine}
                      onDeleteLine={onDeleteLine}
                    />
                  ) : null}
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-500">
                Regla SQL: ISSUE/TRANSFER validan stock suficiente al postear.
                ADJUSTMENT permite qty +/- (≠0).
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

/** =========================
 *  Lines: Mobile cards + Desktop table
 *  ========================= */
function LinesResponsive(props: {
  doc: InventoryDocRow;
  editable: boolean;
  lines: InventoryDocLineRow[];
  partOptions: Array<Option & { uom_id: UUID }>;
  binsForSingleWarehouse: Option[];
  binsForFromWarehouse: Option[];
  binsForToWarehouse: Option[];
  onChangeLine: (
    lineId: UUID,
    patch: Partial<InventoryDocLineRow>
  ) => Promise<void> | void;
  onDeleteLine: (lineId: UUID) => Promise<void> | void;
}) {
  return (
    <>
      {/* Mobile (cards) */}
      <div className="block lg:hidden space-y-3">
        {props.lines.map((l) => (
          <LineCard key={l.id} {...props} line={l} />
        ))}
      </div>

      {/* Desktop (table) */}
      <div className="hidden lg:block overflow-x-auto">
        <LinesTablePro {...props} />
      </div>
    </>
  );
}

function LineCard(props: {
  doc: InventoryDocRow;
  editable: boolean;
  lines: InventoryDocLineRow[];
  line: InventoryDocLineRow;
  partOptions: Array<Option & { uom_id: UUID }>;
  binsForSingleWarehouse: Option[];
  binsForFromWarehouse: Option[];
  binsForToWarehouse: Option[];
  onChangeLine: (
    lineId: UUID,
    patch: Partial<InventoryDocLineRow>
  ) => Promise<void> | void;
  onDeleteLine: (lineId: UUID) => Promise<void> | void;
}) {
  const {
    doc,
    editable,
    line: l,
    partOptions,
    onChangeLine,
    onDeleteLine,
  } = props;

  const showFromBin = doc.doc_type === 'ISSUE' || doc.doc_type === 'TRANSFER';
  const showToBin =
    doc.doc_type === 'RECEIPT' ||
    doc.doc_type === 'RETURN' ||
    doc.doc_type === 'TRANSFER' ||
    doc.doc_type === 'ADJUSTMENT';
  const showUnitCost = true;

  const binsFrom =
    doc.doc_type === 'TRANSFER'
      ? props.binsForFromWarehouse
      : doc.doc_type === 'ISSUE'
        ? props.binsForSingleWarehouse
        : [];

  const binsTo =
    doc.doc_type === 'TRANSFER'
      ? props.binsForToWarehouse
      : doc.doc_type === 'RECEIPT' ||
          doc.doc_type === 'RETURN' ||
          doc.doc_type === 'ADJUSTMENT'
        ? props.binsForSingleWarehouse
        : [];

  const qtyHint =
    doc.doc_type === 'ADJUSTMENT' ? 'Puede ser +/- (≠0)' : 'Debe ser > 0';

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-gray-900">
          Línea #{l.line_no}
        </div>
        <button
          type="button"
          disabled={!editable}
          onClick={() => void onDeleteLine(l.id)}
          className={cx(
            'h-9 rounded-xl border px-3 text-sm bg-white hover:bg-gray-50',
            !editable && 'opacity-50 cursor-not-allowed'
          )}
        >
          Quitar
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700">
            Repuesto
          </label>
          <select
            className="mt-1 h-10 w-full rounded-xl border px-3 text-sm bg-white"
            disabled={!editable}
            value={l.part_id}
            onChange={(e) => {
              const partId = e.target.value as UUID;
              const p = partOptions.find((x) => x.id === partId);
              void onChangeLine(l.id, {
                part_id: partId,
                uom_id: p?.uom_id ?? l.uom_id,
              });
            }}
          >
            {partOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700">
              Qty
            </label>
            <input
              className="mt-1 h-10 w-full rounded-xl border px-3 text-sm text-right"
              disabled={!editable}
              type="number"
              step="0.001"
              value={Number.isFinite(l.qty) ? l.qty : 0}
              onChange={(e) =>
                void onChangeLine(l.id, { qty: Number(e.target.value) })
              }
            />
            <div className="mt-1 text-[11px] text-gray-500">{qtyHint}</div>
          </div>

          {showUnitCost ? (
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Unit cost
              </label>
              <input
                className="mt-1 h-10 w-full rounded-xl border px-3 text-sm text-right"
                disabled={!editable}
                type="number"
                step="0.0001"
                value={l.unit_cost ?? ''}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  const v = raw.length ? Number(raw) : null;
                  void onChangeLine(l.id, { unit_cost: v });
                }}
                placeholder="auto / avg"
              />
              <div className="mt-1 text-[11px] text-gray-500">
                Si viene null, el post completa.
              </div>
            </div>
          ) : null}
        </div>

        {showFromBin ? (
          <div>
            <label className="block text-xs font-medium text-gray-700">
              From bin
            </label>
            <select
              className="mt-1 h-10 w-full rounded-xl border px-3 text-sm bg-white"
              disabled={!editable}
              value={l.from_bin_id ?? ''}
              onChange={(e) =>
                void onChangeLine(l.id, {
                  from_bin_id: (e.target.value || null) as UUID | null,
                })
              }
            >
              <option value="">— (null) —</option>
              {binsFrom.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {showToBin ? (
          <div>
            <label className="block text-xs font-medium text-gray-700">
              To bin
            </label>
            <select
              className="mt-1 h-10 w-full rounded-xl border px-3 text-sm bg-white"
              disabled={!editable}
              value={l.to_bin_id ?? ''}
              onChange={(e) =>
                void onChangeLine(l.id, {
                  to_bin_id: (e.target.value || null) as UUID | null,
                })
              }
            >
              <option value="">— (null) —</option>
              {binsTo.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label className="block text-xs font-medium text-gray-700">
            Notas
          </label>
          <input
            className="mt-1 h-10 w-full rounded-xl border px-3 text-sm"
            disabled={!editable}
            value={l.notes ?? ''}
            onChange={(e) => void onChangeLine(l.id, { notes: e.target.value })}
            placeholder="Opcional…"
          />
        </div>
      </div>
    </div>
  );
}

function LinesTablePro(props: {
  doc: InventoryDocRow;
  editable: boolean;
  lines: InventoryDocLineRow[];
  partOptions: Array<Option & { uom_id: UUID }>;
  binsForSingleWarehouse: Option[];
  binsForFromWarehouse: Option[];
  binsForToWarehouse: Option[];
  onChangeLine: (
    lineId: UUID,
    patch: Partial<InventoryDocLineRow>
  ) => Promise<void> | void;
  onDeleteLine: (lineId: UUID) => Promise<void> | void;
}) {
  const { doc, editable, lines, partOptions, onChangeLine, onDeleteLine } =
    props;

  const showFromBin = doc.doc_type === 'ISSUE' || doc.doc_type === 'TRANSFER';
  const showToBin =
    doc.doc_type === 'RECEIPT' ||
    doc.doc_type === 'RETURN' ||
    doc.doc_type === 'TRANSFER' ||
    doc.doc_type === 'ADJUSTMENT';

  const binsFrom =
    doc.doc_type === 'TRANSFER'
      ? props.binsForFromWarehouse
      : doc.doc_type === 'ISSUE'
        ? props.binsForSingleWarehouse
        : [];

  const binsTo =
    doc.doc_type === 'TRANSFER'
      ? props.binsForToWarehouse
      : doc.doc_type === 'RECEIPT' ||
          doc.doc_type === 'RETURN' ||
          doc.doc_type === 'ADJUSTMENT'
        ? props.binsForSingleWarehouse
        : [];

  const qtyHint =
    doc.doc_type === 'ADJUSTMENT' ? 'Puede ser +/- (≠0)' : 'Debe ser > 0';

  return (
    <table className="min-w-full text-sm">
      <thead className="bg-gray-50 text-gray-600">
        <tr>
          <th className="text-left font-medium px-3 py-2 w-[72px]">#</th>
          <th className="text-left font-medium px-3 py-2 min-w-[360px]">
            Repuesto
          </th>
          <th className="text-left font-medium px-3 py-2 w-[170px]">Qty</th>
          {showFromBin ? (
            <th className="text-left font-medium px-3 py-2 min-w-[240px]">
              From bin
            </th>
          ) : null}
          {showToBin ? (
            <th className="text-left font-medium px-3 py-2 min-w-[240px]">
              To bin
            </th>
          ) : null}
          <th className="text-left font-medium px-3 py-2 w-[180px]">
            Unit cost
          </th>
          <th className="text-left font-medium px-3 py-2 min-w-[260px]">
            Notas
          </th>
          <th className="px-3 py-2 w-[120px]"></th>
        </tr>
      </thead>

      <tbody className="divide-y bg-white">
        {lines.map((l) => (
          <tr key={l.id} className="align-top hover:bg-gray-50/60">
            <td className="px-3 py-3 text-gray-600">{l.line_no}</td>

            <td className="px-3 py-3">
              <select
                className="h-10 w-full rounded-xl border px-3 text-sm bg-white"
                disabled={!editable}
                value={l.part_id}
                onChange={(e) => {
                  const partId = e.target.value as UUID;
                  const p = partOptions.find((x) => x.id === partId);
                  void onChangeLine(l.id, {
                    part_id: partId,
                    uom_id: p?.uom_id ?? l.uom_id,
                  });
                }}
              >
                {partOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </td>

            <td className="px-3 py-3">
              <div className="flex flex-col gap-1">
                <input
                  className="h-10 w-full rounded-xl border px-3 text-sm text-right"
                  disabled={!editable}
                  type="number"
                  step="0.001"
                  value={Number.isFinite(l.qty) ? l.qty : 0}
                  onChange={(e) =>
                    void onChangeLine(l.id, { qty: Number(e.target.value) })
                  }
                />
                <div className="text-[11px] text-gray-500 leading-4">
                  {qtyHint}
                </div>
              </div>
            </td>

            {showFromBin ? (
              <td className="px-3 py-3">
                <select
                  className="h-10 w-full rounded-xl border px-3 text-sm bg-white"
                  disabled={!editable}
                  value={l.from_bin_id ?? ''}
                  onChange={(e) =>
                    void onChangeLine(l.id, {
                      from_bin_id: (e.target.value || null) as UUID | null,
                    })
                  }
                >
                  <option value="">— (null) —</option>
                  {binsFrom.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </td>
            ) : null}

            {showToBin ? (
              <td className="px-3 py-3">
                <select
                  className="h-10 w-full rounded-xl border px-3 text-sm bg-white"
                  disabled={!editable}
                  value={l.to_bin_id ?? ''}
                  onChange={(e) =>
                    void onChangeLine(l.id, {
                      to_bin_id: (e.target.value || null) as UUID | null,
                    })
                  }
                >
                  <option value="">— (null) —</option>
                  {binsTo.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </td>
            ) : null}

            <td className="px-3 py-3">
              <div className="flex flex-col gap-1">
                <input
                  className="h-10 w-full rounded-xl border px-3 text-sm text-right"
                  disabled={!editable}
                  type="number"
                  step="0.0001"
                  value={l.unit_cost ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    const v = raw.length ? Number(raw) : null;
                    void onChangeLine(l.id, { unit_cost: v });
                  }}
                  placeholder="auto / avg"
                />
                <div className="text-[11px] text-gray-500 leading-4">
                  Si viene null, el post completa.
                </div>
              </div>
            </td>

            <td className="px-3 py-3">
              <input
                className="h-10 w-full rounded-xl border px-3 text-sm"
                disabled={!editable}
                value={l.notes ?? ''}
                onChange={(e) =>
                  void onChangeLine(l.id, { notes: e.target.value })
                }
                placeholder="Opcional…"
              />
            </td>

            <td className="px-3 py-3 text-right">
              <button
                type="button"
                disabled={!editable}
                onClick={() => void onDeleteLine(l.id)}
                className={cx(
                  'h-10 rounded-xl border px-3 text-sm bg-white hover:bg-gray-50',
                  !editable && 'opacity-50 cursor-not-allowed'
                )}
              >
                Quitar
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
