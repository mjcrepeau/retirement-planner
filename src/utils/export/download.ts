/** Trigger a browser download of in-memory text content. */
export function downloadText(filename: string, contents: string, mimeType: string): void {
  const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Safari needs the URL to outlive the click.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv(filename: string, contents: string): void {
  downloadText(filename, contents, 'text/csv');
}

export function downloadJson(filename: string, contents: string): void {
  downloadText(filename, contents, 'application/json');
}
