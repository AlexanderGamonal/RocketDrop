import { useCallback, useRef, useState } from 'react';
import type { Part, UploadPhase, UploadProgress } from '../types';
import { initUpload, getPartUrl, completeUpload, abortUpload } from '../api';
import { Semaphore, xhrPutWithRetry } from '../utils/uploader';

const CHUNK_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_CONCURRENT = 4;

interface UploadState {
  phase: UploadPhase;
  file: File | null;
  progress: UploadProgress;
  resultUrl: string | null;
  error: string | null;
}

const INITIAL_PROGRESS: UploadProgress = {
  pct: 0,
  speed: 0,
  eta: null,
  completedParts: 0,
  totalParts: 0,
};

const INITIAL_STATE: UploadState = {
  phase: 'idle',
  file: null,
  progress: INITIAL_PROGRESS,
  resultUrl: null,
  error: null,
};

export function useUpload() {
  const [state, setState] = useState<UploadState>(INITIAL_STATE);

  const cancelledRef  = useRef(false);
  const userCancelRef = useRef(false);
  const activeXHRs   = useRef(new Set<XMLHttpRequest>());
  const uploadRef    = useRef<{ key: string; uploadId: string } | null>(null);

  const cancel = useCallback(() => {
    userCancelRef.current = true;
    cancelledRef.current  = true;
    activeXHRs.current.forEach(xhr => xhr.abort());
    activeXHRs.current.clear();
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current  = false;
    userCancelRef.current = false;
    uploadRef.current     = null;
    activeXHRs.current.clear();
    setState(INITIAL_STATE);
  }, []);

  const upload = useCallback(async (file: File) => {
    cancelledRef.current  = false;
    userCancelRef.current = false;
    uploadRef.current     = null;
    activeXHRs.current.clear();

    const totalParts = Math.ceil(file.size / CHUNK_SIZE);
    const partBytes  = new Array<number>(totalParts).fill(0);
    let completedParts = 0;

    // Exponential moving average for speed
    let smoothSpeed = 0;
    let lastBytes   = 0;
    let lastTime    = Date.now();

    // Throttle DOM updates to one per animation frame
    let rafId: number | null = null;
    const scheduleRender = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const uploaded = partBytes.reduce((s, b) => s + b, 0);
        const pct      = (uploaded / file.size) * 100;
        const now      = Date.now();
        const dt       = (now - lastTime) / 1000;

        if (dt >= 0.25) {
          const inst  = (uploaded - lastBytes) / dt;
          const alpha = Math.min(dt / 4, 0.25);
          smoothSpeed = smoothSpeed === 0 ? inst : (1 - alpha) * smoothSpeed + alpha * inst;
          lastBytes   = uploaded;
          lastTime    = now;
        }

        const remaining = file.size - uploaded;
        const eta       = smoothSpeed > 0 ? remaining / smoothSpeed : null;

        setState(prev => ({
          ...prev,
          progress: { pct, speed: smoothSpeed, eta, completedParts, totalParts },
        }));
      });
    };

    setState({
      phase: 'uploading',
      file,
      progress: { pct: 0, speed: 0, eta: null, completedParts: 0, totalParts },
      resultUrl: null,
      error: null,
    });

    try {
      const { uploadId, key } = await initUpload(
        file.name,
        file.type || 'application/octet-stream',
      );
      uploadRef.current = { key, uploadId };
      if (cancelledRef.current) throw new Error('cancelled');

      const sem = new Semaphore(MAX_CONCURRENT);
      const promises: Promise<Part>[] = Array.from({ length: totalParts }, (_, i) =>
        sem.run(async (): Promise<Part> => {
          if (cancelledRef.current) throw new Error('cancelled');

          const partNumber = i + 1;
          const start      = i * CHUNK_SIZE;
          const end        = Math.min(start + CHUNK_SIZE, file.size);
          const blob       = file.slice(start, end);

          const { url } = await getPartUrl(key, uploadId, partNumber);
          if (cancelledRef.current) throw new Error('cancelled');

          const etag = await xhrPutWithRetry(
            url,
            blob,
            loaded => { partBytes[i] = loaded; scheduleRender(); },
            () => cancelledRef.current,
            activeXHRs.current,
          );

          partBytes[i] = end - start;
          completedParts++;
          scheduleRender();

          return { PartNumber: partNumber, ETag: etag };
        }),
      );

      const parts = await Promise.all(promises);
      if (cancelledRef.current) throw new Error('cancelled');

      setState(prev => ({ ...prev, progress: { ...prev.progress, pct: 100 } }));

      const { url } = await completeUpload(key, uploadId, parts);
      setState(prev => ({ ...prev, phase: 'success', resultUrl: url }));

    } catch (err) {
      if (rafId !== null) cancelAnimationFrame(rafId);

      if (uploadRef.current) {
        abortUpload(uploadRef.current.key, uploadRef.current.uploadId).catch(() => {});
      }

      if (userCancelRef.current) {
        setState(prev => ({ ...prev, phase: 'cancelled' }));
      } else {
        setState(prev => ({
          ...prev,
          phase: 'error',
          error: (err as Error).message,
        }));
      }
    }
  }, []);

  return { ...state, upload, cancel, reset };
}
