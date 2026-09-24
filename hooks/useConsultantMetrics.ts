'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAGUIState } from '@/lib/ag-ui/provider';

/** Totals returned by GET /metrics/consultants (backend/integrations/mongo_metrics.py). */
export interface ConsultantMetrics {
  consultants: number;
  decisionMakers: number;
  emailed: number;
  engaged: number;
  qualified: number;
}

/** bench-outreach moves consultants along without telling this app, so poll. */
const POLL_MS = 15_000;

/** Live consultant totals from MongoDB. Fetched on load, whenever a live event
 *  arrives, every POLL_MS, and on demand via `refresh` (e.g. after an upload). */
export function useConsultantMetrics() {
  const { lastEventAt } = useAGUIState();
  const [metrics, setMetrics] = useState<ConsultantMetrics | null>(null);

  const refresh = useCallback(() => {
    const url = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000'}/metrics/consultants`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setMetrics(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, lastEventAt]);

  useEffect(() => {
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { metrics, refresh };
}
