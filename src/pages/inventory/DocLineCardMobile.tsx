import type {
  InventoryDocLineRow,
  InventoryDocRow,
  UUID,
} from '../../types/inventory';

type Option = { id: UUID; label: string };

function needsFromBin(docType: InventoryDocRow['doc_type']) {
  return docType === 'ISSUE' || docType === 'TRANSFER';
}
function needsToBin(docType: InventoryDocRow['doc_type']) {
  return (
    docType === 'RECEIPT' ||
    docType === 'RETURN' ||
    docType === 'TRANSFER' ||
    docType === 'ADJUSTMENT'
  );
}

export default function DocLineCardMobile(props: {
  doc: InventoryDocRow;
  editable: boolean;
  line: InventoryDocLineRow;
  partOptions: Array<Option & { uom_id: UUID }>;
  binsForWarehouse: Option[];
  binsForFromWarehouse: Option[];
  binsForToWarehouse: Option[];
  onChangeLine: (lineId: UUID, patch: Partial<InventoryDocLineRow>) => void;
  onRequestDeleteLine: (lineId: UUID) => void;
}) {
  const { doc, editable, line: l, partOptions, onChangeLine } = props;

  const showFromBin = needsFromBin(doc.doc_type);
  const showToBin = needsToBin(doc.doc_type);

  const binsFrom =
    doc.doc_type === 'TRANSFER'
      ? props.binsForFromWarehouse
      : doc.doc_type === 'ISSUE'
        ? props.binsForWarehouse
        : [];

  const binsTo =
    doc.doc_type === 'TRANSFER'
      ? props.binsForToWarehouse
      : doc.doc_type === 'RECEIPT' ||
          doc.doc_type === 'RETURN' ||
          doc.doc_type === 'ADJUSTMENT'
        ? props.binsForWarehouse
        : [];

  const qtyHint = doc.doc_type === 'ADJUSTMENT' ? '+/- (≠0)' : '> 0';

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold">
            {l.line_no}
          </div>
          <div className="text-sm font-semibold">Línea #{l.line_no}</div>
        </div>

        <button
          type="button"
          disabled={!editable}
          onClick={() => props.onRequestDeleteLine(l.id)}
          className={`h-8 px-3 rounded-md text-xs font-semibold border ${
            editable
              ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
              : 'border-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          Quitar
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Repuesto
          </label>
          <select
            className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={!editable}
            value={l.part_id}
            onChange={(e) => {
              const partId = e.target.value as UUID;
              const p = partOptions.find((x) => x.id === partId);
              onChangeLine(l.id, {
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
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Qty
            </label>
            <input
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-right tabular-nums text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={!editable}
              type="number"
              step="0.001"
              value={Number.isFinite(l.qty) ? l.qty : 0}
              onChange={(e) =>
                onChangeLine(l.id, { qty: Number(e.target.value) })
              }
            />
            <div className="mt-1 text-[10px] text-slate-400">{qtyHint}</div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Unit cost
            </label>
            <input
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-right tabular-nums text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={!editable}
              type="number"
              step="0.0001"
              value={l.unit_cost ?? ''}
              onChange={(e) => {
                const raw = e.target.value.trim();
                const v = raw.length ? Number(raw) : null;
                onChangeLine(l.id, { unit_cost: v });
              }}
              placeholder="auto"
            />
            <div className="mt-1 text-[10px] text-slate-400">vacío = auto</div>
          </div>
        </div>

        {showFromBin ? (
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              From bin
            </label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={!editable}
              value={l.from_bin_id ?? ''}
              onChange={(e) =>
                onChangeLine(l.id, {
                  from_bin_id: (e.target.value || null) as UUID | null,
                })
              }
            >
              <option value="">{'-- Sin asignar --'}</option>
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
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              To bin
            </label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={!editable}
              value={l.to_bin_id ?? ''}
              onChange={(e) =>
                onChangeLine(l.id, {
                  to_bin_id: (e.target.value || null) as UUID | null,
                })
              }
            >
              <option value="">{'-- Sin asignar --'}</option>
              {binsTo.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Notas
          </label>
          <input
            className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={!editable}
            value={l.notes ?? ''}
            onChange={(e) => onChangeLine(l.id, { notes: e.target.value })}
            placeholder="Opcional..."
          />
        </div>
      </div>
    </div>
  );
}
