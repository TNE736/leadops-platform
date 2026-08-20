import {
  LayoutDashboard,
  PieChart,
  UploadCloud,
  GitCommitHorizontal,
  Activity,
  AudioLines,
  ListTree,
  Webhook,
  Bell,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Single source of truth for navigation. The sidebar renders the groups; the
 * top bar looks up the current route here to label the breadcrumb, so the two
 * can never drift apart.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/analytics', label: 'Analytics', icon: PieChart },
    ],
  },
  {
    label: 'Pipeline',
    items: [
      { href: '/upload', label: 'Upload Leads', icon: UploadCloud },
      { href: '/lead-journey', label: 'Lead journey', icon: GitCommitHorizontal },
      { href: '/event-timeline', label: 'Event timeline', icon: Activity },
      { href: '/voice-transcript', label: 'Voice calls', icon: AudioLines },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/agent-traces', label: 'Agent traces', icon: ListTree },
      { href: '/integrations', label: 'Integrations', icon: Webhook },
      { href: '/alerts', label: 'Alerts', icon: Bell },
    ],
  },
];

export const FOOTER_NAV: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

const ALL_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), ...FOOTER_NAV];

/** Label for the current route, used by the top bar breadcrumb. */
export function findNavItem(pathname: string): NavItem | undefined {
  return ALL_ITEMS.find((item) => item.href === pathname);
}

/** The group a route belongs to, so the breadcrumb can read "Pipeline / Upload Leads". */
export function findNavGroup(pathname: string): string | undefined {
  return NAV_GROUPS.find((g) => g.items.some((i) => i.href === pathname))?.label;
}
