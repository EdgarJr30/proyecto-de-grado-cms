import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function AnchoredPopover({
  anchorRef,
  open,
  onClose,
  children,
  minWidth,
}: {
  anchorRef: React.RefObject<HTMLElement>;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  minWidth?: number;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });
  const popoverRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    function recalc() {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ top: r.bottom + 8, left: r.left, width: r.width });
    }
    function handleDocPointerDown(e: MouseEvent) {
      const target = e.target as Node | null;
      if (
        (anchorRef.current && anchorRef.current.contains(target)) ||
        (popoverRef.current && popoverRef.current.contains(target))
      )
        return;
      onCloseRef.current();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current();
    }

    if (open) {
      recalc();
      const opts = { passive: true } as AddEventListenerOptions;
      window.addEventListener('scroll', recalc, opts);
      window.addEventListener('resize', recalc, opts);
      document.addEventListener('mousedown', handleDocPointerDown);
      document.addEventListener('keydown', handleKey);
      return () => {
        window.removeEventListener('scroll', recalc);
        window.removeEventListener('resize', recalc);
        document.removeEventListener('mousedown', handleDocPointerDown);
        document.removeEventListener('keydown', handleKey);
      };
    }
  }, [open, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        minWidth: minWidth ?? pos.width,
        zIndex: 9999,
      }}
      className="rounded-xl border border-gray-200 bg-white p-2 shadow-2xl max-h-72 overflow-auto"
      role="menu"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}
