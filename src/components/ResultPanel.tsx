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

  const isSuccess = phase === 'success';

  return (
    <div className="result-panel">
      <div className="result-icon">{isSuccess ? '✅' : '⛔'}</div>
      <div className="result-title">
        {isSuccess ? 'Upload complete!' : 'Upload cancelled'}
      </div>
      <div className="result-sub">
        {isSuccess
          ? `${file?.name ?? 'File'} is now available.`
          : 'Cleaned up from storage.'}
      </div>

      {isSuccess && url && (
        <div className="link-box">
          <span className="link-text">{url}</span>
          <button className="btn btn-outline btn-sm" onClick={copyLink}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      <div className="result-actions">
        {isSuccess && url && (
          <a className="btn btn-primary" href={url} target="_blank" rel="noreferrer">
            Open file
          </a>
        )}
        <button className="btn btn-outline" onClick={onReset}>
          Upload another
        </button>
      </div>
    </div>
  );
}
