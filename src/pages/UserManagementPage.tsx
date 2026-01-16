import { useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/navigation/Navbar';
import UsersTable from '../components/dashboard/users/UsersTable';

export default function UserManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');

  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />
      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <div className="w-full">
          {/* Navbar y búsqueda */}
          <Navbar
            onSearch={setSearchTerm}
            onFilterLocation={setSelectedLocation}
            selectedLocation={selectedLocation}
          />
        </div>

        <header className="px-4 md:px-6 lg:px-8 pb-0 pt-4 md:pt-6">
          <h2 className="text-3xl font-bold">Usuarios</h2>
        </header>

        <section className="flex-1 overflow-x-auto px-4 md:px-6 lg:px-8 pt-4 pb-8">
          <UsersTable
            searchTerm={searchTerm}
            selectedLocation={selectedLocation}
          />
        </section>
      </main>
    </div>
  );
}
