import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  ChevronRight,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useCan } from '../rbac/PermissionsContext';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getMyNotificationPreferences,
  getUnreadNotificationsCount,
  listAdminNotificationTestTargets,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  markNotificationsSeen,
  saveMyNotificationPreferences,
  sendAdminTestNotification,
  sendSelfTestNotification,
  subscribeToMyNotificationDeliveries,
  type NotificationCategory,
  type NotificationFeedScope,
  type NotificationItem,
  type NotificationPreferences,
  type NotificationTestTarget,
} from '../services/notificationCenterService';
import {
  isPushSupported,
  subscribeCurrentDeviceToPush,
  unsubscribeCurrentDeviceFromPush,
} from '../services/pushNotificationsService';
import { showToastError, showToastSuccess } from '../notifications';
import SwipeableNotificationCard from '../components/notifications/SwipeableNotificationCard';

const PAGE_SIZE = 20;
const PUSH_ONBOARDING_DISMISS_KEY = 'notifications:push-onboarding-dismissed:v1';

const SCOPE_TABS: Array<{ id: NotificationFeedScope; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'unread', label: 'No leídas' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'admin', label: 'Admin' },
];

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  assignments: 'Asignaciones',
  comments: 'Comentarios',
  status_changes: 'Cambios de estado',
  deadlines: 'Vencimientos',
  admin_system: 'Admin/Sistema',
};

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

  if (abs < 60) return rtf.format(diffSeconds, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSeconds / 3600), 'hour');
  return rtf.format(Math.round(diffSeconds / 86400), 'day');
}

type PushPermissionState = NotificationPermission | 'unsupported';

function resolvePushPermissionState(pushSupported: boolean): PushPermissionState {
  if (!pushSupported || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}

function getPlatformPermissionHelp(): string {
  if (typeof navigator === 'undefined') {
    return 'Habilita notificaciones desde tu navegador para recibir alertas push.';
  }

  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
    return 'En iPhone/iPad abre la app instalada en pantalla de inicio y permite notificaciones cuando se solicite.';
  }
  if (ua.includes('android')) {
    return 'En Android permite notificaciones del navegador o PWA cuando se solicite.';
  }
  if (ua.includes('windows')) {
    return 'En Windows permite notificaciones del navegador cuando aparezca el aviso.';
  }
  if (ua.includes('mac os x') || ua.includes('macintosh')) {
    return 'En macOS permite notificaciones del navegador cuando aparezca el aviso.';
  }
  return 'Permite notificaciones del navegador/PWA cuando aparezca la solicitud.';
}

export default function NotificationCenterPage() {
  const { profile } = useUser();
  const navigate = useNavigate();
  const [scope, setScope] = useState<NotificationFeedScope>('all');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updatingRead, setUpdatingRead] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [prefs, setPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);
  const [adminTargetSearch, setAdminTargetSearch] = useState('');
  const [adminTargets, setAdminTargets] = useState<NotificationTestTarget[]>([]);
  const [adminTargetsLoading, setAdminTargetsLoading] = useState(false);
  const [adminSelectedUserId, setAdminSelectedUserId] = useState('');
  const [adminTestTitle, setAdminTestTitle] = useState(
    'Prueba de notificaciones'
  );
  const [adminTestMessage, setAdminTestMessage] = useState(
    'Mensaje de prueba enviado por un administrador.'
  );
  const [adminSendPush, setAdminSendPush] = useState(true);
  const [adminSendingTest, setAdminSendingTest] = useState(false);
  const [pushPermission, setPushPermission] = useState<PushPermissionState>('default');
  const [showPushOnboarding, setShowPushOnboarding] = useState(false);
  const [selfTestBusy, setSelfTestBusy] = useState(false);
  const [mobileView, setMobileView] = useState<'feed' | 'settings'>('feed');
  const [feedSearch, setFeedSearch] = useState('');

  const pushSupported = useMemo(() => isPushSupported(), []);
  const canSendNotificationTests = useCan([
    'users:full_access',
    'rbac:manage_permissions',
  ]);
  const pushHelpText = useMemo(() => getPlatformPermissionHelp(), []);

  const refreshUnread = useCallback(async () => {
    try {
      const unread = await getUnreadNotificationsCount();
      setUnreadCount(unread);
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : 'No se pudo cargar el conteo pendiente.';
      showToastError(msg);
    }
  }, []);

  const loadPreferences = useCallback(async () => {
    setLoadingPrefs(true);
    try {
      const next = await getMyNotificationPreferences();
      setPrefs(next);
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : 'No se pudieron cargar las preferencias.';
      showToastError(msg);
    } finally {
      setLoadingPrefs(false);
    }
  }, []);

  const loadPage = useCallback(
    async (pageToLoad: number) => {
      setLoading(true);

      try {
        const offset = pageToLoad * PAGE_SIZE;
        const { items: pageItems, total: totalRows } = await listNotifications({
          scope,
          offset,
          limit: PAGE_SIZE,
        });

        const nowIso = new Date().toISOString();
        const normalizedItems = pageItems.map((item) =>
          item.seenAt ? item : { ...item, seenAt: nowIso }
        );

        const unseenIds = pageItems
          .filter((item) => item.seenAt === null)
          .map((item) => item.deliveryId);
        if (unseenIds.length > 0) {
          void markNotificationsSeen(unseenIds).catch(() => undefined);
        }

        setTotal(totalRows);
        setItems(normalizedItems);
      } catch (error: unknown) {
        const msg =
          error instanceof Error
            ? error.message
            : 'No se pudieron cargar notificaciones.';
        showToastError(msg);
      } finally {
        setLoading(false);
      }
    },
    [scope]
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canGoPrevPage = page > 0;
  const canGoNextPage = page + 1 < totalPages;

  useEffect(() => {
    setPage(0);
    void loadPage(0);
  }, [scope, loadPage]);

  useEffect(() => {
    void refreshUnread();
    void loadPreferences();
  }, [loadPreferences, refreshUnread]);

  useEffect(() => {
    setPushPermission(resolvePushPermissionState(pushSupported));
  }, [pushSupported]);

  useEffect(() => {
    if (!pushSupported) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setPushPermission(resolvePushPermissionState(pushSupported));
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [pushSupported]);

  useEffect(() => {
    if (!pushSupported) return;
    if (loadingPrefs) return;
    if (prefs.push_enabled) return;
    if (pushPermission !== 'default') return;
    if (typeof window === 'undefined') return;
    const dismissed = window.localStorage.getItem(PUSH_ONBOARDING_DISMISS_KEY);
    if (dismissed === '1') return;
    setShowPushOnboarding(true);
  }, [loadingPrefs, prefs.push_enabled, pushPermission, pushSupported]);

  useEffect(() => {
    if (prefs.push_enabled) {
      setShowPushOnboarding(false);
    }
  }, [prefs.push_enabled]);

  useEffect(() => {
    if (!profile?.id) return;
    const unsubscribe = subscribeToMyNotificationDeliveries(profile.id, () => {
      setPage(0);
      void loadPage(0);
      void refreshUnread();
    });
    return () => unsubscribe();
  }, [loadPage, profile?.id, refreshUnread]);

  const handleOpenNotification = useCallback(
    async (item: NotificationItem) => {
      if (!item.readAt) {
        try {
          await markNotificationRead(item.deliveryId);
          setItems((current) =>
            current.map((row) =>
              row.deliveryId === item.deliveryId
                ? { ...row, readAt: new Date().toISOString() }
                : row
            )
          );
          await refreshUnread();
        } catch (error: unknown) {
          const msg =
            error instanceof Error
              ? error.message
              : 'No se pudo marcar la notificación como leída.';
          showToastError(msg);
        }
      }

      navigate(item.url);
    },
    [navigate, refreshUnread]
  );

  const handleMarkAllRead = useCallback(async () => {
    setUpdatingRead(true);
    try {
      await markAllNotificationsRead();
      const nowIso = new Date().toISOString();
      setItems((current) =>
        current.map((item) => ({
          ...item,
          readAt: item.readAt ?? nowIso,
        }))
      );
      if (scope === 'unread') {
        setItems([]);
        setTotal(0);
        setPage(0);
      }
      await refreshUnread();
      showToastSuccess('Notificaciones marcadas como leídas.');
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : 'No se pudo marcar todo como leído.';
      showToastError(msg);
    } finally {
      setUpdatingRead(false);
    }
  }, [refreshUnread, scope]);

  const handleSwipeMarkRead = useCallback(
    async (deliveryId: string) => {
      try {
        await markNotificationRead(deliveryId);
        await refreshUnread();
        await loadPage(page);
      } catch (error: unknown) {
        const msg =
          error instanceof Error
            ? error.message
            : 'No se pudo marcar la notificación como leída.';
        showToastError(msg);
      }
    },
    [loadPage, page, refreshUnread]
  );

  const handleSwipeMarkUnread = useCallback(
    async (deliveryId: string) => {
      try {
        await markNotificationUnread(deliveryId);
        await refreshUnread();
        await loadPage(page);
      } catch (error: unknown) {
        const msg =
          error instanceof Error
            ? error.message
            : 'No se pudo marcar la notificación como no leída.';
        showToastError(msg);
      }
    },
    [loadPage, page, refreshUnread]
  );

  const handlePrevPage = useCallback(async () => {
    if (!canGoPrevPage || loading) return;
    const target = page - 1;
    setPage(target);
    await loadPage(target);
  }, [canGoPrevPage, loadPage, loading, page]);

  const handleNextPage = useCallback(async () => {
    if (!canGoNextPage || loading) return;
    const target = page + 1;
    setPage(target);
    await loadPage(target);
  }, [canGoNextPage, loadPage, loading, page]);

  const handleCategoryToggle = useCallback(
    async (category: NotificationCategory) => {
      const next: NotificationPreferences = {
        ...prefs,
        categories: {
          ...prefs.categories,
          [category]: !prefs.categories[category],
        },
      };

      try {
        const saved = await saveMyNotificationPreferences(next);
        setPrefs(saved);
      } catch (error: unknown) {
        const msg =
          error instanceof Error
            ? error.message
            : 'No se pudo actualizar la preferencia.';
        showToastError(msg);
      }
    },
    [prefs]
  );

  const handleEnablePush = useCallback(async () => {
    if (!pushSupported) return false;

    setPushBusy(true);
    try {
      await subscribeCurrentDeviceToPush(import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY ?? '');
      const saved = await saveMyNotificationPreferences({
        ...prefs,
        push_enabled: true,
      });
      setPrefs(saved);
      setPushPermission(resolvePushPermissionState(pushSupported));
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PUSH_ONBOARDING_DISMISS_KEY, '1');
      }
      setShowPushOnboarding(false);
      showToastSuccess('Push habilitado para este dispositivo.');
      return true;
    } catch (error: unknown) {
      setPushPermission(resolvePushPermissionState(pushSupported));
      const msg =
        error instanceof Error
          ? error.message
          : 'No se pudo activar la configuración push.';
      showToastError(msg);
      return false;
    } finally {
      setPushBusy(false);
    }
  }, [prefs, pushSupported]);

  const handleDisablePush = useCallback(async () => {
    if (!pushSupported) return;
    setPushBusy(true);
    try {
      await unsubscribeCurrentDeviceFromPush();
      const saved = await saveMyNotificationPreferences({
        ...prefs,
        push_enabled: false,
      });
      setPrefs(saved);
      setPushPermission(resolvePushPermissionState(pushSupported));
      showToastSuccess('Push deshabilitado para este dispositivo.');
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : 'No se pudo deshabilitar la configuración push.';
      showToastError(msg);
    } finally {
      setPushBusy(false);
    }
  }, [prefs, pushSupported]);

  const handleTogglePush = useCallback(async () => {
    if (prefs.push_enabled) {
      await handleDisablePush();
      return;
    }
    await handleEnablePush();
  }, [handleDisablePush, handleEnablePush, prefs.push_enabled]);

  const handleDismissPushOnboarding = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PUSH_ONBOARDING_DISMISS_KEY, '1');
    }
    setShowPushOnboarding(false);
  }, []);

  const handleOpenPushOnboarding = useCallback(() => {
    setShowPushOnboarding(true);
  }, []);

  const handleSendSelfTest = useCallback(async () => {
    setSelfTestBusy(true);
    try {
      const eventId = await sendSelfTestNotification({
        sendPush: true,
        title: 'Prueba de notificaciones',
        message: 'Si ves este mensaje, tu dispositivo está listo para recibir alertas.',
      });
      await refreshUnread();
      setPage(0);
      await loadPage(0);
      showToastSuccess(`Prueba enviada (${eventId.slice(0, 8)}...).`);
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : 'No se pudo enviar la prueba a tu dispositivo.';
      showToastError(msg);
    } finally {
      setSelfTestBusy(false);
    }
  }, [loadPage, refreshUnread]);

  const loadAdminTargets = useCallback(async () => {
    if (!canSendNotificationTests) return;

    setAdminTargetsLoading(true);
    try {
      const targets = await listAdminNotificationTestTargets(adminTargetSearch, 30);
      setAdminTargets(targets);
      setAdminSelectedUserId((current) => {
        if (targets.length === 0) return '';
        if (targets.some((target) => target.userId === current)) return current;
        return targets[0].userId;
      });
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : 'No se pudieron cargar usuarios de prueba.';
      showToastError(msg);
    } finally {
      setAdminTargetsLoading(false);
    }
  }, [adminTargetSearch, canSendNotificationTests]);

  useEffect(() => {
    if (!canSendNotificationTests) return;
    const timeoutId = window.setTimeout(() => {
      void loadAdminTargets();
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [canSendNotificationTests, loadAdminTargets]);

  const selectedAdminTarget = useMemo(
    () => adminTargets.find((target) => target.userId === adminSelectedUserId) ?? null,
    [adminSelectedUserId, adminTargets]
  );

  const filteredItems = useMemo(() => {
    const query = feedSearch.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => {
      const category = CATEGORY_LABEL[item.category].toLowerCase();
      return (
        item.title.toLowerCase().includes(query) ||
        item.message.toLowerCase().includes(query) ||
        category.includes(query)
      );
    });
  }, [feedSearch, items]);

  const handleSendAdminTestNotification = useCallback(async () => {
    if (!canSendNotificationTests) return;
    if (!adminSelectedUserId) {
      showToastError('Selecciona un usuario destino.');
      return;
    }

    setAdminSendingTest(true);
    try {
      const eventId = await sendAdminTestNotification({
        recipientUserId: adminSelectedUserId,
        title: adminTestTitle,
        message: adminTestMessage,
        url: '/notificaciones',
        sendPush: adminSendPush,
      });

      await refreshUnread();
      setPage(0);
      await loadPage(0);

      showToastSuccess(
        `Notificación de prueba enviada (${eventId.slice(0, 8)}...).`
      );
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : 'No se pudo enviar la notificación de prueba.';
      showToastError(msg);
    } finally {
      setAdminSendingTest(false);
    }
  }, [
    adminSelectedUserId,
    adminSendPush,
    adminTestMessage,
    adminTestTitle,
    canSendNotificationTests,
    loadPage,
    refreshUnread,
  ]);

  return (
    <div className="h-screen flex bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        <section className="flex-1 min-h-0 overflow-auto bg-slate-100/60 pt-4 md:pt-6 dark:bg-slate-950">
          <div className="px-4 md:px-6 lg:px-8 pb-6">
            <div className="mx-auto w-full max-w-[1220px]">
              <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-2 shadow-sm dark:border-slate-700/70 dark:bg-gradient-to-b dark:from-slate-950/95 dark:via-slate-950 dark:to-indigo-950/50 dark:shadow-[0_20px_90px_rgba(15,23,42,0.55)] sm:p-3 md:p-4">
                <div className="grid gap-4 xl:min-h-[calc(100dvh-var(--app-topbar-height,4rem)-5.75rem)] xl:grid-cols-[minmax(0,1fr)_330px]">
                  <section
                    className={`${mobileView === 'feed' ? 'block' : 'hidden'} min-w-0 xl:flex xl:min-h-0 xl:flex-col`}
                  >
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/55 sm:p-4">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                            Centro de Notificaciones
                          </h1>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Filtra tus alertas recientes y gestiona estados de lectura.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 xl:hidden">
                          <button
                            type="button"
                            onClick={() => setMobileView('settings')}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                          >
                            <SlidersHorizontal className="h-4 w-4" />
                            Filtros
                          </button>
                        </div>
                      </div>

                      <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <label className="relative block">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={feedSearch}
                            onChange={(event) => setFeedSearch(event.target.value)}
                            placeholder="Buscar por título, mensaje o categoría"
                            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/30"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          disabled={updatingRead || unreadCount === 0}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                        >
                          <CheckCheck className="h-4 w-4" />
                          Marcar todas leídas
                        </button>
                      </div>

                      <div className="-mx-1 mb-4 overflow-x-auto px-1 md:mx-0 md:px-0">
                        <div className="flex min-w-max gap-2 md:grid md:min-w-0 md:grid-cols-4">
                          {SCOPE_TABS.map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setScope(tab.id)}
                              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                                scope === tab.id
                                  ? 'border-indigo-500 bg-indigo-500/15 text-indigo-700 dark:text-indigo-200'
                                  : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mb-3 flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-sm dark:border-indigo-500/20 dark:bg-indigo-500/10">
                        <p className="inline-flex items-center gap-2 font-medium text-indigo-700 dark:text-indigo-200">
                          <Bell className="h-4 w-4" />
                          {unreadCount} pendientes de leer
                        </p>
                      </div>

                      <div className="min-h-[18rem] max-h-[52dvh] overflow-y-auto overscroll-y-contain pr-1 sm:max-h-[56dvh] lg:max-h-[60dvh] xl:max-h-[calc(100dvh-var(--app-topbar-height,4rem)-23rem)]">
                        {loading ? (
                          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-12 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Cargando notificaciones...
                          </div>
                        ) : filteredItems.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            {items.length === 0
                              ? 'No hay notificaciones para este filtro.'
                              : 'No hay resultados para la búsqueda actual.'}
                          </div>
                        ) : (
                          <ul className="space-y-2">
                            {filteredItems.map((item) => (
                              <li key={item.deliveryId}>
                                <SwipeableNotificationCard
                                  isRead={item.readAt !== null}
                                  onOpen={() => void handleOpenNotification(item)}
                                  onMarkRead={() => handleSwipeMarkRead(item.deliveryId)}
                                  onMarkUnread={() => handleSwipeMarkUnread(item.deliveryId)}
                                  className={`w-full rounded-xl border p-3 text-left ${
                                    item.readAt
                                      ? 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:bg-slate-800'
                                      : 'border-indigo-200 bg-indigo-50/80 hover:bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/15'
                                  }`}
                                >
                                  <div className="mb-1 flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <Bell className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />
                                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        {item.title}
                                      </p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                                  </div>
                                  <p className="mb-1 text-sm text-slate-600 dark:text-slate-300">
                                    {item.message}
                                  </p>
                                  <div className="mt-2 flex items-center justify-between gap-2">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      {CATEGORY_LABEL[item.category]} ·{' '}
                                      {formatRelativeTime(item.createdAt)}
                                    </p>
                                    {item.readAt ? (
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          void handleSwipeMarkUnread(item.deliveryId);
                                        }}
                                        className="shrink-0 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-200 dark:hover:bg-amber-500/30"
                                      >
                                        Marcar no leída
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          void handleSwipeMarkRead(item.deliveryId);
                                        }}
                                        className="shrink-0 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-200 dark:hover:bg-emerald-500/30"
                                      >
                                        Marcar leída
                                      </button>
                                    )}
                                  </div>
                                </SwipeableNotificationCard>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Página {Math.min(page + 1, totalPages)} de {totalPages}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handlePrevPage()}
                            disabled={!canGoPrevPage || loading}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Anterior
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleNextPage()}
                            disabled={!canGoNextPage || loading}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  <aside
                    className={`min-w-0 space-y-4 ${mobileView === 'settings' ? 'block' : 'hidden'} xl:block xl:min-h-0 xl:overflow-y-auto xl:pr-1`}
                  >
                    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/60">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                          Filtros y Configuración
                        </h2>
                        <button
                          type="button"
                          onClick={() => setMobileView('feed')}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-100 xl:hidden dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                          aria-label="Cerrar filtros"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Configura canales y categorías de notificaciones.
                      </p>

                      <div className="mt-4 space-y-3">
                        <button
                          type="button"
                          onClick={() => void handleTogglePush()}
                          disabled={!pushSupported || pushBusy || loadingPrefs}
                          className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
                            prefs.push_enabled
                              ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200'
                              : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800'
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          Push en este dispositivo:{' '}
                          <span className="font-semibold">
                            {prefs.push_enabled ? 'Activado' : 'Desactivado'}
                          </span>
                        </button>

                        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            Guía de permisos push
                          </p>
                          <button
                            type="button"
                            onClick={handleOpenPushOnboarding}
                            className="text-xs font-semibold text-indigo-700 transition hover:text-indigo-600 dark:text-indigo-300 dark:hover:text-indigo-200"
                          >
                            {showPushOnboarding ? 'Visible' : 'Abrir'}
                          </button>
                        </div>

                        {showPushOnboarding ? (
                          <div className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-3 text-xs text-indigo-900 dark:border-indigo-500/50 dark:bg-indigo-500/15 dark:text-indigo-100">
                            <p className="font-semibold">Activa push en este dispositivo</p>
                            <p className="mt-1">
                              1) Presiona{' '}
                              <span className="font-semibold">Push en este dispositivo</span>. 2)
                              Acepta el permiso cuando lo pida el navegador. 3) Envía una prueba
                              para confirmar recepción.
                            </p>
                            <p className="mt-2 rounded-md border border-indigo-200 bg-white/70 px-2 py-1.5 dark:border-indigo-500/40 dark:bg-indigo-900/30">
                              {pushHelpText}
                            </p>
                            {!pushSupported ? (
                              <p className="mt-2 text-amber-800 dark:text-amber-200">
                                Este contexto no soporta Web Push aún. En iOS usa la app instalada
                                (PWA) y dominio HTTPS publicado.
                              </p>
                            ) : null}
                            {pushPermission === 'denied' ? (
                              <p className="mt-2 text-amber-800 dark:text-amber-200">
                                El permiso está bloqueado. Debes habilitar notificaciones para
                                este sitio en el navegador/sistema y luego volver a intentar.
                              </p>
                            ) : null}
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                              {!prefs.push_enabled && pushSupported ? (
                                <button
                                  type="button"
                                  onClick={() => void handleEnablePush()}
                                  disabled={pushBusy}
                                  className="rounded-md border border-indigo-500 bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {pushBusy ? 'Activando...' : 'Activar ahora'}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={handleDismissPushOnboarding}
                                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                Cerrar guía
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {!pushSupported ? (
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            Este navegador/dispositivo no soporta Web Push en el contexto actual.
                          </p>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => void handleSendSelfTest()}
                          disabled={selfTestBusy || !prefs.push_enabled || !pushSupported}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          {selfTestBusy
                            ? 'Enviando prueba a este dispositivo...'
                            : 'Enviar prueba a este dispositivo'}
                        </button>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/60">
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Categorías
                      </h2>
                      <div className="mt-3 space-y-2">
                        {(Object.keys(CATEGORY_LABEL) as NotificationCategory[]).map(
                          (category) => (
                            <button
                              key={category}
                              type="button"
                              onClick={() => void handleCategoryToggle(category)}
                              disabled={loadingPrefs}
                              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                                prefs.categories[category]
                                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-200'
                                  : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'
                              }`}
                            >
                              {CATEGORY_LABEL[category]}
                            </button>
                          )
                        )}
                      </div>
                    </section>

                    {canSendNotificationTests ? (
                      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/60">
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Prueba Admin
                        </h2>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Envía una notificación de prueba a cualquier usuario para validar in-app
                          y push.
                        </p>

                        <div className="mt-3 space-y-2">
                          <input
                            type="text"
                            value={adminTargetSearch}
                            onChange={(event) => setAdminTargetSearch(event.target.value)}
                            placeholder="Buscar usuario por nombre o email"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/30"
                          />

                          <select
                            value={adminSelectedUserId}
                            onChange={(event) => setAdminSelectedUserId(event.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/30"
                          >
                            {adminTargets.length === 0 ? (
                              <option value="">
                                {adminTargetsLoading
                                  ? 'Buscando usuarios...'
                                  : 'No se encontraron usuarios'}
                              </option>
                            ) : (
                              adminTargets.map((target) => (
                                <option key={target.userId} value={target.userId}>
                                  {target.fullName}
                                  {target.email ? ` (${target.email})` : ''} ·{' '}
                                  {target.hasPushSubscription ? 'push listo' : 'sin push'}
                                </option>
                              ))
                            )}
                          </select>

                          {selectedAdminTarget ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Estado push:{' '}
                              <span className="font-semibold text-slate-700 dark:text-slate-200">
                                {selectedAdminTarget.hasPushSubscription
                                  ? 'Suscrito'
                                  : 'Sin suscripción'}
                              </span>
                              {selectedAdminTarget.lastPushSeenAt
                                ? ` · visto ${formatRelativeTime(selectedAdminTarget.lastPushSeenAt)}`
                                : ''}
                            </p>
                          ) : null}

                          <input
                            type="text"
                            value={adminTestTitle}
                            onChange={(event) => setAdminTestTitle(event.target.value)}
                            placeholder="Título de la notificación"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/30"
                          />

                          <textarea
                            value={adminTestMessage}
                            onChange={(event) => setAdminTestMessage(event.target.value)}
                            rows={3}
                            placeholder="Mensaje de prueba"
                            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/30"
                          />

                          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                            <input
                              type="checkbox"
                              checked={adminSendPush}
                              onChange={(event) => setAdminSendPush(event.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-500 dark:bg-slate-700"
                            />
                            Incluir push (además de in-app)
                          </label>

                          <button
                            type="button"
                            onClick={() => void handleSendAdminTestNotification()}
                            disabled={
                              adminSendingTest ||
                              adminTargetsLoading ||
                              adminSelectedUserId.length === 0
                            }
                            className="w-full rounded-lg border border-indigo-500 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {adminSendingTest
                              ? 'Enviando prueba...'
                              : 'Enviar notificación de prueba'}
                          </button>
                        </div>
                      </section>
                    ) : null}
                  </aside>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
