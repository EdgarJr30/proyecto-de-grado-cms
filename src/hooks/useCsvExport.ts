import { useCallback, useState } from 'react';
import { toCsv, downloadCsv, type CsvHeader, type CsvRow } from '../utils/csv';
import {getNowInTimezoneForStorage} from '../utils/formatDate';

export type CsvFetcher<TFilters> = (filters: TFilters) => Promise<{
  rows: CsvRow[];
  header?: CsvHeader;
  filename?: string;
}>;

export function useCsvExport<TFilters>({
  fetcher,
  baseFilename,
}: {
  fetcher: CsvFetcher<TFilters>;
  baseFilename: string;
}) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const exportCsv = useCallback(
    async (filters: TFilters) => {
      setExporting(true);
      setError(null);
      try {
        const { rows, header, filename } = await fetcher(filters);
        const now = getNowInTimezoneForStorage("America/Santo_Domingo");
        const stamp = now.replace(/[-:T]/g, '').slice(0, 12);
        const csv = toCsv(rows, header);
        const base = filename ?? baseFilename;
        downloadCsv(`${stamp}_${base}`, csv);
      } catch (e) {
        setError(e instanceof Error ? e : new Error('Export failed'));
        throw e;
      } finally {
        setExporting(false);
      }
    },
    [fetcher, baseFilename]
  );

  return { exporting, error, exportCsv };
}
