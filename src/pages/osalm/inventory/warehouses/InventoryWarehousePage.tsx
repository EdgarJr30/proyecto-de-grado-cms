import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Sidebar from '../../../../components/layout/Sidebar';
import {
  getActiveWarehouses,
  getWarehouseItemsByCode,
  getWarehouseAreasByWarehouseId,
  getItemIdsByAreaId,
  type WarehouseStockItem,
} from '../../../../services/inventoryService';

type WarehouseHeader = {
  id: number;
  code: string;
  name: string;
};

type AreaHeader = {
  id: number;
  code: string;
  name: string;
} | null;

type WarehouseProduct = {
  warehouseItemId: number;
  itemId: number;
  name: string;
  code: string; // sku → lo usamos en la ruta
  uom: string;
  quantity: number;
};

export default function InventoryWarehousePage() {
  const navigate = useNavigate();
  const { warehouseId } = useParams<{ warehouseId: string }>(); // slug, ej: "OC-QUIM"
  const [searchParams] = useSearchParams();
  const areaCode = searchParams.get('area'); // ej: ?area=CF-01

  const [warehouse, setWarehouse] = useState<WarehouseHeader | null>(null);
  const [area, setArea] = useState<AreaHeader>(null);

  const [stockRows, setStockRows] = useState<WarehouseStockItem[]>([]);
  const [areaItemIds, setAreaItemIds] = useState<Set<number> | null>(null);

  const [search, setSearch] = useState('');

  const [loadingWarehouse, setLoadingWarehouse] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingArea, setLoadingArea] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // 1) Cargar datos del almacén (usando getActiveWarehouses y filtrando por code)
  useEffect(() => {
    let isMounted = true;

    async function fetchWarehouse() {
      if (!warehouseId) {
        setError('No se encontró el código de almacén en la URL.');
        setLoadingWarehouse(false);
        return;
      }

      try {
        setLoadingWarehouse(true);
        setError(null);

        const list = await getActiveWarehouses();
        if (!isMounted) return;

        const found = (
          list as Array<{ id: number; code: string; name: string }>
        ).find((w) => w.code === warehouseId);

        if (!found) {
          setError(`No se encontró el almacén con código "${warehouseId}".`);
          setWarehouse(null);
        } else {
          setWarehouse({
            id: found.id,
            code: found.code,
            name: found.name,
          });
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        if (err instanceof Error) {
          console.error('❌ Error al cargar almacén:', err.message);
          setError(err.message);
        } else {
          console.error('❌ Error desconocido al cargar almacén:', err);
          setError('Ocurrió un error al cargar el almacén.');
        }
      } finally {
        if (isMounted) {
          setLoadingWarehouse(false);
        }
      }
    }

    fetchWarehouse();

    return () => {
      isMounted = false;
    };
  }, [warehouseId]);

  // 1.b) Cargar área física si viene ?area=CODE
  useEffect(() => {
    let isMounted = true;

    async function fetchArea() {
      if (!warehouse || !areaCode) {
        setArea(null);
        setAreaItemIds(null);
        return;
      }

      try {
        setLoadingArea(true);

        const areas = await getWarehouseAreasByWarehouseId(warehouse.id);
        if (!isMounted) return;

        const found = areas.find((a) => a.code === areaCode);

        if (!found) {
          console.warn(
            `⚠️ No se encontró el área "${areaCode}" en el almacén #${warehouse.id}`
          );
          setArea(null);
          setAreaItemIds(null);
          return;
        }

        setArea({ id: found.id, code: found.code, name: found.name });

        const itemIds = await getItemIdsByAreaId(found.id);
        if (!isMounted) return;

        setAreaItemIds(new Set(itemIds));
      } catch (err: unknown) {
        if (!isMounted) return;
        if (err instanceof Error) {
          console.error('❌ Error al cargar área de almacén:', err.message);
          setError(
            `Error al cargar el área "${areaCode}" del almacén: ${err.message}`
          );
        } else {
          console.error('❌ Error desconocido al cargar área de almacén:', err);
          setError('Ocurrió un error al cargar el área del almacén.');
        }
        setArea(null);
        setAreaItemIds(null);
      } finally {
        if (isMounted) {
          setLoadingArea(false);
        }
      }
    }

    fetchArea();

    return () => {
      isMounted = false;
    };
  }, [warehouse, areaCode]);

  // 2) Cargar productos del almacén desde Supabase cuando ya tenemos el código
  useEffect(() => {
    let isMounted = true;

    async function fetchProducts() {
      if (!warehouseId) return;
      try {
        setLoadingProducts(true);
        setError((prev) => prev); // no pisar errores previos si los hay

        const rows: WarehouseStockItem[] = await getWarehouseItemsByCode(
          warehouseId
        );
        if (!isMounted) return;

        setStockRows(rows);
      } catch (err: unknown) {
        if (!isMounted) return;
        if (err instanceof Error) {
          console.error(
            `❌ Error al cargar items del almacén "${warehouseId}":`,
            err.message
          );
          setError(err.message);
        } else {
          console.error('❌ Error desconocido al cargar items:', err);
          setError('Ocurrió un error al cargar los productos del almacén.');
        }
      } finally {
        if (isMounted) {
          setLoadingProducts(false);
        }
      }
    }

    fetchProducts();

    return () => {
      isMounted = false;
    };
  }, [warehouseId]);

  // 3) Aplicar filtro por área (si hay área) y mapear a productos
  const scopedRows = useMemo(() => {
    if (!areaItemIds) return stockRows;
    return stockRows.filter((r) => areaItemIds.has(r.item_id));
  }, [stockRows, areaItemIds]);

  const products: WarehouseProduct[] = useMemo(
    () =>
      scopedRows.map((r) => ({
        warehouseItemId: r.warehouse_item_id,
        itemId: r.item_id,
        name: r.item_name,
        code: r.item_sku,
        uom: r.uom_code,
        quantity: Number(r.quantity ?? 0),
      })),
    [scopedRows]
  );

  // 4) Filtro por búsqueda
  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return products;

    return products.filter((p) => {
      return (
        p.name.toLowerCase().includes(term) ||
        p.code.toLowerCase().includes(term)
      );
    });
  }, [products, search]);

  // clic en cada producto: ir al conteo de ese artículo
  const handleOpenProduct = (product: WarehouseProduct) => {
    if (!warehouse) return;

    const areaQuery = area ? `?area=${area.code}` : '';

    navigate(
      `/osalm/conteos_inventario/almacen/${warehouse.code}/articulo/${product.warehouseItemId}${areaQuery}`,
      area
        ? {
            state: {
              area: {
                id: String(area.id), // WarehouseItemCountPage espera string
                name: area.name,
              },
            },
          }
        : undefined
    );
  };

  const totalProducts = products.length;
  const loading = loadingWarehouse || loadingProducts || loadingArea;

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Sidebar general de la app */}
      <Sidebar />

      <main className="flex flex-col flex-1 h-[100dvh] bg-gray-100 overflow-hidden">
        {/* HEADER AZUL */}
        <header className="bg-blue-600 text-white shadow-sm pt-16 sm:pt-6">
          <div className="px-4 sm:px-6 lg:px-10 pb-4 sm:pb-5 max-w-6xl mx-auto w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Texto: título + subtítulos */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight break-words">
                {loadingWarehouse
                  ? 'Cargando almacén…'
                  : warehouse
                  ? warehouse.name
                  : 'Almacén no encontrado'}
              </h1>
              <p className="text-sm sm:text-base mt-1 opacity-90">
                {loading
                  ? 'Cargando productos…'
                  : `${totalProducts} productos${
                      area ? ` en área: ${area.name}` : ''
                    }`}
              </p>
              {area && (
                <p className="text-xs sm:text-sm mt-0.5 text-blue-100">
                  Área física:{' '}
                  <span className="font-semibold">{area.name}</span>{' '}
                  <span className="opacity-80">({area.code})</span>
                </p>
              )}
            </div>

            {/* Botón Volver */}
            <div className="flex justify-end sm:justify-end">
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

          {/* BUSCADOR */}
          <div className="bg-blue-600 pb-4 px-4 sm:px-6 lg:px-10">
            <div className="max-w-6xl mx-auto w-full">
              <div className="bg-white rounded-2xl shadow-sm flex items-center px-4 py-3 text-gray-500">
                <span className="mr-3 text-xl">🔍</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar producto o código..."
                  className="w-full bg-transparent outline-none text-sm sm:text-base placeholder:text-gray-400"
                  disabled={loading || !!error || !warehouse}
                />
              </div>
            </div>
          </div>
        </header>

        {/* LISTA DE PRODUCTOS */}
        <section className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 max-w-5xl mx-auto w-full">
            {/* Mensaje de error */}
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs sm:text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:gap-4 pb-20">
              {/* Skeletons mientras carga */}
              {loading &&
                !error &&
                Array.from({ length: 5 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="animate-pulse w-full bg-white rounded-2xl shadow-sm px-4 py-4 sm:px-6 sm:py-5 flex items-center justify-between gap-4"
                  >
                    <div className="flex flex-col gap-2 w-2/3">
                      <div className="h-4 w-3/4 rounded bg-gray-200" />
                      <div className="h-3 w-1/2 rounded bg-gray-200" />
                    </div>
                    <div className="flex flex-col items-end gap-2 w-1/4">
                      <div className="h-6 w-12 rounded bg-gray-200" />
                      <div className="h-3 w-10 rounded bg-gray-200" />
                    </div>
                  </div>
                ))}

              {!loading &&
                !error &&
                filteredProducts.map((product) => (
                  <ProductCard
                    key={product.warehouseItemId}
                    product={product}
                    onOpen={() => handleOpenProduct(product)}
                  />
                ))}

              {!loading &&
                !error &&
                filteredProducts.length === 0 &&
                warehouse && (
                  <p className="text-sm text-gray-500 mt-4">
                    No se encontraron productos para “{search}” en este almacén.
                  </p>
                )}
            </div>
          </div>

          {/* FAB (+) */}
          {/* {warehouse && (
            <div className="pointer-events-none relative">
              <button
                className="pointer-events-auto fixed md:absolute bottom-6 right-6 md:right-10 h-16 w-16 rounded-full bg-blue-600 shadow-xl flex items-center justify-center text-4xl text-white"
                aria-label="Agregar producto"
                // onClick={handleNewManualCount}
              >
                +
              </button>
            </div>
          )} */}
        </section>
      </main>
    </div>
  );
}

function ProductCard({
  product,
  onOpen,
}: {
  product: WarehouseProduct;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left bg-white rounded-2xl shadow-sm px-4 py-4 sm:px-6 sm:py-5 flex items-center justify-between gap-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      {/* IZQUIERDA: nombre, código */}
      <div className="flex flex-col gap-1">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
          {product.name}
        </h2>
        <p className="text-xs sm:text-sm text-gray-500 tracking-wide">
          <span className="font-medium">{product.code}</span>
        </p>
      </div>

      {/* DERECHA: cantidad + unidad */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex flex-col items-end leading-tight">
          <span className="text-2xl sm:text-3xl font-bold text-gray-900">
            {product.quantity}
          </span>
          <span className="text-[11px] sm:text-xs text-gray-400 uppercase">
            {product.uom}
          </span>
        </div>
        <span
          className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-400 text-lg"
          aria-hidden="true"
        >
          ›
        </span>
      </div>
    </button>
  );
}
