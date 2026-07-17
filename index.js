import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as faceapi from '@vladmandic/face-api';

export default function FaceUnlock() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [mode, setMode] = useState('menu'); // menu, enroll, verify
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [enrolledFaces, setEnrolledFaces] = useState([]);
  const [stream, setStream] = useState(null);

  // Initialize models on mount
  useEffect(() => {
    async function initModels() {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        setMessage('Models loaded. Ready.');
      } catch (err) {
        setMessage('Error loading models: ' + err.message);
      }
    }
    initModels();
  }, []);

  // Load enrolled faces from IndexedDB
  useEffect(() => {
    loadEnrolledFaces();
  }, []);

  // IndexedDB helpers
  const openDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FaceUnlockDB', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('faces')) {
          db.createObjectStore('faces', { keyPath: 'id' });
        }
      };
    });
  };

  const saveFace = async (faceData) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('faces', 'readwrite');
      const store = tx.objectStore('faces');
      const id = Date.now();
      store.add({ id, descriptor: faceData, timestamp: new Date() });
      tx.oncomplete = () => resolve(id);
      tx.onerror = () => reject(tx.error);
    });
  };

  const loadEnrolledFaces = async () => {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction('faces', 'readonly');
        const store = tx.objectStore('faces');
        const request = store.getAll();
        request.onsuccess = () => {
          setEnrolledFaces(request.result);
          resolve(request.result);
        };
      });
    } catch (err) {
      console.log('No faces enrolled yet');
    }
  };

  const clearFaces = async () => {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('faces', 'readwrite');
      const store = tx.objectStore('faces');
      store.clear();
      tx.oncomplete = () => {
        setEnrolledFaces([]);
        resolve();
      };
    });
  };

  // Camera access
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      videoRef.current.srcObject = mediaStream;
      setStream(mediaStream);
      return mediaStream;
    } catch (err) {
      setMessage('Camera access denied: ' + err.message);
      return null;
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // Face detection
  const detectFace = async (video) => {
    const detections = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();
    return detections;
  };

  // Enrollment mode
  const handleEnroll = async () => {
    setLoading(true);
    setMessage('Starting camera...');
    const ms = await startCamera();
    if (!ms) return setLoading(false);

    setMessage('Position your face in frame and stay still...');
    setMode('enroll');
    setLoading(false);
  };

  const captureEnrollmentFace = async () => {
    if (!videoRef.current) return;
    setLoading(true);
    setMessage('Detecting face...');

    try {
      const detection = await detectFace(videoRef.current);
      if (!detection) {
        setMessage('No face detected. Try again.');
        setLoading(false);
        return;
      }

      await saveFace(detection.descriptor);
      await loadEnrolledFaces();
      setMessage(`Face enrolled! Total: ${enrolledFaces.length + 1}`);
      setLoading(false);
    } catch (err) {
      setMessage('Enrollment failed: ' + err.message);
      setLoading(false);
    }
  };

  // Verification mode
  const handleVerify = async () => {
    if (enrolledFaces.length === 0) {
      setMessage('No faces enrolled. Enroll first.');
      return;
    }

    setLoading(true);
    setMessage('Starting camera...');
    const ms = await startCamera();
    if (!ms) return setLoading(false);

    setMessage('Position your face in frame...');
    setMode('verify');
    setLoading(false);
  };

  const verifyFace = async () => {
    if (!videoRef.current) return;
    setLoading(true);
    setMessage('Verifying face...');

    try {
      const detection = await detectFace(videoRef.current);
      if (!detection) {
        setMessage('No face detected. Denied.');
        setLoading(false);
        return;
      }

      // Compare against all enrolled faces
      const distances = enrolledFaces.map(face => {
        const distance = faceapi.euclideanDistance(detection.descriptor, face.descriptor);
        return distance;
      });

      const minDistance = Math.min(...distances);
      const threshold = 0.6; // Adjust sensitivity (lower = stricter)

      if (minDistance < threshold) {
        setMessage(`✓ Face verified! (Match: ${(1 - minDistance).toFixed(2)})`);
        // Emit success event for parent apps
        if (window.parent) {
          window.parent.postMessage({ type: 'FACE_UNLOCK_SUCCESS', confidence: 1 - minDistance }, '*');
        }
      } else {
        setMessage(`✗ Access denied. (No match)`);
        // Emit failure event
        if (window.parent) {
          window.parent.postMessage({ type: 'FACE_UNLOCK_FAILED' }, '*');
        }
      }
      setLoading(false);
    } catch (err) {
      setMessage('Verification failed: ' + err.message);
      setLoading(false);
    }
  };

  const handleReset = () => {
    stopCamera();
    setMode('menu');
    setMessage('');
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>🔓 Face Unlock Service</h1>
        <p style={styles.subtitle}>Offline face recognition for Android apps</p>
      </div>

      {mode === 'menu' && (
        <div style={styles.menu}>
          <div style={styles.status}>
            <p>Enrolled faces: <strong>{enrolledFaces.length}</strong></p>
          </div>

          <button style={styles.button} onClick={handleEnroll}>
            📸 Enroll New Face
          </button>
          <button style={styles.button} onClick={handleVerify} disabled={enrolledFaces.length === 0}>
            🔒 Verify Face
          </button>
          {enrolledFaces.length > 0 && (
            <button style={{ ...styles.button, ...styles.dangerButton }} onClick={async () => {
              if (confirm('Delete all enrolled faces?')) {
                await clearFaces();
                setMessage('All faces deleted.');
              }
            }}>
              🗑️ Clear All Faces
            </button>
          )}
        </div>
      )}

      {mode === 'enroll' && (
        <div style={styles.cameraSection}>
          <video ref={videoRef} autoPlay playsInline style={styles.video} />
          <canvas ref={canvasRef} style={styles.canvas} />
          <div style={styles.controls}>
            <button style={styles.button} onClick={captureEnrollmentFace} disabled={loading}>
              {loading ? '...' : '📷 Capture Face'}
            </button>
            <button style={styles.secondaryButton} onClick={handleReset} disabled={loading}>
              ← Back
            </button>
          </div>
        </div>
      )}

      {mode === 'verify' && (
        <div style={styles.cameraSection}>
          <video ref={videoRef} autoPlay playsInline style={styles.video} />
          <canvas ref={canvasRef} style={styles.canvas} />
          <div style={styles.controls}>
            <button style={styles.button} onClick={verifyFace} disabled={loading}>
              {loading ? '...' : '✓ Verify'}
            </button>
            <button style={styles.secondaryButton} onClick={handleReset} disabled={loading}>
              ← Back
            </button>
          </div>
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
  cameraSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    maxWidth: '400px',
    borderRadius: '12px',
    border: '2px solid #0ea5e9',
  },
  canvas: {
    display: 'none',
  },
  controls: {
    display: 'flex',
    gap: '10px',
    width: '100%',
    flexDirection: 'column',
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
  secondaryButton: {
    padding: '12px 20px',
    fontSize: '16px',
    background: '#334155',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  dangerButton: {
    background: '#ef4444',
  },
  message: {
    marginTop: '20px',
    padding: '12px',
    background: '#1e293b',
    borderRadius: '8px',
    textAlign: 'center',
    fontSize: '14px',
    minHeight: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
