import { useState } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import Navbar from '../../components/navigation/Navbar';
import AnnouncementsTable from '../../components/dashboard/announcements/AnnouncementsTable';

export default function AnnouncementsManagementPage() {
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
          <h2 className="text-3xl font-bold">Anuncios</h2>
          <p className="text-sm text-gray-500 mt-1">
            Mensajes globales (info, warning, danger, success) con vigencia y
            audiencia por roles para mostrarse en toda la plataforma.
          </p>
        </header>

        <section className="flex-1 overflow-x-auto px-4 md:px-6 lg:px-8 pt-4 pb-8">
          <AnnouncementsTable
            searchTerm={searchTerm}
            selectedLocation={selectedLocation}
          />
        </section>
      </main>
    </div>
  );
}
