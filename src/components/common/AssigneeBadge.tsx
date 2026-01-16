import { useMemo } from 'react';
import { useAssignees } from '../../context/AssigneeContext';
import {
  assigneeInitials,
  formatAssigneeFullName,
} from '../../services/assigneeService';
import type { Assignee } from '../../types/Assignee';

type Size = 'xs' | 'sm' | 'md';

function avatarSizes(size: Size) {
  switch (size) {
    case 'xs':
      return {
        wrapper: 'h-5 w-5 text-[9px]',
        gap: 'gap-1',
        name: 'text-[11px]',
      };
    case 'sm':
      return { wrapper: 'h-6 w-6 text-[10px]', gap: 'gap-2', name: 'text-xs' };
    case 'md':
    default:
      return { wrapper: 'h-8 w-8 text-[12px]', gap: 'gap-2', name: 'text-sm' };
  }
}

export type AssigneeBadgeProps = {
  /** Objeto completo del técnico (si viene, tiene prioridad sobre assigneeId) */
  assignee?: Assignee;
  /** Id del técnico (se usará solo si no se provee assignee) */
  assigneeId?: number | null;
  /** Mostrar nombre al lado del avatar */
  showName?: boolean;
  /** Tamaño visual del avatar/nombre */
  size?: Size;
  className?: string;
};

export default function AssigneeBadge({
  assignee,
  assigneeId,
  showName = true,
  size = 'sm',
  className = '',
}: AssigneeBadgeProps) {
  const { byId } = useAssignees();

  const { initials, displayName } = useMemo(() => {
    const target: Assignee | undefined =
      assignee ?? (assigneeId != null ? byId[assigneeId] : undefined);

    return {
      initials: assigneeInitials(target), // 'SA' si no existe
      displayName: target
        ? formatAssigneeFullName(target)
        : '<< SIN ASIGNAR >>',
    };
  }, [assignee, assigneeId, byId]);

  const s = avatarSizes(size);

  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      <div
        className={`${s.wrapper} bg-slate-200 rounded-full flex items-center justify-center font-semibold text-gray-700`}
      >
        {initials}
      </div>
      {showName && (
        <span className={`${s.name} text-gray-600`}>{displayName}</span>
      )}
    </div>
  );
}
