import './FileExplorer.css';
import { useState, useRef, useEffect, useMemo } from 'react';
import {
  IconFolderOpen, IconFile, IconTrash, IconDownload,
  IconFileTypePdf, IconFileTypeHtml, IconFileTypeSql,
  IconFileTypeCsv, IconFileTypeTxt, IconFileTypeSvg,
  IconFileZip, IconFileTypePng, IconFileTypeJpg, IconFileTypeBmp,
  IconFileTypeDoc, IconFileTypeDocx, IconFileTypeXls,
  IconFileTypeXml, IconFileTypeCss, IconFileTypeJs,
  IconFileTypeJsx, IconFileTypeTs, IconFileTypeTsx, IconFileTypeVue,
  IconFileTypePhp, IconFileTypeRs, IconFileTypePpt,
  IconJson, IconGif, IconFileOrientation, IconFileDigit,
  IconLayoutList, IconLayoutGrid, IconFolderPlus, IconArrowLeft, IconArrowUp,
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';

interface File {
  id: string;
  name: string;
  size: string;
  mimeType?: string;
  owner: string;
  shared: boolean;
  createdAt?: string;
}

interface Folder {
  id: string;
  name: string;
  parentFolderId?: string | null;
  createdAt?: string;
}

interface DownloadProgressInfo {
  loaded: number;
  total: number;
}

type SortOption = 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'uploaded-newest' | 'uploaded-oldest';

interface FileExplorerProps {
  files: File[];
  folders: Folder[];
  currentFolder?: Folder;
  onDelete: (id: string) => void;
  onDownload: (id: string, name: string) => void;
  onPreview: (id: string) => Promise<string>;
  onOpenFolder: (folder: Folder) => void;
  onBackFolder: () => void;
  onCreateFolder: () => void;
  onMoveFile: (fileId: string, folderId: string | null) => Promise<void>;
  loading?: boolean;
  downloadProgress?: Record<string, DownloadProgressInfo>;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
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

const SMALL_ICON = 20;
const LARGE_ICON = 64;

function makeIconMap(size: number): Record<string, React.ReactElement> {
  return {
    pdf:     <IconFileTypePdf     size={size} />,
    txt:     <IconFileTypeTxt     size={size} />,
    doc:     <IconFileTypeDoc     size={size} />,
    docx:    <IconFileTypeDocx    size={size} />,
    ppt:     <IconFileTypePpt     size={size} />,
    pptx:    <IconFileTypePpt     size={size} />,
    torrent: <IconFileOrientation size={size} />,
    csv:     <IconFileTypeCsv     size={size} />,
    sql:     <IconFileTypeSql     size={size} />,
    xml:     <IconFileTypeXml     size={size} />,
    xls:     <IconFileTypeXls     size={size} />,
    xlsx:    <IconFileTypeXls     size={size} />,
    html:    <IconFileTypeHtml    size={size} />,
    htm:     <IconFileTypeHtml    size={size} />,
    css:     <IconFileTypeCss     size={size} />,
    js:      <IconFileTypeJs      size={size} />,
    jsx:     <IconFileTypeJsx     size={size} />,
    ts:      <IconFileTypeTs      size={size} />,
    tsx:     <IconFileTypeTsx     size={size} />,
    vue:     <IconFileTypeVue     size={size} />,
    php:     <IconFileTypePhp     size={size} />,
    json:    <IconJson            size={size} />,
    gif:     <IconGif             size={size} />,
    rs:      <IconFileTypeRs      size={size} />,
    exe:     <IconFileDigit       size={size} />,
    png:     <IconFileTypePng     size={size} />,
    jpg:     <IconFileTypeJpg     size={size} />,
    jpeg:    <IconFileTypeJpg     size={size} />,
    bmp:     <IconFileTypeBmp     size={size} />,
    svg:     <IconFileTypeSvg     size={size} />,
    zip:     <IconFileZip         size={size} />,
    rar:     <IconFileZip         size={size} />,
    tar:     <IconFileZip         size={size} />,
    gz:      <IconFileZip         size={size} />,
  };
}

function getFileIcon(name: string, size = SMALL_ICON): React.ReactElement {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return makeIconMap(size)[ext] ?? <IconFile size={size} />;
}

function isImageFile(name: string, mimeType?: string): boolean {
  if (mimeType?.toLowerCase().startsWith('image/')) return true;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return ['avif', 'bmp', 'gif', 'heic', 'heif', 'ico', 'jpeg', 'jpg', 'png', 'svg', 'tif', 'tiff', 'webp'].includes(ext);
}

function parseTimestamp(value?: string): number {
  if (!value) return 0;
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  const normalized = hasTimezone
    ? value
    : `${value.replace(' ', 'T')}Z`;
  return Date.parse(normalized) || 0;
}

function formatUploadTime(iso?: string): string {
  const timestamp = parseTimestamp(iso);
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    + ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function parseFileSize(size: string): number {
  const match = size.match(/^([\d.]+)\s*(B|KB|MB|GB)$/i);
  if (!match) return 0;
  const units: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
  return Number(match[1]) * (units[match[2].toUpperCase()] || 1);
}

function DownloadOverlay({ progress }: { progress: DownloadProgressInfo }) {
  const pct = progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;
  return (
    <>
      <motion.div
        className="download-fill"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.2 }}
      />
      <div className="download-stats">
        {progress.total > 0
          ? `${formatBytes(progress.loaded)} / ${formatBytes(progress.total)} (${pct}%)`
          : 'Starting download…'}
      </div>
    </>
  );
}

function getDraggedFileId(e: React.DragEvent): string | null {
  return e.dataTransfer.getData('application/x-cloud-file') || null;
}

function FolderCard({ folder, onOpenFolder, onMoveFile }: {
  folder: Folder;
  onOpenFolder: (folder: Folder) => void;
  onMoveFile: (fileId: string, folderId: string) => Promise<void>;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <motion.div
      className={`grid-card folder-card${dragOver ? ' drag-over' : ''}`}
      variants={itemVariants}
      onClick={() => onOpenFolder(folder)}
      onDragOver={e => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={async e => {
        e.preventDefault();
        setDragOver(false);
        const fileId = getDraggedFileId(e);
        if (fileId) await onMoveFile(fileId, folder.id);
      }}
    >
      <div className="grid-card-header">
        <span className="grid-card-name" title={folder.name}>{folder.name}</span>
      </div>
      <div className="grid-card-icon">
        <IconFolderOpen size={LARGE_ICON} />
      </div>
      <div className="grid-card-date">Folder</div>
    </motion.div>
  );
}

function ImagePreview({ file, onPreview }: {
  file: File;
  onPreview: (id: string) => Promise<string>;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    onPreview(file.id)
      .then(url => {
        objectUrl = url;
        if (active) setPreviewUrl(url);
        else window.URL.revokeObjectURL(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, onPreview]);

  if (failed) return getFileIcon(file.name, LARGE_ICON);

  if (!previewUrl) {
    return <div className="grid-card-preview-loading" aria-label="Loading image preview" />;
  }

  return <img className="grid-card-preview" src={previewUrl} alt="" onError={() => setFailed(true)} />;
}

function GridCard({ file, currentFolder, onDelete, onDownload, onPreview, onMoveFile, progress }: {
  file: File;
  currentFolder?: Folder;
  onDelete: (id: string) => void;
  onDownload: (id: string, name: string) => void;
  onPreview: (id: string) => Promise<string>;
  onMoveFile: (fileId: string, folderId: string | null) => Promise<void>;
  progress?: DownloadProgressInfo;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  useEffect(() => {
    if (!actionsOpen) return;
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [actionsOpen]);

  return (
    <motion.div
      className="grid-card"
      variants={itemVariants}
      ref={cardRef}
      draggable
      onDragStartCapture={e => {
        const dragEvent = e as unknown as React.DragEvent<HTMLDivElement>;
        dragEvent.dataTransfer.effectAllowed = 'move';
        dragEvent.dataTransfer.setData('application/x-cloud-file', file.id);
      }}
    >
      <div className="grid-card-header">
        <span className="grid-card-name" title={file.name}>{file.name}</span>
        <button
          className="grid-card-menu-btn"
          onClick={() => setActionsOpen(v => !v)}
          title="Actions"
        >
          •••
        </button>
      </div>

      <div className="grid-card-meta">
        <span>{file.size} · .{ext}</span>
        <span>{file.owner}</span>
      </div>

      <div className="grid-card-icon">
        {file.size === 'folder'
          ? <IconFolderOpen size={LARGE_ICON} />
          : isImageFile(file.name, file.mimeType)
            ? <ImagePreview file={file} onPreview={onPreview} />
          : getFileIcon(file.name, LARGE_ICON)}
      </div>

      <div className="grid-card-date">{formatUploadTime(file.createdAt)}</div>

      {progress && <DownloadOverlay progress={progress} />}

      <AnimatePresence>
        {actionsOpen && (
          <motion.div
            className="grid-card-actions"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <button
              className="grid-action-btn"
              onClick={() => { onDownload(file.id, file.name); setActionsOpen(false); }}
            >
              <IconDownload size={18} /> Download
            </button>
            {currentFolder && (
              <button
                className="grid-action-btn"
                onClick={() => {
                  onMoveFile(file.id, currentFolder.parentFolderId || null);
                  setActionsOpen(false);
                }}
              >
                <IconArrowUp size={18} /> Move up
              </button>
            )}
            <button
              className="grid-action-btn grid-action-delete"
              onClick={() => { onDelete(file.id); setActionsOpen(false); }}
            >
              <IconTrash size={18} /> Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FileExplorer({
  files,
  folders,
  currentFolder,
  onDelete,
  onDownload,
  onPreview,
  onOpenFolder,
  onBackFolder,
  onCreateFolder,
  onMoveFile,
  loading = false,
  downloadProgress = {},
}: FileExplorerProps) {
  const [view, setView] = useState<'list' | 'grid'>(() =>
    window.innerWidth < 500 ? 'grid' : 'list'
  );
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      switch (sortBy) {
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'size-asc':
          return parseFileSize(a.size) - parseFileSize(b.size);
        case 'size-desc':
          return parseFileSize(b.size) - parseFileSize(a.size);
        case 'uploaded-newest':
          return parseTimestamp(b.createdAt) - parseTimestamp(a.createdAt);
        case 'uploaded-oldest':
          return parseTimestamp(a.createdAt) - parseTimestamp(b.createdAt);
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [files, sortBy]);

  const sortedFolders = useMemo(
    () => [...folders].sort((a, b) => a.name.localeCompare(b.name)),
    [folders]
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 599px)');
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setView('grid');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div className="file-explorer">
      <motion.div
        className="explorer-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="explorer-title">
          {currentFolder && (
            <button className="folder-back-btn" onClick={onBackFolder} title="Back">
              <IconArrowLeft size={18} />
            </button>
          )}
          <h2>
            { currentFolder?.name || 'Files'}
          </h2>
        </div>
        <div className="explorer-header-right">
          <label className="sort-control">
            <span>Sort by</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)}>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="size-asc">Size (smallest)</option>
              <option value="size-desc">Size (largest)</option>
              <option value="uploaded-newest">Uploaded (newest)</option>
              <option value="uploaded-oldest">Uploaded (oldest)</option>
            </select>
          </label>
          <button className="new-folder-btn" onClick={onCreateFolder} title="New folder">
            <IconFolderPlus size={18} />
            <span>New folder</span>
          </button>
          {/* <div className="explorer-filters">
            <motion.button className="filter-btn" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>All</motion.button>
            <motion.button className="filter-btn" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Recent</motion.button>
          </div> */}
          <div className="view-toggle">
            <button
              className={`view-toggle-btn${view === 'list' ? ' active' : ''}`}
              onClick={() => setView('list')}
              title="List view"
            >
              <IconLayoutList size={18} />
            </button>
            <button
              className={`view-toggle-btn${view === 'grid' ? ' active' : ''}`}
              onClick={() => setView('grid')}
              title="Grid view"
            >
              <IconLayoutGrid size={18} />
            </button>
          </div>
        </div>
      </motion.div>

      {loading ? (
        <motion.div className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          <p>Loading files...</p>
        </motion.div>
      ) : sortedFiles.length === 0 && sortedFolders.length === 0 ? (
        <motion.div className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          <p>{currentFolder ? 'This folder is empty.' : 'No files yet. Upload something to get started.'}</p>
        </motion.div>
      ) : view === 'list' ? (
        <div className="files-list">
          <div className="files-header">
            <div className="col-name">Name</div>
            <div className="col-size">Size</div>
            <div className="col-owner">Owner</div>
            <div className="col-uploaded">Uploaded</div>
            <div className="col-actions">Actions</div>
          </div>
          <motion.div variants={containerVariants} initial="hidden" animate="show">
            {sortedFolders.map(folder => (
              <motion.div
                key={folder.id}
                className="file-item folder-row"
                variants={itemVariants}
                onClick={() => onOpenFolder(folder)}
                onDragOver={e => e.preventDefault()}
                onDrop={async e => {
                  e.preventDefault();
                  const fileId = getDraggedFileId(e);
                  if (fileId) await onMoveFile(fileId, folder.id);
                }}
              >
                <div className="col-name">
                  <span className="file-icon"><IconFolderOpen size={SMALL_ICON} /></span>
                  {folder.name}
                </div>
                <div className="col-size">Folder</div>
                <div className="col-owner">You</div>
                <div className="col-uploaded">{formatUploadTime(folder.createdAt)}</div>
                <div className="col-actions">—</div>
              </motion.div>
            ))}
            {sortedFiles.map(file => (
              <motion.div
                key={file.id}
                className="file-item"
                variants={itemVariants}
                draggable
                onDragStartCapture={e => {
                  const dragEvent = e as unknown as React.DragEvent<HTMLDivElement>;
                  dragEvent.dataTransfer.effectAllowed = 'move';
                  dragEvent.dataTransfer.setData('application/x-cloud-file', file.id);
                }}
              >
                <div className="col-name">
                  <span className="file-icon">
                    {file.size === 'folder' ? <IconFolderOpen size={SMALL_ICON} /> : getFileIcon(file.name)}
                  </span>
                  {file.name}
                </div>
                <div className="col-size">{file.size}</div>
                <div className="col-owner">{file.owner}</div>
                <div className="col-uploaded">{formatUploadTime(file.createdAt)}</div>
                <div className="col-actions">
                  <motion.button className="action-btn" onClick={() => onDownload(file.id, file.name)} title="Download" whileHover={{ scale: 1.5 }} whileTap={{ scale: 0.9 }} transition={{ duration: 0.05 }}>
                    <IconDownload size={18} />
                  </motion.button>
                  {currentFolder && (
                    <motion.button
                      className="action-btn"
                      onClick={() => onMoveFile(file.id, currentFolder.parentFolderId || null)}
                      title="Move up"
                      whileHover={{ scale: 1.5 }}
                      whileTap={{ scale: 0.9 }}
                      transition={{ duration: 0.05 }}
                    >
                      <IconArrowUp size={18} />
                    </motion.button>
                  )}
                  <motion.button className="action-btn delete-btn" onClick={() => onDelete(file.id)} title="Delete" whileHover={{ scale: 1.5 }} whileTap={{ scale: 0.9 }} transition={{ duration: 0.05 }}>
                    <IconTrash size={18} />
                  </motion.button>
                </div>
                {downloadProgress[file.id] && <DownloadOverlay progress={downloadProgress[file.id]} />}
              </motion.div>
            ))}
          </motion.div>
        </div>
      ) : (
        <motion.div className="files-grid" variants={containerVariants} initial="hidden" animate="show">
          {sortedFolders.map(folder => (
            <FolderCard key={folder.id} folder={folder} onOpenFolder={onOpenFolder} onMoveFile={onMoveFile} />
          ))}
          {sortedFiles.map(file => (
            <GridCard key={file.id} file={file} currentFolder={currentFolder} onDelete={onDelete} onDownload={onDownload} onPreview={onPreview} onMoveFile={onMoveFile} progress={downloadProgress[file.id]} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
