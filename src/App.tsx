import { Link } from 'react-router-dom';
import { useUpload } from './hooks/useUpload';
import { DropZone } from './components/DropZone';
import { PreviewPanel } from './components/PreviewPanel';
import { UploadPanel } from './components/UploadPanel';
import { ResultPanel } from './components/ResultPanel';

export default function App() {
  const { phase, file, progress, resultUrl, error, selectFile, confirmUpload, cancel, reset } = useUpload();

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="topbar-rocket">🚀</span>
          <span className="topbar-name">RocketDrop</span>
        </div>
        <Link to="/admin" className="topbar-admin">Admin</Link>
      </header>

      <main className="app-main">
        <div className="panel-wrap">
          {phase === 'idle' && <DropZone onFile={selectFile} />}

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
        </div>
      </main>
    </div>
  );
}
