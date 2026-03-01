import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, Circle, Search } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../utils/cn';
import {
  listNotificationInbox,
  type NotificationCategory,
  type NotificationFilter,
  type NotificationItem,
} from '../../services/notificationCenterService';

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  ticket: 'Ticket',
  sistema: 'Sistema',
  inventario: 'Inventario',
};

function formatRelativeTime(dateValue: string) {
  const now = Date.now();
  const date = new Date(dateValue).getTime();
  const deltaSeconds = Math.round((date - now) / 1000);
  const absSeconds = Math.abs(deltaSeconds);
  const formatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

  if (absSeconds < 60) return formatter.format(deltaSeconds, 'second');
  if (absSeconds < 3600) return formatter.format(Math.round(deltaSeconds / 60), 'minute');
  if (absSeconds < 86400) return formatter.format(Math.round(deltaSeconds / 3600), 'hour');
  return formatter.format(Math.round(deltaSeconds / 86400), 'day');
}

export default function NotificationCenterMenu() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>('pending');
  const [query, setQuery] = useState('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    let isMounted = true;
    const bootstrap = async () => {
      const inbox = await listNotificationInbox();
      if (!isMounted) return;
      setNotifications(inbox);
    };

    void bootstrap();
    return () => {
      isMounted = false;
    };
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((item) => item.status === 'unread').length,
    [notifications]
  );
  const readCount = notifications.length - unreadCount;

  const filteredNotifications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return notifications
      .filter((item) => {
        if (filter === 'pending' && item.status !== 'unread') return false;
        if (filter === 'read' && item.status !== 'read') return false;
        if (!normalizedQuery) return true;
        return (
          item.title.toLowerCase().includes(normalizedQuery) ||
          item.message.toLowerCase().includes(normalizedQuery) ||
          CATEGORY_LABEL[item.category].toLowerCase().includes(normalizedQuery)
        );
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'unread' ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [filter, notifications, query]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const markAsRead = (id: string) => {
    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        if (item.status === 'read') return item;
        return { ...item, status: 'read', readAt };
      })
    );
  };

  const markAsUnread = (id: string) => {
    setNotifications((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        if (item.status === 'unread') return item;
        return { ...item, status: 'unread', readAt: null };
      })
    );
  };

  const markAllAsRead = () => {
    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((item) =>
        item.status === 'unread' ? { ...item, status: 'read', readAt } : item
      )
    );
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Centro de notificaciones"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-5 text-white shadow">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Panel de notificaciones"
            initial={
              prefersReducedMotion
                ? { opacity: 1, y: 0, scale: 1 }
                : { opacity: 0, y: -6, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 1, y: 0, scale: 1 }
                : { opacity: 0, y: -6, scale: 0.98 }
            }
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
            }
            className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-1rem))] origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-2 px-2 pb-2 pt-1">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Notificaciones
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {unreadCount} pendientes, {readCount} leidas
                </p>
              </div>
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-indigo-700 transition enabled:hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-indigo-300 dark:enabled:hover:bg-indigo-500/15"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas
              </button>
            </div>

            <div className="mb-2 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {[
                { id: 'pending', label: `Pendientes (${unreadCount})` },
                { id: 'read', label: `Leidas (${readCount})` },
                { id: 'all', label: `Todas (${notifications.length})` },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id as NotificationFilter)}
                  className={cn(
                    'rounded-lg px-2 py-1 text-[11px] font-semibold transition',
                    filter === item.id
                      ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <label className="mb-2 flex items-center gap-2 rounded-xl border border-slate-200 px-2 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500 dark:border-slate-700">
              <Search className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por titulo, mensaje o tipo"
                className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
              />
            </label>

            <ul className="max-h-80 space-y-1 overflow-y-auto pr-1">
              {filteredNotifications.length === 0 ? (
                <li className="rounded-xl border border-dashed border-slate-300 px-3 py-5 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No hay notificaciones para este filtro.
                </li>
              ) : (
                filteredNotifications.map((item) => (
                  <li
                    key={item.id}
                    className={cn(
                      'rounded-xl border px-3 py-2 transition',
                      item.status === 'unread'
                        ? 'border-indigo-100 bg-indigo-50/70 dark:border-indigo-500/25 dark:bg-indigo-500/10'
                        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                    )}
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {CATEGORY_LABEL[item.category]} ·{' '}
                          {formatRelativeTime(item.createdAt)}
                        </p>
                      </div>
                      <Circle
                        className={cn(
                          'mt-0.5 h-2.5 w-2.5 shrink-0',
                          item.status === 'unread'
                            ? 'fill-rose-500 text-rose-500'
                            : 'fill-slate-300 text-slate-300 dark:fill-slate-600 dark:text-slate-600'
                        )}
                      />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{item.message}</p>
                    <div className="mt-2 flex justify-end">
                      {item.status === 'unread' ? (
                        <button
                          type="button"
                          onClick={() => markAsRead(item.id)}
                          className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-600 dark:text-indigo-300 dark:hover:text-indigo-200"
                        >
                          Marcar leida
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => markAsUnread(item.id)}
                          className="text-[11px] font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100"
                        >
                          Marcar pendiente
                        </button>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
