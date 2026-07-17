# Integration Guide – Face Unlock Service

How to add face unlock authentication to your Android app.

## Overview

Your face unlock service runs as a web app. Android apps embed it via **WebView** and communicate via **postMessage API**.

```
[Your Android App] 
    ↓ (WebView)
[Face Unlock Web Service]
    ↓ (postMessage)
[Your Android App] ← Unlock Success/Failed
```

## Setup

### Step 1: Create WebView Activity

In your Android app, create an activity that loads the face unlock service:

```java
import android.os.Bundle;
import android.webkit.WebView;
import androidx.appcompat.app.AppCompatActivity;

public class FaceUnlockActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_face_unlock);

        WebView webView = findViewById(R.id.webview);
        
        // Enable WebView settings
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        
        // Load face unlock service
        webView.loadUrl("https://YOUR-PROJECT.vercel.app");
        
        // Set up message listener
        webView.addJavascriptInterface(new FaceUnlockBridge(this), "FaceUnlock");
    }
}
```

### Step 2: Add Message Bridge

Create a JavaScript interface class:

```java
import android.webkit.JavascriptInterface;
import android.util.Log;

public class FaceUnlockBridge {
    private FaceUnlockActivity activity;

    public FaceUnlockBridge(FaceUnlockActivity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public void onSuccess(double confidence) {
        Log.d("FaceUnlock", "✓ Face verified! Confidence: " + confidence);
        activity.unlockApp();
    }

    @JavascriptInterface
    public void onFailure() {
        Log.d("FaceUnlock", "✗ Face verification failed");
        activity.showAccessDenied();
    }
}
```

### Step 3: Handle WebView Messages (Alternative to JavascriptInterface)

If you prefer postMessage API:

```java
webView.evaluateJavascript(
    "window.addEventListener('message', (e) => {" +
    "  if (e.data.type === 'FACE_UNLOCK_SUCCESS') {" +
    "    Android.onSuccess(e.data.confidence);" +
    "  } else if (e.data.type === 'FACE_UNLOCK_FAILED') {" +
    "    Android.onFailure();" +
    "  }" +
    "});",
    null
);
```

### Step 4: Create Layout

In `res/layout/activity_face_unlock.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical">

    <WebView
        android:id="@+id/webview"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />

</LinearLayout>
```

### Step 5: Request Permissions

Add to `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

## Complete Example

```java
public class FaceUnlockActivity extends AppCompatActivity {

    private WebView webView;
    private static final String FACE_UNLOCK_URL = "https://YOUR-PROJECT.vercel.app";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_face_unlock);

        webView = findViewById(R.id.webview);
        setupWebView();
        webView.loadUrl(FACE_UNLOCK_URL);
    }

    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Add bridge
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void handleFaceUnlock(String event, double confidence) {
                if ("success".equals(event)) {
                    unlockApp();
                } else {
                    denyAccess();
                }
            }
        }, "AndroidBridge");
    }

    private void unlockApp() {
        Toast.makeText(this, "✓ Unlocked!", Toast.LENGTH_SHORT).show();
        // Start main activity or perform unlock action
        startActivity(new Intent(this, MainActivity.class));
        finish();
    }

    private void denyAccess() {
        Toast.makeText(this, "✗ Access Denied", Toast.LENGTH_SHORT).show();
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
```

## Using Enrollment Data Across Multiple Apps

Since face data is stored in the WebView's IndexedDB, it's per-WebView instance. To share enrollment across apps:

**Option 1: Single Shared Enrollment Service**
- All apps point to the same `https://YOUR-PROJECT.vercel.app`
- Users enroll once, verify in any app

**Option 2: Sync to Backend**
- Add a backend API to your face unlock service
- Apps submit verification results to backend
- Backend maintains user enrollment

Example backend extension (optional):

```javascript
// POST /api/verify
const response = await fetch('https://YOUR-PROJECT.vercel.app/api/verify', {
  method: 'POST',
  body: JSON.stringify({
    userId: 'user123',
    faceDescriptor: detection.descriptor
  })
});
```

## Security Notes

⚠️ **Face data is stored locally** – If device is compromised, faces could be extracted  
✅ **Encryption** – Consider encrypting IndexedDB with a PIN  
✅ **Fallback Auth** – Always have PIN/password as fallback  
✅ **Threshold Tuning** – Test threshold for your security needs  

## Troubleshooting

| Error | Solution |
|-------|----------|
| WebView blank | Check internet, verify URL is correct |
| Camera permission denied | Ensure camera permission in manifest |
| Face not detected | Better lighting, hold steady, close to camera |
| Crashes on old Android | Use `androidx.webkit.WebViewCompat` |

## Testing

Load locally during development:

```bash
npm run dev  # Runs on http://localhost:3000
# On Android, use http://YOUR_COMPUTER_IP:3000
```

Enable USB debugging:
```bash
adb reverse tcp:3000 tcp:3000
webView.loadUrl("http://localhost:3000");
```

---

**Need help?** Test the web service first at your Vercel URL, then debug integration.
