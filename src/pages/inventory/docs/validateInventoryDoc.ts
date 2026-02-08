import type {
  InventoryDocLineRow,
  InventoryDocRow,
} from '../../../types/inventory';

type ValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

function hasBins(binsCount: number) {
  return binsCount > 0;
}

export function validateBeforePost(params: {
  doc: InventoryDocRow;
  lines: InventoryDocLineRow[];
  // counts para saber si existen bins en cada contexto (si no hay bins, permitimos null)
  binsCountSingleWarehouse: number; // warehouse_id
  binsCountFromWarehouse: number; // from_warehouse_id
  binsCountToWarehouse: number; // to_warehouse_id
}): ValidationResult {
  const {
    doc,
    lines,
    binsCountSingleWarehouse,
    binsCountFromWarehouse,
    binsCountToWarehouse,
  } = params;

  const errors: string[] = [];
  const warnings: string[] = [];

  if (doc.status !== 'DRAFT') {
    errors.push('Solo se puede postear un documento en estado DRAFT.');
    return { ok: false, errors, warnings };
  }

  // Header validations
  if (doc.doc_type === 'RECEIPT') {
    if (!doc.warehouse_id)
      errors.push('RECEIPT: debes seleccionar un warehouse.');
    if (!doc.vendor_id)
      warnings.push(
        'RECEIPT: se recomienda seleccionar un proveedor (vendor).'
      );
  }

  if (doc.doc_type === 'ISSUE' || doc.doc_type === 'RETURN') {
    if (!doc.warehouse_id)
      errors.push(`${doc.doc_type}: debes seleccionar un warehouse.`);
    // ticket_id “si aplica”: tu SQL solo lo exige si lo usas, pero aquí validamos suavemente
    if (!doc.ticket_id)
      warnings.push(
        `${doc.doc_type}: si es consumo/devolución por WO, selecciona ticket_id.`
      );
  }

  if (doc.doc_type === 'ADJUSTMENT') {
    if (!doc.warehouse_id)
      errors.push('ADJUSTMENT: debes seleccionar un warehouse.');
  }

  if (doc.doc_type === 'TRANSFER') {
    if (!doc.from_warehouse_id)
      errors.push('TRANSFER: debes seleccionar from_warehouse_id.');
    if (!doc.to_warehouse_id)
      errors.push('TRANSFER: debes seleccionar to_warehouse_id.');
    if (
      doc.from_warehouse_id &&
      doc.to_warehouse_id &&
      doc.from_warehouse_id === doc.to_warehouse_id
    ) {
      errors.push('TRANSFER: from/to warehouse deben ser distintos.');
    }
  }

  // Lines validations
  if (!lines.length) {
    errors.push('Debes agregar al menos 1 línea para postear.');
  }

  for (const l of lines) {
    if (!l.part_id) errors.push(`Línea #${l.line_no}: part_id es requerido.`);
    if (!l.uom_id) errors.push(`Línea #${l.line_no}: uom_id es requerido.`);

    if (doc.doc_type === 'ADJUSTMENT') {
      if (l.qty === 0)
        errors.push(`Línea #${l.line_no}: ADJUSTMENT requiere qty != 0.`);
    } else {
      if (l.qty <= 0) errors.push(`Línea #${l.line_no}: qty debe ser > 0.`);
    }

    // Bin requirements (solo si el warehouse tiene bins)
    if (doc.doc_type === 'ISSUE') {
      if (hasBins(binsCountSingleWarehouse) && !l.from_bin_id) {
        errors.push(`Línea #${l.line_no}: ISSUE requiere from_bin_id.`);
      }
    }

    if (doc.doc_type === 'RECEIPT' || doc.doc_type === 'RETURN') {
      if (hasBins(binsCountSingleWarehouse) && !l.to_bin_id) {
        errors.push(`Línea #${l.line_no}: ${doc.doc_type} requiere to_bin_id.`);
      }
    }

    if (doc.doc_type === 'TRANSFER') {
      if (hasBins(binsCountFromWarehouse) && !l.from_bin_id) {
        errors.push(
          `Línea #${l.line_no}: TRANSFER requiere from_bin_id (from warehouse).`
        );
      }
      if (hasBins(binsCountToWarehouse) && !l.to_bin_id) {
        errors.push(
          `Línea #${l.line_no}: TRANSFER requiere to_bin_id (to warehouse).`
        );
      }
    }

    if (doc.doc_type === 'ADJUSTMENT') {
      // en SQL usas coalesce(to_bin_id, from_bin_id)
      if (hasBins(binsCountSingleWarehouse) && !l.to_bin_id && !l.from_bin_id) {
        errors.push(
          `Línea #${l.line_no}: ADJUSTMENT requiere to_bin_id o from_bin_id.`
        );
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
