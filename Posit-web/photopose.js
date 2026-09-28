// photopose.js — 写真やカメラの画像から姿勢を読み取り、骨の向きに変換する
// 検出には MediaPipe の Pose Landmarker を使う（初回だけ通信が必要）。
import * as THREE from 'three';

const VISION_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

let landmarkerPromise = null;

/** Pose Landmarker を一度だけ用意する */
export function loadDetector() {
  if (landmarkerPromise) return landmarkerPromise;
  landmarkerPromise = (async () => {
    const vision = await import(/* @vite-ignore */ `${VISION_BASE}/vision_bundle.mjs`);
    const fileset = await vision.FilesetResolver.forVisionTasks(`${VISION_BASE}/wasm`);
    return vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'IMAGE',
      numPoses: 1,
      minPoseDetectionConfidence: 0.4,
      minPosePresenceConfidence: 0.4,
    });
  })().catch(err => {
    landmarkerPromise = null;          // 次にもう一度試せるようにする
    throw err;
  });
  return landmarkerPromise;
}

/** File（写真）を HTMLImageElement にする */
export function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像を開けませんでした')); };
    img.src = url;
  });
}

/**
 * 画像から姿勢を検出する。
 * @returns {{world: Array, image: Array}|null} world は実寸(メートル)、image は画面上の位置
 */
export async function detectPose(image) {
  const landmarker = await loadDetector();
  const res = landmarker.detect(image);
  if (!res || !res.worldLandmarks || !res.worldLandmarks.length) return null;
  return { world: res.worldLandmarks[0], image: (res.landmarks && res.landmarks[0]) || [] };
}

// MediaPipe の並び（BlazePose 33点）
const LM = {
  nose: 0, earL: 7, earR: 8,
  shoulderL: 11, shoulderR: 12,
  elbowL: 13, elbowR: 14,
  wristL: 15, wristR: 16,
  hipL: 23, hipR: 24,
  kneeL: 25, kneeR: 26,
  ankleL: 27, ankleR: 28,
  toeL: 31, toeR: 32,
};

const MIN_VISIBILITY = 0.3;

/** MediaPipe の座標をこのアプリの座標系に直す（Y上・Z手前） */
function toWorld(p) {
  return new THREE.Vector3(p.x, -p.y, -p.z);
}

function ok(lm, i) {
  const p = lm[i];
  if (!p) return false;
  const v = p.visibility === undefined ? 1 : p.visibility;
  return v >= MIN_VISIBILITY;
}

function mid(a, b) {
  return a.clone().add(b).multiplyScalar(0.5);
}

function dir(from, to) {
  const d = to.clone().sub(from);
  return d.lengthSq() > 1e-8 ? d.normalize() : null;
}

/**
 * 検出した点から、各関節の「子へ向かう向き」を作る。
 * @returns {{dirs:Object, missing:string[]}}
 */
export function landmarksToDirections(lm) {
  const need = ['shoulderL', 'shoulderR', 'hipL', 'hipR'];
  const missing = [];
  for (const k of need) if (!ok(lm, LM[k])) missing.push(k);
  if (missing.length) return { dirs: {}, missing };

  const P = k => toWorld(lm[LM[k]]);
  const shoulderL = P('shoulderL'), shoulderR = P('shoulderR');
  const hipL = P('hipL'), hipR = P('hipR');
  const shoulderMid = mid(shoulderL, shoulderR);
  const hipMid = mid(hipL, hipR);

  const dirs = {};
  const up = dir(hipMid, shoulderMid);
  const left = dir(shoulderR, shoulderL);
  if (up && left) dirs.hips = { up, left };
  if (up) { dirs.spine = up.clone(); dirs.chest = up.clone(); }

  // 首から上は、耳の中点（無ければ鼻）を頭の位置とみなす
  let headPoint = null;
  if (ok(lm, LM.earL) && ok(lm, LM.earR)) headPoint = mid(P('earL'), P('earR'));
  else if (ok(lm, LM.nose)) headPoint = P('nose');
  if (headPoint) {
    const d = dir(shoulderMid, headPoint);
    if (d) dirs.neck = d;
  }

  for (const side of ['L', 'R']) {
    const sh = side === 'L' ? shoulderL : shoulderR;
    if (ok(lm, LM['shoulder' + side])) {
      const d = dir(shoulderMid, sh);
      if (d) dirs['shoulder' + side] = d;
    }
    if (ok(lm, LM['elbow' + side])) {
      const d = dir(sh, P('elbow' + side));
      if (d) dirs['upperArm' + side] = d;
      if (ok(lm, LM['wrist' + side])) {
        const d2 = dir(P('elbow' + side), P('wrist' + side));
        if (d2) dirs['forearm' + side] = d2;
      }
    }
    const hip = side === 'L' ? hipL : hipR;
    if (ok(lm, LM['knee' + side])) {
      const d = dir(hip, P('knee' + side));
      if (d) dirs['thigh' + side] = d;
      if (ok(lm, LM['ankle' + side])) {
        const d2 = dir(P('knee' + side), P('ankle' + side));
        if (d2) dirs['shin' + side] = d2;
        if (ok(lm, LM['toe' + side])) {
          const d3 = dir(P('ankle' + side), P('toe' + side));
          if (d3) dirs['foot' + side] = d3;
        }
      }
    }
  }
  return { dirs, missing: [] };
}

/** 画面用に、検出した点を小さなプレビュー画像へ描く */
export function drawPreview(canvas, image, imageLandmarks) {
  const maxW = 320;
  const scale = Math.min(1, maxW / (image.naturalWidth || image.width || maxW));
  const w = Math.round((image.naturalWidth || image.width) * scale);
  const h = Math.round((image.naturalHeight || image.height) * scale);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, w, h);

  const BONES = [[11, 13], [13, 15], [12, 14], [14, 16], [11, 12],
    [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = Math.max(2, w * 0.008);
  for (const [a, b] of BONES) {
    const pa = imageLandmarks[a], pb = imageLandmarks[b];
    if (!pa || !pb) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x * w, pa.y * h);
    ctx.lineTo(pb.x * w, pb.y * h);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  for (const p of imageLandmarks) {
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, Math.max(2, w * 0.007), 0, Math.PI * 2);
    ctx.fill();
  }
}
