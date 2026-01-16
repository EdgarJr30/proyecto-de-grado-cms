import type { ReportFilters } from '../../../types/Report';

export default function AgeDistribution({
  filters,
}: {
  filters?: ReportFilters;
}) {
  void filters; // marca como usado sin afectar la ejecución

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <h3 className="text-lg font-semibold mb-1">Distribución Edad de OTs</h3>
      <p className="text-sm text-gray-500">
        Sin datos por ahora. (Vista temporalmente deshabilitada)
      </p>
    </div>
  );
}
