import Sidebar from '../../components/layout/Sidebar';
import Navbar from '../../components/navigation/Navbar';
import RoleEditor from '../../components/dashboard/roles/RoleEditor';

export default function RoleEditPage() {
  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />
      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <Navbar
          onSearch={() => {}}
          onFilterLocation={() => {}}
          selectedLocation=""
        />
        <section className="flex-1 overflow-x-auto px-4 md:px-6 lg:px-8 pt-6 pb-8">
          <RoleEditor />
        </section>
      </main>
    </div>
  );
}
