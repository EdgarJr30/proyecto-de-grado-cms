import { useEffect, useState, type KeyboardEventHandler } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import Sidebar from '../../../../components/layout/Sidebar';
import { useCan } from '../../../../rbac/PermissionsContext';
import {
  getInventoryAuditSessions,
  type AuditSession,
  type AuditStatus,
} from '../../../../services/inventoryCountsService';

type AuditHistoryTab = 'warehouses' | 'areas';

export default function InventoryAuditWarehousePage() {
  const navigate = useNavigate();

  // Solo auditores ven esta pantalla
  const canManageAudit = useCan([
    'inventory_adjustments:full_access',
    'inventory_adjustments:read',
  ]);

  const [sessions, setSessions] = useState<AuditSession[]>([]);
  // const [activeTab, setActiveTab] = useState<AuditHistoryTab>('warehouses');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const urlTab = searchParams.get('tab');
  const initialTab: AuditHistoryTab =
    urlTab === 'areas' || urlTab === 'warehouses' ? urlTab : 'warehouses';

  const [activeTab, setActiveTab] = useState<AuditHistoryTab>(initialTab);

  useEffect(() => {
    setSearchParams({ tab: activeTab }, { replace: true });
  }, [activeTab, setSearchParams]);

  const filteredSessions = sessions.filter((s) =>
    activeTab === 'warehouses' ? !s.isArea : s.isArea
  );

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getInventoryAuditSessions();
        if (!isMounted) return;
        setSessions(data);
      } catch (err: unknown) {
        if (!isMounted) return;
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Error cargando el historial de auditorías');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (canManageAudit) {
      void load();
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [canManageAudit]);

  if (!canManageAudit) {
    return (
      <div className="h-screen flex bg-gray-100">
        <Sidebar />
        <main className="flex flex-col flex-1 h-[100dvh] bg-gray-100 overflow-hidden">
          <header className="bg-blue-600 text-white shadow-sm">
            <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-5 flex items-center justify-between gap-4 max-w-6xl mx-auto w-full">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
                  Inventario Auditoría
                </h1>
                <p className="text-sm sm:text-base mt-1 opacity-90">
                  Acceso restringido
                </p>
              </div>
            </div>
          </header>
          <section className="flex-1 flex items-center justify-center">
            <p className="text-gray-600 text-sm sm:text-base text-center px-4">
              No tienes permisos para administrar las auditorías de almacenes.
            </p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />

      <main className="flex flex-col flex-1 h-[100dvh] bg-gray-100 overflow-hidden">
        <header className="bg-blue-600 text-white shadow-sm pt-16 sm:pt-6">
          <div className="px-4 sm:px-6 lg:px-10 pb-4 sm:pb-5 max-w-6xl mx-auto w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.16em] text-blue-100/80">
                Auditoría de inventario
              </p>
              <h1 className="mt-1 text-xl sm:text-2xl md:text-3xl font-bold leading-tight break-words">
                Inventario Auditoría
              </h1>
              <p className="text-sm sm:text-base mt-1 opacity-90">
                Administración de auditorías de almacenes.
              </p>
            </div>

            <div className="flex justify-end sm:justify-end">
              <button
                type="button"
                onClick={() => navigate('/osalm/conteos_inventario')}
                className="inline-flex items-center gap-2 rounded-full bg-white/95 text-blue-700 px-4 py-2 text-xs sm:text-sm font-semibold shadow-sm hover:bg-white transition shrink-0 cursor-pointer"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-base">
                  ←
                </span>
                <span className="whitespace-nowrap">Volver</span>
              </button>
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 max-w-6xl mx-auto w-full">
            {/* Tabs: Almacenes / Áreas */}
            <div className="mt-1 border-b border-gray-200">
              <div className="w-full overflow-x-auto">
                <div className="inline-flex rounded-full bg-gray-100 p-1 text-xs sm:text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => setActiveTab('warehouses')}
                    className={[
                      'px-4 py-1.5 rounded-full whitespace-nowrap cursor-pointer',
                      activeTab === 'warehouses'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700',
                    ].join(' ')}
                  >
                    Almacenes
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('areas')}
                    className={[
                      'px-4 py-1.5 rounded-full whitespace-nowrap cursor-pointer',
                      activeTab === 'areas'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700',
                    ].join(' ')}
                  >
                    Áreas
                  </button>
                </div>
              </div>
            </div>

            {/* Title: history */}
            <div className="mt-6">
              <h3 className="text-[11px] sm:text-xs font-semibold tracking-[0.14em] text-gray-500">
                {activeTab === 'warehouses'
                  ? 'HISTORIAL DE AUDITORÍAS POR ALMACÉN'
                  : 'HISTORIAL DE AUDITORÍAS POR ÁREA'}
              </h3>
            </div>

            {/* Estados de carga / error */}
            {loading && (
              <div className="mt-4 text-sm text-gray-500">
                Cargando auditorías...
              </div>
            )}

            {error && !loading && (
              <div className="mt-4 text-sm text-red-500">{error}</div>
            )}

            {/* Sessions list */}
            {!loading && !error && (
              <div className="mt-3 flex flex-col gap-3 sm:gap-4 pb-16">
                {filteredSessions.length === 0 && (
                  <p className="text-sm text-gray-500">
                    {activeTab === 'warehouses'
                      ? 'No hay jornadas de auditoría por almacén todavía.'
                      : 'No hay jornadas de auditoría por área todavía.'}
                  </p>
                )}

                {filteredSessions.map((session) => (
                  <AuditSessionCard key={session.id} session={session} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function AuditSessionCard({ session }: { session: AuditSession }) {
  const navigate = useNavigate();
  const location = useLocation();

  const statusConfig: Record<
    AuditStatus,
    { label: string; textColor: string; iconRing: string }
  > = {
    completed: {
      label: 'Completado',
      textColor: 'text-green-600',
      iconRing: 'border-green-500',
    },
    in_progress: {
      label: 'En Progreso',
      textColor: 'text-blue-600',
      iconRing: 'border-blue-500',
    },
    pending: {
      label: 'Pendiente',
      textColor: 'text-amber-500',
      iconRing: 'border-amber-400',
    },
  };

  const cfg = statusConfig[session.status];

  const isArea = session.isArea;
  const mainTitle = isArea
    ? session.areaName ?? 'Área de almacén'
    : session.warehouse;

  const subtitle = isArea
    ? `${session.warehouse}${session.areaCode ? ` · ${session.areaCode}` : ''}`
    : session.warehouseCode
    ? `Código: ${session.warehouseCode}`
    : undefined;

  const handleClick = () => {
    navigate(
      `/osalm/conteos_inventario/auditoria/almacenes/${session.id}${location.search}`
    );
  };

  const handleKeyDown: KeyboardEventHandler<HTMLElement> = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="bg-white rounded-2xl shadow-sm px-4 py-4 sm:px-6 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
    >
      {/* Info izquierda */}
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm text-gray-500 tracking-wide">
          <span className="font-medium">{session.date}</span>
          <span className="mx-2 hidden sm:inline">•</span>
          <span className="block sm:inline">{session.time}</span>
        </p>

        <h4 className="mt-1 text-lg sm:text-xl font-semibold text-gray-900 truncate">
          {mainTitle}
        </h4>

        {subtitle && (
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{subtitle}</p>
        )}

        <p className="mt-1 text-sm text-gray-500">
          {session.itemsAudited} items auditados
        </p>
      </div>

      {/* Estado derecha */}
      <div className="flex items-center sm:items-end justify-between sm:justify-end gap-3">
        <div className="flex flex-col items-end gap-1 min-w-[110px]">
          <div
            className={[
              'flex items-center justify-center h-10 w-10 rounded-full border-2 bg-white',
              cfg.iconRing,
            ].join(' ')}
          >
            {session.status === 'completed' && (
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-green-500 text-white text-xl leading-none">
                ✓
              </span>
            )}

            {session.status === 'pending' && (
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-amber-400 text-white text-xl leading-none">
                ⏱
              </span>
            )}

            {session.status === 'in_progress' && (
              <span className="flex items-center justify-center h-5 w-5 rounded-full border-2 border-blue-500 bg-blue-50">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              </span>
            )}
          </div>
          <span
            className={[
              'text-sm font-medium mt-1 text-right',
              cfg.textColor,
            ].join(' ')}
          >
            {cfg.label}
          </span>
        </div>
      </div>
    </article>
  );
}
