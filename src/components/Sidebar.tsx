import { useRef, useState } from 'react';
import './Sidebar.css';
import { IconUpload, IconSettings } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarProps {
  isOpen: boolean;
  onUpload: (file: File) => void;
  username?: string;
  storage?: { used: number; limit: number; percentage: number };
}

export default function Sidebar({ isOpen, onUpload, username, storage }: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setUploading(true);
      await onUpload(files[0]);
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      setUploading(true);
      await onUpload(files[0]);
      setUploading(false);
      e.currentTarget.value = '';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside 
          className="sidebar open"
          initial={{ x: -280, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -280, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          <input 
            ref={fileInputRef}
            type="file" 
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          <motion.div 
            className="upload-section"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <motion.div 
              className="upload-icon"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <IconUpload size={32} />
            </motion.div>
            <h3>Upload</h3>
            <p>Drag or click</p>
            <motion.button 
              onClick={() => fileInputRef.current?.click()}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Choose File'}
            </motion.button>
          </motion.div>

          {storage && (
            <motion.div 
              className="storage-section"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
            >
              <div className="storage-header">
                <span className="storage-label">Storage</span>
                <span className="storage-percentage">{storage.percentage}%</span>
              </div>
              <div className="storage-bar">
                <div 
                  className="storage-used" 
                  style={{ width: `${storage.percentage}%` }}
                />
              </div>
              <div className="storage-text">
                <span>{formatBytes(storage.used)}</span>
                <span className="storage-limit">/ {formatBytes(storage.limit)}</span>
              </div>
            </motion.div>
          )}

          <motion.div className="sidebar-actions">
            <motion.button 
              whileHover={{ scale: 1.02, paddingLeft: 12 }}
              whileTap={{ scale: 0.98 }}
            >
              <IconSettings size={20} />
              Settings
            </motion.button>
          </motion.div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
