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

let numericInputNormalizationAttached = false;

function isNumericLikeInput(target: EventTarget | null): target is HTMLInputElement {
  if (!(target instanceof HTMLInputElement)) return false;
  if (target.disabled || target.readOnly) return false;

  const type = target.type.toLowerCase();
  const inputMode = (target.getAttribute('inputmode') ?? '').toLowerCase();

  return type === 'number' || inputMode === 'numeric' || inputMode === 'decimal';
}

function normalizeNumericString(value: string): string | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return '';

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;

  return String(Object.is(parsed, -0) ? 0 : parsed);
}

function normalizeLeadingZerosForInteger(value: string): string | null {
  if (!/^\d+$/.test(value)) return null;
  const normalized = value.replace(/^0+(?=\d)/, '');
  return normalized === value ? null : normalized;
}

function setupGlobalNumericInputNormalization() {
  if (numericInputNormalizationAttached || typeof document === 'undefined') return;
  numericInputNormalizationAttached = true;

  document.addEventListener(
    'input',
    (event: Event) => {
      if (!isNumericLikeInput(event.target)) return;

      const normalized = normalizeLeadingZerosForInteger(event.target.value);
      if (normalized === null) return;

      event.target.value = normalized;
    },
    true
  );

  document.addEventListener(
    'blur',
    (event: FocusEvent) => {
      if (!isNumericLikeInput(event.target)) return;

      const normalized = normalizeNumericString(event.target.value);
      if (normalized === null || normalized === event.target.value) return;

      event.target.value = normalized;
      event.target.dispatchEvent(new Event('input', { bubbles: true }));
    },
    true
  );
}

// Vacía todos los logs en desarrollo
if (process.env.NODE_ENV !== 'development') {
  console.log = function () {};
  console.warn = function () {};
  console.table = function () {};
  console.error = function () {};
}

console.log('🚀 Aplicación iniciada en modo:', process.env.NODE_ENV);
setupGlobalNumericInputNormalization();

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
