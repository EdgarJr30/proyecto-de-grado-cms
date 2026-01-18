import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DefaultLogo from '../assets/logo.png';
import DefaultCollage from '../assets/login_img.png';
import AppVersion from '../components/ui/AppVersion';
import { getSession, signInWithPassword } from '../utils/auth';
import { usePermissions } from '../rbac/PermissionsContext';
import { useBranding } from '../context/BrandingContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { refresh } = usePermissions();

  const { societyName, logoSrc, loginImgSrc } = useBranding();

  const finalLogo = logoSrc ?? DefaultLogo;
  const finalCollage = loginImgSrc ?? DefaultCollage;

  // Si ya está autenticado, redirige
  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const { data, error } = await getSession();
        if (!active) return;

        if (error) {
          console.error('[LoginPage] getSession error:', error.message);
          return;
        }

        const user = data.session?.user;
        if (user) {
          await refresh({ silent: false });
          navigate('/inicio', { replace: true });
        }
      } catch (e) {
        console.error('[LoginPage] getSession threw:', e);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [navigate, refresh]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const { data, error } = await signInWithPassword(email.trim(), password);

      if (error) {
        const msg = error.message?.toLowerCase() || '';
        setError(
          msg.includes('invalid login credentials')
            ? 'Correo o contraseña incorrectos.'
            : error.message || 'No se pudo iniciar sesión.'
        );
        return;
      }

      if (data.session?.user) {
        await refresh({ silent: false });
        navigate('/inicio', { replace: true });
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error inesperado al iniciar sesión'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-[100dvh]">
      <div className="flex flex-1 flex-col justify-center px-4 py-8 sm:py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div>
            {/* Evita flash: si no hay logo en cache todavía, muestra skeleton */}
            {logoSrc ? (
              <img
                src={finalLogo}
                alt="Logo"
                className="h-14 sm:h-16 lg:h-20 w-auto mb-2"
              />
            ) : (
              <div className="h-14 w-40 rounded bg-gray-200 animate-pulse mb-2" />
            )}

            <h2 className="mt-8 text-2xl/9 font-bold tracking-tight text-gray-900">
              {societyName}
            </h2>
          </div>

          <div className="mt-6 sm:mt-10">
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm/6 font-medium text-gray-900"
                >
                  Correo electrónico
                </label>
                <div className="mt-2">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Correo electrónico"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm/6 font-medium text-gray-900"
                >
                  Contraseña
                </label>
                <div className="mt-2">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60"
                >
                  {submitting ? 'Iniciando...' : 'Iniciar Sesión'}
                </button>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}
            </form>

            <p className="mt-10 text-center text-sm/6 text-gray-500">
              Desarrollado por{' '}
              <span className="font-semibold text-indigo-600">Mooncode</span>
            </p>
            <AppVersion className="text-center mt-4" />
          </div>
        </div>
      </div>

      <div className="relative hidden w-0 flex-1 lg:block">
        <img
          alt="Collage MLM"
          src={finalCollage}
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
      </div>
    </div>
  );
}
