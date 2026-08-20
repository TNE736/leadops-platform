'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { ConnectionIndicator } from '@/components/ui/ConnectionIndicator';

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Gateway & environment"
        description="Connection details for the AG-UI Gateway. Values are read from environment variables at build/run time."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel eyebrow="Real-time Updates" title="Connection status">
          <div className="space-y-4">
            <ConnectionIndicator />
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-border-soft pb-2">
                <dt className="text-slate-500">SSE endpoint</dt>
                <dd className="font-mono text-xs text-slate-300">
                  NEXT_PUBLIC_AG_UI_SSE_URL
                </dd>
              </div>
              <div className="flex justify-between pb-2">
                <dt className="text-slate-500">WebSocket endpoint</dt>
                <dd className="font-mono text-xs text-slate-300">
                  NEXT_PUBLIC_AG_UI_WS_URL
                </dd>
              </div>
            </dl>
          </div>
        </Panel>

        <Panel eyebrow="AG-UI Gateway" title="Server-side proxy" accent="purple">
          <p className="text-sm text-slate-400">
            <code className="rounded bg-panel-raised px-1.5 py-0.5 text-xs text-slate-200">
              /api/ag-ui/*
            </code>{' '}
            is rewritten in <code className="text-xs">next.config.mjs</code> to{' '}
            <code className="rounded bg-panel-raised px-1.5 py-0.5 text-xs text-slate-200">
              AG_UI_GATEWAY_URL
            </code>
            , so the Event Adapter, State Manager, Session Manager, Event Filtering, Auth &amp;
            Authz, and Rate Limiting all sit behind one same-origin path.
          </p>
        </Panel>
      </div>
    </>
  );
}
