import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../../../components/layout/Sidebar';
import { useCan } from '../../../../rbac/PermissionsContext';
import {
  getActiveWarehouses,
  getActiveWarehouseAreas,
  type WarehouseDto,
  type WarehouseAreaDto,
} from '../../../../services/inventoryService';

type WarehouseCard = {
  id: number;
  code: string;
  name: string;
};

type WarehouseAreaCard = {
  id: number;
  code: string;
  name: string;
  warehouseCode: string;
  warehouseName: string;
};

type ViewMode = 'warehouses' | 'areas';

export default function InventoryHomePage() {
  const navigate = useNavigate();

  // Solo usuarios con alguno de estos permisos verán el botón
  const canSeeAuditAdmin = useCan([
    'inventory_adjustments:full_access',
    'inventory_adjustments:read',
  ]);

  const [viewMode, setViewMode] = useState<ViewMode>('warehouses');
  const [warehouses, setWarehouses] = useState<WarehouseCard[]>([]);
  const [areas, setAreas] = useState<WarehouseAreaCard[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const handleOpenWarehouse = (warehouseCode: string) => {
    navigate(`/osalm/conteos_inventario/almacen/${warehouseCode}`);
  };

  const handleOpenArea = (warehouseCode: string, areaCode: string) => {
    navigate(
      `/osalm/conteos_inventario/almacen/${warehouseCode}?area=${encodeURIComponent(
        areaCode
      )}`
    );
  };

  const handleOpenMaster = () => {
    navigate('/osalm/conteos_inventario/maestra');
  };

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [warehousesData, areasData] = await Promise.all([
          getActiveWarehouses(),
          getActiveWarehouseAreas(),
        ]);

        if (!isMounted) return;

        // ============================================
        // 1) MAPEAR ALMACENES + ORDENAR POR CÓDIGO 1,2,3...
        // ============================================
        const mappedWarehouses: WarehouseCard[] = (
          warehousesData as WarehouseDto[]
        ).map((w) => ({
          id: w.id,
          code: w.code,
          name: w.name,
        }));

        // Extraer prefijo y número de un código tipo "OC07", "OC02", "OC"
        const parseWarehouseCode = (
          code: string
        ): { prefix: string; num: number | null } => {
          const prefixMatch = code.match(/^[A-Za-z-]+/);
          const prefix = prefixMatch ? prefixMatch[0] : code;
          const numMatch = code.match(/(\d+)/);
          const num = numMatch ? Number(numMatch[1]) : null;
          return { prefix, num: Number.isNaN(num as number) ? null : num };
        };

        mappedWarehouses.sort((a, b) => {
          const pa = parseWarehouseCode(a.code);
          const pb = parseWarehouseCode(b.code);

          // 1) Agrupar por prefijo (OC, PAP, CF, etc.)
          if (pa.prefix !== pb.prefix) {
            return pa.prefix.localeCompare(pb.prefix);
          }

          // 2) Dentro del mismo prefijo, ordenar por número
          const aHasNum = pa.num !== null;
          const bHasNum = pb.num !== null;

          if (aHasNum && bHasNum)
            return (pa.num as number) - (pb.num as number);
          if (aHasNum) return -1; // con número primero
          if (bHasNum) return 1; // sin número al final

          // 3) Si ninguno tiene número, ordenar por nombre
          return a.name.localeCompare(b.name);
        });

        // ============================================
        // 2) MAPEAR ÁREAS + ORDEN AVANZADO
        // ============================================
        const mappedAreas: WarehouseAreaCard[] = (
          areasData as WarehouseAreaDto[]
        ).map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          warehouseCode: a.warehouseCode,
          warehouseName: a.warehouseName,
        }));

        const getNumericFromCode = (code: string): number | null => {
          const match = code.match(/\d+/);
          if (!match) return null;
          const n = Number(match[0]);
          return Number.isNaN(n) ? null : n;
        };

        mappedAreas.sort((a, b) => {
          // 1) Agrupar por código de almacén
          if (a.warehouseCode !== b.warehouseCode) {
            return a.warehouseCode.localeCompare(b.warehouseCode);
          }

          // 2) Ordenar por número dentro del área
          const numA = getNumericFromCode(a.code);
          const numB = getNumericFromCode(b.code);

          const aHasNum = numA !== null;
          const bHasNum = numB !== null;

          if (aHasNum && bHasNum) return (numA as number) - (numB as number);
          if (aHasNum) return -1;
          if (bHasNum) return 1;

          // 3) Si ninguno tiene número: ordenar por nombre
          return a.name.localeCompare(b.name);
        });

        // GUARDAR ESTADOS
        setWarehouses(mappedWarehouses);
        setAreas(mappedAreas);
      } catch (err: unknown) {
        if (!isMounted) return;

        if (err instanceof Error) {
          console.error('❌ Error al cargar almacenes/áreas:', err.message);
          setError(err.message);
        } else {
          console.error('❌ Error desconocido al cargar almacenes/áreas:', err);
          setError('Ocurrió un error al cargar los datos de inventario.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  const currentCount =
    viewMode === 'warehouses' ? warehouses.length : areas.length;

  const countLabel = loading
    ? viewMode === 'warehouses'
      ? 'Cargando almacenes…'
      : 'Cargando áreas…'
    : currentCount === 0
    ? viewMode === 'warehouses'
      ? 'Sin almacenes activos'
      : 'Sin áreas activas'
    : currentCount === 1
    ? viewMode === 'warehouses'
      ? '1 almacén activo'
      : '1 área activa'
    : viewMode === 'warehouses'
    ? `almacenes activos`
    : `áreas activas`;

  const titleLabel =
    viewMode === 'warehouses'
      ? 'Almacenes disponibles'
      : 'Áreas de almacén disponibles';

  const subtitleLabel =
    viewMode === 'warehouses'
      ? 'Elige un almacén para ver y gestionar sus conteos de inventario.'
      : 'Elige un área específica para realizar conteos de inventario más precisos.';

  const cardTypeLabel = viewMode === 'warehouses' ? 'Almacén' : 'Área';

  return (
    <div className="min-h-screen flex bg-gray-100">
      <Sidebar />

      <main className="flex flex-col flex-1 h-[100dvh] bg-gray-100 overflow-hidden">
        <header className="bg-blue-600 text-white shadow-sm">
          <div className="pl-16 pr-4 sm:px-6 lg:px-10 py-4 sm:py-5 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
                Inventario Auditoría
              </h1>
            </div>

            {canSeeAuditAdmin && (
              <button
                type="button"
                onClick={() =>
                  navigate('/osalm/conteos_inventario/auditoria/almacenes')
                }
                className="inline-flex items-center gap-2 rounded-full bg-white/95 text-blue-700 px-4 py-2 text-xs sm:text-sm font-semibold shadow-sm hover:bg-white transition cursor-pointer"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-base">
                  ⚙️
                </span>
                <span>Administración de auditoría</span>
              </button>
            )}
          </div>
        </header>

        <section className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 max-w-6xl mx-auto">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
              <div>
                <h2 className="text-sm sm:text-lg font-semibold text-gray-800">
                  {titleLabel}
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  {subtitleLabel}
                </p>

                <div className="mt-3 inline-flex rounded-full bg-gray-100 p-0.5 border border-gray-200">
                  {/* Almacenes */}
                  <button
                    type="button"
                    onClick={() => setViewMode('warehouses')}
                    className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-full font-medium transition cursor-pointer ${
                      viewMode === 'warehouses'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Almacenes
                  </button>

                  {/* Áreas */}
                  <button
                    type="button"
                    onClick={() => setViewMode('areas')}
                    className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-full font-medium transition cursor-pointer ${
                      viewMode === 'areas'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Áreas
                  </button>

                  {/* Maestra (solo con permisos) */}
                  {canSeeAuditAdmin && (
                    <button
                      type="button"
                      onClick={handleOpenMaster}
                      className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-full font-medium transition cursor-pointer
                 text-gray-500 hover:text-gray-700 hover:bg-white"
                    >
                      Maestra
                    </button>
                  )}
                </div>
              </div>

              <div className="inline-flex items-center rounded-2xl bg-white border border-gray-200 shadow-sm px-3 py-2 sm:px-4 sm:py-2.5">
                <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50">
                  <span className="text-sm">
                    {viewMode === 'warehouses' ? '🏬' : '📍'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    {viewMode === 'warehouses'
                      ? 'Estado de almacenes'
                      : 'Estado de áreas'}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base sm:text-lg font-semibold text-gray-600">
                      {loading ? '—' : currentCount}
                    </span>
                    <span className="text-[11px] sm:text-xs text-gray-500">
                      {countLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs sm:text-sm text-red-700">
                Ocurrió un problema al cargar los datos: {error}
              </div>
            )}

            {!loading &&
              !error &&
              ((viewMode === 'warehouses' && warehouses.length === 0) ||
                (viewMode === 'areas' && areas.length === 0)) && (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-6 sm:px-6 sm:py-8 text-center text-sm sm:text-base text-gray-500">
                  {viewMode === 'warehouses'
                    ? 'No hay almacenes activos configurados para conteos de inventario.'
                    : 'No hay áreas activas configuradas para conteos de inventario.'}
                </div>
              )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 pb-8">
              {/* Skeletons */}
              {loading &&
                Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="animate-pulse flex flex-col gap-2 rounded-2xl bg-white px-4 py-4 sm:px-5 sm:py-5 shadow-sm border border-gray-100"
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <div className="h-4 w-16 rounded-full bg-gray-200" />
                      <div className="h-3 w-20 rounded-full bg-gray-200" />
                    </div>
                    <div className="h-4 w-3/4 rounded bg-gray-200" />
                    <div className="h-3 w-1/2 rounded bg-gray-200 mt-2" />
                    <div className="h-3 w-1/3 rounded bg-gray-200 mt-3" />
                  </div>
                ))}

              {/* Tarjetas de almacenes */}
              {!loading &&
                !error &&
                viewMode === 'warehouses' &&
                warehouses.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => handleOpenWarehouse(w.code)}
                    className="group relative flex flex-col items-start gap-2 rounded-2xl bg-white px-4 py-4 sm:px-5 sm:py-5 shadow-sm border border-gray-100
                               hover:shadow-md hover:border-blue-200 hover:-translate-y-0.5 transition-all text-left cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-600 text-[11px] sm:text-xs px-2 py-0.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                        {cardTypeLabel}
                      </span>
                      <span className="text-[11px] sm:text-xs text-gray-400">
                        Código: {w.code}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 group-hover:text-blue-700 line-clamp-2">
                      {w.name}
                    </h3>

                    <p className="mt-1 text-xs sm:text-sm text-gray-500">
                      Almacén activo para conteos de inventario.
                    </p>

                    <div className="mt-3 flex items-center gap-1 text-[11px] sm:text-xs text-blue-600 font-medium">
                      Ver detalle del almacén
                      <span className="transition-transform group-hover:translate-x-0.5">
                        →
                      </span>
                    </div>
                  </button>
                ))}

              {/* Tarjetas de áreas */}
              {!loading &&
                !error &&
                viewMode === 'areas' &&
                areas.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleOpenArea(a.warehouseCode, a.code)}
                    className="group relative flex flex-col items-start gap-2 rounded-2xl bg-white px-4 py-4 sm:px-5 sm:py-5 shadow-sm border border-gray-100
                               hover:shadow-md hover:border-emerald-200 hover:-translate-y-0.5 transition-all text-left cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-600 text-[11px] sm:text-xs px-2 py-0.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Área
                      </span>
                      <span className="text-[11px] sm:text-xs text-gray-400">
                        {a.warehouseCode} · {a.code}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 group-hover:text-emerald-700 line-clamp-2">
                      {a.name}
                    </h3>

                    <p className="mt-1 text-[11px] sm:text-xs text-gray-500">
                      Área activa para conteos de inventario en este almacén.
                    </p>

                    <div className="mt-3 flex items-center gap-1 text-[11px] sm:text-xs text-emerald-600 font-medium">
                      Ver conteos del área
                      <span className="transition-transform group-hover:translate-x-0.5">
                        →
                      </span>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
