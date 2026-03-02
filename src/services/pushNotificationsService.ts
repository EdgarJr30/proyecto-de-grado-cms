import { supabase } from '../lib/supabaseClient';

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null) {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(getErrorMessage(error, 'No se pudo validar la sesión.'));
  }
  if (!user?.id) {
    throw new Error('No hay sesión activa.');
  }
  return user.id;
}

async function ensureServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Este navegador no soporta Service Workers.');
  }

  const existingRegistration = await navigator.serviceWorker.getRegistration();
  if (existingRegistration?.active) {
    return existingRegistration;
  }

  await navigator.serviceWorker.register(
    `/sw.js?v=${encodeURIComponent(__APP_VERSION__)}`,
    {
      updateViaCache: 'none',
    }
  );

  const readyRegistration = await navigator.serviceWorker.ready;
  if (!readyRegistration.active) {
    throw new Error(
      'Service Worker registrado pero no activo. Recarga la página e intenta de nuevo.'
    );
  }

  return readyRegistration;
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'Notification' in window &&
    'PushManager' in window &&
    'serviceWorker' in navigator
  );
}

export async function subscribeCurrentDeviceToPush(
  vapidPublicKey: string
): Promise<void> {
  if (!isPushSupported()) {
    throw new Error('Push no está soportado en este navegador o contexto.');
  }

  if (!vapidPublicKey || vapidPublicKey.trim().length === 0) {
    throw new Error('Falta VITE_WEB_PUSH_PUBLIC_KEY en el entorno.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('El permiso de notificaciones fue denegado.');
  }

  const userId = await getCurrentUserId();
  const registration = await ensureServiceWorkerRegistration();

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const json = subscription.toJSON();
  const endpoint = json.endpoint ?? subscription.endpoint;
  const p256dh = json.keys?.p256dh ?? arrayBufferToBase64(subscription.getKey('p256dh'));
  const auth = json.keys?.auth ?? arrayBufferToBase64(subscription.getKey('auth'));

  if (!endpoint || !p256dh || !auth) {
    throw new Error('No se pudo extraer la suscripción Web Push.');
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
      platform:
        ((
          navigator as Navigator & {
            userAgentData?: { platform?: string };
          }
        ).userAgentData?.platform ?? navigator.platform),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,endpoint' }
  );

  if (error) {
    throw new Error(
      getErrorMessage(error, 'No se pudo guardar la suscripción push.')
    );
  }
}

export async function unsubscribeCurrentDeviceFromPush(): Promise<void> {
  const userId = await getCurrentUserId();

  if (!('serviceWorker' in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    await supabase.from('push_subscriptions').delete().eq('user_id', userId);
    return;
  }

  const subscription = await registration.pushManager.getSubscription();
  const endpoint = subscription?.endpoint ?? null;

  if (subscription) {
    try {
      await subscription.unsubscribe();
    } catch (error: unknown) {
      throw new Error(
        getErrorMessage(error, 'No se pudo cancelar la suscripción local.')
      );
    }
  }

  if (endpoint) {
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint);

    if (error) {
      throw new Error(
        getErrorMessage(error, 'No se pudo eliminar la suscripción push.')
      );
    }
    return;
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw new Error(
      getErrorMessage(error, 'No se pudo limpiar la suscripción push.')
    );
  }
}
