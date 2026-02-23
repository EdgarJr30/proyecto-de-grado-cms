import type {
  InventoryDocStatus,
  InventoryDocType,
} from '../../../../types/inventory';

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRightLeft,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';

export const DOC_TYPES: InventoryDocType[] = [
  'RECEIPT',
  'ISSUE',
  'TRANSFER',
  'ADJUSTMENT',
  'RETURN',
];

export const DOC_STATUSES: InventoryDocStatus[] = [
  'DRAFT',
  'POSTED',
  'CANCELLED',
];

export function labelType(type: InventoryDocType) {
  switch (type) {
    case 'RECEIPT':
      return 'Entrada';
    case 'ISSUE':
      return 'Salida';
    case 'TRANSFER':
      return 'Transferencia';
    case 'ADJUSTMENT':
      return 'Ajuste';
    case 'RETURN':
      return 'Devolución';
  }
}

export function labelStatus(status: InventoryDocStatus) {
  switch (status) {
    case 'DRAFT':
      return 'Borrador';
    case 'POSTED':
      return 'Publicado';
    case 'CANCELLED':
      return 'Cancelado';
  }
}

export function docTypeIcon(type: InventoryDocType) {
  switch (type) {
    case 'RECEIPT':
      return ArrowDownToLine;
    case 'ISSUE':
      return ArrowUpFromLine;
    case 'TRANSFER':
      return ArrowRightLeft;
    case 'ADJUSTMENT':
      return SlidersHorizontal;
    case 'RETURN':
      return RotateCcw;
  }
}

export function docTypeBadgeClass(type: InventoryDocType) {
  switch (type) {
    case 'RECEIPT':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'ISSUE':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'TRANSFER':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'ADJUSTMENT':
      return 'bg-violet-50 text-violet-700 border-violet-200';
    case 'RETURN':
      return 'bg-rose-50 text-rose-700 border-rose-200';
  }
}

export function statusBadge(status: InventoryDocStatus) {
  switch (status) {
    case 'DRAFT':
      return {
        text: 'BORRADOR',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
      };
    case 'POSTED':
      return {
        text: 'PUBLICADO',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
      };
    case 'CANCELLED':
      return {
        text: 'CANCELADO',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500',
      };
  }
}

export function fmtDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function localizeReference(value: string | null) {
  if (!value) return value;

  return value
    .replace(/\bWO\b/gi, 'OT')
    .replace(/\bISSUE\b/gi, 'SALIDA')
    .replace(/\bRETURN\b/gi, 'DEVOLUCION')
    .replace(/\bRECEIPT\b/gi, 'ENTRADA')
    .replace(/\bTRANSFER\b/gi, 'TRANSFERENCIA')
    .replace(/\bADJUSTMENT\b/gi, 'AJUSTE');
}
