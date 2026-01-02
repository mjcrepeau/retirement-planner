import { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  text: string;
}

export function Tooltip({ text }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isVisible]);

  return (
    <span
      ref={tooltipRef}
      className="relative inline-block ml-1 group"
    >
      <button
        type="button"
        onClick={() => setIsVisible(!isVisible)}
        className="text-gray-500 dark:text-gray-400 text-xs cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
        aria-label="More information"
      >
        ⓘ
      </button>
      {/* Desktop: show on hover via group-hover. Mobile: show on click via isVisible */}
      <span
        className={`absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-white bg-gray-800 dark:bg-gray-700 rounded shadow-lg whitespace-normal w-48 text-center pointer-events-none
          ${isVisible ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}
          transition-opacity duration-150`}
      >
        {text}
        <span className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-gray-800 dark:border-t-gray-700" />
      </span>
    </span>
  );
}
