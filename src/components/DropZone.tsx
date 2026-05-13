import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';

interface Props {
  onFile: (file: File) => void;
}

export function DropZone({ onFile }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = (file: File | undefined) => {
    if (file) onFile(file);
  };

  const onDragOver  = (e: DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = (e: DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); };
  const onDrop      = (e: DragEvent) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]); };
  const onChange    = (e: ChangeEvent<HTMLInputElement>) => { handle(e.target.files?.[0]); e.target.value = ''; };

  return (
    <div
      className={`drop-zone${dragging ? ' dragover' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" className="sr-only" onChange={onChange} tabIndex={-1} />
      <div className="dz-icon-wrap">
        <span className="dz-icon">📁</span>
      </div>
      <h2>Arrastra tu archivo aquí</h2>
      <p>o haz clic para buscar en tu equipo</p>
      <span className="dz-hint">Máx. 25 GB · Cualquier formato</span>
    </div>
  );
}
