import { Link } from 'react-router-dom';
import type { InventoryDocRow, UUID } from '../../../../types/inventory';
import {
  docTypeBadgeClass,
  docTypeIcon,
  fmtDate,
  statusBadge,
} from './docMeta';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function InventoryDocsMobileList({
  rows,
}: {
  rows: InventoryDocRow[];
}) {
  return (
    <div className="md:hidden space-y-3">
      {rows.map((row) => {
        const status = statusBadge(row.status);
        const TypeIcon = docTypeIcon(row.doc_type);

        return (
          <div
            key={row.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  to={`/inventory/docs/${row.id}`}
                  className="text-sm font-semibold text-slate-900 hover:underline"
                >
                  {row.doc_no ?? (row.id as UUID).slice(0, 8)}
                </Link>
                <div className="mt-1 text-xs text-slate-500">
                  {row.reference ?? 'Sin referencia'}
                </div>
              </div>

              <span
                className={cx(
                  'inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-semibold',
                  status.className
                )}
              >
                <span className={cx('h-1.5 w-1.5 rounded-full', status.dot)} />
                {status.text}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="inline-flex items-center gap-2 text-slate-700">
                <span
                  className={cx(
                    'inline-flex items-center justify-center h-6 w-6 rounded-md border',
                    docTypeBadgeClass(row.doc_type)
                  )}
                >
                  <TypeIcon className="h-3.5 w-3.5" />
                </span>
                {row.doc_type}
              </div>

              <div className="text-slate-500 text-right">
                Ticket: {row.ticket_id ?? '-'}
              </div>

              <div className="text-slate-500">Creado: {fmtDate(row.created_at)}</div>
              <div className="text-slate-500 text-right">
                Posteado: {fmtDate(row.posted_at)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
