# Face Unlock Service

Offline, ML-powered face recognition authentication service. Deploy to Vercel, integrate into any Android WebView.

## Features

✅ **Offline-First** – Face data stored locally in IndexedDB  
✅ **No Backend Needed** – All ML inference runs on device  
✅ **Mobile-Optimized** – Touch-friendly, camera-native  
✅ **Vercel Ready** – Push to GitHub, auto-deploy  
✅ **PostMessage API** – Easy integration with parent apps  

## Quick Start

### 1. Deploy to Vercel

```bash
# Push this repo to GitHub
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/face-unlock-service.git
git push -u origin main
```

Then:
- Go to [vercel.com](https://vercel.com)
- Import your GitHub repo
- Vercel auto-detects Next.js → builds & deploys
- Your service is live at `YOUR-PROJECT.vercel.app`

### 2. First Time Setup (Download ML Models)

The app loads face-api models on startup. For production, you need them in `/public/models/`.

**Option A: Online (Recommended)**
Models auto-load from CDN on first use. Works offline after caching.

**Option B: Self-Host**
1. Download models from: `https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/`
2. Create `/public/models/` folder
3. Upload these files:
   - `tiny_face_detector_model-weights_manifest.json`
   - `tiny_face_detector_model-weights.bin`
   - `face_landmark_68_model-weights_manifest.json`
   - `face_landmark_68_model-weights.bin`
   - `face_recognition_model-weights_manifest.json`
   - `face_recognition_model-weights.bin`

### 3. Use in Your Android App

In your Android app's WebView:

```java
WebView webView = findViewById(R.id.webview);
webView.loadUrl("https://YOUR-PROJECT.vercel.app");

// Listen for unlock signals
webView.addJavascriptInterface(new Object() {
    @JavascriptInterface
    public void onFaceUnlock(String result) {
        Log.d("FaceUnlock", result);
        // Unlock your app logic here
    }
}, "android");
```

Or via JavaScript postMessage:

```javascript
window.addEventListener('message', (e) => {
  if (e.data.type === 'FACE_UNLOCK_SUCCESS') {
    console.log('Unlocked with confidence:', e.data.confidence);
    // Your app unlock logic
  }
});
```

## How It Works

1. **Enrollment** – User captures face → embeddings stored locally  
2. **Verification** – Camera input → detect face → compare embeddings → allow/deny  
3. **Security** – Face data never leaves the device

## Configuration

In `pages/index.js`, adjust:

```javascript
const threshold = 0.6; // Sensitivity (0.4 = stricter, 0.8 = lenient)
```

Lower = harder to unlock | Higher = easier to unlock

## API Reference

### PostMessage Events

**Unlock Success:**
```javascript
{
  type: 'FACE_UNLOCK_SUCCESS',
  confidence: 0.92  // 0-1 score
}
```

**Unlock Failed:**
```javascript
{
  type: 'FACE_UNLOCK_FAILED'
}
```

## Browser Support

- Chrome 67+ (Android)
- Firefox (Android)
- Safari 14+ (iOS WebView)

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Models failed to load" | Clear browser cache, reload page |
| "No face detected" | Improve lighting, face closer to camera |
| "Keeps rejecting valid face" | Lower threshold from 0.6 to 0.5 |
| "Accepts wrong faces" | Raise threshold from 0.6 to 0.7 |

## Local Development

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Deployment to Vercel

Every push to `main` auto-deploys. No config needed—Vercel auto-detects Next.js.

---

**Made for mobile-first development. Works offline. Your data stays on-device.**
