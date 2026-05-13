import { useEffect, useRef, useState } from 'react';
import { fmtBytes } from '../utils/format';

interface Props {
  file: File;
  onConfirm: () => void;
  onCancel: () => void;
}

function getFileIcon(type: string): string {
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎬';
  if (type.startsWith('audio/')) return '🎵';
  if (type.includes('pdf'))      return '📄';
  if (type.includes('zip') || type.includes('compressed')) return '🗜️';
  return '📦';
}

export function PreviewPanel({ file, onConfirm, onCancel }: Props) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const objUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      objUrlRef.current = url;
      setThumbUrl(url);
    }
    return () => {
      if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
    };
  }, [file]);

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  return (
    <div className="preview-panel">
      <div className="preview-thumb">
        {isImage && thumbUrl && (
          <img src={thumbUrl} alt={file.name} className="preview-img" />
        )}
        {isVideo && thumbUrl && (
          <video src={thumbUrl} className="preview-img" muted playsInline />
        )}
        {!isImage && !isVideo && (
          <span className="preview-icon">{getFileIcon(file.type)}</span>
        )}
      </div>

      <div className="preview-info">
        <p className="preview-name" title={file.name}>{file.name}</p>
        <p className="preview-meta">
          {fmtBytes(file.size)}
          {file.type && <span className="preview-type">{file.type}</span>}
        </p>
      </div>

      <div className="preview-actions">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={onConfirm}>
          Upload to cloud ↑
        </button>
      </div>
    </div>
  );
}
