import { motion } from 'framer-motion';
import './UploadProgress.css';

interface UploadProgressProps {
  fileName: string;
  progress: number;
}

export default function UploadProgress({ fileName, progress }: UploadProgressProps) {
  return (
    <motion.div
      className="upload-progress-container"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="upload-progress-content">
        <div className="upload-progress-info">
          <div className="upload-progress-filename">{fileName}</div>
          <div className="upload-progress-percentage">{progress}%</div>
        </div>
        <div className="upload-progress-bar-container">
          <motion.div
            className="upload-progress-bar"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    </motion.div>
  );
}
