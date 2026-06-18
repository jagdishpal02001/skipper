/** Compact labelled metric used in the popup's status row. */
export function StatBadge({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 rounded-lg bg-surface-700 px-3 py-2 text-center">
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">
        {label}
      </div>
    </div>
  );
}
