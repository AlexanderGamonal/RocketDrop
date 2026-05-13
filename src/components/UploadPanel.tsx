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
      <div className="upload-file-row">
        <div className="upload-file-icon">📄</div>
        <div className="upload-file-meta">
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

      <div className="upload-pct-row">
        <div className="upload-status">
          {!isError && <span className="dot" />}
          <span>{isError ? 'Error al subir' : 'Subiendo…'}</span>
        </div>
        <span className="upload-pct">{Math.round(pct)}%</span>
      </div>

      <div className="prog-track">
        <div className="prog-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>

      <div className="upload-stats">
        <span className="stat-pill">
          <strong>{speed > 0 ? `${fmtBytes(speed)}/s` : '—'}</strong>
        </span>
        <span className="stat-pill">
          {eta !== null ? <><strong>{fmtTime(eta)}</strong> restantes</> : 'Calculando…'}
        </span>
        <span className="stat-pill">
          Partes <strong>{completedParts}/{totalParts}</strong>
        </span>
      </div>

      <div className="upload-actions">
        {isError ? (
          <button className="btn btn-outline" onClick={onReset}>↩ Volver a intentar</button>
        ) : (
          <button className="btn btn-danger" onClick={onCancel}>✕ Cancelar</button>
        )}
      </div>
    </div>
  );
}
