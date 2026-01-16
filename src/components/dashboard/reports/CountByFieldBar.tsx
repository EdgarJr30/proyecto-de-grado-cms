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
  type ChartData,
} from 'chart.js';
import {
  getCountByField,
  toBarChartFromField,
} from '../../../services/reportService';
import type { ReportFilters } from '../../../types/Report';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface Props {
  groupBy: 'location' | 'assignee' | 'requester';
  title: string;
  filters?: ReportFilters; // aquí podemos pasar status para filtrar
}

export default function CountByFieldBar({ groupBy, title, filters }: Props) {
  const [chartData, setChartData] = useState<ChartData<
    'bar',
    (number | [number, number] | null)[],
    unknown
  > | null>(null);

  useEffect(() => {
    (async () => {
      const dto = await getCountByField(groupBy, filters);
      setChartData(toBarChartFromField(dto, 'Tickets aceptados'));
    })();
  }, [groupBy, JSON.stringify(filters)]);

  if (!chartData) return null;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
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
