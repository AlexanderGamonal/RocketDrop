import type { AdminFile, Part } from './types';

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export const initUpload = (filename: string, contentType: string) =>
  call<{ uploadId: string; key: string }>('POST', '/api/upload/init', { filename, contentType });

export const getPartUrl = (key: string, uploadId: string, partNumber: number) =>
  call<{ url: string }>('POST', '/api/upload/part-url', { key, uploadId, partNumber });

export const getAllPartUrls = (key: string, uploadId: string, totalParts: number) =>
  call<{ urls: string[] }>('POST', '/api/upload/part-urls', { key, uploadId, totalParts });

export const completeUpload = (key: string, uploadId: string, parts: Part[]) =>
  call<{ url: string }>('POST', '/api/upload/complete', { key, uploadId, parts });

export const abortUpload = (key: string, uploadId: string) =>
  call<{ success: boolean }>('DELETE', '/api/upload/abort', { key, uploadId });

export const listFiles = () =>
  call<AdminFile[]>('GET', '/api/admin/files');

export const deleteFile = (key: string) =>
  call<{ success: boolean }>('DELETE', '/api/admin/files', { key });
