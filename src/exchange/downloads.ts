// App-owned URLs only. A handoff already sent to the browser/OS cannot be
// recalled; lock still revokes our handles immediately instead of waiting.
export class ExchangeDownloads {
  private urls = new Map<string, ReturnType<typeof setTimeout>>();
  deliver(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = filename;
    this.urls.set(url, setTimeout(() => { URL.revokeObjectURL(url); this.urls.delete(url); }, 1000));
    try { document.body.append(a); a.click(); }
    finally { a.remove(); }
  }
  clear() { for (const [url, timer] of this.urls) { clearTimeout(timer); URL.revokeObjectURL(url); } this.urls.clear(); }
}
