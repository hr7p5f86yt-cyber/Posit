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

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

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
    if (m.userData.headPlane || m.userData.bonePart || m.userData.wire) continue;
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
    for (let t = 0; t < nTouched; t++) {
      const i = bestI[touched[t]], i3 = i * 3;
      const sd = (px - pos[i3]) * nor[i3] + (py - pos[i3 + 1]) * nor[i3 + 1] + (pz - pos[i3 + 2]) * nor[i3 + 2];
      if (sd < best) best = sd;
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
  return { pos, nor, dom, count, depth, explain, cid };
}

/**
 * 体幹の断面（正中の背中・おなかの面と、体幹の半幅）を高さごとに取る。
 * 背骨・肋骨・胸骨・骨盤の奥行きはここから決める。
 */
function trunkProfile(body, trunkBones, armBones, cx, s) {
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
  const band = 0.03 * s;
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
      minScale: o.minScale || 0.2 });
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
      if (!g) { g = { holder, bone: part.bone, mat: part.mat, geos: [] }; groups.set(k, g); }
      g.geos.push(part.geo);
    }
    const out = [];
    for (const g of groups.values()) {
      const merged = g.geos.length > 1 ? mergeGeometries(g.geos, false) : g.geos[0];
      if (!merged) continue;
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
      out.push(m);
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// 部位ごとの組み立て
// ---------------------------------------------------------------------------

/** 背骨の並び（腰 → 頭）をリグの親子関係からたどる */
function spineChain(map) {
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
  const S1top = J.hips.y - 0.006 * s;                         // 仙骨の上面 ≒ 腰のボーン
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

  // 椎体の前後の位置: 背中の面から一定の深さ。前の面とのあいだで後ろ寄り 55% に収める
  const backDepth = { C: 0.040, T: 0.052, L: 0.062 };
  for (const L of levels) {
    if (!prof) { L.z = J.hips.z; continue; }
    const zb = prof.back(L.y), zf = prof.front(L.y);
    let z = zb + backDepth[L.region] * s;
    z = Math.min(z, zf - 0.45 * (zf - zb));
    z = Math.max(z, zb + 0.028 * s);
    L.z = z;
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
    if (!isAtlas) {
      // 椎体
      const g = new THREE.CylinderGeometry(1, 1, h, 14, 1);
      g.scale(w / 2, 1, d / 2);
      g.translate(c.x, c.y, c.z);
      P.add(bone, finish(g), { center: c.clone() });
      // 椎間板（上の椎体とのあいだ）
      if (above && above.name !== 'C1') {
        const yd = (L.y + above.y) / 2;
        const zd = (L.z + above.z) / 2;
        const dg = new THREE.CylinderGeometry(1, 1, gap * (L.region === 'L' ? 0.30 : 0.24), 14, 1);
        dg.scale(w / 2 * 0.94, 1, d / 2 * 0.94);
        dg.translate(cx, yd, zd);
        P.add(boneAtY(yd), finish(dg), { mat: 'cart', center: V3(cx, yd, zd) });
      }
    }
    // 椎弓・棘突起・横突起
    const canal = (L.region === 'T' ? 0.0075 : 0.009) * s;
    const archC = c.clone().add(V3(0, 0, -(d / 2 + canal)));
    const ring = new THREE.TorusGeometry(canal + 0.0025 * s, 0.0028 * s, 6, 12, Math.PI * (isAtlas ? 2 : 1.25));
    ring.rotateX(Math.PI / 2);
    ring.rotateY(isAtlas ? 0 : Math.PI * 0.875 + Math.PI);
    ring.translate(archC.x, archC.y, archC.z);
    P.add(bone, finish(ring), { center: c.clone() });
    // 棘突起: 胸椎は下向きに強く傾く
    const drop = L.region === 'T' ? 0.55 + 0.35 * Math.sin(Math.PI * L.k) : (L.region === 'C' ? 0.25 : 0.05);
    const pd = V3(0, -drop, -1).normalize();
    const pa = archC.clone().add(V3(0, 0, -canal));
    const pb = pa.clone().addScaledVector(pd, dim.proc * s);
    if (!isAtlas) P.add(bone, rod(pa, pb, 0.0040 * s, 0.0026 * s, 8, { axis: V3(1, 0, 0), ratio: 0.55 }), { center: c.clone() });
    // 横突起: 胸椎は肋骨を受けるため後ろへ傾く
    for (const sx of [1, -1]) {
      const back = L.region === 'T' ? 0.55 : (L.region === 'C' ? 0.1 : 0.15);
      const ta = archC.clone().add(V3(sx * canal * 0.9, 0, canal * 0.4));
      const tb = ta.clone().add(V3(sx * dim.trans * s, -0.002 * s, -back * dim.trans * s * 0.6));
      P.add(bone, rod(ta, tb, 0.0035 * s, 0.0025 * s, 8), { center: c.clone() });
    }
    L.archC = archC;
    L.h = h; L.w = w; L.d = d;
  }

  // ---- 仙骨・尾骨 ------------------------------------------------------------
  {
    const L5 = vert.L5;
    const pts = [], halfW = [], th = [];
    const N = 8;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const y = S1top - 0.105 * s * t;
      let z = L5.z - 0.004 * s - 0.030 * s * t - 0.030 * s * t * t;
      if (prof) z = Math.max(z, prof.back(y) + 0.014 * s);
      pts.push(V3(cx, y, z));
      halfW.push(0.054 * s * (1 - 0.78 * t));
      th.push(0.030 * s * (1 - 0.55 * t));
    }
    const rows = [];
    for (let i = 0; i <= N; i++) {
      const row = [];
      for (let j = 0; j <= 6; j++) {
        const u = j / 6 * 2 - 1;
        row.push(pts[i].clone().add(V3(u * halfW[i], 0, -Math.abs(u) * 0.006 * s)));
      }
      rows.push(row);
    }
    P.add(map.hips, slab(rows, 0.024 * s), { axis: [pts[0], pts[N]] });
    // 尾骨
    const tip = pts[N];
    const cc = [tip.clone(), tip.clone().add(V3(0, -0.012 * s, 0.002 * s)), tip.clone().add(V3(0, -0.022 * s, 0.008 * s)),
      tip.clone().add(V3(0, -0.030 * s, 0.015 * s))];
    for (let i = 0; i < 3; i++) P.add(map.hips, ellipsoid(cc[i].clone().lerp(cc[i + 1], 0.5), [0.008 * s * (1 - i * 0.22), 0.006 * s, 0.005 * s]), { center: cc[i].clone() });
    ctx.sacrum = { top: pts[0], pts };
  }

  // ---- 骨盤（寛骨） ----------------------------------------------------------
  if (map.thighL && map.thighR) {
    const HL = W(map.thighL), HR = W(map.thighR);
    const IAD = HL.distanceTo(HR) / 0.72;                     // 左右の上前腸骨棘の間隔（Bell）
    const k = IAD / 0.24;
    const sacrum = ctx.sacrum;
    for (const [side, sx, H] of [['L', 1, HL], ['R', -1, HR]]) {
      const at = (x, y, z) => V3(H.x + sx * x * IAD, H.y + y * IAD, H.z + z * IAD);
      const mid = (x, y, z) => V3(cx + sx * x * IAD, H.y + y * IAD, H.z + z * IAD);
      // 腸骨稜（前の上前腸骨棘 → 後ろの上後腸骨棘）
      const crest = curve([
        at(0.14, 0.30, 0.19),            // 上前腸骨棘
        at(0.19, 0.38, 0.10),            // 腸骨結節
        mid(0.47, 0.43, -0.04),          // 腸骨稜のいちばん高い所
        mid(0.36, 0.40, -0.22),
        mid(0.22, 0.30, -0.33),          // 上後腸骨棘
      ], 9);
      // 翼の下の縁（下前腸骨棘 → 寛骨臼の上 → 大坐骨切痕 → 仙腸関節）
      const lower = curve([
        at(0.10, 0.12, 0.14),
        at(0.11, 0.10, 0.02),
        at(0.04, 0.08, -0.13),
        mid(0.24, 0.14, -0.22),
        mid(0.20, 0.20, -0.30),
      ], 9);
      const rows = [];
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        const row = [];
        for (let j = 0; j < crest.length; j++) {
          const pnt = lower[j].clone().lerp(crest[j], t);
          // 内側（腸骨窩）へ少しくぼませる
          pnt.x -= sx * Math.sin(Math.PI * t) * 0.018 * k;
          row.push(pnt);
        }
        rows.push(row);
      }
      const ilium = slab(rows, 0.007 * k);
      P.add(map.hips, ilium, { center: at(0.08, 0.20, -0.05) });
      P.add(map.hips, tube(crest, 0.0065 * k, { seg: 8 }), { center: at(0.10, 0.28, -0.05) });
      // 寛骨臼（大腿骨頭を受けるお椀）
      {
        const cup = new THREE.SphereGeometry(0.029 * k, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42);
        const open = V3(sx * 0.70, -0.50, 0.40).normalize();
        cup.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), open.clone().negate()));
        cup.translate(H.x, H.y, H.z);
        P.add(map.hips, finish(cup), { center: H.clone() });
      }
      // 坐骨（お尻の下の座る骨）
      const ischTop = at(0.08, -0.08, -0.10);
      const ischTub = at(0.04, -0.29, -0.14);
      P.add(map.hips, rod(ischTop, ischTub, 0.013 * k, 0.011 * k, 10), { axis: [ischTop, ischTub] });
      P.add(map.hips, ellipsoid(ischTub.clone().add(V3(0, -0.006 * k, 0)), [0.013 * k, 0.019 * k, 0.016 * k]), { center: ischTub.clone() });
      // 恥骨（上枝・下枝）と恥骨結合
      const pubBody = mid(0.06, -0.11, 0.21);
      const supA = at(0.04, -0.03, 0.11);
      P.add(map.hips, tube(curve([supA, at(0.0, -0.07, 0.17), pubBody], 6), 0.009 * k, { seg: 8 }), { axis: [supA, pubBody] });
      P.add(map.hips, tube(curve([pubBody, mid(0.12, -0.24, 0.12), ischTub], 6), 0.0065 * k, { seg: 8 }), { axis: [pubBody, ischTub] });
      P.add(map.hips, ellipsoid(pubBody, [0.012 * k, 0.017 * k, 0.010 * k]), { center: pubBody.clone() });
      if (sx > 0) {
        const sym = new THREE.CylinderGeometry(0.008 * k, 0.008 * k, 0.010 * k, 10);
        sym.rotateZ(Math.PI / 2);
        sym.translate(cx, pubBody.y, pubBody.z);
        P.add(map.hips, finish(sym), { mat: 'cart', center: V3(cx, pubBody.y, pubBody.z) });
      }
      // 仙腸関節（腸骨の後ろと仙骨のわき）をつなぐ
      if (sacrum) {
        const sj = sacrum.pts[2].clone().add(V3(sx * 0.044 * s, 0, 0));
        const ij = mid(0.21, 0.22, -0.30);
        P.add(map.hips, rod(sj, ij, 0.010 * k, 0.012 * k, 8), { axis: [sj, ij] });
      }
    }
    ctx.IAD = IAD;
  }

  // ---- 胸郭（肋骨・肋軟骨・胸骨） -------------------------------------------
  const ySN = vert.T2 && vert.T3 ? (vert.T2.y + vert.T3.y) / 2 : T1 - 0.035 * s;   // 胸骨上切痕
  const front = y => (prof ? prof.front(y) : J.hips.z + 0.10 * s);
  const back = y => (prof ? prof.back(y) : J.hips.z - 0.10 * s);
  const halfAt = y => (prof ? prof.half(y) : 0.13 * s);
  const chestBone = map.chest || boneAtY(ySN - 0.06 * s);
  // 体幹の中心を通る縦の線（肋骨などを、はみ出したら体の中心へ寄せて縮める）
  const trunkAxis = y => { const zc = (back(y) + front(y)) / 2; return [V3(cx, y - 1, zc), V3(cx, y + 1, zc)]; };
  // 胸骨
  const stY = [ySN - 0.004 * s, ySN - 0.048 * s, ySN - 0.150 * s, ySN - 0.178 * s];
  const stZ = y => front(y) - 0.012 * s;
  {
    const ys = [], ws = [];
    const N = 12;
    for (let i = 0; i <= N; i++) {
      const y = lerp(stY[0], stY[3], i / N);
      ys.push(y);
      const rel = (stY[0] - y) / (stY[0] - stY[3]);
      // 胸骨柄は幅広く、体は細長く、剣状突起は細い
      ws.push(rel < 0.25 ? lerp(0.026, 0.016, rel / 0.25) : rel < 0.84 ? lerp(0.015, 0.018, (rel - 0.25) / 0.59) : lerp(0.010, 0.004, (rel - 0.84) / 0.16));
    }
    const rows = ys.map((y, i) => [-1, -0.5, 0, 0.5, 1].map(u => V3(cx + u * ws[i] * s, y, stZ(y) - Math.abs(u) * 0.003 * s)));
    P.add(chestBone, slab(rows, 0.009 * s), { axis: trunkAxis((stY[0] + stY[3]) / 2), fit: 'axis', minScale: 0.8 });
  }
  // 肋骨: 解剖学的な半幅（m, 身長1.70m）と、前の端の高さ（胸骨上切痕から）
  const RIB_HALF = [0.050, 0.074, 0.090, 0.103, 0.114, 0.122, 0.128, 0.132, 0.133, 0.129, 0.120, 0.106];
  const RIB_STERN = [0.012, 0.048, 0.070, 0.090, 0.108, 0.124, 0.140];
  const RIB_DROP = [0.000, 0.005, 0.010, 0.016, 0.022, 0.030, 0.040];
  const ribEnds = [];
  for (let i = 1; i <= 12; i++) {
    const vt = vert['T' + i];
    if (!vt) continue;
    for (const sx of [1, -1]) {
      const yBack = vt.y;
      let yEnd, thEnd;
      if (i <= 7) { yEnd = ySN - (RIB_STERN[i - 1] + RIB_DROP[i - 1]) * s; thEnd = 2.55; }
      else if (i <= 10) { yEnd = yBack - (0.075 - (i - 8) * 0.004) * s; thEnd = 2.35 - (i - 8) * 0.12; }
      else { yEnd = yBack - (i === 11 ? 0.050 : 0.035) * s; thEnd = i === 11 ? 1.75 : 1.45; }
      const pts = [];
      // 肋骨頭（椎体のわき）→ 肋骨結節（横突起の先）→ 肋骨角 → 側面 → 前の端
      const p0 = V3(cx + sx * (vt.w / 2 + 0.002 * s), yBack, vt.z - vt.d * 0.2);
      const p1 = V3(cx + sx * (vt.w / 2 + 0.022 * s), yBack - 0.002 * s, vt.z - vt.d / 2 - 0.016 * s);
      pts.push(p0, p1);
      const steps = 10;
      for (let j = 0; j <= steps; j++) {
        const th = lerp(0.62, thEnd, j / steps);
        const y = lerp(yBack - 0.006 * s, yEnd, j / steps);
        const zb = back(y) + 0.013 * s, zf = front(y) - 0.016 * s;
        const zc = (zb + zf) / 2, b = Math.max(0.02 * s, (zf - zb) / 2);
        const a = Math.max(0.03 * s, Math.min(RIB_HALF[i - 1] * s, halfAt(y) - 0.013 * s));
        pts.push(V3(cx + sx * a * Math.sin(th), y, zc - b * Math.cos(th)));
      }
      const path = curve(pts, 20);
      const rr = (0.0052 - 0.0012 * Math.abs(i - 6.5) / 6) * s;
      P.add(boneAtY(yBack),
        tube(path, t => rr * (t < 0.1 ? 0.8 : 1) * (1 - 0.25 * t), { seg: 7, ell: { axis: UP, ratio: 0.5 } }),
        { axis: trunkAxis((yBack + yEnd) / 2), fit: 'axis', minScale: 0.75 });
      ribEnds[i] = ribEnds[i] || {};
      ribEnds[i][sx] = path[path.length - 1];
    }
  }
  // 肋軟骨: 1〜7番は胸骨へ、8〜10番は一つ上の軟骨へ合流する（肋骨弓）
  for (const sx of [1, -1]) {
    const cart = [];
    for (let i = 1; i <= 10; i++) {
      const e = ribEnds[i] && ribEnds[i][sx];
      if (!e) continue;
      let to;
      if (i <= 7) {
        const y = ySN - RIB_STERN[i - 1] * s;
        to = V3(cx + sx * 0.014 * s, y, stZ(y) - 0.002 * s);
      } else {
        const prev = cart[i - 1];
        if (!prev) continue;
        to = prev[Math.floor(prev.length * 0.45)].clone();
      }
      const mid = e.clone().lerp(to, 0.5);
      mid.z = Math.max(mid.z, Math.min(e.z, to.z) + 0.004 * s);
      const path = curve([e, mid, to], 8);
      cart[i] = path;
      P.add(chestBone, tube(path, 0.0042 * s, { seg: 7, ell: { axis: UP, ratio: 0.6 } }), { mat: 'cart', axis: trunkAxis((e.y + to.y) / 2), fit: 'axis', minScale: 0.78 });
    }
  }

  // ---- 頭蓋骨 ----------------------------------------------------------------
  if (map.head && head) {
    // 基準の頭（皮膚で測った頭の高さ 0.232m、頭頂 y=0・あご y=-0.232、前後の中心 z=0、
    // 頭の長さ 0.197m・幅 0.152m）での成人の頭蓋骨を、素体の頭の箱に合わせて伸び縮みさせる。
    // 軟部組織の厚み（頭頂・額で約 6mm）のぶん、骨は皮膚の内側に収める。
    const ky = head.h / 0.232, kx = head.half / 0.076, kz = (head.zFront - head.zBack) / 0.215;
    const zc0 = (head.zFront + head.zBack) / 2;
    const Hp = (x, y, z) => V3(cx + x * kx, head.top + y * ky, zc0 + z * kz);
    const R = (rx, ry, rz) => [rx * kx, ry * ky, rz * kz];
    const skull = ctx.skullGroup || map.head;
    const C = Hp(0, -0.11, 0);
    // 頭蓋骨の部品はいったん溜めて、最後に一つのまとまりとして素体の頭に収める
    const pieces = { bone: [], cart: [], dark: [] };
    const add = (geo, o = {}) => { pieces[o.mat || 'bone'].push(geo); };
    // 脳頭蓋: 頭頂から後頭部の丸み（上）と、こめかみ〜耳の高さの側頭部（下）
    add(ellipsoid(Hp(0, -0.078, -0.004), R(0.068, 0.073, 0.088), null, 24), { center: C });
    add(ellipsoid(Hp(0, -0.118, -0.012), R(0.062, 0.040, 0.072), null, 20), { center: C });
    // 前頭骨の額と眉弓（眼窩の上縁）
    add(ellipsoid(Hp(0, -0.074, 0.050), R(0.054, 0.046, 0.036), null, 18), { center: C });
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
      add(tube(rim, 0.0042 * ky, { seg: 7, caps: false }), { center: C });
      add(ellipsoid(oc.clone().add(V3(0, 0, -0.004 * kz)), R(0.018, 0.015, 0.006)), { mat: 'dark', center: C });
      // 頬骨（眼窩の外下のふち〜頬の出っぱり）と頬骨弓（耳の前へ）
      add(ellipsoid(Hp(sx * 0.047, -0.136, 0.054), R(0.013, 0.013, 0.012)), { center: C });
      add(tube(curve([Hp(sx * 0.052, -0.138, 0.046), Hp(sx * 0.061, -0.138, 0.026), Hp(sx * 0.063, -0.136, 0.002)], 8),
        0.0042 * ky, { seg: 7, ell: { axis: V3(sx, 0, 0), ratio: 0.5 } }), { center: C });
      // 乳様突起（耳の後ろ下）
      add(ellipsoid(Hp(sx * 0.052, -0.158, -0.026), R(0.008, 0.012, 0.009)), { center: C });
    }
    // 鼻: 鼻骨と、梨状口（鼻の穴の骨のふち）
    add(tube([Hp(0, -0.108, 0.084), Hp(0, -0.122, 0.090), Hp(0, -0.132, 0.093)], 0.0045 * kx, { seg: 8, ell: { axis: V3(0, 0, 1), ratio: 0.6 } }), { center: C });
    const nasal = [];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const w = Math.sin(a) > 0 ? 0.010 : 0.013;
      nasal.push(Hp(Math.cos(a) * w, -0.148 + Math.sin(a) * 0.016, 0.083 - Math.abs(Math.cos(a)) * 0.004));
    }
    add(tube(nasal, 0.0028 * ky, { seg: 6, caps: false }), { center: C });
    add(ellipsoid(Hp(0, -0.148, 0.078), R(0.011, 0.015, 0.005)), { mat: 'dark', center: C });
    // 上顎骨（眼窩の下〜上の歯ぐき）
    add(ellipsoid(Hp(0, -0.156, 0.062), R(0.034, 0.024, 0.016)), { center: C });
    add(ellipsoid(Hp(0, -0.174, 0.064), R(0.029, 0.010, 0.016)), { center: C });   // 歯槽（歯ぐきの骨）
    // 歯の列（上下）
    for (const [y, w] of [[-0.180, 1.0], [-0.186, 0.94]]) {
      const arc = [];
      for (let i = 0; i <= 10; i++) {
        const a = lerp(-1.25, 1.25, i / 10);
        arc.push(Hp(Math.sin(a) * 0.027 * w, y, 0.050 + Math.cos(a) * 0.026 * w));
      }
      add(tube(arc, 0.0030 * ky, { seg: 6, ell: { axis: UP, ratio: 1.4 } }), { mat: 'cart', center: C });
    }
    // 下顎骨: 下顎体（下の歯ぐき〜あごの下縁の板）と、下顎枝（下顎角 → 関節突起・筋突起）
    {
      const TOP = [[0, -0.190, 0.075], [0.020, -0.190, 0.066], [0.034, -0.191, 0.044], [0.043, -0.193, 0.022], [0.047, -0.195, 0.004]];
      const BOT = [[0, -0.225, 0.071], [0.022, -0.220, 0.062], [0.040, -0.211, 0.036], [0.048, -0.204, 0.012], [0.050, -0.199, -0.004]];
      const side = (L, sx) => L.map(([x, y, z]) => Hp(sx * x, y, z));
      const join = L => [...side(L, -1).reverse(), ...side(L, 1).slice(1)];
      const top = curve(join(TOP), 17), bot = curve(join(BOT), 17);
      const rows = [top, top.map((p, i) => p.clone().lerp(bot[i], 0.5).add(V3(Math.sign(p.x - cx) * 0.003 * kx, 0, 0.002 * kz))), bot];
      add(slab(rows, 0.008 * kx), { center: C });
    }
    for (const sx of [1, -1]) {
      const gon = Hp(sx * 0.050, -0.199, -0.004);
      const cond = Hp(sx * 0.053, -0.142, -0.010), coro = Hp(sx * 0.046, -0.150, 0.020), notch = Hp(sx * 0.050, -0.156, 0.006);
      const front = Hp(sx * 0.047, -0.194, 0.016);
      add(slab([[gon, gon.clone().lerp(front, 0.5), front], [gon.clone().lerp(cond, 0.5), notch.clone().lerp(gon, 0.35), front.clone().lerp(coro, 0.5)],
        [cond, notch, coro]], 0.0035 * kx), { center: C });
      add(ellipsoid(cond.clone(), R(0.009, 0.005, 0.006)), { center: C });
    }
    add(ellipsoid(Hp(0, -0.219, 0.074), R(0.014, 0.008, 0.006)), { center: C });   // おとがい隆起
    // 頭蓋骨全体を一つのまとまりとして、形を保ったまま素体の頭に収める
    const merged = {};
    for (const mat of Object.keys(pieces)) if (pieces[mat].length) merged[mat] = mergeGeometries(pieces[mat], false);
    const unitGeo = mergeGeometries(Object.values(merged), false);
    if (unitGeo) {
      const back = V3(0, 0, -1);
      const best = P.searchUnit(unitGeo, C, back, 0.002 * s);
      ctx.skullFit = best;
      for (const [mat, g] of Object.entries(merged)) {
        Parts.applyUnit(g, C, back, best);
        P.add(map.head, g, { group: skull, mat, fit: 'none' });
      }
    }
  }

  // ---- 肩（鎖骨・肩甲骨） ---------------------------------------------------
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const sh = map['shoulder' + side], ua = map['upperArm' + side];
    if (!ua) continue;
    const GH = W(ua);                                   // 肩関節（上腕骨頭の中心）
    const holder = sh || chestBone;
    // 鎖骨: 胸骨の上（胸鎖関節）→ 肩峰（肩関節の上・少し後ろ）。内側 2/3 は前へ、外側 1/3 は後ろへ反る
    const SC = V3(cx + sx * 0.022 * s, ySN + 0.004 * s, stZ(ySN) - 0.006 * s);
    const AC = GH.clone().add(V3(-sx * 0.010 * s, 0.030 * s, -0.012 * s));
    const clav = curve([SC, SC.clone().lerp(AC, 0.35).add(V3(0, 0.004 * s, 0.012 * s)),
      SC.clone().lerp(AC, 0.72).add(V3(0, 0.006 * s, -0.004 * s)), AC], 12);
    P.add(holder, tube(clav, t => (0.0065 - 0.0015 * t) * s, { seg: 9, ell: { axis: UP, ratio: 0.75 } }), { axis: [SC, AC], fit: 'axis' });
    // 肩甲骨: 背中の第2〜第7胸椎の高さ。上角・下角・関節窩の三角形の板
    const yT2 = vert.T2 ? vert.T2.y : GH.y + 0.03 * s, yT7 = vert.T7 ? vert.T7.y : GH.y - 0.12 * s;
    const zOn = (x, y) => back(y) + 0.013 * s + Math.abs(x - cx) * 0.25;
    const sup = V3(cx + sx * 0.058 * s, yT2, 0); sup.z = zOn(sup.x, sup.y);
    const inf = V3(cx + sx * 0.074 * s, yT7, 0); inf.z = zOn(inf.x, inf.y);
    const glen = GH.clone().add(V3(-sx * 0.026 * s, -0.004 * s, -0.008 * s));
    const lat = glen.clone().add(V3(-sx * 0.008 * s, -0.030 * s, -0.012 * s));
    const rows = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const med = sup.clone().lerp(inf, t);
      const ext = t < 0.25 ? glen.clone().lerp(lat, t / 0.25) : lat.clone().lerp(inf, (t - 0.25) / 0.75);
      const row = [];
      for (let j = 0; j <= 5; j++) {
        const pnt = med.clone().lerp(ext, j / 5);
        pnt.z = Math.max(pnt.z, zOn(pnt.x, pnt.y) - 0.002 * s);
        row.push(pnt);
      }
      rows.push(row);
    }
    P.add(holder, slab(rows, 0.005 * s), { center: sup.clone().lerp(inf, 0.5).lerp(glen, 0.35) });
    // 関節窩のふち
    const gl = new THREE.TorusGeometry(0.014 * s, 0.003 * s, 6, 14);
    gl.rotateY(Math.PI / 2);
    gl.scale(1, 1.3, 1);
    gl.translate(glen.x, glen.y, glen.z);
    P.add(holder, finish(gl), { center: glen.clone() });
    // 肩甲棘から肩峰（肩の上にかぶさる）
    const spineA = sup.clone().lerp(inf, 0.30);
    const acro = AC.clone().add(V3(sx * 0.008 * s, -0.004 * s, -0.004 * s));
    const spinePts = curve([spineA, spineA.clone().lerp(acro, 0.55).add(V3(0, 0.004 * s, -0.004 * s)), acro], 10);
    P.add(holder, tube(spinePts, 0.0048 * s, { seg: 8, ell: { axis: V3(0, 0, 1), ratio: 0.55 } }), { axis: [spineA, acro], fit: 'axis' });
    // 烏口突起（鎖骨の下を前へ曲がる鉤）
    const cor = curve([glen.clone().add(V3(0, 0.012 * s, 0.004 * s)), glen.clone().add(V3(-sx * 0.004 * s, 0.020 * s, 0.020 * s)),
      glen.clone().add(V3(sx * 0.004 * s, 0.014 * s, 0.032 * s))], 6);
    P.add(holder, tube(cor, 0.0040 * s, { seg: 7 }), { center: glen.clone() });
  }

  // ---- 腕（上腕骨・橈骨・尺骨・手） -----------------------------------------
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const ua = map['upperArm' + side], fa = map['forearm' + side], hd = map['hand' + side];
    if (!ua || !fa) continue;
    const GH = W(ua), EL = W(fa), WR = hd ? W(hd) : EL.clone().add(V3(0, -0.26 * s, 0));
    const armLen = GH.distanceTo(EL), ka = armLen / 0.30;
    const dU = EL.clone().sub(GH).normalize();
    const latU = V3(sx, 0, 0).addScaledVector(dU, -dU.x * sx).normalize();     // 腕の外側
    const fwd = V3().crossVectors(latU, dU).multiplyScalar(sx).normalize();     // 腕の前
    // 上腕骨: 骨頭 → 大結節 → 骨幹 → 内側・外側上顆と滑車
    P.add(ua, ellipsoid(GH.clone(), [0.022 * ka, 0.023 * ka, 0.022 * ka]), { center: GH.clone() });
    P.add(ua, ellipsoid(GH.clone().addScaledVector(latU, 0.017 * ka).addScaledVector(fwd, 0.006 * ka).addScaledVector(dU, 0.008 * ka),
      [0.011 * ka, 0.012 * ka, 0.011 * ka]), { center: GH.clone() });
    const sA = GH.clone().addScaledVector(dU, 0.018 * ka), sB = EL.clone().addScaledVector(dU, -0.012 * ka);
    P.add(ua, tube([sA, sA.clone().lerp(sB, 0.5), sB], t => (0.0115 - 0.0015 * Math.sin(Math.PI * t) + 0.004 * Math.pow(t, 4)) * ka, { seg: 12 }), { axis: [GH, EL], fit: 'axis' });
    P.add(ua, ellipsoid(EL.clone().addScaledVector(dU, -0.006 * ka).addScaledVector(fwd, 0.003 * ka),
      [0.026 * ka, 0.011 * ka, 0.013 * ka], [latU, dU.clone().negate(), fwd]), { center: EL.clone() });
    P.add(ua, ellipsoid(EL.clone().addScaledVector(latU, -0.028 * ka).addScaledVector(dU, -0.010 * ka), [0.008 * ka, 0.010 * ka, 0.008 * ka]), { center: EL.clone() });
    P.add(ua, ellipsoid(EL.clone().addScaledVector(latU, 0.021 * ka).addScaledVector(dU, -0.010 * ka), [0.006 * ka, 0.008 * ka, 0.006 * ka]), { center: EL.clone() });

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
      t => (t < 0.25 ? 0.010 : lerp(0.0075, 0.0050, (t - 0.25) / 0.75)) * ka, { seg: 10 }), { axis: [EL, WR], fit: 'axis' });
    P.add(fa, ellipsoid(ulnaBot.clone().addScaledVector(dF, 0.004 * ka), [0.0065 * ka, 0.006 * ka, 0.0065 * ka]), { center: ulnaBot.clone() });
    // 橈骨: 橈骨頭（肘の外側）から手首の親指側へ太くなる
    const radTop = EL.clone().addScaledVector(latF, 0.014 * ka).addScaledVector(dF, 0.010 * ka);
    const radBot = WR.clone().addScaledVector(radial, 0.009 * ka).addScaledVector(dF, -0.012 * ka);
    P.add(fa, ellipsoid(radTop.clone(), [0.010 * ka, 0.006 * ka, 0.010 * ka], [latF, dF.clone().negate(), V3().crossVectors(latF, dF.clone().negate())]), { center: radTop.clone() });
    P.add(fa, tube([radTop.clone().addScaledVector(dF, 0.006 * ka), radTop.clone().lerp(radBot, 0.5), radBot],
      t => lerp(0.0055, 0.0095, t * t) * ka, { seg: 10 }), { axis: [EL, WR], fit: 'axis' });
    P.add(fa, ellipsoid(radBot.clone().addScaledVector(dF, 0.004 * ka), [0.013 * ka, 0.007 * ka, 0.010 * ka],
      [radial, dF.clone().negate(), V3().crossVectors(radial, dF.clone().negate())]), { center: radBot.clone() });

    // 手: 手根骨（2列×4）・中手骨・指骨
    const fg = ctx.fingers && ctx.fingers[side];
    const hf = ctx.handFrame && ctx.handFrame[side];
    if (hd && fg && hf) {
      const mid1 = fg.middle && fg.middle[1];
      const handLen = mid1 ? WR.distanceTo(W(mid1)) : 0.09 * s;
      const kh = handLen / 0.090;
      const along = hf.along, rad = hf.radial, palm = hf.palmar;
      for (const [row, at] of [[0, 0.010], [1, 0.024]]) {
        for (let c = 0; c < 4; c++) {
          const off = lerp(-0.013, 0.013, c / 3);
          const ctr = WR.clone().addScaledVector(along, at * kh).addScaledVector(rad, off * kh).addScaledVector(palm, 0.001 * kh);
          P.add(hd, ellipsoid(ctr, [0.0062 * kh, 0.0058 * kh, 0.0050 * kh], [rad, along, palm]), { center: ctr.clone() });
        }
      }
      // 中手骨（人差し指〜小指）
      const baseOff = { index: 0.011, middle: 0.004, ring: -0.005, pinky: -0.013 };
      for (const f of ['index', 'middle', 'ring', 'pinky']) {
        const k1 = fg[f] && fg[f][1];
        if (!k1) continue;
        const A = WR.clone().addScaledVector(along, 0.032 * kh).addScaledVector(rad, baseOff[f] * kh);
        const B = W(k1).addScaledVector(W(k1).sub(A).normalize(), -0.004 * kh);
        P.add(hd, tube([A, A.clone().lerp(B, 0.5).addScaledVector(palm, -0.002 * kh), B],
          t => lerp(0.0042, 0.0034, Math.sin(Math.PI * t)) * kh, { seg: 8 }), { axis: [A, B], fit: 'axis' });
        P.add(hd, ellipsoid(B, [0.0050 * kh, 0.0050 * kh, 0.0050 * kh]), { center: B.clone() });
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
          const a2 = A.clone().addScaledVector(d, 0.0025 * kh), b2 = B.clone().addScaledVector(d, isTip ? -0.003 * kh : -0.0025 * kh);
          P.add(b, tube([a2, a2.clone().lerp(b2, 0.5), b2], t => r * (1 - 0.18 * Math.sin(Math.PI * t)) * (isTip ? 1 - 0.35 * t : 1), { seg: 8 }),
            isTip ? { center: A.clone() } : { axis: [A, B], fit: 'axis' });
          if (!isTip) P.add(b, ellipsoid(b2.clone(), [r * 1.15, r * 1.0, r * 1.05]), { center: b2.clone() });
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
    const dT = KN.clone().sub(HJ).normalize();
    const lat = V3(sx, 0, 0).addScaledVector(dT, -dT.x * sx).normalize();
    const fwd = V3().crossVectors(lat, dT).multiplyScalar(-sx).normalize();
    if (fwd.z < 0) fwd.negate();
    // 大腿骨頭・頸（頸体角 125°・前捻 12°）・大転子・小転子
    P.add(th, ellipsoid(HJ.clone(), [0.023 * kf, 0.023 * kf, 0.023 * kf]), { center: HJ.clone() });
    const neckEnd = HJ.clone().addScaledVector(lat, 0.042 * kf).addScaledVector(dT, 0.030 * kf).addScaledVector(fwd, -0.010 * kf);
    P.add(th, rod(HJ.clone().addScaledVector(lat, 0.012 * kf), neckEnd, 0.014 * kf, 0.016 * kf, 10, { axis: fwd, ratio: 0.8 }), { axis: [HJ, KN], fit: 'axis' });
    const gT = HJ.clone().addScaledVector(lat, 0.058 * kf).addScaledVector(dT, 0.012 * kf).addScaledVector(fwd, -0.006 * kf);
    P.add(th, ellipsoid(gT, [0.014 * kf, 0.022 * kf, 0.018 * kf], [lat, dT.clone().negate(), fwd]), { axis: [HJ, KN], fit: 'axis' });
    const lT = HJ.clone().addScaledVector(lat, 0.026 * kf).addScaledVector(dT, 0.062 * kf).addScaledVector(fwd, -0.014 * kf);
    P.add(th, ellipsoid(lT, [0.008 * kf, 0.010 * kf, 0.008 * kf]), { center: lT.clone() });
    // 骨幹: 大転子の下から、膝の上へ（下ほど内側＝膝の真上へ寄る）
    const shTop = HJ.clone().addScaledVector(lat, 0.040 * kf).addScaledVector(dT, 0.055 * kf).addScaledVector(fwd, -0.004 * kf);
    const shBot = KN.clone().addScaledVector(dT, -0.034 * kf).addScaledVector(fwd, -0.005 * kf);
    P.add(th, tube([shTop, shTop.clone().lerp(shBot, 0.5).addScaledVector(fwd, 0.004 * kf), shBot],
      t => lerp(0.0135, 0.0215, Math.pow(t, 3)) * kf, { seg: 12 }), { axis: [HJ, KN], fit: 'axis' });
    // 大腿骨の下端（内側顆・外側顆）
    for (const m of [1, -1]) {
      const cd = KN.clone().addScaledVector(lat, m * 0.021 * kf).addScaledVector(dT, -0.0235 * kf).addScaledVector(fwd, -0.006 * kf);
      P.add(th, ellipsoid(cd, [0.016 * kf, 0.021 * kf, 0.025 * kf], [lat, dT.clone().negate(), fwd]), { center: KN.clone() });
    }
    // 膝蓋骨（ひざの皿）
    const pat = KN.clone().addScaledVector(dT, -0.024 * kf).addScaledVector(fwd, 0.034 * kf);
    P.add(th, ellipsoid(pat, [0.020 * kf, 0.023 * kf, 0.009 * kf], [lat, dT.clone().negate(), fwd]), { center: KN.clone().addScaledVector(dT, -0.02 * kf) });

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
    P.add(sn, finish(pg), { center: plat.clone() });
    // 半月板（内側・外側の C 字の軟骨）
    for (const m of [1, -1]) {
      const mc = KN.clone().addScaledVector(latS, m * 0.019 * kf).addScaledVector(dS, 0.0015 * kf).addScaledVector(fwdS, -0.004 * kf);
      const men = new THREE.TorusGeometry(0.013 * kf, 0.0028 * kf, 6, 16, Math.PI * 1.6);
      men.rotateX(Math.PI / 2);
      men.rotateY(m > 0 ? Math.PI * 0.7 : -Math.PI * 0.3);
      men.applyMatrix4(basisMatrix(latS, dS.clone().negate(), V3().crossVectors(latS, dS.clone().negate())));
      men.translate(mc.x, mc.y, mc.z);
      P.add(sn, finish(men), { mat: 'cart', axis: [KN, AN], fit: 'axis' });
    }
    P.add(sn, ellipsoid(KN.clone().addScaledVector(dS, 0.045 * kf).addScaledVector(fwdS, 0.020 * kf), [0.010 * kf, 0.014 * kf, 0.007 * kf]), { center: KN.clone().addScaledVector(dS, 0.045 * kf) });
    const tA = KN.clone().addScaledVector(dS, 0.016 * kf).addScaledVector(latS, -0.002 * kf);
    const tB = AN.clone().addScaledVector(dS, -0.024 * kf).addScaledVector(latS, -0.002 * kf);
    P.add(sn, tube([tA, tA.clone().lerp(tB, 0.5), tB], t => lerp(0.0145, 0.0115, Math.sin(Math.PI * t * 0.9)) * kf, { seg: 12 }),
      { axis: [KN, AN], fit: 'axis', margin: 0.009 * s });
    P.add(sn, ellipsoid(AN.clone().addScaledVector(dS, -0.012 * kf).addScaledVector(latS, -0.003 * kf), [0.016 * kf, 0.012 * kf, 0.014 * kf]), { center: AN.clone() });
    const medMal = AN.clone().addScaledVector(latS, -0.020 * kf).addScaledVector(dS, 0.004 * kf);
    P.add(sn, ellipsoid(medMal, [0.007 * kf, 0.014 * kf, 0.010 * kf]), { axis: [KN, AN], fit: 'axis', margin: 0.006 * s });
    // 腓骨: 外側・やや後ろ。外くるぶしは内くるぶしより低い
    const fibTop = KN.clone().addScaledVector(dS, 0.032 * kf).addScaledVector(latS, 0.028 * kf).addScaledVector(fwdS, -0.012 * kf);
    const latMal = AN.clone().addScaledVector(latS, 0.022 * kf).addScaledVector(dS, 0.014 * kf).addScaledVector(fwdS, -0.008 * kf);
    P.add(sn, ellipsoid(fibTop, [0.008 * kf, 0.009 * kf, 0.008 * kf]), { axis: [KN, AN], fit: 'axis' });
    P.add(sn, rod(fibTop, latMal.clone().addScaledVector(dS, -0.010 * kf), 0.0055 * kf, 0.0050 * kf, 8), { axis: [KN, AN], fit: 'axis', margin: 0.006 * s });
    P.add(sn, ellipsoid(latMal, [0.007 * kf, 0.016 * kf, 0.010 * kf]), { axis: [KN, AN], fit: 'axis' });

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
      P.add(ft, ellipsoid(F(0.004 * kk, 0, ankH - 0.015), [0.016 * kk, 0.015 * kk, 0.024 * kk], basis), { center: AN.clone() });
      P.add(ft, ellipsoid(F(0.026 * kk, -0.006, ankH - 0.026), [0.010 * kk, 0.009 * kk, 0.010 * kk], basis), FA);   // 距骨頭
      // 踵骨（かかと）: 後ろの隆起は床のすぐ上、前は立方骨へ
      const hb = heel + 0.010 * kk;
      const calA = F(hb + 0.014 * kk, 0.003, 0.030), calB = F(0.030 * kk, 0.010, 0.032);
      P.add(ft, tube([calA, calA.clone().lerp(calB, 0.5).add(V3(0, 0.008 * kk, 0)), calB], t => lerp(0.020, 0.014, t) * kk, { seg: 12 }), FA);
      P.add(ft, ellipsoid(F(hb + 0.011 * kk, 0.003, 0.024), [0.015 * kk, 0.020 * kk, 0.013 * kk], basis), FA);   // 踵骨隆起
      // 舟状骨（内側）・立方骨（外側）・楔状骨（3つ）
      const mid = f => heel + (mtp - heel) * f;
      P.add(ft, ellipsoid(F(mid(0.47), -0.012, 0.042), [0.012 * kk, 0.010 * kk, 0.008 * kk], basis), FA);
      P.add(ft, ellipsoid(F(mid(0.50), 0.016, 0.024), [0.011 * kk, 0.011 * kk, 0.013 * kk], basis), FA);
      for (const [l, y] of [[-0.020, 0.038], [-0.006, 0.040], [0.006, 0.036]]) {
        P.add(ft, ellipsoid(F(mid(0.58), l, y), [0.0065 * kk, 0.010 * kk, 0.010 * kk], basis), FA);
      }
      // 中足骨（第1〜第5）: 付け根はリスフラン関節、骨頭はつま先の関節の並び
      const MT = [
        { base: [0.64, -0.020, 0.040], head: [0.010, -0.024, 0.024], r: 0.0066, ph: [0.028, 0.022] },
        { base: [0.66, -0.007, 0.042], head: [0.012, -0.008, 0.024], r: 0.0042, ph: [0.019, 0.010, 0.008] },
        { base: [0.65, 0.005, 0.038], head: [0.006, 0.004, 0.023], r: 0.0040, ph: [0.017, 0.009, 0.008] },
        { base: [0.62, 0.016, 0.033], head: [-0.004, 0.015, 0.022], r: 0.0038, ph: [0.015, 0.008, 0.007] },
        { base: [0.56, 0.027, 0.026], head: [-0.016, 0.025, 0.021], r: 0.0040, ph: [0.013, 0.007, 0.006] },
      ];
      for (const m of MT) {
        const A = F(mid(m.base[0]), m.base[1], m.base[2]);
        const B = F(mtp + m.head[0] * kk, m.head[1], m.head[2]);
        P.add(ft, tube([A, A.clone().lerp(B, 0.5).add(V3(0, 0.003 * kk, 0)), B], t => m.r * kk * (1 - 0.2 * Math.sin(Math.PI * t)), { seg: 8 }), FA);
        P.add(ft, ellipsoid(B, [m.r * 1.15 * kk, m.r * 1.1 * kk, m.r * 1.1 * kk]), FA);
        // 趾骨はつま先の骨（ToeBase）にぶら下げる
        let p0 = B.clone().addScaledVector(fwdF, m.r * 1.2 * kk);
        for (let i = 0; i < m.ph.length; i++) {
          const L = m.ph[i] * kk;
          const p1 = p0.clone().addScaledVector(fwdF, L).add(V3(0, -0.0006 * kk * (i + 1), 0));
          const rr = m.r * kk * (0.82 - 0.12 * i);
          P.add(toe || ft, tube([p0, p1], t => rr * (1 - 0.15 * t), { seg: 7 }), FA);
          p0 = p1.clone().addScaledVector(fwdF, 0.0015 * kk);
        }
      }
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
  slot.skelDebug = { skullFit: ctx.skullFit, parts: P.list.length,
    ms: { measure: Math.round(T1 - T0), build: Math.round(T2 - T1), fit: Math.round(T3 - T2), attach: Math.round(performance.now() - T3) } };
  return meshes;
}
