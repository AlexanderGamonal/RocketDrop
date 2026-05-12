export type UploadPhase = 'idle' | 'uploading' | 'success' | 'error' | 'cancelled';

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
