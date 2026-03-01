import { useEffect, useMemo, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'mlm:pwa-install-dismissed-at';
const DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 7;

function detectStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectIos() {
  const ua = window.navigator.userAgent.toLowerCase();
  const isIosDevice = /iphone|ipad|ipod/.test(ua);
  const isStandaloneBrowser = /safari/.test(ua) && !/crios|fxios/.test(ua);
  return isIosDevice && isStandaloneBrowser;
}

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  const isIos = useMemo(detectIos, []);
  const canInstallFromPrompt = !!installEvent;
  const showIosHint = isIos && !canInstallFromPrompt;

  useEffect(() => {
    setIsStandalone(detectStandaloneMode());
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) {
      setDismissed(true);
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    const onAppInstalled = () => {
      setInstallEvent(null);
      setIsStandalone(true);
      setDismissed(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installEvent) return;
    setInstalling(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setDismissed(true);
      }
    } finally {
      setInstallEvent(null);
      setInstalling(false);
    }
  };

  if (isStandalone || dismissed) return null;
  if (!canInstallFromPrompt && !showIosHint) return null;
  if (!window.isSecureContext) return null;

  const dismissPrompt = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  return (
    <div className="fixed inset-x-3 bottom-4 z-[70] sm:inset-x-auto sm:bottom-5 sm:left-4 sm:max-w-sm">
      <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Instala CMMS en tu dispositivo
        </p>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
          {canInstallFromPrompt
            ? 'Tendras acceso rapido desde la pantalla principal.'
            : 'En iPhone/iPad, abre Compartir y luego toca "Anadir a pantalla de inicio".'}
        </p>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={dismissPrompt}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cerrar
          </button>
          {canInstallFromPrompt ? (
            <button
              type="button"
              onClick={handleInstallClick}
              disabled={installing}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {installing ? 'Abriendo...' : 'Instalar app'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
