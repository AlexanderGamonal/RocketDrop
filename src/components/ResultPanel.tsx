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
        {isSuccess ? '¡Subida completa!' : 'Subida cancelada'}
      </div>
      <div className="result-sub">
        {isSuccess
          ? `${file?.name ?? 'El archivo'} ya está disponible en la nube`
          : 'La subida fue cancelada y los datos eliminados'}
      </div>

      {isSuccess && url && (
        <div className="url-box">
          <span className="url-label">URL pública</span>
          <div className="url-row">
            <span className="url-text">{url}</span>
            <button className="btn btn-sm btn-ghost" onClick={copyLink}>
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      )}

      <div className="result-actions">
        {isSuccess && url && (
          <a className="btn btn-primary" href={url} target="_blank" rel="noreferrer">
            Abrir archivo ↗
          </a>
        )}
        <button className="btn btn-ghost" onClick={onReset}>
          Subir otro archivo
        </button>
      </div>
    </div>
  );
}
