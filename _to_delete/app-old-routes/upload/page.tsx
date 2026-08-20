'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Send, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { CsvDropzone } from '@/components/upload/CsvDropzone';
import { CsvFileQueue, type QueuedFile } from '@/components/upload/CsvFileQueue';
import { parseLeadsCsv } from '@/lib/ag-ui/csv';
import { uploadCsvToGateway } from '@/lib/ag-ui/upload';
import { getAGUIClient } from '@/lib/ag-ui/client';
import { cn } from '@/lib/utils';

type SendState = 'idle' | 'sending' | 'sent';

const NEXT_STEPS = [
  'Lead Profile Agent scores each lead and checks eligibility.',
  'Eligible leads are upserted into HubSpot via MCP.',
  'Email Agent reads the profile from HubSpot and sends via Mailgun.',
  'Mailgun → HubSpot → webhook updates delivery status live.',
  'On “opened”, the Gateway triggers the Voice Agent.',
];

function makeQueueId(file: File) {
  return `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function UploadPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [sendState, setSendState] = useState<SendState>('idle');
  const [gatewayNotes, setGatewayNotes] = useState<string[]>([]);
  const [sentCount, setSentCount] = useState(0);
  const [sentFileCount, setSentFileCount] = useState(0);

  // Adding files only parses them for preview — it never contacts the Gateway
  // or the Lead Profile Agent. That happens only in handleUpload.
  function addFiles(files: File[]) {
    setSendState('idle');
    setGatewayNotes([]);

    const entries: QueuedFile[] = files.map((file) => ({
      id: makeQueueId(file),
      file,
      parsed: null,
      error: null,
      parsing: true,
    }));
    setQueue((prev) => [...prev, ...entries]);

    entries.forEach(async (entry) => {
      try {
        const result = await parseLeadsCsv(entry.file);
        setQueue((prev) =>
          prev.map((q) => (q.id === entry.id ? { ...q, parsed: result, parsing: false } : q))
        );
      } catch {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === entry.id
              ? {
                  ...q,
                  error: 'Could not parse this file. Make sure it is a valid CSV.',
                  parsing: false,
                }
              : q
          )
        );
      }
    });
  }

  function removeFile(id: string) {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }

  const totals = useMemo(() => {
    let rows = 0;
    let valid = 0;
    let invalid = 0;
    for (const item of queue) {
      if (!item.parsed) continue;
      rows += item.parsed.rows.length;
      valid += item.parsed.validCount;
      invalid += item.parsed.invalidCount;
    }
    return { rows, valid, invalid };
  }, [queue]);

  const readyFiles = queue.filter((q) => q.parsed && q.parsed.validCount > 0);
  const stillParsing = queue.some((q) => q.parsing);
  const disabled = totals.valid === 0 || sendState === 'sending' || stillParsing;

  async function handleUpload() {
    if (readyFiles.length === 0 || sendState === 'sending') return;
    setSendState('sending');

    const results = await Promise.all(readyFiles.map((item) => uploadCsvToGateway(item.file)));
    const notes = results
      .map((r, idx) => (!r.ok ? `${readyFiles[idx]!.file.name}: ${r.reason}` : null))
      .filter((n): n is string => n !== null);
    setGatewayNotes(notes);

    const leads = readyFiles.flatMap((item, fileIdx) =>
      item
        .parsed!.rows.filter((r) => r.valid)
        .map((row, rowIdx) => ({
          leadId: `csv_${Date.now().toString(36)}_${fileIdx}_${rowIdx}`,
          name: row.name,
          email: row.email,
          company: row.company || undefined,
        }))
    );

    getAGUIClient().ingestLeads(leads);

    setSentCount(leads.length);
    setSentFileCount(readyFiles.length);
    setSendState('sent');
    setQueue([]);
  }

  return (
    <>
      <PageHeader
        eyebrow="Ingestion"
        title="Upload leads"
        titleFont="font-upload"
        description="Queue one or more leads CSVs. Nothing is sent to the Lead Profile Agent until you click Upload."
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Panel
            className="animate-rise"
            eyebrow="Source"
            title="Leads CSV"
            description="Expected columns: name, email, company. Aliases like “full name” and “organization” are recognised too."
          >
            <CsvDropzone onFiles={addFiles} queuedCount={queue.length} />
          </Panel>

          {queue.length > 0 && (
            <Panel
              className="animate-rise"
              eyebrow="Queue"
              title={`${queue.length} file${queue.length === 1 ? '' : 's'} queued`}
              description="Parsed locally in your browser. Not yet sent."
            >
              <CsvFileQueue queue={queue} onRemove={removeFile} disabled={sendState === 'sending'} />
            </Panel>
          )}

          {sendState === 'sent' && (
            <Panel tone="success" className="animate-rise">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-status-success" />
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {sentCount} lead{sentCount === 1 ? '' : 's'} from {sentFileCount} file
                      {sentFileCount === 1 ? '' : 's'} sent to the Lead Profile Agent
                    </p>
                    {gatewayNotes.map((note) => (
                      <p key={note} className="mt-1 text-xs text-ink-muted">
                        {note}
                      </p>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => router.push('/lead-journey')}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-sunken px-4 py-2 text-xs font-medium text-ink transition-colors hover:border-line-strong hover:bg-raised"
                >
                  View lead journey
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-5">
          <Panel className="animate-rise" eyebrow="Summary" title="Import status">
            <dl className="space-y-3">
              {[
                ['Files queued', queue.length, 'text-ink'],
                ['Total rows', totals.rows, 'text-ink'],
                ['Valid', totals.valid, 'text-status-success'],
                [
                  'Invalid',
                  totals.invalid,
                  totals.invalid > 0 ? 'text-status-failed' : 'text-ink-faint',
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
              disabled={disabled}
              className={cn(
                'mt-6 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-all duration-200',
                disabled
                  ? 'cursor-not-allowed border border-line-soft bg-sunken text-ink-faint'
                  : 'bg-brand-gradient text-canvas shadow-glow-brand hover:scale-[1.02]'
              )}
            >
              {sendState === 'sending' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                </>
              ) : stillParsing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Parsing files…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Upload {totals.valid || ''} lead{totals.valid === 1 ? '' : 's'}
                </>
              )}
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
              Rows with a missing or malformed email are skipped automatically. The Lead Profile
              Agent is invoked once, when you click Upload.
            </p>
          </Panel>

          <Panel className="animate-rise" eyebrow="Pipeline" title="What happens next">
            <ol className="space-y-3">
              {NEXT_STEPS.map((step, idx) => (
                <li key={step} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line bg-sunken text-[10px] font-semibold tabular-nums text-brand-ink">
                    {idx + 1}
                  </span>
                  <span className="text-xs leading-relaxed text-ink-secondary">{step}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
