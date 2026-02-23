import { useNavigate } from 'react-router-dom';
import type { InventoryDocRow, UUID } from '../../../../types/inventory';
import {
  docTypeBadgeClass,
  docTypeIcon,
  fmtDate,
  localizeReference,
  labelType,
  statusBadge,
} from './docMeta';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function InventoryDocsTable({ rows }: { rows: InventoryDocRow[] }) {
  const navigate = useNavigate();

  function openDoc(docId: string) {
    navigate(`/inventory/docs/${docId}`);
  }

  return (
    <div className="hidden md:block">
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="h-11 border-b border-slate-200 bg-blue-50/60" />

        <div className="-mt-6 p-4">
          <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="border-b border-slate-200">
                  <th className="text-left font-semibold text-slate-600 px-5 py-3">
                    Documento
                  </th>
                  <th className="text-left font-semibold text-slate-600 px-5 py-3">
                    Tipo
                  </th>
                  <th className="text-left font-semibold text-slate-600 px-5 py-3">
                    Estado
                  </th>
                  <th className="text-left font-semibold text-slate-600 px-5 py-3">
                    Ticket
                  </th>
                  <th className="text-left font-semibold text-slate-600 px-5 py-3">
                    Referencia
                  </th>
                  <th className="text-left font-semibold text-slate-600 px-5 py-3">
                    Creado
                  </th>
                  <th className="text-left font-semibold text-slate-600 px-5 py-3">
                    Publicado
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const status = statusBadge(row.status);
                  const TypeIcon = docTypeIcon(row.doc_type);
                  const label = row.doc_no ?? (row.id as UUID).slice(0, 8);

                  return (
                    <tr
                      key={row.id}
                      role="link"
                      tabIndex={0}
                      aria-label={`Abrir documento ${label}`}
                      onClick={() => openDoc(row.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openDoc(row.id);
                        }
                      }}
                      className="transition cursor-pointer hover:bg-slate-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-inset"
                    >
                      <td className="px-5 py-3">
                        <span className="font-semibold text-slate-900">{label}</span>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {row.doc_no ? (row.id as UUID).slice(0, 8) : '—'}
                        </div>
                      </td>

                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={cx(
                              'inline-flex items-center justify-center h-7 w-7 rounded-lg border',
                              docTypeBadgeClass(row.doc_type)
                            )}
                          >
                            <TypeIcon className="h-4 w-4" />
                          </span>
                          <span className="font-medium text-slate-800">
                            {labelType(row.doc_type)}
                          </span>
                        </span>
                      </td>

                      <td className="px-5 py-3">
                        <span
                          className={cx(
                            'inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-semibold',
                            status.className
                          )}
                        >
                          <span
                            className={cx('h-1.5 w-1.5 rounded-full', status.dot)}
                          />
                          {status.text}
                        </span>
                      </td>

                      <td className="px-5 py-3">
                        {row.ticket_id ?? <span className="text-slate-400">—</span>}
                      </td>

                      <td className="px-5 py-3 max-w-[320px]">
                        <div className="truncate">
                          {localizeReference(row.reference) ?? (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3 text-slate-700">
                        {fmtDate(row.created_at)}
                      </td>
                      <td className="px-5 py-3 text-slate-700">
                        {fmtDate(row.posted_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
