'use client';

import Link from 'next/link';
import { UploadCloud } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { StatCard } from '@/components/dashboard/StatCard';
import { EventPipeline } from '@/components/dashboard/EventPipeline';
import { EventFeed } from '@/components/events/EventFeed';
import { useAGUIState } from '@/lib/ag-ui/provider';

export default function DashboardPage() {
  const { events, activeLeads, stageCounts } = useAGUIState();
  const failed = events.filter((e) => e.status === 'failed').length;
  const completed = stageCounts['crm.updated'];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="LeadOps AI Platform"
          title="Dashboard"
          description="Real-time view of every lead moving through CSV ingestion, the lead agents, email delivery, the voice agent, and the HubSpot CRM update."
        />
        <Link
          href="/upload"
          className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          <UploadCloud className="h-4 w-4" />
          Upload leads CSV
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Active leads" value={activeLeads} hint="Currently in the pipeline" />
        <StatCard label="Contacts in HubSpot" value={stageCounts['crm.contact.upserted']} />
        <StatCard label="CRM updates" value={completed} tone="success" hint="Reached end of pipeline" />
        <StatCard label="Failed events" value={failed} tone={failed > 0 ? 'failed' : 'default'} />
      </div>

      <Panel eyebrow="Event Pipeline" title="Live stage-by-stage flow" className="mt-6" accent="purple">
        <EventPipeline />
      </Panel>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel eyebrow="Event Timeline" title="Recent activity" className="lg:col-span-2">
          <EventFeed events={events.slice(0, 12)} />
        </Panel>

        <Panel eyebrow="System" title="Connected services" accent="blue">
          <ul className="space-y-3 text-sm">
            {[
              ['Anthropic Claude', 'LLM — lead scoring & email generation'],
              ['Voice Provider', 'Twilio / Retell — outbound calls'],
              ['Mailgun', 'Transactional email delivery'],
              ['HubSpot CRM', 'Contact & deal sync'],
            ].map(([name, desc]) => (
              <li key={name} className="flex items-start justify-between gap-3">
                <span className="text-slate-200">{name}</span>
                <span className="text-right text-xs text-slate-500">{desc}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
