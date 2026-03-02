import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCheck, Circle, ExternalLink, Search, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { cn } from '../../utils/cn';
import {
  getUnreadNotificationsCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  markNotificationsSeen,
  subscribeToMyNotificationDeliveries,
  type NotificationCategory,
  type NotificationItem,
} from '../../services/notificationCenterService';
import { showToastError } from '../../notifications';
import SwipeableNotificationCard from '../notifications/SwipeableNotificationCard';

type NotificationFilter = 'pending' | 'read' | 'all';
const MENU_PAGE_SIZE = 12;
const UNREAD_REFRESH_INTERVAL_MS = 15000;

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  assignments: 'Asignaciones',
  comments: 'Comentarios',
  status_changes: 'Cambios de estado',
  deadlines: 'Vencimientos',
  admin_system: 'Admin/Sistema',
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
  const { profile } = useUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>('pending');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [panelPage, setPanelPage] = useState(0);
  const [panelTotal, setPanelTotal] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const desktopPanelRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);
  const panelPageRef = useRef(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    panelPageRef.current = panelPage;
  }, [panelPage]);

  const refreshUnreadTotal = useCallback(async () => {
    try {
      const unread = await getUnreadNotificationsCount();
      setUnreadTotal(unread);
    } catch {
      // Silent fallback refresh to avoid noisy toasts on background polling.
    }
  }, []);

  const loadPanelPage = useCallback(async (pageToLoad: number) => {
    setLoading(true);
    try {
      const offset = Math.max(0, pageToLoad * MENU_PAGE_SIZE);
      const [feed, unread] = await Promise.all([
        listNotifications({ scope: 'all', offset, limit: MENU_PAGE_SIZE }),
        getUnreadNotificationsCount(),
      ]);
      setNotifications(feed.items);
      setPanelTotal(feed.total);
      setPanelPage(pageToLoad);
      setUnreadTotal(unread);

      const unseenIds = feed.items
        .filter((item) => item.seenAt === null)
        .map((item) => item.deliveryId);
      if (unseenIds.length > 0) {
        void markNotificationsSeen(unseenIds).catch(() => undefined);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudieron cargar las notificaciones.';
      showToastError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPanelPage(0);
  }, [loadPanelPage]);

  useEffect(() => {
    if (!profile?.id) return;
    const unsubscribe = subscribeToMyNotificationDeliveries(profile.id, () => {
      void refreshUnreadTotal();
      if (openRef.current) {
        void loadPanelPage(panelPageRef.current);
      }
    });
    return () => unsubscribe();
  }, [loadPanelPage, profile?.id, refreshUnreadTotal]);

  useEffect(() => {
    if (!open) return;
    void loadPanelPage(0);
  }, [loadPanelPage, open]);

  useEffect(() => {
    if (!profile?.id) return;
    if (typeof window === 'undefined') return;

    const refreshFromForeground = () => {
      if (document.visibilityState !== 'visible') return;
      void refreshUnreadTotal();
      if (open) {
        void loadPanelPage(panelPage);
      }
    };

    const refreshWhenOnline = () => {
      void refreshUnreadTotal();
      if (open) {
        void loadPanelPage(panelPage);
      }
    };

    window.addEventListener('focus', refreshFromForeground);
    window.addEventListener('online', refreshWhenOnline);
    document.addEventListener('visibilitychange', refreshFromForeground);

    return () => {
      window.removeEventListener('focus', refreshFromForeground);
      window.removeEventListener('online', refreshWhenOnline);
      document.removeEventListener('visibilitychange', refreshFromForeground);
    };
  }, [loadPanelPage, open, panelPage, profile?.id, refreshUnreadTotal]);

  useEffect(() => {
    if (!profile?.id) return;
    if (typeof window === 'undefined') return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void refreshUnreadTotal();
    }, UNREAD_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [profile?.id, refreshUnreadTotal]);

  useEffect(() => {
    if (!profile?.id) return;
    if (typeof navigator === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'object' || event.data === null) return;
      const eventType = (event.data as { type?: string }).type;
      if (eventType !== 'notification:push_received') return;

      void refreshUnreadTotal();
      if (open) {
        void loadPanelPage(panelPage);
      }
    };

    navigator.serviceWorker.addEventListener('message', onServiceWorkerMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', onServiceWorkerMessage);
    };
  }, [loadPanelPage, open, panelPage, profile?.id, refreshUnreadTotal]);

  useEffect(() => {
    if (!open) return;
    if (typeof window === 'undefined') return;

    const desktopMedia = window.matchMedia('(min-width: 768px)');
    if (!desktopMedia.matches) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const clickedTrigger = triggerRef.current?.contains(target);
      const clickedDesktopPanel = desktopPanelRef.current?.contains(target);
      const clickedMobilePanel = mobilePanelRef.current?.contains(target);
      if (clickedTrigger || clickedDesktopPanel || clickedMobilePanel) return;
      setOpen(false);
    };

    document.addEventListener('pointerdown', onOutsidePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', onOutsidePointerDown, true);
    };
  }, [open]);

  const unreadCountGlobal = unreadTotal;
  const allCountGlobal = panelTotal;
  const readCountGlobal = Math.max(0, allCountGlobal - unreadCountGlobal);
  const panelTotalPages = Math.max(1, Math.ceil(panelTotal / MENU_PAGE_SIZE));
  const canGoPrevPage = panelPage > 0;
  const canGoNextPage = panelPage + 1 < panelTotalPages;

  const filteredNotifications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return notifications
      .filter((item) => {
        if (filter === 'pending' && item.readAt !== null) return false;
        if (filter === 'read' && item.readAt === null) return false;
        if (!normalizedQuery) return true;
        return (
          item.title.toLowerCase().includes(normalizedQuery) ||
          item.message.toLowerCase().includes(normalizedQuery) ||
          item.eventType.toLowerCase().includes(normalizedQuery) ||
          CATEGORY_LABEL[item.category].toLowerCase().includes(normalizedQuery)
        );
      })
      .sort((a, b) => {
        if (Boolean(a.readAt) !== Boolean(b.readAt)) return a.readAt ? 1 : -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [filter, notifications, query]);

  const markAsRead = useCallback(async (deliveryId: string) => {
    try {
      await markNotificationRead(deliveryId);
      const now = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) =>
          item.deliveryId === deliveryId ? { ...item, readAt: now, seenAt: now } : item
        )
      );
      setUnreadTotal((current) => Math.max(0, current - 1));
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar la notificación.';
      showToastError(message);
    }
  }, []);

  const markAsUnread = useCallback(async (deliveryId: string) => {
    try {
      await markNotificationUnread(deliveryId);
      setNotifications((current) =>
        current.map((item) =>
          item.deliveryId === deliveryId ? { ...item, readAt: null } : item
        )
      );
      setUnreadTotal((current) => current + 1);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar la notificación.';
      showToastError(message);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) =>
          item.readAt ? item : { ...item, readAt, seenAt: item.seenAt ?? readAt }
        )
      );
      setUnreadTotal(0);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo marcar todo como leído.';
      showToastError(message);
    }
  }, []);

  const openNotification = useCallback(
    async (item: NotificationItem) => {
      if (!item.readAt) {
        await markAsRead(item.deliveryId);
      }
      setOpen(false);
      navigate(item.url);
    },
    [markAsRead, navigate]
  );

  const handlePrevPage = useCallback(async () => {
    if (!canGoPrevPage || loading) return;
    await loadPanelPage(panelPage - 1);
  }, [canGoPrevPage, loadPanelPage, loading, panelPage]);

  const handleNextPage = useCallback(async () => {
    if (!canGoNextPage || loading) return;
    await loadPanelPage(panelPage + 1);
  }, [canGoNextPage, loadPanelPage, loading, panelPage]);

  const panelBody = (
    <div className="flex min-h-0 w-full flex-col">
      <div className="flex items-start justify-between gap-2 px-2 pb-2 pt-1">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Notificaciones
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {unreadCountGlobal} pendientes, {readCountGlobal} leídas
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void markAllAsRead()}
            disabled={unreadCountGlobal === 0}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-indigo-700 transition enabled:hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-indigo-300 dark:enabled:hover:bg-indigo-500/15"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Marcar todas
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar notificaciones"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 md:hidden dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-2 px-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            navigate('/notificaciones');
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir centro de notificaciones
        </button>
      </div>

      <div className="mb-2 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {[
          { id: 'pending', label: `Pendientes (${unreadCountGlobal})` },
          { id: 'read', label: `Leídas (${readCountGlobal})` },
          { id: 'all', label: `Todas (${allCountGlobal})` },
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
          placeholder="Buscar por título, mensaje o tipo"
          className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
        />
      </label>

      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {loading ? (
          <li className="rounded-xl border border-dashed border-slate-300 px-3 py-5 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Cargando...
          </li>
        ) : filteredNotifications.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-300 px-3 py-5 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No hay notificaciones para este filtro.
          </li>
        ) : (
          filteredNotifications.map((item) => (
            <li
              key={item.deliveryId}
            >
              <SwipeableNotificationCard
                isRead={item.readAt !== null}
                onOpen={() => void openNotification(item)}
                onMarkRead={() => markAsRead(item.deliveryId)}
                onMarkUnread={() => markAsUnread(item.deliveryId)}
                className={cn(
                  'rounded-xl border px-3 py-2',
                  item.readAt === null
                    ? 'border-indigo-100 bg-indigo-50/70 dark:border-indigo-500/25 dark:bg-indigo-500/10'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                )}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </p>
                  </div>
                  <Circle
                    className={cn(
                      'mt-0.5 h-2.5 w-2.5 shrink-0',
                      item.readAt === null
                        ? 'fill-rose-500 text-rose-500'
                        : 'fill-slate-300 text-slate-300 dark:fill-slate-600 dark:text-slate-600'
                    )}
                  />
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">{item.message}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {CATEGORY_LABEL[item.category]} · {formatRelativeTime(item.createdAt)}
                  </p>
                  {item.readAt === null ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void markAsRead(item.deliveryId);
                      }}
                      className="shrink-0 rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-200 dark:hover:bg-indigo-500/25"
                    >
                      Marcar leída
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void markAsUnread(item.deliveryId);
                      }}
                      className="shrink-0 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/25"
                    >
                      Marcar no leída
                    </button>
                  )}
                </div>
              </SwipeableNotificationCard>
            </li>
          ))
        )}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t border-slate-200 px-1 pt-2 text-[11px] dark:border-slate-700">
        <span className="text-slate-500 dark:text-slate-400">
          Página {Math.min(panelPage + 1, panelTotalPages)} de {panelTotalPages}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void handlePrevPage()}
            disabled={!canGoPrevPage || loading}
            className="rounded-md border border-slate-300 px-2 py-1 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() => void handleNextPage()}
            disabled={!canGoNextPage || loading}
            className="rounded-md border border-slate-300 px-2 py-1 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );

  const desktopPanel = (
    <motion.div
      ref={desktopPanelRef}
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
      className="absolute right-0 z-[70] mt-2 hidden max-h-[70dvh] w-[24rem] max-w-[calc(100vw-1rem)] origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900 md:flex"
    >
      {panelBody}
    </motion.div>
  );

  const desktopBackdrop = (
    <motion.div
      role="presentation"
      aria-hidden="true"
      onClick={() => setOpen(false)}
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.14 }}
      className="fixed inset-0 z-[60] hidden bg-transparent md:block"
    />
  );

  const mobilePanel = (
    <>
      <motion.div
        role="presentation"
        aria-hidden="true"
        onClick={() => setOpen(false)}
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.14 }}
        className="fixed inset-x-0 bottom-0 top-[var(--app-topbar-height,4rem)] z-[130] bg-slate-950/45 md:hidden"
      />
      <motion.div
        ref={mobilePanelRef}
        role="dialog"
        aria-label="Panel de notificaciones"
        initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
        }
        style={{
          top: 'calc(var(--app-topbar-height, 4rem) + 0.5rem)',
          maxHeight: '72dvh',
        }}
        className="fixed inset-x-3 z-[131] flex min-h-[18rem] transform-gpu overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900 md:hidden"
      >
        {panelBody}
      </motion.div>
    </>
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Centro de notificaciones"
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{ WebkitTapHighlightColor: 'transparent' }}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
      >
        <Bell className="h-5 w-5" />
        {unreadTotal > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-5 text-white shadow">
            {unreadTotal > 99 ? '99+' : unreadTotal}
          </span>
        ) : null}
      </button>

      <AnimatePresence>{open ? desktopBackdrop : null}</AnimatePresence>
      <AnimatePresence>{open ? desktopPanel : null}</AnimatePresence>
      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>{open ? mobilePanel : null}</AnimatePresence>,
            document.body
          )
        : null}
    </div>
  );
}
