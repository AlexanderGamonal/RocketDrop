export class Semaphore {
  private running = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.running < this.max) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise(resolve => this.queue.push(resolve));
  }

  private release(): void {
    if (this.queue.length > 0) {
      this.queue.shift()!();
    } else {
      this.running--;
    }
  }
}

export function xhrPut(
  url: string,
  blob: Blob,
  onProgress: (loaded: number) => void,
  isCancelled: () => boolean,
  activeXHRs: Set<XMLHttpRequest>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (isCancelled()) return reject(new Error('cancelled'));

    const xhr = new XMLHttpRequest();
    activeXHRs.add(xhr);

    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress(e.loaded);
    };

    xhr.onload = () => {
      activeXHRs.delete(xhr);
      if (isCancelled()) return reject(new Error('cancelled'));
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag') ?? xhr.getResponseHeader('etag') ?? '';
        resolve(etag);
      } else {
        reject(new Error(`Part upload failed: HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      activeXHRs.delete(xhr);
      reject(new Error('Network error'));
    };

    xhr.onabort = () => {
      activeXHRs.delete(xhr);
      reject(new Error('cancelled'));
    };

    xhr.open('PUT', url);
    xhr.send(blob);
  });
}

export async function xhrPutWithRetry(
  url: string,
  blob: Blob,
  onProgress: (loaded: number) => void,
  isCancelled: () => boolean,
  activeXHRs: Set<XMLHttpRequest>,
  maxTries = 3,
): Promise<string> {
  let lastErr: Error = new Error('Unknown upload error');
  for (let attempt = 0; attempt < maxTries; attempt++) {
    if (isCancelled()) throw new Error('cancelled');
    try {
      return await xhrPut(url, blob, onProgress, isCancelled, activeXHRs);
    } catch (err) {
      const e = err as Error;
      if (e.message === 'cancelled' || isCancelled()) throw new Error('cancelled');
      lastErr = e;
      if (attempt < maxTries - 1) {
        await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }
  throw lastErr;
}
