export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex items-center gap-2 group"
    >
      <div
        className={`relative w-9 h-5 rounded-full transition-colors ${
          checked ? 'bg-[#024fff]' : 'bg-[#000033]/20'
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </div>
      {label && (
        <span className="text-sm font-bold text-[#000033] group-hover:text-[#024fff] transition-colors">
          {label}
        </span>
      )}
    </button>
  );
}
