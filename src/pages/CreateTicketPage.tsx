import TicketForm from "../components/dashboard/ticket/TicketForm";
import Footer from '../components/ui/Footer';
import Sidebar from '../components/layout/Sidebar';

export default function CreateTicketPage() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex min-w-0 flex-1 h-[100dvh] flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <TicketForm />
        </div>
        <Footer />
      </main>
    </div>
  );
}
