import type {
  InventoryDocLineRow,
  InventoryDocRow,
  UUID,
} from '../../types/inventory';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type Option = { id: UUID; label: string };

type Props = {
  doc: InventoryDocRow;
  editable: boolean;
  lines: InventoryDocLineRow[];
  partOptions: Array<Option & { uom_id: UUID }>;
  binsForWarehouse: Option[];
  binsForFromWarehouse: Option[];
  binsForToWarehouse: Option[];
  onChangeLine: (lineId: UUID, patch: Partial<InventoryDocLineRow>) => void;
  onRequestDeleteLine: (lineId: UUID) => void;
};

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

function qtyHint(docType: InventoryDocRow['doc_type']) {
  return docType === 'ADJUSTMENT'
    ? 'Puede ser +/- (distinto de 0)'
    : 'Debe ser > 0';
}

export default function DocLinesTableDesktop(props: Props) {
  const { doc, editable, lines, partOptions, onChangeLine } = props;

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

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1100px] w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="w-[56px] px-3 py-3 text-left text-xs font-semibold text-slate-500">
              #
            </th>
            <th
              className="px-3 py-3 text-left text-xs font-semibold text-slate-500"
              style={{ minWidth: 240 }}
            >
              Repuesto
            </th>
            <th
              className="px-3 py-3 text-left text-xs font-semibold text-slate-500"
              style={{ width: 160, minWidth: 160 }}
            >
              Cantidad
            </th>
            {showFromBin ? (
              <th
                className="px-3 py-3 text-left text-xs font-semibold text-slate-500"
                style={{ minWidth: 200 }}
              >
                From bin
              </th>
            ) : null}
            {showToBin ? (
              <th
                className="px-3 py-3 text-left text-xs font-semibold text-slate-500"
                style={{ minWidth: 200 }}
              >
                To bin
              </th>
            ) : null}
            <th
              className="px-3 py-3 text-left text-xs font-semibold text-slate-500"
              style={{ width: 170, minWidth: 170 }}
            >
              Costo unitario
            </th>
            <th
              className="px-3 py-3 text-left text-xs font-semibold text-slate-500"
              style={{ minWidth: 180 }}
            >
              Notas
            </th>
            <th className="w-[90px] px-3 py-3 text-right text-xs font-semibold text-slate-500">
              Acciones
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {lines.map((l) => (
            <tr key={l.id} className="align-top hover:bg-slate-50/50">
              <td className="px-3 py-3">
                <div className="flex items-center justify-center h-6 w-6 rounded-md bg-slate-100 text-xs font-semibold text-slate-600">
                  {l.line_no}
                </div>
              </td>

              <td className="px-3 py-3">
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
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
              </td>

              <td className="px-3 py-3">
                <input
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-right tabular-nums text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={!editable}
                  type="number"
                  step="0.001"
                  value={Number.isFinite(l.qty) ? l.qty : 0}
                  onChange={(e) =>
                    onChangeLine(l.id, { qty: Number(e.target.value) })
                  }
                  placeholder="0"
                />
                <span className="mt-1.5 block text-[10px] text-slate-400">
                  {qtyHint(doc.doc_type)}
                </span>
              </td>

              {showFromBin ? (
                <td className="px-3 py-3">
                  <select
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
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
                </td>
              ) : null}

              {showToBin ? (
                <td className="px-3 py-3">
                  <select
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
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
                </td>
              ) : null}

              <td className="px-3 py-3">
                <input
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-right tabular-nums text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={!editable}
                  type="number"
                  step="0.0001"
                  value={l.unit_cost ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    const v = raw.length ? Number(raw) : null;
                    onChangeLine(l.id, { unit_cost: v });
                  }}
                  placeholder="Auto"
                />
                <span className="mt-1.5 block text-[10px] text-slate-400">
                  Vacío = auto
                </span>
              </td>

              <td className="px-3 py-3">
                <input
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={!editable}
                  value={l.notes ?? ''}
                  onChange={(e) =>
                    onChangeLine(l.id, { notes: e.target.value })
                  }
                  placeholder="Opcional..."
                />
              </td>

              <td className="px-3 py-3 text-right">
                <button
                  type="button"
                  onClick={() => props.onRequestDeleteLine(l.id)}
                  disabled={!editable}
                  className={cx(
                    'h-9 px-3 rounded-md text-xs font-semibold border',
                    editable
                      ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                      : 'border-slate-200 text-slate-400 cursor-not-allowed'
                  )}
                >
                  Quitar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
