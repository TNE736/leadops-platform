import { cn } from '@/lib/utils';
import type { EventStatus } from '@/lib/ag-ui/types';

const STATUS_META: Record<EventStatus, { label: string; dot: string; text: string }> = {
  success: { label: 'Success', dot: 'bg-status-success', text: 'text-status-success' },
  running: { label: 'Running', dot: 'bg-status-running', text: 'text-status-running' },
  triggered: { label: 'Triggered', dot: 'bg-status-triggered', text: 'text-status-triggered' },
  waiting: { label: 'Waiting', dot: 'bg-status-waiting', text: 'text-status-waiting' },
  failed: { label: 'Failed', dot: 'bg-status-failed', text: 'text-status-failed' },
};

export function StatusBadge({ status, pulse = false }: { status: EventStatus; pulse?: boolean }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', meta.text)}>
      <span
        className={cn('h-2 w-2 rounded-full', meta.dot, pulse && 'animate-pulseDot')}
        aria-hidden
      />
      {meta.label}
    </span>
  );
}
