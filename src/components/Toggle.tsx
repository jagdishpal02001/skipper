interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

/** Accessible on/off switch used throughout Skipper popup settings. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: ToggleProps) {
  const showLabel = label || description;
  return (
    <label
      className={`flex items-center justify-between gap-3 ${
        showLabel ? 'py-1.5' : ''
      } ${disabled ? 'opacity-40 select-none' : 'cursor-pointer'}`}
    >
      {showLabel && (
        <span className="min-w-0">
          {label && <span className="block text-xs font-medium text-gray-200">{label}</span>}
          {description && (
            <span className="block text-[10px] text-gray-400 leading-tight mt-0.5">{description}</span>
          )}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full border border-white/5 transition-all duration-300 ease-in-out focus:outline-none ${
          checked
            ? 'bg-gradient-to-r from-brand-600 to-brand-500 shadow-[0_0_8px_rgba(43,130,246,0.35)]'
            : 'bg-surface-600 hover:bg-surface-600/80'
        } ${disabled ? '' : 'hover:scale-105 active:scale-95'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-300 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );
}
