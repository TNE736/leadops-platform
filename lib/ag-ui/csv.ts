import Papa from 'papaparse';

/** A single normalized row, ready to hand to the CSV Processor Agent. */
export interface ParsedLeadRow {
  rowNumber: number;
  name: string;
  email: string;
  company: string;
  phone: string;
  valid: boolean;
  errors: string[];
  raw: Record<string, string>;
}

export interface ParseCsvResult {
  rows: ParsedLeadRow[];
  validCount: number;
  invalidCount: number;
  columns: string[];
}

/** Header aliases we accept, since real-world exports rarely agree on column names. */
const HEADER_ALIASES: Record<string, string[]> = {
  name: ['name', 'full name', 'fullname', 'lead name', 'contact name'],
  email: ['email', 'e-mail', 'email address'],
  company: ['company', 'organization', 'organisation', 'account', 'company name'],
  phone: ['phone', 'phone number', 'mobile', 'contact number'],
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function findColumn(headers: string[], field: keyof typeof HEADER_ALIASES): string | null {
  const aliases = HEADER_ALIASES[field] ?? [];
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return headers[idx]!;
  }
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Parses an uploaded CSV file into normalized, validated lead rows. Runs entirely client-side. */
export function parseLeadsCsv(file: File): Promise<ParseCsvResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const columns = results.meta.fields ?? [];
        const nameCol = findColumn(columns, 'name');
        const emailCol = findColumn(columns, 'email');
        const companyCol = findColumn(columns, 'company');
        const phoneCol = findColumn(columns, 'phone');

        const rows: ParsedLeadRow[] = results.data.map((raw, idx) => {
          const name = (nameCol ? raw[nameCol] : '')?.trim() ?? '';
          const email = (emailCol ? raw[emailCol] : '')?.trim() ?? '';
          const company = (companyCol ? raw[companyCol] : '')?.trim() ?? '';
          const phone = (phoneCol ? raw[phoneCol] : '')?.trim() ?? '';

          const errors: string[] = [];
          if (!email) errors.push('Missing email');
          else if (!EMAIL_RE.test(email)) errors.push('Invalid email format');
          if (!name) errors.push('Missing name');

          return {
            rowNumber: idx + 2, // +1 for 1-indexed, +1 for header row
            name,
            email,
            company,
            phone,
            valid: errors.length === 0,
            errors,
            raw,
          };
        });

        resolve({
          rows,
          validCount: rows.filter((r) => r.valid).length,
          invalidCount: rows.filter((r) => !r.valid).length,
          columns,
        });
      },
      error: (err) => reject(err),
    });
  });
}
