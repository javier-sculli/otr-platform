import { useState, useRef, useEffect } from 'react';
import { User as UserIcon, Plus, X, Check, Search } from 'lucide-react';

export interface UserOption {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

interface ResponsablesSelectProps {
  users: UserOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

// Colores armoniosos para avatares estilo Notion
const AVATAR_COLORS = [
  'bg-blue-500/15 text-blue-700 border-blue-200',
  'bg-emerald-500/15 text-emerald-700 border-emerald-200',
  'bg-purple-500/15 text-purple-700 border-purple-200',
  'bg-amber-500/15 text-amber-700 border-amber-200',
  'bg-rose-500/15 text-rose-700 border-rose-200',
  'bg-indigo-500/15 text-indigo-700 border-indigo-200',
  'bg-cyan-500/15 text-cyan-700 border-cyan-200',
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function getInitials(name: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ResponsablesSelect({
  users,
  selectedIds,
  onChange,
  disabled = false,
  placeholder = 'Asignar responsables',
  className = '',
}: ResponsablesSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedUsers = users.filter(u => selectedIds.includes(u.id));
  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleUser = (userId: string) => {
    if (disabled) return;
    if (selectedIds.includes(userId)) {
      const next = selectedIds.filter(id => id !== userId);
      onChange(next);
    } else {
      onChange([...selectedIds, userId]);
    }
  };

  const removeUser = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(selectedIds.filter(id => id !== userId));
  };

  return (
    <div ref={containerRef} className={`relative inline-block w-full ${className}`}>
      {/* Contenedor principal estilo Notion */}
      <div
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        className={`w-full min-h-[38px] px-2.5 py-1.5 border border-[#000033]/12 rounded-lg bg-white flex items-center flex-wrap gap-1.5 transition-all ${
          disabled
            ? 'opacity-60 cursor-not-allowed'
            : 'cursor-pointer hover:border-[#000033]/25 focus-within:ring-2 focus-within:ring-[#024fff]/25'
        }`}
      >
        {selectedUsers.length > 0 ? (
          selectedUsers.map(user => {
            const avatarStyle = getAvatarColor(user.name);
            return (
              <span
                key={user.id}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-semibold shadow-2xs transition-all ${avatarStyle}`}
              >
                <span className="w-4 h-4 rounded-full bg-white/70 flex items-center justify-center text-[9px] font-extrabold flex-shrink-0">
                  {getInitials(user.name)}
                </span>
                <span className="truncate max-w-[120px]">{user.name}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={e => removeUser(user.id, e)}
                    className="p-0.5 rounded hover:bg-black/10 transition-colors opacity-70 hover:opacity-100"
                    title="Remover responsable"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            );
          })
        ) : (
          <span className="text-xs text-[#000033]/35 font-medium flex items-center gap-1.5">
            <UserIcon className="w-3.5 h-3.5 text-[#000033]/30" />
            {placeholder}
          </span>
        )}

        {!disabled && (
          <button
            type="button"
            className="ml-auto text-[11px] font-bold text-[#024fff] hover:text-[#024fff]/80 flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-[#024fff]/5 transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">Agregar</span>
          </button>
        )}
      </div>

      {/* Popover desplegable flotante estilo Notion */}
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-1.5 w-64 bg-white border border-[#000033]/15 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Input de búsqueda */}
          {users.length > 4 && (
            <div className="p-2 border-b border-[#000033]/10 flex items-center gap-2 bg-[#fafafa]">
              <Search className="w-3.5 h-3.5 text-[#000033]/40 flex-shrink-0" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar responsable..."
                className="w-full text-xs bg-transparent border-none outline-none text-[#000033] placeholder:text-[#000033]/35"
                autoFocus
              />
            </div>
          )}

          {/* Header desplegable */}
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#000033]/40 bg-[#000033]/[0.02]">
            Seleccionar responsables ({selectedIds.length})
          </div>

          {/* Lista de usuarios */}
          <div className="max-h-56 overflow-y-auto p-1 space-y-0.5">
            {filteredUsers.length === 0 ? (
              <p className="text-xs text-[#000033]/40 p-3 text-center italic">No se encontraron usuarios</p>
            ) : (
              filteredUsers.map(u => {
                const isSelected = selectedIds.includes(u.id);
                const avatarStyle = getAvatarColor(u.name);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleUser(u.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                      isSelected
                        ? 'bg-[#024fff]/10 font-bold text-[#024fff]'
                        : 'hover:bg-[#000033]/5 text-[#000033]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border flex-shrink-0 ${avatarStyle}`}>
                        {getInitials(u.name)}
                      </span>
                      <div className="truncate">
                        <p className="truncate leading-none">{u.name}</p>
                        {u.role && (
                          <span className="text-[10px] font-normal text-[#000033]/40 capitalize">
                            {u.role.toLowerCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[#024fff] flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
