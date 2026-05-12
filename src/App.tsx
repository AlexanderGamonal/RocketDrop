import { useUpload } from './hooks/useUpload';
import { DropZone } from './components/DropZone';
import { UploadPanel } from './components/UploadPanel';
import { ResultPanel } from './components/ResultPanel';

export default function App() {
  const { phase, file, progress, resultUrl, error, upload, cancel, reset } = useUpload();

  return (
    <div className="wrapper">
      <div className="card">
        <header className="card-header">
          <span className="logo">🚀</span>
          <div>
            <h1>RocketDrop</h1>
            <p>Upload files up to 25 GB directly to the cloud</p>
          </div>
        </header>

        <main className="card-body">
          {phase === 'idle' && (
            <DropZone onFile={upload} />
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
