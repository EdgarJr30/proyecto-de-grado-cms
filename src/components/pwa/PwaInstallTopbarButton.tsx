import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download } from 'lucide-react';
import {
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  subscribeDeferredInstallPrompt,
  type BeforeInstallPromptEvent,
} from '../../pwa/installPromptStore';

function detectStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectIos() {
  const ua = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform;
  const isClassicIos = /iphone|ipad|ipod/.test(ua);
  const isModernIpadOs = platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  return isClassicIos || isModernIpadOs;
}

function detectSafariOnIos() {
  const ua = window.navigator.userAgent.toLowerCase();
  const isSafariEngine = /safari/.test(ua) && !/crios|fxios|edgios|opios/.test(ua);
  return detectIos() && isSafariEngine;
}

export default function PwaInstallTopbarButton() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(
    () => getDeferredInstallPrompt()
  );
  const [isStandalone, setIsStandalone] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [modalRoot, setModalRoot] = useState<HTMLElement | null>(null);

  const isIos = useMemo(detectIos, []);
  const isIosSafari = useMemo(detectSafariOnIos, []);
  const canUseNativePrompt = !!installEvent;

  useEffect(() => {
    const syncStandaloneMode = () => setIsStandalone(detectStandaloneMode());
    syncStandaloneMode();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncStandaloneMode();
        setInstallEvent(getDeferredInstallPrompt());
      }
    };

    const unsubscribeInstallPrompt = subscribeDeferredInstallPrompt(() => {
      setInstallEvent(getDeferredInstallPrompt());
    });

    window.addEventListener('pageshow', syncStandaloneMode);
    window.addEventListener('appinstalled', syncStandaloneMode);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      unsubscribeInstallPrompt();
      window.removeEventListener('pageshow', syncStandaloneMode);
      window.removeEventListener('appinstalled', syncStandaloneMode);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    setModalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!showModal) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowModal(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showModal]);

  const handleInstallClick = async () => {
    if (!installEvent) return;

    setInstalling(true);
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
      setShowModal(false);
    } finally {
      clearDeferredInstallPrompt();
      setInstalling(false);
    }
  };

  const onButtonClick = () => {
    setInstallEvent(getDeferredInstallPrompt());
    setShowModal(true);
  };

  const shouldShowButton = !isStandalone && (window.isSecureContext || isIos);
  if (!shouldShowButton) return null;

  const helperText = canUseNativePrompt
    ? 'Pulsa "Instalar app" para abrir el instalador automatico del dispositivo.'
    : isIosSafari
      ? 'En iPhone/iPad abre Compartir y luego toca "Anadir a pantalla de inicio".'
      : isIos
        ? 'En iPhone/iPad abre esta pagina en Safari y luego usa "Anadir a pantalla de inicio".'
        : 'Si no aparece el instalador automatico, abre el menu del navegador y pulsa "Instalar aplicacion" o "Agregar a pantalla de inicio".';

  return (
    <>
      <button
        type="button"
        onClick={onButtonClick}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
      >
        <Download className="h-4 w-4" />
        Instalar
      </button>

      {showModal && modalRoot
        ? createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 p-3 sm:items-center"
              onClick={() => setShowModal(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                role="dialog"
                aria-modal="true"
                aria-label="Instalar aplicacion"
                onClick={(event) => event.stopPropagation()}
              >
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Instalar app
                </p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{helperText}</p>
                {!canUseNativePrompt ? (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    El navegador no habilito el instalador automatico en esta sesion.
                  </p>
                ) : null}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Cerrar
                  </button>
                  {canUseNativePrompt ? (
                    <button
                      type="button"
                      onClick={handleInstallClick}
                      disabled={installing}
                      className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {installing ? 'Abriendo...' : 'Instalar app'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setInstallEvent(getDeferredInstallPrompt())}
                      className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500"
                    >
                      Reintentar
                    </button>
                  )}
                </div>
              </div>
            </div>,
            modalRoot
          )
        : null}
    </>
  );
}
