/**
 * Main Application Script (Clean & Minimal)
 * Manages camera stream, pose tracking pipeline, cartoon sound triggers, and visual overlays.
 */

import './style.css';
import { audioEngine } from './services/audioEngine.js';
import { PoseAnalyzer } from './services/poseAnalyzer.js';
import { PoseStateMachine } from './services/stateMachine.js';
import { FXRenderer } from './services/fxRenderer.js';
import { PoseDetector } from './services/poseDetector.js';

// DOM Elements
const videoEl = document.getElementById('webcamVideo');
const canvasEl = document.getElementById('fxCanvas');
const viewportWrapper = document.getElementById('viewportWrapper');
const cameraStandby = document.getElementById('cameraStandby');

const cameraToggleBtn = document.getElementById('cameraToggleBtn');
const standbyStartBtn = document.getElementById('standbyStartBtn');
const muteBtn = document.getElementById('muteBtn');

const activePoseBadge = document.getElementById('activePoseBadge');
const poseBadgeEmoji = document.getElementById('poseBadgeEmoji');
const poseBadgeText = document.getElementById('poseBadgeText');

const cooldownTag = document.getElementById('cooldownTag');
const cooldownDot = document.getElementById('cooldownDot');
const cooldownText = document.getElementById('cooldownText');

const guideSad = document.getElementById('guideSad');
const guideVictory = document.getElementById('guideVictory');
const guidePunch = document.getElementById('guidePunch');

// ==========================================
// Service Instances
// ==========================================
const poseAnalyzer = new PoseAnalyzer({
  punchVelocityThreshold: 2.0
});

const stateMachine = new PoseStateMachine({
  cooldownDuration: 2000 // 2 second buffer
});

const fxRenderer = new FXRenderer(canvasEl);

// Sync canvas resolution with viewport
function syncCanvasSize() {
  const rect = viewportWrapper.getBoundingClientRect();
  fxRenderer.resize(rect.width, rect.height);
}
window.addEventListener('resize', syncCanvasSize);
syncCanvasSize();

// ==========================================
// Sound & Visual Trigger Handlers
// ==========================================
stateMachine.on('trigger', ({ pose, details }) => {
  if (pose === 'SAD') {
    audioEngine.playSadTrombone();
    showPoseBadge('SAD', '😭 SAD POSE! WAH WAH WAAAAH', '😭');
  } else if (pose === 'VICTORY') {
    audioEngine.playFanfare();
    fxRenderer.spawnVictoryBurst();
    showPoseBadge('VICTORY', '🏆 VICTORY FANFARE!', '🏆');
  } else if (pose === 'PUNCH') {
    const speed = details.velocity || 2.0;
    audioEngine.playPow(speed / 2.0);
    const coord = details.coord || { x: 0.5, y: 0.5 };
    fxRenderer.spawnPunchBurst(coord.x, coord.y, speed);
    showPoseBadge('PUNCH', '💥 POW! DIRECT HIT!', '💥');
  }
});

stateMachine.on('poseChange', ({ to }) => {
  if (to === 'IDLE' || to === 'NONE') {
    showPoseBadge('IDLE', 'STAND IN FRONT OF CAMERA', '⚡');
  }
});

function showPoseBadge(pose, text, emoji) {
  activePoseBadge.className = `active-pose-badge pose-${pose}`;
  poseBadgeText.textContent = text;
  poseBadgeEmoji.textContent = emoji;
}

// ==========================================
// MediaPipe Frame Processing Pipeline
// ==========================================
const poseDetector = new PoseDetector(videoEl, (results) => {
  const now = performance.now();
  const landmarks = results.poseLandmarks || null;

  // 1. Analyze landmarks for pose triggers
  const poseResult = poseAnalyzer.analyze(landmarks, now);

  // 2. Process state machine with 2-second cooldown debounce
  const stateResult = stateMachine.process(poseResult, now);

  // 3. Render Skeleton Lines & Dynamic Cartoon Effects
  fxRenderer.render({
    landmarks,
    activePose: stateResult.activePose,
    metrics: poseResult.metrics,
    timestamp: now
  });

  // 4. Update UI highlights & Cooldown state
  guideSad.classList.toggle('active', stateResult.activePose === 'SAD');
  guideVictory.classList.toggle('active', stateResult.activePose === 'VICTORY');
  guidePunch.classList.toggle('active', stateResult.activePose === 'PUNCH');

  if (stateResult.isInCooldown) {
    const sec = (stateResult.cooldownRemaining / 1000).toFixed(1);
    cooldownText.textContent = `COOLDOWN (${sec}s)`;
    cooldownDot.className = 'cooldown-dot cooling';
  } else {
    cooldownText.textContent = 'READY';
    cooldownDot.className = 'cooldown-dot';
  }
});

// ==========================================
// User Controls
// ==========================================
let isTracking = false;

async function startTracking() {
  audioEngine.init();
  cameraToggleBtn.textContent = '⏳ Starting...';
  standbyStartBtn.textContent = '⏳ Starting...';

  const res = await poseDetector.startCamera();
  if (res.success) {
    isTracking = true;
    cameraStandby.style.display = 'none';
    cameraToggleBtn.textContent = '⏹ Stop Camera';
    cameraToggleBtn.className = 'pill-btn danger';
    syncCanvasSize();
  } else {
    alert(`Could not start camera: ${res.error}`);
    cameraToggleBtn.textContent = '📹 Start Camera';
    cameraToggleBtn.className = 'pill-btn primary';
    standbyStartBtn.textContent = '▶ START CAMERA';
  }
}

function stopTracking() {
  poseDetector.stopCamera();
  isTracking = false;
  cameraStandby.style.display = 'flex';
  cameraToggleBtn.textContent = '📹 Start Camera';
  cameraToggleBtn.className = 'pill-btn primary';
  standbyStartBtn.textContent = '▶ START CAMERA';
  showPoseBadge('IDLE', 'CAMERA PAUSED', '⏸');
}

cameraToggleBtn.addEventListener('click', () => {
  if (isTracking) {
    stopTracking();
  } else {
    startTracking();
  }
});

standbyStartBtn.addEventListener('click', startTracking);

// Mute Toggle
muteBtn.addEventListener('click', () => {
  audioEngine.init();
  const muted = audioEngine.toggleMute();
  muteBtn.textContent = muted ? '🔇 Sound: OFF' : '🔊 Sound: ON';
  muteBtn.classList.toggle('danger', muted);
});

// Unlock Web Audio on first click
window.addEventListener('click', () => {
  audioEngine.resumeContext();
}, { once: true });
