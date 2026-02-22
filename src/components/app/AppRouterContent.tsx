import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { APP_ROUTES, PUBLIC_ROUTES } from '../../Routes/appRoutes';
import RequirePerm from '../../Routes/RequirePerm';
import ProtectedRoute from '../../Routes/ProtectedRoute';
import AppRouteNotifier from './AppRouteNotifier';

export default function AppRouterContent() {
  const location = useLocation();

  return (
    <>
      <AppRouteNotifier />
      <Routes key={location.pathname}>
        {PUBLIC_ROUTES.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}

        {APP_ROUTES.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              <ProtectedRoute>
                <RequirePerm allow={route.allowPerms}>{route.element}</RequirePerm>
              </ProtectedRoute>
            }
          />
        ))}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
