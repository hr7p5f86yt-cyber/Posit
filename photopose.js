// photopose.js — 写真やカメラの画像から姿勢を読み取り、骨の向きに変換する
// 検出には MediaPipe の Pose Landmarker を使う（初回だけ通信が必要）。
import * as THREE from 'three';

const VISION_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let landmarkerPromise = null;
let handPromise = null;
let visionPromise = null;
const vision = () => (visionPromise = visionPromise || import(/* @vite-ignore */ `${VISION_BASE}/vision_bundle.mjs`)
  .catch(err => { visionPromise = null; throw err; }));

/** Pose Landmarker を一度だけ用意する */
export function loadDetector() {
  if (landmarkerPromise) return landmarkerPromise;
  landmarkerPromise = (async () => {
    const v = await vision();
    const fileset = await v.FilesetResolver.forVisionTasks(`${VISION_BASE}/wasm`);
    return v.PoseLandmarker.createFromOptions(fileset, {
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

/** Hand Landmarker（手の 21 点）を一度だけ用意する */
export function loadHandDetector() {
  if (handPromise) return handPromise;
  handPromise = (async () => {
    const v = await vision();
    const fileset = await v.FilesetResolver.forVisionTasks(`${VISION_BASE}/wasm`);
    return v.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: 'GPU' },
      runningMode: 'IMAGE',
      numHands: 1,
      minHandDetectionConfidence: 0.3,
      minHandPresenceConfidence: 0.3,
    });
  })().catch(err => { handPromise = null; throw err; });
  return handPromise;
}

/**
 * 体の検出から手首のまわりを切り出して、手の 21 点を探す。
 * 全身の写真では手が小さいので、手のまわりだけを拡大してから探す。
 * @returns {{L?:{world, image}, R?:{world, image}}} side は写っている人から見た左右（＝人形の左右）
 */
export async function detectHands(image, poseImage) {
  const out = {};
  if (!poseImage || !poseImage.length) return out;
  let det;
  try { det = await loadHandDetector(); } catch (e) { return out; }
  const W = image.naturalWidth || image.width, H = image.naturalHeight || image.height;
  const S = 256;
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  for (const [sd, wi, pi, ii] of [['L', 15, 17, 19], ['R', 16, 18, 20]]) {
    const w = poseImage[wi], pk = poseImage[pi], ix = poseImage[ii];
    if (!w || !pk || !ix) continue;
    if ((w.visibility ?? 1) < 0.2) continue;
    const wx = w.x * W, wy = w.y * H;
    const mx = (pk.x + ix.x) / 2 * W, my = (pk.y + ix.y) / 2 * H;
    const len = Math.hypot(mx - wx, my - wy);
    const size = Math.max(len * 4.2, Math.hypot(W, H) * 0.06);
    const cx = wx + (mx - wx) * 0.9, cy = wy + (my - wy) * 0.9;
    const x0 = cx - size / 2, y0 = cy - size / 2;
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    g.drawImage(image, x0, y0, size, size, 0, 0, S, S);
    let res = null;
    try { res = det.detect(cv); } catch (e) { res = null; }
    if (!res || !res.landmarks || !res.landmarks.length) continue;
    // 切り出した中で、手首にいちばん近い手を使う（切り出しの中心付近）
    let best = 0, bd = Infinity;
    res.landmarks.forEach((lm, k) => {
      const px = x0 + lm[0].x * size, py = y0 + lm[0].y * size;
      const d = Math.hypot(px - wx, py - wy);
      if (d < bd) { bd = d; best = k; }
    });
    if (bd > size * 0.45) continue;
    out[sd] = {
      world: res.worldLandmarks[best],
      image: res.landmarks[best].map(p => ({ x: (x0 + p.x * size) / W, y: (y0 + p.y * size) / H })),
    };
  }
  return out;
}

/**
 * 手の 21 点から、指の曲げ・開きを手の形の書式（poses.js の HAND_SHAPES と同じ）にする。
 * 角度は解剖学どおり、手のひらの側へ曲がるのを「曲げ」とする（左右で向きを合わせる）。
 */
export function handToSpec(world, side) {
  const P = i => toWorld(world[i]);
  const wrist = P(0);
  const distal = P(9).sub(wrist).normalize();
  const radial = P(5).sub(P(17));
  radial.addScaledVector(distal, -radial.dot(distal)).normalize();
  // 手のひらの向き: 左手は distal × radial、右手はその逆（viewer の _handFrame と同じ決め方）
  const palmar = new THREE.Vector3().crossVectors(distal, radial);
  if (side === 'R') palmar.negate();
  palmar.normalize();
  const deg = r => r * 180 / Math.PI;
  /** v1 → v2 の曲がり（手のひら側へ +）と、開き（親指側へ +） */
  const bend = (a, b, c) => {
    const v1 = b.clone().sub(a).normalize(), v2 = c.clone().sub(b);
    const pp = palmar.clone().addScaledVector(v1, -palmar.dot(v1)).normalize();
    const rr = radial.clone().addScaledVector(v1, -radial.dot(v1)).normalize();
    return { flex: deg(Math.atan2(v2.dot(pp), v2.dot(v1))), spread: deg(Math.atan2(v2.dot(rr), v2.dot(v1))) };
  };
  const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const parts = [];
  const F = { index: [5, 6, 7, 8], middle: [9, 10, 11, 12], ring: [13, 14, 15, 16], pinky: [17, 18, 19, 20] };
  for (const [name, [m, p, d, t]] of Object.entries(F)) {
    const b1 = bend(wrist, P(m), P(p));
    const b2 = bend(P(m), P(p), P(d));
    const b3 = bend(P(p), P(d), P(t));
    const f1 = clampN(b1.flex, -20, 95), f2 = clampN(b2.flex, 0, 110), f3 = clampN(b3.flex, 0, 80);
    const sp = clampN(b1.spread * 0.8, -25, 25);
    parts.push(`${name}1:${Math.round(-f1)},0,${Math.round(sp)}`, `${name}2:${Math.round(-f2)},0,0`, `${name}3:${Math.round(-f3)},0,0`);
  }
  // 親指: 曲げは MCP・IP の角度、手のひらの前へ回り込む量（対立）は先と小指の付け根の距離で決める
  const ang = (a, b, c) => deg(b.clone().sub(a).angleTo(c.clone().sub(b)));
  const t2 = clampN(ang(P(1), P(2), P(3)), 0, 70), t3 = clampN(ang(P(2), P(3), P(4)), 0, 80);
  const palmW = P(5).distanceTo(P(17)) || 1;
  const opp = clampN((1.5 - P(4).distanceTo(P(17)) / palmW) / 0.8, 0, 1);
  parts.push(`thumb1:${Math.round(30 - 35 * opp)},0,${Math.round(-25 + 70 * opp)}`,
    `thumb2:${Math.round(-t2)},0,0`, `thumb3:${Math.round(-t3)},0,0`);
  return { spec: parts.join(' '), distal, radial, palmar };
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
  // 姿勢の仕上げ（手の触れている所・手の向き）に使う点（このアプリの座標）
  const pts = {};
  for (const [k, i] of Object.entries(LM)) if (ok(lm, i)) pts[k] = P(k);
  for (const [k, i] of [['pinkyL', 17], ['pinkyR', 18], ['indexL', 19], ['indexR', 20]]) if (lm[i] && (lm[i].visibility ?? 1) >= 0.2) pts[k] = toWorld(lm[i]);
  if (headPoint) pts.head = headPoint;
  return { dirs, missing: [], pts };
}

/** 画面用に、検出した点を小さなプレビュー画像へ描く */
export function drawPreview(canvas, image, imageLandmarks, hands = null) {
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
  // 見つけた手（21 点）は黄色で
  if (hands) {
    const HB = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
      [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = Math.max(1, w * 0.004);
    for (const hd of Object.values(hands)) {
      const im = hd.image;
      for (const [a, b] of HB) {
        ctx.beginPath(); ctx.moveTo(im[a].x * w, im[a].y * h); ctx.lineTo(im[b].x * w, im[b].y * h); ctx.stroke();
      }
    }
  }
}

// ===== photopose.js ここまで =====
