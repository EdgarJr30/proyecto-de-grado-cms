export default function AssetsBoard() {
  return (
    <div className="h-full min-h-0">
      <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Panel izquierdo: Ubicaciones */}
        <aside className="min-h-0 rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">Ubicaciones</div>

          <div className="mt-3 space-y-2">
            {/* Placeholder: aquí irá el LocationTree */}
            <div className="h-8 rounded bg-gray-100" />
            <div className="h-8 rounded bg-gray-100" />
            <div className="h-8 rounded bg-gray-100" />
          </div>

          <div className="mt-6 space-y-2">
            {/* Placeholder: resumen por estado */}
            <div className="h-6 rounded bg-gray-100" />
            <div className="h-6 rounded bg-gray-100" />
            <div className="h-6 rounded bg-gray-100" />
          </div>
        </aside>

        {/* Panel derecho: KPIs + acciones + tabla + drawer */}
        <section className="min-h-0 overflow-hidden rounded-xl border bg-white shadow-sm">
          {/* Top bar */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="text-sm font-semibold text-gray-900">
              Listado de Activos
            </div>

            <div className="flex items-center gap-2">
              {/* Placeholders para acciones */}
              <div className="h-9 w-28 rounded bg-gray-100" />
              <div className="h-9 w-44 rounded bg-gray-100" />
              <div className="h-9 w-28 rounded bg-gray-100" />
            </div>
          </div>

          {/* KPIs row (placeholder) */}
          <div className="px-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="h-20 rounded-lg bg-gray-100" />
              <div className="h-20 rounded-lg bg-gray-100" />
              <div className="h-20 rounded-lg bg-gray-100" />
              <div className="h-20 rounded-lg bg-gray-100" />
              <div className="h-20 rounded-lg bg-gray-100" />
            </div>
          </div>

          {/* Tabla (placeholder) */}
          <div className="px-4 pb-4 h-[calc(100%-160px)] min-h-0">
            <div className="h-full min-h-0 overflow-auto rounded-lg border">
              <div className="h-10 border-b bg-gray-50" />
              <div className="divide-y">
                <div className="h-14 bg-white" />
                <div className="h-14 bg-white" />
                <div className="h-14 bg-white" />
                <div className="h-14 bg-white" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
