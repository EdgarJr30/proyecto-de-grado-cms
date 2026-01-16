import { Navigate, useLocation } from 'react-router-dom';

export default function AdminSettingsPage() {
  const { search } = useLocation();
  return <Navigate to={`/admin/settings${search || '?tab=general'}`} replace />;
}
