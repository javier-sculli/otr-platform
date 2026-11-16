import { useEffect, useRef, useState } from 'react';
import { Smile } from 'lucide-react';

// Set curado para copy de redes (sin dependencias externas).
export const EMOJI_CATEGORIES: { id: string; label: string; emojis: string[] }[] = [
  {
    id: 'frecuentes',
    label: 'Frecuentes',
    emojis: ['👉', '👇', '✅', '🚀', '💡', '📌', '🔥', '✨', '🙌', '👏', '💪', '🎯', '📈', '💙', '🤝', '⚡', '📣', '🗓️', '⏰', '🔗'],
  },
  {
    id: 'caras',
    label: 'Caras',
    emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '🙂', '😉', '😍', '🥰', '😎', '🤩', '🥳', '🤔', '🤓', '😮', '😱', '🙏', '😌', '😇', '🫶', '🤗', '😬', '🙃', '😢', '😤'],
  },
  {
    id: 'manos',
    label: 'Manos',
    emojis: ['👋', '👍', '👎', '👌', '✌️', '🤞', '🫵', '👆', '👈', '👉', '👇', '☝️', '✋', '🤙', '👏', '🙌', '🤝', '💪', '✍️', '🫡'],
  },
  {
    id: 'negocios',
    label: 'Negocios',
    emojis: ['💼', '📊', '📈', '📉', '💰', '💵', '💳', '🏦', '🧾', '📑', '📝', '📎', '🖇️', '🗂️', '📅', '📆', '🏢', '🧠', '🔍', '🛠️', '⚙️', '🔒', '🌐', '💻', '📱', '🤖', '🧩', '🏆', '🥇', '🎓'],
  },
  {
    id: 'simbolos',
    label: 'Símbolos',
    emojis: ['✅', '☑️', '✔️', '❌', '⚠️', '❗', '❓', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '🔄', '➕', '➖', '💯', '🆕', '🔝', '📍', '⭐', '🌟', '💥', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪'],
  },
  {
    id: 'objetos',
    label: 'Objetos',
    emojis: ['🎉', '🎊', '🎁', '🎈', '🎤', '🎧', '🎬', '📸', '🎥', '📺', '📰', '🗞️', '📚', '📖', '✏️', '🖊️', '☕', '🍻', '🥂', '🍕', '🌎', '🌱', '☀️', '🌙', '🌈', '❤️', '🧡', '💛', '💚', '💜'],
  },
];

interface EmojiPickerButtonProps {
  onPick: (emoji: string) => void;
  /** Se llama al abrir, antes de que el foco salga del editor (para guardar la selección). */
  onOpen?: () => void;
  variant?: 'toolbar' | 'bubble';
}

export function EmojiPickerButton({ onPick, onOpen, variant = 'toolbar' }: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState(EMOJI_CATEGORIES[0].id);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = EMOJI_CATEGORIES.find(c => c.id === cat) ?? EMOJI_CATEGORIES[0];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onMouseDown={e => {
          e.preventDefault();
          if (!open) onOpen?.();
          setOpen(o => !o);
        }}
        className={
          variant === 'bubble'
            ? 'min-w-[26px] h-6 px-1.5 border-0 bg-transparent rounded cursor-pointer text-white hover:bg-white/20 transition-colors flex items-center justify-center'
            : `min-w-[28px] h-7 px-1.5 border-0 rounded-md cursor-pointer text-[#3a4655] hover:bg-[#eef3f7] transition-colors flex items-center justify-center ${open ? 'bg-[#eef3f7]' : 'bg-transparent'}`
        }
        title="Insertar emoji"
        aria-label="Insertar emoji"
        aria-expanded={open}
      >
        <Smile className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Emojis"
          data-emoji-picker="1"
          onMouseDown={e => e.preventDefault()}
          className="absolute top-full left-0 mt-1.5 w-[296px] max-w-[calc(100vw-32px)] bg-white border border-[#d6dde5] rounded-[10px] shadow-[0_12px_32px_rgba(0,14,31,.24)] z-[70] p-1.5 flex flex-col gap-1"
        >
          <div className="flex gap-0.5 overflow-x-auto pb-1 border-b border-[#eef3f7]">
            {EMOJI_CATEGORIES.map(c => (
              <button
                key={c.id}
                type="button"
                onMouseDown={e => {
                  e.preventDefault();
                  setCat(c.id);
                }}
                className={`shrink-0 h-6 px-2 border-0 rounded-md cursor-pointer font-anek text-[12px] font-bold transition-colors ${
                  cat === c.id ? 'bg-[#024fff]/10 text-[#024fff]' : 'bg-transparent text-[#5b6675] hover:bg-[#eef3f7]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-0.5 max-h-[180px] overflow-y-auto">
            {current.emojis.map((em, i) => (
              <button
                key={`${em}-${i}`}
                type="button"
                onMouseDown={e => {
                  e.preventDefault();
                  onPick(em);
                }}
                className="h-8 w-full border-0 bg-transparent rounded-md cursor-pointer text-[18px] leading-none hover:bg-[#eef3f7] transition-colors"
                title={em}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
