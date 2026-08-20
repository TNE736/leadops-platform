'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_GROUPS, FOOTER_NAV, type NavItem } from '@/components/layout/nav';
import { useAGUIState } from '@/lib/ag-ui/provider';

function NavLink({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl py-2.5 pl-3.5 pr-2.5 text-sm transition-all duration-200',
        active
          ? 'bg-brand/12 font-medium text-ink shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]'
          : 'text-ink-muted hover:bg-raised hover:text-ink'
      )}
    >
      {/* Glowing active rail. */}
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-brand-gradient shadow-glow-brand"
        />
      )}
      <Icon
        className={cn(
          'h-[18px] w-[18px] shrink-0 transition-colors',
          active ? 'text-brand-ink' : 'text-ink-faint group-hover:text-brand-ink'
        )}
      />
      <span className="truncate">{item.label}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span className="ml-auto rounded-full bg-status-failed/15 px-2 py-0.5 text-2xs font-semibold tabular-nums text-status-failed ring-1 ring-inset ring-status-failed/30">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { events, connection } = useAGUIState();
  const alertCount = events.filter(
    (e) => e.status === 'failed' || e.type === 'error.occurred'
  ).length;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line bg-canvas/70 backdrop-blur-2xl lg:flex">
      {/* Brand — links back to the Home landing page, which lives outside this chrome. */}
      <Link
        href="/"
        className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-5 transition-opacity hover:opacity-80"
      >
        <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient shadow-glow-brand">
          <Radio className="h-[18px] w-[18px] text-onBrand" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold tracking-tight text-ink">LeadOps</p>
          <p className="truncate text-2xs tracking-wide text-ink-faint">Mission Control</p>
        </div>
      </Link>

      <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3.5 text-2xs font-semibold uppercase tracking-[0.16em] text-ink-faint">
              {group.label}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    item={item}
                    active={pathname === item.href}
                    badge={item.href === '/alerts' ? alertCount : undefined}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Stream telemetry, pinned to the bottom. */}
      <div className="shrink-0 space-y-3 border-t border-line px-3 py-4">
        <div className="rounded-xl border border-line-soft bg-sunken px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-2xs uppercase tracking-[0.14em] text-ink-faint">Stream</span>
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                connection === 'open'
                  ? 'animate-pulseDot bg-status-success shadow-[0_0_10px_-1px_rgba(74,222,128,0.9)]'
                  : connection === 'error'
                    ? 'bg-status-failed'
                    : 'bg-status-waiting'
              )}
              aria-hidden
            />
          </div>
          <p className="mt-1 text-sm font-medium tabular-nums text-ink">
            {events.length}
            <span className="ml-1 text-2xs font-normal text-ink-faint">events buffered</span>
          </p>
        </div>

        <ul className="space-y-1">
          {FOOTER_NAV.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={pathname === item.href} />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
