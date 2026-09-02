import { PoseAnalyzer, POSE_LANDMARKS } from './src/services/poseAnalyzer.js';
import assert from 'assert';

function createLandmarks(overrides = {}) {
  const lms = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.99 }));
  
  // Neutral upright front pose
  lms[POSE_LANDMARKS.NOSE] = { x: 0.5, y: 0.28, z: 0, visibility: 0.99 };
  lms[POSE_LANDMARKS.LEFT_EYE] = { x: 0.48, y: 0.26, z: 0, visibility: 0.99 };
  lms[POSE_LANDMARKS.RIGHT_EYE] = { x: 0.52, y: 0.26, z: 0, visibility: 0.99 };
  lms[POSE_LANDMARKS.LEFT_EAR] = { x: 0.44, y: 0.27, z: 0, visibility: 0.99 };
  lms[POSE_LANDMARKS.RIGHT_EAR] = { x: 0.56, y: 0.27, z: 0, visibility: 0.99 };
  lms[POSE_LANDMARKS.MOUTH_LEFT] = { x: 0.48, y: 0.32, z: 0, visibility: 0.99 };
  lms[POSE_LANDMARKS.MOUTH_RIGHT] = { x: 0.52, y: 0.32, z: 0, visibility: 0.99 };

  lms[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.37, y: 0.42, z: 0, visibility: 0.99 };
  lms[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.63, y: 0.42, z: 0, visibility: 0.99 };
  lms[POSE_LANDMARKS.LEFT_ELBOW] = { x: 0.32, y: 0.55, z: 0, visibility: 0.95 };
  lms[POSE_LANDMARKS.RIGHT_ELBOW] = { x: 0.68, y: 0.55, z: 0, visibility: 0.95 };
  lms[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.28, y: 0.68, z: 0, visibility: 0.95 };
  lms[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.72, y: 0.68, z: 0, visibility: 0.95 };
  lms[POSE_LANDMARKS.LEFT_HIP] = { x: 0.42, y: 0.75, z: 0, visibility: 0.95 };
  lms[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.58, y: 0.75, z: 0, visibility: 0.95 };

  for (const [key, val] of Object.entries(overrides)) {
    const idx = POSE_LANDMARKS[key] ?? parseInt(key, 10);
    lms[idx] = { ...lms[idx], ...val };
  }

  return lms;
}

console.log('Running PoseAnalyzer Tests...\n');

const analyzer = new PoseAnalyzer();

// 1. Neutral Upright Pose
const neutralResult = analyzer.analyze(createLandmarks(), 1000);
console.log('Test 1: Neutral Upright Pose =>', neutralResult.pose, '(Expected: IDLE)');
assert.strictEqual(neutralResult.pose, 'IDLE', 'Neutral pose should be IDLE');

// 2. Front-Facing Head Dropped / Face Close to Body (Shoulder width stays wide at front: 0.37 to 0.63 = 0.26)
const headDownLandmarks = createLandmarks({
  NOSE: { y: 0.38 },
  LEFT_EYE: { y: 0.36 },
  RIGHT_EYE: { y: 0.36 },
  MOUTH_LEFT: { y: 0.40 },
  MOUTH_RIGHT: { y: 0.40 }
});
const headDownResult = analyzer.analyze(headDownLandmarks, 1033);
console.log('Test 2: Front Head Dropped / Face Close to Body =>', headDownResult.pose, '(Expected: SAD)');
assert.strictEqual(headDownResult.pose, 'SAD', 'Front view with head dropped should be SAD');
assert.strictEqual(headDownResult.isFaceCloseToBody, true, 'isFaceCloseToBody should be true');

// 3. Front-Facing Shoulders Up (Shrugged / raised towards ears)
const shouldersUpLandmarks = createLandmarks({
  LEFT_SHOULDER: { y: 0.31 },
  RIGHT_SHOULDER: { y: 0.31 }
});
const shouldersUpResult = analyzer.analyze(shouldersUpLandmarks, 1066);
console.log('Test 3: Front Shoulders Up / Shrugged =>', shouldersUpResult.pose, '(Expected: SAD)');
assert.strictEqual(shouldersUpResult.pose, 'SAD', 'Front view with shoulders raised should be SAD');
assert.strictEqual(shouldersUpResult.isShouldersUp, true, 'isShouldersUp should be true');

// 4. Slumped Hunched Shoulders (Narrow shoulders + head droop)
const slumpedLandmarks = createLandmarks({
  LEFT_SHOULDER: { x: 0.44, y: 0.43 },
  RIGHT_SHOULDER: { x: 0.56, y: 0.43 },
  NOSE: { y: 0.36 }
});
const slumpedResult = analyzer.analyze(slumpedLandmarks, 1100);
console.log('Test 4: Slumped / Narrow Hunched Shoulders =>', slumpedResult.pose, '(Expected: SAD)');
assert.strictEqual(slumpedResult.pose, 'SAD', 'Slumped shoulders should be SAD');

// 5. Victory Pose (Both wrists high above nose, held steadily)
const victoryAnalyzer = new PoseAnalyzer();
const victoryLandmarks = createLandmarks({
  LEFT_WRIST: { x: 0.28, y: 0.12 },
  RIGHT_WRIST: { x: 0.72, y: 0.12 }
});
victoryAnalyzer.analyze(victoryLandmarks, 1100);
victoryAnalyzer.analyze(victoryLandmarks, 1133);
const victoryResult = victoryAnalyzer.analyze(victoryLandmarks, 1166);
console.log('Test 5: Victory Pose =>', victoryResult.pose, '(Expected: VICTORY)');
assert.strictEqual(victoryResult.pose, 'VICTORY', 'Wrists above nose should be VICTORY');

// 6. Fast Punch Strike
const punchAnalyzer = new PoseAnalyzer();
// Frame 1: Hand at rest
punchAnalyzer.analyze(createLandmarks({ RIGHT_WRIST: { x: 0.60, y: 0.50 } }), 2000);
// Frame 2: Hand beginning strike
punchAnalyzer.analyze(createLandmarks({ RIGHT_WRIST: { x: 0.70, y: 0.45 } }), 2033);
// Frame 3: Rapid strike extension
const punchResult = punchAnalyzer.analyze(createLandmarks({ RIGHT_WRIST: { x: 0.85, y: 0.40 } }), 2066);
console.log('Test 6: Fast Punch Strike =>', punchResult.pose, '(Expected: PUNCH, Velocity:', punchResult.velocity?.toFixed(2), ')');
assert.strictEqual(punchResult.pose, 'PUNCH', 'Fast wrist movement should be PUNCH');

// 7. Close-Up Webcam View (Head dropped with large shoulder scale: 0.40)
const closeAnalyzer = new PoseAnalyzer();
const closeLandmarks = createLandmarks({
  LEFT_SHOULDER: { x: 0.30, y: 0.45 },
  RIGHT_SHOULDER: { x: 0.70, y: 0.45 },
  NOSE: { x: 0.50, y: 0.40 } // closer to shoulder line
});
const closeResult = closeAnalyzer.analyze(closeLandmarks, 3000);
console.log('Test 7: Close-up Head Dropped =>', closeResult.pose, '(Expected: SAD)');
assert.strictEqual(closeResult.pose, 'SAD', 'Close-up head drop should trigger SAD');

// 8. Distant Webcam View (Shoulders raised with small shoulder scale: 0.16)
const farAnalyzer = new PoseAnalyzer();
const farLandmarks = createLandmarks({
  LEFT_SHOULDER: { x: 0.42, y: 0.38 },
  RIGHT_SHOULDER: { x: 0.58, y: 0.38 },
  LEFT_EAR: { x: 0.46, y: 0.35 },
  RIGHT_EAR: { x: 0.54, y: 0.35 },
  NOSE: { x: 0.50, y: 0.36 }
});
const farResult = farAnalyzer.analyze(farLandmarks, 4000);
console.log('Test 8: Distant View Shoulders Up =>', farResult.pose, '(Expected: SAD)');
assert.strictEqual(farResult.pose, 'SAD', 'Distant shoulders up should trigger SAD');

console.log('\nAll PoseAnalyzer tests passed successfully! ✅');

