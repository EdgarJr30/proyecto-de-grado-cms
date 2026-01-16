// Conversión a CSV (RFC4180-ish) + descarga con BOM UTF-8.

export type CsvHeader =
  | string[]                       // orden explícito (usa las keys como títulos)
  | Record<string, string>;        // { key: "Título visible" }

export type CsvCell = string | number | boolean | null | Date | object;
export type CsvRow = Record<string, CsvCell>;

function escapeCell(v: CsvCell): string {
  if (v === null) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);

  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: CsvRow[], header?: CsvHeader): string {
  if (!rows.length) return '';

  let columns: string[] = [];
  let titles: string[] = [];

  if (!header) {
    const set = new Set<string>();
    rows.forEach(r => Object.keys(r).forEach(k => set.add(k)));
    columns = [...set].sort();
    titles = columns;
  } else if (Array.isArray(header)) {
    columns = header;
    titles = header;
  } else {
    columns = Object.keys(header);
    titles = columns.map(k => header[k]);
  }

  const headerLine = titles.map(escapeCell).join(',');
  const dataLines = rows.map(r => columns.map(col => escapeCell(r[col] ?? '')).join(','));

  return [headerLine, ...dataLines].join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const bom = '\uFEFF'; // Excel-friendly UTF-8
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
