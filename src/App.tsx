import './App.css';
import { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import FileExplorer from './components/FileExplorer';
import Auth from './components/Auth';
import { useApi } from './hooks/useApi';

interface FileData {
  id: string;
  name: string;
  size: string;
  owner: string;
  shared: boolean;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [files, setFiles] = useState<FileData[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storage, setStorage] = useState({ used: 0, limit: 0, percentage: 0 });
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

  const loadFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const [fetchedFiles, storageInfo] = await Promise.all([
        api.listFiles(),
        api.getStorage()
      ]);
      setFiles(fetchedFiles);
      setStorage(storageInfo);
    } catch (err) {
      setError('Failed to load files');
      console.error(err);
    } finally {
      setLoading(false);
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
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  };

  const handleUpload = async (file: File) => {
    try {
      setError(null);
      const newFile = await api.uploadFile(file);
      setFiles([newFile, ...files]);
      // Refresh storage info after upload
      const storageInfo = await api.getStorage();
      setStorage(storageInfo);
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setError(null);
      await api.deleteFile(id);
      setFiles(files.filter(f => f.id !== id));
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
      await api.downloadFile(id, name);
    } catch (err) {
      setError('Failed to download file');
      console.error(err);
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
          {error && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#a86b4a',
              color: '#fff',
              marginBottom: '1rem',
              border: '1px solid #d49972'
            }}>
              {error}
            </div>
          )}
          <FileExplorer 
            files={files} 
            onDelete={handleDelete}
            onDownload={handleDownload}
            loading={loading}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
