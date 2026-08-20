'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_GROUPS, FOOTER_NAV, findNavGroup, type NavItem } from '@/components/layout/nav';
import { useAGUIState } from '@/lib/ag-ui/provider';
import { useCountUp } from '@/hooks/useCountUp';
import { ConnectionIndicator } from '@/components/ui/ConnectionIndicator';

const ALL_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), ...FOOTER_NAV];

// Same indigo → violet → fuchsia palette as the Home hero, hardcoded to
// match it exactly rather than the app's separate cyan `brand` tokens.
const BRAND_GRADIENT = 'linear-gradient(135deg,#4338CA,#7C3AED,#C026D3)';
const CTA_GRADIENT = 'linear-gradient(120deg,#4338CA,#7C3AED)';
const ACTIVE_TEXT = 'text-accent-violet'; // accent.violet === #7C3AED

/**
 * Replaces the old fixed left Sidebar. Styled to match the Home page: a
 * plain left-aligned row of links (not a bordered full-width bar), the same
 * indigo/violet/fuchsia gradient, and category pages "drill down" into a
 * hover dropdown of their own pages instead of a permanent second row.
 */
export function TopNav() {
  const pathname = usePathname();
  const activeGroup = findNavGroup(pathname) ?? (pathname === '/settings' ? 'Settings' : undefined);
  const { events } = useAGUIState();
  const total = useCountUp(events.length, 700);

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
            const firstHref = group.items[0]?.href ?? '/dashboard';
            const hasDropdown = group.items.length > 1;

            return (
              <div key={group.label} className="group relative">
                <Link
                  href={firstHref}
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
                      {group.items.map((item) => {
                        const itemActive = pathname === item.href;
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            aria-current={itemActive ? 'page' : undefined}
                            className={cn(
                              'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors',
                              itemActive
                                ? cn('font-semibold', ACTIVE_TEXT, 'bg-accent-violet/10')
                                : 'text-ink-muted hover:bg-raised hover:text-ink'
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {FOOTER_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-full px-3.5 py-2 text-sm font-semibold transition-colors',
                  active ? ACTIVE_TEXT : 'text-ink-muted hover:text-ink'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-line-soft bg-sunken px-3 py-1.5 text-xs text-ink-muted xl:inline-flex">
            <span className="tabular-nums text-ink">{total}</span>
            events in window
          </span>
          <ConnectionIndicator />
          <Link
            href="/upload"
            className="hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(124,58,237,0.55)] transition-transform hover:scale-[1.03] sm:inline-flex"
            style={{ background: CTA_GRADIENT }}
          >
            <UploadCloud className="h-4 w-4" />
            Upload Leads
          </Link>
        </div>
      </div>

      {/* Mobile: every page, flat, one scrollable row (no hover dropdowns on touch) */}
      <nav
        aria-label="All pages"
        className="flex gap-1.5 overflow-x-auto border-t border-line-soft px-4 py-2.5 md:hidden"
      >
        {ALL_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                active
                  ? cn('bg-accent-violet/10 ring-1 ring-inset ring-accent-violet/30', ACTIVE_TEXT)
                  : 'text-ink-muted hover:bg-raised hover:text-ink'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
