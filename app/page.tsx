import Link from 'next/link';
import { ArrowRight, UploadCloud } from 'lucide-react';
import { AmbientBackground } from '@/components/home/AmbientBackground';
import { PipelineDiagram } from '@/components/home/PipelineDiagram';

/**
 * Standalone landing page. Deliberately outside the `(app)` route group —
 * no sidebar, no top bar, its own minimal header. This is the only thing at
 * `/`; the operational app starts once someone clicks through to /dashboard.
 */
export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <AmbientBackground />

      <header className="relative z-10 mx-auto flex max-w-[1440px] items-center justify-between px-6 py-5 sm:px-12">
        <div className="flex items-center gap-2.5">
          <span
            className="h-8 w-8 rounded-lg"
            style={{ background: 'linear-gradient(135deg,#4338CA,#7C3AED,#C026D3)' }}
            aria-hidden
          />
          <span className="text-lg font-bold tracking-tight text-ink">LeadOps</span>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          <span className="text-sm font-semibold" style={{ color: '#7C3AED' }}>
            Home
          </span>
          <Link href="/dashboard" className="text-sm text-ink-muted transition-colors hover:text-ink">
            Dashboard
          </Link>
          <Link href="/upload" className="text-sm text-ink-muted transition-colors hover:text-ink">
            Upload Leads
          </Link>
          <Link href="/lead-journey" className="text-sm text-ink-muted transition-colors hover:text-ink">
            Lead journey
          </Link>
        </nav>

        <Link
          href="/dashboard"
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-canvas transition-transform hover:scale-[1.03]"
        >
          Open dashboard
        </Link>
      </header>

      <section className="relative z-10 mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-10 px-6 py-10 sm:px-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-16">
        <div>
          <div
            className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em]"
            style={{ color: '#7C3AED' }}
          >
            <span className="h-1.5 w-1.5 animate-pulseDot rounded-full" style={{ background: '#7C3AED' }} />
            Live pipeline observability
          </div>

          <h1 className="max-w-lg text-4xl font-bold leading-[1.15] tracking-tight text-ink sm:text-5xl">
            Every lead,{' '}
            <span
              style={{
                background: 'linear-gradient(120deg,#4338CA,#7C3AED 55%,#C026D3)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              followed up on automatically
            </span>
          </h1>

          <p className="mt-5 max-w-md text-base leading-relaxed text-ink-secondary sm:text-lg">
            LeadOps loads your consultants into MongoDB, emails them about matching roles, and
            follows up the moment they engage — one continuous pipeline you can watch run, step by
            step, in real time.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-6">
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-3 rounded-full py-1.5 pl-6 pr-1.5 text-sm font-bold uppercase tracking-wide text-white shadow-[0_14px_30px_-12px_rgba(124,58,237,0.55)] transition-transform hover:scale-[1.03]"
              style={{ background: 'linear-gradient(120deg,#4338CA,#7C3AED)' }}
            >
              Open dashboard
              <span
                className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white"
                style={{ color: '#7C3AED' }}
              >
                <ArrowRight className="absolute h-4 w-4 animate-arrowLoop" />
                <ArrowRight className="absolute h-4 w-4 animate-arrowLoop [animation-delay:0.55s]" />
              </span>
            </Link>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 border-b-[1.5px] border-ink pb-0.5 text-sm font-semibold text-ink"
            >
              <UploadCloud className="h-4 w-4" />
              Upload a Leads CSV
            </Link>
          </div>
        </div>

        <PipelineDiagram />
      </section>
    </div>
  );
}
