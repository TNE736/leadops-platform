import { cn } from '@/lib/utils';
import type { EventStatus } from '@/lib/ag-ui/types';

/**
 * Status is never carried by colour alone — every badge renders a dot AND its
 * label, which is what keeps `triggered` (amber) and `failed` (red) separable
 * for red-green colour-blind readers.
 *
 * Each step clears WCAG AA on both the canvas and the frosted panel.
 */
const STATUS_META: Record<
  EventStatus,
  { label: string; dot: string; text: string; wash: string; ring: string; glow: string }
> = {
  success: {
    label: 'Success',
    dot: 'bg-status-success',
    text: 'text-status-success',
    wash: 'bg-status-success/10',
    ring: 'ring-status-success/30',
    glow: 'shadow-[0_0_10px_-1px_rgba(74,222,128,0.8)]',
  },
  running: {
    label: 'Running',
    dot: 'bg-status-running',
    text: 'text-status-running',
    wash: 'bg-status-running/10',
    ring: 'ring-status-running/30',
    glow: 'shadow-[0_0_10px_-1px_rgba(96,165,250,0.8)]',
  },
  triggered: {
    label: 'Triggered',
    dot: 'bg-status-triggered',
    text: 'text-status-triggered',
    wash: 'bg-status-triggered/10',
    ring: 'ring-status-triggered/30',
    glow: 'shadow-[0_0_10px_-1px_rgba(251,191,36,0.8)]',
  },
  waiting: {
    label: 'Waiting',
    dot: 'bg-status-waiting',
    text: 'text-status-waiting',
    wash: 'bg-status-waiting/10',
    ring: 'ring-status-waiting/30',
    glow: '',
  },
  failed: {
    label: 'Failed',
    dot: 'bg-status-failed',
    text: 'text-status-failed',
    wash: 'bg-status-failed/10',
    ring: 'ring-status-failed/30',
    glow: 'shadow-[0_0_10px_-1px_rgba(248,113,113,0.8)]',
  },
};

export function StatusBadge({
  status,
  pulse = false,
  className,
}: {
  status: EventStatus;
  pulse?: boolean;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-medium ring-1 ring-inset backdrop-blur',
        meta.wash,
        meta.text,
        meta.ring,
        className
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          meta.dot,
          meta.glow,
          pulse && 'animate-pulseDot'
        )}
        aria-hidden
      />
      {meta.label}
    </span>
  );
}
