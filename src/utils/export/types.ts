import type { Assumptions, Profile } from '../../types';
import type { CountryCode } from '../../countries';

export type ExportColumnType = 'text' | 'number' | 'currency' | 'percent' | 'factor';

export interface ExportColumn {
  key: string;
  label: string;
  type: ExportColumnType;
}

export type ExportCell = string | number | null;

export type ExportRow = Record<string, ExportCell>;

/** Context describing how to read the numbers in an exported table. */
export interface ExportMeta {
  generatedAt: Date;
  country: CountryCode;
  currency: string;
  /** Calendar year that "today's dollars" are expressed in. */
  baseYear: number;
  profile: Profile;
  assumptions: Assumptions;
}

/**
 * A table in a presentation-neutral form. `csv.ts` serializes it for
 * spreadsheets; `PrintReport` renders the same structure as HTML.
 */
export interface ExportTable {
  /** Stable slug used for filenames. */
  id: string;
  title: string;
  columns: ExportColumn[];
  rows: ExportRow[];
  /** Optional totals row rendered beneath the body. */
  footer?: ExportRow;
  meta: ExportMeta;
}
