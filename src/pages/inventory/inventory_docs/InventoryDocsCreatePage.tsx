import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  FilePlus2,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

import Sidebar from '../../../components/layout/Sidebar';
import { usePermissions } from '../../../rbac/PermissionsContext';
import { showToastError, showToastSuccess } from '../../../notifications';
import type { InventoryDocType } from '../../../types/inventory';
import { createInventoryDoc } from '../../../services/inventory';

import { PageShell } from './components/PageShell';
import { GhostButton } from './components/buttons';
import {
  DOC_TYPES,
  docTypeBadgeClass,
  docTypeIcon,
  labelType,
} from './components/docMeta';

type DocGuide = {
  summary: string;
  required: string;
  recommendation: string;
};

const DOC_GUIDE: Record<InventoryDocType, DocGuide> = {
  RECEIPT: {
    summary: 'Registrar entradas de repuestos a inventario.',
    required: 'Almacén',
    recommendation: 'Recomendado: proveedor y referencia de compra.',
  },
  ISSUE: {
    summary: 'Registrar salidas por consumo, tickets o despachos.',
    required: 'Almacén',
    recommendation: 'Si aplica a OT, agrega ticket y referencia.',
  },
  TRANSFER: {
    summary: 'Mover repuestos entre almacenes.',
    required: 'Almacén origen y destino',
    recommendation: 'Valida que origen y destino sean distintos.',
  },
  ADJUSTMENT: {
    summary: 'Ajustar diferencias de inventario por conteo o corrección.',
    required: 'Almacén',
    recommendation: 'Usa notas claras para trazabilidad de auditoría.',
  },
  RETURN: {
    summary: 'Registrar devoluciones al inventario.',
    required: 'Almacén',
    recommendation: 'Si corresponde, vincula ticket y motivo de devolución.',
  },
};

function EmptyAccessState() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
      No tienes permisos para acceder a Documentos de inventario.
    </div>
  );
}

export default function InventoryDocsCreatePage() {
  const navigate = useNavigate();
  const { has } = usePermissions();

  const canRead = has('inventory:read');
  const canWrite = has(['inventory:create', 'inventory:full_access']);

  const [creatingType, setCreatingType] = useState<InventoryDocType | null>(
    null
  );

  async function onCreate(type: InventoryDocType) {
    if (!canWrite) return;
    setCreatingType(type);
    try {
      const created = await createInventoryDoc({ doc_type: type });
      showToastSuccess(`Borrador de ${labelType(type).toLowerCase()} creado.`);
      navigate(`/inventory/docs/${created.id}`);
    } catch (error: unknown) {
      if (error instanceof Error) showToastError(error.message);
      else showToastError('No se pudo crear el documento.');
    } finally {
      setCreatingType(null);
    }
  }

  if (!canRead) {
    return (
      <PageShell>
        <Sidebar />
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1 p-6">
          <EmptyAccessState />
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Sidebar />

      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        <header className="shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="px-4 md:px-6 lg:px-8 py-4">
            <div className="flex flex-col gap-3">
              <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                <Link to="/inventario" className="hover:text-slate-900">
                  Inventario
                </Link>
                <ChevronRight className="h-3 w-3" />
                <Link to="/inventory/docs" className="hover:text-slate-900">
                  Documentos
                </Link>
                <ChevronRight className="h-3 w-3" />
                <span className="text-slate-900 font-medium">Crear</span>
              </nav>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-blue-50">
                    <FilePlus2 className="h-5 w-5 text-blue-700" />
                  </div>

                  <div className="min-w-0">
                    <h1 className="text-lg md:text-xl font-bold tracking-tight">
                      Crear documento de inventario
                    </h1>
                    <p className="mt-1 text-xs text-slate-500">
                      Selecciona un tipo de movimiento para abrir un borrador.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {canWrite ? (
                    <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✓ Creación habilitada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Solo lectura
                    </span>
                  )}

                  <GhostButton
                    onClick={() => navigate('/inventory/docs')}
                    icon={ArrowLeft}
                    className="h-9"
                  >
                    Ver listado
                  </GhostButton>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="flex-1 min-h-0 overflow-auto">
          <div className="px-4 md:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
              <div className="xl:col-span-8">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Paso 1. Elige el tipo de documento
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Todos los documentos se crean como borrador para poder
                    completar encabezado, líneas y validaciones antes de
                    publicar.
                  </p>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {DOC_TYPES.map((type) => {
                      const Icon = docTypeIcon(type);
                      const toneClass = docTypeBadgeClass(type);
                      const guide = DOC_GUIDE[type];
                      const isCreating = creatingType === type;
                      const disabled = !canWrite || creatingType !== null;

                      return (
                        <button
                          key={type}
                          type="button"
                          disabled={disabled}
                          onClick={() => void onCreate(type)}
                          className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/40 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`inline-flex items-center justify-center h-8 w-8 rounded-lg border ${toneClass}`}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <div>
                              <div className="text-sm font-semibold text-slate-900">
                                {labelType(type)}
                              </div>
                              <div className="text-xs text-slate-500">
                                {guide.summary}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 space-y-1">
                            <div className="text-[11px] text-slate-600">
                              <span className="font-semibold">Requerido:</span>{' '}
                              {guide.required}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {guide.recommendation}
                            </div>
                          </div>

                          <div className="mt-3">
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                              {isCreating ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Creando...
                                </>
                              ) : (
                                'Crear borrador'
                              )}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <aside className="xl:col-span-4 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Flujo recomendado
                  </h3>
                  <ol className="mt-3 space-y-2 text-xs text-slate-600 list-decimal list-inside">
                    <li>Selecciona el tipo de documento adecuado.</li>
                    <li>Completa encabezado (almacén, ticket, proveedor).</li>
                    <li>Agrega líneas con cantidad y ubicación.</li>
                    <li>Guarda y revisa validaciones.</li>
                    <li>Publica el documento.</li>
                  </ol>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Nota de control
                  </h3>
                  <p className="mt-2 text-xs text-slate-600">
                    Publicar asigna el número de documento y afecta inventario.
                    Cancelar genera una reversa y marca el documento como
                    cancelado.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </main>
    </PageShell>
  );
}
