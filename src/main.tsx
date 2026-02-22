import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from './context/AuthContext';
import { UserProvider } from './context/UserContext';
import { AssigneeProvider } from './context/AssigneeContext';
import { PermissionsProvider } from './rbac/PermissionsContext';
import { SettingsProvider } from './context/SettingsContext';
import { BrandingProvider } from './context/BrandingContext';
import { ThemeProvider } from './context/ThemeContext';
import ThemedAppRoot from './components/app/ThemedAppRoot';

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
    <ThemeProvider>
      <AuthProvider>
        <UserProvider>
          <AssigneeProvider>
            <BrowserRouter>
              <PermissionsProvider>
                <SettingsProvider>
                  <BrandingProvider>
                    <ThemedAppRoot />
                  </BrandingProvider>
                </SettingsProvider>
              </PermissionsProvider>
            </BrowserRouter>
          </AssigneeProvider>
        </UserProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
