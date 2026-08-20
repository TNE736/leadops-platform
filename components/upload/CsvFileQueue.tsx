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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
        <div
          key={item.id}
          className="animate-rise overflow-hidden rounded-xl border border-line bg-sunken"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              {item.parsing ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-faint" />
              ) : item.error ? (
                <AlertCircle className="h-4 w-4 shrink-0 text-status-failed" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-status-success" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{item.file.name}</p>
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  {item.parsing && 'Parsing…'}
                  {item.error && item.error}
                  {item.parsed && (
                    <>
                      {formatBytes(item.file.size)}
                      <span className="mx-1.5 text-ink-faint">·</span>
                      {item.parsed.rows.length} row{item.parsed.rows.length === 1 ? '' : 's'}
                      <span className="mx-1.5 text-ink-faint">·</span>
                      <span className="text-status-success">{item.parsed.validCount} valid</span>
                      {item.parsed.invalidCount > 0 && (
                        <>
                          <span className="mx-1.5 text-ink-faint">·</span>
                          <span className="text-status-failed">
                            {item.parsed.invalidCount} invalid
                          </span>
                        </>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => onRemove(item.id)}
              disabled={disabled}
              aria-label={`Remove ${item.file.name}`}
              className="shrink-0 rounded-lg p-2 text-ink-faint transition-colors hover:bg-raised hover:text-ink disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {item.parsed && item.parsed.rows.length > 0 && (
            <CsvPreviewTable rows={item.parsed.rows} limit={4} />
          )}
        </div>
      ))}
    </div>
  );
}
