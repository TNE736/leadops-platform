'use client';

import { useCallback, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Loader2,
  MailCheck,
  MessageSquareReply,
  Send,
  UploadCloud,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { PageHeader } from '@/components/shell';
import { Panel } from '@/components/ui';
import {
  uploadCsvFiles,
  useConsultantMetrics,
  type ConsultantMetrics,
  type IngestSummary,
} from '@/lib/api';
import {
  configureLogging,
  currentRun,
  failSpan,
  runInsideSpan,
  startRun,
  startStep,
} from '@/lib/frontend_logging';
import { cn } from '@/lib/utils';

configureLogging(); // browser only; before the first run, so the upload's fetch is traced

const MAX_FILE_BYTES = 15 * 1024 * 1024;

// ── Queue: files are counted in the browser as soon as they are added; nothing is uploaded ──

/**
 * Counts a file's data rows in the browser (CSV, Excel or JSON) so the queue can validate it
 * before anything is sent. Throws an Error whose message is shown to the user.
 */
async function countFileRows(file: File): Promise<number> {
  const name = file.name.toLowerCase();
  if (file.size > MAX_FILE_BYTES) throw new Error('File too large — max 15 MB');

  if (name.endsWith('.json')) {
    const parsed = JSON.parse(await file.text());
    return (Array.isArray(parsed) ? parsed : (parsed.records ?? [])).length;
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const workbook = XLSX.read(await file.arrayBuffer());
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error('Empty Excel file');
    return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]!).length;
  }
  if (name.endsWith('.csv')) {
    const parsed = Papa.parse(await file.text(), { header: true, skipEmptyLines: 'greedy' });
    if (!parsed.meta.fields?.length) throw new Error('Not a readable CSV');
    return parsed.data.length;
  }
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '(no extension)';
  throw new Error(`${extension} format is not supported`);
}

interface QueuedFile {
  id: string;
  file: File;
  rows: number | null;
  error: string | null;
}

function useUploadQueue() {
  const [queue, setQueue] = useState<QueuedFile[]>([]);

  const updateQueuedFile = (id: string, changes: Partial<QueuedFile>) =>
    setQueue((previous) =>
      previous.map((queued) => (queued.id === id ? { ...queued, ...changes } : queued))
    );

  function enqueueFiles(files: File[]) {
    const added: QueuedFile[] = files.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      rows: null,
      error: null,
    }));
    setQueue((previous) => [...previous, ...added]);
    added.forEach(({ id, file }) => {
      countFileRows(file)
        .then((rows) => updateQueuedFile(id, { rows }))
        .catch((error: unknown) =>
          updateQueuedFile(id, {
            error: error instanceof Error ? error.message : 'Unreadable file',
          })
        );
    });
  }

  const isParsing = queue.some((queued) => queued.rows === null && !queued.error);
  const canUpload = queue.length > 0 && !isParsing && queue.every((queued) => !queued.error);

  return { queue, enqueueFiles, isParsing, canUpload };
}

// ── Dropzone ────────────────────────────────────────────────────────────────

/**
 * Looping "files rising into the cloud" motion graphic for the dropzone's empty state. Inline
 * SVG + the `floatUp` keyframe (tailwind.config.ts) so it stays crisp and inherits the theme.
 */
function UploadIllustration() {
  return (
    <div className="relative mb-1 flex h-20 w-36 items-center justify-center" aria-hidden>
      <span
        className="absolute bottom-7 left-8 h-2.5 w-2.5 rounded-[3px] bg-accent-indigo shadow-[0_0_10px_rgba(67,56,202,0.8)] animate-floatUp"
        style={{ animationDelay: '0s' }}
      />
      <span
        className="absolute bottom-7 left-[68px] h-2.5 w-2.5 rounded-[3px] bg-accent-fuchsia shadow-[0_0_10px_rgba(192,38,212,0.8)] animate-floatUp"
        style={{ animationDelay: '0.9s' }}
      />
      <span
        className="absolute bottom-7 left-[98px] h-2.5 w-2.5 rounded-[3px] bg-accent-emerald shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-floatUp"
        style={{ animationDelay: '1.8s' }}
      />
      <svg
        viewBox="0 0 120 68"
        className="relative h-14 w-28 drop-shadow-[0_10px_22px_rgba(124,58,237,0.35)]"
      >
        <defs>
          <linearGradient id="uploadCloudGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4338CA" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
        <path
          d="M32 54h54a19 19 0 0 0 2.8-37.8A25 25 0 0 0 40 11.5 17.5 17.5 0 0 0 32 54Z"
          fill="url(#uploadCloudGrad)"
          opacity="0.9"
        />
        <path
          d="M60 46V24m0 0-9 9m9-9 9 9"
          stroke="#FFFFFF"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

/** Drop zone for adding files to the queue. Selection alone never triggers ingestion. */
function CsvDropzone({
  onFiles,
  queuedCount = 0,
}: {
  onFiles: (files: File[]) => void;
  queuedCount?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const files = Array.from(fileList);
      if (files.length > 0) onFiles(files);
    },
    [onFiles]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      className={cn(
        'group relative flex cursor-pointer flex-col items-center justify-center gap-2.5 overflow-hidden rounded-2xl border border-dashed px-6 py-14 text-center transition-all duration-300',
        dragging
          ? 'border-brand bg-brand/12 shadow-glow-brand'
          : 'border-line-strong bg-sunken hover:border-brand/60 hover:bg-raised'
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-brand-gradient opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-15"
      />
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xls,.xlsx,.json"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {queuedCount > 0 ? (
        <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-line bg-sunken backdrop-blur transition-transform duration-300 group-hover:scale-110">
          <UploadCloud className="h-6 w-6 text-brand-ink" />
        </span>
      ) : (
        <UploadIllustration />
      )}
      <p className="relative mt-2 text-base font-medium text-ink">
        {queuedCount > 0
          ? 'Drop more files here, or click to add another'
          : 'Drop your consultants file here, or click to browse'}
      </p>
      <p className="relative text-xs text-ink-muted">CSV, Excel or JSON · parsed in your browser</p>
    </div>
  );
}

// ── Result panels ───────────────────────────────────────────────────────────

interface SummaryRow {
  label: string;
  value: string | number;
  toneClassName: string;
}

function buildSummaryRows(queuedCount: number, summary: IngestSummary | null): SummaryRow[] {
  const pending = '—';
  return [
    { label: 'Files queued', value: `${queuedCount}`, toneClassName: 'text-ink' },
    { label: 'Records seen', value: summary ? summary.total : pending, toneClassName: 'text-ink' },
    {
      label: 'Records saved',
      value: summary ? summary.insertedCount : pending,
      toneClassName: 'text-status-success',
    },
    ...(summary?.skippedDuplicate
      ? [
          {
            label: 'Already saved (skipped)',
            value: summary.skippedDuplicate,
            toneClassName: 'text-ink-muted',
          },
        ]
      : []),
    {
      label: 'Invalid',
      value: summary ? summary.invalid : pending,
      toneClassName: summary && summary.invalid > 0 ? 'text-status-failed' : 'text-ink-faint',
    },
  ];
}

function getResultTitle(summary: IngestSummary): string {
  if (summary.valid === 0) return 'No records passed validation';
  return summary.dbError
    ? 'Validated, but saving to the database failed'
    : 'Some rows were rejected';
}

/** Rejected rows (file, line, key, reasons) and any database error from one upload. */
function RowErrorsPanel({ summary }: { summary: IngestSummary }) {
  const { errors, errorsOmitted, dbError } = summary;
  return (
    <Panel
      tone="danger"
      className="mt-5 animate-rise"
      eyebrow="Result"
      title={getResultTitle(summary)}
    >
      {dbError && <p className="mb-3 text-xs text-status-failed">{dbError}</p>}

      {errors.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line-soft text-[11px] uppercase tracking-[0.12em] text-ink-faint">
                {['File', 'Row', 'Key', 'Issues'].map((heading) => (
                  <th key={heading} scope="col" className="px-4 py-2.5 font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {errors.map((rowError, index) => (
                // Rows are fixed for a given response, so an index key is stable.
                <tr key={index} className="transition-colors hover:bg-raised">
                  <td className="px-4 py-2.5 text-ink-secondary">{rowError.file}</td>
                  <td className="px-4 py-2.5 tabular-nums text-ink-faint">{rowError.row ?? '—'}</td>
                  <td className="px-4 py-2.5 text-ink-secondary">{rowError.key ?? '—'}</td>
                  <td className="px-4 py-2.5 text-status-failed">{rowError.issues.join('; ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {errorsOmitted > 0 && (
            <p className="border-t border-line-soft px-4 py-2.5 text-[11px] text-ink-muted">
              +{errorsOmitted} more error{errorsOmitted === 1 ? '' : 's'} not shown
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

interface MetricTile {
  key: keyof ConsultantMetrics;
  label: string;
  /** The MongoDB condition the number is counted from, shown as the caption. */
  mongoCondition: string;
  icon: LucideIcon;
  iconClassName: string;
  valueClassName: string;
}

/** The four tiles, in the order a consultant flows through them. */
const METRIC_TILES: MetricTile[] = [
  {
    key: 'consultants',
    label: 'Consultants',
    mongoCondition: 'consultants',
    icon: Users,
    iconClassName: 'bg-[#efeaff] text-[#7c3aed]',
    valueClassName: 'text-[#6d28d9]',
  },
  {
    key: 'emailed',
    label: 'Emailed',
    mongoCondition: 'stage ≥ emailed',
    icon: MailCheck,
    iconClassName: 'bg-[#eafaf1] text-[#16a34a]',
    valueClassName: 'text-[#15803d]',
  },
  {
    key: 'engaged',
    label: 'Engaged',
    mongoCondition: 'stage ≥ engaged',
    icon: MessageSquareReply,
    iconClassName: 'bg-[#fff2e6] text-[#ea7317]',
    valueClassName: 'text-[#c2570c]',
  },
  {
    key: 'qualified',
    label: 'Qualified',
    mongoCondition: 'stage ≥ qualified',
    icon: BadgeCheck,
    iconClassName: 'bg-[#fdeaf6] text-[#c026d3]',
    valueClassName: 'text-[#a21caf]',
  },
];

/** Live consultant totals from MongoDB; shows 0 until the first fetch lands. */
function LiveMetricsPanel({ metrics }: { metrics: ConsultantMetrics | null }) {
  return (
    <Panel
      className="mt-5 animate-rise"
      eyebrow="Live metrics"
      title="Pipeline snapshot"
      description="Live counts update as each stage carries traffic."
      accent="#7c3aed"
      icon={<Activity className="h-[18px] w-[18px]" />}
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {METRIC_TILES.map(
          ({ key, label, mongoCondition, icon: Icon, iconClassName, valueClassName }) => (
            <div key={key} className="rounded-2xl border border-line-soft bg-raised p-4">
              <span
                className={cn(
                  'mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg',
                  iconClassName
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <div
                className={cn('text-3xl font-extrabold leading-none tabular-nums', valueClassName)}
              >
                {metrics?.[key] ?? 0}
              </div>
              <div className="mt-2 text-[13px] font-semibold text-ink">{label}</div>
              <div className="mt-0.5 font-mono text-[11px] text-ink-faint">{mongoCondition}</div>
            </div>
          )
        )}
      </div>
    </Panel>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

/** Marks the current run failed with the reason (a refusal or a request the page could not complete). */
function markRunFailed(reason: string) {
  const run = currentRun();
  if (run) failSpan(run, reason);
}

export default function UploadPage() {
  const { queue, enqueueFiles, isParsing, canUpload } = useUploadQueue();
  const [isUploading, setIsUploading] = useState(false);
  const [summary, setSummary] = useState<IngestSummary | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const { metrics, refresh: refreshMetrics } = useConsultantMetrics();

  const savedCount = summary?.insertedCount;
  const isButtonDisabled = !canUpload || isUploading;

  function resetResult() {
    setSummary(null);
    setRequestError(null);
  }

  function handleFilesSelected(files: File[]) {
    resetResult();
    enqueueFiles(files);
  }

  async function handleUpload() {
    if (isButtonDisabled) return;
    setIsUploading(true);
    resetResult();
    const run = startRun('upload_consultants', { files: queue.length });
    try {
      const checking = startStep('check_files', { 'inputs.files': queue.length });
      queue.forEach((queued, index) => {
        const item = startStep(
          'check_file',
          { item: index + 1, of: queue.length, key: queued.file.name },
          checking
        );
        if (queued.error) failSpan(item, queued.error);
        else item.setAttribute('outputs.rows', queued.rows ?? 0);
        item.end();
      });
      checking.setAttribute(
        'outputs.rows',
        queue.reduce((sum, queued) => sum + (queued.rows ?? 0), 0)
      );
      checking.setAttribute(
        'outputs.skipped_keys',
        queue.filter((q) => q.error).map((q) => q.file.name)
      );
      checking.end();

      const sending = startStep('send_upload', {
        'inputs.file_names': queue.map((queued) => queued.file.name),
      });
      const result = await runInsideSpan(sending, () =>
        uploadCsvFiles(queue.map((queued) => queued.file))
      );
      if ('summary' in result) {
        sending.setAttribute('outputs.total', result.summary.total);
        sending.setAttribute('outputs.inserted_count', result.summary.insertedCount);
      } else {
        failSpan(sending, result.error);
      }
      sending.end();

      const showing = startStep('show_result', {
        'inputs.kind': 'summary' in result ? 'summary' : 'error',
      });
      if ('summary' in result) {
        setSummary(result.summary);
        refreshMetrics();
        showing.setAttribute('outputs.message', `${result.summary.insertedCount} saved`);
        showing.setAttribute('outputs.rejected_rows', result.summary.errors.length);
      } else {
        setRequestError(result.error);
        showing.setAttribute('outputs.message', result.error);
      }
      showing.end();

      if (!('summary' in result)) markRunFailed(result.error);
      else if (result.summary.valid === 0) markRunFailed('no records passed validation');
      else if (result.summary.dbError)
        markRunFailed(`MongoDB write failed: ${result.summary.dbError}`);
      if ('summary' in result) {
        run.setAttribute('outputs.saved', result.summary.insertedCount);
        run.setAttribute('outputs.skipped_duplicate', result.summary.skippedDuplicate);
        run.setAttribute('outputs.invalid', result.summary.invalid);
      }
    } finally {
      run.end();
      setIsUploading(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Ingestion" title="Upload Consultants" titleFont="font-upload" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel className="animate-rise" eyebrow="Source">
          <CsvDropzone onFiles={handleFilesSelected} queuedCount={queue.length} />
        </Panel>

        <Panel className="animate-rise" eyebrow="Summary" title="Import status">
          <dl className="space-y-3">
            {buildSummaryRows(queue.length, summary).map(({ label, value, toneClassName }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <dt className="text-ink-muted">{label}</dt>
                <dd className={cn('text-lg font-semibold tabular-nums', toneClassName)}>{value}</dd>
              </div>
            ))}
          </dl>

          <button
            onClick={handleUpload}
            disabled={isButtonDisabled}
            className={cn(
              'mt-6 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-all duration-200',
              isButtonDisabled
                ? 'cursor-not-allowed border border-line-soft bg-sunken text-ink-faint'
                : 'bg-brand-gradient text-onBrand shadow-glow-brand hover:scale-[1.02]'
            )}
          >
            {isUploading || isParsing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />{' '}
                {isUploading ? 'Processing…' : 'Parsing files…'}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {queue.length > 0 ? 'Process & Save' : 'Add a file'}
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
        <RowErrorsPanel summary={summary} />
      )}

      {summary?.inserted && (
        <Panel tone="success" className="mt-5 animate-rise">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-status-success" />
            <p className="text-sm text-ink">
              {savedCount} consultant{savedCount === 1 ? '' : 's'} saved to MongoDB.
            </p>
          </div>
        </Panel>
      )}

      <LiveMetricsPanel metrics={metrics} />
    </>
  );
}
