/**
 * Cartoon Visual FX Renderer
 * Renders comic book pop-art effects, skeletal overlays, POW starbursts, victory confetti, tears, and screen shake.
 */

import { POSE_LANDMARKS } from './poseAnalyzer.js';

// Skeletal connections
const SKELETON_CONNECTIONS = [
  // Torso
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER],
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_HIP],
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_HIP],
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP],
  // Left Arm
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_ELBOW],
  [POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.LEFT_WRIST],
  // Right Arm
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_ELBOW],
  [POSE_LANDMARKS.RIGHT_ELBOW, POSE_LANDMARKS.RIGHT_WRIST],
  // Left Leg
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.LEFT_KNEE],
  [POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.LEFT_ANKLE],
  // Right Leg
  [POSE_LANDMARKS.RIGHT_HIP, POSE_LANDMARKS.RIGHT_KNEE],
  [POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.RIGHT_ANKLE]
];

const COMIC_WORDS = ['POW!', 'BAM!', 'KAPOW!', 'WHAM!', 'SMASH!', 'BOOM!'];

export class FXRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.showSkeleton = true;
    this.showComicFX = true;
    this.mirrored = true;

    // Active particle systems & stickers
    this.stickers = [];
    this.confetti = [];
    this.tears = [];
    this.shockwaves = [];
    
    // Screen shake state
    this.shakeIntensity = 0;
    this.shakeDecay = 0.9;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;

    // Victory sunburst rotation
    this.sunburstAngle = 0;
  }

  setOptions({ showSkeleton, showComicFX, mirrored }) {
    if (showSkeleton !== undefined) this.showSkeleton = showSkeleton;
    if (showComicFX !== undefined) this.showComicFX = showComicFX;
    if (mirrored !== undefined) this.mirrored = mirrored;
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Spawns a comic book POW/BAM starburst at the given normalized coordinates
   */
  spawnPunchBurst(normalizedX, normalizedY, velocity = 1.0) {
    if (!this.showComicFX) return;
    
    const x = (this.mirrored ? (1 - normalizedX) : normalizedX) * this.canvas.width;
    const y = normalizedY * this.canvas.height;
    const word = COMIC_WORDS[Math.floor(Math.random() * COMIC_WORDS.length)];

    this.stickers.push({
      x,
      y,
      word,
      scale: 0.2,
      targetScale: 1.0 + Math.min(0.6, velocity * 0.15),
      rotation: (Math.random() - 0.5) * 0.5,
      alpha: 1.0,
      points: 12 + Math.floor(Math.random() * 4),
      innerRadius: 40,
      outerRadius: 85,
      hue: Math.floor(Math.random() * 50) + 30, // Orange/Yellow/Red
      life: 1.0, // normalized lifetime
      decay: 0.025
    });

    // Shockwave ring
    this.shockwaves.push({
      x,
      y,
      radius: 10,
      maxRadius: 160,
      alpha: 1.0,
      decay: 0.04
    });

    // Trigger screen shake
    this.shakeIntensity = Math.min(25, 12 + velocity * 3);
  }

  /**
   * Spawns victory confetti and stars
   */
  spawnVictoryBurst() {
    if (!this.showComicFX) return;

    for (let i = 0; i < 90; i++) {
      this.confetti.push({
        x: Math.random() * this.canvas.width,
        y: -20 - Math.random() * 100,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 5 + 4,
        size: Math.random() * 14 + 8,
        color: `hsl(${Math.floor(Math.random() * 360)}, 95%, 60%)`,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.2,
        shape: Math.random() > 0.4 ? 'rect' : 'star',
        alpha: 1.0
      });
    }
  }

  /**
   * Spawns cartoon tears dripping
   */
  spawnSadTears(noseX, noseY) {
    if (!this.showComicFX) return;

    const centerX = (this.mirrored ? (1 - noseX) : noseX) * this.canvas.width;
    const centerY = noseY * this.canvas.height;

    // Left and right eye tear streams
    for (let i = 0; i < 4; i++) {
      const isLeft = Math.random() > 0.5;
      this.tears.push({
        x: centerX + (isLeft ? -30 : 30) + (Math.random() - 0.5) * 10,
        y: centerY + 15 + Math.random() * 10,
        vy: Math.random() * 5 + 3,
        size: Math.random() * 10 + 8,
        alpha: 1.0,
        decay: 0.02
      });
    }
  }

  /**
   * Main Render Frame
   */
  render({ landmarks, activePose, metrics, timestamp = performance.now() }) {
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    // Update screen shake
    if (this.shakeIntensity > 0.5) {
      this.shakeOffsetX = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeOffsetY = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= this.shakeDecay;
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }

    ctx.save();
    ctx.translate(this.shakeOffsetX, this.shakeOffsetY);
    ctx.clearRect(-20, -20, width + 40, height + 40);

    // 1. Victory Sunburst Background Effect
    if (activePose === 'VICTORY' && this.showComicFX) {
      this._renderSunburst(width, height);
    }

    // 2. Sad Pose Gloom & Tears
    if (activePose === 'SAD' && this.showComicFX) {
      this._renderSadGloom(width, height);
      if (landmarks && landmarks[POSE_LANDMARKS.NOSE]) {
        this.spawnSadTears(landmarks[POSE_LANDMARKS.NOSE].x, landmarks[POSE_LANDMARKS.NOSE].y);
      }
    }

    // 3. Render Skeleton Lines & Joints
    if (this.showSkeleton && landmarks && landmarks.length >= 33) {
      this._renderSkeleton(landmarks, activePose);
    }

    // 4. Render Particle Systems (Confetti, Tears, Shockwaves, Stickers)
    this._renderParticles();

    ctx.restore();
  }

  _renderSunburst(w, h) {
    const ctx = this.ctx;
    this.sunburstAngle += 0.008;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(this.sunburstAngle);

    const rays = 16;
    const maxDim = Math.hypot(w, h);

    for (let i = 0; i < rays; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const angle1 = (i * 2 * Math.PI) / rays;
      const angle2 = ((i + 0.5) * 2 * Math.PI) / rays;
      ctx.lineTo(Math.cos(angle1) * maxDim, Math.sin(angle1) * maxDim);
      ctx.lineTo(Math.cos(angle2) * maxDim, Math.sin(angle2) * maxDim);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 215, 0, 0.16)' : 'rgba(255, 140, 0, 0.08)';
      ctx.fill();
    }
    ctx.restore();
  }

  _renderSadGloom(w, h) {
    const ctx = this.ctx;
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.8);
    grad.addColorStop(0, 'rgba(30, 60, 120, 0.05)');
    grad.addColorStop(1, 'rgba(10, 25, 70, 0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  _renderSkeleton(landmarks, activePose) {
    const ctx = this.ctx;
    const { width, height } = this.canvas;

    const toScreen = (lm) => {
      const x = (this.mirrored ? (1 - lm.x) : lm.x) * width;
      const y = lm.y * height;
      return { x, y, vis: lm.visibility ?? 1 };
    };

    // Color theme based on pose
    let boneColor = '#00F0FF';
    let jointColor = '#FFE600';
    let glowColor = 'rgba(0, 240, 255, 0.6)';

    if (activePose === 'VICTORY') {
      boneColor = '#FFD700';
      jointColor = '#FF3366';
      glowColor = 'rgba(255, 215, 0, 0.8)';
    } else if (activePose === 'SAD') {
      boneColor = '#4D79FF';
      jointColor = '#70A1FF';
      glowColor = 'rgba(77, 121, 255, 0.7)';
    } else if (activePose === 'PUNCH') {
      boneColor = '#FF0055';
      jointColor = '#FFCC00';
      glowColor = 'rgba(255, 0, 85, 0.9)';
    }

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Draw Bones (with comic black outline + neon fill)
    for (const [idx1, idx2] of SKELETON_CONNECTIONS) {
      const p1 = toScreen(landmarks[idx1]);
      const p2 = toScreen(landmarks[idx2]);

      if (p1.vis < 0.4 || p2.vis < 0.4) continue;

      // Comic Black Outline
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#000000';
      ctx.stroke();

      // Neon Interior Bone
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineWidth = 8;
      ctx.strokeStyle = boneColor;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 12;
      ctx.stroke();
    }

    // 2. Draw Keypoint Joints
    const keyJoints = [
      POSE_LANDMARKS.NOSE,
      POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER,
      POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.RIGHT_ELBOW,
      POSE_LANDMARKS.LEFT_WRIST, POSE_LANDMARKS.RIGHT_WRIST,
      POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP
    ];

    for (const idx of keyJoints) {
      const p = toScreen(landmarks[idx]);
      if (p.vis < 0.4) continue;

      const radius = (idx === POSE_LANDMARKS.LEFT_WRIST || idx === POSE_LANDMARKS.RIGHT_WRIST) ? 12 : 9;

      // Outline
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 4, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.shadowBlur = 0;
      ctx.fill();

      // Core Joint
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = jointColor;
      ctx.shadowColor = jointColor;
      ctx.shadowBlur = 10;
      ctx.fill();
    }

    // 3. Cartoon Head Expression / Emoji Badge
    const nose = toScreen(landmarks[POSE_LANDMARKS.NOSE]);
    if (nose.vis > 0.5) {
      let emoji = '😎';
      if (activePose === 'VICTORY') emoji = '🏆';
      else if (activePose === 'SAD') emoji = '😭';
      else if (activePose === 'PUNCH') emoji = '💥';

      ctx.save();
      ctx.font = '36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 8;
      ctx.fillText(emoji, nose.x, nose.y - 45);
      ctx.restore();
    }

    ctx.restore();
  }

  _renderParticles() {
    const ctx = this.ctx;
    const { width, height } = this.canvas;

    // 1. Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * 0.15 + 4;
      sw.alpha -= sw.decay;

      if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
        this.shockwaves.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.lineWidth = 8;
      ctx.strokeStyle = `rgba(255, 230, 0, ${sw.alpha})`;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius * 0.7, 0, Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = `rgba(255, 50, 50, ${sw.alpha * 0.8})`;
      ctx.stroke();
      ctx.restore();
    }

    // 2. Comic POW Stickers
    for (let i = this.stickers.length - 1; i >= 0; i--) {
      const st = this.stickers[i];
      st.scale += (st.targetScale - st.scale) * 0.25;
      st.life -= st.decay;

      if (st.life <= 0) {
        this.stickers.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(st.x, st.y);
      ctx.rotate(st.rotation);
      ctx.scale(st.scale, st.scale);
      ctx.globalAlpha = Math.min(1.0, st.life * 1.5);

      // Draw Starburst Polygon
      this._drawStarburst(ctx, 0, 0, st.points, st.innerRadius, st.outerRadius, st.hue);

      // Draw Comic Typography
      ctx.font = '900 38px "Luckiest Guy", "Bangers", impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Thick 3D Drop Shadow
      ctx.fillStyle = '#000000';
      ctx.fillText(st.word, 4, 4);

      // White outline
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#FFFFFF';
      ctx.strokeText(st.word, 0, 0);

      // Black outer stroke
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#000000';
      ctx.strokeText(st.word, 0, 0);

      // Crisp White fill
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#FFFFFF';
      ctx.strokeText(st.word, 0, 0);

      ctx.fillStyle = '#FFEE00';
      ctx.fillText(st.word, 0, 0);

      ctx.restore();
    }

    // 3. Confetti
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const c = this.confetti[i];
      c.x += c.vx;
      c.y += c.vy;
      c.vy += 0.15; // gravity
      c.rotation += c.vRot;

      if (c.y > height + 30) {
        this.confetti.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rotation);
      ctx.fillStyle = c.color;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;

      if (c.shape === 'rect') {
        ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
        ctx.strokeRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
      } else {
        this._drawStar(ctx, 0, 0, 5, c.size * 0.4, c.size * 0.8);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. Tears
    for (let i = this.tears.length - 1; i >= 0; i--) {
      const tr = this.tears[i];
      tr.y += tr.vy;
      tr.vy += 0.3;
      tr.alpha -= tr.decay;

      if (tr.alpha <= 0 || tr.y > height) {
        this.tears.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = tr.alpha;
      ctx.fillStyle = '#00D2FF';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;

      // Teardrop shape
      ctx.beginPath();
      ctx.moveTo(tr.x, tr.y - tr.size);
      ctx.bezierCurveTo(tr.x + tr.size, tr.y - tr.size / 2, tr.x + tr.size, tr.y + tr.size, tr.x, tr.y + tr.size);
      ctx.bezierCurveTo(tr.x - tr.size, tr.y + tr.size, tr.x - tr.size, tr.y - tr.size / 2, tr.x, tr.y - tr.size);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawStarburst(ctx, cx, cy, points, innerRadius, outerRadius, hue) {
    const step = Math.PI / points;
    ctx.beginPath();

    for (let i = 0; i < 2 * points; i++) {
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = i * step;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    // Drop shadow
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 6;
    ctx.shadowOffsetY = 6;

    // Fill gradient
    const grad = ctx.createRadialGradient(cx, cy, innerRadius * 0.2, cx, cy, outerRadius);
    grad.addColorStop(0, `hsl(${hue + 20}, 100%, 65%)`);
    grad.addColorStop(1, `hsl(${hue - 15}, 100%, 45%)`);
    ctx.fillStyle = grad;
    ctx.fill();

    // Heavy comic outline
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 8;
    ctx.stroke();
  }

  _drawStar(ctx, cx, cy, spikes, innerRadius, outerRadius) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  }
}
