import './Auth.css';
import { useState } from 'react';
import { IconLock, IconUser } from '@tabler/icons-react';
import { motion } from 'framer-motion';

interface AuthProps {
  onLogin: (token: string, username: string) => void;
}

export default function Auth({ onLogin }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin 
        ? { username, password }
        : { username, password, accessCode };

      const response = await fetch(`http://localhost:8787${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Authentication failed');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('username', data.username);
      onLogin(data.token, data.username);
    } catch (err) {
      setError('Network error. Make sure the backend is running on port 8787.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <motion.div
        className="auth-box"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="auth-header">
          <h1>Cloud Storage <span style={{ fontWeight: 'bold', fontStyle: 'italic', fontSize: '.5em', color: 'gray' }}>beta</span></h1>
          <p>{isLogin ? 'Welcome back' : 'Registration'}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Username</label>
            <div className="input-with-icon">
              <IconUser size={20} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={isLogin ? 'Enter your username' : 'Choose a username'}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-with-icon">
              <IconLock size={20} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>
          </div>

          {!isLogin && (
            <div className="form-group">
              <label>Access Code</label>
              <div className="input-with-icon">
                <IconLock size={20} />
                <input
                  type="password"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="Enter the access code"
                  required
                />
              </div>
              <small className="help-text">Ask <a href="mailto:vlad@stnsc.net">vlad@stnsc.net</a> for the access code</small>
            </div>
          )}

          {error && (
            <motion.div
              className="error-message"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {error}
            </motion.div>
          )}

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? 'Loading...' : isLogin ? 'Login' : 'Register'}
          </motion.button>
        </form>

        <div className="auth-switch">
          <p>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <motion.button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              whileHover={{ opacity: 0.8 }}
              className="switch-btn"
            >
              {isLogin ? 'Register' : 'Login'}
            </motion.button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
