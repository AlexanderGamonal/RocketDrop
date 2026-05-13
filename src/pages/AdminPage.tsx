import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminFile } from '../types';
import { listFiles, deleteFile } from '../api';
import { fmtBytes } from '../utils/format';

function FileRow({ file, onDeleted }: { file: AdminFile; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [copied, setCopied]         = useState(false);
  const isImage = /\.(jpe?g|png|gif|webp|svg|avif)$/i.test(file.name);

  const copyUrl = async () => {
    await navigator.clipboard.writeText(file.url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteFile(file.key);
      onDeleted();
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <div className="admin-row">
      <div className="admin-thumb">
        {isImage
          ? <img src={file.url} alt={file.name} className="admin-thumb-img" />
          : <span className="admin-thumb-icon">📦</span>
        }
      </div>

      <div className="admin-file-info">
        <p className="admin-file-name" title={file.name}>{file.name}</p>
        <p className="admin-file-meta">
          {fmtBytes(file.size)}
          <span className="admin-dot">·</span>
          {new Date(file.lastModified).toLocaleDateString()}
        </p>
        <a href={file.url} target="_blank" rel="noopener noreferrer" className="admin-file-url">
          {file.url}
        </a>
      </div>

      <div className="admin-actions">
        <button className="btn btn-sm btn-ghost" onClick={copyUrl}>
          {copied ? '✓ Copied' : 'Copy URL'}
        </button>
        {confirming ? (
          <div className="confirm-row">
            <span className="confirm-label">Sure?</span>
            <button className="btn btn-sm btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? '…' : 'Yes'}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setConfirming(false)} disabled={deleting}>
              No
            </button>
          </div>
        ) : (
          <button className="btn btn-sm btn-danger" onClick={() => setConfirming(true)}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

export function AdminPage() {
  const [files, setFiles]     = useState<AdminFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listFiles();
      setFiles(data.sort((a, b) =>
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      ));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="admin-wrapper">
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <Link to="/" className="back-link">← Back</Link>
          <h1 className="admin-title">Admin Panel</h1>
        </div>
        <div className="admin-stats">
          {!loading && !error && (
            <span>{files.length} file{files.length !== 1 ? 's' : ''} · {fmtBytes(totalSize)}</span>
          )}
          <button className="btn btn-sm btn-ghost" onClick={load} disabled={loading}>
            {loading ? '…' : '↻ Refresh'}
          </button>
        </div>
      </header>

      <div className="admin-body">
        {loading && (
          <div className="skeleton-rows">
            {[1, 2, 3].map(i => <div key={i} className="skeleton-row" />)}
          </div>
        )}

        {!loading && error && (
          <div className="admin-error">
            <span>⚠ {error}</span>
            <button className="btn btn-sm btn-ghost" onClick={load}>Retry</button>
          </div>
        )}

        {!loading && !error && files.length === 0 && (
          <div className="admin-empty">
            <span className="admin-empty-icon">📭</span>
            <p>No files uploaded yet.</p>
            <Link to="/" className="btn btn-primary">Upload your first file</Link>
          </div>
        )}

        {!loading && !error && files.length > 0 && (
          <div className="admin-list">
            {files.map(f => (
              <FileRow
                key={f.key}
                file={f}
                onDeleted={() => setFiles(prev => prev.filter(x => x.key !== f.key))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
