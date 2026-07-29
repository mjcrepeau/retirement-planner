import type { ExportCell, ExportColumnType } from './types';

/** Human-readable rendering of an export cell — used by the print report. */
export function formatCell(
  value: ExportCell | undefined,
  type: ExportColumnType,
  currency: string
): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return '—';

  switch (type) {
    case 'currency':
      return new Intl.NumberFormat(currency === 'CAD' ? 'en-CA' : 'en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(value);
    case 'percent':
      return `${(value * 100).toFixed(1)}%`;
    case 'factor':
      return value.toFixed(3);
    case 'number':
    case 'text':
    default:
      return String(value);
  }
}
