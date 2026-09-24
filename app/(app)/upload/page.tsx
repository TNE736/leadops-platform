'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Loader2,
  MailCheck,
  MessageSquareReply,
  Send,
  UserCheck,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { CsvDropzone } from '@/components/upload/CsvDropzone';
import { useConsultantMetrics, type ConsultantMetrics } from '@/hooks/useConsultantMetrics';
import { cn } from '@/lib/utils';

/** Shape of the JSON the FastAPI service returns (mirrors schema.py's summary). */
interface RowError {
  file: string;
  row: number | null;
  key?: string;
  issues: string[];
}

interface IngestSummary {
  kind?: 'consultants';
  total: number;
  valid: number;
  skippedNonDecisionMaker: number;
  skippedNotLead: number;
  skippedDuplicate?: number;
  invalid: number;
  inserted: boolean;
  insertedCount?: number;
  dbError?: string;
  errors: RowError[];
  errorsOmitted: number;
}

 const MIN_FILES = 1;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

/** The five Live Metrics tiles, in the order a consultant flows through them.
 *  `key` matches the JSON returned by GET /metrics/consultants; `wire` is the
 *  MongoDB condition the number is counted from (shown as the tile's caption). */
const METRICS: {
  key: keyof ConsultantMetrics;
  label: string;
  wire: string;
  icon: typeof Users;
  chip: string; // icon chip background
  tint: string; // number colour
}[] = [
  { key: 'consultants', label: 'Consultants', wire: 'consultants', icon: Users, chip: 'bg-[#efeaff] text-[#7c3aed]', tint: 'text-[#6d28d9]' },
  { key: 'decisionMakers', label: 'Decision Makers', wire: 'decision_maker=true', icon: UserCheck, chip: 'bg-[#e7f0ff] text-[#2563eb]', tint: 'text-[#1d4ed8]' },
  { key: 'emailed', label: 'Emailed', wire: 'stage ≥ emailed', icon: MailCheck, chip: 'bg-[#eafaf1] text-[#16a34a]', tint: 'text-[#15803d]' },
  { key: 'engaged', label: 'Engaged', wire: 'stage ≥ engaged', icon: MessageSquareReply, chip: 'bg-[#fff2e6] text-[#ea7317]', tint: 'text-[#c2570c]' },
  { key: 'qualified', label: 'Qualified', wire: 'stage ≥ qualified', icon: BadgeCheck, chip: 'bg-[#fdeaf6] text-[#c026d3]', tint: 'text-[#a21caf]' },
];

interface QueuedCsv {
  id: string;
  file: File;
  rows: number | null;
  error: string | null;
}

export default function UploadPage() {
  const [queue, setQueue] = useState<QueuedCsv[]>([]);
  const [sending, setSending] = useState(false);
  const [summary, setSummary] = useState<IngestSummary | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  // Live MongoDB totals for the tiles.
  const { metrics, refresh: refreshMetrics } = useConsultantMetrics();

  function addFiles(files: File[]) {
    setSummary(null);
    setRequestError(null);
    const entries: QueuedCsv[] = files.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      rows: null,
      error: null,
    }));
    setQueue((prev) => [...prev, ...entries]);

    entries.forEach(async (entry) => {
      try {
        const name = entry.file.name.toLowerCase();
        const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '(no extension)';
        let rows: number;

        if (entry.file.size > MAX_FILE_BYTES) throw new Error('File too large — max 15 MB');

        if (name.endsWith('.json')) {
          const data = JSON.parse(await entry.file.text());
          rows = (Array.isArray(data) ? data : data.records ?? []).length;
        } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
          const wb = XLSX.read(await entry.file.arrayBuffer());
          const sheetName = wb.SheetNames[0];
          if (!sheetName) throw new Error('Empty Excel file');
          rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]!).length;
        } else if (name.endsWith('.csv')) {
          const parsed = Papa.parse(await entry.file.text(), { header: true, skipEmptyLines: 'greedy' });
          if (!parsed.meta.fields?.length) throw new Error('Not a readable CSV');
          rows = parsed.data.length;
        } else {
          throw new Error(`${ext} format is not supported`);
        }

        setQueue((prev) => prev.map((q) => (q.id === entry.id ? { ...q, rows } : q)));
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unreadable file';
        setQueue((prev) => prev.map((q) => (q.id === entry.id ? { ...q, error: message } : q)));
      }
    });
  }

  const parsing = queue.some((q) => q.rows === null && !q.error);
  const ready = queue.length >= MIN_FILES && !parsing && queue.every((q) => !q.error);

  const saved = summary?.insertedCount;
  const noun = summary?.kind === 'consultants' ? 'consultant' : 'lead';

  async function handleUpload() {
    if (!ready || sending) return;
    setSending(true);
    setSummary(null);
    setRequestError(null);

    const formData = new FormData();
    queue.forEach((q) => formData.append('files', q.file));

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000'}/leads/ingest`,
        { method: 'POST', body: formData }
      );
      const body = await res.json();
      if ('total' in body) {
        setSummary(body as IngestSummary);
        refreshMetrics();
      }
      else setRequestError(body.error ?? `Server responded ${res.status}`);
    } catch {
      setRequestError('Could not reach the ingest API.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Ingestion"
        title="Upload Leads"
        titleFont="font-upload"
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel
          className="animate-rise"
          eyebrow="Source"
        >
          <CsvDropzone onFiles={addFiles} queuedCount={queue.length} />
        </Panel>

        <Panel className="animate-rise" eyebrow="Summary" title="Import status">
          <dl className="space-y-3">
            {[
              ['Files queued', `${queue.length}`, 'text-ink'],
              ['Records seen', summary ? summary.total : '—', 'text-ink'],
              [
                'Records saved',
                summary ? (saved ?? 0) : '—',
                'text-status-success',
              ],
              ...(summary?.skippedDuplicate
                ? [['Already saved (skipped)', summary.skippedDuplicate, 'text-ink-muted']]
                : []),
              [
                'Invalid',
                summary ? summary.invalid : '—',
                summary && summary.invalid > 0 ? 'text-status-failed' : 'text-ink-faint',
              ],
            ].map(([label, value, tone]) => (
              <div key={String(label)} className="flex items-center justify-between text-sm">
                <dt className="text-ink-muted">{label}</dt>
                <dd className={cn('text-lg font-semibold tabular-nums', tone as string)}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <button
            onClick={handleUpload}
            disabled={!ready || sending}
            className={cn(
              'mt-6 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-all duration-200',
              !ready || sending
                ? 'cursor-not-allowed border border-line-soft bg-sunken text-ink-faint'
                : 'bg-brand-gradient text-onBrand shadow-glow-brand hover:scale-[1.02]'
            )}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Processing…
              </>
            ) : parsing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Parsing files…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {queue.length >= MIN_FILES ? 'Process & Save' : 'Add a file'}
              </>
            )}
          </button>
        </Panel>
      </div>

      {requestError && (
        <Panel tone="danger" className="mt-5 animate-rise">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-failed" />
            <div>
              <p className="text-sm font-medium text-ink">Ingestion failed</p>
              <p className="mt-1 text-xs text-ink-muted">{requestError}</p>
            </div>
          </div>
        </Panel>
      )}

      {summary && (summary.errors.length > 0 || !!summary.dbError) && (
        <Panel
          tone="danger"
          className="mt-5 animate-rise"
          eyebrow="Result"
          title={
            summary.valid === 0
              ? summary.skippedNonDecisionMaker + summary.skippedNotLead > 0
                ? 'No eligible leads to save'
                : 'No records passed validation'
              : summary.dbError
                ? 'Validated, but saving to the database failed'
                : 'Some rows were rejected'
          }
        >
          {summary.dbError && (
            <p className="mb-3 text-xs text-status-failed">{summary.dbError}</p>
          )}

          {summary.errors.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line-soft text-[11px] uppercase tracking-[0.12em] text-ink-faint">
                    <th scope="col" className="px-4 py-2.5 font-semibold">File</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Row</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Key</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {summary.errors.map((err, i) => (
                    <tr key={i} className="transition-colors hover:bg-raised">
                      <td className="px-4 py-2.5 text-ink-secondary">{err.file}</td>
                      <td className="px-4 py-2.5 tabular-nums text-ink-faint">{err.row ?? '—'}</td>
                      <td className="px-4 py-2.5 text-ink-secondary">{err.key ?? '—'}</td>
                      <td className="px-4 py-2.5 text-status-failed">{err.issues.join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {summary.errorsOmitted > 0 && (
                <p className="border-t border-line-soft px-4 py-2.5 text-[11px] text-ink-muted">
                  +{summary.errorsOmitted} more error{summary.errorsOmitted === 1 ? '' : 's'} not shown
                </p>
              )}
            </div>
          )}
        </Panel>
      )}

      {summary?.inserted && (
        <Panel tone="success" className="mt-5 animate-rise">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-status-success" />
            <p className="text-sm text-ink">
              {saved} {noun}{saved === 1 ? '' : 's'} saved to MongoDB.
            </p>
          </div>
        </Panel>
      )}

      <Panel
        className="mt-5 animate-rise"
        eyebrow="Live metrics"
        title="Pipeline snapshot"
        description="Live counts update as each stage carries traffic."
        accent="#7c3aed"
        icon={<Activity className="h-[18px] w-[18px]" />}
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {METRICS.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.key}
                className="rounded-2xl border border-line-soft bg-raised p-4"
              >
                <span
                  className={cn(
                    'mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg',
                    m.chip
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className={cn('text-3xl font-extrabold leading-none tabular-nums', m.tint)}>
                  {metrics?.[m.key] ?? 0}
                </div>
                <div className="mt-2 text-[13px] font-semibold text-ink">{m.label}</div>
                <div className="mt-0.5 font-mono text-[11px] text-ink-faint">{m.wire}</div>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}
