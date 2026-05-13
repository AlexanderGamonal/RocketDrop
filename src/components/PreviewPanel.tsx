import { useEffect, useRef, useState } from 'react';
import { fmtBytes } from '../utils/format';

interface Props {
  file: File;
  onConfirm: () => void;
  onCancel: () => void;
}

function fileIcon(type: string) {
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
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const hasThumb = isImage || isVideo;

  useEffect(() => {
    if (hasThumb) {
      const url = URL.createObjectURL(file);
      objUrlRef.current = url;
      setThumbUrl(url);
    }
    return () => { if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current); };
  }, [file, hasThumb]);

  return (
    <div className="preview-panel">
      {/* File info header */}
      <div className="preview-header">
        <div className="preview-thumb-sm">
          {hasThumb && thumbUrl
            ? isImage
              ? <img src={thumbUrl} alt={file.name} />
              : <video src={thumbUrl} muted playsInline />
            : <span className="preview-icon">{fileIcon(file.type)}</span>
          }
        </div>
        <div className="preview-file-info">
          <p className="preview-name" title={file.name}>{file.name}</p>
          <p className="preview-meta">
            {fmtBytes(file.size)}
            {file.type && <span className="preview-type">{file.type}</span>}
          </p>
        </div>
      </div>

      {/* Large thumbnail for visual media */}
      {hasThumb && thumbUrl && (
        <div className="preview-thumb-large">
          {isImage
            ? <img src={thumbUrl} alt={file.name} />
            : <video src={thumbUrl} controls muted playsInline />
          }
        </div>
      )}

      {/* Actions */}
      <div className="preview-actions">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={onConfirm}>
          Upload to cloud ↑
        </button>
      </div>
    </div>
  );
}
