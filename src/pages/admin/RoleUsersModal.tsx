import RoleUsersPage from './RoleUsersPage';

export default function RoleUsersModal({
  roleId,
  onClose,
}: {
  roleId: number;
  onClose: (changed?: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className="fixed inset-0 bg-black/40"
        onClick={() => onClose(false)}
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl rounded-2xl bg-white p-5 shadow-2xl">
          <RoleUsersPage roleId={roleId} onClose={onClose} hideBackLink />
        </div>
      </div>
    </div>
  );
}
