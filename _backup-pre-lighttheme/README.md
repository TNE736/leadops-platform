# LeadOps frontend — AG-UI, HubSpot-centric architecture

Next.js 14 (App Router) frontend for the LeadOps AI Platform. This build reflects
the current architecture: **no Kafka/PubSub backbone** — HubSpot CRM is the
system of record every agent reads and writes via MCP, and the AG-UI Gateway's
Webhook Receiver relays HubSpot's own webhooks (one hop behind Mailgun's) to
this app over SSE/WebSocket.

## Getting started

```bash
npm install
cp .env.example .env.local   # point at your AG-UI Gateway, or leave as-is for the mock stream
npm run dev
```

Open http://localhost:3000. With no `AG_UI_GATEWAY_URL` reachable, the app falls back to an
in-browser mock event generator (`lib/ag-ui/mock.ts`) so every page is fully demoable before
the backend agents exist.

## Project structure

```
app/
  layout.tsx                Root layout — mounts AGUIProvider + TopNav
  upload/page.tsx            Upload leads CSV → Lead Profile Agent
  page.tsx                   Dashboard
  lead-journey/page.tsx       Per-lead progress through the pipeline
  agent-traces/page.tsx       Per-agent AND per-webhook activity log
  event-timeline/page.tsx     Full chronological event log with filters
  voice-transcript/page.tsx   Voice Agent calls & outcomes
  analytics/page.tsx          Stage-by-stage conversion funnel
  integrations/page.tsx       HubSpot sync health — one row per touchpoint
  alerts/page.tsx             Failed / errored events
  settings/page.tsx           Gateway connection config

components/
  layout/         TopNav, PageHeader
  ui/              Panel, StatusBadge, ConnectionIndicator
  dashboard/       EventPipeline (the horizontal stage strip), StatCard
  events/          EventFeed
  upload/          CsvDropzone, CsvPreviewTable

lib/ag-ui/
  types.ts         PipelineStage, EventSource, EventStatus, AGUIEvent, AGUIState
  client.ts        AGUIClient — SSE primary, WebSocket fallback, ingestLeads()
  provider.tsx      React context: AGUIProvider, useAGUIState, usePipelineCounts
  csv.ts           CSV parsing & validation (papaparse)
  upload.ts        Best-effort raw-file POST to the Gateway
  mock.ts          Local event generator used until a real Gateway is connected

hooks/
  useAGUIEvents.ts  Filter the live event log by lead / stage / status
```

## Architecture, in one paragraph

A lead enters through **Upload**, gets scored by the **Lead Profile Agent**, and
is upserted into **HubSpot** via MCP — HubSpot is the shared state from here
on, not a message a pipeline hands forward. The **Email Agent** reads the
profile back from HubSpot, sends via **Mailgun**, and writes send status to
HubSpot. Mailgun's delivery/open events reach HubSpot the same way (MCP write),
and it's **HubSpot's own webhook** — not Mailgun's directly — that the
Gateway's Webhook Receiver subscribes to and relays into this app. When that
property reaches "opened," the Gateway triggers the **Voice Agent**, which
writes its outcome back to HubSpot the same way every other agent does.

## Event schema

| PipelineStage | Typical source | Meaning |
|---|---|---|
| `lead.created` | `lead-profile-agent` | CSV row ingested |
| `lead.eligibility.checked` | `lead-profile-agent` | Scored, eligibility decided |
| `crm.contact.upserted` | `lead-profile-agent` | Written to HubSpot via MCP |
| `email.sent` | `email-agent` | Sent via Mailgun |
| `email.status.synced` | `hubspot-webhook` | HubSpot property changed (delivered/opened/bounced) — arrives via webhook, not directly from an agent |
| `voice.trigger.requested` | `agent-gateway` | Gateway decided to notify the Voice Agent |
| `voice.completed` | `voice-agent` | Call outcome captured |
| `crm.updated` | `voice-agent` | Final HubSpot write for this lead |

`source` also includes `mailgun-webhook`, distinct from `hubspot-webhook` —
"Mailgun told HubSpot something" and "HubSpot told us something changed" are
different failure modes, worth debugging separately (see the Integrations page).

## What's deliberately NOT here

- No Kafka/PubSub client, no message broker config. The event backbone is:
  agent → MCP write → HubSpot → HubSpot webhook → Gateway → SSE/WebSocket → this app.
- No direct Mailgun-to-frontend path. Mailgun's events only ever reach the
  frontend after being written into HubSpot and re-emitted by HubSpot's webhook.

## Next steps

- Point `AG_UI_GATEWAY_URL` / `NEXT_PUBLIC_AG_UI_*` at a real Gateway once it exposes
  `/webhooks/hubspot` and `/webhooks/mailgun` — the mock stream in `lib/ag-ui/mock.ts`
  can then be deleted.
- Build the reconciliation job the Integrations page references: since the
  Mailgun → HubSpot → webhook path is two hops, a dropped webhook fails
  silently rather than erroring — worth polling HubSpot directly for leads
  that have gone stale in a stage.
