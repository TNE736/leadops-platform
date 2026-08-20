'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  GitCommitHorizontal,
  ListTree,
  Activity,
  AudioLines,
  PieChart,
  Bell,
  Settings as SettingsIcon,
  Radio,
  UploadCloud,
  Webhook,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectionIndicator } from '@/components/ui/ConnectionIndicator';

const NAV_ITEMS = [
  { href: '/upload', label: 'Upload', icon: UploadCloud },
  { href: '/', label: 'Dashboard', icon: BarChart3 },
  { href: '/lead-journey', label: 'Lead Journey', icon: GitCommitHorizontal },
  { href: '/agent-traces', label: 'Agent Traces', icon: ListTree },
  { href: '/event-timeline', label: 'Event Timeline', icon: Activity },
  { href: '/voice-transcript', label: 'Voice Transcript', icon: AudioLines },
  { href: '/analytics', label: 'Analytics', icon: PieChart },
  { href: '/integrations', label: 'Integrations', icon: Webhook },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Radio className="h-5 w-5 text-brand-purple" />
          <span className="text-sm font-semibold tracking-tight text-slate-100">
            LeadOps <span className="text-slate-500 font-normal">/ Next.js Frontend</span>
          </span>
        </Link>

        <nav className="flex flex-1 items-center justify-center gap-1 overflow-x-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'bg-panel-raised text-slate-100 shadow-glow border border-brand-purple/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-panel-raised/60 border border-transparent'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0">
          <ConnectionIndicator />
        </div>
      </div>
    </header>
  );
}
