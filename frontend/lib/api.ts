'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAGUIState } from '@/lib/ag-ui';

/** Ingest API base URL (Next.js inlines NEXT_PUBLIC_* at build time). Use 127.0.0.1, not localhost. */
export const INGEST_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
/** bench-outreach moves consultants along without telling this app, so the totals are polled. */
const METRICS_POLL_INTERVAL_MS = 15_000;

/** Totals from GET /metrics/consultants (backend/integrations/queries.py). */
export interface ConsultantMetrics {
  consultants: number;
  emailed: number;
  engaged: number;
  qualified: number;
}

/** One consultant and how far they have progressed, from GET /consultants/journey. */
export interface ConsultantJourney {
  leadId: string;
  label: string;
  stage: string;
  closed: boolean;
  reached: Record<string, boolean>;
}

/** One rejected row (`RowError` in backend/integrations/ingest.py). */
export interface RowError {
  file: string;
  row: number | null;
  key?: string;
  issues: string[];
}

/** Response body of POST /leads/ingest (`IngestSummary` in backend/integrations/ingest.py). */
export interface IngestSummary {
  total: number;
  valid: number;
  skippedDuplicate: number;
  invalid: number;
  inserted: boolean;
  insertedCount: number;
  dbError?: string;
  errors: RowError[];
  errorsOmitted: number;
}

export type UploadResult = { summary: IngestSummary } | { error: string };

/**
 * bench-outreach's `qualification_stage` values, in order (STAGE_ORDER in
 * backend/integrations/queries.py). `key` matches the `reached` map of a ConsultantJourney.
 */
export const JOURNEY_STAGES = [
  { key: 'loaded', label: 'Loaded into MongoDB' },
  { key: 'emailed', label: 'Emailed about a role' },
  { key: 'engaged', label: 'Replied (engaged)' },
  { key: 'researched', label: 'Researched' },
  { key: 'followed_up', label: 'Qualifying follow-up sent' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'handed_off', label: 'Handed off to Bench TA' },
];

/** Resolves to null when the API answers with an error status. */
async function fetchConsultantMetrics(): Promise<ConsultantMetrics | null> {
  const response = await fetch(`${INGEST_API_URL}/metrics/consultants`);
  return response.ok ? response.json() : null;
}

/** Any body that is not a list (e.g. an error object) resolves to []. */
async function fetchConsultantJourneys(): Promise<ConsultantJourney[]> {
  const response = await fetch(`${INGEST_API_URL}/consultants/journey`);
  const body: unknown = await response.json();
  return Array.isArray(body) ? body : [];
}

/** Posts the queued files. Every failure is returned as a user-facing message; this never throws. */
export async function uploadCsvFiles(files: File[]): Promise<UploadResult> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  let response: Response;
  try {
    response = await fetch(`${INGEST_API_URL}/leads/ingest`, { method: 'POST', body: formData });
  } catch {
    return { error: 'Could not reach the ingest API.' };
  }

  const fallbackError = `Server responded ${response.status}`;
  const body: unknown = await response.json().catch(() => null);
  if (typeof body !== 'object' || body === null) return { error: fallbackError };
  if ('total' in body) return { summary: body as IngestSummary };
  return { error: (body as { error?: string }).error ?? fallbackError };
}

/**
 * Data from the ingest API, fetched on load, whenever a live event arrives, every
 * `pollIntervalMs` (when given) and on demand via `refresh`. A failed fetch, or one that
 * resolves to null, keeps the last value. `fetcher` must be stable (a module-level function).
 */
function useLiveQuery<T>(fetcher: () => Promise<T | null>, initial: T, pollIntervalMs?: number) {
  const { lastEventAt } = useAGUIState();
  const [data, setData] = useState<T>(initial);

  const refresh = useCallback(() => {
    fetcher()
      .then((latest) => latest !== null && setData(latest))
      .catch(() => {});
  }, [fetcher]);

  useEffect(() => {
    refresh();
  }, [refresh, lastEventAt]);

  useEffect(() => {
    if (!pollIntervalMs) return;
    const intervalId = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(intervalId);
  }, [refresh, pollIntervalMs]);

  return { data, refresh };
}

/** Live Metrics tile totals from MongoDB; `refresh` re-reads them after an upload. */
export function useConsultantMetrics() {
  const { data: metrics, refresh } = useLiveQuery<ConsultantMetrics | null>(
    fetchConsultantMetrics,
    null,
    METRICS_POLL_INTERVAL_MS
  );
  return { metrics, refresh };
}

/** Every consultant's journey (GET /consultants/journey). */
export function useConsultantJourneys(): ConsultantJourney[] {
  return useLiveQuery(fetchConsultantJourneys, [] as ConsultantJourney[]).data;
}
