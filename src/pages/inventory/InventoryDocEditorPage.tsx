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

import DocLinesTableDesktop from './DocLinesTableDesktop';
import DocLineCardMobile from './DocLineCardMobile';

import {
  confirmCancelDoc,
  confirmDeleteDoc,
  confirmDeleteLine,
  confirmPostDoc,
} from '../../notifications/inventoryAlerts';

import {
  ChevronRight,
  ArrowLeft,
  Save,
  Send,
  XCircle,
  Trash2,
  Plus,
  FileText,
  Warehouse as WarehouseIcon,
  Truck,
  Hash,
  Link2,
  MessageSquare,
  AlertTriangle,
  Boxes,
  Info,
  CircleDot,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRightLeft,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function SeparatorLite(props: {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}) {
  const o = props.orientation ?? 'horizontal';
  return (
    <div
      className={cx(
        o === 'horizontal' ? 'h-px w-full' : 'w-px h-full',
        'bg-slate-200',
        props.className
      )}
    />
  );
}

/** ===== Lookups ===== */
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

/** ===== helpers ===== */
type DocStatus = InventoryDocRow['status'];

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

function docTypeIcon(t: InventoryDocType) {
  switch (t) {
    case 'RECEIPT':
      return ArrowDownToLine;
    case 'ISSUE':
      return ArrowUpFromLine;
    case 'TRANSFER':
      return ArrowRightLeft;
    case 'ADJUSTMENT':
      return SlidersHorizontal;
    case 'RETURN':
      return RotateCcw;
  }
}

function docTypeBadgeClass(t: InventoryDocType) {
  switch (t) {
    case 'RECEIPT':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'ISSUE':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'TRANSFER':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'ADJUSTMENT':
      return 'bg-violet-50 text-violet-700 border-violet-200';
    case 'RETURN':
      return 'bg-rose-50 text-rose-700 border-rose-200';
  }
}

function statusConfig(status: DocStatus) {
  switch (status) {
    case 'DRAFT':
      return {
        text: 'BORRADOR',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
      };
    case 'POSTED':
      return {
        text: 'POSTEADO',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
      };
    case 'CANCELLED':
      return {
        text: 'CANCELADO',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500',
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

function StatusTimeline({ status }: { status: DocStatus }) {
  const steps = [
    { key: 'DRAFT' as const, label: 'Borrador' },
    { key: 'POSTED' as const, label: 'Posteado' },
  ];
  const currentIdx =
    status === 'CANCELLED' ? -1 : steps.findIndex((s) => s.key === status);

  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => {
        const isActive = i <= currentIdx;
        const isCurrent = s.key === status;
        return (
          <div key={s.key} className="flex items-center gap-2">
            {i > 0 ? (
              <div
                className={cx(
                  'h-[2px] w-8 rounded-full',
                  isActive ? 'bg-blue-600' : 'bg-slate-200'
                )}
              />
            ) : null}
            <div className="flex items-center gap-2">
              <div
                className={cx(
                  'h-2.5 w-2.5 rounded-full',
                  isCurrent
                    ? 'bg-blue-600 ring-2 ring-blue-600/20'
                    : isActive
                      ? 'bg-blue-600'
                      : 'bg-slate-200'
                )}
              />
              <span
                className={cx(
                  'text-xs',
                  isActive ? 'text-slate-700' : 'text-slate-400'
                )}
              >
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 w-32 bg-slate-200 rounded" />
      <div className="h-10 w-full bg-slate-200 rounded" />
      <div className="h-4 w-24 bg-slate-200 rounded" />
      <div className="h-10 w-full bg-slate-200 rounded" />
      <div className="h-4 w-28 bg-slate-200 rounded" />
      <div className="h-24 w-full bg-slate-200 rounded" />
    </div>
  );
}

function EmptyLines() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-slate-100 mb-4">
        <Boxes className="h-7 w-7 text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">Sin líneas</h3>
      <p className="mt-1 text-xs text-slate-500 text-center max-w-xs">
        Este documento no tiene líneas. Agrega al menos 1 para poder postear.
      </p>
    </div>
  );
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

      if (needsSingleWarehouse(next.doc_type))
        void ensureBinsLoaded(next.warehouse_id ?? undefined);
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
      console.error('[InventoryDocEditorPage] loadAll error raw:', error);
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

      if (dirtyLineIds.size > 0) {
        const dirtyIds = Array.from(dirtyLineIds);

        await Promise.all(
          dirtyIds.map(async (id) => {
            const l = draftLines.find((x) => x.id === id);
            if (!l) return;

            const qty = Number(l.qty);
            if (!Number.isFinite(qty))
              throw new Error(`Qty inválido en línea #${l.line_no}`);

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
      console.error('[InventoryDocEditorPage] onSaveDraft error raw:', error);
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
      console.error('[InventoryDocEditorPage] onAddLine error raw:', error);
    }
  }

  async function onDeleteLine(lineId: UUID) {
    if (!editable || !canWrite) return;

    const l = draftLines.find((x) => x.id === lineId);
    const ok = await confirmDeleteLine(l?.line_no);
    if (!ok) return;

    try {
      await deleteInventoryDocLine(lineId);

      setLines((prev) => prev.filter((x) => x.id !== lineId));
      setDraftLines((prev) => prev.filter((x) => x.id !== lineId));
      setDirtyLineIds((prev) => {
        const next = new Set(prev);
        next.delete(lineId);
        return next;
      });

      showToastSuccess('Línea eliminada.');
    } catch (error: unknown) {
      showToastError(formatError(error));
      console.error('[InventoryDocEditorPage] onDeleteLine error raw:', error);
    }
  }

  async function onPost() {
    if (!doc) return;
    if (!editable) return;

    const ok = await confirmPostDoc(doc.doc_no ?? null);
    if (!ok) return;

    try {
      await postInventoryDoc(doc.id);
      showToastSuccess('Documento posteado.');
      await loadAll();
    } catch (error: unknown) {
      showToastError(formatError(error));
      console.error('[InventoryDocEditorPage] onPost error raw:', error);
    }
  }

  async function onCancel() {
    if (!doc) return;
    if (doc.status !== 'POSTED') return;

    const ok = await confirmCancelDoc(doc.doc_no ?? null);
    if (!ok) return;

    try {
      const revId = await cancelInventoryDoc(doc.id);
      showToastSuccess('Documento cancelado. Reversa generada.');
      nav(`/inventory/docs/${revId}`);
    } catch (error: unknown) {
      showToastError(formatError(error));
      console.error('[InventoryDocEditorPage] onCancel error raw:', error);
    }
  }

  async function onDeleteDoc() {
    if (!doc) return;
    if (!editable || !canWrite) return;

    const ok = await confirmDeleteDoc(doc.doc_no ?? null);
    if (!ok) return;

    try {
      await deleteInventoryDoc(doc.id);
      showToastSuccess('Documento eliminado.');
      nav('/inventory/docs');
    } catch (error: unknown) {
      showToastError(formatError(error));
      console.error('[InventoryDocEditorPage] onDeleteDoc error raw:', error);
    }
  }

  if (!canRead) {
    return (
      <div className="h-screen flex bg-slate-50">
        <Sidebar />
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
          <div className="p-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              No tienes permisos para acceder a este módulo.
            </div>
          </div>
        </main>
      </div>
    );
  }

  const uiDoc = draftDoc ?? doc;
  const postDisabled =
    !canWrite || draftLines.length === 0 || hasUnsavedChanges;

  const badge = doc ? statusConfig(doc.status) : null;
  const TypeIcon = doc ? docTypeIcon(doc.doc_type) : FileText;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const totalQty = useMemo(
    () => draftLines.reduce((acc, l) => acc + (Number(l.qty) || 0), 0),
    [draftLines]
  );

  return (
    <div className="h-screen flex bg-slate-50 text-slate-900">
      <Sidebar />

      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        {/* Header */}
        <header className="shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="px-4 md:px-6 lg:px-8 py-4">
            <div className="flex flex-col gap-3">
              <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                <Link to="/inventario" className="hover:text-slate-900">
                  Inventario
                </Link>
                <ChevronRight className="h-3 w-3" />
                <Link to="/inventory/docs" className="hover:text-slate-900">
                  Documentos
                </Link>
                <ChevronRight className="h-3 w-3" />
                <span className="text-slate-900 font-medium">Editor</span>
              </nav>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-blue-50">
                    <TypeIcon className="h-5 w-5 text-blue-700" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-lg md:text-xl font-bold tracking-tight truncate">
                        {doc?.doc_no ?? (loading ? 'Cargando…' : 'Documento')}
                      </h1>

                      {badge ? (
                        <span
                          className={cx(
                            'inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-semibold',
                            badge.className
                          )}
                        >
                          <span
                            className={cx(
                              'h-1.5 w-1.5 rounded-full',
                              badge.dot
                            )}
                          />
                          {badge.text}
                        </span>
                      ) : null}

                      {doc ? (
                        <span
                          className={cx(
                            'inline-flex items-center px-2 py-1 rounded-full border text-[11px] font-medium',
                            docTypeBadgeClass(doc.doc_type)
                          )}
                        >
                          {labelType(doc.doc_type)}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-3 mt-1">
                      {doc ? <StatusTimeline status={doc.status} /> : null}

                      {doc?.status === 'DRAFT' && hasUnsavedChanges ? (
                        <span className="flex items-center gap-1 text-xs text-amber-700">
                          <CircleDot className="h-3 w-3" />
                          Cambios sin guardar
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Link
                    to="/inventory/docs"
                    className="inline-flex items-center h-9 px-3 rounded-md border border-slate-200 bg-white text-sm font-semibold hover:bg-slate-50"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver
                  </Link>

                  {doc?.reversal_doc_id ? (
                    <Link
                      to={`/inventory/docs/${doc.reversal_doc_id}`}
                      className="inline-flex items-center h-9 px-3 rounded-md border border-slate-200 bg-white text-sm font-semibold hover:bg-slate-50"
                    >
                      Ver reversa →
                    </Link>
                  ) : null}

                  {doc?.status === 'DRAFT' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void onSaveDraft()}
                        disabled={
                          !canWrite || !hasUnsavedChanges || isSavingDraft
                        }
                        className={cx(
                          'inline-flex items-center h-9 px-3 rounded-md border text-sm font-semibold',
                          !canWrite || !hasUnsavedChanges || isSavingDraft
                            ? 'border-slate-200 text-slate-400 bg-white cursor-not-allowed'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        )}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {isSavingDraft ? 'Guardando…' : 'Guardar'}
                      </button>

                      <button
                        type="button"
                        onClick={() => void onPost()}
                        disabled={postDisabled}
                        className={cx(
                          'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold',
                          postDisabled
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        )}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Postear
                      </button>

                      <button
                        type="button"
                        onClick={() => void onDeleteDoc()}
                        disabled={!canWrite}
                        className={cx(
                          'inline-flex items-center h-9 px-3 rounded-md border text-sm font-semibold',
                          !canWrite
                            ? 'border-slate-200 text-slate-400 bg-white cursor-not-allowed'
                            : 'border-rose-200 text-rose-700 bg-white hover:bg-rose-50'
                        )}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </button>
                    </>
                  ) : null}

                  {doc?.status === 'POSTED' ? (
                    <button
                      type="button"
                      onClick={() => void onCancel()}
                      disabled={!canWrite}
                      className={cx(
                        'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold',
                        !canWrite
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-rose-600 hover:bg-rose-700 text-white'
                      )}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Body */}
        <section className="flex-1 min-h-0 overflow-auto">
          <div className="px-4 md:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
              {/* LEFT */}
              <div className="xl:col-span-4 space-y-5">
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-blue-700" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">
                          Header del documento
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {doc ? `Estado: ${doc.status}` : 'Cargando…'}
                        </div>
                      </div>
                    </div>

                    {!editable && doc ? (
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        Solo lectura
                      </span>
                    ) : null}
                  </div>

                  <div className="p-5 space-y-4">
                    {loading ? (
                      <LoadingSkeleton />
                    ) : uiDoc ? (
                      <>
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <FileText className="h-3.5 w-3.5" />
                            Tipo de documento
                          </label>
                          <div className="mt-1 h-10 flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold">
                            {labelType(uiDoc.doc_type)}
                          </div>
                        </div>

                        {needsSingleWarehouse(uiDoc.doc_type) ? (
                          <div>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              <WarehouseIcon className="h-3.5 w-3.5" />
                              Warehouse
                            </label>
                            <select
                              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                              disabled={!editable}
                              value={uiDoc.warehouse_id ?? ''}
                              onChange={(e) =>
                                patchDraftDoc({
                                  warehouse_id: (e.target.value ||
                                    null) as UUID | null,
                                })
                              }
                            >
                              <option value="">-- Seleccionar --</option>
                              {whOptions.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                            <p className="mt-1 text-[11px] text-slate-500">
                              Requerido para {uiDoc.doc_type}.
                            </p>
                          </div>
                        ) : null}

                        {needsTransferWarehouses(uiDoc.doc_type) ? (
                          <div className="space-y-3">
                            <div>
                              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <WarehouseIcon className="h-3.5 w-3.5" />
                                From warehouse
                              </label>
                              <select
                                className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                                disabled={!editable}
                                value={uiDoc.from_warehouse_id ?? ''}
                                onChange={(e) =>
                                  patchDraftDoc({
                                    from_warehouse_id: (e.target.value ||
                                      null) as UUID | null,
                                  })
                                }
                              >
                                <option value="">-- Seleccionar --</option>
                                {whOptions.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <WarehouseIcon className="h-3.5 w-3.5" />
                                To warehouse
                              </label>
                              <select
                                className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                                disabled={!editable}
                                value={uiDoc.to_warehouse_id ?? ''}
                                onChange={(e) =>
                                  patchDraftDoc({
                                    to_warehouse_id: (e.target.value ||
                                      null) as UUID | null,
                                  })
                                }
                              >
                                <option value="">-- Seleccionar --</option>
                                {whOptions.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ) : null}

                        {needsVendor(uiDoc.doc_type) ? (
                          <div>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              <Truck className="h-3.5 w-3.5" />
                              Proveedor
                            </label>
                            <select
                              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                              disabled={!editable}
                              value={uiDoc.vendor_id ?? ''}
                              onChange={(e) =>
                                patchDraftDoc({
                                  vendor_id: (e.target.value ||
                                    null) as UUID | null,
                                })
                              }
                            >
                              <option value="">-- Opcional --</option>
                              {vendorOptions.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                            <p className="mt-1 text-[11px] text-slate-500">
                              Recomendado para RECEIPT.
                            </p>
                          </div>
                        ) : null}

                        {needsTicket(uiDoc.doc_type) ? (
                          <div>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              <Hash className="h-3.5 w-3.5" />
                              Ticket (WO)
                            </label>
                            <input
                              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
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
                            <p className="mt-1 text-[11px] text-slate-500">
                              El trigger exige ticket aceptado.
                            </p>
                          </div>
                        ) : null}

                        <SeparatorLite className="my-2" />

                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <Link2 className="h-3.5 w-3.5" />
                            Referencia
                          </label>
                          <input
                            className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                            disabled={!editable}
                            value={uiDoc.reference ?? ''}
                            onChange={(e) =>
                              patchDraftDoc({ reference: e.target.value })
                            }
                            placeholder="Factura, nota, motivo…"
                          />
                        </div>

                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <MessageSquare className="h-3.5 w-3.5" />
                            Notas
                          </label>
                          <textarea
                            className="mt-1 min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                            disabled={!editable}
                            value={uiDoc.notes ?? ''}
                            onChange={(e) =>
                              patchDraftDoc({ notes: e.target.value })
                            }
                            placeholder="Observaciones…"
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Info className="h-4 w-4 text-blue-700" />
                    Reglas del documento
                  </div>
                  <ul className="mt-2 text-xs text-slate-500 space-y-1.5 list-disc pl-5">
                    <li>ISSUE/TRANSFER validan stock al postear.</li>
                    <li>ADJUSTMENT permite qty +/- (distinto de 0).</li>
                    <li>
                      Guarda el borrador antes de postear si hay cambios
                      pendientes.
                    </li>
                  </ul>
                </div>
              </div>

              {/* RIGHT */}
              <div className="xl:col-span-8 space-y-5">
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Boxes className="h-4 w-4 text-blue-700" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">
                          Líneas del documento
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Repuesto / Qty / Bins / Unit cost
                        </div>
                      </div>

                      <SeparatorLite
                        orientation="vertical"
                        className="h-6 mx-1 hidden sm:block"
                      />

                      <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {draftLines.length}{' '}
                        {draftLines.length === 1 ? 'línea' : 'líneas'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => void onAddLine()}
                      disabled={!editable || !canWrite || !doc}
                      className={cx(
                        'inline-flex items-center h-9 px-3 rounded-md text-sm font-semibold',
                        !editable || !canWrite || !doc
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      )}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar línea
                    </button>
                  </div>

                  {loading ? (
                    <div className="p-5 animate-pulse space-y-3">
                      <div className="h-10 bg-slate-200 rounded" />
                      <div className="h-10 bg-slate-200 rounded" />
                      <div className="h-10 bg-slate-200 rounded" />
                    </div>
                  ) : !uiDoc ? (
                    <div className="p-5 text-sm text-slate-500">Cargando…</div>
                  ) : draftLines.length === 0 ? (
                    <EmptyLines />
                  ) : (
                    <>
                      <div className="hidden lg:block">
                        <DocLinesTableDesktop
                          doc={uiDoc}
                          editable={editable && canWrite}
                          lines={draftLines}
                          partOptions={partOptions}
                          binsForWarehouse={getBinsForWarehouse(
                            uiDoc.warehouse_id
                          )}
                          binsForFromWarehouse={getBinsForWarehouse(
                            uiDoc.from_warehouse_id
                          )}
                          binsForToWarehouse={getBinsForWarehouse(
                            uiDoc.to_warehouse_id
                          )}
                          onChangeLine={patchDraftLine}
                          onRequestDeleteLine={(id) => void onDeleteLine(id)}
                        />
                      </div>

                      <div className="block lg:hidden p-4 space-y-3">
                        {draftLines.map((l) => (
                          <DocLineCardMobile
                            key={l.id}
                            doc={uiDoc}
                            editable={editable && canWrite}
                            line={l}
                            partOptions={partOptions}
                            binsForWarehouse={getBinsForWarehouse(
                              uiDoc.warehouse_id
                            )}
                            binsForFromWarehouse={getBinsForWarehouse(
                              uiDoc.from_warehouse_id
                            )}
                            binsForToWarehouse={getBinsForWarehouse(
                              uiDoc.to_warehouse_id
                            )}
                            onChangeLine={patchDraftLine}
                            onRequestDeleteLine={(id) => void onDeleteLine(id)}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {draftLines.length > 0 ? (
                    <div className="px-5 py-3 border-t border-slate-100 bg-white flex items-center justify-between gap-2 text-xs text-slate-500">
                      <p>
                        Total líneas:{' '}
                        <span className="font-semibold text-slate-900">
                          {draftLines.length}
                        </span>
                        {' | '}
                        Qty total:{' '}
                        <span className="font-semibold text-slate-900 tabular-nums">
                          {totalQty.toLocaleString()}
                        </span>
                      </p>

                      {hasUnsavedChanges ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-semibold">
                          <AlertTriangle className="h-3 w-3" />
                          Cambios pendientes
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="text-xs text-slate-500">
                  Regla SQL: ISSUE/TRANSFER validan stock suficiente al postear.
                  ADJUSTMENT permite qty +/- (≠0).
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
