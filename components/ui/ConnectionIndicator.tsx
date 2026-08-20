'use client';

import { Loader2 } from 'lucide-react';
import { useAGUIState } from '@/lib/ag-ui/provider';
import { cn } from '@/lib/utils';

const CONFIG = {
  connecting: {
    label: 'Connecting',
    long: 'Connecting…',
    text: 'text-status-waiting',
    wash: 'bg-status-waiting/10',
    ring: 'ring-status-waiting/30',
    dot: 'bg-status-waiting',
    glow: '',
    spin: true,
  },
  open: {
    label: 'Live',
    long: 'Live · streaming',
    text: 'text-status-success',
    wash: 'bg-status-success/10',
    ring: 'ring-status-success/30',
    dot: 'bg-status-success',
    glow: 'shadow-[0_0_12px_-1px_rgba(74,222,128,0.95)]',
    spin: false,
  },
  closed: {
    label: 'Offline',
    long: 'Disconnected',
    text: 'text-status-waiting',
    wash: 'bg-status-waiting/10',
    ring: 'ring-status-waiting/30',
    dot: 'bg-status-waiting',
    glow: '',
    spin: false,
  },
  error: {
    label: 'Error',
    long: 'Connection error',
    text: 'text-status-failed',
    wash: 'bg-status-failed/10',
    ring: 'ring-status-failed/30',
    dot: 'bg-status-failed',
    glow: 'shadow-[0_0_12px_-1px_rgba(248,113,113,0.9)]',
    spin: false,
  },
} as const;

export function ConnectionIndicator({ long = false }: { long?: boolean }) {
  const { connection } = useAGUIState();
  const config = CONFIG[connection];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset backdrop-blur',
        config.wash,
        config.text,
        config.ring
      )}
    >
      {config.spin ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            config.dot,
            config.glow,
            connection === 'open' && 'animate-pulseDot'
          )}
          aria-hidden
        />
      )}
      {long ? config.long : config.label}
    </span>
  );
}
