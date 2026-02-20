import type { ReactNode } from 'react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export interface ReportTableColumn<T> {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  render: (row: T) => ReactNode;
}

interface ReportTableProps<T> {
  columns: ReportTableColumn<T>[];
  rows: T[];
  emptyText?: string;
}

export default function ReportTable<T>({
  columns,
  rows,
  emptyText = 'Sin registros.',
}: ReportTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-gray-50 px-3 py-4 text-sm text-gray-500">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-xl border">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cx(
                  'px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600',
                  column.align === 'right'
                    ? 'text-right'
                    : column.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t hover:bg-gray-50/60">
              {columns.map((column) => (
                <td
                  key={`${column.key}-${rowIndex}`}
                  className={cx(
                    'px-3 py-2 text-gray-700',
                    column.align === 'right'
                      ? 'text-right'
                      : column.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
