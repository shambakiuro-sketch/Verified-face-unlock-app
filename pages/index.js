import { useEffect, useRef, useState } from 'react';

export default function FaceUnlock() {
  const videoRef = useRef(null);
  const [mode, setMode] = useState('menu');
  const [message, setMessage] = useState('Loading...');
  const [enrolled, setEnrolled] = useState(0);
  const [isClient, setIsClient] = useState(false);

  // Only run on client
  useEffect(() => {
    setIsClient(true);
    setMessage('Face Unlock Service Ready');
  }, []);

  if (!isClient) {
    return null;
  }

  const handleEnroll = () => {
    setMessage('📸 Camera access requested...');
    setMode('enroll');
  };

  const handleVerify = () => {
    setMessage('🔒 Starting verification...');
    setMode('verify');
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>🔓 Face Unlock Service</h1>
        <p style={styles.subtitle}>Offline face recognition</p>
      </div>

      {mode === 'menu' && (
        <div style={styles.menu}>
          <div style={styles.status}>
            <p>Enrolled faces: <strong>{enrolled}</strong></p>
          </div>

          <button style={styles.button} onClick={handleEnroll}>
            📸 Enroll New Face
          </button>
          <button style={styles.button} onClick={handleVerify}>
            🔒 Verify Face
          </button>
        </div>
      )}

      <div style={styles.message}>{message}</div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '100%',
    margin: 0,
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    background: '#0f172a',
    color: '#f1f5f9',
    minHeight: '100vh',
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#94a3b8',
  },
  menu: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  status: {
    background: '#1e293b',
    padding: '15px',
    borderRadius: '8px',
    textAlign: 'center',
    marginBottom: '10px',
  },
  button: {
    padding: '12px 20px',
    fontSize: '16px',
    background: '#0ea5e9',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  message: {
    marginTop: '20px',
    padding: '12px',
    background: '#1e293b',
    borderRadius: '8px',
    textAlign: 'center',
    fontSize: '14px',
  },
};
