import { TopNav } from '@/components/layout/TopNav';

/**
 * Chrome for the operational app (dashboard, analytics, upload, etc.) — a
 * sticky top nav with a two-level "drill down" (category pills, then that
 * category's own pages) instead of a fixed sidebar. The Home page at `/`
 * sits outside this route group on purpose: it's a standalone landing page
 * with its own header, so it doesn't inherit this layout.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full">
      <TopNav />
      <main className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
