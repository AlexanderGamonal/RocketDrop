import { useState } from 'react';
import type { UploadPhase } from '../types';

interface Props {
  phase: Extract<UploadPhase, 'success' | 'cancelled'>;
  file: File | null;
  url: string | null;
  onReset: () => void;
}

export function ResultPanel({ phase, file, url, onReset }: Props) {
  const [copied, setCopied] = useState(false);
  const isSuccess = phase === 'success';

  const copyLink = () => {
    if (!url) return;
    navigator.clipboard.writeText(url).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="result-panel">
      <div className={`result-icon-wrap ${isSuccess ? 'success' : 'cancelled'}`}>
        {isSuccess ? '✅' : '⛔'}
      </div>

      <div className="result-title">
        {isSuccess ? 'Upload complete!' : 'Upload cancelled'}
      </div>
      <div className="result-sub">
        {isSuccess
          ? `${file?.name ?? 'File'} is now available in the cloud`
          : 'The upload was cancelled and cleaned up'}
      </div>

      {isSuccess && url && (
        <div className="url-box">
          <span className="url-label">Public URL</span>
          <div className="url-row">
            <span className="url-text">{url}</span>
            <button className="btn btn-sm btn-ghost" onClick={copyLink}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      <div className="result-actions">
        {isSuccess && url && (
          <a className="btn btn-primary" href={url} target="_blank" rel="noreferrer">
            Open file ↗
          </a>
        )}
        <button className="btn btn-ghost" onClick={onReset}>
          Upload another
        </button>
      </div>
    </div>
  );
}
