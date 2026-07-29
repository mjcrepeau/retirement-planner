import type { ExportCell, ExportMeta, ExportTable } from './types';

const CRLF = '\r\n';

/** Fields containing these need quoting per RFC 4180. */
const NEEDS_QUOTES = /[",\r\n]/;

/**
 * Leading characters that make a spreadsheet treat a cell as a formula.
 * Account and income-stream names are user-supplied (and can arrive from an
 * imported scenario file), so they get a leading apostrophe to neutralize them.
 * '-' is deliberately excluded: it would mangle ordinary names far more often
 * than it would prevent anything, and negative numbers are written unquoted.
 */
const FORMULA_PREFIX = /^[=+@\t\r]/;

function escapeField(value: ExportCell | undefined): string {
  if (value === null || value === undefined) return '';

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    // Trim float noise without losing cents.
    return String(Math.round(value * 100) / 100);
  }

  let text = value;
  if (FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }
  if (NEEDS_QUOTES.test(text) || text !== text.trim()) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function row(fields: (ExportCell | undefined)[]): string {
  return fields.map(escapeField).join(',');
}

/**
 * Metadata emitted *after* the data, separated by a blank line, so the header
 * row stays the first line of the file and spreadsheets auto-detect it.
 */
function metaRows(title: string, meta: ExportMeta): string[] {
  const { profile, assumptions } = meta;
  const pct = (value: number) => `${(value * 100).toFixed(2)}%`;

  return [
    row(['# Retirement Planner export']),
    row(['# Table', title]),
    row(['# Generated', meta.generatedAt.toISOString().slice(0, 10)]),
    row(['# Country', meta.country]),
    row(['# Currency', meta.currency]),
    row([
      '# Dollars',
      'Nominal (future) dollars, except columns labelled "Real"',
    ]),
    row([
      '# Real dollars',
      `Nominal divided by the Inflation Factor column; expressed in ${meta.baseYear} dollars`,
    ]),
    row([
      '# Inflation factor',
      `(1 + inflation rate) ^ (age - current age)`,
    ]),
    row(['# Inflation rate', pct(assumptions.inflationRate)]),
    row(['# Safe withdrawal rate', pct(assumptions.safeWithdrawalRate)]),
    row(['# Retirement return rate', pct(assumptions.retirementReturnRate)]),
    row(['# Current age', profile.currentAge]),
    row(['# Retirement age', profile.retirementAge]),
    row(['# Life expectancy', profile.lifeExpectancy]),
    row([
      '# Note',
      'Tax brackets are not indexed to inflation in this model, so nominal tax figures include bracket creep. Deflating them gives the present value of the dollars paid, but the modelled burden is still higher than it would be under indexed brackets.',
    ]),
    row([
      '# Disclaimer',
      'Estimates only. Consult a financial advisor for personalized advice.',
    ]),
  ];
}

/** Byte-order mark — without it Excel misreads UTF-8 accents in account names. */
const BOM = '\uFEFF';

/** Serialize a table to RFC 4180 CSV with a UTF-8 BOM (so Excel reads accents). */
export function toCsv(table: ExportTable): string {
  const keys = table.columns.map(column => column.key);

  const lines = [
    row(table.columns.map(column => column.label)),
    ...table.rows.map(dataRow => row(keys.map(key => dataRow[key]))),
  ];

  if (table.footer) {
    lines.push(row(keys.map(key => table.footer![key])));
  }

  lines.push('', ...metaRows(table.title, table.meta));

  return `${BOM}${lines.join(CRLF)}${CRLF}`;
}

/** e.g. `retirement-planner-accumulation-summary-2026-07-29.csv` */
export function csvFilename(table: ExportTable): string {
  const date = table.meta.generatedAt.toISOString().slice(0, 10);
  return `retirement-planner-${table.id}-${date}.csv`;
}
