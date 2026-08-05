import './FileExplorer.css';
import { IconFolderOpen, IconFile, IconTrash, IconDownload } from '@tabler/icons-react';
import { motion } from 'framer-motion';

interface File {
  id: string;
  name: string;
  size: string;
  owner: string;
  shared: boolean;
}

interface FileExplorerProps {
  files: File[];
  onDelete: (id: string) => void;
  onDownload: (id: string, name: string) => void;
  loading?: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' as const },
  },
};

export default function FileExplorer({ files, onDelete, onDownload, loading = false }: FileExplorerProps) {
  return (
    <div className="file-explorer">
      <motion.div 
        className="explorer-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2>Files</h2>
        <div className="explorer-filters">
          <motion.button 
            className="filter-btn"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            All
          </motion.button>
          <motion.button 
            className="filter-btn"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Recent
          </motion.button>
        </div>
      </motion.div>

      {loading ? (
        <motion.div 
          className="empty-state"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <p>Loading files...</p>
        </motion.div>
      ) : files.length === 0 ? (
        <motion.div 
          className="empty-state"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <p>No files yet. Upload something to get started.</p>
        </motion.div>
      ) : (
        <div className="files-list">
          <div className="files-header">
            <div className="col-name">Name</div>
            <div className="col-size">Size</div>
            <div className="col-owner">Owner</div>
            <div className="col-actions">Actions</div>
          </div>
          
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {files.map(file => (
              <motion.div 
                key={file.id} 
                className="file-item"
                variants={itemVariants}
              >
                <div className="col-name">
                  <span className="file-icon">
                    {file.size === 'folder' ? <IconFolderOpen size={20} /> : <IconFile size={20} />}
                  </span>
                  {file.name}
                </div>
                <div className="col-size">{file.size}</div>
                <div className="col-owner">{file.owner}</div>
                <div className="col-actions">
                  <motion.button 
                    className="action-btn"
                    onClick={() => onDownload(file.id, file.name)}
                    title="Download"
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <IconDownload size={18} />
                  </motion.button>
                  <motion.button 
                    className="action-btn delete-btn"
                    onClick={() => onDelete(file.id)}
                    title="Delete"
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <IconTrash size={18} />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}
    </div>
  );
}
