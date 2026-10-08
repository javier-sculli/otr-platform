import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ArrowRight, Check, Loader2 } from 'lucide-react';

export interface StatusOption {
  value: string;
  label: string;
}

export interface TicketStatusPickerProps {
  currentStatus: string;
  nextStatusLabel: string;
  nextStatusValue?: string;
  options: StatusOption[];
  onAdvance: () => void;
  onSelectStatus: (status: string) => void;
  variant?: 'modal' | 'page';
  isLoading?: boolean;
  disabled?: boolean;
  primaryLabel?: string;
  shortcutHint?: string;
  showDropdown?: boolean;
}

export function TicketStatusPicker({
  currentStatus,
  nextStatusLabel,
  nextStatusValue,
  options,
  onAdvance,
  onSelectStatus,
  variant = 'modal',
  isLoading = false,
  disabled = false,
  primaryLabel,
  shortcutHint,
  showDropdown = true,
}: TicketStatusPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isPage = variant === 'page';

  useEffect(() => {
    if (!isOpen) return;

    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('mousedown', handleDocClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleDocClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleOptionClick = (optVal: string) => {
    setIsOpen(false);
    onSelectStatus(optVal);
  };

  const displayText = primaryLabel || `Pasar a ${nextStatusLabel}`;

  if (isPage) {
    return (
      <div ref={containerRef} className="flex relative ml-1 sm:ml-1.5" data-testid="ticket-status-picker">
        <button
          type="button"
          onClick={onAdvance}
          disabled={disabled || isLoading}
          className={`shrink-0 whitespace-nowrap h-[44px] px-5 sm:px-6 bg-[#024fff] text-white cursor-pointer font-anek text-[15px] font-bold flex items-center gap-2.5 hover:bg-[#0c57d3] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
            showDropdown ? 'rounded-l-lg' : 'rounded-lg'
          }`}
          data-testid="advance-status-btn"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          ) : (
            <ArrowRight className="w-4 h-4 shrink-0" />
          )}
          <span>{displayText}</span>
        </button>

        {showDropdown && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled}
            title="Otros estados"
            aria-expanded={isOpen}
            className="h-[44px] w-[42px] border-0 border-l border-white/30 bg-[#024fff] text-white rounded-r-lg cursor-pointer flex items-center justify-center hover:bg-[#0c57d3] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="status-dropdown-trigger"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        )}

        {isOpen && showDropdown && (
          <div
            className="absolute top-[52px] right-0 w-[240px] bg-white border border-[#d6dde5] rounded-[10px] shadow-[0_12px_32px_rgba(0,14,31,.16)] p-1.5 flex flex-col gap-0.5 z-40 text-left animate-in fade-in zoom-in-95 duration-100"
            data-testid="status-options-menu"
          >
            <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#8c96a3] px-2.5 pt-2 pb-1">
              Mover a
            </span>
            {options.map(opt => {
              const isCurrent = opt.value === currentStatus;
              const isNext = opt.value === nextStatusValue;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleOptionClick(opt.value)}
                  className={`w-full border-0 bg-transparent cursor-pointer font-anek text-[15px] p-2.5 rounded-md text-left transition-colors flex items-center justify-between ${
                    isCurrent
                      ? 'text-[#8c96a3] font-normal hover:bg-[#eef3f7]'
                      : isNext
                      ? 'text-[#024fff] font-bold hover:bg-[#eef3f7]'
                      : 'text-[#0d0d0d] font-normal hover:bg-[#eef3f7]'
                  }`}
                  data-testid={`status-option-${opt.value}`}
                >
                  <span>{isCurrent ? `${opt.label} · actual` : opt.label}</span>
                  {isCurrent && <Check className="w-3.5 h-3.5 text-[#8c96a3]" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Modal variant
  return (
    <div ref={containerRef} className="flex relative items-center" data-testid="ticket-status-picker">
      <button
        type="button"
        onClick={onAdvance}
        disabled={disabled || isLoading}
        className={`h-[38px] px-3.5 text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all select-none ${
          showDropdown ? 'rounded-l-lg' : 'rounded-lg'
        } ${
          disabled || isLoading
            ? 'bg-[#b9c2cd] cursor-not-allowed'
            : 'bg-[#024fff] hover:bg-[#0c57d3] cursor-pointer'
        }`}
        data-testid="advance-status-btn"
      >
        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
        <span className="leading-none flex items-center whitespace-nowrap">{displayText}</span>
        {shortcutHint && (
          <span className="text-[11px] font-medium opacity-75 leading-none shrink-0 ml-0.5">
            {shortcutHint}
          </span>
        )}
      </button>

      {showDropdown && (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          title="Otros estados"
          aria-expanded={isOpen}
          className="h-[38px] w-[34px] border-0 border-l border-white/30 bg-[#024fff] hover:bg-[#0c57d3] text-white rounded-r-lg cursor-pointer flex items-center justify-center transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="status-dropdown-trigger"
        >
          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
        </button>
      )}

      {isOpen && showDropdown && (
        <div
          className="absolute bottom-11 right-0 w-[220px] bg-white border border-[#d6dde5] rounded-[10px] shadow-[0_12px_32px_rgba(0,14,31,.16)] p-1.5 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
          data-testid="status-options-menu"
        >
          <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#8c96a3] p-1.5 pb-1">
            Mover a
          </span>
          {options.map(st => {
            const isCurrent = st.value === currentStatus;
            const isNext = st.value === nextStatusValue;
            return (
              <button
                key={st.value}
                type="button"
                onClick={() => handleOptionClick(st.value)}
                className={`border-0 bg-transparent cursor-pointer font-anek text-[13px] p-2 rounded-md text-left transition-colors flex items-center justify-between ${
                  isCurrent
                    ? 'text-[#8c96a3] bg-[#f7fafc]'
                    : isNext
                    ? 'text-[#024fff] font-bold hover:bg-[#024fff]/6'
                    : 'text-[#0d0d0d] hover:bg-[#eef3f7]'
                }`}
                data-testid={`status-option-${st.value}`}
              >
                <span>{st.label}</span>
                {isCurrent && <span className="text-[11px] text-[#8c96a3]">actual</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
