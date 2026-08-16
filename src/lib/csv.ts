function escapeCell(value: string | number) {
  let s = String(value);
  // CSV/formula injection guard (OWASP): a text cell that starts with
  // =, +, -, @, tab, or CR gets interpreted as a formula by Excel/Sheets
  // when the file is opened, not displayed as plain text. Only applies to
  // actual strings — numeric amounts (which legitimately start with "-"
  // for withdrawals) are never attacker-controlled free text, so they're
  // left untouched rather than corrupting the export with stray quotes.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Client-side only — builds a CSV from data already in memory (already
// visible to whoever clicked Export) and triggers a browser download.
// No network request, no server involvement.
export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows].map((r) => r.map(escapeCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
