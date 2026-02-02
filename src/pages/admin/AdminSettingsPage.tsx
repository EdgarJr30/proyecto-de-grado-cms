import { Navigate } from 'react-router-dom';

export default function AdminSettingsPage() {
  // const { search } = useLocation();
  return <Navigate to={`/admin/settings${'?tab=general'}`} replace />;
}
