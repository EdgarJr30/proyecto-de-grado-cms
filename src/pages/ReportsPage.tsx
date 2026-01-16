import { useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/navigation/Navbar';
import TicketsByStatusBar from '../components/dashboard/reports/TicketsByStatusBar';
import CountByFieldBar from '../components/dashboard/reports/CountByFieldBar';
import type { ReportFilters } from '../types/Report';

export default function ReportsPage() {
  const [, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');

  // armar filtros comunes
  const filters: ReportFilters = {
    location: selectedLocation || undefined,
    // puedo incluir rango de fechas si tu Navbar lo provee:
    // from: "2025-08-01T00:00:00",
    // to:   "2025-08-31T23:59:59",
  };

  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />
      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <div className="w-full">
          <Navbar
            onSearch={setSearchTerm}
            onFilterLocation={setSelectedLocation}
            selectedLocation={selectedLocation}
          />
        </div>

        <header className="px-4 md:px-6 lg:px-8 pb-0 pt-4 md:pt-6">
          <h2 className="text-3xl font-bold">Informes del sistema</h2>
        </header>

        <section className="px-4 md:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-auto">
          <TicketsByStatusBar filters={filters} />

          {/* Agrupar por location / assignee / requester (con opción de filtrar por status) */}
          <CountByFieldBar
            groupBy="location"
            title="Tickets por ubicación (aceptados)"
            filters={filters}
          />
          <CountByFieldBar
            groupBy="assignee"
            title="Tickets por técnico (aceptados)"
            filters={filters}
          />
          <CountByFieldBar
            groupBy="requester"
            title="Tickets por solicitante (aceptados)"
            filters={filters}
          />
        </section>
      </main>
    </div>
  );
}
