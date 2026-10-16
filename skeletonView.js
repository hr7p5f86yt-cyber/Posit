// skeletonView.js — 読み込んだ素体の内側に、解剖学どおりの骨格を組み立てる
//
// 考え方
//   1. 基準姿勢（気をつけ）のまま、骨の形をすべて「ワールド座標」で作る。
//      上 = +Y、前 = +Z、キャラクターの左 = +X。寸法は身長 1.70m の成人を基準にメートルで書き、
//      素体の背丈・腰幅・手の大きさに合わせて伸び縮みさせる。
//   2. 位置はリグの関節（肩・肘・股関節・膝…）と、素体を実際に測った体幹の断面から決める。
//      背骨は背中側、肋骨は胸の内側、骨盤は股関節の位置（Bell の式）から組む。
//   3. できた骨の形が素体の外へ出ていないかを頂点ごとに調べ、出ていれば骨の軸へ向けて縮める。
//   4. 骨（ボーン）ごとにまとめて 1 つのメッシュにし、そのボーンの子として付ける。
//      ポーズを付けると骨格も一緒に動く。
//
// 主な比率の出典
//   ・股関節中心と上前腸骨棘の関係 … Bell ほか (1990)
//   ・脊柱の区間長（頸椎 12〜13cm・胸椎 27〜28cm・腰椎 17〜18cm） … 解剖学の標準値
//   ・胸骨上切痕の高さ（身長の 0.819） … ANSUR (1988)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { partName } from './anatomy.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
/** 部品の名前（左右は人形から見た左右。sx > 0 が人形の左） */
const NM = (id, sx = 0, o = {}) => partName(id, { side: sx > 0 ? 'L' : sx < 0 ? 'R' : null, ...o });

function materials() {
  return {
    bone: new THREE.MeshStandardMaterial({ color: 0xe9dfc6, roughness: 0.55, metalness: 0, side: THREE.DoubleSide }),
    cart: new THREE.MeshStandardMaterial({ color: 0xc9d3cf, roughness: 0.45, metalness: 0, side: THREE.DoubleSide }),
    dark: new THREE.MeshStandardMaterial({ color: 0x6d6352, roughness: 0.8, metalness: 0, side: THREE.DoubleSide }),
  };
}

// ---------------------------------------------------------------------------
// 形をつくる道具（すべてワールド座標）
// ---------------------------------------------------------------------------

function finish(g) {
  g.deleteAttribute('uv');
  if (!g.index) {
    const n = g.attributes.position.count;
    const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

/** 3 本の軸ベクトルから回転行列 */
function basisMatrix(ex, ey, ez) {
  return new THREE.Matrix4().makeBasis(ex, ey, ez);
}

/** 楕円体。radii は ex/ey/ez 方向の半径 */
function ellipsoid(center, radii, basis = null, seg = 14) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(6, Math.round(seg * 0.7)));
  g.scale(radii[0], radii[1], radii[2]);
  if (basis) g.applyMatrix4(basisMatrix(...basis));
  g.translate(center.x, center.y, center.z);
  return finish(g);
}

/** a から b へ伸びる円柱（両端の半径を変えられる）。ell で断面を楕円にする */
function rod(a, b, rA, rB = rA, seg = 10, ell = null) {
  return tube([a, b], t => lerp(rA, rB, t), { seg, ell });
}

/**
 * 折れ線に沿って太さの変わる管を作る（ねじれないように平行移動の枠で輪を回す）。
 * rad は数値か、0..1 を受け取る関数。ell = { axis: Vector3, ratio } で断面を平たくする。
 */
function tube(pts0, rad, { seg = 10, caps = true, ell = null, step = 0.012 } = {}) {
  // 長い区間は細かく刻む（途中で素体からはみ出していないか調べられるように）
  const pts = [pts0[0].clone()];
  for (let i = 1; i < pts0.length; i++) {
    const a = pts0[i - 1], b = pts0[i];
    const k = Math.max(1, Math.ceil(a.distanceTo(b) / step));
    for (let j = 1; j <= k; j++) pts.push(a.clone().lerp(b, j / k));
  }
  const n = pts.length;
  const T = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const t = b.clone().sub(a);
    T.push(t.lengthSq() > 1e-14 ? t.normalize() : (T[i - 1] ? T[i - 1].clone() : UP.clone()));
  }
  const ref = Math.abs(T[0].y) < 0.9 ? V3(0, 1, 0) : V3(1, 0, 0);
  let nrm = ref.clone().addScaledVector(T[0], -ref.dot(T[0])).normalize();
  const Ns = [], Bs = [];
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      nrm.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(T[i - 1], T[i]));
      nrm.addScaledVector(T[i], -nrm.dot(T[i])).normalize();
    }
    let N = nrm.clone(), B = V3().crossVectors(T[i], nrm).normalize();
    if (ell) {
      // 平たくする向き（短い方の軸）を、管の向きに直交させて使う
      const m = ell.axis.clone().addScaledVector(T[i], -ell.axis.dot(T[i]));
      if (m.lengthSq() > 1e-10) { N = m.normalize(); B = V3().crossVectors(T[i], N).normalize(); }
    }
    Ns.push(N); Bs.push(B);
  }
  const pos = [], nor = [], idx = [];
  const ratio = ell ? ell.ratio : 1;
  for (let i = 0; i < n; i++) {
    const r = typeof rad === 'function' ? rad(n > 1 ? i / (n - 1) : 0) : rad;
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      const d = Ns[i].clone().multiplyScalar(c * ratio).addScaledVector(Bs[i], s);
      const p = pts[i].clone().addScaledVector(d, r);
      pos.push(p.x, p.y, p.z);
      const nn = Ns[i].clone().multiplyScalar(c / Math.max(ratio, 0.05)).addScaledVector(Bs[i], s).normalize();
      nor.push(nn.x, nn.y, nn.z);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b = i * seg + (j + 1) % seg, c = (i + 1) * seg + j, d = (i + 1) * seg + (j + 1) % seg;
      idx.push(a, c, b, b, c, d);
    }
  }
  if (caps) {
    for (const [i, sgn] of [[0, -1], [n - 1, 1]]) {
      const ci = pos.length / 3;
      pos.push(pts[i].x, pts[i].y, pts[i].z);
      nor.push(T[i].x * sgn, T[i].y * sgn, T[i].z * sgn);
      for (let j = 0; j < seg; j++) {
        const a = i * seg + j, b = i * seg + (j + 1) % seg;
        if (sgn < 0) idx.push(ci, b, a); else idx.push(ci, a, b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/** 点の並び（行×列）から厚みのある板を作る（肩甲骨・腸骨・胸骨など） */
function slab(rows, thick) {
  const R = rows.length, C = rows[0].length;
  const g0 = new THREE.BufferGeometry();
  const flat = [];
  for (const row of rows) for (const p of row) flat.push(p.x, p.y, p.z);
  g0.setAttribute('position', new THREE.Float32BufferAttribute(flat, 3));
  const idx = [];
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < C - 1; j++) {
    const a = i * C + j, b = a + 1, c = a + C, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  g0.setIndex(idx);
  g0.computeVertexNormals();
  const P = g0.attributes.position, N = g0.attributes.normal;
  const pos = [], nor = [], out = [];
  const n = P.count;
  for (const side of [1, -1]) {
    for (let i = 0; i < n; i++) {
      pos.push(P.getX(i) + N.getX(i) * thick * 0.5 * side, P.getY(i) + N.getY(i) * thick * 0.5 * side,
        P.getZ(i) + N.getZ(i) * thick * 0.5 * side);
      nor.push(N.getX(i) * side, N.getY(i) * side, N.getZ(i) * side);
    }
  }
  for (let k = 0; k < idx.length; k += 3) {
    out.push(idx[k], idx[k + 1], idx[k + 2]);
    out.push(idx[k] + n, idx[k + 2] + n, idx[k + 1] + n);
  }
  // 縁をふさぐ
  const ring = [];
  for (let j = 0; j < C; j++) ring.push(j);
  for (let i = 1; i < R; i++) ring.push(i * C + C - 1);
  for (let j = C - 2; j >= 0; j--) ring.push((R - 1) * C + j);
  for (let i = R - 2; i >= 1; i--) ring.push(i * C);
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k], b = ring[(k + 1) % ring.length];
    out.push(a, b, a + n, b, b + n, a + n);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(out);
  return g;
}

/** なめらかな曲線上の点を n 個 */
function curve(points, n) {
  if (points.length < 2) return points.map(p => p.clone());
  const c = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return c.getPoints(Math.max(2, n - 1));
}

// ---------------------------------------------------------------------------
// 素体を測る
// ---------------------------------------------------------------------------

/**
 * スキンをかけた後の頂点（ワールド）・法線・どの骨にいちばん引っ張られているか・
 * どの「かたまり（つながった面）」に属するか、を集める。
 * 「骨が素体の内側にあるか」は、近くのかたまりごとに最寄りの頂点の法線を見て判断する。
 * 球体関節人形のように殻が何枚も重なった素体でも、どれか一枚の内側なら内側とみなせる。
 */
export function measureBody(slot) {
  const P = [], Nn = [], dom = [], comp = [];
  let compBase = 0;
  const v = new THREE.Vector3();
  const addMesh = (m, isSkin) => {
    const g = m.geometry;
    const pos = g && g.attributes && g.attributes.position;
    if (!pos) return;
    m.updateWorldMatrix(true, false);
    const n = pos.count;
    const wp = new Float32Array(n * 3);
    if (isSkin) m.skeleton.update();
    for (let i = 0; i < n; i++) {
      // スキンの素体は、体つきのモーフもかけた後の位置で測る
      if (isSkin) m.getVertexPosition(i, v); else v.fromBufferAttribute(pos, i);
      v.applyMatrix4(m.matrixWorld);
      wp[i * 3] = v.x; wp[i * 3 + 1] = v.y; wp[i * 3 + 2] = v.z;
    }
    const tmp = new THREE.BufferGeometry();
    tmp.setAttribute('position', new THREE.BufferAttribute(wp, 3));
    if (g.index) tmp.setIndex(g.index);
    tmp.computeVertexNormals();
    const wn = tmp.attributes.normal.array;
    // つながった面ごとに分ける
    const parent = new Int32Array(n);
    for (let i = 0; i < n; i++) parent[i] = i;
    const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    const ix = g.index ? g.index.array : null;
    const triCount = ix ? ix.length / 3 : n / 3;
    for (let t = 0; t < triCount; t++) {
      const a = ix ? ix[t * 3] : t * 3, b = ix ? ix[t * 3 + 1] : t * 3 + 1, c = ix ? ix[t * 3 + 2] : t * 3 + 2;
      const ra = find(a), rb = find(b), rc = find(c);
      parent[rb] = ra; parent[find(rc)] = ra;
    }
    // 位置が同じ頂点（UV の継ぎ目）も同じかたまりにする
    const seam = new Map();
    for (let i = 0; i < n; i++) {
      const k = Math.round(wp[i * 3] * 2e4) + ',' + Math.round(wp[i * 3 + 1] * 2e4) + ',' + Math.round(wp[i * 3 + 2] * 2e4);
      const j = seam.get(k);
      if (j === undefined) seam.set(k, i); else parent[find(i)] = find(j);
    }
    const si = isSkin ? g.attributes.skinIndex : null, sw = isSkin ? g.attributes.skinWeight : null;
    const ids = new Map();
    for (let i = 0; i < n; i++) {
      P.push(wp[i * 3], wp[i * 3 + 1], wp[i * 3 + 2]);
      Nn.push(wn[i * 3], wn[i * 3 + 1], wn[i * 3 + 2]);
      let best = null;
      if (si && sw) {
        let bw = -1, bi = 0;
        for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; bi = si.getComponent(i, k); } }
        best = m.skeleton.bones[bi] || null;
      } else {
        for (let o = m.parent; o; o = o.parent) if (o.isBone) { best = o; break; }
      }
      dom.push(best);
      const r = find(i);
      if (!ids.has(r)) ids.set(r, compBase + ids.size);
      comp.push(ids.get(r));
    }
    compBase += ids.size;
  };
  for (const m of slot.meshes || []) {
    // 乳房の部品は胸の殻の上にのせた脂肪なので、骨・筋肉の位置を決める体の外形には入れない
    if (m.userData.headPlane || m.userData.bonePart || m.userData.wire || m.userData.breastPart) continue;
    if (m.isSkinnedMesh && m.skeleton) addMesh(m, true);
    else if (m.isMesh) addMesh(m, false);
  }
  const count = dom.length;
  const pos = new Float32Array(P), nor = new Float32Array(Nn), cid = new Int32Array(comp);

  // 空間のます目（数値のキーで引く）
  const cell = 0.03;
  const K = (i, j, k) => ((i + 1024) * 2048 + (j + 1024)) * 2048 + (k + 1024);
  const grid = new Map();
  for (let i = 0; i < count; i++) {
    const k = K(Math.floor(pos[i * 3] / cell), Math.floor(pos[i * 3 + 1] / cell), Math.floor(pos[i * 3 + 2] / cell));
    let a = grid.get(k);
    if (!a) { a = []; grid.set(k, a); }
    a.push(i);
  }

  /**
   * 点 p が素体の表面からどれだけ内側にあるか（メートル。マイナスほど深い）。
   * 近くのかたまりごとに最寄りの頂点の法線で表裏を判定し、いちばん内側のものを採る。
   */
  // かたまりごとの最寄りの頂点を、使い回す型付き配列で持つ（呼ぶたびに配列を作らない）
  let nComp = 0;
  for (let i = 0; i < count; i++) if (cid[i] + 1 > nComp) nComp = cid[i] + 1;
  const bestD = new Float64Array(nComp).fill(Infinity);
  const bestI = new Int32Array(nComp);
  const touched = new Int32Array(nComp);
  let nTouched = 0;
  const near = new Map();          // explain() 用
  let lastNear = -1;               // 直前に測った点のいちばん近い頂点（どの骨の皮膚かを知るため）
  let keepNear = false;
  const depth = (p) => {
    const px = p.x, py = p.y, pz = p.z;
    const cx = Math.floor(px / cell), cy = Math.floor(py / cell), cz = Math.floor(pz / cell);
    for (let t = 0; t < nTouched; t++) bestD[touched[t]] = Infinity;
    nTouched = 0;
    let minD = Infinity;
    for (let r = 0; r <= 5; r++) {
      for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
        const edge = a === r || a === -r || b === r || b === -r;
        const stepC = edge ? 1 : (2 * r || 1);
        for (let c = -r; c <= r; c += stepC) {
          const list = grid.get(K(cx + a, cy + b, cz + c));
          if (list === undefined) continue;
          for (let q = 0; q < list.length; q++) {
            const i = list[q], i3 = i * 3;
            const dx = pos[i3] - px, dy = pos[i3 + 1] - py, dz = pos[i3 + 2] - pz;
            const d2 = dx * dx + dy * dy + dz * dz;
            const c0 = cid[i];
            if (bestD[c0] === Infinity) touched[nTouched++] = c0;
            if (d2 < bestD[c0]) { bestD[c0] = d2; bestI[c0] = i; }
            if (d2 < minD) minD = d2;
          }
        }
      }
      // 最寄りの頂点より 2cm 先まで見たら打ち切る（隣の殻も拾うため）
      if (minD < Infinity && Math.sqrt(minD) + 0.02 < r * cell) break;
    }
    let best = Infinity;
    lastNear = -1;
    let nd = Infinity;
    for (let t = 0; t < nTouched; t++) {
      const i = bestI[touched[t]], i3 = i * 3;
      const sd = (px - pos[i3]) * nor[i3] + (py - pos[i3 + 1]) * nor[i3 + 1] + (pz - pos[i3 + 2]) * nor[i3 + 2];
      if (sd < best) best = sd;
      if (bestD[touched[t]] < nd) { nd = bestD[touched[t]]; lastNear = i; }
    }
    if (keepNear) {
      near.clear();
      for (let t = 0; t < nTouched; t++) near.set(touched[t], [bestD[touched[t]], bestI[touched[t]]]);
    }
    return best === Infinity ? 1 : best;
  };

  // 確かめる用: 近くのかたまりごとの [かたまり, 距離, 表裏] を返す
  const explain = (p) => {
    keepNear = true; depth(p); keepNear = false;
    const out = [];
    for (const [c0, v] of near) {
      const i = v[1];
      const sd = (p.x - pos[i * 3]) * nor[i * 3] + (p.y - pos[i * 3 + 1]) * nor[i * 3 + 1] + (p.z - pos[i * 3 + 2]) * nor[i * 3 + 2];
      out.push([c0, Math.round(Math.sqrt(v[0]) * 1000), Math.round(sd * 1000), i]);
    }
    return out.sort((a, b) => a[1] - b[1]);
  };
  return { pos, nor, dom, count, depth, explain, cid, nearest: () => lastNear };
}

/**
 * 体幹の断面（正中の背中・おなかの面と、体幹の半幅）を高さごとに取る。
 * 背骨・肋骨・胸骨・骨盤の奥行きはここから決める。
 */
export function trunkProfile(body, trunkBones, armBones, cx, s) {
  const step = 0.01;
  let ymin = Infinity, ymax = -Infinity;
  for (let i = 0; i < body.count; i++) {
    if (!trunkBones.has(body.dom[i])) continue;
    const y = body.pos[i * 3 + 1];
    ymin = Math.min(ymin, y); ymax = Math.max(ymax, y);
  }
  if (!(ymax > ymin)) return null;
  const n = Math.ceil((ymax - ymin) / step) + 1;
  const back = new Array(n).fill(null), front = new Array(n).fill(null), half = new Array(n).fill(null);
  // 正中の前後の面は、正中から 6cm 以内の頂点で測る（頂点の少ない素体では、細い帯だと前の面の頂点を拾えない）
  const band = 0.06 * s;
  for (let i = 0; i < body.count; i++) {
    const b = body.dom[i];
    if (!trunkBones.has(b) || armBones.has(b)) continue;
    const x = body.pos[i * 3], y = body.pos[i * 3 + 1], z = body.pos[i * 3 + 2];
    const k = Math.round((y - ymin) / step);
    if (Math.abs(x - cx) < band) {
      back[k] = back[k] === null ? z : Math.min(back[k], z);
      front[k] = front[k] === null ? z : Math.max(front[k], z);
    }
    half[k] = half[k] === null ? Math.abs(x - cx) : Math.max(half[k], Math.abs(x - cx));
  }
  const fill = arr => {
    for (let i = 0; i < n; i++) {
      if (arr[i] !== null) continue;
      let a = i - 1; while (a >= 0 && arr[a] === null) a--;
      let b = i + 1; while (b < n && arr[b] === null) b++;
      if (a >= 0 && b < n) arr[i] = lerp(arr[a], arr[b], (i - a) / (b - a));
      else if (a >= 0) arr[i] = arr[a];
      else if (b < n) arr[i] = arr[b];
    }
    // 継ぎ目の小さなへこみに引っ張られないよう、内側（小さい方）へ寄せてならす
    const out = arr.slice();
    for (let i = 0; i < n; i++) {
      const w = [arr[Math.max(0, i - 1)], arr[i], arr[Math.min(n - 1, i + 1)]];
      out[i] = (w[0] + w[1] * 2 + w[2]) / 4;
    }
    return out;
  };
  // 正中の前・後ろの面は、体の外から正中の線に沿って進み、最初に体幹の皮膚に入った所で測る
  //   （頂点の受け持ちの骨で分けると、胸の前の面が肩の骨の受け持ちになっていて拾えないことがあるため）
  if (body.depth && body.nearest) {
    const q = new THREE.Vector3();
    const ok = new Set([...trunkBones, ...armBones]);
    const march = (y, z0, dir) => {
      let best = null;
      for (const dx of [0, 0.03 * s]) {
        let hit = null;
        for (let z = z0, i = 0; i < 90; i++, z += dir * 0.005 * s) {
          q.set(cx + dx, y, z);
          if (body.depth(q) < 0) {
            const ni = body.nearest();
            if (ni >= 0 && body.dom[ni] && !ok.has(body.dom[ni])) continue;
            // 表面の位置を細かく
            let a = z - dir * 0.005 * s, b = z;
            for (let k = 0; k < 5; k++) { const m = (a + b) / 2; q.set(cx + dx, y, m); if (body.depth(q) < 0) b = m; else a = m; }
            hit = b; break;
          }
        }
        if (hit !== null) best = best === null ? hit : (dir < 0 ? Math.max(best, hit) : Math.min(best, hit));
      }
      return best;
    };
    // 2cm おきに測り、あいだは補う
    for (let k = 0; k < n; k++) {
      if (half[k] === null) continue;
      if (k % 2) { front[k] = back[k] = null; continue; }
      const y = ymin + k * step;
      const f = march(y, 0.40 * s, -1), b = march(y, -0.40 * s, 1);
      if (f !== null && b !== null && f > b) { front[k] = f; back[k] = b; }
    }
  }
  const B = fill(back.map(v => (v === null ? null : -v))).map(v => -v);
  const F = fill(front);
  const H = fill(half);
  const at = (arr, y) => {
    const t = (y - ymin) / step;
    const i = clamp(Math.floor(t), 0, n - 1), j = clamp(i + 1, 0, n - 1);
    return lerp(arr[i], arr[j], clamp(t - i, 0, 1));
  };
  return {
    back: y => at(B, y), front: y => at(F, y), half: y => at(H, y), ymin, ymax,
  };
}

// ---------------------------------------------------------------------------
// 部品の登録と、素体からはみ出さないように縮める処理
// ---------------------------------------------------------------------------

class Parts {
  constructor(body, margin) {
    this.body = body;
    this.margin = margin;
    this.list = [];
  }

  /**
   * @param {THREE.Bone} bone    ぶら下げる骨
   * @param {THREE.BufferGeometry} geo  ワールド座標の形
   * @param {object} o  mat: 'bone'|'cart'|'dark'、fit: 'axis'|'center'|'none'、
   *                    axis: [Vector3, Vector3]（その線に向かって縮める）、center: Vector3
   */
  add(bone, geo, o = {}) {
    if (!bone || !geo) return;
    this.list.push({ bone, geo, mat: o.mat || 'bone', fit: o.fit || 'center', axis: o.axis || null,
      center: o.center || null, group: o.group || null, margin: o.margin || 0, back: o.back || null,
      minScale: o.minScale || 0.2, name: o.name || null });
  }

  /**
   * 形を保ったまま収まる倍率と、後ろへのずらし量を探す（大きいほど優先）。
   * @returns {[number, number]} [倍率, ずらし量(m)]
   */
  searchUnit(geo, center, back, margin) {
    const body = this.body;
    const pos = geo.attributes.position, n = pos.count;
    const samples = [];
    for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 700))) samples.push(new THREE.Vector3().fromBufferAttribute(pos, i));
    const q = new THREE.Vector3();
    const m = Math.max(this.margin, margin || 0);
    for (let sc = 1.0; sc >= 0.6; sc -= 0.02) {
      for (const sh of [0, 0.003, 0.006, 0.009, 0.012, 0.016]) {
        let ok = true;
        for (const v of samples) {
          q.copy(v).sub(center).multiplyScalar(sc).add(center).addScaledVector(back, sh);
          if (body.depth(q) + m > 0) { ok = false; break; }
        }
        if (ok) return [sc, sh];
      }
    }
    return [0.6, 0.016];
  }

  /** searchUnit の結果を形に当てる */
  static applyUnit(geo, center, back, best) {
    const pos = geo.attributes.position, p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).sub(center).multiplyScalar(best[0]).add(center).addScaledVector(back, best[1]);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  /** 素体の外へ出ている頂点があれば、軸（または中心）へ向けて縮める */
  fit() {
    const body = this.body;
    if (!body || !body.count) return;
    const p = new THREE.Vector3();
    for (const part of this.list) {
      if (part.fit === 'none') continue;
      const pos = part.geo.attributes.position;
      const n = pos.count;
      const step = Math.max(1, Math.floor(n / 80));
      let center = part.center;
      if (!center && !part.axis) {
        part.geo.computeBoundingBox();
        center = part.geo.boundingBox.getCenter(new THREE.Vector3());
      }
      const shrinkBy = (f) => {
        const a = part.axis ? part.axis[0] : null;
        const d = part.axis ? part.axis[1].clone().sub(part.axis[0]).normalize() : null;
        for (let i = 0; i < n; i++) {
          p.fromBufferAttribute(pos, i);
          if (d) {
            const t = p.clone().sub(a).dot(d);
            const foot = a.clone().addScaledVector(d, t);
            p.sub(foot).multiplyScalar(f).add(foot);
          } else {
            p.sub(center).multiplyScalar(f).add(center);
          }
          pos.setXYZ(i, p.x, p.y, p.z);
        }
        pos.needsUpdate = true;
      };
      if (part.fit === 'unit') {
        const back = part.back || new THREE.Vector3(0, 0, -1);
        part.fitted = this.searchUnit(part.geo, center, back, part.margin);
        Parts.applyUnit(part.geo, center, back, part.fitted);
        continue;
      }
      // 部品全体が十分深い所にあれば、頂点ごとに調べなくてよい
      part.geo.computeBoundingSphere();
      const bs = part.geo.boundingSphere;
      if (body.depth(bs.center) < -(bs.radius * 1.4 + this.margin + part.margin)) continue;
      for (let it = 0; it < 7; it++) {
        let worst = -Infinity;
        for (let i = 0; i < n; i += step) {
          p.fromBufferAttribute(pos, i);
          const dd = body.depth(p) + Math.max(this.margin, part.margin);
          if (dd > worst) worst = dd;
        }
        if (worst <= 0) break;
        // 縮めすぎると形がくずれるので、部品ごとの下限で止める
        const cur = part.shrunk || 1;
        const f = Math.max(it < 4 ? 0.86 : 0.75, part.minScale / cur);
        if (f >= 0.999) break;
        shrinkBy(f);
        part.shrunk = cur * f;
      }
      part.geo.computeVertexNormals();
    }
  }

  /** 骨ごと・材質ごとにまとめてメッシュにし、そのボーンにぶら下げる */
  attach(slot, mats) {
    const groups = new Map();
    for (const part of this.list) {
      const holder = part.group || part.bone;
      const k = holder.uuid + '|' + part.mat;
      let g = groups.get(k);
      if (!g) { g = { holder, bone: part.bone, mat: part.mat, geos: [], names: [] }; groups.set(k, g); }
      g.geos.push(part.geo);
      g.names.push(part.name);
    }
    const out = [];
    for (const g of groups.values()) {
      const merged = g.geos.length > 1 ? mergeGeometries(g.geos, false) : g.geos[0];
      if (!merged) continue;
      // どの三角形がどの骨か（タップで名前を出す・光らせるときに使う）
      //   start/count … 三角形の番号、vStart/vCount … 頂点の番号（部品ごとに続いて並ぶ）
      const ranges = [];
      let tri = 0, vtx = 0;
      g.geos.forEach((geo, i) => {
        const n = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
        const nv = geo.attributes.position.count;
        const nm = g.names[i];
        const last = ranges[ranges.length - 1];
        if (last && nm && last.name && last.name.key === nm.key && last.start + last.count === tri) { last.count += n; last.vCount += nv; }
        else ranges.push({ start: tri, count: n, vStart: vtx, vCount: nv, name: nm });
        tri += n; vtx += nv;
      });
      merged.computeBoundingSphere();
      const m = new THREE.Mesh(merged, mats[g.mat]);
      g.holder.updateWorldMatrix(true, false);
      const inv = g.holder.matrixWorld.clone().invert();
      g.holder.add(m);
      inv.decompose(m.position, m.quaternion, m.scale);
      m.castShadow = true;
      m.receiveShadow = true;
      m.visible = false;
      m.frustumCulled = false;
      m.userData.jointBone = g.bone;
      m.userData.bonePart = true;
      m.userData.slot = slot.key;
      m.userData.keepSide = true;
      m.userData.ranges = ranges;
      out.push(m);
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// 部位ごとの組み立て
// ---------------------------------------------------------------------------

/** 背骨の並び（腰 → 頭）をリグの親子関係からたどる */
export function spineChain(map) {
  const out = [];
  const head = map.head || map.neck;
  if (!head || !map.hips) return out;
  for (let b = head; b; b = b.parent) {
    out.unshift(b);
    if (b === map.hips) break;
  }
  return out[0] === map.hips ? out : [];
}

function build(slot, body, P, ctx) {
  const { map, J, s, cx, prof, head, chain } = ctx;
  const W = b => b.getWorldPosition(V3());
  const boneAtY = y => {
    // その高さを受け持つ背骨の骨（下から見て、y がそれより上にある最後の骨）
    let pick = chain[0];
    for (const b of chain) if (W(b).y <= y + 1e-4) pick = b;
    return pick;
  };

  // ---- 背骨 ----------------------------------------------------------------
  // 股関節（左右の中点）と、骨盤の大きさ（左右の上前腸骨棘の間隔 IAD。Bell の式で股関節の間隔から）
  const HJm = map.thighL && map.thighR ? W(map.thighL).lerp(W(map.thighR), 0.5) : null;
  const kP = HJm ? clamp(W(map.thighL).distanceTo(W(map.thighR)) / 0.72 / 0.24, 0.6, 1.5) : s;
  // 仙骨の上面（岬角の高さ）は股関節の中心より 8〜9cm 上。リグの腰の骨とのあいだを取る
  const S1top = HJm ? lerp(J.hips.y - 0.006 * s, HJm.y + 0.085 * kP, 0.5) : J.hips.y - 0.006 * s;
  const T1 = (J.neck ? J.neck.y : J.hips.y + 0.46 * s) + 0.020 * s;
  const span = T1 - S1top;
  const L1top = S1top + span * 0.385;                          // 腰椎 : 胸椎 = 17.5 : 28
  // 頸椎のいちばん上（環椎）は、頭の中で耳の穴より少し下（頭頂から 0.65 頭分）
  const C1 = head ? head.top - 0.65 * head.h : T1 + 0.12 * s;
  const levels = [];
  for (let i = 0; i < 5; i++) levels.push({ name: 'L' + (5 - i), region: 'L', y: lerp(S1top, L1top, (i + 0.5) / 5), k: i / 4 });
  for (let i = 0; i < 12; i++) levels.push({ name: 'T' + (12 - i), region: 'T', y: lerp(L1top, T1, (i + 0.5) / 12), k: i / 11 });
  for (let i = 0; i < 7; i++) levels.push({ name: 'C' + (7 - i), region: 'C', y: lerp(T1 + 0.004 * s, C1, i / 6), k: i / 6 });
  levels.sort((a, b) => a.y - b.y);

  // 椎体の前後の位置: 脊柱の生理的な弯曲（腰椎の前弯・胸椎の後弯・頸椎の前弯）を、
  //   第1仙椎の椎体の中心（股関節の中心より 2cm ほど後ろ。骨盤の傾き約 12°）からの前後のずれで書く（m, 身長 1.70m）。
  //   素体の断面は殻の継ぎ目で途切れるので使わず、胸の背中の面だけを目安にする（胸椎が背中から浅すぎないように）。
  const CURVE = { L5: 0.015, L4: 0.030, L3: 0.038, L2: 0.036, L1: 0.028, T12: 0.018, T11: 0.008, T10: -0.002, T9: -0.010,
    T8: -0.016, T7: -0.020, T6: -0.022, T5: -0.021, T4: -0.018, T3: -0.013, T2: -0.007, T1: -0.001,
    C7: 0.006, C6: 0.014, C5: 0.019, C4: 0.021, C3: 0.020, C2: 0.016, C1: 0.012 };
  const zS1 = HJm ? HJm.z - 0.022 * kP : J.hips.z - 0.03 * s;
  for (const L of levels) L.z = zS1 + (CURVE[L.name] || 0) * s;
  {
    // 胸の背中の面（第4〜第9胸椎の高さの中央値）から、胸椎の椎体の中心は 5cm 以上前
    const t6 = levels.find(l => l.name === 'T6');
    if (prof && t6) {
      const ys = levels.filter(l => /^T[4-9]$/.test(l.name)).map(l => prof.back(l.y)).sort((a, b) => a - b);
      const chestBack = ys[Math.floor(ys.length / 2)];
      const want = chestBack + 0.052 * s;
      const dz = Math.max(0, want - t6.z);
      const y0 = S1top, y1 = t6.y;
      for (const L of levels) L.z += dz * clamp((L.y - y0) / Math.max(1e-4, y1 - y0), 0, 1);
    }
  }
  // 頸椎の上の方は頭の下（環椎は頭の前後の 58% の所）へつなぐ
  if (head) {
    const zAO = head.zFront - 0.58 * (head.zFront - head.zBack);
    const c7 = levels.find(l => l.name === 'C7');
    for (const L of levels) {
      if (L.region !== 'C') continue;
      const t = clamp((L.y - c7.y) / Math.max(1e-4, C1 - c7.y), 0, 1);
      L.z = lerp(c7.z, zAO, t) + Math.sin(Math.PI * t) * 0.006 * s;   // 頸椎の前弯
    }
  }
  // なめらかにする
  for (let pass = 0; pass < 2; pass++) {
    const zs = levels.map(l => l.z);
    for (let i = 1; i < levels.length - 1; i++) levels[i].z = (zs[i - 1] + 2 * zs[i] + zs[i + 1]) / 4;
  }
  const vert = {};
  for (const L of levels) vert[L.name] = L;

  const DIM = {
    C: k => ({ w: 0.017, d: 0.015, proc: lerp(0.012, 0.024, k * k), trans: 0.026 }),
    T: k => ({ w: lerp(0.024, 0.034, 1 - k), d: lerp(0.020, 0.027, 1 - k), proc: 0.028, trans: lerp(0.032, 0.026, 1 - k) }),
    L: k => ({ w: lerp(0.046, 0.040, k), d: lerp(0.034, 0.030, k), proc: 0.026, trans: lerp(0.036, 0.040, k) }),
  };
  for (let i = 0; i < levels.length; i++) {
    const L = levels[i];
    const below = levels[i - 1], above = levels[i + 1];
    const gap = ((above ? above.y : L.y + 0.02 * s) - (below ? below.y : L.y - 0.02 * s)) / 2;
    const h = gap * (L.region === 'L' ? 0.66 : 0.72);
    const dim = DIM[L.region](L.k);
    const w = dim.w * s, d = dim.d * s;
    const c = V3(cx, L.y, L.z);
    const bone = boneAtY(L.y);
    const isAtlas = L.name === 'C1';
    const vName = NM({ C: 'vertebraC', T: 'vertebraT', L: 'vertebraL' }[L.region], 0, { n: +L.name.slice(1) });
    // 首の付け根（第7頸椎〜第2胸椎）は、頭を前へ倒すと首の皮膚が寄ってくるので深めに収める
    const vm = ['C7', 'T1', 'T2'].includes(L.name) ? 0.008 * s : 0;
    if (!isAtlas) {
      // 椎体
      const g = new THREE.CylinderGeometry(1, 1, h, 14, 1);
      g.scale(w / 2, 1, d / 2);
      g.translate(c.x, c.y, c.z);
      P.add(bone, finish(g), { center: c.clone(), name: vName, margin: vm });
      // 椎間板（上の椎体とのあいだ）
      if (above && above.name !== 'C1') {
        const yd = (L.y + above.y) / 2;
        const zd = (L.z + above.z) / 2;
        const dg = new THREE.CylinderGeometry(1, 1, gap * (L.region === 'L' ? 0.30 : 0.24), 14, 1);
        dg.scale(w / 2 * 0.94, 1, d / 2 * 0.94);
        dg.translate(cx, yd, zd);
        P.add(boneAtY(yd), finish(dg), { mat: 'cart', center: V3(cx, yd, zd), name: NM('disc', 0, { levels: above.name + '/' + L.name }) });
      }
    }
    // 椎弓・棘突起・横突起
    const canal = (L.region === 'T' ? 0.0075 : 0.009) * s;
    const archC = c.clone().add(V3(0, 0, -(d / 2 + canal)));
    const ring = new THREE.TorusGeometry(canal + 0.0025 * s, 0.0028 * s, 6, 12, Math.PI * (isAtlas ? 2 : 1.25));
    ring.rotateX(Math.PI / 2);
    ring.rotateY(isAtlas ? 0 : Math.PI * 0.875 + Math.PI);
    ring.translate(archC.x, archC.y, archC.z);
    P.add(bone, finish(ring), { center: c.clone(), name: vName, margin: vm });
    // 棘突起: 胸椎は下向きに強く傾く
    const drop = L.region === 'T' ? 0.55 + 0.35 * Math.sin(Math.PI * L.k) : (L.region === 'C' ? 0.25 : 0.05);
    const pd = V3(0, -drop, -1).normalize();
    const pa = archC.clone().add(V3(0, 0, -canal));
    const pb = pa.clone().addScaledVector(pd, dim.proc * s);
    if (!isAtlas) P.add(bone, rod(pa, pb, 0.0040 * s, 0.0026 * s, 8, { axis: V3(1, 0, 0), ratio: 0.55 }), { center: c.clone(), name: vName, margin: vm });
    // 横突起: 胸椎は肋骨を受けるため後ろへ傾く
    for (const sx of [1, -1]) {
      const back = L.region === 'T' ? 0.55 : (L.region === 'C' ? 0.1 : 0.15);
      const ta = archC.clone().add(V3(sx * canal * 0.9, 0, canal * 0.4));
      const tb = ta.clone().add(V3(sx * dim.trans * s, -0.002 * s, -back * dim.trans * s * 0.6));
      P.add(bone, rod(ta, tb, 0.0035 * s, 0.0025 * s, 8), { center: c.clone(), name: vName, margin: vm });
      (L.tp = L.tp || {})[sx] = tb;
    }
    L.archC = archC;
    L.h = h; L.w = w; L.d = d;
  }

  // ---- 仙骨・尾骨 ------------------------------------------------------------
  // 仙骨: 第1仙椎の上面（岬角）から下へ。上の方は約 40° 後ろへ傾き、下ほど前へ反って尾骨へ続く（前が凹）。
  //   上は仙骨翼で幅広く（約 11cm）、下の先はとがる。両わきの耳状面で腸骨とつながる（仙腸関節）。
  {
    const L5 = vert.L5;
    const N = 10, len = 0.112 * s;
    const pts = [];
    let p = V3(cx, S1top, (L5 ? L5.z : zS1) - 0.002 * s);
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      pts.push(p.clone());
      const ang = (40 - 55 * t) * Math.PI / 180;               // 縦からの後ろへの傾き（下ほど前へ反る）
      p = p.clone().add(V3(0, -Math.cos(ang), -Math.sin(ang)).multiplyScalar(len / N));
    }
    const halfW = t => (t < 0.35 ? lerp(0.056, 0.046, t / 0.35) : lerp(0.046, 0.011, (t - 0.35) / 0.65)) * kP;
    const thick = t => lerp(0.032, 0.010, t) * s;
    const rows = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, row = [];
      for (let j = 0; j <= 8; j++) {
        const u = j / 8 * 2 - 1;
        // 前の面はわずかに凹、仙骨翼は前へ反る
        row.push(pts[i].clone().add(V3(u * halfW(t), (t < 0.2 ? 0.006 * s * Math.abs(u) : 0), -Math.abs(u) * 0.008 * s - thick(t) * 0.5 + (t < 0.3 ? 0.008 * s * u * u : 0))));
      }
      rows.push(row);
    }
    P.add(map.hips, slab(rows, 0.022 * s), { axis: [pts[0], pts[N]], minScale: 0.8, name: NM('sacrum') });
    // 正中仙骨稜（背中側の縦のでこぼこ）
    P.add(map.hips, tube(pts.slice(0, 8).map((q, i) => q.clone().add(V3(0, 0, -thick(i / N) - 0.006 * s))), 0.0035 * s, { seg: 6 }), { axis: [pts[0], pts[N]], minScale: 0.8, name: NM('sacrum') });
    // 尾骨（3〜4 個の小さな骨が前下へ）
    const tip = pts[N];
    const cc = [tip.clone(), tip.clone().add(V3(0, -0.011 * s, 0.004 * s)), tip.clone().add(V3(0, -0.020 * s, 0.010 * s)),
      tip.clone().add(V3(0, -0.027 * s, 0.017 * s))];
    for (let i = 0; i < 3; i++) P.add(map.hips, ellipsoid(cc[i].clone().lerp(cc[i + 1], 0.5), [0.008 * s * (1 - i * 0.22), 0.006 * s, 0.005 * s]), { center: cc[i].clone(), name: NM('coccyx') });
    ctx.sacrum = { top: pts[0], pts, halfW };
  }

  // ---- 骨盤（寛骨 = 腸骨・坐骨・恥骨） ----------------------------------------
  // 目印の位置は股関節の中心からの外・上・前（m, 左右の上前腸骨棘の間隔 24cm の骨盤）。
  //   上前腸骨棘は股関節の 3.4cm 外・7.2cm 上・5.3cm 前（Bell）。腸骨稜は上前腸骨棘から外上へ張り出して後ろへ回り、
  //   いちばん高い所は第4腰椎の高さ。上前腸骨棘と恥骨結節はほぼ同じ前額面。寛骨臼は外・下・前を向く（傾き 45°・前捻 20°）。
  //   坐骨結節は股関節の下 6cm・後ろ 3〜4cm。恥骨の上枝・下枝と坐骨枝が閉鎖孔を囲む。
  if (map.thighL && map.thighR) {
    const HL = W(map.thighL), HR = W(map.thighR);
    const IAD = HL.distanceTo(HR) / 0.72;
    const k = IAD / 0.24;
    const sacrum = ctx.sacrum;
    for (const [side, sx, H] of [['L', 1, HL], ['R', -1, HR]]) {
      const A = (x, y, z) => V3(H.x + sx * x * k, H.y + y * k, H.z + z * k);          // 股関節から（外 +）
      const M = (x, y, z) => V3(cx + sx * x * k, H.y + y * k, H.z + z * k);           // 正中から
      // 腸骨翼: 上の縁（腸骨稜）と下の縁（寛骨臼の上 → 大坐骨切痕 → 下後腸骨棘）
      const crest = curve([A(0.034, 0.072, 0.053), A(0.058, 0.098, 0.022), A(0.066, 0.112, -0.020), A(0.052, 0.108, -0.058),
        M(0.052, 0.094, -0.090), M(0.040, 0.072, -0.100)], 14);
      const lower = curve([A(0.026, 0.035, 0.046), A(0.018, 0.028, 0.014), A(0.006, 0.024, -0.022), M(0.068, 0.030, -0.058),
        M(0.060, 0.040, -0.082), M(0.042, 0.050, -0.094)], 14);
      const rows = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6, row = [];
        for (let j = 0; j < crest.length; j++) {
          const q = lower[j].clone().lerp(crest[j], t);
          q.x -= sx * Math.sin(Math.PI * t) * 0.011 * k * Math.sin(Math.PI * clamp(j / (crest.length - 1) * 1.15, 0, 1));   // 腸骨窩（内側のくぼみ）
          row.push(q);
        }
        rows.push(row);
      }
      const ilC = A(0.030, 0.065, -0.020);
      P.add(map.hips, slab(rows, 0.0065 * k), { center: ilC, minScale: 0.8, name: NM('ilium', sx) });
      P.add(map.hips, tube(crest, t => (0.0060 + 0.0015 * Math.sin(Math.PI * t)) * k, { seg: 8 }), { center: ilC, minScale: 0.8, name: NM('iliacCrest', sx) });
      // 前縁（上前腸骨棘 → 下前腸骨棘）と、腸骨の後ろの厚い部分（仙腸関節の耳状面）
      P.add(map.hips, tube(curve([A(0.034, 0.072, 0.053), A(0.030, 0.052, 0.050), A(0.026, 0.035, 0.046)], 6), 0.0055 * k, { seg: 7 }), { center: ilC, minScale: 0.8, name: NM('ilium', sx) });
      P.add(map.hips, ellipsoid(M(0.050, 0.068, -0.080), [0.010 * k, 0.026 * k, 0.016 * k]), { center: ilC, minScale: 0.8, name: NM('ilium', sx) });
      // 寛骨臼（大腿骨頭を受けるお椀）とそのまわりの厚い骨
      const open = V3(sx * 0.66, -0.71, 0.24).normalize();
      {
        const cup = new THREE.SphereGeometry(0.028 * k, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.46);
        cup.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), open.clone().negate()));
        cup.translate(H.x, H.y, H.z);
        P.add(map.hips, finish(cup), { center: H.clone(), name: NM('acetabulum', sx) });
        const rim = new THREE.TorusGeometry(0.028 * k, 0.0035 * k, 6, 20);
        rim.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), open));
        const rc = H.clone().addScaledVector(open, 0.004 * k);
        rim.translate(rc.x, rc.y, rc.z);
        P.add(map.hips, finish(rim), { center: H.clone(), name: NM('acetabulum', sx) });
      }
      P.add(map.hips, ellipsoid(H.clone().addScaledVector(open, -0.020 * k), [0.024 * k, 0.026 * k, 0.024 * k]), { center: H.clone(), name: NM('acetabulum', sx) });
      // 坐骨: 寛骨臼の後ろ下から坐骨結節へ。坐骨棘は内側後ろへ
      const ischTop = A(-0.006, -0.020, -0.020), tub = M(0.058, -0.062, -0.034);
      P.add(map.hips, rod(ischTop, tub, 0.013 * k, 0.012 * k, 10), { axis: [ischTop, tub], minScale: 0.8, name: NM('ischium', sx) });
      P.add(map.hips, ellipsoid(tub.clone().add(V3(0, -0.006 * k, 0)), [0.012 * k, 0.020 * k, 0.016 * k]), { center: tub.clone(), name: NM('ischium', sx), margin: 0.006 * s });
      P.add(map.hips, rod(M(0.064, -0.006, -0.050), M(0.046, -0.014, -0.064), 0.005 * k, 0.003 * k, 7), { center: tub.clone(), name: NM('ischium', sx) });
      // 恥骨: 上枝（寛骨臼の前 → 恥骨結節）、恥骨体、下枝と坐骨枝（恥骨結合の下 → 坐骨結節）
      const symT = M(0.004, -0.030, 0.050), symB = M(0.006, -0.066, 0.036);
      P.add(map.hips, tube(curve([A(-0.010, 0.002, 0.024), A(-0.026, 0.004, 0.040), M(0.024, -0.024, 0.052), symT], 10), 0.0085 * k, { seg: 8 }),
        { axis: [A(-0.010, 0.0, 0.024), symT], fit: 'axis', minScale: 0.75, name: NM('pubis', sx) });
      P.add(map.hips, ellipsoid(M(0.014, -0.047, 0.045), [0.012 * k, 0.020 * k, 0.009 * k]), { center: M(0.014, -0.047, 0.045), name: NM('pubis', sx) });
      P.add(map.hips, tube(curve([symB, M(0.026, -0.082, 0.020), M(0.044, -0.080, -0.006), tub.clone().add(V3(0, -0.012 * k, 0.006 * k))], 10), 0.0062 * k, { seg: 8, ell: { axis: V3(1, 0, 0), ratio: 0.7 } }),
        { axis: [symB, tub], fit: 'axis', minScale: 0.75, name: NM('pubis', sx) });
      if (sx > 0) {
        const c0 = V3(cx, (symT.y + symB.y) / 2, (symT.z + symB.z) / 2);
        const sym = new THREE.CylinderGeometry(0.0045 * k, 0.0045 * k, 0.036 * k, 10);
        sym.rotateX(-0.35);
        sym.translate(c0.x, c0.y, c0.z);
        P.add(map.hips, finish(sym), { mat: 'cart', center: c0, name: NM('symphysis') });
      }
      // 仙腸関節（仙骨のわきと腸骨の後ろをつなぐ）
      if (sacrum) {
        const sj = sacrum.pts[2].clone().add(V3(sx * sacrum.halfW(0.2) * 0.92, 0, -0.008 * s));
        const ij = M(0.050, 0.066, -0.078);
        P.add(map.hips, rod(sj, ij, 0.009 * k, 0.011 * k, 8), { axis: [sj, ij], name: NM('sacroiliac', sx) });
      }
    }
    ctx.IAD = IAD;
  }

  // ---- 胸郭（肋骨・肋軟骨・胸骨） -------------------------------------------
  // 形は解剖学の標準的な寸法（身長 1.70m）で作り、素体の胸の幅・奥行きに合わせて左右と前後だけ縮める。
  //   ・肋骨は肋骨頭（椎体のわき）→ 肋骨結節（横突起の先）→ 肋骨角（背中でいちばん後ろ）→ 側面 → 前の端（肋軟骨との境）。
  //     後ろの端より前の端がずっと低い（下へ傾いて胸を回る）。断面は縦に長い平たい帯（第1肋骨だけは横に平たい）。
  //   ・胸郭の断面は腎臓の形: 背骨が胸郭の中へ張り出し、肋骨角は椎体より 4cm ほど後ろ。
  //   ・胸骨上切痕は第2〜第3胸椎の高さ、胸骨角（第2肋軟骨）は第4〜第5胸椎、剣状突起の付け根は第9胸椎の高さ。
  //     胸骨は下ほど前へ出る（約 18° 傾く）。
  //   ・肋軟骨: 1〜7番は胸骨へ（下の番号ほど長く、内側で上へ曲がる）。8〜10番は一つ上の軟骨へ合流して肋骨弓を作る。
  //     11・12番は前に届かない浮遊肋。
  const ySN = vert.T2 && vert.T3 ? (vert.T2.y + vert.T3.y) / 2 : T1 - 0.035 * s;   // 胸骨上切痕
  const back = y => (prof ? prof.back(y) : J.hips.z - 0.10 * s);
  const halfAt = y => (prof ? prof.half(y) : 0.13 * s);
  const chestBone = map.chest || boneAtY(ySN - 0.06 * s);
  const ribBone = y => { const b = boneAtY(y); return b === map.hips && map.spine ? map.spine : b; };
  // 胸の幅（皮膚の半幅の中央値）から左右の倍率を、背中の面と椎体の位置から前後の倍率を決める
  const midYs = [0.25, 0.4, 0.55].map(f => lerp(ySN, vert.T9 ? vert.T9.y : ySN - 0.2 * s, f));
  const skinHalf = prof ? midYs.map(halfAt).sort((a, b) => a - b)[1] : 0.15 * s;
  const kxC = clamp(skinHalf / (0.150 * s), 0.72, 1.2);
  ctx.kxC = kxC;
  const zV = y => { // その高さの椎体の中心（前後）
    let a = levels[0], b = levels[levels.length - 1];
    for (let i = 0; i < levels.length - 1; i++) if (levels[i].y <= y && levels[i + 1].y >= y) { a = levels[i]; b = levels[i + 1]; break; }
    return a === b ? a.z : lerp(a.z, b.z, clamp((y - a.y) / (b.y - a.y), 0, 1));
  };
  const zSN = zV(ySN) + 0.078 * s;                                     // 胸骨上切痕の前の面
  const STERN_TILT = Math.tan(18 * Math.PI / 180);
  const stZ = y => zSN + (ySN - y) * STERN_TILT;                       // 胸骨の前の面
  const front = stZ;
  const cage = [];   // { bone, geo, mat, name, core }
  // 胸骨: 胸骨柄（幅広い）・胸骨体（細長く下で少し広い）・剣状突起（細い）
  const ST = { man: 0.050, body: 0.105, xiph: 0.034 };
  const stY = [ySN, ySN - ST.man * s, ySN - (ST.man + ST.body) * s, ySN - (ST.man + ST.body + ST.xiph) * s];
  {
    const N = 16, ys = [], ws = [], th = [];
    for (let i = 0; i <= N; i++) {
      const y = lerp(stY[0] + 0.002 * s, stY[3], i / N);
      const rel = (ySN - y) / s;
      ys.push(y);
      // 半幅（m）: 柄は上で 2.6cm（鎖骨切痕）→ 胸骨角で 1.4cm、体は 1.4 → 1.7cm、剣状突起は 0.9 → 0.3cm
      ws.push(rel < ST.man ? lerp(0.026, 0.014, rel / ST.man)
        : rel < ST.man + ST.body ? lerp(0.014, 0.017, Math.sin(Math.PI * 0.8 * (rel - ST.man) / ST.body))
          : lerp(0.009, 0.003, (rel - ST.man - ST.body) / ST.xiph));
      th.push(rel < ST.man ? 0.012 : rel < ST.man + ST.body ? 0.009 : 0.005);
    }
    const rows = ys.map((y, i) => [-1, -0.5, 0, 0.5, 1].map(u => V3(cx + u * ws[i] * kxC * s, y, stZ(y) - th[i] * s * 0.5 - u * u * 0.004 * s)));
    cage.push({ bone: chestBone, geo: slab(rows, 0.0085 * s), mat: 'bone', name: NM('sternum'), core: true });
    // 胸骨角（柄と体のつなぎ目の小さな高まり）
    const ya = stY[1];
    cage.push({ bone: chestBone, geo: rod(V3(cx - 0.013 * kxC * s, ya, stZ(ya) - 0.004 * s), V3(cx + 0.013 * kxC * s, ya, stZ(ya) - 0.004 * s), 0.0035 * s, 0.0035 * s, 8), mat: 'bone', name: NM('sternum'), core: true });
  }
  // 肋骨の寸法（m, 身長 1.70m。番号 1〜12）
  const RIB = {
    xa:   [0.030, 0.045, 0.052, 0.056, 0.058, 0.060, 0.061, 0.062, 0.062, 0.062, 0.060, 0.056],   // 肋骨角の左右の位置
    half: [0.052, 0.076, 0.092, 0.104, 0.114, 0.122, 0.128, 0.132, 0.133, 0.130, 0.122, 0.108],   // 胸郭の半幅（外側でいちばん広い所）
    xe:   [0.032, 0.042, 0.052, 0.062, 0.072, 0.082, 0.090, 0.100, 0.110, 0.120, 0.124, 0.108],   // 前の端の左右の位置
    drop: [0.032, 0.062, 0.080, 0.092, 0.100, 0.106, 0.110, 0.110, 0.106, 0.100, 0.076, 0.050],   // 肋骨頭から前の端までの下がり
    end:  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.70, 0.52],                                             // 回る割合（浮遊肋は側面で終わる）
  };
  const STERN_AT = [0.016, 0.050, 0.074, 0.097, 0.120, 0.140, 0.156];   // 肋軟骨が胸骨に付く高さ（切痕から）
  const ribEnds = [];
  for (let i = 1; i <= 12; i++) {
    const vt = vert['T' + i];
    if (!vt) continue;
    const k = i - 1;
    for (const sx of [1, -1]) {
      const yh = vt.y;
      const A = RIB.half[k] * kxC * s;
      const xa = Math.min(RIB.xa[k] * kxC * s, A * 0.92), xe = Math.min(RIB.xe[k] * kxC * s, A * 0.97);
      const yE = yh - RIB.drop[k] * s;
      const zBack = vt.z - 0.040 * s;                                   // 肋骨角
      const zE = stZ(Math.min(yE, ySN)) - 0.006 * s - 0.30 * (xe - 0.03 * s);   // 前の端（胸骨より少し後ろ）
      const ca = Math.sqrt(1 - (xa / A) ** 2), ce = Math.sqrt(1 - (xe / A) ** 2);
      const b = Math.max(0.03 * s, (zE - zBack) / (ca + ce)), zc = zBack + b * ca;
      const th0 = Math.asin(xa / A), th1 = Math.PI - Math.asin(xe / A);
      const thE = th0 + (th1 - th0) * RIB.end[k];
      const pts = [];
      pts.push(V3(cx + sx * (vt.w / 2 + 0.002 * s), yh, vt.z - vt.d * 0.15));   // 肋骨頭
      const tp = vt.tp && vt.tp[sx];
      if (tp && i <= 10) pts.push(tp.clone().add(V3(sx * 0.002 * s, -0.002 * s, -0.004 * s)));    // 肋骨結節（横突起の先の前）
      const steps = 14;
      for (let j = 0; j <= steps; j++) {
        const u = j / steps, th = lerp(th0, thE, u);
        const y = yh - 0.004 * s - (RIB.drop[k] - 0.004) * s * Math.pow(u, 1.25);
        pts.push(V3(cx + sx * A * Math.sin(th), y, zc - b * Math.cos(th)));
      }
      const path = curve(pts, 26);
      const first = i === 1;
      const r = (first ? 0.0068 : i === 2 ? 0.0042 : 0.0031) * s;
      const ratio = first ? 0.55 : i === 2 ? 1.35 : 2.0;
      cage.push({ bone: ribBone(yh), geo: tube(path, t => r * (t < 0.06 ? 0.75 + 4 * t : 1) * (1 - 0.15 * t), { seg: 8, ell: { axis: UP, ratio } }),
        mat: 'bone', name: NM('rib', sx, { n: i }), core: i <= 8 });
      (ribEnds[i] = ribEnds[i] || {})[sx] = path[path.length - 1];
    }
  }
  // 肋軟骨
  for (const sx of [1, -1]) {
    const cart = [];
    for (let i = 1; i <= 10; i++) {
      const e = ribEnds[i] && ribEnds[i][sx];
      if (!e) continue;
      let pts;
      if (i <= 7) {
        const y = ySN - STERN_AT[i - 1] * s;
        const to = V3(cx + sx * (i === 1 ? 0.020 : 0.015) * kxC * s, y, stZ(y) - 0.005 * s);
        // 5〜7番は外へ下がってから内側で上へ曲がる
        const m1 = e.clone().lerp(to, 0.35); m1.y = lerp(e.y, to.y, i >= 5 ? 0.12 : 0.35); m1.z = Math.max(m1.z, lerp(e.z, to.z, 0.5) + 0.003 * s);
        const m2 = e.clone().lerp(to, 0.75); m2.y = lerp(e.y, to.y, i >= 5 ? 0.62 : 0.78); m2.z = Math.max(m2.z, lerp(e.z, to.z, 0.8));
        pts = curve([e, m1, m2, to], 12);
      } else {
        const prev = cart[i - 1];
        if (!prev) continue;
        const to = prev[Math.floor(prev.length * (i === 8 ? 0.45 : 0.35))].clone();
        const m = e.clone().lerp(to, 0.5); m.z = Math.max(m.z, Math.max(e.z, to.z) - 0.004 * s);
        pts = curve([e, m, to], 10);
      }
      cart[i] = pts;
      const rc = (i === 1 ? 0.0055 : 0.0034) * s;
      cage.push({ bone: chestBone, geo: tube(pts, rc, { seg: 7, ell: { axis: UP, ratio: i === 1 ? 0.7 : 1.6 } }), mat: 'cart', name: NM('costalCart', sx, { n: i }), core: i <= 7 });
    }
  }
  // 胸郭をひとまとまりで素体に収める: 背骨の線を軸に、左右と前後だけを同じ割合で縮める（肋骨は背骨から離れない）。
  //   下の肋骨（9〜12番）は素体の腰のくびれの継ぎ目にかかるので、収まり具合の判定には使わない
  {
    const zAx = zV(ySN - 0.08 * s);
    // 素体は殻を組み合わせた作りで、胸の中にも継ぎ目の面があり「内側かどうか」の判定が当てにならない。
    // そこで高さごとの皮膚の半幅・前・後ろ（いくつかの高さの中央値）と比べて、はみ出さない倍率を決める
    const med = a => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 1; };
    // 皮膚の面: 体の外から内へ向かって進み、最初に素体の内側に入った所
    const surf = (from, dir) => { const q = from.clone(); for (let i = 0; i < 140; i++) { if (body.depth(q) < 0) return q; q.addScaledVector(dir, 0.003 * s); } return null; };
    const rH = [], rF = [], rB = [];
    if (body.count) {
      for (let i = 3; i <= 8; i++) {
        const vt = vert['T' + i]; if (!vt) continue;
        const y = vt.y - RIB.drop[i - 1] * s * 0.45;
        const zm = zV(y) + 0.03 * s;
        const hl = surf(V3(cx + 0.4 * s, y, zm), V3(-1, 0, 0)), hr = surf(V3(cx - 0.4 * s, y, zm), V3(1, 0, 0));
        if (hl && hr) rH.push((Math.min(hl.x - cx, cx - hr.x) - 0.012 * s) / (RIB.half[i - 1] * kxC * s));
        const bk = surf(V3(cx + 0.03 * s, vt.y, zV(vt.y) - 0.4 * s), V3(0, 0, 1));
        if (bk) rB.push((zAx - (bk.z + 0.010 * s)) / Math.max(1e-4, zAx - (vt.z - 0.040 * s)));
      }
      for (let t = 0.1; t <= 0.91; t += 0.1) {
        const y = lerp(stY[0], stY[2], t);
        const fr = surf(V3(cx, y, zV(y) + 0.45 * s), V3(0, 0, -1));
        if (fr) rF.push((fr.z - 0.008 * s - zAx) / Math.max(1e-4, stZ(y) - zAx));
      }
    }
    const sc = clamp(Math.min(1, med(rH), med(rF), med(rB)), 0.75, 1);
    const best = [sc, 0];
    ctx.cageFit = best;
    ctx.cageRatio = [med(rH), med(rF), med(rB)].map(v => +v.toFixed(2));
    for (const c of cage) {
      const pos = c.geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setXYZ(i, cx + (pos.getX(i) - cx) * best[0], pos.getY(i), zAx + (pos.getZ(i) - zAx) * best[0] - best[1]);
      pos.needsUpdate = true; c.geo.computeVertexNormals();
      P.add(c.bone, c.geo, { mat: c.mat, fit: 'none', name: c.name });
    }
    // 以降（鎖骨・肩甲骨）で使う胸郭の形
    ctx.cage = { zAx, sc: best[0], sh: best[1] };
    for (const i in ribEnds) for (const sx in ribEnds[i]) { const e = ribEnds[i][sx]; e.set(cx + (e.x - cx) * best[0], e.y, zAx + (e.z - zAx) * best[0] - best[1]); }
  }
  const stZf = y => zAxFix(stZ(y));
  function zAxFix(z) { const c = ctx.cage; return c ? c.zAx + (z - c.zAx) * c.sc - c.sh : z; }
  const ribBackZ = (y) => zAxFix(zV(y) - 0.040 * s);    // 肋骨角の面（肩甲骨はこの後ろに乗る）


  // ---- 頭蓋骨 ----------------------------------------------------------------
  if (map.head && head) {
    // 基準の頭（皮膚で測った頭の高さ 0.232m、頭頂 y=0・あご y=-0.232、前後の中心 z=0、
    // 頭の長さ 0.197m・幅 0.152m）での成人の頭蓋骨を、素体の頭の箱に合わせて伸び縮みさせる。
    // 軟部組織の厚み（頭頂・額で約 6mm）のぶん、骨は皮膚の内側に収める。
    const ky = head.h / 0.232, kx = head.half / 0.076, kz = (head.zFront - head.zBack) / 0.215;
    ctx.headK = [kx, ky, kz].map(v => +v.toFixed(3));
    const zc0 = (head.zFront + head.zBack) / 2;
    const Hp = (x, y, z) => V3(cx + x * kx, head.top + y * ky, zc0 + z * kz);
    const R = (rx, ry, rz) => [rx * kx, ry * ky, rz * kz];
    const skull = ctx.skullGroup || map.head;
    const C = Hp(0, -0.11, 0);
    // 頭蓋骨の部品はいったん溜めて、最後に一つのまとまりとして素体の頭に収める
    const pieces = { bone: [], cart: [], dark: [] };
    let cur = null;               // いま足している骨の名前
    const add = (geo, o = {}) => { pieces[o.mat || 'bone'].push({ geo, name: o.name || cur }); };
    // 脳頭蓋: 頭頂から後頭部の丸み（上）と、こめかみ〜耳の高さの側頭部（下）
    cur = NM('cranium');
    add(ellipsoid(Hp(0, -0.078, -0.004), R(0.068, 0.073, 0.088), null, 24), { center: C });
    cur = NM('temporal');
    add(ellipsoid(Hp(0, -0.118, -0.012), R(0.062, 0.040, 0.072), null, 20), { center: C });
    // 前頭骨の額と眉弓（眼窩の上縁）
    cur = NM('frontal');
    add(ellipsoid(Hp(0, -0.074, 0.050), R(0.054, 0.046, 0.036), null, 18), { center: C });
    cur = NM('brow');
    add(tube(curve([Hp(-0.050, -0.106, 0.060), Hp(-0.030, -0.099, 0.076), Hp(0, -0.101, 0.084),
      Hp(0.030, -0.099, 0.076), Hp(0.050, -0.106, 0.060)], 14), 0.0055 * ky, { seg: 8 }), { center: C });
    for (const sx of [1, -1]) {
      // 眼窩: 骨のふち（輪）と、奥まった暗い穴
      const oc = Hp(sx * 0.032, -0.118, 0.066);
      const rim = [];
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        rim.push(Hp(sx * 0.032 + Math.cos(a) * 0.020, -0.118 + Math.sin(a) * 0.017, 0.070 - Math.abs(Math.cos(a)) * 0.008 * (Math.cos(a) * sx > 0 ? 1.4 : 0.4)));
      }
      cur = NM('orbit', sx);
      add(tube(rim, 0.0042 * ky, { seg: 7, caps: false }), { center: C });
      add(ellipsoid(oc.clone().add(V3(0, 0, -0.004 * kz)), R(0.018, 0.015, 0.006)), { mat: 'dark', center: C });
      // 頬骨（眼窩の外下のふち〜頬の出っぱり）と頬骨弓（耳の前へ）
      cur = NM('zygomatic', sx);
      add(ellipsoid(Hp(sx * 0.048, -0.134, 0.050), R(0.010, 0.014, 0.012), null, 12), { center: C });
      cur = NM('zygArch', sx);
      add(tube(curve([Hp(sx * 0.052, -0.138, 0.046), Hp(sx * 0.061, -0.138, 0.026), Hp(sx * 0.063, -0.136, 0.002)], 8),
        0.0042 * ky, { seg: 7, ell: { axis: V3(sx, 0, 0), ratio: 0.5 } }), { center: C });
      // 乳様突起（耳の後ろ下）
      cur = NM('mastoid', sx);
      add(ellipsoid(Hp(sx * 0.052, -0.158, -0.026), R(0.008, 0.012, 0.009)), { center: C });
    }
    // 鼻: 鼻骨と、梨状口（鼻の穴の骨のふち）
    cur = NM('nasal');
    add(tube([Hp(0, -0.108, 0.084), Hp(0, -0.122, 0.090), Hp(0, -0.132, 0.093)], 0.0045 * kx, { seg: 8, ell: { axis: V3(0, 0, 1), ratio: 0.6 } }), { center: C });
    const nasal = [];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const w = Math.sin(a) > 0 ? 0.010 : 0.013;
      nasal.push(Hp(Math.cos(a) * w, -0.148 + Math.sin(a) * 0.016, 0.083 - Math.abs(Math.cos(a)) * 0.004));
    }
    cur = NM('piriform');
    add(tube(nasal, 0.0028 * ky, { seg: 6, caps: false }), { center: C });
    add(ellipsoid(Hp(0, -0.148, 0.078), R(0.011, 0.015, 0.005)), { mat: 'dark', center: C, name: NM('nasalCavity') });
    // 上顎骨（眼窩の下〜上の歯ぐき）
    // 上顎骨: 眼窩の下（頬の前の面）から上の歯ぐき（歯槽突起）へ。前の面は平たい
    cur = NM('maxilla');
    for (const sx of [1, -1]) {
      const rows = [];
      for (let j = 0; j <= 4; j++) {
        const y = lerp(-0.174, -0.130, j / 4), row = [];
        for (let i = 0; i <= 4; i++) {
          const x = lerp(j >= 2 ? 0.014 : 0.006, 0.047 - 0.004 * (j / 4), i / 4);
          row.push(Hp(sx * x, y, 0.077 - 0.95 * x * x / 0.046 - (j === 4 ? 0.006 : 0) - 0.004 * Math.sin(Math.PI * i / 4) * Math.sin(Math.PI * j / 4)));
        }
        rows.push(row);
      }
      add(slab(rows, 0.006 * kz), { center: C });
    }
    add(tube(curve([Hp(-0.030, -0.176, 0.046), Hp(-0.018, -0.177, 0.066), Hp(0, -0.177, 0.073), Hp(0.018, -0.177, 0.066), Hp(0.030, -0.176, 0.046)], 12),
      0.0060 * ky, { seg: 8, ell: { axis: UP, ratio: 1.3 } }), { center: C });   // 歯槽（上の歯ぐきの骨）
    add(ellipsoid(Hp(0, -0.168, 0.074), R(0.010, 0.008, 0.005)), { center: C });   // 前鼻棘の下
    // 歯の列（上下）: 前歯は前、奥歯は後ろへ U 字に並ぶ
    for (const [y, w, tn] of [[-0.183, 1.0, 'teethU'], [-0.191, 0.95, 'teethL']]) {
      cur = NM(tn);
      const arc = [];
      for (let i = 0; i <= 12; i++) {
        const a = lerp(-1.35, 1.35, i / 12);
        arc.push(Hp(Math.sin(a) * 0.026 * w, y, 0.046 + Math.cos(a) * 0.026 * w - Math.pow(Math.abs(a) / 1.35, 2) * 0.010));
      }
      add(tube(arc, 0.0034 * ky, { seg: 6, ell: { axis: UP, ratio: 1.5 } }), { mat: 'bone', center: C });
    }
    cur = NM('mandible');
    // 下顎骨: 下顎体（おとがい → 下顎角の U 字の帯。縦に高く、厚さ 1cm ほど）と、
    //   下顎枝（下顎角から上へ。後ろの関節突起は耳の前の関節へ、前の筋突起は頬骨弓の内側へ。あいだに下顎切痕）
    {
      const half = [[0.000, -0.208, 0.074], [0.016, -0.207, 0.068], [0.030, -0.204, 0.052], [0.040, -0.201, 0.034], [0.046, -0.198, 0.014], [0.050, -0.195, -0.004]];
      const line = curve([...half.slice().reverse().map(([x, y, z]) => Hp(-x, y, z)), ...half.slice(1).map(([x, y, z]) => Hp(x, y, z))], 31);
      add(tube(line, t => (0.0050 + 0.0006 * Math.cos(Math.PI * (t - 0.5) * 2) ** 2) * kx, { seg: 10, ell: { axis: UP, ratio: 2.3 } }), { center: C });
      add(ellipsoid(Hp(0, -0.214, 0.077), R(0.011, 0.006, 0.004)), { center: C });   // おとがい隆起
    }
    for (const sx of [1, -1]) {
      const gB = Hp(sx * 0.050, -0.204, -0.008), gF = Hp(sx * 0.048, -0.192, 0.018);
      const cond = Hp(sx * 0.054, -0.143, -0.013), notch = Hp(sx * 0.051, -0.160, 0.004), coro = Hp(sx * 0.047, -0.149, 0.022);
      const rows = [];
      for (let j = 0; j <= 4; j++) {
        const t = j / 4;
        rows.push([gB.clone().lerp(cond, t), gB.clone().lerp(gF, 0.5).lerp(notch, t), gF.clone().lerp(coro, t)]);
      }
      add(slab(rows, 0.0045 * kx), { center: C });
      add(ellipsoid(cond.clone(), R(0.010, 0.005, 0.006)), { center: C });            // 下顎頭
      add(ellipsoid(gB.clone().lerp(gF, 0.3).add(V3(0, 0.003 * ky, 0)), R(0.006, 0.008, 0.008)), { center: C });   // 下顎角
    }
    // 頭蓋骨全体を一つのまとまりとして、形を保ったまま素体の頭に収める
    const all = [];
    for (const mat of Object.keys(pieces)) for (const pc of pieces[mat]) all.push({ ...pc, mat });
    const unitGeo = all.length ? mergeGeometries(all.map(pc => pc.geo), false) : null;
    if (unitGeo) {
      const back = V3(0, 0, -1);
      const best = P.searchUnit(unitGeo, C, back, 0.002 * s);
      ctx.skullFit = best;
      unitGeo.dispose();
      for (const pc of all) {
        Parts.applyUnit(pc.geo, C, back, best);
        P.add(map.head, pc.geo, { group: skull, mat: pc.mat, fit: 'none', name: pc.name });
      }
    }
  }

  // ---- 肩（鎖骨・肩甲骨） ---------------------------------------------------
  // 肩甲骨: 胸郭の背中（肋骨角のすぐ後ろ）に乗る三角の板。内側縁は背骨から 6cm ほど外を縦に走り、
  //   上角は第2胸椎、下角は第7〜第8胸椎の高さ。板の面は前額面から約 35° 前へ回り、外の角の関節窩は前外側を向く。
  //   背面の肩甲棘は内側縁（第3胸椎の高さ）から外上へ高くなり、肩峰となって上腕骨頭の上にかぶさる。
  //   烏口突起は関節窩の上から前へ曲がる鉤。
  // 鎖骨: 胸骨柄の鎖骨切痕（胸鎖関節）→ 肩峰の内側の縁（肩鎖関節）。内側 2/3 は前へ凸、外側 1/3 は前へ凹（S 字）。
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const sh = map['shoulder' + side], ua = map['upperArm' + side];
    if (!ua) continue;
    const GH = W(ua);                                   // 肩関節（上腕骨頭の中心）
    const holder = sh || chestBone;
    const nSc = NM('scapula', sx);
    // 内側縁（関節窩の高さ）と、板の水平の向き d（内側縁 → 関節窩。前外側を向く）
    const Mx = cx + sx * 0.060 * kxC * s;
    const Mz = ribBackZ(GH.y - 0.04 * s) - 0.010 * s;
    let d = V3(GH.x - sx * 0.024 * s - Mx, 0, GH.z - Mz);
    if (d.lengthSq() < 1e-8) d.set(sx, 0, 0.5);
    d.normalize();
    // 板の面は前額面から 30〜42° 前へ回る（素体の肩が前にあっても、背中から浮かないように）
    {
      const ang = clamp(Math.atan2(d.z, Math.abs(d.x)), 30 * Math.PI / 180, 42 * Math.PI / 180);
      d.set(sx * Math.cos(ang), 0, Math.sin(ang));
    }
    const M0 = V3(Mx, GH.y, Mz);
    const Wd = Math.max(0.05 * s, (GH.x - sx * 0.024 * s - M0.x) * sx / Math.max(0.3, d.x * sx));
    const G = M0.clone().addScaledVector(d, Wd);          // 関節窩の中心（板の外の端）
    const n = V3(-d.z * sx, 0, d.x * sx).multiplyScalar(sx).normalize();   // 板の前（肋骨の方）
    if (n.z < 0) n.negate();
    const Q = (u, v, out = 0) => M0.clone().addScaledVector(d, u * Wd).add(V3(0, v * s, 0))
      .addScaledVector(n, -(0.006 * Math.sin(Math.PI * clamp(u, 0, 1)) + out) * s);   // 背中へ少しふくらむ
    // 板の輪郭（u: 内側縁 0 → 関節窩 1、v: 関節窩の中心からの高さ m）
    const U = [-0.01, 0.12, 0.30, 0.55, 0.78, 0.92, 1.0];
    const VT = [0.036, 0.040, 0.036, 0.030, 0.024, 0.020, 0.017];
    const VB = [-0.080, -0.128, -0.108, -0.078, -0.046, -0.030, -0.017];
    const rows = [];
    for (let j = 0; j <= 6; j++) {
      const row = [];
      for (let i = 0; i < U.length; i++) row.push(Q(U[i], lerp(VB[i], VT[i], j / 6)));
      rows.push(row);
    }
    const plateC = Q(0.45, -0.04);
    P.add(holder, slab(rows, 0.0045 * s), { center: plateC, name: nSc, minScale: 0.8 });
    // 外側縁の厚いふち
    P.add(holder, tube(curve(U.map((u, i) => Q(u, VB[i] + 0.003)).slice(1), 10), 0.0035 * s, { seg: 7 }), { center: plateC, name: nSc, minScale: 0.8 });
    // 関節窩（前外側を向く縦長の浅いお椀）と頸
    {
      const rim = new THREE.TorusGeometry(0.0115 * s, 0.0028 * s, 6, 16);
      rim.scale(1, 1.45, 1);
      rim.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), d));
      rim.translate(G.x, G.y, G.z);
      P.add(holder, finish(rim), { center: G.clone(), name: NM('glenoid', sx) });
      P.add(holder, ellipsoid(G.clone().addScaledVector(d, -0.006 * s), [0.012 * s, 0.017 * s, 0.006 * s], [V3().crossVectors(UP, d).normalize(), UP, d]), { center: G.clone(), name: NM('glenoid', sx) });
    }
    // 肩甲棘（内側縁から外上へ、後ろへ高くなる稜線）→ 肩峰（上腕骨頭の上の平たい板）
    const spRoot = Q(0.0, 0.004, 0.002), spMid = Q(0.5, 0.016, 0.010), spEnd = Q(0.86, 0.030, 0.016);
    P.add(holder, tube(curve([spRoot, spMid, spEnd], 10), t => (0.0032 + 0.003 * t) * s, { seg: 8, ell: { axis: UP, ratio: 1.5 } }),
      { axis: [spRoot, spEnd], fit: 'axis', minScale: 0.7, name: NM('acromion', sx) });
    const acroTip = GH.clone().add(V3(sx * 0.010 * s, 0.031 * s, 0.010 * s));
    const acroBack = GH.clone().add(V3(sx * 0.012 * s, 0.030 * s, -0.016 * s));
    const AC = GH.clone().add(V3(-sx * 0.008 * s, 0.033 * s, 0.006 * s));    // 肩鎖関節
    P.add(holder, tube(curve([spEnd, acroBack, acroTip], 8), 0.0085 * s, { seg: 8, ell: { axis: UP, ratio: 0.42 } }),
      { center: GH.clone(), minScale: 0.75, name: NM('acromion', sx) });
    // 烏口突起
    const corBase = Q(0.80, 0.022), corTip = GH.clone().add(V3(-sx * 0.020 * s, 0.010 * s, 0.030 * s));
    P.add(holder, tube(curve([corBase, corBase.clone().add(V3(0, 0.010 * s, 0)).addScaledVector(n, 0.008 * s), corTip], 8),
      t => (0.0050 - 0.0012 * t) * s, { seg: 7 }), { center: G.clone(), minScale: 0.7, name: NM('coracoid', sx) });
    // 鎖骨
    const SC = V3(cx + sx * 0.024 * kxC * s, ySN + 0.006 * s, stZf(ySN) - 0.010 * s);
    const L2 = (t, dy, dz) => SC.clone().lerp(AC, t).add(V3(0, dy * s, dz * s));
    const clav = curve([SC, L2(0.30, 0.006, 0.014), L2(0.62, 0.011, 0.010), L2(0.84, 0.010, -0.002), AC], 16);
    P.add(holder, tube(clav, t => (0.0064 - 0.0010 * t) * s, { seg: 9, ell: { axis: UP, ratio: 0.72 } }), { axis: [SC, AC], fit: 'axis', minScale: 0.7, name: NM('clavicle', sx) });
  }

  // ---- 腕（上腕骨・橈骨・尺骨・手） -----------------------------------------
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const ua = map['upperArm' + side], fa = map['forearm' + side], hd = map['hand' + side];
    if (!ua || !fa) continue;
    const GH = W(ua), EL = W(fa), WR = hd ? W(hd) : EL.clone().add(V3(0, -0.26 * s, 0));
    const armLen = GH.distanceTo(EL), ka = armLen / 0.30;
    const nHum = NM('humerus', sx), nUl = NM('ulna', sx), nRad = NM('radius', sx);
    const dU = EL.clone().sub(GH).normalize();
    const latU = V3(sx, 0, 0).addScaledVector(dU, -dU.x * sx).normalize();     // 腕の外側
    const fwd = V3().crossVectors(latU, dU).multiplyScalar(sx).normalize();     // 腕の前
    // 上腕骨: 骨頭 → 大結節 → 骨幹 → 内側・外側上顆と滑車
    P.add(ua, ellipsoid(GH.clone(), [0.022 * ka, 0.023 * ka, 0.022 * ka]), { center: GH.clone(), name: nHum });
    P.add(ua, ellipsoid(GH.clone().addScaledVector(latU, 0.017 * ka).addScaledVector(fwd, 0.006 * ka).addScaledVector(dU, 0.008 * ka),
      [0.011 * ka, 0.012 * ka, 0.011 * ka]), { center: GH.clone(), name: nHum });
    const sA = GH.clone().addScaledVector(dU, 0.018 * ka), sB = EL.clone().addScaledVector(dU, -0.012 * ka);
    P.add(ua, tube([sA, sA.clone().lerp(sB, 0.5), sB], t => (0.0115 - 0.0015 * Math.sin(Math.PI * t) + 0.004 * Math.pow(t, 4)) * ka, { seg: 12 }), { axis: [GH, EL], fit: 'axis', name: nHum });
    P.add(ua, ellipsoid(EL.clone().addScaledVector(dU, -0.006 * ka).addScaledVector(fwd, 0.003 * ka),
      [0.026 * ka, 0.011 * ka, 0.013 * ka], [latU, dU.clone().negate(), fwd]), { center: EL.clone(), name: nHum });
    P.add(ua, ellipsoid(EL.clone().addScaledVector(latU, -0.028 * ka).addScaledVector(dU, -0.010 * ka), [0.008 * ka, 0.010 * ka, 0.008 * ka]), { center: EL.clone(), name: nHum });
    P.add(ua, ellipsoid(EL.clone().addScaledVector(latU, 0.021 * ka).addScaledVector(dU, -0.010 * ka), [0.006 * ka, 0.008 * ka, 0.006 * ka]), { center: EL.clone(), name: nHum });

    // 前腕: 手のひらを腿へ向けた（中間位）とき、橈骨は親指側、尺骨は小指側を走る
    const dF = WR.clone().sub(EL).normalize();
    let radial = fwd.clone();
    if (ctx.handFrame && ctx.handFrame[side]) radial = ctx.handFrame[side].radial.clone();
    radial.addScaledVector(dF, -radial.dot(dF)).normalize();
    const latF = V3(sx, 0, 0).addScaledVector(dF, -dF.x * sx).normalize();
    const backF = V3().crossVectors(dF, latF).multiplyScalar(sx).negate().normalize();
    // 尺骨: 肘頭（肘の後ろの出っぱり）から手首の小指側へ
    const olec = EL.clone().addScaledVector(backF, 0.016 * ka).addScaledVector(dF, -0.016 * ka).addScaledVector(latF, -0.004 * ka);
    const ulnaTop = EL.clone().addScaledVector(latF, -0.006 * ka).addScaledVector(dF, 0.006 * ka);
    const ulnaBot = WR.clone().addScaledVector(radial, -0.011 * ka).addScaledVector(dF, -0.012 * ka);
    P.add(fa, tube(curve([olec, ulnaTop, ulnaTop.clone().lerp(ulnaBot, 0.5), ulnaBot], 10),
      t => (t < 0.25 ? 0.010 : lerp(0.0075, 0.0050, (t - 0.25) / 0.75)) * ka, { seg: 10 }), { axis: [EL, WR], fit: 'axis', name: nUl });
    P.add(fa, ellipsoid(ulnaBot.clone().addScaledVector(dF, 0.004 * ka), [0.0065 * ka, 0.006 * ka, 0.0065 * ka]), { center: ulnaBot.clone(), name: nUl });
    // 橈骨: 橈骨頭（肘の外側）から手首の親指側へ太くなる
    const radTop = EL.clone().addScaledVector(latF, 0.014 * ka).addScaledVector(dF, 0.010 * ka);
    const radBot = WR.clone().addScaledVector(radial, 0.009 * ka).addScaledVector(dF, -0.012 * ka);
    P.add(fa, ellipsoid(radTop.clone(), [0.010 * ka, 0.006 * ka, 0.010 * ka], [latF, dF.clone().negate(), V3().crossVectors(latF, dF.clone().negate())]), { center: radTop.clone(), name: nRad });
    P.add(fa, tube([radTop.clone().addScaledVector(dF, 0.006 * ka), radTop.clone().lerp(radBot, 0.5), radBot],
      t => lerp(0.0055, 0.0095, t * t) * ka, { seg: 10 }), { axis: [EL, WR], fit: 'axis', name: nRad });
    P.add(fa, ellipsoid(radBot.clone().addScaledVector(dF, 0.004 * ka), [0.013 * ka, 0.007 * ka, 0.010 * ka],
      [radial, dF.clone().negate(), V3().crossVectors(radial, dF.clone().negate())]), { center: radBot.clone(), name: nRad });

    // 手: 手根骨（2列×4）・中手骨・指骨
    const fg = ctx.fingers && ctx.fingers[side];
    const hf = ctx.handFrame && ctx.handFrame[side];
    if (hd && fg && hf) {
      const mid1 = fg.middle && fg.middle[1];
      const handLen = mid1 ? WR.distanceTo(W(mid1)) : 0.09 * s;
      const kh = handLen / 0.090;
      const along = hf.along, rad = hf.radial, palm = hf.palmar;
      // 手根骨 8 個。近位列（舟状骨・月状骨・三角骨・豆状骨）と遠位列（大菱形骨・小菱形骨・有頭骨・有鉤骨）。
      //   off … 親指側への位置、at … 手首から指先へ、pa … 手のひら側へ、r … 半径（親指側・指先方向・手のひら方向）
      const CARPALS = [
        { id: 'scaphoid',   off: 0.0115,  at: 0.011, pa: 0.0015, r: [0.0074, 0.0050, 0.0050], tilt: 0.5 },
        { id: 'lunate',     off: 0.0015,  at: 0.010, pa: 0.0005, r: [0.0055, 0.0056, 0.0054] },
        { id: 'triquetrum', off: -0.0085, at: 0.011, pa: -0.0005, r: [0.0050, 0.0050, 0.0046] },
        { id: 'pisiform',   off: -0.0105, at: 0.012, pa: 0.0068, r: [0.0034, 0.0036, 0.0032] },
        { id: 'trapezium',  off: 0.0140,  at: 0.025, pa: 0.0030, r: [0.0055, 0.0056, 0.0050], tilt: -0.4 },
        { id: 'trapezoid',  off: 0.0065,  at: 0.026, pa: 0.0000, r: [0.0042, 0.0050, 0.0046] },
        { id: 'capitate',   off: -0.0005, at: 0.026, pa: 0.0005, r: [0.0050, 0.0076, 0.0056] },
        { id: 'hamate',     off: -0.0095, at: 0.025, pa: 0.0005, r: [0.0056, 0.0062, 0.0054] },
      ];
      for (const cp of CARPALS) {
        const ctr = WR.clone().addScaledVector(along, cp.at * kh).addScaledVector(rad, cp.off * kh).addScaledVector(palm, cp.pa * kh);
        let ex = rad, ey = along;
        if (cp.tilt) {
          ex = rad.clone().multiplyScalar(Math.cos(cp.tilt)).addScaledVector(along, Math.sin(cp.tilt)).normalize();
          ey = V3().crossVectors(palm, ex).normalize();
          if (ey.dot(along) < 0) ey.negate();
        }
        P.add(hd, ellipsoid(ctr, cp.r.map(v => v * kh), [ex, ey, palm]), { center: ctr.clone(), name: NM(cp.id, sx) });
      }
      // 有鉤骨の鉤（手のひら側の小さな突起）
      {
        const hk = WR.clone().addScaledVector(along, 0.027 * kh).addScaledVector(rad, -0.0105 * kh).addScaledVector(palm, 0.0062 * kh);
        P.add(hd, ellipsoid(hk, [0.0024 * kh, 0.0040 * kh, 0.0030 * kh], [rad, along, palm]), { center: hk.clone(), name: NM('hamate', sx) });
      }
      // 中手骨（人差し指〜小指）
      const baseOff = { index: 0.011, middle: 0.004, ring: -0.005, pinky: -0.013 };
      for (const f of ['index', 'middle', 'ring', 'pinky']) {
        const k1 = fg[f] && fg[f][1];
        if (!k1) continue;
        const nMC = NM('metacarpal', sx, { n: { index: 2, middle: 3, ring: 4, pinky: 5 }[f] });
        const A = WR.clone().addScaledVector(along, 0.032 * kh).addScaledVector(rad, baseOff[f] * kh);
        const B = W(k1).addScaledVector(W(k1).sub(A).normalize(), -0.004 * kh);
        P.add(hd, tube([A, A.clone().lerp(B, 0.5).addScaledVector(palm, -0.002 * kh), B],
          t => lerp(0.0042, 0.0034, Math.sin(Math.PI * t)) * kh, { seg: 8 }), { axis: [A, B], fit: 'axis', name: nMC });
        P.add(hd, ellipsoid(B, [0.0050 * kh, 0.0050 * kh, 0.0050 * kh]), { center: B.clone(), name: nMC });   // 中手骨頭（こぶしの山）
      }
      // 指骨（基節・中節・末節）。親指は 1 が中手骨、2 が基節、3 が末節
      const RAD = { thumb: [0.0052, 0.0047, 0.0040], index: [0.0042, 0.0036, 0.0031], middle: [0.0044, 0.0037, 0.0032],
        ring: [0.0041, 0.0035, 0.0030], pinky: [0.0036, 0.0031, 0.0027] };
      for (const f of Object.keys(fg)) {
        const segs = fg[f];
        for (let k = 1; k <= 3; k++) {
          const b = segs[k];
          if (!b) continue;
          const nb = segs[k + 1] || b.children.find(c => c.isBone);
          if (!nb) continue;
          const A = W(b), B = W(nb);
          const L = A.distanceTo(B);
          if (L < 1e-5) continue;
          const d = B.clone().sub(A).divideScalar(L);
          const isTip = !segs[k + 1];
          const r = (RAD[f] || RAD.index)[k - 1] * kh;
          // 親指は 1 が中手骨・2 が基節骨・3 が末節骨。ほかの指は 1・2・3 が基節・中節・末節
          const nPh = f === 'thumb'
            ? (k === 1 ? NM('metacarpal', sx, { n: 1 }) : NM(k === 2 ? 'phalanxP' : 'phalanxD', sx, { finger: f }))
            : NM(['phalanxP', 'phalanxM', 'phalanxD'][k - 1], sx, { finger: f });
          const a2 = A.clone().addScaledVector(d, 0.0025 * kh), b2 = B.clone().addScaledVector(d, isTip ? -0.003 * kh : -0.0025 * kh);
          P.add(b, tube([a2, a2.clone().lerp(b2, 0.5), b2], t => r * (1 - 0.18 * Math.sin(Math.PI * t)) * (isTip ? 1 - 0.35 * t : 1), { seg: 8 }),
            isTip ? { center: A.clone(), name: nPh } : { axis: [A, B], fit: 'axis', name: nPh });
          if (!isTip) P.add(b, ellipsoid(b2.clone(), [r * 1.15, r * 1.0, r * 1.05]), { center: b2.clone(), name: nPh });
        }
      }
    }
  }

  // ---- 脚（大腿骨・膝蓋骨・脛骨・腓骨・足） ---------------------------------
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const th = map['thigh' + side], sn = map['shin' + side], ft = map['foot' + side];
    if (!th || !sn) continue;
    const HJ = W(th), KN = W(sn), AN = ft ? W(ft) : KN.clone().add(V3(0, -0.42 * s, 0));
    const fl = HJ.distanceTo(KN), kf = fl / 0.43;
    const nFem = NM('femur', sx), nTib = NM('tibia', sx), nFib = NM('fibula', sx);
    const dT = KN.clone().sub(HJ).normalize();
    const lat = V3(sx, 0, 0).addScaledVector(dT, -dT.x * sx).normalize();
    const fwd = V3().crossVectors(lat, dT).multiplyScalar(-sx).normalize();
    if (fwd.z < 0) fwd.negate();
    // 大腿骨頭・頸（頸体角 125°・前捻 12°）・大転子・小転子
    P.add(th, ellipsoid(HJ.clone(), [0.023 * kf, 0.023 * kf, 0.023 * kf]), { center: HJ.clone(), name: nFem });
    const neckEnd = HJ.clone().addScaledVector(lat, 0.042 * kf).addScaledVector(dT, 0.030 * kf).addScaledVector(fwd, -0.010 * kf);
    P.add(th, rod(HJ.clone().addScaledVector(lat, 0.012 * kf), neckEnd, 0.014 * kf, 0.016 * kf, 10, { axis: fwd, ratio: 0.8 }), { axis: [HJ, KN], fit: 'axis', name: nFem });
    const gT = HJ.clone().addScaledVector(lat, 0.058 * kf).addScaledVector(dT, 0.012 * kf).addScaledVector(fwd, -0.006 * kf);
    P.add(th, ellipsoid(gT, [0.014 * kf, 0.022 * kf, 0.018 * kf], [lat, dT.clone().negate(), fwd]), { axis: [HJ, KN], fit: 'axis', name: nFem });
    const lT = HJ.clone().addScaledVector(lat, 0.026 * kf).addScaledVector(dT, 0.062 * kf).addScaledVector(fwd, -0.014 * kf);
    P.add(th, ellipsoid(lT, [0.008 * kf, 0.010 * kf, 0.008 * kf]), { center: lT.clone(), name: nFem });
    // 骨幹: 大転子の下から、膝の上へ（下ほど内側＝膝の真上へ寄る）
    const shTop = HJ.clone().addScaledVector(lat, 0.040 * kf).addScaledVector(dT, 0.055 * kf).addScaledVector(fwd, -0.004 * kf);
    const shBot = KN.clone().addScaledVector(dT, -0.034 * kf).addScaledVector(fwd, -0.005 * kf);
    P.add(th, tube([shTop, shTop.clone().lerp(shBot, 0.5).addScaledVector(fwd, 0.004 * kf), shBot],
      t => lerp(0.0135, 0.0215, Math.pow(t, 3)) * kf, { seg: 12 }), { axis: [HJ, KN], fit: 'axis', name: nFem });
    // 大腿骨の下端（内側顆・外側顆）
    for (const m of [1, -1]) {
      const cd = KN.clone().addScaledVector(lat, m * 0.021 * kf).addScaledVector(dT, -0.0235 * kf).addScaledVector(fwd, -0.006 * kf);
      P.add(th, ellipsoid(cd, [0.016 * kf, 0.021 * kf, 0.025 * kf], [lat, dT.clone().negate(), fwd]), { center: KN.clone(), name: nFem });
    }
    // 膝蓋骨（ひざの皿）
    const pat = KN.clone().addScaledVector(dT, -0.024 * kf).addScaledVector(fwd, 0.034 * kf);
    P.add(th, ellipsoid(pat, [0.020 * kf, 0.023 * kf, 0.009 * kf], [lat, dT.clone().negate(), fwd]), { center: KN.clone().addScaledVector(dT, -0.02 * kf), name: NM('patella', sx) });

    // 脛骨: 脛骨高原 → 脛骨粗面 → 骨幹 → 内くるぶし
    const dS = AN.clone().sub(KN).normalize();
    const latS = V3(sx, 0, 0).addScaledVector(dS, -dS.x * sx).normalize();
    const fwdS = V3().crossVectors(latS, dS).multiplyScalar(-sx).normalize();
    if (fwdS.z < 0) fwdS.negate();
    const plat = KN.clone().addScaledVector(dS, 0.0105 * kf);
    const pg = new THREE.CylinderGeometry(1, 1, 0.016 * kf, 16);
    pg.scale(0.036 * kf, 1, 0.025 * kf);
    pg.applyMatrix4(basisMatrix(latS, dS.clone().negate(), V3().crossVectors(latS, dS.clone().negate())));
    pg.translate(plat.x, plat.y, plat.z);
    P.add(sn, finish(pg), { center: plat.clone(), name: nTib });
    // 半月板（内側・外側の C 字の軟骨）
    for (const m of [1, -1]) {
      const mc = KN.clone().addScaledVector(latS, m * 0.019 * kf).addScaledVector(dS, 0.0015 * kf).addScaledVector(fwdS, -0.004 * kf);
      const men = new THREE.TorusGeometry(0.013 * kf, 0.0028 * kf, 6, 16, Math.PI * 1.6);
      men.rotateX(Math.PI / 2);
      men.rotateY(m > 0 ? Math.PI * 0.7 : -Math.PI * 0.3);
      men.applyMatrix4(basisMatrix(latS, dS.clone().negate(), V3().crossVectors(latS, dS.clone().negate())));
      men.translate(mc.x, mc.y, mc.z);
      P.add(sn, finish(men), { mat: 'cart', axis: [KN, AN], fit: 'axis', name: NM('meniscus', sx) });
    }
    P.add(sn, ellipsoid(KN.clone().addScaledVector(dS, 0.045 * kf).addScaledVector(fwdS, 0.020 * kf), [0.010 * kf, 0.014 * kf, 0.007 * kf]), { center: KN.clone().addScaledVector(dS, 0.045 * kf), name: nTib });
    const tA = KN.clone().addScaledVector(dS, 0.016 * kf).addScaledVector(latS, -0.002 * kf);
    const tB = AN.clone().addScaledVector(dS, -0.024 * kf).addScaledVector(latS, -0.002 * kf);
    P.add(sn, tube([tA, tA.clone().lerp(tB, 0.5), tB], t => lerp(0.0145, 0.0115, Math.sin(Math.PI * t * 0.9)) * kf, { seg: 12 }),
      { axis: [KN, AN], fit: 'axis', margin: 0.009 * s, name: nTib });
    P.add(sn, ellipsoid(AN.clone().addScaledVector(dS, -0.012 * kf).addScaledVector(latS, -0.003 * kf), [0.016 * kf, 0.012 * kf, 0.014 * kf]), { center: AN.clone(), name: nTib });
    const medMal = AN.clone().addScaledVector(latS, -0.020 * kf).addScaledVector(dS, 0.004 * kf);
    P.add(sn, ellipsoid(medMal, [0.007 * kf, 0.014 * kf, 0.010 * kf]), { axis: [KN, AN], fit: 'axis', margin: 0.006 * s, name: nTib });
    // 腓骨: 外側・やや後ろ。外くるぶしは内くるぶしより低い
    const fibTop = KN.clone().addScaledVector(dS, 0.032 * kf).addScaledVector(latS, 0.028 * kf).addScaledVector(fwdS, -0.012 * kf);
    const latMal = AN.clone().addScaledVector(latS, 0.022 * kf).addScaledVector(dS, 0.014 * kf).addScaledVector(fwdS, -0.008 * kf);
    P.add(sn, ellipsoid(fibTop, [0.008 * kf, 0.009 * kf, 0.008 * kf]), { axis: [KN, AN], fit: 'axis', name: nFib });
    P.add(sn, rod(fibTop, latMal.clone().addScaledVector(dS, -0.010 * kf), 0.0055 * kf, 0.0050 * kf, 8), { axis: [KN, AN], fit: 'axis', margin: 0.006 * s, name: nFib });
    P.add(sn, ellipsoid(latMal, [0.007 * kf, 0.016 * kf, 0.010 * kf]), { axis: [KN, AN], fit: 'axis', name: nFib });

    // 足: 距骨・踵骨・舟状骨・立方骨・楔状骨・中足骨・趾骨。
    // 位置は 足首（Foot）・つま先の関節（ToeBase＝中足趾節関節）・かかとの後ろ・床 から決める。
    if (ft) {
      const toe = ft.children.find(c => c.isBone);
      const TB = toe ? W(toe) : AN.clone().add(V3(0, -0.07 * s, 0.10 * s));
      const fwdF = TB.clone().sub(AN); fwdF.y = 0;
      if (fwdF.lengthSq() < 1e-10) fwdF.set(0, 0, 1);
      fwdF.normalize();
      const latF = V3().crossVectors(fwdF, UP).multiplyScalar(-sx).normalize();   // 足の外側
      const floor = ctx.foot && ctx.foot[side] ? ctx.foot[side].sole : ctx.floor;
      const heel = ctx.foot && ctx.foot[side] ? ctx.foot[side].heel : -0.055 * s;   // 足首から後ろへ（負）
      const mtp = TB.clone().sub(AN).dot(fwdF);                                      // 足首→つま先の関節
      const kk = (mtp - heel) / 0.165;                                               // 成人で かかと〜MTP 約16.5cm
      const F = (f, l, y) => AN.clone().addScaledVector(fwdF, f).addScaledVector(latF, l * kk).setY(floor + y * kk);
      const basis = [latF, UP, fwdF];
      const ankH = (AN.y - floor) / kk;
      // 足の骨は、はみ出したら足の中心線（かかと〜指の付け根の少し先）へ寄せて縮める
      const fAx = [F(heel + 0.012 * kk, 0, 0.032), F(mtp + 0.050 * kk, 0, 0.026)];
      const FA = { axis: fAx, fit: 'axis', minScale: 0.55 };
      // 距骨（足首の関節のすぐ下。上面は丸い滑車）
      P.add(ft, ellipsoid(F(0.004 * kk, 0, ankH - 0.015), [0.016 * kk, 0.015 * kk, 0.024 * kk], basis), { center: AN.clone(), name: NM('talus', sx) });
      P.add(ft, ellipsoid(F(0.026 * kk, -0.006, ankH - 0.026), [0.010 * kk, 0.009 * kk, 0.010 * kk], basis), { ...FA, name: NM('talus', sx) });   // 距骨頭
      // 踵骨（かかと）: 後ろの隆起は床のすぐ上、前は立方骨へ
      const hb = heel + 0.010 * kk;
      const calA = F(hb + 0.014 * kk, 0.003, 0.030), calB = F(0.030 * kk, 0.010, 0.032);
      P.add(ft, tube([calA, calA.clone().lerp(calB, 0.5).add(V3(0, 0.008 * kk, 0)), calB], t => lerp(0.020, 0.014, t) * kk, { seg: 12 }), { ...FA, name: NM('calcaneus', sx) });
      P.add(ft, ellipsoid(F(hb + 0.011 * kk, 0.003, 0.024), [0.015 * kk, 0.020 * kk, 0.013 * kk], basis), { ...FA, name: NM('calcaneus', sx) });   // 踵骨隆起
      // 舟状骨（内側）・立方骨（外側）・楔状骨（3つ）
      const mid = f => heel + (mtp - heel) * f;
      P.add(ft, ellipsoid(F(mid(0.47), -0.012, 0.042), [0.012 * kk, 0.010 * kk, 0.008 * kk], basis), { ...FA, name: NM('navicular', sx) });
      P.add(ft, ellipsoid(F(mid(0.50), 0.016, 0.024), [0.011 * kk, 0.011 * kk, 0.013 * kk], basis), { ...FA, name: NM('cuboid', sx) });
      for (const [l, y, id] of [[-0.020, 0.038, 'cuneiformM'], [-0.006, 0.040, 'cuneiformI'], [0.006, 0.036, 'cuneiformL']]) {
        P.add(ft, ellipsoid(F(mid(0.58), l, y), [0.0065 * kk, 0.010 * kk, 0.010 * kk], basis), { ...FA, name: NM(id, sx) });
      }
      // 中足骨（第1〜第5）: 付け根はリスフラン関節、骨頭はつま先の関節の並び
      const MT = [
        { base: [0.64, -0.020, 0.040], head: [0.010, -0.024, 0.024], r: 0.0066, ph: [0.028, 0.022] },
        { base: [0.66, -0.007, 0.042], head: [0.012, -0.008, 0.024], r: 0.0042, ph: [0.019, 0.010, 0.008] },
        { base: [0.65, 0.005, 0.038], head: [0.006, 0.004, 0.023], r: 0.0040, ph: [0.017, 0.009, 0.008] },
        { base: [0.62, 0.016, 0.033], head: [-0.004, 0.015, 0.022], r: 0.0038, ph: [0.015, 0.008, 0.007] },
        { base: [0.56, 0.027, 0.026], head: [-0.016, 0.025, 0.021], r: 0.0040, ph: [0.013, 0.007, 0.006] },
      ];
      MT.forEach((m, mi) => {
        const nMT = NM('metatarsal', sx, { n: mi + 1 });
        const A = F(mid(m.base[0]), m.base[1], m.base[2]);
        const B = F(mtp + m.head[0] * kk, m.head[1], m.head[2]);
        P.add(ft, tube([A, A.clone().lerp(B, 0.5).add(V3(0, 0.003 * kk, 0)), B], t => m.r * kk * (1 - 0.2 * Math.sin(Math.PI * t)), { seg: 8 }), { ...FA, name: nMT });
        P.add(ft, ellipsoid(B, [m.r * 1.15 * kk, m.r * 1.1 * kk, m.r * 1.1 * kk]), { ...FA, name: nMT });
        // 趾骨はつま先の骨（ToeBase）にぶら下げる
        let p0 = B.clone().addScaledVector(fwdF, m.r * 1.2 * kk);
        for (let i = 0; i < m.ph.length; i++) {
          const L = m.ph[i] * kk;
          const p1 = p0.clone().addScaledVector(fwdF, L).add(V3(0, -0.0006 * kk * (i + 1), 0));
          const rr = m.r * kk * (0.82 - 0.12 * i);
          // 母趾は基節骨と末節骨の 2 つ、ほかは 3 つ
          const seg = m.ph.length === 2 && i === 1 ? 2 : i;
          P.add(toe || ft, tube([p0, p1], t => rr * (1 - 0.15 * t), { seg: 7 }), { ...FA, name: NM('toePhalanx', sx, { n: mi + 1, seg }) });
          p0 = p1.clone().addScaledVector(fwdF, 0.0015 * kk);
        }
      });
    }
  }
}

/**
 * スロットのボーンに沿って骨格を組み立てる。
 * 呼ぶ前に骨を基準姿勢（ポーズなし・倍率 1）に戻しておくこと。
 * @param {object} slot   viewer のスロット
 * @param {object} extra  { handFrame: {L, R}, skullGroup }
 * @returns {THREE.Mesh[]} 作ったメッシュ（各ボーンの子として追加済み・初期は非表示）
 */
export function buildSkeletonView(slot, extra = {}) {
  if (!slot.skeleton || !Object.keys(slot.boneMap || {}).length) return [];
  const map = slot.boneMap;
  if (!map.hips) return [];
  slot.pivot.updateWorldMatrix(true, true);
  const W = b => b.getWorldPosition(V3());
  const J = {};
  for (const [k, b] of Object.entries(map)) J[k] = W(b);

  const T0 = performance.now();
  const body = measureBody(slot);
  const T1 = performance.now();
  // 背丈と床
  let floor = Infinity, top = -Infinity;
  for (let i = 0; i < body.count; i++) { const y = body.pos[i * 3 + 1]; if (y < floor) floor = y; if (y > top) top = y; }
  if (!isFinite(floor)) { floor = 0; top = 1.7; }
  const H = Math.max(0.3, top - floor);
  const s = H / 1.70;
  const cx = J.hips.x;

  const chain = spineChain(map);
  const trunkBones = new Set(chain.filter(b => b !== map.head));
  for (const k of ['shoulderL', 'shoulderR']) if (map[k]) trunkBones.add(map[k]);
  const armBones = new Set();
  for (const k of ['shoulderL', 'shoulderR']) if (map[k]) armBones.add(map[k]);
  const prof = body.count ? trunkProfile(body, trunkBones, armBones, cx, s) : null;

  // 頭の箱（頭のボーンとその先に引っ張られる頂点）
  let head = null;
  if (map.head) {
    const sub = new Set();
    (function walk(b) { sub.add(b); for (const c of b.children) if (c.isBone) walk(c); })(map.head);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity, n = 0;
    for (let i = 0; i < body.count; i++) {
      if (!sub.has(body.dom[i])) continue;
      const x = body.pos[i * 3], y = body.pos[i * 3 + 1], z = body.pos[i * 3 + 2];
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z); n++;
    }
    if (n > 24 && y1 > y0) head = { top: y1, h: y1 - y0, half: Math.max(x1 - cx, cx - x0), zFront: z1, zBack: z0 };
    else {
      const hh = H / 7.5;
      head = { top, h: hh, half: hh * 0.33, zFront: J.head.z + hh * 0.45, zBack: J.head.z - hh * 0.42 };
    }
  }

  // 足の裏の高さと、かかとの後ろ（足首から足の向きに沿って）
  const foot = {};
  for (const side of ['L', 'R']) {
    const fb = map['foot' + side];
    const toe = fb && fb.children.find(c => c.isBone);
    if (!fb || !toe) continue;
    const A = W(fb), dir = W(toe).sub(A); dir.y = 0;
    if (dir.lengthSq() < 1e-10) continue;
    dir.normalize();
    const sub = new Set();
    (function walk(b) { sub.add(b); for (const c of b.children) if (c.isBone) walk(c); })(fb);
    let sole = Infinity, back = Infinity;
    for (let i = 0; i < body.count; i++) {
      if (!sub.has(body.dom[i])) continue;
      const x = body.pos[i * 3], y = body.pos[i * 3 + 1], z = body.pos[i * 3 + 2];
      sole = Math.min(sole, y);
      back = Math.min(back, (x - A.x) * dir.x + (z - A.z) * dir.z);
    }
    if (isFinite(sole) && isFinite(back)) foot[side] = { sole, heel: Math.max(back, -0.09 * s) };
  }

  const P = new Parts(body, 0.0025 * s);
  const ctx = { map, J, s, cx, prof, head, chain, floor, foot, fingers: slot.fingers, handFrame: extra.handFrame, skullGroup: extra.skullGroup };
  build(slot, body, P, ctx);
  const T2 = performance.now();
  P.fit();
  const T3 = performance.now();
  const meshes = P.attach(slot, materials());
  slot.skelDebug = { skullFit: ctx.skullFit, cageFit: ctx.cageFit, kxC: ctx.kxC, cageRatio: ctx.cageRatio, headK: ctx.headK, parts: P.list.length,
    ms: { measure: Math.round(T1 - T0), build: Math.round(T2 - T1), fit: Math.round(T3 - T2), attach: Math.round(performance.now() - T3) } };
  return meshes;
}

// ===== skeletonView.js ここまで =====
