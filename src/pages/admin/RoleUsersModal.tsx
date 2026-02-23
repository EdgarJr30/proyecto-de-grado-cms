import { useEffect } from 'react';
import RoleUsersPage from './RoleUsersPage';

export default function RoleUsersModal({
  roleId,
  onClose,
}: {
  roleId: number;
  onClose: (changed?: boolean) => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className="fixed inset-0 bg-black/40"
        onClick={() => onClose(false)}
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-5xl rounded-2xl bg-white p-5 shadow-2xl">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            aria-label="Cerrar"
            title="Cerrar"
          >
            ✕
          </button>
          <RoleUsersPage roleId={roleId} onClose={onClose} hideBackLink />
        </div>
      </div>
    </div>
  );
}
