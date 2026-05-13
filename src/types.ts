export type UploadPhase = 'idle' | 'preview' | 'uploading' | 'success' | 'error' | 'cancelled';

export interface AdminFile {
  key: string;
  name: string;
  size: number;
  lastModified: string;
  url: string;
}

export interface UploadProgress {
  pct: number;
  speed: number;
  eta: number | null;
  completedParts: number;
  totalParts: number;
}

export interface Part {
  PartNumber: number;
  ETag: string;
}
