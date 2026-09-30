'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronDown,
  GitCommitHorizontal,
  LayoutDashboard,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react';
import { Pill } from '@/components/ui';
import { useCountUp } from '@/hooks/useCountUp';
import { useAGUIState, type ConnectionState, type EventStatus } from '@/lib/ag-ui';
import { BRAND_GRADIENT, CTA_GRADIENT } from '@/lib/theme';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Single source of truth for navigation: grouped on desktop, flat on mobile and the Home header. */
const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Pipeline',
    items: [
      { href: '/upload', label: 'Upload Consultants', icon: UploadCloud },
      { href: '/lead-journey', label: 'Lead journey', icon: GitCommitHorizontal },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

/** The live-updates connection, expressed as a status tone plus its own label and glow. */
const CONNECTION_META: Record<ConnectionState, { label: string; tone: EventStatus; glow?: string }> = {
  connecting: { label: 'Connecting', tone: 'waiting' },
  open: { label: 'Live', tone: 'success', glow: 'shadow-[0_0_12px_-1px_rgba(74,222,128,0.95)]' },
  closed: { label: 'Offline', tone: 'waiting' },
  error: { label: 'Error', tone: 'failed', glow: 'shadow-[0_0_12px_-1px_rgba(248,113,113,0.9)]' },
};

/** Pill showing the state of the live-updates connection. */
export function ConnectionIndicator() {
  const { connection } = useAGUIState();
  const { label, tone, glow = '' } = CONNECTION_META[connection];
  return (
    <Pill
      large
      tone={tone}
      glow={glow}
      spin={connection === 'connecting'}
      pulse={connection === 'open'}
    >
      {label}
    </Pill>
  );
}

const ACTIVE_TEXT = 'text-accent-violet';

/**
 * App chrome, styled to match the Home page: a plain row of links with the same
 * indigo/violet/fuchsia gradient; category pages drill down into a hover dropdown.
 */
export function TopNav() {
  const pathname = usePathname();
  const activeGroup = NAV_GROUPS.find((group) =>
    group.items.some((item) => item.href === pathname)
  )?.label;
  const { events } = useAGUIState();
  const eventCount = useCountUp(events.length, 700);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/70 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-7 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="h-8 w-8 rounded-lg" style={{ background: BRAND_GRADIENT }} aria-hidden />
          <span className="hidden text-sm font-semibold tracking-tight text-ink sm:inline">
            LeadOps
          </span>
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
          {NAV_GROUPS.map((group) => {
            const active = activeGroup === group.label;
            const hasDropdown = group.items.length > 1;

            return (
              <div key={group.label} className="group relative">
                <Link
                  href={group.items[0]?.href ?? '/dashboard'}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors',
                    active ? ACTIVE_TEXT : 'text-ink-muted hover:text-ink'
                  )}
                >
                  {group.label}
                  {hasDropdown && (
                    <ChevronDown className="h-3.5 w-3.5 opacity-50 transition-transform group-hover:rotate-180" />
                  )}
                </Link>

                {hasDropdown && (
                  <div className="invisible absolute left-0 top-full z-30 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100">
                    <div className="min-w-[200px] rounded-2xl border border-line bg-card p-1.5 shadow-pop">
                      {group.items.map(({ href, label, icon: Icon }) => {
                        const itemActive = pathname === href;
                        return (
                          <Link
                            key={href}
                            href={href}
                            aria-current={itemActive ? 'page' : undefined}
                            className={cn(
                              'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors',
                              itemActive
                                ? cn('font-semibold', ACTIVE_TEXT, 'bg-accent-violet/10')
                                : 'text-ink-muted hover:bg-raised hover:text-ink'
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            {label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-line-soft bg-sunken px-3 py-1.5 text-xs text-ink-muted xl:inline-flex">
            <span className="tabular-nums text-ink">{eventCount}</span>
            events in window
          </span>
          <ConnectionIndicator />
          <Link
            href="/upload"
            className="hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(124,58,237,0.55)] transition-transform hover:scale-[1.03] sm:inline-flex"
            style={{ background: CTA_GRADIENT }}
          >
            <UploadCloud className="h-4 w-4" />
            Upload Consultants
          </Link>
        </div>
      </div>

      {/* Mobile: every page, flat, one scrollable row (no hover dropdowns on touch) */}
      <nav
        aria-label="All pages"
        className="flex gap-1.5 overflow-x-auto border-t border-line-soft px-4 py-2.5 md:hidden"
      >
        {ALL_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                active
                  ? cn('bg-accent-violet/10 ring-1 ring-inset ring-accent-violet/30', ACTIVE_TEXT)
                  : 'text-ink-muted hover:bg-raised hover:text-ink'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

/** Page title block: eyebrow, heading in the segment's typeface, and an optional description. */
export function PageHeader({
  eyebrow,
  title,
  description,
  titleFont,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: string;
  /** Segment heading typeface, e.g. "font-dashboard" — see tailwind.config.ts. */
  titleFont?: string;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5 animate-rise">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.18em] text-brand-ink">
            {eyebrow}
          </p>
        )}
        <h1 className={cn('text-3xl font-semibold tracking-tight text-ink sm:text-4xl', titleFont)}>
          {title}
        </h1>
        {description && (
          <p className="mt-2.5 max-w-3xl text-base leading-relaxed text-ink-muted">{description}</p>
        )}
      </div>
    </div>
  );
}
