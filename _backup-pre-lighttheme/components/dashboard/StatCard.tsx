import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'success' | 'failed';
}) {
  return (
    <div className="rounded-xl border border-border bg-panel/80 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          tone === 'success' && 'text-status-success',
          tone === 'failed' && 'text-status-failed',
          tone === 'default' && 'text-slate-50'
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
