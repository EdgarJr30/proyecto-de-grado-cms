import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import {
  getCountByStatus,
  toBarChartFromStatus,
} from '../../../services/reportService';
import type { ReportFilters } from '../../../types/Report';
import type { ChartData } from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface Props {
  filters?: ReportFilters; // { location?, assignee?, requester?, from?, to? }
}

export default function TicketsByStatusBar({ filters }: Props) {
  const [chartData, setChartData] = useState<ChartData<
    'bar',
    (number | [number, number] | null)[],
    unknown
  > | null>(null);

  useEffect(() => {
    (async () => {
      const dto = await getCountByStatus(filters);
      setChartData(toBarChartFromStatus(dto, 'Tickets aceptados'));
    })();
  }, [JSON.stringify(filters)]); // dependencia estable

  if (!chartData) return null;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <h3 className="text-lg font-semibold mb-3">
        Tickets por estado (aceptados)
      </h3>
      <Bar
        data={chartData}
        options={{
          responsive: true,
          plugins: { legend: { position: 'top' as const } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        }}
      />
    </div>
  );
}
