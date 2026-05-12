import type { UploadProgress } from '../types';
import { fmtBytes, fmtTime } from '../utils/format';

interface Props {
  file: File;
  progress: UploadProgress;
  error: string | null;
  onCancel: () => void;
  onReset: () => void;
}

export function UploadPanel({ file, progress, error, onCancel, onReset }: Props) {
  const { pct, speed, eta, completedParts, totalParts } = progress;
  const isError = error !== null;

  return (
    <div className="upload-panel">
      <div className="file-row">
        <span className="file-icon">📄</span>
        <div className="file-meta">
          <div className="file-name">{file.name}</div>
          <div className="file-size">{fmtBytes(file.size)}</div>
        </div>
      </div>

      {isError && (
        <div className="alert alert-error">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      <div className="prog-wrapper">
        <div className="prog-header">
          <span>
            {!isError && <span className="dot" />}
            <span>{isError ? 'Upload failed' : 'Uploading…'}</span>
          </span>
          <span className="prog-pct">{Math.round(pct)}%</span>
        </div>
        <div className="prog-track">
          <div className="prog-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <div className="prog-stats">
          <span>{speed > 0 ? `${fmtBytes(speed)}/s` : '— MB/s'}</span>
          <span>{eta !== null ? `${fmtTime(eta)} remaining` : 'Calculating…'}</span>
        </div>
      </div>

      <div className="parts-label">
        Parts: {completedParts} / {totalParts}
      </div>

      <div className="action-row">
        {isError ? (
          <button className="btn btn-outline" onClick={onReset}>
            ↩ Start over
          </button>
        ) : (
          <button className="btn btn-danger" onClick={onCancel}>
            ✕ Cancel
          </button>
        )}
      </div>
    </div>
  );
}
