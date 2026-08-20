'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, UploadCloud, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectionIndicator } from '@/components/ui/ConnectionIndicator';
import { NAV_GROUPS, FOOTER_NAV, findNavItem, findNavGroup } from '@/components/layout/nav';
import { useAGUIState } from '@/lib/ag-ui/provider';
import { useCountUp } from '@/hooks/useCountUp';

const MOBILE_ITEMS = [...NAV_GROUPS.flatMap((g) => g.items), ...FOOTER_NAV];

export function TopBar() {
  const pathname = usePathname();
  const current = findNavItem(pathname);
  const group = findNavGroup(pathname);
  const { events } = useAGUIState();
  const total = useCountUp(events.length, 700);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/60 backdrop-blur-2xl">
      <div className="flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 lg:hidden">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient shadow-glow-brand">
            <Radio className="h-4 w-4 text-onBrand" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-ink">LeadOps</span>
        </Link>

        <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 lg:flex">
          {group && (
            <>
              <span className="text-sm text-ink-faint">{group}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
            </>
          )}
          <span className="truncate text-sm font-medium text-ink">
            {current?.label ?? 'LeadOps'}
          </span>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-line-soft bg-sunken px-3 py-1.5 text-xs text-ink-muted xl:inline-flex">
            <span className="tabular-nums text-ink">{total}</span>
            events in window
          </span>
          <ConnectionIndicator />
          <Link
            href="/upload"
            className="group relative hidden items-center gap-2 overflow-hidden rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-onBrand shadow-glow-brand transition-transform duration-200 hover:scale-[1.03] sm:inline-flex"
          >
            <UploadCloud className="h-4 w-4" />
            Upload Leads
          </Link>
        </div>
      </div>

      <nav className="flex gap-1.5 overflow-x-auto border-t border-line-soft px-4 py-2.5 lg:hidden">
        {MOBILE_ITEMS.map((item) => {
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
                  ? 'bg-brand/12 text-ink ring-1 ring-inset ring-line'
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
