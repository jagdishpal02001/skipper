import type { ReactNode } from 'react';

/** Simple surface container with an optional title. */
export function Card({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/5 bg-surface-800 p-3">
      {(title || action) && (
        <header className="mb-2 flex items-center justify-between">
          {title && (
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
