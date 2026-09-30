'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  PhoneCall,
  Send,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react';
import { ALL_NAV_ITEMS } from '@/components/shell';
import { ACCENT, BRAND_GRADIENT, CTA_GRADIENT, HERO_TEXT_GRADIENT } from '@/lib/theme';

interface Particle {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
}

/**
 * Slow-drifting gradient blobs plus rising particles, fixed behind the whole landing page.
 * Particles are generated after mount: Math.random() during render would give the server and
 * client different markup and trigger a hydration mismatch.
 */
function AmbientBackground() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 4 + Math.random() * 6,
        duration: 7 + Math.random() * 6,
        delay: Math.random() * -12,
      }))
    );
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <span
        className="absolute -left-32 -top-40 h-[520px] w-[520px] rounded-full opacity-30 blur-[80px] animate-driftA"
        style={{ background: `radial-gradient(circle, ${ACCENT.indigo}, transparent 70%)` }}
      />
      <span
        className="absolute -right-36 top-24 h-[460px] w-[460px] rounded-full opacity-30 blur-[80px] animate-driftB"
        style={{ background: `radial-gradient(circle, ${ACCENT.fuchsia}, transparent 70%)` }}
      />
      <span
        className="absolute left-[38%] -bottom-36 h-[380px] w-[380px] rounded-full opacity-25 blur-[80px] animate-driftC"
        style={{ background: `radial-gradient(circle, ${ACCENT.violet}, transparent 70%)` }}
      />
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute -bottom-2 rounded-full opacity-0 animate-particleRise"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: `linear-gradient(135deg,${ACCENT.violet},${ACCENT.fuchsia})`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

const STEPS: Array<{ icon: LucideIcon; title: string; desc: string; gradient: string }> = [
  {
    icon: UploadCloud,
    title: 'CSV upload',
    desc: 'Consultants parsed & validated',
    gradient: 'linear-gradient(135deg,#4338CA,#6D28D9)',
  },
  {
    icon: Database,
    title: 'MongoDB',
    desc: 'Consultants saved & tracked',
    gradient: 'linear-gradient(135deg,#7C3AED,#A855F7)',
  },
  {
    icon: Send,
    title: 'Email agent',
    desc: 'Outreach sent via Mailgun',
    gradient: 'linear-gradient(135deg,#A855F7,#C026D3)',
  },
  {
    icon: PhoneCall,
    title: 'Voice agent',
    desc: 'Call placed on engagement',
    gradient: 'linear-gradient(135deg,#C026D3,#E879F9)',
  },
  {
    icon: CheckCircle2,
    title: 'Stage updated',
    desc: 'Outcome written to MongoDB',
    gradient: 'linear-gradient(135deg,#6D28D9,#4338CA)',
  },
];

// One shared 6.4s cycle (popIn/growIn in tailwind.config.ts): each step pops in after the last,
// the connector above it grows to meet it, then the whole thing holds, fades and loops.
const NODE_DELAYS = [0, 1.05, 2.1, 3.15, 4.2];
const CONNECTOR_DELAYS = [0.6, 1.65, 2.7, 3.75];

/** "The pipeline, live": the five hops a lead makes, revealed one at a time. */
function PipelineDiagram() {
  return (
    <div
      className="relative h-full rounded-2xl border border-line p-7"
      style={{
        background:
          'radial-gradient(circle at 15% 15%, rgba(67,56,202,0.08), transparent 55%), radial-gradient(circle at 85% 85%, rgba(192,38,212,0.08), transparent 55%), #FFFFFF',
      }}
    >
      <p className="mb-5 text-2xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
        The pipeline, live
      </p>
      <div className="flex flex-col">
        {STEPS.map(({ icon: Icon, title, desc, gradient }, i) => (
          <div key={title}>
            {i > 0 && (
              <div
                className="ml-[22px] h-[24px] w-0.5 origin-top animate-growIn opacity-0"
                style={{ background: '#E7E3F1', animationDelay: `${CONNECTOR_DELAYS[i - 1]}s` }}
              />
            )}
            <div
              className="flex items-center gap-3.5 py-1 animate-popIn opacity-0"
              style={{ animationDelay: `${NODE_DELAYS[i]}s` }}
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-[0_8px_18px_-8px_rgba(0,0,0,0.4)]"
                style={{ background: gradient }}
              >
                <Icon className="h-[19px] w-[19px]" />
              </span>
              <span className="min-w-0">
                <b className="block truncate text-sm font-bold text-ink">{title}</b>
                <span className="mt-0.5 block truncate text-xs text-ink-faint">{desc}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Standalone landing page, deliberately outside the `(app)` route group: no top bar, its own
 * minimal header. The operational app starts once someone clicks through to /dashboard.
 */
export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <AmbientBackground />

      <header className="relative z-10 mx-auto flex max-w-[1440px] items-center justify-between px-6 py-5 sm:px-12">
        <div className="flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-lg" style={{ background: BRAND_GRADIENT }} aria-hidden />
          <span className="text-lg font-bold tracking-tight text-ink">LeadOps</span>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          <span className="text-sm font-semibold" style={{ color: ACCENT.violet }}>
            Home
          </span>
          {ALL_NAV_ITEMS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-ink-muted transition-colors hover:text-ink"
            >
              {label}
            </Link>
          ))}
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
            style={{ color: ACCENT.violet }}
          >
            <span
              className="h-1.5 w-1.5 animate-pulseDot rounded-full"
              style={{ background: ACCENT.violet }}
            />
            Live pipeline observability
          </div>

          <h1 className="max-w-lg text-4xl font-bold leading-[1.15] tracking-tight text-ink sm:text-5xl">
            Every lead,{' '}
            <span
              style={{
                background: HERO_TEXT_GRADIENT,
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
              style={{ background: CTA_GRADIENT }}
            >
              Open dashboard
              <span
                className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white"
                style={{ color: ACCENT.violet }}
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
              Upload a consultants CSV
            </Link>
          </div>
        </div>

        <PipelineDiagram />
      </section>
    </div>
  );
}
