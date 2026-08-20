/**
 * Forwards the raw CSV file to the AG-UI Gateway (proxied same-origin via
 * the `/api/ag-ui/*` rewrite in next.config.mjs), which is expected to hand
 * it to the CSV Processor Agent. Failures are reported to the caller so the
 * UI can surface them — nothing is simulated locally.
 */
export async function uploadCsvToGateway(
  file: File
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/ag-ui/leads/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) return { ok: false, reason: `Gateway responded ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'No AG-UI Gateway reachable.' };
  }
}
