import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export type SortableKpiGridItem = {
  id: string;
  content: ReactNode;
  className?: string;
};

interface SortableKpiGridProps {
  items: SortableKpiGridItem[];
  onOrderChange: (nextOrder: string[]) => void;
  className?: string;
  ariaLabel?: string;
}

export default function SortableKpiGrid({
  items,
  onOrderChange,
  className = 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3',
  ariaLabel,
}: SortableKpiGridProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const ids = useMemo(() => items.map((item) => item.id), [items]);

  function clearDragState() {
    setDraggingId(null);
    setDropTargetId(null);
  }

  function commitDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) return;

    const fromIndex = ids.indexOf(draggingId);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

    onOrderChange(moveItem(ids, fromIndex, toIndex));
  }

  return (
    <div className={className} aria-label={ariaLabel}>
      {items.map((item) => {
        const isDragging = draggingId === item.id;
        const isDropTarget = !isDragging && dropTargetId === item.id;

        return (
          <div
            key={item.id}
            draggable
            onDragStart={(event) => {
              setDraggingId(item.id);
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', item.id);
            }}
            onDragEnter={() => {
              if (draggingId && draggingId !== item.id) {
                setDropTargetId(item.id);
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (draggingId && draggingId !== item.id) {
                event.dataTransfer.dropEffect = 'move';
                setDropTargetId(item.id);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              commitDrop(item.id);
              clearDragState();
            }}
            onDragEnd={clearDragState}
            title="Arrastra para reordenar"
            className={cx(
              item.className,
              'cursor-grab active:cursor-grabbing transition',
              isDragging && 'opacity-55 scale-[0.99]',
              isDropTarget && 'rounded-2xl ring-2 ring-blue-300 ring-offset-2'
            )}
          >
            {item.content}
          </div>
        );
      })}
    </div>
  );
}
