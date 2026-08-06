import './App.css';
import { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import FileExplorer from './components/FileExplorer';
import Auth from './components/Auth';
import UploadProgress from './components/UploadProgress';
import { useApi } from './hooks/useApi';
import type { FolderData } from './hooks/useApi';

interface FileData {
  id: string;
  name: string;
  size: string;
  mimeType?: string;
  owner: string;
  shared: boolean;
  createdAt?: string;
}

interface DownloadProgressInfo {
  loaded: number;
  total: number;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [files, setFiles] = useState<FileData[]>([]);
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [folderPath, setFolderPath] = useState<FolderData[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storage, setStorage] = useState({ used: 0, limit: 0, percentage: 0 });
  const [uploadProgress, setUploadProgress] = useState<{
    fileName: string;
    progress: number;
    fileIndex: number;
    totalFiles: number;
  } | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, DownloadProgressInfo>>({});
  const api = useApi();

  useEffect(() => {
    // Check if user is already authenticated
    const token = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');
    if (token && storedUsername) {
      setIsAuthenticated(true);
      setUsername(storedUsername);
      loadFiles();
    } else {
      setLoading(false);
    }
  }, []);

  const loadFiles = async (folderId?: string | null) => {
    try {
      setLoading(true);
      setError(null);
      const [fetchedFiles, fetchedFolders, storageInfo] = await Promise.all([
        api.listFiles(folderId),
        api.listFolders(folderId),
        api.getStorage(),
      ]);
      setFiles(fetchedFiles);
      setFolders(fetchedFolders);
      setStorage(storageInfo);
    } catch (err) {
      setError('Failed to load files');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const currentFolder = folderPath[folderPath.length - 1];

  const handleOpenFolder = async (folder: FolderData) => {
    setFolderPath(path => [...path, folder]);
    await loadFiles(folder.id);
  };

  const handleBackFolder = async () => {
    const nextPath = folderPath.slice(0, -1);
    setFolderPath(nextPath);
    await loadFiles(nextPath[nextPath.length - 1]?.id || null);
  };

  const handleCreateFolder = async () => {
    const name = window.prompt('Folder name');
    if (!name?.trim()) return;

    try {
      setError(null);
      const folder = await api.createFolder(name, currentFolder?.id);
      setFolders(current => [...current, folder].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err: any) {
      setError(err.message || 'Failed to create folder');
      console.error(err);
    }
  };

  const handleMoveFile = async (fileId: string, folderId: string | null) => {
    try {
      setError(null);
      await api.moveFile(fileId, folderId);
      await loadFiles(currentFolder?.id || null);
    } catch (err: any) {
      setError(err.message || 'Failed to move file');
      console.error(err);
    }
  };

  const handleLogin = (token: string, loggedInUsername: string) => {
    setIsAuthenticated(true);
    setUsername(loggedInUsername);
    localStorage.setItem('token', token);
    localStorage.setItem('username', loggedInUsername);
    loadFiles();
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
    setFiles([]);
    setFolders([]);
    setFolderPath([]);
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  };

  const handleUpload = async (uploadFiles: File[]) => {
    setError(null);
    const totalFiles = uploadFiles.length;
    const uploadErrors: string[] = [];

    for (let index = 0; index < uploadFiles.length; index++) {
      const file = uploadFiles[index];
      const fileIndex = index + 1;

      try {
        setUploadProgress({ fileName: file.name, progress: 0, fileIndex, totalFiles });
        const newFile = await api.uploadFile(file, (progress) => {
          setUploadProgress({ fileName: file.name, progress, fileIndex, totalFiles });
        });
        if (currentFolder) {
          await api.moveFile(newFile.id, currentFolder.id);
        }
      } catch (err: any) {
        uploadErrors.push(`${file.name}: ${err.message || 'Failed to upload file'}`);
        console.error(err);
      }
    }

    await loadFiles(currentFolder?.id || null);
    if (uploadErrors.length > 0) {
      setError(uploadErrors.join(' | '));
    }
    setUploadProgress(null);
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      await api.deleteFile(id);
      setFiles(files.filter(f => f.id !== id));
      // Refresh storage info after upload
      const storageInfo = await api.getStorage();
      setStorage(storageInfo);
    } catch (err) {
      setError('Failed to delete file');
      console.error(err);
    }
  };

  // Future: implement file sharing functionality
  // const handleShare = async (id: string) => { ... }

  const handleDownload = async (id: string, name: string) => {
    try {
      setError(null);
      setDownloadProgress(prev => ({ ...prev, [id]: { loaded: 0, total: 0 } }));
      await api.downloadFile(id, name, (loaded, total) => {
        setDownloadProgress(prev => ({ ...prev, [id]: { loaded, total } }));
      });
      setDownloadProgress(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      setError('Failed to download file');
      console.error(err);
      setDownloadProgress(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  if (!isAuthenticated) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} onLogout={handleLogout} username={username} />
      <div className="app-main">
        <Sidebar isOpen={sidebarOpen} onUpload={handleUpload} storage={storage} />
        <main className="main-content">
          {uploadProgress && (
            <UploadProgress
              fileName={uploadProgress.fileName}
              progress={uploadProgress.progress}
              fileIndex={uploadProgress.fileIndex}
              totalFiles={uploadProgress.totalFiles}
            />
          )}
          <FileExplorer 
            files={files} 
            folders={folders}
            currentFolder={currentFolder}
            onDelete={handleDelete}
            onDownload={handleDownload}
            onPreview={api.getFilePreviewUrl}
            onOpenFolder={handleOpenFolder}
            onBackFolder={handleBackFolder}
            onCreateFolder={handleCreateFolder}
            onMoveFile={handleMoveFile}
            loading={loading}
            downloadProgress={downloadProgress}
          />
        </main>
      </div>
      {error && (
        <div className="notification-stack" aria-live="polite">
          <div className="notification notification-error" role="alert">
            <span>{error}</span>
            <button
              className="notification-dismiss"
              onClick={() => setError(null)}
              aria-label="Dismiss notification"
              title="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
