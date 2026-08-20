'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { ConnectionIndicator } from '@/components/ui/ConnectionIndicator';
import { useAGUIState } from '@/lib/ag-ui/provider';
import { formatRelativeTime } from '@/lib/utils';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right font-mono text-xs text-ink">{value}</dd>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md border border-line-soft bg-sunken px-1.5 py-0.5 font-mono text-xs text-brand-ink">
      {children}
    </code>
  );
}

export default function SettingsPage() {
  const { connection, events, lastEventAt } = useAGUIState();

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Gateway & environment"
        description="Connection details for the AG-UI Gateway. Values are read from environment variables at build and run time."
      />

      <div className="stagger grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel
          eyebrow="Transport"
          title="Real-time channel"
          description="SSE is attempted first, with WebSocket as the fallback."
          actions={<ConnectionIndicator long />}
        >
          <dl className="divide-y divide-line-soft">
            <Row label="Transport state" value={connection} />
            <Row label="Events buffered" value={`${events.length} / 200`} />
            <Row
              label="Last event"
              value={lastEventAt ? formatRelativeTime(lastEventAt) : 'none yet'}
            />
            <Row label="SSE endpoint" value="NEXT_PUBLIC_AG_UI_SSE_URL" />
            <Row label="WebSocket endpoint" value="NEXT_PUBLIC_AG_UI_WS_URL" />
          </dl>
        </Panel>

        <Panel eyebrow="Routing" title="Server-side proxy" description="How requests reach the Gateway.">
          <p className="text-sm leading-relaxed text-ink-secondary">
            <Code>/api/ag-ui/*</Code> is rewritten in <Code>next.config.mjs</Code> to{' '}
            <Code>AG_UI_GATEWAY_URL</Code>, so the Event Adapter, State Manager, Session Manager,
            event filtering, auth and rate limiting all sit behind one same-origin path.
          </p>

          <div className="mt-5 rounded-xl border border-line-soft bg-sunken px-4 py-3.5">
            <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
              No gateway running?
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
              Unset <Code>NEXT_PUBLIC_AG_UI_SSE_URL</Code> and <Code>NEXT_PUBLIC_AG_UI_WS_URL</Code>{' '}
              to fall back to the local mock event stream, or upload a CSV to drive the pipeline
              directly.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
