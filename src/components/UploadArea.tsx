import { useRef } from 'react';
import './UploadArea.css';

interface UploadAreaProps {
  onUpload: (file: File) => void;
}

export default function UploadArea({ onUpload }: UploadAreaProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragOverRef = useRef(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    dragOverRef.current = true;
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragOverRef.current = false;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragOverRef.current = false;
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      onUpload(files[0]);
      e.currentTarget.value = '';
    }
  };

  return (
    <div 
      className="upload-area" 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input 
        ref={fileInputRef}
        type="file" 
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      
      <div className="upload-content">
        <div className="upload-icon">↑</div>
        <h2>Upload Files</h2>
        <p>Drag and drop files here or click to browse</p>
        <button onClick={() => fileInputRef.current?.click()}>
          Choose File
        </button>
      </div>
    </div>
  );
}
