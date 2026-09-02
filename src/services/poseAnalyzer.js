/**
 * Pose Landmark Analysis Engine
 * Calculates anatomical geometry, slumped posture, victory extensions, and 3-frame wrist velocity.
 */

// MediaPipe Pose Landmark Indices
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32
};

export class PoseAnalyzer {
  constructor(options = {}) {
    // Tunable thresholds
    this.punchVelocityThreshold = options.punchVelocityThreshold || 2.2; // normalized screen units/sec
    this.victoryWristOffset = options.victoryWristOffset || 0.10; // wrists must be at least 10% screen height above nose
    this.sadHeadToShoulderRatio = options.sadHeadToShoulderRatio || 0.32; // nose-to-shoulder vertical dist / shoulder width
    this.sadShoulderElevateRatio = options.sadShoulderElevateRatio || 0.32; // ear-to-shoulder vertical dist / shoulder width
    this.slumpedShoulderWidthRatio = options.slumpedShoulderWidthRatio || 0.82; // relative to baseline

    // Rolling history for 3-frame velocity calculation
    this.historyBufferSize = 5;
    this.leftWristHistory = [];
    this.rightWristHistory = [];

    // Calibration & metrics
    this.baselineShoulderWidth = 0.26; // default estimated neutral shoulder width in normalized screen space
    this.calibrationFrames = 0;
    this.calibrationSum = 0;

    // Last computed metrics for HUD debugger
    this.metrics = {
      leftWristVelocity: 0,
      rightWristVelocity: 0,
      maxWristVelocity: 0,
      shoulderWidth: 0,
      headToShoulderDiff: 0,
      headToShoulderRatio: 0,
      earToShoulderRatio: 0,
      wristsAboveNose: false,
      isFaceCloseToBody: false,
      isShouldersUp: false,
      isSlumped: false,
      activePose: 'IDLE',
      punchHand: null,
      punchCoord: null
    };
  }

  reset() {
    this.leftWristHistory = [];
    this.rightWristHistory = [];
    this.calibrationFrames = 0;
    this.calibrationSum = 0;
  }

  /**
   * Main analysis function called on each MediaPipe frame
   * @param {Array} landmarks - 33 MediaPipe pose landmarks with normalized x, y, z, visibility
   * @param {number} timestamp - Frame timestamp in ms
   * @returns {Object} Detected pose details & metrics
   */
  analyze(landmarks, timestamp = performance.now()) {
    if (!landmarks || landmarks.length < 33) {
      this.metrics.activePose = 'NO_BODY_DETECTED';
      return { pose: 'NONE', confidence: 0, metrics: this.metrics };
    }

    const nose = landmarks[POSE_LANDMARKS.NOSE];
    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rightWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
    const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const leftEar = landmarks[POSE_LANDMARKS.LEFT_EAR];
    const rightEar = landmarks[POSE_LANDMARKS.RIGHT_EAR];
    const mouthLeft = landmarks[POSE_LANDMARKS.MOUTH_LEFT];
    const mouthRight = landmarks[POSE_LANDMARKS.MOUTH_RIGHT];

    // Check visibility confidence
    const upperBodyVisible = 
      (leftShoulder?.visibility ?? 1) > 0.5 &&
      (rightShoulder?.visibility ?? 1) > 0.5 &&
      (nose?.visibility ?? 1) > 0.5;

    if (!upperBodyVisible) {
      this.metrics.activePose = 'LOW_CONFIDENCE';
      return { pose: 'NONE', confidence: 0.3, metrics: this.metrics };
    }

    // 1. Calculate Anatomical Distances & Reference Scales
    const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
    const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
    const currentShoulderWidth = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);
    const refScale = Math.max(0.12, currentShoulderWidth);
    
    // Auto-calibrate neutral shoulder baseline over initial active upright frames
    if (this.calibrationFrames < 45 && currentShoulderWidth > 0.15) {
      this.calibrationSum += currentShoulderWidth;
      this.calibrationFrames++;
      this.baselineShoulderWidth = this.calibrationSum / this.calibrationFrames;
    }

    // Torso length for normalized scale invariance
    let torsoLength = 0.4;
    if (leftHip && rightHip && (leftHip.visibility ?? 1) > 0.4) {
      const hipMidY = (leftHip.y + rightHip.y) / 2;
      torsoLength = Math.max(0.2, Math.abs(hipMidY - shoulderMidY));
    }

    // Facial feature midpoints & vertical offsets
    const mouthVis = ((mouthLeft?.visibility ?? 0) + (mouthRight?.visibility ?? 0)) / 2;
    const mouthMidY = mouthVis > 0.4 ? (mouthLeft.y + mouthRight.y) / 2 : nose.y + 0.04 * (refScale / 0.26);

    const leftEarVis = (leftEar?.visibility ?? 0) > 0.4;
    const rightEarVis = (rightEar?.visibility ?? 0) > 0.4;
    const leftEarY = leftEarVis ? leftEar.y : nose.y - 0.02 * (refScale / 0.26);
    const rightEarY = rightEarVis ? rightEar.y : nose.y - 0.02 * (refScale / 0.26);

    // Distance metrics normalized to body scale
    const headToShoulderDiff = shoulderMidY - nose.y; // positive when nose is higher (normal)
    const headToShoulderRatio = headToShoulderDiff / refScale;
    const mouthToShoulderDiff = shoulderMidY - mouthMidY;
    const mouthToShoulderRatio = mouthToShoulderDiff / refScale;

    const leftEarToShoulder = leftShoulder.y - leftEarY;
    const rightEarToShoulder = rightShoulder.y - rightEarY;
    const earToShoulderDist = (leftEarToShoulder + rightEarToShoulder) / 2;
    const earToShoulderRatio = earToShoulderDist / refScale;

    // 2. Rolling 3-Frame Velocity Tracking for Wrists
    this._updateWristHistory(this.leftWristHistory, leftWrist, timestamp);
    this._updateWristHistory(this.rightWristHistory, rightWrist, timestamp);

    const leftVelocity = this._calculateVelocity(this.leftWristHistory);
    const rightVelocity = this._calculateVelocity(this.rightWristHistory);
    const maxVelocity = Math.max(leftVelocity, rightVelocity);

    // Save metrics
    this.metrics.leftWristVelocity = leftVelocity;
    this.metrics.rightWristVelocity = rightVelocity;
    this.metrics.maxWristVelocity = maxVelocity;
    this.metrics.shoulderWidth = currentShoulderWidth;
    this.metrics.headToShoulderDiff = headToShoulderDiff;
    this.metrics.headToShoulderRatio = headToShoulderRatio;
    this.metrics.earToShoulderRatio = earToShoulderRatio;

    // ==========================================
    // 3. POSE LOGIC CHECKS
    // ==========================================

    // A) PUNCH / STRIKE DETECTION
    // High velocity threshold exceeded within past 3 frames
    const isLeftPunch = leftVelocity >= this.punchVelocityThreshold;
    const isRightPunch = rightVelocity >= this.punchVelocityThreshold;

    if (isLeftPunch || isRightPunch) {
      const punchingHand = leftVelocity > rightVelocity ? 'LEFT' : 'RIGHT';
      const punchWrist = punchingHand === 'LEFT' ? leftWrist : rightWrist;
      const punchSpeed = punchingHand === 'LEFT' ? leftVelocity : rightVelocity;

      this.metrics.activePose = 'PUNCH';
      this.metrics.punchHand = punchingHand;
      this.metrics.punchCoord = { x: punchWrist.x, y: punchWrist.y };

      return {
        pose: 'PUNCH',
        confidence: Math.min(1.0, punchSpeed / (this.punchVelocityThreshold * 1.5)),
        hand: punchingHand,
        coord: { x: punchWrist.x, y: punchWrist.y },
        velocity: punchSpeed,
        metrics: this.metrics
      };
    }

    // B) VICTORY POSE DETECTION
    // Both wrists significantly above nose (in screen coords, smaller y is higher)
    const leftWristHigh = (leftWrist.visibility ?? 1) > 0.5 && leftWrist.y < (nose.y - this.victoryWristOffset);
    const rightWristHigh = (rightWrist.visibility ?? 1) > 0.5 && rightWrist.y < (nose.y - this.victoryWristOffset);
    const wristsAboveShoulders = leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y;

    if (leftWristHigh && rightWristHigh && wristsAboveShoulders) {
      this.metrics.activePose = 'VICTORY';
      this.metrics.wristsAboveNose = true;

      const elevationScore = ((nose.y - leftWrist.y) + (nose.y - rightWrist.y)) / 2;
      return {
        pose: 'VICTORY',
        confidence: Math.min(1.0, elevationScore / 0.3),
        elevation: elevationScore,
        metrics: this.metrics
      };
    }

    // C) SAD / SLUMPED POSE DETECTION
    // Triggers from front view or side view via any of the following natural sad gestures:
    // 1. Face closer to body: Nose / mouth drops down close to or below shoulder level
    const isFaceCloseToBody = (headToShoulderRatio < this.sadHeadToShoulderRatio) ||
                             (mouthToShoulderRatio < 0.16) ||
                             (nose.y >= shoulderMidY - 0.05);

    // 2. Shoulders up / shrugged: Shoulders raised up towards ears
    const isShouldersUp = (earToShoulderRatio < this.sadShoulderElevateRatio) ||
                          (leftEarToShoulder / refScale < 0.22 && rightEarToShoulder / refScale < 0.22);

    // 3. Slumped / Hunched shoulders: Narrowed shoulder width relative to baseline with head droop
    const shoulderWidthRatio = currentShoulderWidth / this.baselineShoulderWidth;
    const isSlumpedShoulders = (shoulderWidthRatio < this.slumpedShoulderWidthRatio) && (headToShoulderRatio < 0.44);

    // Composite sad score
    const headDroopScore = Math.max(0, (0.45 - headToShoulderRatio) / 0.30);
    const shrugScore = Math.max(0, (0.48 - earToShoulderRatio) / 0.28);
    const narrowScore = Math.max(0, (1.0 - shoulderWidthRatio) / 0.25);
    const compositeSadScore = (headDroopScore * 0.5) + (shrugScore * 0.4) + (narrowScore * 0.3);

    this.metrics.isFaceCloseToBody = isFaceCloseToBody;
    this.metrics.isShouldersUp = isShouldersUp;
    this.metrics.isSlumped = isFaceCloseToBody || isShouldersUp || isSlumpedShoulders;

    if (isFaceCloseToBody || isShouldersUp || isSlumpedShoulders || compositeSadScore >= 0.55) {
      this.metrics.activePose = 'SAD';

      const confidence = Math.min(1.0, Math.max(0.6, compositeSadScore + 0.25));
      return {
        pose: 'SAD',
        confidence,
        droop: nose.y - shoulderMidY,
        shoulderWidth: currentShoulderWidth,
        isFaceCloseToBody,
        isShouldersUp,
        isSlumpedShoulders,
        metrics: this.metrics
      };
    }

    // D) NEUTRAL / IDLE
    this.metrics.activePose = 'IDLE';
    this.metrics.wristsAboveNose = false;
    return {
      pose: 'IDLE',
      confidence: 0.9,
      metrics: this.metrics
    };
  }

  _updateWristHistory(history, wrist, timestamp) {
    if (!wrist || (wrist.visibility ?? 1) < 0.4) return;
    history.push({ x: wrist.x, y: wrist.y, t: timestamp });
    if (history.length > this.historyBufferSize) {
      history.shift();
    }
  }

  /**
   * Calculates velocity across the recent 3-frame rolling window
   * Result is in screen units per second
   */
  _calculateVelocity(history) {
    if (history.length < 3) return 0;
    
    // Compare latest frame with frame from 2-3 steps back
    const current = history[history.length - 1];
    const prev = history[Math.max(0, history.length - 3)];

    const dt = (current.t - prev.t) / 1000; // seconds
    if (dt <= 0 || dt > 0.4) return 0; // ignore paused frames

    const dx = current.x - prev.x;
    const dy = current.y - prev.y;
    const distance = Math.hypot(dx, dy);

    return distance / dt;
  }
}
