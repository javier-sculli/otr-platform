import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

export interface UserOption {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
}

export interface TicketOwnersPickerProps {
  assigneeIds: string[];
  users: UserOption[];
  onChange: (nextAssigneeIds: string[]) => void;
  label?: string;
  variant?: 'modal' | 'page';
  disabled?: boolean;
}

const ini = (n?: string) => {
  if (!n) return '??';
  return n
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
};

export function TicketOwnersPicker({
  assigneeIds,
  users,
  onChange,
  label = 'Responsables',
  variant = 'modal',
  disabled = false,
}: TicketOwnersPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const isPage = variant === 'page';

  // Filter candidates: users not already assigned matching search query
  const candidates = users.filter(
    u => !assigneeIds.includes(u.id) && u.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('mousedown', handleDocClick);
    return () => window.removeEventListener('mousedown', handleDocClick);
  }, [isOpen]);

  const handleAdd = (user: UserOption) => {
    if (disabled || assigneeIds.includes(user.id)) return;
    const next = [...assigneeIds, user.id];
    onChange(next);
    setQuery('');
    setIsOpen(false);
  };

  const handleRemove = (idToRemove: string) => {
    if (disabled) return;
    const next = assigneeIds.filter(id => id !== idToRemove);
    onChange(next);
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col ${isPage ? 'gap-2.5' : 'gap-1.5'}`}
      data-testid="ticket-owners-picker"
    >
      <div className="flex items-center justify-between">
        <label
          className={
            isPage
              ? 'text-[13px] font-[800] tracking-[0.07em] uppercase text-[#0d0d0d]'
              : 'text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675]'
          }
        >
          {label}
        </label>
        {!disabled && (
          <button
            type="button"
            onClick={() => {
              setIsOpen(!isOpen);
              setQuery('');
              setSelectedIndex(0);
            }}
            className="border-0 bg-transparent cursor-pointer font-anek text-[13px] text-[#024fff] font-bold p-0 hover:underline"
            aria-expanded={isOpen}
          >
            {isOpen ? '✕ Cerrar' : '+ Agregar'}
          </button>
        )}
      </div>

      {/* Pill list of assigned users */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {assigneeIds.map(uid => {
          const u = users.find(m => m.id === uid) || { id: uid, name: 'Usuario' };
          return (
            <span
              key={uid}
              className={`inline-flex items-center gap-1.5 bg-white border border-[#d6dde5] rounded-full font-medium leading-none box-border ${
                isPage
                  ? 'h-[32px] pl-1 pr-2.5 text-[14px]'
                  : 'h-[28px] pl-[3px] pr-2 text-[13px]'
              }`}
              data-testid={`owner-pill-${uid}`}
            >
              <span
                className={`shrink-0 rounded-full bg-[#024fff] text-white font-bold flex items-center justify-center leading-none select-none ${
                  isPage ? 'w-[24px] h-[24px] text-[10px]' : 'w-[22px] h-[22px] text-[10px]'
                }`}
              >
                <span className="translate-y-[0.5px] leading-none select-none">{ini(u.name)}</span>
              </span>
              <span className="leading-none select-none -translate-y-[1.5px] text-[#0d0d0d] truncate max-w-[140px]">
                {u.name}
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(uid)}
                  className="border-0 bg-transparent cursor-pointer text-[#8c96a3] w-[18px] h-[18px] rounded-full flex items-center justify-center hover:bg-[#eef3f7] hover:text-[#0d0d0d] p-0 shrink-0 ml-0.5"
                  title={`Quitar a ${u.name}`}
                  aria-label={`Quitar a ${u.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          );
        })}
        {assigneeIds.length === 0 && (
          <span className={`text-[#8c96a3] py-1 flex items-center leading-none ${isPage ? 'text-[15px]' : 'text-[13px]'}`}>
            Sin asignar
          </span>
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div
          className={`absolute right-0 w-[260px] bg-white border border-[#d6dde5] rounded-[10px] shadow-[0_12px_32px_rgba(0,14,31,.16)] p-2 z-40 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-100 ${
            isPage ? 'top-[34px]' : 'top-8'
          }`}
          data-testid="owners-dropdown"
        >
          <div className="flex items-center justify-between pb-1 border-b border-[#eef3f7] px-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5b6675]">Asignar persona</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-5 h-5 flex items-center justify-center rounded text-[#8c96a3] hover:text-[#0d0d0d] hover:bg-[#eef3f7] cursor-pointer"
              title="Cerrar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setIsOpen(false);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (candidates.length > 0) {
                  setSelectedIndex(prev => (prev + 1) % candidates.length);
                }
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (candidates.length > 0) {
                  setSelectedIndex(prev => (prev - 1 + candidates.length) % candidates.length);
                }
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const selected = candidates[selectedIndex];
                if (selected) {
                  handleAdd(selected);
                }
              }
            }}
            autoFocus
            placeholder="Buscar persona…"
            className="h-8 font-anek text-[13px] px-2.5 border border-[#d6dde5] rounded-md outline-none focus:border-[#024fff]"
          />

          <div className="flex flex-col max-h-[220px] overflow-y-auto">
            {candidates.length === 0 && (
              <span className="text-[13px] text-[#8c96a3] p-2 text-center">Nadie coincide con la búsqueda</span>
            )}
            {candidates.map((u, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={u.id}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => handleAdd(u)}
                  className={`flex items-center gap-2.5 border-0 cursor-pointer font-anek text-[13px] p-1.5 px-2 rounded-md text-left transition-colors ${
                    isSelected ? 'bg-[#024fff]/10 text-[#024fff] font-bold' : 'bg-transparent text-[#0d0d0d] hover:bg-[#eef3f7]'
                  }`}
                  data-testid={`candidate-user-${u.id}`}
                >
                  <span className="w-5 h-5 rounded-full bg-[#024fff] text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                    <span className="translate-y-[0.5px] leading-none select-none">{ini(u.name)}</span>
                  </span>
                  <span className="flex-1 truncate">{u.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
