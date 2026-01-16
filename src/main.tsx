import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { APP_ROUTES, PUBLIC_ROUTES } from './components/Routes/appRoutes';
import RequirePerm from './components/Routes/RequirePerm';
import ProtectedRoute from './components/Routes/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { UserProvider } from './context/UserContext';
import { AssigneeProvider } from './context/AssigneeContext';
import { PermissionsProvider } from './rbac/PermissionsContext';
import { SettingsProvider } from './context/SettingsContext';

// Vacía todos los logs en desarrollo
if (process.env.NODE_ENV !== 'development') {
  console.log = function () {};
  console.warn = function () {};
  console.table = function () {};
  console.error = function () {};
}

console.log('🚀 Aplicación iniciada en modo:', process.env.NODE_ENV);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <UserProvider>
        <AssigneeProvider>
          <BrowserRouter>
            <PermissionsProvider>
              <SettingsProvider>
                <ToastContainer
                  position="top-right"
                  autoClose={3000}
                  hideProgressBar={false}
                  newestOnTop={false}
                  closeOnClick
                  pauseOnFocusLoss
                  draggable
                  pauseOnHover
                  theme="colored"
                />
                <Routes>
                  {/* Públicas / especiales */}
                  {PUBLIC_ROUTES.map((r) => (
                    <Route key={r.path} path={r.path} element={r.element} />
                  ))}

                  {/* Protegidas dinamicamente */}
                  {APP_ROUTES.map((r) => (
                    <Route
                      key={r.path}
                      path={r.path}
                      element={
                        <ProtectedRoute>
                          <RequirePerm allow={r.allowPerms}>
                            {r.element}
                          </RequirePerm>
                        </ProtectedRoute>
                      }
                    />
                  ))}

                  {/* comodín */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </SettingsProvider>
            </PermissionsProvider>
          </BrowserRouter>
        </AssigneeProvider>
      </UserProvider>
    </AuthProvider>
  </React.StrictMode>
);
