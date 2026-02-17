import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  CircleDot,
  FileText,
  ShieldAlert,
} from 'lucide-react';

export function InventoryDocsHeader({
  total,
  loading,
  canWrite,
}: {
  total: number;
  loading: boolean;
  canWrite: boolean;
}) {
  return (
    <header className="shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="px-4 md:px-6 lg:px-8 py-4">
        <div className="flex flex-col gap-3">
          <nav className="flex items-center gap-1.5 text-xs text-slate-500">
            <Link to="/inventario" className="hover:text-slate-900">
              Inventario
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-900 font-medium">Documentos</span>
          </nav>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-blue-50">
                <FileText className="h-5 w-5 text-blue-700" />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg md:text-xl font-bold tracking-tight">
                    Documentos de inventario
                  </h1>

                  <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    <span className="tabular-nums">{total}</span> resultados
                  </span>

                  {loading ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                      <CircleDot className="h-3 w-3" />
                      Cargando
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  DRAFT - lineas - Post. Cancel crea reversa y marca
                  CANCELLED.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {canWrite ? (
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ✓ Gestión habilitada
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Solo lectura
                </span>
              )}

              <Link
                to="/inventory"
                className="inline-flex items-center h-9 px-3 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
