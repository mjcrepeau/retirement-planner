import { csvFilename, downloadCsv, toCsv } from '../utils/export';
import type { ExportTable } from '../utils/export';

interface CsvDownloadButtonProps {
  /** Built lazily on click — no cost while the panel just sits there. */
  getTable: () => ExportTable;
  label?: string;
  /** Shown below the `sm` breakpoint, where the full label crowds the header. */
  shortLabel?: string;
}

export function CsvDownloadButton({
  getTable,
  label = 'Download CSV',
  shortLabel = 'CSV',
}: CsvDownloadButtonProps) {
  const handleClick = () => {
    const table = getTable();
    downloadCsv(csvFilename(table), toCsv(table));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Download this table as a CSV file"
      className="no-print flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors whitespace-nowrap"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{shortLabel}</span>
    </button>
  );
}
