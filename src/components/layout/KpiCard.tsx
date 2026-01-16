// src/components/dashboard/KpiCard.tsx
import type { ReactNode } from 'react';

type Props = {
  title: string;
  value: string | number;
  subtitle?: string;
  right?: ReactNode; // por si quieres un ícono o delta
};

export default function KpiCard({ title, value, subtitle, right }: Props) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-3xl font-semibold mt-1">{value}</p>
        {subtitle ? (
          <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
        ) : null}
      </div>
      {right}
    </div>
  );
}
