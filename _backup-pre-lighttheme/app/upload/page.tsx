'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Send } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { CsvDropzone } from '@/components/upload/CsvDropzone';
import { CsvFileQueue, type QueuedFile } from '@/components/upload/CsvFileQueue';
import { parseLeadsCsv } from '@/lib/ag-ui/csv';
import { uploadCsvToGateway } from '@/lib/ag-ui/upload';
import { getAGUIClient } from '@/lib/ag-ui/client';
import { cn } from '@/lib/utils';

type SendState = 'idle' | 'sending' | 'sent';

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

  // Adding files only parses them for preview — it never contacts the
  // Gateway or the Lead Profile Agent. That only happens in handleUpload,
  // once the person explicitly clicks the Upload button below.
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
              ? { ...q, error: 'Could not parse this file. Make sure it is a valid CSV.', parsing: false }
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

  async function handleUpload() {
    if (readyFiles.length === 0 || sendState === 'sending') return;
    setSendState('sending');

    // Best-effort: hand each raw file to a real AG-UI Gateway if one is deployed.
    const results = await Promise.all(readyFiles.map((item) => uploadCsvToGateway(item.file)));
    const notes = results
      .map((r, idx) => (!r.ok ? `${readyFiles[idx]!.file.name}: ${r.reason}` : null))
      .filter((n): n is string => n !== null);
    setGatewayNotes(notes);

    // Flatten every valid row across every queued file into one batch, then
    // dispatch it to the Lead Profile Agent in a single call — this is the
    // one and only point in the flow that invokes the agent.
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

    const client = getAGUIClient();
    client.ingestLeads(leads);

    setSentCount(leads.length);
    setSentFileCount(readyFiles.length);
    setSendState('sent');
    setQueue([]);
  }

  return (
    <>
      <PageHeader
        eyebrow="1. Data Ingestion → 2. Lead Agents"
        title="Upload leads"
        description="Queue up one or more leads CSVs. Nothing is sent to the Lead Profile Agent until you click Upload below."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Panel eyebrow="CSV Upload" title="Leads CSVs" accent="purple">
            <CsvDropzone onFiles={addFiles} queuedCount={queue.length} />
          </Panel>

          {queue.length > 0 && (
            <Panel
              eyebrow="Queue"
              title={`${queue.length} file${queue.length === 1 ? '' : 's'} queued · not yet sent`}
            >
              <CsvFileQueue queue={queue} onRemove={removeFile} disabled={sendState === 'sending'} />
            </Panel>
          )}

          {sendState === 'sent' && (
            <Panel accent="green">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    {sentCount} lead{sentCount === 1 ? '' : 's'} from {sentFileCount} file
                    {sentFileCount === 1 ? '' : 's'} sent to the Lead Profile Agent
                  </p>
                  {gatewayNotes.map((note) => (
                    <p key={note} className="mt-1 text-xs text-slate-500">
                      {note}
                    </p>
                  ))}
                </div>
                <button
                  onClick={() => router.push('/lead-journey')}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-purple/40 bg-brand-purple/15 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-brand-purple/25"
                >
                  View Lead Journey <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel eyebrow="Summary" title="Import status">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Files queued</dt>
                <dd className="tabular-nums text-slate-200">{queue.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Total rows</dt>
                <dd className="tabular-nums text-slate-200">{totals.rows}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Valid</dt>
                <dd className="tabular-nums text-status-success">{totals.valid}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Invalid</dt>
                <dd className="tabular-nums text-status-failed">{totals.invalid}</dd>
              </div>
            </dl>

            <button
              onClick={handleUpload}
              disabled={totals.valid === 0 || sendState === 'sending' || stillParsing}
              className={cn(
                'mt-5 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                totals.valid === 0 || stillParsing
                  ? 'cursor-not-allowed bg-panel-raised text-slate-600'
                  : 'bg-brand-gradient text-white hover:opacity-90'
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
            <p className="mt-2 text-[11px] text-slate-500">
              Invalid rows (missing or malformed email) are skipped automatically. The Lead
              Profile Agent is only invoked once, when you click Upload.
            </p>
          </Panel>

          <Panel eyebrow="Pipeline" title="What happens next" accent="blue">
            <ol className="space-y-2 text-xs text-slate-400">
              <li>1. Lead Profile Agent scores &amp; checks eligibility.</li>
              <li>2. Eligible leads are upserted into HubSpot via MCP.</li>
              <li>3. Email Agent reads the profile from HubSpot and sends via Mailgun.</li>
              <li>4. Mailgun → HubSpot → webhook updates status live in this app.</li>
              <li>5. On &ldquo;opened,&rdquo; the Gateway triggers the Voice Agent.</li>
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
