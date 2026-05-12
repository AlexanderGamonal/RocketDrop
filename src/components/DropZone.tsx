import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';

const MAX_SIZE = 25 * 1024 * 1024 * 1024;

interface Props {
  onFile: (file: File) => void;
}

export function DropZone({ onFile }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_SIZE) { alert('File exceeds the 25 GB limit.'); return; }
    if (file.size === 0) { alert('Cannot upload an empty file.'); return; }
    onFile(file);
  };

  const onDragOver  = (e: DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop      = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handle(e.dataTransfer.files[0]);
  };
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    handle(e.target.files?.[0]);
    e.target.value = '';
  };

  return (
    <div
      className={`drop-zone${dragging ? ' dragover' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        onChange={onChange}
        tabIndex={-1}
      />
      <span className="dz-icon">📁</span>
      <h2>Drag &amp; drop your file here</h2>
      <p>or click to browse &nbsp;·&nbsp; max 25 GB</p>
    </div>
  );
}
