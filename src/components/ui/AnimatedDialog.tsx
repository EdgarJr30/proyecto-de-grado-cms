import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

type AnimatedDialogProps = {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  zIndexClassName?: string;
  overlayClassName?: string;
  containerClassName?: string;
  panelClassName?: string;
  closeOnOverlay?: boolean;
  closeOnEsc?: boolean;
  lockScroll?: boolean;
  role?: 'dialog' | 'alertdialog';
  ariaModal?: boolean;
  portal?: boolean;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function AnimatedDialog({
  open,
  onClose,
  children,
  zIndexClassName = 'z-[120]',
  overlayClassName = 'bg-black/35 backdrop-blur-[2px]',
  containerClassName = 'fixed inset-0 flex items-center justify-center p-4',
  panelClassName = 'w-full max-w-lg rounded-2xl bg-white shadow-xl',
  closeOnOverlay = true,
  closeOnEsc = true,
  lockScroll = false,
  role = 'dialog',
  ariaModal = true,
}: AnimatedDialogProps) {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    if (!closeOnEsc || !onClose) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeOnEsc, onClose, open]);

  useEffect(() => {
    if (!open || !lockScroll || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [lockScroll, open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={cx('fixed inset-0', zIndexClassName)}
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
          }
        >
          <motion.div
            className={cx('absolute inset-0', overlayClassName)}
            onClick={closeOnOverlay ? onClose : undefined}
          />

          <div className={containerClassName}>
            <motion.div
              role={role}
              aria-modal={ariaModal}
              className={panelClassName}
              initial={
                prefersReducedMotion
                  ? { opacity: 1, y: 0, scale: 1 }
                  : { opacity: 0, y: 10, scale: 0.985 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 1, y: 0, scale: 1 }
                  : { opacity: 0, y: 8, scale: 0.99 }
              }
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }
              }
              onClick={(event) => event.stopPropagation()}
            >
              {children}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
