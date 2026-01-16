import TicketForm from "../components/dashboard/ticket/TicketForm";
import Footer from '../components/ui/Footer';

export default function CreateTicketPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Contenido principal con overflow para scroll solo aquí */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <TicketForm />
      </main>
      <Footer />
    </div>
  );
}
