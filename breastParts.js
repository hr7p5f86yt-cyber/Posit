// breastParts.js — 女性の乳房を、胸に付ける別の部品として作る
//
// サンプル素体（X Bot）は、胸の殻・お腹の玉・関節の玉といった部品の組み合わせでできている。
// 胸の殻そのものを押し出して乳房を作ると、
//   ・殻の頂点がまばら（間隔 2.5cm）で、丸いふくらみを表せない（断面が三角になる）
//   ・殻のふちが V 字に巻き込んでいて、ふくらみがふちで折れる・とがる
//   ・殻の横が平らな壁なので、上下から見ると横が壁になる
// といった無理が出る。そこで乳房は、細かい網目の別部品として作り、殻の上にのせる。
//
// 形（解剖学に合わせる）
//   土台 … 胸壁の上。上は第2肋骨、下は第6肋骨（乳房下溝）、内側は胸骨のふち、外側は前腋窩線。
//          上外側は脇の下へ少し伸びる（スペンス腋窩尾部）
//   乳頭 … 第4肋間・鎖骨中線（正中から胸の半幅の約半分）。土台の中心より少し下
//   横から … 上極は鎖骨の下からほぼまっすぐな斜面、下極は丸く張り、乳頭で滑らかにつながる
//   上から … 丸い弧。胸のかごが丸いので、外へ 15° ほど向く
//
// 作り方
//   1. 胸の殻の表面を、前から真っすぐ当てて測る（土台の各点で、殻のいちばん前の面の高さ）
//   2. その面から、胸の丸みに沿った向きへ、乳房の厚みだけ持ち上げる
//   3. 縁は殻の面の少し内側に沈めて、継ぎ目を見せない
//   4. スキンの重みは、真下にある殻の三角形の重みを写す（ポーズを付けると殻と一緒に動く・曲がる）
import * as THREE from 'three';

/** 形の数値。幅は胸の半幅に対する割合、高さ・張り出しは背丈 1.70m 換算の長さに対する割合 */
export const BREAST = {
  proj: 0.052,     // 前への張り出し
  nip: 0.5,        // 乳頭の位置（正中から、胸の半幅に対する割合）
  inner: 0.47,     // 土台の内側への広がり（胸の半幅に対する割合）。内側の縁は胸骨のふち（正中から 1cm 足らず）
  outer: 0.31,     // 土台の外側への広がり（胸の前の面の中に収める。横の面へ回すと、斜めに当たって浮く）
  up: 0.115,       // 土台の上への広がり（第2肋骨まで）
  down: 0.072,     // 土台の下への広がり（乳房下溝まで）
  tilt: 0.18,      // 土台を脇の下へ傾ける角度（ラジアン）
  out: 0.27,       // 外へ向く量（tan 15°）
  embed: 0.0025,   // 縁を殻の面から沈める量
};

const smooth = t => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
const soft = (t, c) => 1 - (Math.sqrt(t * t + c * c) - c) / (Math.sqrt(1 + c * c) - c);

/** スキンをかけたあとのワールド位置（頂点ごと、モーフ込み） */
function skinnedWorld(m) {
  const pos = m.geometry.attributes.position, N = pos.count;
  const out = new Float32Array(N * 3);
  const v = new THREE.Vector3();
  m.updateWorldMatrix(true, false);
  m.skeleton.update();
  for (let i = 0; i < N; i++) {
    m.getVertexPosition(i, v);
    v.applyMatrix4(m.matrixWorld);
    out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
  }
  return out;
}

/** 胸の殻の表面を、前から測るための道具（xy の升目で三角形を引けるようにする） */
function makeSurface(W, idx, pick) {
  const CELL = 0.01;
  const cells = new Map();
  const tris = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    if (!pick(a, b, c)) continue;
    // 前を向いた面だけ（殻の内張りは除く）
    const ax = W[a * 3], ay = W[a * 3 + 1], az = W[a * 3 + 2];
    const bx = W[b * 3], by = W[b * 3 + 1], bz = W[b * 3 + 2];
    const cx = W[c * 3], cy = W[c * 3 + 1], cz = W[c * 3 + 2];
    // 前を向いている三角形だけ（下を向いたふちの裏・横の面は、乳房の土台にしない）
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz);
    if (nl < 1e-12 || Math.abs(nz) / nl < 0.12) continue;
    const ti = tris.length;
    tris.push([a, b, c]);
    const x0 = Math.floor(Math.min(ax, bx, cx) / CELL), x1 = Math.floor(Math.max(ax, bx, cx) / CELL);
    const y0 = Math.floor(Math.min(ay, by, cy) / CELL), y1 = Math.floor(Math.max(ay, by, cy) / CELL);
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
      const k = i * 100003 + j;
      let list = cells.get(k);
      if (!list) { list = []; cells.set(k, list); }
      list.push(ti);
    }
  }
  /** (x, y) で、いちばん前にある面の高さ z と、その三角形・重心座標 */
  return (x, y) => {
    const list = cells.get(Math.floor(x / CELL) * 100003 + Math.floor(y / CELL));
    if (!list) return null;
    let best = null;
    for (const ti of list) {
      const [a, b, c] = tris[ti];
      const ax = W[a * 3], ay = W[a * 3 + 1], bx = W[b * 3], by = W[b * 3 + 1], cx = W[c * 3], cy = W[c * 3 + 1];
      const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(d) < 1e-14) continue;
      const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d;
      const l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const z = l1 * W[a * 3 + 2] + l2 * W[b * 3 + 2] + l3 * W[c * 3 + 2];
      if (!best || z > best.z) best = { z, tri: [a, b, c], bary: [l1, l2, l3] };
    }
    return best;
  };
}

/**
 * 乳房の部品を作って、胸の殻と同じ親に付ける。
 * 呼ぶ前に骨を基準姿勢（ポーズなし・倍率 1）にしておくこと。
 * @returns {{parts: THREE.SkinnedMesh[], wires: THREE.SkinnedMesh[], shell: THREE.SkinnedMesh} | null}
 */
export function buildBreastParts(slot, opts = {}) {
  const lm = slot.bodyLandmarks;
  const map = slot.boneMap;
  if (!lm || !map || !map.hips) return null;
  const { s, cx, yBreast, zc } = lm;
  const meshes = (slot.meshes || []).filter(m => m.isSkinnedMesh && m.skeleton && m.geometry
    && m.geometry.index && m.geometry.attributes.skinIndex && !m.userData.headPlane);
  if (!meshes.length) return null;

  // 胸の殻: 乳頭の高さで、正中の近くがいちばん前に出ているメッシュ
  const females = new Map();
  for (const m of meshes) {
    if (m.morphTargetInfluences && m.geometry.userData.bodyMorph) {
      females.set(m, m.morphTargetInfluences.slice());
      m.morphTargetInfluences[0] = 0; m.morphTargetInfluences[1] = 1;   // 女性の体つきの上に作る
    }
  }
  let shell = null, W = null, best = -Infinity;
  try {
    for (const m of meshes) {
      const Wm = skinnedWorld(m), Nm = m.geometry.attributes.position.count;
      for (let i = 0; i < Nm; i++) {
        if (Math.abs(Wm[i * 3 + 1] - yBreast) > 0.02 * s || Math.abs(Wm[i * 3] - cx) > 0.06 * s) continue;
        if (Wm[i * 3 + 2] > best) { best = Wm[i * 3 + 2]; shell = m; W = Wm; }
      }
    }
  } finally {
    for (const [m, inf] of females) m.morphTargetInfluences.splice(0, inf.length, ...inf);
  }
  if (!shell) return null;
  const g = shell.geometry, idx = g.index.array, N = g.attributes.position.count;
  const SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
  const bones = shell.skeleton.bones;

  // 胸の半幅（乳頭の高さで、胸の前半分の頂点の 9 割の位置）と、前への厚み
  let A = 0.12 * s, F = 0.12 * s;
  {
    const xs = [];
    let az = 0;
    for (let i = 0; i < N; i++) {
      const y = W[i * 3 + 1];
      if (Math.abs(y - (yBreast - 0.01 * s)) > 0.012 * s) continue;
      if (W[i * 3 + 2] < zc + 0.03 * s || Math.abs(W[i * 3] - cx) > 0.2 * s) continue;
      xs.push(Math.abs(W[i * 3] - cx));
      az = Math.max(az, W[i * 3 + 2] - zc);
    }
    xs.sort((p, q) => p - q);
    if (xs.length > 8) A = Math.max(0.06 * s, xs[Math.floor(xs.length * 0.9)]);
    if (az > 0.04 * s) F = az;
  }

  // 胴に引っ張られる頂点か（腕の面を拾わないように）
  const arm = new Set();
  for (const k of ['upperArmL', 'upperArmR', 'shoulderL', 'shoulderR', 'head']) {
    const b0 = map[k];
    if (!b0) continue;
    (function walk(b) { if (k.startsWith('shoulder') && b === b0) { /* 鎖骨は胴に含める */ } else arm.add(b); for (const c of b.children) if (c.isBone) walk(c); })(b0);
  }
  const trunk = vi => {
    let wt = 0;
    for (let q = 0; q < 4; q++) {
      const w = SW.getComponent(vi, q);
      if (w > 0 && !arm.has(bones[SI.getComponent(vi, q)])) wt += w;
    }
    return wt > 0.6;
  };
  const surf = makeSurface(W, idx, (a, b, c) => {
    for (const v of [a, b, c]) {
      if (!trunk(v)) return false;
      const y = W[v * 3 + 1];
      if (y < yBreast - 0.16 * s || y > yBreast + 0.22 * s) return false;
      if (W[v * 3 + 2] < zc - 0.02 * s || Math.abs(W[v * 3] - cx) > 0.22 * s) return false;
    }
    return true;
  });
  const wallN = (x, z) => {
    const v = new THREE.Vector3((x - cx) / (A * A), 0, Math.max(0, z - zc) / (F * F));
    return v.lengthSq() > 1e-12 ? v.normalize() : new THREE.Vector3(0, 0, 1);
  };

  const wireMat = opts.wireMaterial || null;
  const parts = [], wires = [];
  const NR = 32, NA = 72;
  for (const sx of [1, -1]) {
    const bx = cx + sx * BREAST.nip * A;
    const by = yBreast + 0.004 * s;
    const rIn = BREAST.inner * A, rOut = BREAST.outer * A, rUp = BREAST.up * s, rDn = BREAST.down * s;
    const tc = Math.cos(BREAST.tilt), ts = Math.sin(BREAST.tilt);
    const axis = new THREE.Vector3(sx * BREAST.out, 0, 1).normalize();

    // 土台の外形（向き a・中心からの割合 rho）→ 胸の上の位置
    const foot = (a, rho) => {
        const ph = (a / NA) * Math.PI * 2;
        const c = Math.cos(ph), sn = Math.sin(ph);
        // 向きによって広がりを滑らかに変える（内↔外、下↔上）
        const mx = smooth(c * 0.5 + 0.5), my = smooth(sn * 0.5 + 0.5);
        const ex = c * (rIn + (rOut - rIn) * mx) * rho;
        const ey = sn * (rDn + (rUp - rDn) * my) * rho;
        // 脇の下へ傾ける（ex: 外が +、ey: 上が +）
        const dx = ex * tc - ey * ts, dy = ex * ts + ey * tc;
        return { x: bx + sx * dx, y: by + dy, c, sn };
    };
    const lim = new Float32Array(NA).fill(1);
    // 土台の点（輪 r・向き a）と、その真下の殻の面
    const ring = [];          // ring[r][a] = { x, y, hit, u, v, rho }
    for (let r = 0; r <= NR; r++) {
      const row = [];
      for (let a = 0; a < (r === 0 ? 1 : NA); a++) {
        const rho = (r / NR) * lim[a];
        const f = foot(a, rho);
        // 形は止めた外形に合わせて伸ばす（縁で厚みが 0 になるように）
        const t = r / NR;
        row.push({ x: f.x, y: f.y, u: f.c * t, v: f.sn * t, rho: t, hit: surf(f.x, f.y) });
      }
      ring.push(row);
    }
    // 測れなかった点（前を向いた面が無いところ）は、ひとつ内側の輪の値を使い、印を付ける
    for (let r = 1; r <= NR; r++) {
      for (let a = 0; a < NA; a++) {
        if (!ring[r][a].hit) {
          const prev = r === 1 ? ring[0][0] : ring[r - 1][a];
          // 殻のふちを越えた先: 内側へ巻き込んで、殻のふちの裏へ隠す
          ring[r][a].hit = { ...prev.hit, z: prev.hit.z - 0.008 * s };
          ring[r][a].miss = true;
        }
      }
    }
    if (!ring[0][0].hit) continue;
    // 殻の面は平らな三角形の集まりなので、そのままだと乳房の面に折れ目が写る。
    // 内側は面の高さをならし、縁だけ殻にぴったり合わせる
    const zs = ring.map(row => row.map(p => p.hit.z));
    for (let it = 0; it < 30; it++) {
      const nx = zs.map(row => row.slice());
      for (let r = 1; r <= NR; r++) {
        for (let a = 0; a < NA; a++) {
          const inner = r === 1 ? zs[0][0] : zs[r - 1][a];
          const outer = r === NR ? zs[r][a] : zs[r + 1][a];
          nx[r][a] = (zs[r][a] * 2 + inner + outer + zs[r][(a + 1) % NA] + zs[r][(a + NA - 1) % NA]) / 6;
        }
      }
      let sum = 0;
      for (let a = 0; a < NA; a++) sum += zs[1][a];
      nx[0][0] = (zs[0][0] + sum / NA) / 2;
      for (let r = 0; r < NR; r++) for (let a = 0; a < nx[r].length; a++) zs[r][a] = nx[r][a];
    }

    // 頂点を作る（ワールド座標）
    const verts = [], skin = [];
    const vid = [];
    for (let r = 0; r <= NR; r++) {
      vid.push([]);
      for (let a = 0; a < ring[r].length; a++) {
        const p = ring[r][a];
        const raw = p.hit.z;
        // 土台はならした面（殻の三角形の折れ目や、ふちの段差を写さない）。
        // ならすと凸な面は少し内へ下がるので、縁は殻の下に沈んで継ぎ目が見えない
        const z0 = p.miss ? raw : Math.min(zs[r][a], raw + 0.004 * s);
        // 厚み: 左右は丸い弧、上はまっすぐ寄りの斜面、下は丸く張る。どれも頂で傾き 0
        const uu = Math.min(1, Math.abs(p.u)), vv = Math.min(1, Math.abs(p.v));
        const myv = smooth(p.v / 0.9 * 0.5 + 0.5);
        const hu = soft(uu, 0.75);
        const gUp = soft(vv, 0.35);
        const gLo = Math.pow(Math.max(0, 1 - vv * vv), 0.7);
        const prof = hu * (gLo + (gUp - gLo) * myv);
        // 上の縁はなだらかに、下の縁（乳房下溝）は短く。内側の縁も短く立ち上げる
        // （内側は胸骨のふちから急にふくらむので、なだらかにすると左右のあいだが広く空いて見える）
        const med = smooth(-p.u / 0.8);
        const taper = smooth((1 - p.rho) / (0.22 + 0.25 * myv - 0.09 * med));
        const h = BREAST.proj * s * prof * taper;
        // 向き: 頂は乳房の軸、縁ほど胸のかごの面の向き
        const n = wallN(p.x, z0).lerp(axis, 0.8 * (1 - p.rho * p.rho)).normalize();
        // 縁へいくほど深く沈める（縁で 1cm）。殻の面のでこぼこが乳房の縁から透けないように
        const sink = (BREAST.embed + 0.008 * Math.pow(p.rho, 4)) * s;
        const P = new THREE.Vector3(p.x, p.y, z0).addScaledVector(n, h - sink);
        vid[r].push(verts.length);
        verts.push(P);
        // スキンの重み: 真下の三角形の 3 頂点の重みを重心座標で混ぜ、大きい順に 4 つ
        const acc = new Map();
        p.hit.tri.forEach((vi, k) => {
          const l = p.hit.bary[k];
          for (let q = 0; q < 4; q++) {
            const w = SW.getComponent(vi, q);
            if (w > 0) acc.set(SI.getComponent(vi, q), (acc.get(SI.getComponent(vi, q)) || 0) + w * l);
          }
        });
        const top = [...acc.entries()].sort((m1, m2) => m2[1] - m1[1]).slice(0, 4);
        const sum = top.reduce((t, e) => t + e[1], 0) || 1;
        skin.push(top.map(e => [e[0], e[1] / sum]));
      }
    }
    // 面（表が外を向くように）
    const index = [];
    const tri = (a, b, c) => index.push(a, b, c);
    for (let a = 0; a < NA; a++) tri(vid[0][0], vid[1][a], vid[1][(a + 1) % NA]);
    for (let r = 1; r < NR; r++) {
      for (let a = 0; a < NA; a++) {
        const a1 = (a + 1) % NA;
        tri(vid[r][a], vid[r + 1][a], vid[r + 1][a1]);
        tri(vid[r][a], vid[r + 1][a1], vid[r][a1]);
      }
    }
    // 向きを確かめる（頂の三角形の面の向きが外向きでなければ裏返す）
    {
      const p0 = verts[index[0]], p1 = verts[index[1]], p2 = verts[index[2]];
      const fn = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p2, p0));
      if (fn.dot(axis) < 0) for (let t = 0; t < index.length; t += 3) { const k = index[t + 1]; index[t + 1] = index[t + 2]; index[t + 2] = k; }
    }
    const NV = verts.length;
    // ワールドでの法線
    const wpos = new Float32Array(NV * 3);
    verts.forEach((P, i) => { wpos[i * 3] = P.x; wpos[i * 3 + 1] = P.y; wpos[i * 3 + 2] = P.z; });
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(wpos, 3));
    wg.setIndex(index);
    wg.computeVertexNormals();
    const wnrm = wg.attributes.normal.array;

    // スキン前の座標に直す: ワールド = matrixWorld · bindMatrixInverse · Σ(w·骨) · bindMatrix
    shell.updateWorldMatrix(true, false);
    shell.skeleton.update();
    const bm = shell.skeleton.boneMatrices;
    const lpos = new Float32Array(NV * 3), lnrm = new Float32Array(NV * 3);
    const sIdx = new Uint16Array(NV * 4), sWgt = new Float32Array(NV * 4);
    const M = new THREE.Matrix4(), B = new THREE.Matrix4(), L = new THREE.Matrix4(), L3 = new THREE.Matrix3();
    const v = new THREE.Vector3();
    for (let i = 0; i < NV; i++) {
      M.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
      skin[i].forEach(([bi, w], k) => {
        sIdx[i * 4 + k] = bi; sWgt[i * 4 + k] = w;
        B.fromArray(bm, bi * 16);
        for (let q = 0; q < 16; q++) M.elements[q] += B.elements[q] * w;
      });
      L.copy(shell.matrixWorld).multiply(shell.bindMatrixInverse).multiply(M).multiply(shell.bindMatrix);
      v.set(wpos[i * 3], wpos[i * 3 + 1], wpos[i * 3 + 2]).applyMatrix4(L.clone().invert());
      lpos[i * 3] = v.x; lpos[i * 3 + 1] = v.y; lpos[i * 3 + 2] = v.z;
      // 法線はワールド→スキン前で L の転置をかける（L はほぼ回転なので）
      L3.setFromMatrix4(L).transpose();
      v.set(wnrm[i * 3], wnrm[i * 3 + 1], wnrm[i * 3 + 2]).applyMatrix3(L3).normalize();
      lnrm[i * 3] = v.x; lnrm[i * 3 + 1] = v.y; lnrm[i * 3 + 2] = v.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(lnrm, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(NV * 2), 2));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(sIdx, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sWgt, 4));
    geo.setIndex(index);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();

    const make = mat => {
      const m = new THREE.SkinnedMesh(geo, mat);
      m.bindMode = shell.bindMode;
      m.bind(shell.skeleton, shell.bindMatrix);
      m.position.copy(shell.position);
      m.quaternion.copy(shell.quaternion);
      m.scale.copy(shell.scale);
      m.frustumCulled = false;
      m.userData.slot = shell.userData.slot;
      m.userData.breastPart = true;
      m.raycast = () => {};            // 関節を選ぶときのタップは素通り（下の胸の殻が拾う）
      shell.parent.add(m);
      return m;
    };
    const part = make(shell.material);
    part.castShadow = shell.castShadow;
    part.receiveShadow = shell.receiveShadow;
    part.name = sx > 0 ? 'BreastL' : 'BreastR';
    part.visible = false;
    parts.push(part);
    if (wireMat) {
      // 面の線は、細かい網目の全部ではなく、体の網目と同じくらいの間隔（約 1.5cm）の線だけを描く。
      // 線は細かい頂点をたどるので、乳房の丸みの上にのる（三角形 (a, b, b) は線 a-b として描かれる）
      const lineIdx = [];
      const seg = (p, q) => { if (p !== q) lineIdx.push(p, q, q); };
      const RS = Math.max(1, Math.round(0.015 * s / ((rIn + rOut + rUp + rDn) / 4 / NR)));   // 輪の間隔
      const AS = 4;                                                                         // 72 方向のうち 4 つおき
      for (let r = RS; r <= NR; r += RS) for (let a = 0; a < NA; a++) seg(vid[r][a], vid[r][(a + 1) % NA]);
      for (let a = 0; a < NA; a += AS) {
        for (let r = 0; r < NR; r++) seg(r === 0 ? vid[0][0] : vid[r][a], vid[r + 1][a]);
      }
      // 斜めの線（体の網目と同じく三角形に見えるように、ひとつおきのます目に 1 本）
      for (let a = 0; a < NA; a += AS * 2) {
        for (let r0 = RS; r0 + RS <= NR; r0 += RS) {
          for (let i = 0; i < RS; i++) {
            const a0 = Math.round(a + (i / RS) * AS) % NA, a1 = Math.round(a + ((i + 1) / RS) * AS) % NA;
            seg(vid[r0 + i][a0], vid[r0 + i + 1][a1]);
          }
        }
      }
      const wgeo = new THREE.BufferGeometry();
      for (const [k, at] of Object.entries(geo.attributes)) wgeo.setAttribute(k, at);
      wgeo.setIndex(lineIdx);
      wgeo.boundingBox = geo.boundingBox; wgeo.boundingSphere = geo.boundingSphere;
      const w = make(wireMat);
      w.geometry = wgeo;
      w.renderOrder = 5;
      w.userData.wire = true;
      w.visible = false;
      wires.push(w);
    }
  }
  if (!parts.length) return null;
  slot.breastInfo = { A, F, s };
  return { parts, wires, shell };
}
