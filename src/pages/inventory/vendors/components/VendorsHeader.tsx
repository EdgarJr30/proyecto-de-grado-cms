import { Link } from 'react-router-dom';
import { ChevronRight, ShieldAlert, Truck } from 'lucide-react';

export function VendorsHeader({
  count,
  isReadOnly,
}: {
  count: number;
  isReadOnly: boolean;
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
            <span className="text-slate-900 font-medium">Proveedores</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold tracking-tight truncate">
                Proveedores
              </h1>
              <p className="mt-1 text-xs md:text-sm text-slate-500">
                Administra proveedores y su relación con repuestos.
              </p>
            </div>

            <div className="shrink-0 self-start flex items-center gap-2">
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                <Truck className="h-3.5 w-3.5 text-blue-700" />
                {count} proveedor{count === 1 ? '' : 'es'}
              </span>

              {isReadOnly ? (
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Solo lectura
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ✓ Gestión habilitada
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
