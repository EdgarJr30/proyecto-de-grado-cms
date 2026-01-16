import { useEffect } from 'react';

const ASANA_FORM_URL =
  'https://form.asana.com/?k=yoNNn_LWiiGH7LV6dmw9AA&d=1201531866976536';

export default function CreateTicketRedirectPage() {
  useEffect(() => {
    window.location.replace(ASANA_FORM_URL);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">
          Redirigiendo a Asana...
        </h1>
        <p className="text-sm text-gray-600 mt-2">
          Ahora las solicitudes de mantenimiento se crean en Asana.
        </p>

        <a
          href={ASANA_FORM_URL}
          className="inline-flex mt-4 text-sm text-blue-600 hover:underline"
          rel="noreferrer"
        >
          Si no redirige automáticamente, haz clic aquí.
        </a>
      </div>
    </div>
  );
}
