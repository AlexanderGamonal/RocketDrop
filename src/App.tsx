import { Link } from 'react-router-dom';
import { useUpload } from './hooks/useUpload';
import { DropZone } from './components/DropZone';
import { PreviewPanel } from './components/PreviewPanel';
import { UploadPanel } from './components/UploadPanel';
import { ResultPanel } from './components/ResultPanel';

export default function App() {
  const { phase, file, progress, resultUrl, error, selectFile, confirmUpload, cancel, reset } = useUpload();

  return (
    <div className="wrapper">
      <div className="card">
        <header className="card-header">
          <span className="logo">🚀</span>
          <div className="card-header-text">
            <h1>RocketDrop</h1>
            <p>Upload files up to 25 GB directly to the cloud</p>
          </div>
          <Link to="/admin" className="admin-link">Admin</Link>
        </header>

        <main className="card-body">
          {phase === 'idle' && (
            <DropZone onFile={selectFile} />
          )}

          {phase === 'preview' && file && (
            <PreviewPanel
              file={file}
              onConfirm={() => confirmUpload(file)}
              onCancel={reset}
            />
          )}

          {(phase === 'uploading' || phase === 'error') && (
            <UploadPanel
              file={file!}
              progress={progress}
              error={error}
              onCancel={cancel}
              onReset={reset}
            />
          )}

          {(phase === 'success' || phase === 'cancelled') && (
            <ResultPanel
              phase={phase}
              file={file}
              url={resultUrl}
              onReset={reset}
            />
          )}
        </main>
      </div>
    </div>
  );
}
