'use client';

import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useAGUIState } from '@/lib/ag-ui/provider';
import { cn } from '@/lib/utils';

export function ConnectionIndicator() {
  const { connection } = useAGUIState();

  const config = {
    connecting: { icon: Loader2, label: 'Connecting…', color: 'text-status-waiting', spin: true },
    open: { icon: Wifi, label: 'Live · SSE / WebSocket', color: 'text-status-success', spin: false },
    closed: { icon: WifiOff, label: 'Disconnected', color: 'text-status-waiting', spin: false },
    error: { icon: WifiOff, label: 'Connection error', color: 'text-status-failed', spin: false },
  }[connection];

  const Icon = config.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-panel-raised px-2.5 py-1 text-xs',
        config.color
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', config.spin && 'animate-spin')} />
      {config.label}
    </div>
  );
}
