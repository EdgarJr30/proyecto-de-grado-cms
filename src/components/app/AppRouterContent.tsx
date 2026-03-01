import { Suspense } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { APP_ROUTES, PUBLIC_ROUTES } from '../../Routes/appRoutes';
import RequirePerm from '../../Routes/RequirePerm';
import ProtectedRoute from '../../Routes/ProtectedRoute';
import AppRouteNotifier from './AppRouteNotifier';
import ScreenLoader from '../ui/ScreenLoader';

export default function AppRouterContent() {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  return (
    <>
      <AppRouteNotifier />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={
            prefersReducedMotion
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 10 }
          }
          animate={{ opacity: 1, y: 0 }}
          exit={
            prefersReducedMotion
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: -8 }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
          }
          style={{ willChange: 'opacity, transform' }}
        >
          <Suspense
            fallback={
              <ScreenLoader
                fullScreen
                title="Cargando vista"
                hint="Aplicando transicion y montando modulos..."
              />
            }
          >
            <Routes location={location}>
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
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
