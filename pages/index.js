'use client';

import { useEffect, useRef, useState } from 'react';

const DETECTION_THRESHOLD = 0.6;

export default function FaceUnlock() {
  const videoRef = useRef(null);
  const [mode, setMode] = useState('menu');
  const [message, setMessage] = useState('Loading face detection...');
  const [enrolled, setEnrolled] = useState(0);
  const [stream, setStream] = useState(null);
  const [faceapi, setFaceapi] = useState(null);
  const [enrolledFaces, setEnrolledFaces] = useState([]);

  // Load face-api models
  useEffect(() => {
    loadModels();
    loadEnrolledFaces();
  }, []);

  const loadModels = async () => {
    try {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.min.js';
      script.onload = async () => {
        await window.faceapi.nets.tinyFaceDetector.loadFromUri(
          'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/'
        );
        await window.faceapi.nets.faceLandmark68Net.loadFromUri(
          'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/'
        );
        await window.faceapi.nets.faceRecognitionNet.loadFromUri(
          'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/'
        );
        setFaceapi(window.faceapi);
        setMessage('✅ Ready - Click Enroll or Verify');
      };
      script.onerror = () => setMessage('❌ Failed to load face detection');
      document.body.appendChild(script);
    } catch (err) {
      setMessage('❌ Error loading models');
    }
  };

  const openDB = () => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('FaceUnlockDB', 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('faces')) {
          db.createObjectStore('faces', { keyPath: 'id' });
        }
      };
    });
  };

  const loadEnrolledFaces = async () => {
    try {
      const db = await openDB();
      const tx = db.transaction('faces', 'readonly');
      const store = tx.objectStore('faces');
      const req = store.getAll();
      req.onsuccess = () => {
        setEnrolledFaces(req.result);
        setEnrolled(req.result.length);
      };
    } catch (err) {
      console.log('No faces enrolled');
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
      return true;
    } catch (err) {
      setMessage('❌ Camera permission denied');
      return false;
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  };

  // Detect face in video
  const detectFace = async (video) => {
    if (!faceapi || !video) return null;
    
    try {
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
      
      return detection;
    } catch (err) {
      console.error('Detection error:', err);
      return null;
    }
  };

  const handleEnroll = async () => {
    if (!faceapi) {
      setMessage('⚠️ Models still loading...');
      return;
    }
    setMessage('📷 Opening camera...');
    const ok = await startCamera();
    if (ok) {
      setMessage('Position your face in frame and click Capture';
      setMode('enroll');
    }
  };

  const captureEnroll = async () => {
    if (!videoRef.current) return;
    
    setMessage('🔍 Detecting face...';
    const detection = await detectFace(videoRef.current);

    if (!detection) {
      setMessage('❌ No face detected! Position your face clearly.');
      return;
    }

    // Save face to IndexedDB
    const db = await openDB();
    const tx = db.transaction('faces', 'readwrite');
    const store = tx.objectStore('faces');
    
    store.add({
      id: Date.now(),
      descriptor: Array.from(detection.descriptor),
      timestamp: new Date()
    });

    tx.oncomplete = async () => {
      setMessage('✅ Face enrolled successfully!');
      await loadEnrolledFaces();
      stopCamera();
      setTimeout(() => setMode('menu'), 2000);
    };
  };

  const handleVerify = async () => {
    if (enrolled === 0) {
      setMessage('⚠️ No faces enrolled. Enroll first.');
      return;
    }
    if (!faceapi) {
      setMessage('⚠️ Models still loading...');
      return;
    }
    setMessage('🔒 Opening camera...');
    const ok = await startCamera();
    if (ok) {
      setMessage('Position your face and click Verify');
      setMode('verify');
    }
  };

  const doVerify = async () => {
    if (!videoRef.current) return;

    setMessage('🔍 Detecting face...';
    const detection = await detectFace(videoRef.current);

    if (!detection) {
      setMessage('❌ No face detected!');
      return;
    }

    // Compare with enrolled faces
    let bestMatch = { distance: Infinity };

    for (let enrolled of enrolledFaces) {
      const enrolledDescriptor = new Float32Array(enrolled.descriptor);
      const distance = window.faceapi.euclideanDistance(
        detection.descriptor,
        enrolledDescriptor
      );

      if (distance < bestMatch.distance) {
        bestMatch = { distance, enrolled };
      }
    }

    const confidence = 1 - bestMatch.distance;

    if (bestMatch.distance < DETECTION_THRESHOLD) {
      setMessage(`✅ Face verified! Match: ${(confidence * 100).toFixed(0)}%`);
      
      // Send success to parent app
      if (window.parent) {
        window.parent.postMessage({
          type: 'FACE_UNLOCK_SUCCESS',
          confidence: confidence
        }, '*');
      }

      stopCamera();
      setTimeout(() => setMode('menu'), 2000);
    } else {
      setMessage(`❌ No match found. Confidence: ${(confidence * 100).toFixed(0)}%`);
    }
  };

  const handleReset = () => {
    stopCamera();
    setMode('menu');
  };

  const clearAll = async () => {
    if (confirm('Delete all enrolled faces?')) {
      const db = await openDB();
      const tx = db.transaction('faces', 'readwrite');
      tx.objectStore('faces').clear();
      setEnrolled(0);
      setEnrolledFaces([]);
      setMessage('✅ All faces cleared');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>🔓 Face Unlock</h1>
        <p style={styles.subtitle}>Real face detection</p>
      </div>

      {mode === 'menu' && (
        <div style={styles.menu}>
          <div style={styles.status}>
            <p>Enrolled: <strong>{enrolled}</strong></p>
          </div>

          <button style={styles.button} onClick={handleEnroll} disabled={!faceapi}>
            📸 Enroll Face
          </button>

          <button 
            style={{...styles.button, opacity: enrolled ? 1 : 0.5}}
            onClick={handleVerify} 
            disabled={enrolled === 0 || !faceapi}
          >
            🔒 Verify Face
          </button>

          {enrolled > 0 && (
            <button style={{...styles.button, background: '#ef4444'}} onClick={clearAll}>
              🗑️ Clear All
            </button>
          )}
        </div>
      )}

      {mode === 'enroll' && (
        <div style={styles.cameraSection}>
          <video ref={videoRef} autoPlay playsInline style={styles.video} />
          <button style={styles.button} onClick={captureEnroll}>
            📷 Capture
          </button>
          <button style={styles.secondaryButton} onClick={handleReset}>
            ← Back
          </button>
        </div>
      )}

      {mode === 'verify' && (
        <div style={styles.cameraSection}>
          <video ref={videoRef} autoPlay playsInline style={styles.video} />
          <button style={styles.button} onClick={doVerify}>
            ✓ Verify
          </button>
          <button style={styles.secondaryButton} onClick={handleReset}>
            ← Back
          </button>
        </div>
      )}

      <div style={styles.message}>{message}</div>
    </div>
  );
}

const styles = {
  container: {
    padding: '20px',
    background: '#0f172a',
    color: '#fff',
    minHeight: '100vh',
    fontFamily: 'system-ui, sans-serif',
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
    gap: '12px',
  },
  status: {
    background: '#1e293b',
    padding: '15px',
    borderRadius: '8px',
    textAlign: 'center',
  },
  cameraSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    maxWidth: '400px',
    borderRadius: '12px',
    border: '2px solid #0ea5e9',
    marginBottom: '10px',
  },
  button: {
    padding: '12px',
    fontSize: '16px',
    background: '#0ea5e9',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '12px',
    fontSize: '16px',
    background: '#334155',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  message: {
    marginTop: '20px',
    padding: '12px',
    background: '#1e293b',
    borderRadius: '6px',
    textAlign: 'center',
    fontSize: '14px',
  },
};
