import { useMemo } from 'react';
import { useAGUIState } from '@/lib/ag-ui/provider';
import type { AGUIEvent, EventStatus, PipelineStage } from '@/lib/ag-ui/types';

interface UseAGUIEventsOptions {
  leadId?: string;
  stage?: PipelineStage;
  status?: EventStatus;
  limit?: number;
}

/** Filters the live AG-UI event log for a specific page (Lead Journey, Alerts, etc.). */
export function useAGUIEvents(options: UseAGUIEventsOptions = {}): AGUIEvent[] {
  const { events } = useAGUIState();
  const { leadId, stage, status, limit } = options;

  return useMemo(() => {
    let result = events;
    if (leadId) result = result.filter((e) => e.leadId === leadId);
    if (stage) result = result.filter((e) => e.type === stage);
    if (status) result = result.filter((e) => e.status === status);
    return typeof limit === 'number' ? result.slice(0, limit) : result;
  }, [events, leadId, stage, status, limit]);
}
