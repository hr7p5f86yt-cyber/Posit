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
  // y,        0 前中心         1 前寄り         2 前外側         3 目尻・こめかみ  4 真横            5 後ろ外側        6 後ろ斜め        7 後ろ寄り        8 後中心
  [ 0.178, [[0, 0.056], [0.026, 0.051], [0.044, 0.035], [0.056, 0.008], [0.060,-0.026], [0.051,-0.058], [0.034,-0.083], [0.015,-0.097], [0,-0.101]]],
  [ 0.152, [[0, 0.068], [0.031, 0.062], [0.053, 0.043], [0.068, 0.010], [0.072,-0.030], [0.061,-0.066], [0.041,-0.094], [0.018,-0.110], [0,-0.115]]],
  [ 0.124, [[0, 0.077], [0.038, 0.071], [0.065, 0.050], [0.082, 0.013], [0.089,-0.033], [0.076,-0.072], [0.051,-0.102], [0.022,-0.120], [0,-0.125]]],
  // 額
  [ 0.100, [[0, 0.080], [0.040, 0.076], [0.068, 0.055], [0.086, 0.016], [0.093,-0.034], [0.079,-0.074], [0.053,-0.105], [0.023,-0.123], [0,-0.128]]],
  // 眉の張り出し（ここが前へ出て、下の眼窩に影をつくる）
  [ 0.072, [[0, 0.082], [0.034, 0.080], [0.060, 0.072], [0.082, 0.046], [0.092,-0.028], [0.079,-0.066], [0.053,-0.100], [0.023,-0.120], [0,-0.126]]],
  // 上まぶた（眼窩の天井。眉より 2cm 引っ込む）
  [ 0.058, [[0, 0.079], [0.026, 0.060], [0.054, 0.056], [0.080, 0.045], [0.092,-0.018], [0.080,-0.062], [0.053,-0.097], [0.023,-0.118], [0,-0.124]]],
  // 目の高さ（頭の上下の中央／頬骨弓がいちばん横に出る）
  [ 0.040, [[0, 0.078], [0.023, 0.052], [0.052, 0.050], [0.080, 0.046], [0.094,-0.014], [0.081,-0.060], [0.054,-0.095], [0.023,-0.116], [0,-0.122]]],
  // 下まぶた（ここから頬骨へ面が起きる）
  [ 0.022, [[0, 0.081], [0.027, 0.062], [0.056, 0.058], [0.081, 0.052], [0.093,-0.006], [0.080,-0.058], [0.053,-0.093], [0.023,-0.113], [0,-0.119]]],
  // 頬骨の突出
  [ 0.002, [[0, 0.086], [0.030, 0.082], [0.059, 0.072], [0.082, 0.058], [0.092,-0.002], [0.079,-0.056], [0.052,-0.090], [0.022,-0.110], [0,-0.116]]],
  // 小鼻の下（ここから頬が後ろへ落ちる）
  [-0.017, [[0, 0.086], [0.031, 0.082], [0.057, 0.068], [0.076, 0.052], [0.086,-0.002], [0.074,-0.056], [0.049,-0.089], [0.021,-0.108], [0,-0.113]]],
  // 口（口もとが円筒状に前へ出る）
  [-0.041, [[0, 0.090], [0.028, 0.084], [0.049, 0.064], [0.066, 0.040], [0.078,-0.010], [0.068,-0.056], [0.045,-0.087], [0.019,-0.104], [0,-0.109]]],
  // あごの上・エラ（下顎角）
  [-0.064, [[0, 0.088], [0.029, 0.082], [0.047, 0.060], [0.061, 0.032], [0.066,-0.020], [0.058,-0.058], [0.039,-0.084], [0.017,-0.099], [0,-0.103]]],
  // あご先
  [-0.088, [[0, 0.080], [0.026, 0.074], [0.041, 0.055], [0.051, 0.026], [0.048,-0.022], [0.043,-0.052], [0.029,-0.074], [0.013,-0.087], [0,-0.090]]],
  // あごの底面
  [-0.101, [[0, 0.058], [0.013, 0.054], [0.022, 0.040], [0.030, 0.018], [0.034,-0.016], [0.030,-0.040], [0.021,-0.058], [0.009,-0.068], [0,-0.071]]],
];

const CROWN  = [0,  0.190, -0.024];   // 頭頂
const BOTTOM = [0, -0.104, -0.030];   // 首へつながる底

// 鼻（顔から前へ出るので別の立体で持つ）
const NOSE = {
  root: [0,  0.058, 0.068], mid: [0,  0.022, 0.082],
  ball: [0, -0.002, 0.096], tip: [0, -0.014, 0.106], base: [0, -0.026, 0.088],
  sRoot: [0.011,  0.056, 0.064], sMid: [0.016,  0.020, 0.074],
  sBall: [0.024, -0.004, 0.084], sWing: [0.030, -0.017, 0.082], sBase: [0.019, -0.026, 0.082],
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
  const push = (a, b, c) => { tri.push(a, b, c); };
  const N = 16;
  for (let r = 0; r < rings.length - 1; r++) {
    const up = rings[r], dn = rings[r + 1];
    for (let j = 0; j < N; j++) {
      const k = (j + 1) % N;
      push(up[j], dn[j], dn[k]);
      push(up[j], dn[k], up[k]);
    }
  }
  const top = rings[0], bot = rings[rings.length - 1];
  for (let j = 0; j < N; j++) {
    const k = (j + 1) % N;
    push(CROWN, top[j], top[k]);
    push(BOTTOM, bot[k], bot[j]);
  }
  return tri;
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
  outline: [[ 0.002, 0.068], [ 0.016, 0.048], [ 0.018, 0.012], [ 0.009,-0.008],
            [-0.004,-0.017], [-0.018,-0.006], [-0.026, 0.022], [-0.024, 0.052], [-0.012, 0.066]],
  x: 0.082, thick: 0.010, z: -0.028,
};

function buildEar(sx) {
  const o = EAR.outline;
  const n = o.length;
  const cz = o.reduce((a, q) => a + q[0], 0) / n;
  const cy = o.reduce((a, q) => a + q[1], 0) / n;
  const P = (z, y, out) => [sx * (EAR.x + (out ? EAR.thick : -EAR.thick) * 0.5), y, EAR.z + z];
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
      color: 0xf0ece4, roughness: 0.3, metalness: 0, flatShading: true,
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
export function buildHeadPlanes(headBone, parent) {
  if (!headBone || !parent) return { parts: [], lines: [] };
  const mats = materials();
  const parts = [];
  const lines = [];

  // 骨の縮尺に合わせて、メートル指定をローカル単位へ直す
  const s = headBone.getWorldScale(new THREE.Vector3()).x || 1;
  const u = 1 / s;

  // 骨の「前・上・横」をローカル座標で知る
  const o = headBone.getWorldPosition(new THREE.Vector3());
  const dirOf = (x, y, z) =>
    headBone.worldToLocal(o.clone().add(new THREE.Vector3(x, y, z))).normalize();
  const up = dirOf(0, 1, 0);
  const fwd = dirOf(0, 0, 1);
  const side = new THREE.Vector3().crossVectors(up, fwd).normalize();
  const quat = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(side, up, fwd));

  const add = (geo, material, pos) => {
    const m = new THREE.Mesh(geo, material);
    m.quaternion.copy(quat);
    m.scale.setScalar(u);
    if (pos) {
      m.position.copy(side).multiplyScalar(pos[0] * u)
        .addScaledVector(up, pos[1] * u)
        .addScaledVector(fwd, pos[2] * u);
    }
    m.castShadow = true;
    m.receiveShadow = true;
    m.visible = false;
    m.userData.headPlane = true;
    parent.add(m);
    parts.push(m);

    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 16), mats.line);
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

  add(toGeometry(buildShell()), mats.skin);        // 頭の塊（眉・眼窩・頬骨・あご）
  add(toGeometry(buildNose()), mats.skin);         // 鼻

  // 眼球（眼窩のくぼみに収まる）
  const eye = new THREE.IcosahedronGeometry(0.0145, 1);
  for (const sx of [-1, 1]) add(eye, mats.eye, [sx * 0.037, 0.041, 0.050]);

  // 耳（輪郭を持つ薄い立体。頭の側面に食い込ませて置く）
  for (const sx of [-1, 1]) {
    const m = add(toGeometry(buildEar(sx)), mats.skin);
    lines[lines.length - 1].geometry = new THREE.EdgesGeometry(m.geometry, 16);
  }

  return { parts, lines };
}
