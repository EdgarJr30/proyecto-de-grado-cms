import { useEffect, useState } from 'react';
import { getSession } from '../utils/auth';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/navigation/Navbar';
import { getTicketsByUserId } from '../services/ticketService';
import {
  getPublicImageUrl,
  getTicketImagePaths,
} from '../services/storageService';
import type { Ticket } from '../types/Ticket';

export default function MyTicketsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  // 1) Solo obtiene el userId de la sesión
  useEffect(() => {
    (async () => {
      const { data } = await getSession();
      const id = data.session?.user?.id ?? null; // UUID de auth.users
      setUserId(id);
    })();
  }, []);

  // 2) Carga los tickets cuando tenemos userId y/o cambia el filtro de ubicación
  useEffect(() => {
    (async () => {
      if (!userId) {
        setTickets([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const rows = await getTicketsByUserId(userId);
        setTickets(rows);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, selectedLocation]);

  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />
      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <div className="w-full">
          <Navbar
            onSearch={() => {}}
            onFilterLocation={setSelectedLocation}
            selectedLocation={selectedLocation}
          />
        </div>

        <header className="px-4 md:px-6 lg:px-8 pb-0 pt-4 md:pt-6">
          <h2 className="text-3xl font-bold">Mis Tickets</h2>
        </header>

        <section className="flex-1 overflow-x-hidden px-4 md:px-6 lg:px-8 pt-4 pb-8">
          {loading ? (
            <p className="text-gray-500">Cargando tickets...</p>
          ) : tickets.length === 0 ? (
            <p className="text-gray-500">No tienes tickets creados.</p>
          ) : (
            <div className="space-y-6 max-w-4xl mx-auto">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="border border-gray-200 bg-white shadow-sm rounded-lg overflow-hidden"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border-b border-gray-200">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 wrap-anywhere">
                        {ticket.title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Creado el{' '}
                        {ticket.created_at
                          ? new Date(
                              ticket.created_at as unknown as string
                            ).toLocaleDateString('es-DO')
                          : '—'}
                      </p>
                    </div>
                    <div className="mt-2 md:mt-0 flex gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded text-xs font-medium border">
                        {ticket.priority}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-medium border">
                        {ticket.status}
                      </span>
                      {ticket.is_urgent && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                          Urgente
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Imágenes (bucket) */}
                  {ticket.image &&
                    (() => {
                      const imagePaths = getTicketImagePaths(ticket.image);
                      if (imagePaths.length === 0) return null;
                      return (
                        <div className="flex gap-2 p-4 overflow-x-auto">
                          {imagePaths.map((path, idx) => (
                            <img
                              key={idx}
                              src={getPublicImageUrl(path)}
                              alt={`Adjunto ${idx + 1}`}
                              className="h-32 w-auto rounded border"
                            />
                          ))}
                        </div>
                      );
                    })()}

                  {/* Detalles */}
                  <div className="p-4 space-y-2 text-sm text-gray-700">
                    <p>
                      <strong>Descripción:</strong>{' '}
                      <span className="wrap-anywhere">
                        {ticket.description}
                      </span>
                    </p>
                    <p>
                      <strong>Ubicación:</strong>{' '}
                      <span className="wrap-anywhere">{ticket.location}</span>
                    </p>
                    <p>
                      <strong>Solicitante:</strong> {ticket.requester}
                    </p>
                    <p>
                      <strong>Teléfono:</strong>{' '}
                      {ticket.phone || 'No especificado'}
                    </p>
                    <p>
                      <strong>Fecha incidente:</strong> {ticket.incident_date}
                    </p>
                    {ticket.deadline_date && (
                      <p>
                        <strong>Fecha límite:</strong> {ticket.deadline_date}
                      </p>
                    )}
                    {ticket.comments && (
                      <p>
                        <strong>Comentarios:</strong>{' '}
                        <span className="wrap-anywhere">{ticket.comments}</span>
                      </p>
                    )}
                    <p>
                      <strong>ID:</strong> {ticket.id}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
