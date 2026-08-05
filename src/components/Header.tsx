import './Header.css';
import { IconMenu, IconLogout } from '@tabler/icons-react';
import { motion } from 'framer-motion';

interface HeaderProps {
  onToggleSidebar: () => void;
  onLogout?: () => void;
  username?: string;
}

export default function Header({ onToggleSidebar, onLogout, username }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-content">
        <motion.button 
          className="sidebar-toggle" 
          onClick={onToggleSidebar} 
          title="Toggle sidebar"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <IconMenu size={24} />
        </motion.button>
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          Cloud Storage <span style={{ fontWeight: 'bold', fontStyle: 'italic', fontSize: '.5em', color: 'gray' }}>beta</span>
        </motion.h1>
      </div>
      
      {username && (
        <div className="header-user">
          Logged in as <span className="username" style={{ fontWeight: 'bold' }}>
            {username}
          </span>
          {onLogout && (
            <motion.button
              className="logout-btn"
              onClick={onLogout}
              title="Logout"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <IconLogout size={20} />
            </motion.button>
          )}
        </div>
      )}
    </header>
  );
}
