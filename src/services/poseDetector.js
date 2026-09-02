/**
 * MediaPipe Pose Pipeline with WebGL / WASM Acceleration
 * Manages webcam capture, MediaPipe Pose model, real-time FPS calculation, and frame dispatch.
 */

export class PoseDetector {
  constructor(videoElement, onResultsCallback) {
    this.video = videoElement;
    this.onResults = onResultsCallback;

    this.pose = null;
    this.camera = null;
    this.isRunning = false;
    this.isPaused = false;
    this.currentDeviceId = null;

    // FPS tracking
    this.fps = 0;
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();

    // Simulation / Demo mode
    this.isSimulating = false;
    this.simulatedPose = null;
    this.simAnimFrame = null;
  }

  /**
   * Initializes MediaPipe Pose instance
   */
  async init() {
    // Wait for MediaPipe Pose to be available from CDN / Global or load dynamically
    if (typeof window.Pose === 'undefined') {
      await this._loadMediaPipeScripts();
    }

    this.pose = new window.Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });

    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.pose.onResults((results) => {
      this._updateFps();
      if (this.onResults && !this.isPaused && !this.isSimulating) {
        this.onResults(results);
      }
    });
  }

  async _loadMediaPipeScripts() {
    const scripts = [
      'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js'
    ];

    for (const src of scripts) {
      if (!document.querySelector(`script[src="${src}"]`)) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = src;
          script.crossOrigin = 'anonymous';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
    }
  }

  /**
   * Start Webcam Tracking
   */
  async startCamera(deviceId = null) {
    if (!this.pose) {
      await this.init();
    }

    this.isSimulating = false;
    if (this.simAnimFrame) {
      cancelAnimationFrame(this.simAnimFrame);
    }

    try {
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
          ...(deviceId ? { deviceId: { exact: deviceId } } : {})
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = stream;
      await this.video.play();

      this.currentDeviceId = deviceId;
      this.isRunning = true;
      this.isPaused = false;

      // Start detection loop using requestVideoFrameCallback or requestAnimationFrame
      this._startProcessingLoop();

      return { success: true };
    } catch (err) {
      console.error('[PoseDetector] Error starting camera:', err);
      return { success: false, error: err.message };
    }
  }

  _startProcessingLoop() {
    let processing = false;

    const processFrame = async () => {
      if (!this.isRunning) return;

      if (!this.isPaused && !this.isSimulating && this.video.readyState >= 2 && !processing) {
        processing = true;
        try {
          await this.pose.send({ image: this.video });
        } catch (e) {
          console.warn('[PoseDetector] Frame processing dropped:', e);
        } finally {
          processing = false;
        }
      }

      if ('requestVideoFrameCallback' in this.video) {
        this.video.requestVideoFrameCallback(processFrame);
      } else {
        requestAnimationFrame(processFrame);
      }
    };

    if ('requestVideoFrameCallback' in this.video) {
      this.video.requestVideoFrameCallback(processFrame);
    } else {
      requestAnimationFrame(processFrame);
    }
  }

  stopCamera() {
    this.isRunning = false;
    if (this.video.srcObject) {
      const tracks = this.video.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      this.video.srcObject = null;
    }
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  _updateFps() {
    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastFpsUpdate;

    if (elapsed >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }

  getFps() {
    return this.fps;
  }

  /**
   * Helper to simulate mock poses for instant interactive testing
   */
  startSimulation(poseType = 'VICTORY') {
    this.isSimulating = true;
    let t = 0;

    const loop = () => {
      if (!this.isSimulating) return;
      t += 0.05;

      const mockLandmarks = this._generateMockLandmarks(poseType, t);
      if (this.onResults) {
        this.onResults({ poseLandmarks: mockLandmarks });
      }

      this.fps = 60;
      this.simAnimFrame = requestAnimationFrame(loop);
    };

    if (this.simAnimFrame) cancelAnimationFrame(this.simAnimFrame);
    this.simAnimFrame = requestAnimationFrame(loop);
  }

  _generateMockLandmarks(type, t) {
    const lms = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
    
    // Default neutral landmarks
    lms[0] = { x: 0.5, y: 0.28, z: 0, visibility: 0.99 }; // Nose
    lms[2] = { x: 0.48, y: 0.26, z: 0, visibility: 0.99 }; // L Eye
    lms[5] = { x: 0.52, y: 0.26, z: 0, visibility: 0.99 }; // R Eye
    lms[7] = { x: 0.44, y: 0.27, z: 0, visibility: 0.99 }; // L Ear
    lms[8] = { x: 0.56, y: 0.27, z: 0, visibility: 0.99 }; // R Ear
    lms[9] = { x: 0.48, y: 0.32, z: 0, visibility: 0.99 }; // Mouth L
    lms[10] = { x: 0.52, y: 0.32, z: 0, visibility: 0.99 }; // Mouth R

    lms[11] = { x: 0.38, y: 0.42, z: 0, visibility: 0.99 }; // L Shoulder
    lms[12] = { x: 0.62, y: 0.42, z: 0, visibility: 0.99 }; // R Shoulder
    lms[13] = { x: 0.32, y: 0.55, z: 0, visibility: 0.95 }; // L Elbow
    lms[14] = { x: 0.68, y: 0.55, z: 0, visibility: 0.95 }; // R Elbow
    lms[15] = { x: 0.28, y: 0.68, z: 0, visibility: 0.95 }; // L Wrist
    lms[16] = { x: 0.72, y: 0.68, z: 0, visibility: 0.95 }; // R Wrist
    lms[23] = { x: 0.42, y: 0.75, z: 0, visibility: 0.95 }; // L Hip
    lms[24] = { x: 0.58, y: 0.75, z: 0, visibility: 0.95 }; // R Hip

    if (type === 'VICTORY') {
      // Both hands high up above head in V shape
      const sway = Math.sin(t * 2) * 0.02;
      lms[15] = { x: 0.25, y: 0.12 + sway, z: 0, visibility: 0.99 }; // Left Wrist High
      lms[16] = { x: 0.75, y: 0.12 - sway, z: 0, visibility: 0.99 }; // Right Wrist High
      lms[13] = { x: 0.30, y: 0.28, z: 0, visibility: 0.99 };
      lms[14] = { x: 0.70, y: 0.28, z: 0, visibility: 0.99 };
    } else if (type === 'SAD') {
      // Nose and face drop close to shoulder level, shoulders raised / hunched
      const droop = 0.08 + Math.sin(t) * 0.01;
      const noseY = 0.36 + droop;
      lms[0] = { x: 0.5, y: noseY, z: 0, visibility: 0.99 }; // Nose dropped
      lms[2] = { x: 0.48, y: noseY - 0.02, z: 0, visibility: 0.99 };
      lms[5] = { x: 0.52, y: noseY - 0.02, z: 0, visibility: 0.99 };
      lms[7] = { x: 0.45, y: noseY, z: 0, visibility: 0.99 };
      lms[8] = { x: 0.55, y: noseY, z: 0, visibility: 0.99 };
      lms[9] = { x: 0.48, y: noseY + 0.03, z: 0, visibility: 0.99 };
      lms[10] = { x: 0.52, y: noseY + 0.03, z: 0, visibility: 0.99 };

      // Raised & squeezed shoulders
      lms[11] = { x: 0.44, y: 0.40, z: 0, visibility: 0.99 };
      lms[12] = { x: 0.56, y: 0.40, z: 0, visibility: 0.99 };
      lms[15] = { x: 0.42, y: 0.70, z: 0, visibility: 0.95 };
      lms[16] = { x: 0.58, y: 0.70, z: 0, visibility: 0.95 };
    } else if (type === 'PUNCH') {
      // Fast strike extension of right wrist
      const strikeProgress = (Math.sin(t * 6) + 1) / 2; // rapid oscillation
      const rx = 0.60 + strikeProgress * 0.30;
      const ry = 0.45 - strikeProgress * 0.15;
      lms[16] = { x: rx, y: ry, z: 0, visibility: 0.99 };
      lms[14] = { x: 0.60 + strikeProgress * 0.15, y: 0.46, z: 0, visibility: 0.99 };
    }

    return lms;
  }
}
