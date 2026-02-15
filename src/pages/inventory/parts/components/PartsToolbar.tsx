import type { PartCriticality } from '../../../../types/inventory';
import { Boxes, Filter, Search, ShieldAlert } from 'lucide-react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function SeparatorLite(props: {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}) {
  const o = props.orientation ?? 'horizontal';
  return (
    <div
      className={cx(
        o === 'horizontal' ? 'h-px w-full' : 'w-px h-full',
        'bg-slate-200',
        props.className
      )}
    />
  );
}

export default function PartsToolbar(props: {
  q: string;
  setQ: (v: string) => void;
  activeFilter: 'all' | 'active' | 'inactive';
  setActiveFilter: (v: 'all' | 'active' | 'inactive') => void;
  critFilter: PartCriticality | '';
  setCritFilter: (v: PartCriticality | '') => void;
  totalCount: number;
  canManage: boolean;
}) {
  const {
    q,
    setQ,
    activeFilter,
    setActiveFilter,
    critFilter,
    setCritFilter,
    totalCount,
    canManage,
  } = props;

  return (
    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Filter className="h-4 w-4 text-blue-700" />
            Filtros
          </span>

          <SeparatorLite
            orientation="vertical"
            className="h-6 hidden sm:block"
          />

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Buscar
              </label>
              <div className="relative w-full sm:w-[360px]">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="Código, nombre, descripción…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Activo
              </label>
              <select
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                value={activeFilter}
                onChange={(e) =>
                  setActiveFilter(
                    e.target.value as 'all' | 'active' | 'inactive'
                  )
                }
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Criticidad
              </label>
              <select
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                value={critFilter}
                onChange={(e) =>
                  setCritFilter(e.target.value as PartCriticality | '')
                }
              >
                <option value="">Todas</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            <Boxes className="h-3.5 w-3.5 text-blue-700" />
            {totalCount} items
          </span>
          {!canManage ? (
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <ShieldAlert className="h-3.5 w-3.5" />
              Solo lectura
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
