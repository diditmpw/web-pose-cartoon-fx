/**
 * Pose State Machine and Debounce / Cooldown Manager
 * Prevents rapid audio re-triggering while continuously holding poses.
 */

export class PoseStateMachine {
  constructor(options = {}) {
    this.cooldownDuration = options.cooldownDuration || 2000; // 2 seconds default cooldown buffer
    this.holdThresholds = {
      SAD: 120,       // ms to hold before triggering
      VICTORY: 150,   // ms to hold before triggering
      PUNCH: 0        // immediate trigger on punch velocity
    };

    // Tracking state
    this.currentPose = 'IDLE';
    this.poseStartTime = 0;
    this.lastTriggeredTime = {
      SAD: 0,
      VICTORY: 0,
      PUNCH: 0
    };

    this.hasTriggeredCurrentHold = false;
    this.listeners = [];
    this.eventLog = [];
  }

  setCooldownDuration(ms) {
    this.cooldownDuration = Math.max(500, Math.min(10000, ms));
  }

  on(event, callback) {
    this.listeners.push({ event, callback });
  }

  emit(event, data) {
    for (const l of this.listeners) {
      if (l.event === event || l.event === '*') {
        l.callback(data, event);
      }
    }
  }

  /**
   * Process a pose frame from PoseAnalyzer
   * @param {Object} poseResult - { pose, confidence, velocity, coord, metrics }
   * @param {number} timestamp - Current frame time
   */
  process(poseResult, timestamp = performance.now()) {
    const rawPose = poseResult.pose;
    const isSpecialPose = rawPose === 'SAD' || rawPose === 'VICTORY' || rawPose === 'PUNCH';

    // State transition check
    if (rawPose !== this.currentPose) {
      this.emit('poseChange', { from: this.currentPose, to: rawPose, timestamp });
      this.currentPose = rawPose;
      this.poseStartTime = timestamp;
      this.hasTriggeredCurrentHold = false;
    }

    if (!isSpecialPose) {
      return {
        activePose: this.currentPose,
        isTriggered: false,
        cooldownRemaining: 0,
        cooldownProgress: 0
      };
    }

    const elapsedInPose = timestamp - this.poseStartTime;
    const requiredHold = this.holdThresholds[rawPose] || 0;
    const lastTrigger = this.lastTriggeredTime[rawPose] || 0;
    const timeSinceLastTrigger = timestamp - lastTrigger;
    const isInCooldown = timeSinceLastTrigger < this.cooldownDuration;

    // Remaining cooldown calculation for UI
    const cooldownRemaining = isInCooldown ? Math.max(0, this.cooldownDuration - timeSinceLastTrigger) : 0;
    const cooldownProgress = isInCooldown ? Math.min(1, (this.cooldownDuration - cooldownRemaining) / this.cooldownDuration) : 1.0;

    let justTriggered = false;

    // Trigger condition:
    // 1. Pose held longer than hold threshold
    // 2. Not in cooldown buffer
    // 3. Hasn't already triggered in current continuous hold
    if (elapsedInPose >= requiredHold && !isInCooldown && !this.hasTriggeredCurrentHold) {
      justTriggered = true;
      this.hasTriggeredCurrentHold = true;
      this.lastTriggeredTime[rawPose] = timestamp;

      const triggerEvent = {
        pose: rawPose,
        timestamp,
        confidence: poseResult.confidence,
        details: poseResult,
        cooldownDuration: this.cooldownDuration
      };

      // Add to event history
      this.eventLog.unshift({
        id: Math.random().toString(36).substring(2, 9),
        pose: rawPose,
        time: new Date().toLocaleTimeString(),
        speed: poseResult.velocity ? poseResult.velocity.toFixed(1) : null
      });
      if (this.eventLog.length > 20) this.eventLog.pop();

      this.emit('trigger', triggerEvent);
    }

    return {
      activePose: this.currentPose,
      isTriggered: justTriggered,
      isInCooldown,
      cooldownRemaining,
      cooldownProgress,
      heldDuration: elapsedInPose,
      eventLog: this.eventLog
    };
  }
}
