import { useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export interface FileData {
  id: string;
  name: string;
  size: string;
  owner: string;
  shared: boolean;
}

export function useApi() {
  const listFiles = useCallback(async (): Promise<FileData[]> => {
    const response = await fetch(`${API_URL}/api/files`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to list files');
    }

    const files = await response.json();
    return files.map((f: any) => ({
      id: f.id,
      name: f.name,
      size: formatFileSize(f.size),
      owner: 'You',
      shared: false,
    }));
  }, []);

  const uploadFile = useCallback(async (file: File, onProgress?: (percent: number) => void): Promise<FileData> => {
    const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB chunks

    console.log('Uploading file:', file.name, file.size, file.type);

    // For small files, use direct upload
    if (file.size <= CHUNK_SIZE) {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.details || 'Failed to upload file');
      }

      const data = await response.json();
      onProgress?.(100);
      return {
        id: data.id,
        name: data.name,
        size: formatFileSize(data.size),
        owner: data.owner,
        shared: data.shared,
      };
    }

    // For large files, use chunked upload
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    // Step 1: Get upload URL
    const urlResponse = await fetch(`${API_URL}/api/files/get-upload-url`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      }),
    });

    if (!urlResponse.ok) {
      const error = await urlResponse.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to prepare upload');
    }

    const { fileId } = await urlResponse.json();

    // Step 2: Upload chunks
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const chunkFormData = new FormData();
      chunkFormData.append('fileId', fileId);
      chunkFormData.append('chunkIndex', chunkIndex.toString());
      chunkFormData.append('totalChunks', totalChunks.toString());
      chunkFormData.append('fileName', file.name);
      chunkFormData.append('mimeType', file.type);
      chunkFormData.append('chunk', chunk);

      const chunkResponse = await fetch(`${API_URL}/api/files/upload-chunk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: chunkFormData,
      });

      if (!chunkResponse.ok) {
        throw new Error(`Failed to upload chunk ${chunkIndex + 1}/${totalChunks}`);
      }

      // Report progress
      const progress = Math.round(((chunkIndex + 1) / totalChunks) * 90); // 90% for uploads
      onProgress?.(progress);
    }

    // Step 3: Complete upload
    const completeResponse = await fetch(`${API_URL}/api/files/complete-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileId,
        fileName: file.name,
        totalChunks,
        mimeType: file.type,
        fileSize: file.size,
      }),
    });

    if (!completeResponse.ok) {
      const error = await completeResponse.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to complete upload');
    }

    onProgress?.(100);
    const data = await completeResponse.json();
    return {
      id: data.id,
      name: data.name,
      size: formatFileSize(data.size),
      owner: data.owner,
      shared: data.shared,
    };
  }, []);

  const deleteFile = useCallback(async (fileId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to delete file');
    }
  }, []);

  const shareFile = useCallback(async (fileId: string): Promise<string> => {
    const response = await fetch(`${API_URL}/api/files/${fileId}/share`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to share file');
    }

    const data = await response.json();
    return data.shareUrl;
  }, []);

  const downloadFile = useCallback(async (fileId: string, fileName: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/files/${fileId}/download`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to download file');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, []);

  const getStorage = useCallback(async () => {
    const response = await fetch(`${API_URL}/api/storage`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get storage info');
    }

    return await response.json();
  }, []);

  return {
    listFiles,
    uploadFile,
    deleteFile,
    shareFile,
    downloadFile,
    getStorage,
  };
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
