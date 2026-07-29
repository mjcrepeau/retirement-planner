import { useEffect, useRef, useState } from 'react';

export interface ExportMenuActions {
  onSavePlan: () => void;
  onLoadPlanFile: (file: File) => void;
  onPrintReport: () => void;
}

interface ExportMenuProps extends ExportMenuActions {
  /** Renders as a full-width list instead of a dropdown (mobile menu). */
  inline?: boolean;
  onAfterAction?: () => void;
}

const ITEMS = [
  {
    id: 'save',
    label: 'Save plan (.json)',
    description: 'Download everything you have entered',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    ),
  },
  {
    id: 'load',
    label: 'Load plan (.json)',
    description: 'Replace the current plan from a file',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    ),
  },
  {
    id: 'print',
    label: 'Print / Save as PDF',
    description: 'Full report with charts and tables',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
      />
    ),
  },
] as const;

export function ExportMenu({
  onSavePlan,
  onLoadPlanFile,
  onPrintReport,
  inline = false,
  onAfterAction,
}: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const runAction = (id: (typeof ITEMS)[number]['id']) => {
    setIsOpen(false);
    if (id === 'save') {
      onSavePlan();
      onAfterAction?.();
    } else if (id === 'load') {
      fileInputRef.current?.click();
    } else {
      onPrintReport();
      onAfterAction?.();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so picking the same file twice still fires a change event.
    event.target.value = '';
    if (file) {
      onLoadPlanFile(file);
      onAfterAction?.();
    }
  };

  const hiddenInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="application/json,.json"
      onChange={handleFileChange}
      className="hidden"
    />
  );

  if (inline) {
    return (
      <>
        {hiddenInput}
        {ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => runAction(item.id)}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {item.icon}
            </svg>
            {item.label}
          </button>
        ))}
      </>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      {hiddenInput}
      <button
        onClick={() => setIsOpen(open => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title="Export or load a plan"
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Export
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2 z-50"
        >
          {ITEMS.map(item => (
            <button
              key={item.id}
              role="menuitem"
              onClick={() => runAction(item.id)}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-start gap-3"
            >
              <svg
                className="w-5 h-5 mt-0.5 shrink-0 text-gray-500 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {item.icon}
              </svg>
              <span>
                <span className="block text-sm font-medium text-gray-900 dark:text-white">
                  {item.label}
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {item.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
