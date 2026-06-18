import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-brand-500 hover:bg-brand-600 text-white',
  secondary:
    'bg-surface-600 hover:bg-surface-700 text-gray-100 border border-white/10',
  ghost: 'bg-transparent hover:bg-white/5 text-gray-300',
  danger: 'bg-red-500/90 hover:bg-red-500 text-white',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
  children: ReactNode;
}

/** Reusable button with a small set of opinionated variants. */
export function Button({
  variant = 'secondary',
  block = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={[
        'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[variant],
        block ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}
