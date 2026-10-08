import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface TicketFormatPickerProps {
  selectedFormats: string[];
  availableFormats: string[];
  onChange: (nextFormats: string[]) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export const TicketFormatPicker: React.FC<TicketFormatPickerProps> = ({
  selectedFormats = [],
  availableFormats = [],
  onChange,
  label = 'Formato',
  required = false,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleFormat = (format: string) => {
    const next = selectedFormats.includes(format)
      ? selectedFormats.filter(f => f !== format)
      : [...selectedFormats, format];
    onChange(next);
  };

  const displayText =
    selectedFormats.length > 0 ? selectedFormats.join(', ') : 'Seleccionar…';

  return (
    <div
      ref={containerRef}
      className={`relative min-w-0 ${className}`}
      data-testid="ticket-format-picker"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={label}
        aria-expanded={isOpen}
        aria-required={required}
        className={`w-full h-[36px] flex items-center gap-2 px-2.5 border rounded-lg bg-white cursor-pointer font-anek text-[14px] text-left transition-colors ${
          disabled
            ? 'opacity-60 cursor-not-allowed border-[#d6dde5] text-[#8c96a3]'
            : selectedFormats.length > 0
            ? 'text-[#0d0d0d] border-[#d6dde5] hover:border-[#b9c2cd]'
            : 'text-[#8c96a3] border-[#b9c2cd] hover:border-[#8c96a3]'
        }`}
      >
        <span className="flex-1 min-w-0 truncate leading-none flex items-center">
          {displayText}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#5b6675] shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-[42px] left-0 right-0 min-w-[220px] max-h-[300px] overflow-auto bg-white border border-[#d6dde5] rounded-[10px] shadow-[0_12px_32px_rgba(0,14,31,.16)] p-1.5 z-40 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
          data-testid="format-dropdown-menu"
        >
          <div className="flex items-center justify-between p-1.5 px-2 border-b border-[#eef3f7] mb-1">
            <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#8c96a3]">
              Elegí 1 o más
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="border-0 bg-transparent cursor-pointer font-anek text-[13px] font-bold text-[#024fff] hover:text-[#0c57d3] p-1"
            >
              Listo
            </button>
          </div>

          {availableFormats.length === 0 ? (
            <span className="p-3 text-[13px] text-[#8c96a3] text-center">
              Sin formatos disponibles
            </span>
          ) : (
            availableFormats.map(f => {
              const checked = selectedFormats.includes(f);
              return (
                <label
                  key={f}
                  className={`flex items-center gap-2.5 p-1.5 px-2 rounded-md cursor-pointer text-[14px] text-[#0d0d0d] hover:bg-[#eef3f7] transition-colors ${
                    checked ? 'bg-[#024fff]/5 font-medium' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleFormat(f)}
                    className="w-4 h-4 rounded accent-[#024fff] shrink-0 m-0 cursor-pointer"
                  />
                  <span className="flex-1 truncate">{f}</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
