import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import { Bell, CalendarClock, CheckCircle2, ChevronDown } from 'lucide-react';
import { useUser } from '../context/UserContext';

export default function DashboardPage() {
  const [now, setNow] = useState<Date>(() => new Date());

  const { profile } = useUser();

  const userName = useMemo(() => {
    if (!profile) return 'Usuario';

    const p = profile as Partial<{
      full_name: string;
      name: string;
      last_name: string;
      email: string;
    }>;

    if (p.full_name && p.full_name.trim().length > 0) {
      return p.full_name;
    }

    if (p.name && p.last_name) {
      const full = `${p.name} ${p.last_name}`.trim();
      if (full.length > 0) return full;
    }

    if (p.name && p.name.trim().length > 0) {
      return p.name;
    }

    if (p.email && p.email.trim().length > 0) {
      return p.email;
    }

    return 'Usuario';
  }, [profile]);

  // Acordeones
  const [isHowToOpen, setIsHowToOpen] = useState(false);
  const [isResponsibleOpen, setIsResponsibleOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isBestPracticesOpen, setIsBestPracticesOpen] = useState(false);

  // Actualizar fecha/hora cada minuto
  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => clearInterval(intervalId);
  }, []);

  const formattedDate = useMemo(
    () =>
      new Intl.DateTimeFormat('es-DO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(now),
    [now]
  );

  const formattedTime = useMemo(
    () =>
      new Intl.DateTimeFormat('es-DO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now),
    [now]
  );

  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />

      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        {/* Contenido principal del Home */}
        <div className="flex-1 overflow-auto px-4 md:px-6 lg:px-8 pb-8">
          {/* padding extra arriba en mobile para no chocar con el menú */}
          <div className="max-w-6xl mx-auto pt-16 sm:pt-6 pb-6 space-y-6">
            {/* Bloque de bienvenida */}
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 text-white shadow-md">
              <div className="absolute inset-y-0 right-0 opacity-20 pointer-events-none">
                <div className="h-full w-64 bg-[radial-gradient(circle_at_top,_#ffffff55,_transparent_60%)]" />
              </div>

              <div className="relative z-10 px-5 sm:px-8 py-6 sm:py-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                <div className="space-y-2">
                  <h1 className="text-2xl sm:text-3xl font-semibold leading-tight">
                    Bienvenido, <span className="font-bold">{userName}</span>
                  </h1>
                  <p className="text-sm sm:text-base text-blue-100/90 max-w-xl">
                    Esta es la página de inicio de la plataforma. Utiliza el
                    menú lateral para seleccionar el módulo al que necesitas
                    ingresar y continuar con tus gestiones. Aquí encontrarás un
                    resumen general e información útil para tu día a día.
                  </p>
                </div>

                <div className="shrink-0">
                  <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm border border-white/20">
                    <div className="flex items-center gap-2 text-xs font-medium text-blue-50 mb-1">
                      <CalendarClock className="h-4 w-4" />
                      <span>Fecha y hora actual</span>
                    </div>
                    <p className="text-sm font-semibold">
                      {formattedDate.charAt(0).toUpperCase() +
                        formattedDate.slice(1)}
                    </p>
                    <p className="text-2xl font-bold tracking-wide mt-1">
                      {formattedTime}{' '}
                      <span className="text-xs font-normal text-blue-100">
                        hrs
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Layout principal: Guía + Notificaciones */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Columna izquierda: contenido genérico para todos los usuarios */}
              <div className="lg:col-span-2 space-y-4">
                {/* Guía rápida (acordeón) */}
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setIsHowToOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between gap-3 px-5 sm:px-6 py-4 sm:py-5 hover:bg-gray-50 transition-colors rounded-2xl"
                    aria-expanded={isHowToOpen}
                  >
                    <div className="text-left">
                      <h2 className="text-lg font-semibold text-gray-900">
                        Cómo empezar
                      </h2>
                      <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        Recomendaciones breves para orientarte en el uso de la
                        plataforma.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="hidden sm:inline">
                        {isHowToOpen ? 'Ocultar' : 'Ver detalles'}
                      </span>
                      <ChevronDown
                        className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${
                          isHowToOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>

                  <div
                    className="px-5 sm:px-6 pb-5 sm:pb-6 overflow-hidden transition-all duration-300 ease-out"
                    style={{
                      maxHeight: isHowToOpen ? 600 : 0,
                      opacity: isHowToOpen ? 1 : 0,
                      transform: isHowToOpen
                        ? 'translateY(0)'
                        : 'translateY(-4px)',
                    }}
                  >
                    <p className="text-sm text-gray-500 mb-4 mt-1">
                      La plataforma está pensada para organizar la información y
                      el trabajo diario de forma clara y centralizada. Estas
                      pautas te pueden ayudar a sacarle el máximo provecho:
                    </p>

                    <ol className="space-y-3 text-sm">
                      <li className="flex gap-3">
                        <div className="mt-1 h-6 w-6 rounded-full bg-blue-50 flex items-center justify-center text-[11px] font-semibold text-blue-700">
                          1
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            Explora el menú lateral
                          </p>
                          <p className="text-gray-500">
                            Desde el panel izquierdo puedes acceder a los
                            distintos módulos disponibles. Selecciona el área
                            con la que necesites trabajar en este momento.
                          </p>
                        </div>
                      </li>

                      <li className="flex gap-3">
                        <div className="mt-1 h-6 w-6 rounded-full bg-indigo-50 flex items-center justify-center text-[11px] font-semibold text-indigo-700">
                          2
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            Revisa tus actividades pendientes
                          </p>
                          <p className="text-gray-500">
                            Dentro de cada módulo encontrarás listados, filtros
                            y vistas que te ayudarán a identificar rápidamente
                            las tareas, solicitudes o registros que requieren
                            atención.
                          </p>
                        </div>
                      </li>

                      <li className="flex gap-3">
                        <div className="mt-1 h-6 w-6 rounded-full bg-emerald-50 flex items-center justify-center text-[11px] font-semibold text-emerald-700">
                          3
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            Mantén la información al día
                          </p>
                          <p className="text-gray-500">
                            Registrar cambios, comentarios y estados de forma
                            clara facilita el trabajo en equipo, mejora la
                            coordinación y ayuda a que todos cuenten con la
                            misma versión de la información.
                          </p>
                        </div>
                      </li>

                      <li className="flex gap-3">
                        <div className="mt-1 h-6 w-6 rounded-full bg-slate-50 flex items-center justify-center text-[11px] font-semibold text-slate-700">
                          4
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            Vuelve a esta página cuando lo necesites
                          </p>
                          <p className="text-gray-500">
                            Puedes regresar a la página de inicio en cualquier
                            momento para orientarte, revisar mensajes generales
                            y consultar estas recomendaciones de uso.
                          </p>
                        </div>
                      </li>
                    </ol>
                  </div>
                </div>

                {/* Uso responsable (acordeón) */}
                <div className="rounded-2xl bg-slate-900 text-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setIsResponsibleOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between gap-3 px-5 sm:px-6 py-4 sm:py-5 hover:bg-slate-800/80 transition-colors rounded-2xl"
                    aria-expanded={isResponsibleOpen}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className="mt-0.5 rounded-full bg-white/10 p-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-300">
                          Uso responsable de la plataforma
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          Trabaja siempre con datos claros, completos y
                          consistentes
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-slate-200 transition-transform duration-200 ${
                        isResponsibleOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <div
                    className="px-5 sm:px-6 pb-5 sm:pb-6 overflow-hidden transition-all duration-300 ease-out"
                    style={{
                      maxHeight: isResponsibleOpen ? 260 : 0,
                      opacity: isResponsibleOpen ? 1 : 0,
                      transform: isResponsibleOpen
                        ? 'translateY(0)'
                        : 'translateY(-4px)',
                    }}
                  >
                    <p className="mt-1 text-xs sm:text-sm text-slate-300">
                      Antes de guardar o cerrar una gestión, verifica que la
                      información registrada sea precisa y esté actualizada.
                      Esto ayuda a que cualquier persona que consulte el sistema
                      pueda entender el contexto y tomar decisiones mejor
                      fundamentadas.
                    </p>
                  </div>
                </div>
              </div>

              {/* Columna derecha: Notificaciones / estado general */}
              <aside className="space-y-4">
                {/* Notificaciones generales (acordeón) */}
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setIsNotificationsOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 hover:bg-gray-50 transition-colors rounded-2xl"
                    aria-expanded={isNotificationsOpen}
                  >
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-blue-50 p-1.5">
                        <Bell className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="text-left">
                        <h2 className="text-sm font-semibold text-gray-900">
                          Notificaciones generales
                        </h2>
                        <span className="text-[11px] text-gray-400">
                          Información de referencia
                        </span>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${
                        isNotificationsOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <div
                    className="px-4 pb-4 overflow-hidden transition-all duration-300 ease-out"
                    style={{
                      maxHeight: isNotificationsOpen ? 260 : 0,
                      opacity: isNotificationsOpen ? 1 : 0,
                      transform: isNotificationsOpen
                        ? 'translateY(0)'
                        : 'translateY(-4px)',
                    }}
                  >
                    <ul className="space-y-2.5 text-xs mt-2">
                      <li className="flex gap-2">
                        <span className="mt-0.5 h-2 w-2 rounded-full bg-green-500" />
                        <div>
                          <p className="font-medium text-gray-800">
                            La plataforma se encuentra disponible.
                          </p>
                          <p className="text-gray-500">
                            Puedes navegar por los módulos habilitados desde el
                            menú lateral y continuar con tus actividades.
                          </p>
                        </div>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-0.5 h-2 w-2 rounded-full bg-amber-400" />
                        <div>
                          <p className="font-medium text-gray-800">
                            Revisa periódicamente tus pendientes.
                          </p>
                          <p className="text-gray-500">
                            Mantener tus tareas y registros al día contribuye a
                            un flujo de trabajo más ordenado y predecible.
                          </p>
                        </div>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-0.5 h-2 w-2 rounded-full bg-blue-400" />
                        <div>
                          <p className="font-medium text-gray-800">
                            Aprovecha las herramientas de búsqueda y filtros.
                          </p>
                          <p className="text-gray-500">
                            En cada módulo podrás localizar rápidamente la
                            información que necesitas para trabajar de forma más
                            ágil y enfocada.
                          </p>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Buenas prácticas (acordeón) */}
                <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setIsBestPracticesOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 hover:bg-slate-900/70 transition-colors rounded-2xl"
                    aria-expanded={isBestPracticesOpen}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-white/10 p-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-300">
                          Buenas prácticas
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          Documenta comentarios y decisiones importantes
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-slate-100 transition-transform duration-200 ${
                        isBestPracticesOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <div
                    className="px-4 pb-4 overflow-hidden transition-all duration-300 ease-out"
                    style={{
                      maxHeight: isBestPracticesOpen ? 220 : 0,
                      opacity: isBestPracticesOpen ? 1 : 0,
                      transform: isBestPracticesOpen
                        ? 'translateY(0)'
                        : 'translateY(-4px)',
                    }}
                  >
                    <p className="mt-1 text-xs text-slate-300">
                      Siempre que registres o edites información, añade notas
                      claras sobre el contexto y las decisiones tomadas. Esto
                      facilita el trabajo colaborativo y deja un historial útil
                      para futuras consultas, incluso cuando otras personas se
                      incorporan al proceso más adelante.
                    </p>
                  </div>
                </div>
              </aside>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
