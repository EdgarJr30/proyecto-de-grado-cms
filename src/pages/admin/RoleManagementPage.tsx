import { Navigate, useLocation } from 'react-router-dom';

export default function RoleManagementPage() {
  const { search } = useLocation();
  // Si venían a /admin/permisos o /admin/roles, mándalos a tab=roles
  const params = new URLSearchParams(search);
  if (!params.get('tab')) params.set('tab', 'roles');
  return <Navigate to={`/admin/settings?${params.toString()}`} replace />;
}
