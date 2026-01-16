import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Sidebar from '../../../../components/layout/Sidebar';
import {
  NewWarehouseAuditForm,
  type WarehouseItemCountPayload,
  type SelectedProductForAudit,
} from './WarehouseItemCountForm';
import {
  getActiveWarehouses,
  getWarehouseItemByWarehouseItemId,
  type WarehouseStockItem,
  getActiveBaskets,
} from '../../../../services/inventoryService';
import type { Basket } from '../../../../types/inventory';
import { registerInventoryOperation } from '../../../../services/inventoryCountsService';
import { showToastError, showToastSuccess } from '../../../../notifications';

class SubmitValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubmitValidationError';
  }
}

type RouteParams = {
  warehouseId: string; // aquí usas el code desde BD: "OC-QUIM", etc.
  warehouseItemId: string; // SKU: "A000001"
};

type WarehouseHeader = {
  id: string;
  code: string;
  name: string;
};

type LocationState =
  | {
      area?: { id: string; name: string };
    }
  | undefined;

// Helper seguro para extraer mensajes de error
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const anyErr = err as {
      message?: string;
      error_description?: string;
      error?: string;
      code?: string;
    };
    return (
      anyErr.message ??
      anyErr.error_description ??
      anyErr.error ??
      anyErr.code ??
      'Ocurrió un error'
    );
  }
  return 'Ocurrió un error';
}

export default function WarehouseItemCountPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;
  const area = state?.area ?? null;
  const { warehouseId, warehouseItemId } = useParams<RouteParams>();
  const [warehouse, setWarehouse] = useState<WarehouseHeader | null>(null);
  const [initialProduct, setInitialProduct] =
    useState<SelectedProductForAudit | null>(null);
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [loadingWarehouse, setLoadingWarehouse] = useState(true);
  const [loadingItem, setLoadingItem] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // 1) Cargar almacén desde DB (getActiveWarehouses)
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
          setWarehouse(null);
          setError(`No se encontró el almacén con código "${warehouseId}".`);
        } else {
          setWarehouse({
            id: String(found.id),
            code: found.code,
            name: found.name,
          });
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        if (err instanceof Error) {
          console.error('❌ Error al cargar almacén:', err.message);
          setError(err.message);
          showToastError(`No se pudo cargar el almacén: ${err.message}`);
        } else {
          console.error('❌ Error desconocido al cargar almacén:', err);
          setError('Ocurrió un error al cargar el almacén.');
          showToastError('Ocurrió un error al cargar el almacén.');
        }
      } finally {
        if (isMounted) setLoadingWarehouse(false);
      }
    }

    fetchWarehouse();
    return () => {
      isMounted = false;
    };
  }, [warehouseId]);

  // 2) Cargar item desde la vista vw_warehouse_stock
  useEffect(() => {
    let isMounted = true;

    async function fetchItem() {
      if (!warehouseId || !warehouseItemId) {
        setLoadingItem(false);
        return;
      }

      try {
        setLoadingItem(true);
        // no pisamos error de almacén si ya lo hay
        const row: WarehouseStockItem | null =
          await getWarehouseItemByWarehouseItemId(Number(warehouseItemId));
        if (!isMounted) return;

        if (!row) {
          setInitialProduct(null);
        } else {
          setInitialProduct({
            id: String(row.item_id),
            warehouseItemId: String(row.warehouse_item_id),
            code: row.item_sku,
            name: row.item_name,
            uomCode: row.uom_code,
            uomId: String(row.uom_id),
            isWeighted: row.item_is_weightable ? 'Y' : 'N',
          });
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        if (err instanceof Error) {
          console.error(
            `❌ Error al cargar item "${warehouseItemId}" en almacén "${warehouseId}":`,
            err.message
          );
          setError(err.message);
          showToastError(
            `No se pudo cargar la información del artículo: ${err.message}`
          );
        } else {
          console.error('❌ Error desconocido al cargar item:', err);
          setError('Ocurrió un error al cargar el artículo.');
          showToastError('Ocurrió un error al cargar el artículo.');
        }
      } finally {
        if (isMounted) setLoadingItem(false);
      }
    }

    fetchItem();
    return () => {
      isMounted = false;
    };
  }, [warehouseId, warehouseItemId]);

  // Carga de canastos (baskets)
  useEffect(() => {
    let isMounted = true;

    async function fetchBaskets() {
      try {
        const data = await getActiveBaskets();
        if (!isMounted) return;
        setBaskets(data);
      } catch (err) {
        console.error('❌ Error al cargar canastos:', err);
      }
    }

    fetchBaskets();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (
    payload: WarehouseItemCountPayload
  ): Promise<void> => {
    // Candado inmediato anti doble submit
    if (savingRef.current) return;

    // Validación de datos requeridos
    if (!warehouse || !initialProduct) {
      const msg =
        'No se pudo registrar el conteo. Faltan los datos del almacén o del artículo seleccionado.';
      showToastError(msg);
      return;
    }

    const warehouseNumericId = Number(warehouse.id);
    const itemNumericId = Number(initialProduct.id);
    const uomNumericId = Number(initialProduct.uomId);
    const warehouseItemNumericId = Number(initialProduct.warehouseItemId);
    const areaNumericId = payload.areaId ? Number(payload.areaId) : undefined;
    const isWeighted = payload.isWeighted === 'Y';
    const basketIdNumeric = payload.basketId
      ? Number(payload.basketId)
      : undefined;

    if (
      Number.isNaN(warehouseNumericId) ||
      Number.isNaN(itemNumericId) ||
      Number.isNaN(uomNumericId) ||
      Number.isNaN(warehouseItemNumericId)
    ) {
      const msg =
        'Ocurrió un problema con los identificadores de almacén o artículo. Vuelve atrás y selecciona el artículo nuevamente.';
      showToastError(msg);
      return;
    }

    if (isWeighted && (!basketIdNumeric || Number.isNaN(basketIdNumeric))) {
      const msg = 'Selecciona un canasto para registrar artículos pesados.';
      showToastError(msg);
      return;
    }

    const basket = isWeighted
      ? baskets.find((b) => b.id === basketIdNumeric)
      : undefined;

    const basketWeight = basket ? Number(basket.weight ?? 0) : 0;
    const grossQty = payload.quantity;
    const netQty =
      isWeighted && basket ? Math.max(0, grossQty - basketWeight) : grossQty;

    // Evitar guardar conteos vacíos
    const effectiveQty = isWeighted ? netQty : grossQty;
    if (effectiveQty <= 0) {
      const msg =
        'No puedes guardar un conteo vacío. Digita una cantidad mayor a 0.';
      showToastError(msg);
      return;
    }

    const articuloEtiqueta = `${initialProduct.code} · ${initialProduct.name} (${initialProduct.uomCode})`;

    try {
      savingRef.current = true;
      setSaving(true);

      await registerInventoryOperation({
        warehouseId: warehouseNumericId,
        areaId: areaNumericId,
        itemId: itemNumericId,
        uomId: uomNumericId,
        warehouseItemId: warehouseItemNumericId,
        quantity: grossQty,
        isWeighted,
        basketId: basketIdNumeric,
        status: payload.status,
        auditorEmail: payload.auditorEmail,
        statusComment: payload.statusComment,
        pendingReasonCode: payload.pendingReasonCode,
      });

      const esPendiente = payload.status === 'pending';

      const cantidadTexto = isWeighted
        ? `${netQty.toFixed(2)} (bruto ${grossQty.toFixed(
            2
          )} − canasto ${basketWeight.toFixed(2)})`
        : `${grossQty.toFixed(2)}`;

      showToastSuccess(
        esPendiente
          ? `Artículo marcado como pendiente: ${articuloEtiqueta} — Cantidad: ${cantidadTexto}`
          : `Artículo contado: ${articuloEtiqueta} — Cantidad: ${cantidadTexto}`
      );

      navigate(-1);
    } catch (error: unknown) {
      console.error('❌ Error registrando conteo:', error);
      if (error instanceof SubmitValidationError) throw error;
      const msg = `No se pudo guardar el conteo: ${extractErrorMessage(error)}`;
      showToastError(msg);
      return;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const loading = loadingWarehouse || loadingItem;

  // 3) Caso: no se encontró el artículo para ese almacén
  if (!loading && (!initialProduct || !warehouse)) {
    return (
      <div className="h-screen flex bg-gray-100">
        <Sidebar />
        <main className="flex flex-col flex-1 h-[100dvh] bg-gray-100 overflow-hidden">
          <header className="bg-blue-600 text-white shadow-sm pt-16 sm:pt-6">
            <div className="px-4 sm:px-6 lg:px-10 pb-4 sm:pb-5 max-w-6xl mx-auto w-full flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight break-words">
                  Conteo de Inventario
                </h1>
                {warehouse && (
                  <p className="text-sm sm:text-base mt-1 opacity-90">
                    Almacén:{' '}
                    <span className="font-semibold">{warehouse.name}</span>
                  </p>
                )}
              </div>

              <div className="flex justify-end shrink-0">
                <button
                  onClick={() => navigate(-1)}
                  className="inline-flex items-center gap-2 rounded-full bg-white/95 text-blue-700 px-4 py-2 text-xs sm:text-sm font-semibold shadow-sm hover:bg-white transition cursor-pointer"
                  aria-label="Volver"
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-base">
                    ←
                  </span>
                  <span className="whitespace-nowrap">Volver</span>
                </button>
              </div>
            </div>
          </header>

          <section className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-10 py-4 sm:py-6">
            <div className="bg-white rounded-2xl shadow-sm px-6 py-8 max-w-md w-full text-center">
              <p className="text-sm text-gray-700 font-semibold mb-2">
                Artículo no encontrado
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mb-4 break-words">
                No pudimos cargar la información del artículo con id/code:{' '}
                <span className="font-mono break-all">{warehouseItemId}</span>{' '}
                en el almacén{' '}
                <span className="font-semibold">
                  {warehouse?.code ?? warehouseId}
                </span>
                .
              </p>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center justify-center h-10 px-4 rounded-2xl bg-blue-600 text-white text-sm font-semibold"
              >
                Volver al listado
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />

      <main className="flex flex-col flex-1 h-[100dvh] bg-gray-100 overflow-hidden">
        {/* HEADER AZUL */}
        <header className="bg-blue-600 text-white shadow-sm pt-16 sm:pt-6">
          <div className="px-4 sm:px-6 lg:px-10 pb-4 sm:pb-5 max-w-6xl mx-auto w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Texto del header */}
            <div className="flex-1 min-w-0">
              <p className="text-md sm:text-2xl md:text-3xl leading-tight break-words">
                {loadingWarehouse ? (
                  'Cargando almacén…'
                ) : !warehouse ? (
                  'Almacén no encontrado'
                ) : area ? (
                  <>
                    Conteo en el área{' '}
                    <span className="font-semibold">{area.name}</span> del
                    almacén{' '}
                    <span className="font-semibold">{warehouse.name}</span>.
                  </>
                ) : (
                  <>
                    Conteo en el almacén{' '}
                    <span className="font-semibold">{warehouse.name}</span>.
                  </>
                )}
              </p>

              {/* {initialProduct && (
                <p className="text-xl sm:text-2xl md:text-3xl leading-tight break-words">
                  Producto seleccionado:{' '}
                  <span className="font-semibold">
                    {initialProduct.code} · {initialProduct.name} (
                    {initialProduct.uomCode})
                  </span>
                </p>
              )} */}

              {saving && (
                <p className="mt-1 text-xs text-blue-100/90">
                  Guardando conteo…
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
        </header>

        {/* CONTENIDO */}
        <section className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 max-w-3xl lg:max-w-4xl mx-auto w-full">
            {warehouse && initialProduct && (
              <NewWarehouseAuditForm
                warehouse={{ id: warehouse.id, name: warehouse.name }}
                area={area}
                initialProduct={initialProduct}
                baskets={baskets}
                onCancel={() => navigate(-1)}
                onSubmit={handleSubmit}
                isSubmitting={saving}
              />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
