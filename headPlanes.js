// headPlanes.js — 顔の凹凸を「面」で捉えた頭部をつくる
// 眉の張り出し・眼窩のくぼみ・頬骨の突出・鼻・あごなど、
// デッサンで使う「面の変わり目」が稜線として出るように、
// 横方向の輪（リング）を積み上げて 1 枚のつながった面として組み立てる。
//
// 寸法は身長 1.7m（頭の高さ 0.285m）を前提にメートルで書き、
// 頭のボーンの原点を (0,0,0)、上が +y、前が +z、左が +x とする。
// あご先 y=-0.095、頭頂 y=+0.190。
import * as THREE from 'three';

// 片側 9 列（0=前の中心 … 4=真横 … 8=後ろの中心）。[x, z] をメートルで。
// y は上から下へ。数値は Loomis の頭部比率と「面で捉えた頭部」に合わせてある。
const RINGS = [
  // y,        0 前中心        1 前寄り        2 前外側        3 眼窩の外縁     4 真横           5 後ろ外側       6 後ろ斜め       7 後ろ寄り       8 後中心
  [+0.178, [[0.000, 0.026], [0.018, 0.011], [0.032, -0.004], [0.038, -0.023], [0.047, -0.041], [0.044, -0.060], [0.036, -0.078], [0.021, -0.091], [0.000, -0.100]]],
  [+0.152, [[0.000, 0.068], [0.031, 0.046], [0.054, 0.022], [0.065, -0.008], [0.080, -0.036], [0.075, -0.066], [0.062, -0.095], [0.037, -0.116], [0.000, -0.129]]],
  [+0.124, [[0.000, 0.085], [0.036, 0.059], [0.062, 0.032], [0.075, -0.003], [0.092, -0.037], [0.086, -0.071], [0.071, -0.104], [0.042, -0.129], [0.000, -0.145]]],
  // 額
  [+0.100, [[0.000, 0.091], [0.037, 0.074], [0.064, 0.052], [0.078, 0.011], [0.096, -0.037], [0.089, -0.074], [0.073, -0.108], [0.044, -0.134], [0.000, -0.151]]],
  // 眉の張り出し
  [+0.072, [[0.000, 0.097], [0.039, 0.091], [0.066, 0.071], [0.080, 0.029], [0.099, -0.036], [0.092, -0.074], [0.076, -0.110], [0.045, -0.136], [0.000, -0.154]]],
  // 上まぶた（眼窩の天井）
  [+0.058, [[0.000, 0.090], [0.038, 0.060], [0.065, 0.042], [0.079, 0.045], [0.097, -0.038], [0.091, -0.074], [0.075, -0.108], [0.044, -0.134], [0.000, -0.151]]],
  // 目の高さ（頭の上下の中央）
  [+0.040, [[0.000, 0.088], [0.037, 0.054], [0.064, 0.038], [0.078, 0.045], [0.095, -0.037], [0.089, -0.073], [0.073, -0.106], [0.043, -0.131], [0.000, -0.148]]],
  // 下まぶた
  [+0.022, [[0.000, 0.090], [0.036, 0.066], [0.063, 0.051], [0.076, 0.046], [0.093, -0.031], [0.087, -0.066], [0.072, -0.099], [0.043, -0.123], [0.000, -0.139]]],
  // 頬骨・小鼻の高さ
  [+0.002, [[0.000, 0.093], [0.036, 0.086], [0.061, 0.070], [0.074, 0.041], [0.091, -0.023], [0.085, -0.056], [0.070, -0.087], [0.042, -0.110], [0.000, -0.126]]],
  // 小鼻の下
  [-0.017, [[0.000, 0.100], [0.035, 0.090], [0.060, 0.074], [0.072, 0.042], [0.089, -0.014], [0.083, -0.046], [0.068, -0.077], [0.040, -0.100], [0.000, -0.115]]],
  // 口
  [-0.041, [[0.000, 0.096], [0.033, 0.086], [0.057, 0.063], [0.069, 0.038], [0.084, -0.011], [0.079, -0.041], [0.065, -0.070], [0.039, -0.091], [0.000, -0.105]]],
  // あごの上・エラ
  [-0.064, [[0.000, 0.096], [0.028, 0.086], [0.048, 0.061], [0.059, 0.031], [0.072, -0.001], [0.067, -0.029], [0.055, -0.056], [0.033, -0.075], [0.000, -0.088]]],
  // あご先
  [-0.088, [[0.000, 0.091], [0.019, 0.082], [0.033, 0.066], [0.041, 0.041], [0.050, 0.009], [0.046, -0.015], [0.038, -0.037], [0.023, -0.053], [0.000, -0.064]]],
  // あごの底面
  [-0.101, [[0.000, 0.047], [0.013, 0.036], [0.022, 0.025], [0.026, 0.011], [0.032, -0.003], [0.030, -0.017], [0.025, -0.030], [0.015, -0.040], [0.000, -0.047]]],
];

const CROWN  = [0,  0.190, -0.038];   // 頭頂
const BOTTOM = [0, -0.106, -0.004];   // 首へつながる底

// 鼻（顔から前へ出るので別の立体で持つ）
const NOSE = {
  root: [0,  0.058, 0.093], mid: [0,  0.030, 0.109],
  ball: [0,  0.012, 0.120], tip: [0,  0.000, 0.127], base: [0, -0.020, 0.103],
  sRoot: [0.012,  0.056, 0.086], sMid: [0.017,  0.028, 0.096],
  sBall: [0.025,  0.008, 0.103], sWing: [0.031, -0.007, 0.101], sBase: [0.020, -0.019, 0.099],
};

function ringLoop(pts) {
  // 片側 9 列を左右にひらいて、前→左→後ろ→右→前 の 16 列にする
  const loop = pts.map(([x, z]) => [x, z]);
  for (let i = 7; i >= 1; i--) loop.push([-pts[i][0], pts[i][1]]);
  return loop;                                    // 16 列
}

function buildShell() {
  const rings = RINGS.map(([y, pts]) => ringLoop(pts).map(([x, z]) => [x, y, z]));
  const tri = [];
  const seg = [];                       // 稜線（四角形の辺）をそのまま持つ
  const push = (a, b, c) => { tri.push(a, b, c); };
  const N = 16;
  for (let r = 0; r < rings.length - 1; r++) {
    const up = rings[r], dn = rings[r + 1];
    for (let j = 0; j < N; j++) {
      const k = (j + 1) % N;
      push(up[j], dn[j], dn[k]);
      push(up[j], dn[k], up[k]);
      seg.push(up[j], up[k]);           // 横の輪
      seg.push(up[j], dn[j]);           // 縦の筋
    }
  }
  const top = rings[0], bot = rings[rings.length - 1];
  for (let j = 0; j < N; j++) {
    const k = (j + 1) % N;
    push(CROWN, top[j], top[k]);
    push(BOTTOM, bot[k], bot[j]);
    seg.push(CROWN, top[j]);
    seg.push(bot[j], bot[(j + 1) % N]);
    seg.push(BOTTOM, bot[j]);
  }
  return { tri, seg };
}

function buildNose() {
  const n = NOSE;
  const tri = [];
  for (const s of [1, -1]) {
    const M = p => [p[0] * s, p[1], p[2]];
    const A = n.root, B = n.mid, C = n.ball, D = n.tip, E = n.base;
    const a = M(n.sRoot), b = M(n.sMid), c = M(n.sBall), d = M(n.sWing), e = M(n.sBase);
    const q = (p0, p1, p2) => { if (s > 0) tri.push(p0, p1, p2); else tri.push(p0, p2, p1); };
    q(A, B, b); q(A, b, a);            // 鼻根から鼻梁の上面
    q(B, C, c); q(B, c, b);            // 鼻梁の下～小鼻の上
    q(C, D, d); q(C, d, c);            // 鼻先
    q(D, E, e); q(D, e, d);            // 鼻の下の面
    q(c, d, e); q(c, e, b);            // 小鼻の側面
    q(a, b, e); q(a, e, E); q(a, E, A); // 顔につながる面（内側をふさぐ）
  }
  return tri;
}

// 耳：耳輪から耳たぶまでの輪郭を持つ薄い立体。
// 高さは眉（y=+0.072）から小鼻の下（y=-0.017）まで、という描画の目安に合わせる。
const EAR = {
  // [z, y] の輪郭。前（+z）から時計回りに一周する。
  outline: [[ 0.002, 0.072], [ 0.018, 0.050], [ 0.020, 0.012], [ 0.010,-0.010],
            [-0.005,-0.019], [-0.020,-0.006], [-0.029, 0.024], [-0.026, 0.056], [-0.013, 0.070]],
  x: 0.095, thick: 0.010, z: -0.030, flare: 0.006,
};

function buildEar(sx) {
  const o = EAR.outline;
  const n = o.length;
  const cz = o.reduce((a, q) => a + q[0], 0) / n;
  const cy = o.reduce((a, q) => a + q[1], 0) / n;
  // 前は頭に沿わせ、後ろほど外へ開く
  const zs = EAR.outline.map(q => q[0]);
  const zc0 = (Math.min(...zs) + Math.max(...zs)) / 2;
  const zr = Math.max(1e-6, (Math.max(...zs) - Math.min(...zs)) / 2);
  const P = (z, y, out) => [
    sx * (EAR.x + EAR.flare * (zc0 - z) / zr + (out ? EAR.thick : -EAR.thick) * 0.5),
    y + 0.002, EAR.z + z];
  const C = out => P(cz, cy, out);
  const tri = [];
  const q = (a, b, c) => { if (sx > 0) tri.push(a, b, c); else tri.push(a, c, b); };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ai = P(o[i][0], o[i][1], true), aj = P(o[j][0], o[j][1], true);
    const bi = P(o[i][0], o[i][1], false), bj = P(o[j][0], o[j][1], false);
    q(C(true), ai, aj);        // 外側の面
    q(C(false), bj, bi);       // 内側の面
    q(ai, bi, bj);             // 縁
    q(ai, bj, aj);
  }
  return tri;
}

// 目：眼窩に収まる、ゆるく膨らんだ板。球だと飛び出して見えるのでこの形にする。
const EYE = {
  c: [0.040, 0.041, 0.064],
  ring: [[0.021, 0.041, 0.071], [0.032, 0.055, 0.063], [0.053, 0.054, 0.052],
         [0.064, 0.040, 0.045], [0.052, 0.028, 0.055], [0.032, 0.028, 0.068]],
};

function buildEye(sx) {
  const M = p => [sx * p[0], p[1], p[2]];
  const c = M(EYE.c);
  const r = EYE.ring.map(M);
  const tri = [];
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    if (sx > 0) tri.push(c, r[j], r[i]); else tri.push(c, r[i], r[j]);
  }
  return tri;
}

// 口もと：上下の唇を、真ん中の合わせ目で折れる二枚の面にする
const LIPS = {
  top: [0, -0.029, 0.100], bottom: [0, -0.054, 0.099],
  line: [[0, -0.042, 0.102], [0.014, -0.042, 0.099], [0.026, -0.042, 0.089], [0.034, -0.041, 0.077]],
  up:   [[0, -0.029, 0.100], [0.013, -0.031, 0.098], [0.024, -0.035, 0.089], [0.032, -0.038, 0.078]],
  low:  [[0, -0.054, 0.099], [0.013, -0.053, 0.097], [0.024, -0.049, 0.088], [0.032, -0.044, 0.077]],
};

function buildLips() {
  const tri = [];
  for (const sx of [1, -1]) {
    const M = p => [sx * p[0], p[1], p[2]];
    const q = (a, b, c) => { if (sx > 0) tri.push(a, b, c); else tri.push(a, c, b); };
    const L = LIPS.line.map(M), U = LIPS.up.map(M), D = LIPS.low.map(M);
    for (let i = 0; i < L.length - 1; i++) {
      q(U[i], L[i], L[i + 1]); q(U[i], L[i + 1], U[i + 1]);      // 上唇
      q(L[i], D[i], D[i + 1]); q(L[i], D[i + 1], L[i + 1]);      // 下唇
    }
  }
  return tri;
}

function toLineGeometry(seg) {
  const arr = new Float32Array(seg.length * 3);
  for (let i = 0; i < seg.length; i++) {
    arr[i * 3] = seg[i][0]; arr[i * 3 + 1] = seg[i][1]; arr[i * 3 + 2] = seg[i][2];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  return g;
}

function toGeometry(tri) {
  const arr = new Float32Array(tri.length * 3);
  for (let i = 0; i < tri.length; i++) {
    arr[i * 3] = tri[i][0]; arr[i * 3 + 1] = tri[i][1]; arr[i * 3 + 2] = tri[i][2];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  g.computeVertexNormals();
  return g;
}

function materials() {
  return {
    skin: new THREE.MeshStandardMaterial({
      color: 0xd9d2c6, roughness: 0.74, metalness: 0, flatShading: true,
    }),
    eye: new THREE.MeshStandardMaterial({
      color: 0xe2dccf, roughness: 0.5, metalness: 0, flatShading: true,
    }),
    line: new THREE.LineBasicMaterial({ color: 0x14171c, transparent: true, opacity: 0.8 }),
  };
}

/**
 * 面で捉えた頭部を組み立てて、頭のボーンにぶら下げる。
 * @param {THREE.Bone} headBone  頭のボーン（縮尺を測るのに使う）
 * @param {THREE.Object3D} parent  ぶら下げる先（頭のボーンの子のグループ）
 * @returns {{parts: THREE.Mesh[], lines: THREE.LineSegments[]}}
 */
export const DESIGN_CROWN  = 0.190;   // この形での「頭のボーン→頭頂」の高さ（m）
export const DESIGN_BOTTOM = -0.106;  // あごの底
export const DESIGN_HALF   = 0.100;   // 頭蓋のいちばん広い半幅（耳は含まない）
export const DESIGN_DEPTH  = 0.281;   // 後頭部から鼻先まで
export const DESIGN_CHIN   = -0.092;  // あご先（ここから下は首にかかる）
export const DESIGN_ZC     = -0.014;  // 前後方向の中心

/**
 * 元の頭を「あごから上の楕円体」とみなし、殻の内側に収まる最大の縮小率を二分法で解く。
 * 殻の点がひとつでも頭の中に入っていたら、その頭は殻からはみ出している。
 * @param {Array} pts    殻の頂点（design 単位）
 * @param {Object} box   実測した頭（頭のボーン基準・メートル）
 * @param {number} sy    縦の倍率
 * @param {number} sxz   横・奥行の倍率
 */
function solveHide(pts, box, sy, sxz) {
  const a = Math.max(1e-5, box.half);
  const b = Math.max(1e-5, (box.top - box.chin) / 2);
  const c = Math.max(1e-5, box.depth / 2);
  const cy = (box.top + box.chin) / 2;
  const cz = box.zc || 0;
  const lift = box.top - DESIGN_CROWN * sy;
  const shiftZ = cz - DESIGN_ZC * sy * sxz;
  const clears = h => {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const dx = (p[0] * sy * sxz) / (a * h);
      const dy = (p[1] * sy + lift - cy * h) / (b * h);
      const dz = (p[2] * sy * sxz + shiftZ - cz * h) / (c * h);
      if (dx * dx + dy * dy + dz * dz < 1.05) return false;   // 殻の点が頭の中＝はみ出す
    }
    return true;
  };
  if (clears(0.97)) return 0.97;
  let lo = 0.45, hi = 0.97;
  for (let i = 0; i < 22; i++) {
    const m = (lo + hi) / 2;
    if (clears(m)) lo = m; else hi = m;
  }
  return lo;
}

export function buildHeadPlanes(headBone, parent, opts = {}) {
  if (!headBone || !parent) return { parts: [], lines: [] };
  const mats = materials();
  const parts = [];
  const lines = [];

  // 骨の縮尺に合わせて、メートル指定をローカル単位へ直す
  const s = headBone.getWorldScale(new THREE.Vector3()).x || 1;

  // モデルの頭の実寸に合わせる。
  // 実測できなかったときは、頭頂と首のボーンから箱を組み立てて、同じ当てはめ方に乗せる。
  let box = opts.box;
  if (!box && opts.crownH > 1e-4) {
    const top = opts.crownH;
    const chin = opts.neckRel < 0 ? Math.max(opts.neckRel, -top * 1.2) : -top * 0.5;
    box = { top, bottom: chin, chin, headH: top - chin,
            half: (top - chin) * 0.36, depth: (top - chin) * 0.95, zc: -(top - chin) * 0.05 };
  }

  const shell = buildShell();
  let sy = 1, sxz = 1, lift = 0, shiftZ = 0, hide = 0.9;
  if (box && box.headH > 1e-4) {
    // 縦は「あご〜頭頂」をぴったり合わせる。これで首を覆わず、頭頂もずれない。
    sy = box.headH / (DESIGN_CROWN - DESIGN_CHIN);

    // 横と奥行は、元の頭がちゃんと殻の内側へ入るところまで広げる。
    // 眼窩は殻の内側へ深くへこんでいるので、ここを決め打ちにすると
    // 元の頭が眼窩を突き抜けて、殻がまるごと隠れてしまう。
    for (const k of [1.0, 1.1, 1.22, 1.36, 1.5]) {
      sxz = k;
      hide = solveHide(shell.tri, box, sy, k);
      if (hide >= 0.88) break;
    }
    lift = box.top - DESIGN_CROWN * sy;
    shiftZ = (box.zc || 0) - DESIGN_ZC * sy * sxz;
  }
  const ux = sy * sxz / s, uy = sy / s, uz = sy * sxz / s;

  // 骨の「前・上・横」をローカル座標で知る
  const o = headBone.getWorldPosition(new THREE.Vector3());
  const dirOf = (x, y, z) =>
    headBone.worldToLocal(o.clone().add(new THREE.Vector3(x, y, z))).normalize();
  const up = dirOf(0, 1, 0);
  const fwd = dirOf(0, 0, 1);
  const side = new THREE.Vector3().crossVectors(up, fwd).normalize();
  const quat = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(side, up, fwd));

  const add = (geo, material, pos, lineGeo) => {
    const m = new THREE.Mesh(geo, material);
    m.quaternion.copy(quat);
    m.scale.set(ux, uy, uz);
    m.position.copy(up).multiplyScalar(lift / s).addScaledVector(fwd, shiftZ / s);
    if (pos) {
      m.position.addScaledVector(side, pos[0] * ux)
        .addScaledVector(up, pos[1] * uy)
        .addScaledVector(fwd, pos[2] * uz);
    }
    m.castShadow = true;
    m.receiveShadow = true;
    m.visible = false;
    m.userData.headPlane = true;
    parent.add(m);
    parts.push(m);

    const edges = new THREE.LineSegments(lineGeo || new THREE.EdgesGeometry(geo, 24), mats.line);
    edges.quaternion.copy(m.quaternion);
    edges.scale.copy(m.scale);
    edges.position.copy(m.position);
    edges.visible = false;
    edges.renderOrder = 6;
    edges.userData.headPlaneLine = true;
    parent.add(edges);
    lines.push(edges);
    return m;
  };

  add(toGeometry(shell.tri), mats.skin, null, toLineGeometry(shell.seg));  // 頭の塊
  add(toGeometry(buildNose()), mats.skin);         // 鼻
  add(toGeometry(buildLips()), mats.skin);         // 口もと
  for (const sx of [-1, 1]) add(toGeometry(buildEye(sx)), mats.eye);   // 目（眼窩に収まる板）
  for (const sx of [-1, 1]) add(toGeometry(buildEar(sx)), mats.skin);  // 耳

  return { parts, lines, hide, sy, sxz };
}
