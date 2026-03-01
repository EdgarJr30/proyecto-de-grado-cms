import { Suspense } from 'react';
import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import { APP_ROUTES, PUBLIC_ROUTES } from '../../Routes/appRoutes';
import RequirePerm from '../../Routes/RequirePerm';
import ProtectedRoute from '../../Routes/ProtectedRoute';
import AppRouteNotifier from './AppRouteNotifier';
import ScreenLoader from '../ui/ScreenLoader';

export default function AppRouterContent() {
  return (
    <>
      <AppRouteNotifier />
      <Suspense
        fallback={
          <ScreenLoader
            fullScreen
            title="Cargando vista"
            hint="Aplicando transicion y montando modulos..."
          />
        }
      >
        <Routes>
          {PUBLIC_ROUTES.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}

          <Route element={<ProtectedRoute />}>
            {APP_ROUTES.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <RequirePerm allow={route.allowPerms}>{route.element}</RequirePerm>
                }
              />
            ))}
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
