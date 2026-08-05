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

  const uploadFile = useCallback(async (file: File): Promise<FileData> => {
    const formData = new FormData();
    formData.append('file', file);

    console.log('Uploading file:', file.name, file.size, file.type);

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
