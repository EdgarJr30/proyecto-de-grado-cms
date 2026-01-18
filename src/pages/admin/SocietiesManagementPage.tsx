import Sidebar from '../../components/layout/Sidebar';
import Navbar from '../../components/navigation/Navbar';
import SocietySettingsTable from '../../components/dashboard/society/SocietySettingsTable';
import { useState } from 'react';

export default function SocietiesManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');

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
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Sociedades</h1>
            <p className="text-sm text-gray-500">
              Parametriza el nombre, logo y branding de cada empresa.
            </p>
          </div>
        </header>

        <section className="flex-1 overflow-x-auto px-4 md:px-6 lg:px-8 pt-4 pb-8">
          <SocietySettingsTable
            searchTerm={searchTerm}
            selectedLocation={selectedLocation}
          />
        </section>
      </main>
    </div>
  );
}
