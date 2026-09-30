import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { renderRecord } from '@/lib/frontend_logging';

/** Server side of the browser's logging: where the Upload page's records become a file and terminal output. */
const LOG_FILE = process.env.LOG_FILE || path.join('logs', 'frontend.jsonl');
const LOG_CONSOLE = process.env.LOG_CONSOLE || 'rendered';

/** Appends the posted records to LOG_FILE as JSON lines and prints them in the `npm run dev` terminal. */
export async function POST(request: Request): Promise<Response> {
  const records = (await request.json().catch(() => [])) as Record<string, unknown>[];
  if (!Array.isArray(records) || records.length === 0) return new Response(null, { status: 204 });
  await mkdir(path.dirname(LOG_FILE), { recursive: true });
  await appendFile(LOG_FILE, records.map((record) => `${JSON.stringify(record)}\n`).join(''));
  for (const record of records) {
    if (LOG_CONSOLE === 'rendered') renderRecord(record).forEach((row) => console.log(row));
    else if (LOG_CONSOLE === 'json') console.log(JSON.stringify(record));
  }
  return new Response(null, { status: 204 });
}
