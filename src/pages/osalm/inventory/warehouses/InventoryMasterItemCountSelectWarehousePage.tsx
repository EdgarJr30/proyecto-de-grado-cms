import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../../../../components/layout/Sidebar';
import {
  getActiveWarehouses,
  getWarehouseItemIdForItemInWarehouse,
} from '../../../../services/inventoryService';
import { showToastError } from '../../../../notifications';

type RouteParams = { itemId: string };

type LocationState =
  | {
      item?: { id: string; sku: string; name: string };
    }
  | undefined;

type WarehouseHeader = { id: number; code: string; name: string };

export default function InventoryMasterItemCountSelectWarehousePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;

  const { itemId } = useParams<RouteParams>();

  const [warehouses, setWarehouses] = useState<WarehouseHeader[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const item =
    state?.item ??
    (itemId
      ? { id: String(itemId), sku: '', name: '' }
      : { id: '', sku: '', name: '' });

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        const list = await getActiveWarehouses();

        if (!isMounted) return;

        setWarehouses(
          (list as Array<{ id: number; code: string; name: string }>).map(
            (w) => ({ id: w.id, code: w.code, name: w.name })
          )
        );
      } catch {
        if (!isMounted) return;
        showToastError('No se pudieron cargar los almacenes.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return warehouses;
    return warehouses.filter(
      (w) =>
        w.name.toLowerCase().includes(term) ||
        w.code.toLowerCase().includes(term)
    );
  }, [warehouses, search]);

  const handlePickWarehouse = async (w: WarehouseHeader) => {
    const numericItemId = Number(item.id);
    if (Number.isNaN(numericItemId)) {
      showToastError('Item inválido. Vuelve a intentar desde la maestra.');
      return;
    }

    try {
      const warehouseItemId = await getWarehouseItemIdForItemInWarehouse(
        w.id,
        numericItemId
      );

      if (!warehouseItemId) {
        showToastError(
          `El artículo no está configurado en el almacén ${w.code}.`
        );
        return;
      }

      navigate(
        `/osalm/conteos_inventario/almacen/${w.code}/articulo/${warehouseItemId}`
      );
    } catch {
      showToastError('No se pudo abrir el conteo del artículo.');
    }
  };

  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />

      <main className="flex flex-col flex-1 h-[100dvh] bg-gray-100 overflow-hidden">
        <header className="bg-blue-600 text-white shadow-sm pt-16 sm:pt-6">
          <div className="px-4 sm:px-6 lg:px-10 pb-4 sm:pb-5 max-w-6xl mx-auto w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight break-words">
                Seleccionar almacén para conteo
              </h1>
              <p className="text-sm sm:text-base opacity-90 mt-1">
                {item.sku ? (
                  <>
                    {item.sku}
                    <span className="text-blue-100/70 mx-2">•</span>
                    {item.name}
                  </>
                ) : (
                  <>Artículo ID: {item.id}</>
                )}
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 rounded-full bg-white/95 text-blue-700 px-4 py-2 text-xs sm:text-sm font-semibold shadow-sm hover:bg-white transition shrink-0 cursor-pointer"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-base">
                  ←
                </span>
                <span className="whitespace-nowrap">Volver</span>
              </button>
            </div>
          </div>

          <div className="bg-blue-600 pb-4 px-4 sm:px-6 lg:px-10">
            <div className="max-w-6xl mx-auto w-full">
              <div className="bg-white rounded-2xl shadow-sm flex items-center px-4 py-3 text-gray-500">
                <span className="mr-3 text-xl">🔍</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar almacén por nombre o código..."
                  className="w-full bg-transparent outline-none text-sm sm:text-base placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 max-w-6xl mx-auto w-full">
            <div className="flex flex-col gap-3 sm:gap-4 pb-20">
              {loading &&
                Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="animate-pulse w-full bg-white rounded-2xl shadow-sm px-4 py-4 sm:px-6 sm:py-5 flex items-center justify-between gap-4"
                  >
                    <div className="flex flex-col gap-2 w-2/3">
                      <div className="h-4 w-3/4 rounded bg-gray-200" />
                      <div className="h-3 w-1/2 rounded bg-gray-200" />
                    </div>
                    <div className="h-8 w-20 rounded bg-gray-200" />
                  </div>
                ))}

              {!loading &&
                filtered.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => void handlePickWarehouse(w)}
                    className="w-full text-left bg-white rounded-2xl shadow-sm px-4 py-4 sm:px-6 sm:py-5 flex items-center justify-between gap-4 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex flex-col gap-1">
                      <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                        {w.name}
                      </h2>
                      <p className="text-xs sm:text-sm text-gray-500 tracking-wide">
                        Código: <span className="font-medium">{w.code}</span>
                      </p>
                    </div>

                    <span
                      className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-400 text-lg"
                      aria-hidden="true"
                    >
                      ›
                    </span>
                  </button>
                ))}
            </div>

            {!loading && filtered.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">
                No se encontraron almacenes para “{search}”.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
