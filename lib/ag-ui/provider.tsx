'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getAGUIClient } from './client';
import {
  PIPELINE_STAGE_ORDER,
  type AGUIEvent,
  type AGUIState,
  type ConnectionState,
  type PipelineStage,
} from './types';

const MAX_EVENTS = 200;

function emptyStageCounts(): Record<PipelineStage, number> {
  return {
    'lead.created': 0,
    'lead.eligibility.checked': 0,
    'crm.contact.upserted': 0,
    'email.sent': 0,
    'email.status.synced': 0,
    'voice.trigger.requested': 0,
    'voice.completed': 0,
    'crm.updated': 0,
    'error.occurred': 0,
  };
}

const AGUIContext = createContext<AGUIState | null>(null);

/**
 * Provides live AG-UI state to the whole app — the client-side counterpart
 * of the Gateway's "State Manager". Mount once in the root layout.
 */
export function AGUIProvider({ children }: { children: React.ReactNode }) {
  const clientRef = useRef(getAGUIClient());
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [events, setEvents] = useState<AGUIEvent[]>([]);

  useEffect(() => {
    const client = clientRef.current;
    const unsubEvents = client.onEvent((evt) => {
      setEvents((prev) => [evt, ...prev].slice(0, MAX_EVENTS));
    });
    const unsubState = client.onStateChange(setConnection);
    client.connect();
    return () => {
      unsubEvents();
      unsubState();
      client.disconnect();
    };
  }, []);

  const value = useMemo<AGUIState>(() => {
    const stageCounts = emptyStageCounts();
    const activeLeadIds = new Set<string>();
    for (const evt of events) {
      stageCounts[evt.type] += 1;
      if (evt.leadId && evt.type !== 'crm.updated') activeLeadIds.add(evt.leadId);
    }
    return {
      connection,
      events,
      stageCounts,
      activeLeads: activeLeadIds.size,
      lastEventAt: events[0]?.timestamp,
    };
  }, [connection, events]);

  return <AGUIContext.Provider value={value}>{children}</AGUIContext.Provider>;
}

/** Read the full live AG-UI state (connection, events, derived counts). */
export function useAGUIState(): AGUIState {
  const ctx = useContext(AGUIContext);
  if (!ctx) throw new Error('useAGUIState must be used within an <AGUIProvider>');
  return ctx;
}

/** Convenience hook for just the pipeline stage order + counts, for the event pipeline widget. */
export function usePipelineCounts() {
  const { stageCounts } = useAGUIState();
  return PIPELINE_STAGE_ORDER.map((stage) => ({ stage, count: stageCounts[stage] }));
}
