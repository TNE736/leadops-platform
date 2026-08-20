'use client';

import { Loader2, X, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { CsvPreviewTable } from '@/components/upload/CsvPreviewTable';
import type { ParseCsvResult } from '@/lib/ag-ui/csv';

export interface QueuedFile {
  id: string;
  file: File;
  parsed: ParseCsvResult | null;
  error: string | null;
  parsing: boolean;
}

export function CsvFileQueue({
  queue,
  onRemove,
  disabled,
}: {
  queue: QueuedFile[];
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  if (queue.length === 0) return null;

  return (
    <div className="space-y-3">
      {queue.map((item) => (
        <div key={item.id} className="rounded-lg border border-border-soft bg-panel-raised/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {item.parsing ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-500" />
              ) : item.error ? (
                <AlertCircle className="h-4 w-4 shrink-0 text-status-failed" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-status-success" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-200">{item.file.name}</p>
                <p className="text-xs text-slate-500">
                  {item.parsing && 'Parsing…'}
                  {item.error && item.error}
                  {item.parsed &&
                    `${item.parsed.rows.length} row${item.parsed.rows.length === 1 ? '' : 's'} · ${item.parsed.validCount} valid · ${item.parsed.invalidCount} invalid`}
                </p>
              </div>
            </div>
            <button
              onClick={() => onRemove(item.id)}
              disabled={disabled}
              aria-label={`Remove ${item.file.name}`}
              className="shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-panel-raised hover:text-slate-200 disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {item.parsed && item.parsed.rows.length > 0 && (
            <div className="mt-3">
              <CsvPreviewTable rows={item.parsed.rows} limit={4} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
