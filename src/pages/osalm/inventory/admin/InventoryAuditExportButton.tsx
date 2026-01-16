import type {
  AuditItem,
  WarehouseInfo,
} from '../../../../services/inventoryCountsService';

type InventoryAuditExportButtonProps = {
  warehouse: WarehouseInfo | null;
  items: AuditItem[];
  inventoryCountId: number | null;
  disabled?: boolean;
};

const DELIMITER = '\t';

export function InventoryAuditExportButton({
  warehouse,
  items,
  inventoryCountId,
  disabled,
}: InventoryAuditExportButtonProps) {
  const handleExportAudit = () => {
    if (!warehouse) {
      alert('No hay información del almacén para exportar.');
      return;
    }

    if (!inventoryCountId) {
      alert(
        'No hay una jornada de inventario asociada a este almacén. No se puede exportar.'
      );
      return;
    }

    if (!items || items.length === 0) {
      alert('No hay líneas de conteo para exportar.');
      return;
    }

    const exportItems = items;

    if (exportItems.length === 0) {
      alert('No hay líneas válidas para exportar.');
      return;
    }

    // 1) Encabezado requerido (con tabulaciones)
    const headerFields = ['ItemCode', 'WhsCode', 'SumVar', 'UomCode'];
    const header = headerFields.join(DELIMITER);

    // 2) Filas de datos con tabulaciones
    const bodyLines = exportItems.map((it) => {
      const qty =
        typeof it.countedQty === 'number' && Number.isFinite(it.countedQty)
          ? String(it.countedQty) // deja el punto decimal tal cual (ej: 10.5)
          : '0';

      return [
        it.sku, // ItemCode
        warehouse.code, // WhsCode (OC, PAP-GRAL, etc.)
        qty, // SumVar
        it.uom, // UomCode
      ].join(DELIMITER);
    });

    // ⚠️ Doble encabezado como pediste:
    const content = [header, header, ...bodyLines].join('\r\n');

    // 3) Construir nombre de archivo:
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const mi = pad(now.getMinutes());

    const safeWarehouseName = warehouse.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // quita tildes
      .replace(/[^A-Za-z0-9]+/g, '_') // espacios y símbolos → "_"
      .replace(/^_+|_+$/g, ''); // quita "_" al inicio/fin

    const fileName = `auditoria_${safeWarehouseName}_${yyyy}${mm}${dd}_${hh}${mi}.txt`;

    // 4) Crear Blob y disparar descarga
    const blob = new Blob([content], {
      type: 'text/plain;charset=utf-8',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleExportAudit}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-blue-500/25 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-500/40 hover:border-white/50 disabled:opacity-60 disabled:cursor-not-allowed transition cursor-pointer"
    >
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
        ⬇️
      </span>
      <span className="whitespace-nowrap">Exportar reporte</span>
    </button>
  );
}
