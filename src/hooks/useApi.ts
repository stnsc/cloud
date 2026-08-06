import { useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface FileData {
  id: string;
  name: string;
  size: string;
  mimeType?: string;
  owner: string;
  shared: boolean;
  createdAt?: string;
}

export interface FolderData {
  id: string;
  name: string;
  parentFolderId?: string | null;
  createdAt?: string;
}

export function useApi() {
  const listFiles = useCallback(async (folderId?: string | null): Promise<FileData[]> => {
    const query = folderId ? `?folderId=${encodeURIComponent(folderId)}` : '';
    const response = await fetch(`${API_URL}/api/files${query}`, {
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
      mimeType: f.mimeType,
      owner: 'You',
      shared: false,
      createdAt: f.createdAt,
    }));
  }, []);

  const listFolders = useCallback(async (parentFolderId?: string | null): Promise<FolderData[]> => {
    const query = parentFolderId ? `?parentId=${encodeURIComponent(parentFolderId)}` : '';
    const response = await fetch(`${API_URL}/api/folders${query}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to list folders');
    }

    return response.json();
  }, []);

  const createFolder = useCallback(async (name: string, parentFolderId?: string | null): Promise<FolderData> => {
    const response = await fetch(`${API_URL}/api/folders`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, parentFolderId: parentFolderId || null }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to create folder');
    }

    return response.json();
  }, []);

  const moveFile = useCallback(async (fileId: string, folderId: string | null): Promise<void> => {
    const response = await fetch(`${API_URL}/api/files/${fileId}/move`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ folderId: folderId || null }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to move file');
    }
  }, []);

  const uploadFile = useCallback(async (file: File, onProgress?: (percent: number) => void): Promise<FileData> => {
    const CHUNK_SIZE = 80 * 1024 * 1024; // 80MB parts — safe now that parts stream straight into R2
    const MAX_FILE_SIZE = 25 * 1024 * 1024 * 1024;
    const MAX_CONCURRENT_PARTS = 5; // parts in flight at once

    console.log('Uploading file:', file.name, file.size, file.type);

    if (file.size > MAX_FILE_SIZE) {
      throw new Error('Files larger than 25GB are not supported.');
    }

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

    // For large files: R2 multipart upload, streamed directly (no FormData),
    // with several parts uploaded concurrently instead of one at a time.
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const token = localStorage.getItem('token') || '';

    // Step 1: Open the multipart upload session
    const urlResponse = await fetch(`${API_URL}/api/files/get-upload-url`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
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

    const { fileId, r2Key, uploadId } = await urlResponse.json();

    // Step 2: Upload parts, several concurrently, each streamed as a raw body
    const parts: { partNumber: number; etag: string }[] = new Array(totalChunks);
    let completedChunks = 0;
    let nextChunkIndex = 0;

    const uploadOnePart = async (chunkIndex: number) => {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const partNumber = chunkIndex + 1;

      const params = new URLSearchParams({
        key: r2Key,
        uploadId,
        partNumber: partNumber.toString(),
      });

      const partResponse = await fetch(`${API_URL}/api/files/upload-chunk?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
        },
        body: chunk, // raw bytes, streamed — no FormData wrapping
      });

      if (!partResponse.ok) {
        throw new Error(`Failed to upload part ${partNumber}/${totalChunks}`);
      }

      const { etag } = await partResponse.json();
      parts[chunkIndex] = { partNumber, etag };

      completedChunks += 1;
      const progress = Math.round((completedChunks / totalChunks) * 90); // 90% for uploads
      onProgress?.(progress);
    };

    // Simple worker-pool: each worker pulls the next chunk index until none remain.
    const worker = async () => {
      while (nextChunkIndex < totalChunks) {
        const chunkIndex = nextChunkIndex;
        nextChunkIndex += 1;
        await uploadOnePart(chunkIndex);
      }
    };

    const workerCount = Math.min(MAX_CONCURRENT_PARTS, totalChunks);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    // Step 3: Complete the multipart upload — parts already live in R2,
    // this just finalizes the object from the collected etags.
    const completeResponse = await fetch(`${API_URL}/api/files/complete-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileId,
        fileName: file.name,
        totalChunks,
        mimeType: file.type,
        fileSize: file.size,
        r2Key,
        uploadId,
        parts,
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

  const downloadFile = useCallback(async (
    fileId: string,
    fileName: string,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<void> => {
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

    const totalStr = response.headers.get('Content-Length');
    const total = totalStr ? parseInt(totalStr, 10) : 0;

    let blob: Blob;

    if (response.body && total > 0 && onProgress) {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.length;
          onProgress(loaded, total);
        }
      }

      blob = new Blob(chunks as BlobPart[]);
    } else {
      blob = await response.blob();
      onProgress?.(blob.size, blob.size);
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, []);

  const getFilePreviewUrl = useCallback(async (fileId: string): Promise<string> => {
    const response = await fetch(`${API_URL}/api/files/${fileId}/download`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to load file preview');
    }

    const blob = await response.blob();
    return window.URL.createObjectURL(blob);
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
    listFolders,
    createFolder,
    moveFile,
    uploadFile,
    deleteFile,
    shareFile,
    downloadFile,
    getFilePreviewUrl,
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