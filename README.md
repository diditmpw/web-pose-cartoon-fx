# 🎭 Cartoon Pose Soundboard (Web Pose Cartoon FX)

An interactive, real-time AI computer vision web application that tracks body poses through your webcam and triggers classic cartoon sound effects, dynamic canvas visual bursts, and stylized skeleton animations.

Powered by **MediaPipe Pose**, **HTML5 Canvas**, and the **Web Audio API** — running 100% locally in the browser with zero server dependencies.

---

## ✨ Features

- **⚡ Real-Time Pose Detection**: Sub-millisecond body tracking using MediaPipe Pose running directly on client hardware.
- **🎨 Cartoon Visual Effects (FX)**: High-performance HTML5 Canvas rendering glowing skeleton bones, starburst particle explosions, shockwaves, and comic impact stamps.
- **🔊 Zero-Latency Audio Engine**: Hybrid sound system featuring pre-decoded in-memory `AudioBuffer` playback paired with procedural Web Audio synthesis fallback.
- **⏱️ Anti-Spam State Machine**: Built-in 2.0-second cooldown buffer with state hysteresis to prevent accidental repetitive triggers.
- **🔒 100% Private & Offline Capable**: All webcam frames are processed strictly in client-side memory; no images or video data ever leave your device.

---

## 🤸 Supported Poses & Effects

| Pose | Trigger Gesture | Sound Effect | Visual Effect |
| :--- | :--- | :--- | :--- |
| **😭 Sad Pose** | Slump head down (nose drops below shoulder midpoint) | 🎺 *Sad Trombone* ("Wah-wah-wah-waaaah") | Blue sorrow glow & active badge |
| **🏆 Victory Pose** | Raise both hands high above head level | 🎺 *Triumphant Fanfare* | Multi-color starburst & ring explosion |
| **💥 Comic Punch** | Fast wrist / fist strike exceeding velocity threshold | 💥 *Comic POW!* (Impact crunch + 808 dive) | Comic shockwave & POW burst at strike point |

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A webcam connected to your computer

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/diditmpw/web-pose-cartoon-fx.git
   cd web-pose-cartoon-fx
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. Open your browser at the URL shown in the terminal (typically `http://localhost:5173`).
5. Click **"Start Camera"** and allow webcam permissions when prompted.

---

## 🛠️ Available Scripts

- **`npm run dev`**: Starts the local Vite development server with Hot Module Replacement (HMR).
- **`npm run build`**: Compiles and bundles production-ready static assets into the `dist/` folder.
- **`npm run preview`**: Locally serves the built production bundle for testing.

---

## 📂 Project Structure

```text
web-pose-cartoon-fx/
├── public/
│   └── audio/
│       ├── fanfare.wav        # Brass victory fanfare audio
│       ├── pow.wav            # Comic punch sound effect
│       └── sad_trombone.wav   # Sad trombone slide audio
├── src/
│   ├── services/
│   │   ├── audioEngine.js     # Web Audio API engine & procedural synth fallback
│   │   ├── fxRenderer.js      # Canvas particle & skeleton rendering engine
│   │   ├── poseAnalyzer.js    # Landmark geometric calculations & velocity tracker
│   │   ├── poseDetector.js    # MediaPipe Pose camera pipeline wrapper
│   │   └── stateMachine.js    # Debounce cooldown & pose transition controller
│   ├── main.js                # App bootstrap & event wiring
│   └── style.css              # Dark mode UI styling & comic animations
├── index.html                 # Main application HTML & MediaPipe CDN imports
├── package.json               # Project manifest and scripts
├── .gitignore                 # Git ignore rules
└── README.md                  # Project documentation
```

---

## 🧠 Architecture Overview

```
[ Webcam Feed ] ─► [ MediaPipe Pose ]
                          │
                          ▼ (Landmarks)
                  [ PoseAnalyzer ] (Angles & Wrist Velocity)
                          │
                          ▼ (Detected Pose)
                  [ PoseStateMachine ] (2s Cooldown & Hysteresis)
                     │             │
        (On Trigger) │             │ (Every Frame)
                     ▼             ▼
             [ AudioEngine ]   [ FXRenderer ]
           (WAV Buffer/Synth) (Canvas Skeleton + Particles)
```

1. **`PoseDetector`**: Captures webcam stream and passes video frames into MediaPipe Pose.
2. **`PoseAnalyzer`**: Evaluates 33 body keypoints in real time, calculating relative elevation, vertical/horizontal distances, and instantaneous hand velocities.
3. **`PoseStateMachine`**: Filters noise and jitter, ensuring triggers only fire on confident transitions and enter a 2-second cooldown period.
4. **`FXRenderer`**: Synchronizes with `requestAnimationFrame` to draw smooth skeleton overlays and physics-based particle burst effects on an overlay canvas.
5. **`AudioEngine`**: Plays preloaded WAV buffers with sample-accurate Web Audio timing or falls back to oscillator-based procedural synthesis.

---

## 💻 Browser Support & Permissions

- **Supported Browsers**: Google Chrome, Microsoft Edge, Mozilla Firefox, Apple Safari, Brave, Opera.
- **Webcam Permissions**: The browser will request permission to access your webcam. Make sure your browser or OS permissions allow camera access.
- **Audio Autoplay**: Most browsers require a user interaction (e.g. clicking the "Start Camera" or "Sound" button) before allowing Web Audio playback.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
