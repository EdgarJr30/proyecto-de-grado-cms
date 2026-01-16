import { useEffect, useState } from 'react';
import { getPublicAnnouncements } from '../../services/announcementService';
import type { Announcement } from '../../types/Announcements';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function GlobalAnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await getPublicAnnouncements({
        orderBy: 'starts_at',
        ascending: false,
        limit: 5,
      });
      if (data) {
        // Solo activos y no expirados
        const now = new Date();
        const visibles = data.filter(
          (a) =>
            a.is_active &&
            (!a.starts_at || new Date(a.starts_at) <= now) &&
            (!a.ends_at || new Date(a.ends_at) >= now)
        );
        setAnnouncements(visibles);
      }
    }
    load();
  }, []);

  // Rotación automática
  useEffect(() => {
    if (announcements.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 6000); // cada 6 segundos
    return () => clearInterval(interval);
  }, [announcements]);

  const current = announcements[currentIndex];

  const handleDismiss = (id: number) => {
    setDismissedIds((prev) => [...prev, id]);
  };

  if (!current || dismissedIds.includes(current.id)) return null;

  const colorMap: Record<string, string> = {
    info: 'bg-sky-50 text-sky-900 border-sky-200',
    warning: 'bg-amber-50 text-amber-900 border-amber-200',
    danger: 'bg-rose-50 text-rose-900 border-rose-200',
    success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  };

  const levelClass = colorMap[current.level] ?? colorMap.info;

  return (
    <div className="w-full overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className={`w-full border-b flex items-center justify-center gap-3 px-4 py-2 text-sm ${levelClass}`}
        >
          <div className="flex items-center gap-2">
            <strong className="uppercase font-medium">
              {current.level === 'warning'
                ? '⚠️ Aviso'
                : current.level === 'danger'
                ? '🚨 Importante'
                : current.level === 'success'
                ? '✅ Éxito'
                : '📢 Información'}
            </strong>
            {current.url ? (
              <a
                href={current.url}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:opacity-80 transition-opacity"
              >
                {current.message}
              </a>
            ) : (
              <span>{current.message}</span>
            )}
          </div>
          {current.dismissible && (
            <button
              onClick={() => handleDismiss(current.id)}
              className="ml-2 hover:opacity-75 transition-opacity"
              aria-label="Cerrar anuncio"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
