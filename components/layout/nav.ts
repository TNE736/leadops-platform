import {
  LayoutDashboard,
  UploadCloud,
  GitCommitHorizontal,
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
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Pipeline',
    items: [
      { href: '/upload', label: 'Upload Leads', icon: UploadCloud },
      { href: '/lead-journey', label: 'Lead journey', icon: GitCommitHorizontal },
    ],
  },
];

const ALL_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Label for the current route, used by the top bar breadcrumb. */
export function findNavItem(pathname: string): NavItem | undefined {
  return ALL_ITEMS.find((item) => item.href === pathname);
}

/** The group a route belongs to, so the breadcrumb can read "Pipeline / Upload Leads". */
export function findNavGroup(pathname: string): string | undefined {
  return NAV_GROUPS.find((g) => g.items.some((i) => i.href === pathname))?.label;
}
