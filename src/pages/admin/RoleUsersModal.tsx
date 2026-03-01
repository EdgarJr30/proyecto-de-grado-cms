import RoleUsersPage from './RoleUsersPage';
import AnimatedDialog from '../../components/ui/AnimatedDialog';

export default function RoleUsersModal({
  roleId,
  onClose,
}: {
  roleId: number;
  onClose: (changed?: boolean) => void;
}) {
  return (
    <AnimatedDialog
      open
      onClose={() => onClose(false)}
      zIndexClassName="z-[60]"
      overlayClassName="bg-black/40"
      panelClassName="relative w-full max-w-5xl rounded-2xl bg-white p-5 shadow-2xl"
    >
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
    </AnimatedDialog>
  );
}
