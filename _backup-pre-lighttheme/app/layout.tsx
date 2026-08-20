import type { Metadata } from 'next';
import './globals.css';
import { AGUIProvider } from '@/lib/ag-ui/provider';
import { TopNav } from '@/components/layout/TopNav';

// Uses the system font stack defined in globals.css (--font-sans / --font-mono)
// so the build never depends on reaching fonts.googleapis.com. Swap in
// next/font/google (Inter, JetBrains_Mono) here if your environment has
// network access and you want the exact web fonts.

export const metadata: Metadata = {
  title: 'LeadOps AI Platform',
  description:
    'From CSV to Voice Agent and HubSpot — real-time observability with AG-UI.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AGUIProvider>
          <TopNav />
          <main className="mx-auto max-w-[1400px] px-6 py-8">{children}</main>
        </AGUIProvider>
      </body>
    </html>
  );
}
