import React, { useState, useRef, useEffect, useCallback } from 'react';

interface User {
  id: string;
  name: string;
  email?: string;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  users: User[];
  disabled?: boolean;
  autoFocus?: boolean;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onPasteImage?: (file: File) => void;
}

function ini(name?: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function normalizeStr(str: string): string {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export const MentionTextarea: React.FC<MentionTextareaProps> = ({
  value,
  onChange,
  onKeyDown,
  placeholder,
  rows = 2,
  className = '',
  users,
  disabled = false,
  autoFocus = false,
  onPaste,
  onPasteImage,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter users based on query
  const filteredUsers = React.useMemo(() => {
    if (!isOpen) return [];
    const q = normalizeStr(mentionQuery);
    const list = users.filter(u => {
      if (!q) return true;
      const nameNorm = normalizeStr(u.name);
      const emailNorm = normalizeStr(u.email || '');
      return nameNorm.includes(q) || emailNorm.includes(q);
    });
    return list.slice(0, 6);
  }, [isOpen, mentionQuery, users]);

  // Check for mention trigger on text/cursor change
  const checkForMention = useCallback((text: string, cursorPos: number) => {
    const textBeforeCursor = text.slice(0, cursorPos);
    // Match @ followed by valid characters at cursor
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9áéíóúñÁÉÍÓÚÑ._-]*)$/);

    if (match) {
      const query = match[1];
      const atIndex = textBeforeCursor.lastIndexOf('@');
      setMentionQuery(query);
      setMentionStartPos(atIndex);
      setIsOpen(true);
      setSelectedIndex(0);
    } else {
      setIsOpen(false);
      setMentionStartPos(null);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    const rawPos = e.target.selectionStart;
    const cursorPos = (rawPos === 0 && nextVal.length > 0) ? nextVal.length : (rawPos ?? nextVal.length);
    onChange(nextVal);
    checkForMention(nextVal, cursorPos);
  };

  const handleSelectUser = useCallback(
    (u: User) => {
      if (mentionStartPos === null || !textareaRef.current) return;
      const cursorPos = textareaRef.current.selectionStart || value.length;
      const before = value.slice(0, mentionStartPos);
      const mentionInsert = `@${u.name} `;
      const after = value.slice(cursorPos);
      const nextVal = before + mentionInsert + after;

      onChange(nextVal);
      setIsOpen(false);
      setMentionStartPos(null);

      const nextCursorPos = mentionStartPos + mentionInsert.length;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(nextCursorPos, nextCursorPos);
        }
      }, 0);
    },
    [mentionStartPos, value, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isOpen && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredUsers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredUsers[selectedIndex];
        if (selected) {
          handleSelectUser(selected);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        return;
      }
    }

    onKeyDown?.(e);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      if (textareaRef.current) {
        checkForMention(textareaRef.current.value, textareaRef.current.selectionStart);
      }
    }
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (ev: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(ev.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(ev.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (onPasteImage) {
      const items = Array.from(e.clipboardData.items || []);
      const imageItem = items.find((item) => item.type.startsWith('image/'));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
          e.preventDefault();
          onPasteImage(file);
          return;
        }
      }
    }
    onPaste?.(e);
  };

  return (
    <div className="relative flex-1 min-w-0">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onPaste={handlePaste}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        autoFocus={autoFocus}
        className={className}
      />

      {isOpen && filteredUsers.length > 0 && (
        <div
          ref={menuRef}
          data-mention-dropdown="1"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="absolute top-full left-0 mt-1.5 w-[260px] max-h-[220px] bg-white border border-[#d6dde5] rounded-[10px] shadow-[0_12px_32px_rgba(0,14,31,.24)] overflow-y-auto z-[60] p-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2 py-1 text-[10px] font-bold text-[#8c96a3] uppercase tracking-[0.08em] border-b border-[#eef3f7] mb-0.5 flex items-center justify-between">
            <span>Mencionar a:</span>
            <span className="text-[9px] font-normal lowercase opacity-75">↑↓ para navegar ↵ elegir</span>
          </div>

          {filteredUsers.map((u, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={u.id}
                type="button"
                onMouseDown={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                  handleSelectUser(u);
                }}
                onClick={e => {
                  e.stopPropagation();
                }}
                className={`flex items-center gap-2 p-1.5 px-2 rounded-md cursor-pointer text-left transition-colors border-0 font-anek ${
                  isSelected ? 'bg-[#024fff]/10 text-[#024fff]' : 'hover:bg-[#eef3f7] text-[#0d0d0d] bg-transparent'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-[#024fff] text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                  <span className="translate-y-[0.5px] leading-none select-none">{ini(u.name)}</span>
                </span>
                <div className="flex-1 min-w-0 flex flex-col leading-tight">
                  <span className={`text-[13px] truncate ${isSelected ? 'font-bold' : 'font-medium'}`}>{u.name}</span>
                  {u.email && <span className="text-[11px] text-[#8c96a3] truncate font-normal">{u.email}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * Helper to render comment text with styled @mentions
 */
export function formatCommentWithMentions(content?: string): React.ReactNode {
  if (!content) return null;

  // Split text by mention tokens (e.g. @Nombre or @Nombre Apellido)
  // Match @ followed by letters, accents, numbers, underscores
  const regex = /(@[A-Za-z0-9áéíóúñÁÉÍÓÚÑ._-]+(?:\s+[A-Za-z0-9áéíóúñÁÉÍÓÚÑ._-]+)?)/g;
  const parts = content.split(regex);

  return parts.map((part, i) => {
    if (part.startsWith('@') && part.length > 1) {
      return (
        <span
          key={i}
          className="inline-flex items-center text-[#024fff] font-bold bg-[#024fff]/8 px-1 py-0.2 rounded font-anek mx-0.5"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}
