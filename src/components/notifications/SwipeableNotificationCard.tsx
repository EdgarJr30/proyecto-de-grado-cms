import { useRef, useState } from 'react';
import { cn } from '../../utils/cn';

const SWIPE_TRIGGER_PX = 72;
const SWIPE_MAX_PX = 112;
const TAP_CANCEL_PX = 10;
const AXIS_LOCK_PX = 8;

type SwipeableNotificationCardProps = {
  isRead: boolean;
  onOpen: () => void;
  onMarkRead: () => Promise<void> | void;
  onMarkUnread: () => Promise<void> | void;
  className?: string;
  children: React.ReactNode;
};

export default function SwipeableNotificationCard({
  isRead,
  onOpen,
  onMarkRead,
  onMarkUnread,
  className,
  children,
}: SwipeableNotificationCardProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [busy, setBusy] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchAxisRef = useRef<'x' | 'y' | null>(null);
  const suppressClickRef = useRef(false);

  const resetSwipe = () => {
    setTranslateX(0);
    setIsSwiping(false);
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    touchAxisRef.current = null;
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (busy) return;
    const touch = event.touches[0];
    if (!touch) return;
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    touchAxisRef.current = null;
    suppressClickRef.current = false;
    setIsSwiping(false);
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    if (startX === null || startY === null || busy) return;
    const touch = event.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    if (touchAxisRef.current === null) {
      if (Math.abs(deltaX) < AXIS_LOCK_PX && Math.abs(deltaY) < AXIS_LOCK_PX) {
        return;
      }
      touchAxisRef.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
    }

    if (touchAxisRef.current !== 'x') {
      return;
    }

    event.preventDefault();
    setIsSwiping(true);
    const clamped = Math.max(-SWIPE_MAX_PX, Math.min(SWIPE_MAX_PX, deltaX));
    if (Math.abs(clamped) > TAP_CANCEL_PX) {
      suppressClickRef.current = true;
    }
    setTranslateX(clamped);
  };

  const handleTouchEnd = async () => {
    const axis = touchAxisRef.current;
    const deltaX = translateX;
    resetSwipe();

    if (axis !== 'x') {
      return;
    }

    if (busy) {
      return;
    }

    const shouldMarkRead = deltaX >= SWIPE_TRIGGER_PX && !isRead;
    const shouldMarkUnread = deltaX <= -SWIPE_TRIGGER_PX && isRead;

    if (!shouldMarkRead && !shouldMarkUnread) {
      return;
    }

    setBusy(true);
    try {
      if (shouldMarkRead) {
        await onMarkRead();
      } else if (shouldMarkUnread) {
        await onMarkUnread();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (busy) return;
    if (suppressClickRef.current) {
      event.preventDefault();
      suppressClickRef.current = false;
      return;
    }
    onOpen();
  };

  const hintOpacity = Math.min(Math.abs(translateX) / SWIPE_TRIGGER_PX, 1);
  const showReadHint = !isRead && translateX > TAP_CANCEL_PX;
  const showUnreadHint = isRead && translateX < -TAP_CANCEL_PX;

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="pointer-events-none absolute inset-0 px-3 text-[11px] font-semibold">
        <div
          className={cn(
            'absolute left-3 top-1/2 -translate-y-1/2 rounded-md bg-emerald-500/20 px-2 py-1 text-emerald-700 transition-opacity duration-100 dark:bg-emerald-500/25 dark:text-emerald-200',
            showReadHint ? 'opacity-100' : 'opacity-0'
          )}
          style={{ opacity: showReadHint ? hintOpacity : 0 }}
        >
          Marcar leída
        </div>
        <div
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-amber-500/20 px-2 py-1 text-amber-700 transition-opacity duration-100 dark:bg-amber-500/25 dark:text-amber-200',
            showUnreadHint ? 'opacity-100' : 'opacity-0'
          )}
          style={{ opacity: showUnreadHint ? hintOpacity : 0 }}
        >
          Marcar no leída
        </div>
      </div>
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => void handleTouchEnd()}
        onTouchCancel={resetSwipe}
        style={{
          transform: `translateX(${translateX}px)`,
          touchAction: 'pan-y pinch-zoom',
        }}
        className={cn(
          className,
          busy ? 'opacity-70' : '',
          isSwiping ? 'transition-none' : 'transition-transform duration-150 ease-out'
        )}
      >
        {children}
      </div>
    </div>
  );
}
