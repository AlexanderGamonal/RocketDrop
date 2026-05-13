import { useCallback, useRef, useState } from 'react';
import type { Part, UploadPhase, UploadProgress } from '../types';
import { initUpload, getAllPartUrls, completeUpload, abortUpload } from '../api';
import { Semaphore, xhrPutWithRetry } from '../utils/uploader';

const CHUNK_SIZE = 32 * 1024 * 1024;  // 32 MB — mejor paralelismo
const MAX_CONCURRENT = 8;             // 8 streams simultáneos
const MAX_SIZE = 25 * 1024 * 1024 * 1024; // 25 GB

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

  // Validates file and moves to preview phase — no upload yet.
  const selectFile = useCallback((file: File) => {
    if (file.size > MAX_SIZE) { alert('El archivo supera el límite de 25 GB.'); return; }
    if (file.size === 0)      { alert('No se puede subir un archivo vacío.'); return; }
    setState(prev => ({ ...prev, phase: 'preview', file }));
  }, []);

  // Starts the actual multipart upload to R2 for the previewed file.
  const confirmUpload = useCallback(async (file: File) => {
    cancelledRef.current  = false;
    userCancelRef.current = false;
    uploadRef.current     = null;
    activeXHRs.current.clear();

    const totalParts = Math.ceil(file.size / CHUNK_SIZE);
    const partBytes  = new Array<number>(totalParts).fill(0);
    let completedParts = 0;

    let smoothSpeed = 0;
    let lastBytes   = 0;
    let lastTime    = Date.now();

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

      // Prefetch todas las URLs firmadas en una sola llamada al servidor
      const { urls } = await getAllPartUrls(key, uploadId, totalParts);
      if (cancelledRef.current) throw new Error('cancelled');

      const sem = new Semaphore(MAX_CONCURRENT);
      const promises: Promise<Part>[] = Array.from({ length: totalParts }, (_, i) =>
        sem.run(async (): Promise<Part> => {
          if (cancelledRef.current) throw new Error('cancelled');

          const partNumber = i + 1;
          const start      = i * CHUNK_SIZE;
          const end        = Math.min(start + CHUNK_SIZE, file.size);
          const blob       = file.slice(start, end);

          const etag = await xhrPutWithRetry(
            urls[i],
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

  return { ...state, selectFile, confirmUpload, cancel, reset };
}
