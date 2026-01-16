// src/components/ui/filters/ExportTicketsCsvAdapter.tsx
import ExportCsvButton from '../../common/ExportCsvButton';
import { useCsvExport } from '../../../hooks/useCsvExport';
import {
  fetchTicketsCsv,
  type WorkOrdersFilters, // lo seguimos usando internamente
} from '../../../services/exports/ticketsExportService';

type Props = {
  /** Filtros provenientes del FilterBar (genéricos por vista) */
  filters: Record<string, unknown>;
  /** Clase opcional para estilado del botón */
  pillBtnClassName?: string;
  /** Filtros a fusionar específicamente para la exportación (tienen prioridad) */
  exportMerge?: Record<string, unknown>;
  baseFilename?: string;
};

export default function ExportTicketsCsvAdapter({
  filters,
  pillBtnClassName,
  exportMerge,
  baseFilename = 'mlm_download',
}: Props) {
  const { exportCsv, exporting } = useCsvExport<WorkOrdersFilters>({
    fetcher: async () => {
      // Nota: baseFilters aquí no lo usamos; usamos lo que viene desde FilterBar.
      // Fusionamos: lo que viene del FilterBar + exportMerge (prioridad)
      const merged = {
        ...filters,
        ...(exportMerge ?? {}),
      } as WorkOrdersFilters;
      return fetchTicketsCsv(merged);
    },
    baseFilename,
  });

  return (
    <ExportCsvButton
      onExport={() => exportCsv({} as WorkOrdersFilters)}
      disabled={exporting}
      label="Exportar"
      className={
        pillBtnClassName ??
        ' items-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50 disabled:opacity-60 cursor-pointer'
      }
    />
  );
}
