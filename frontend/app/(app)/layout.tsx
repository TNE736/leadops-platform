import { TopNav } from '@/components/shell';

/**
 * Shell for the operational pages (dashboard, upload, lead journey): the
 * sticky TopNav plus a centred main column. The Home page at `/` sits outside
 * this route group on purpose; it is a standalone landing page with its own header.
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
