import type { Metadata } from 'next';
import './globals.css';
import { AGUIProvider } from '@/lib/ag-ui';

export const metadata: Metadata = {
  title: 'LeadOps — Mission Control',
  description: 'From CSV to MongoDB and the outreach agents — real-time pipeline observability.',
};

/**
 * One Google Fonts request for the per-segment heading typefaces (see the
 * `--font-*` variables in globals.css and the matching `font-*` utilities in
 * tailwind.config.ts). Loaded as a stylesheet link rather than through
 * `next/font/google` so it degrades gracefully — the browser just falls back
 * to the stack's serif/sans-serif/monospace default — on any network that
 * can't reach Google Fonts, instead of failing the whole build.
 */
const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?' +
  [
    'family=Space+Grotesk:wght@500;600;700',
    'family=Outfit:wght@500;600',
    'family=Plus+Jakarta+Sans:wght@600;700',
  ].join('&') +
  '&display=swap';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={GOOGLE_FONTS_HREF} rel="stylesheet" />
      </head>
      <body className="bg-canvas">
        {/* AGUIProvider lives here (not in the (app) group) so the event
            stream is already connecting the moment someone lands on the
            Home page, before they ever click into the dashboard. */}
        <AGUIProvider>{children}</AGUIProvider>
      </body>
    </html>
  );
}
