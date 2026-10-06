// meshRefine.js — スキン付きメッシュの一部だけを細かく分ける
//
// サンプル素体（X Bot）の胸は頂点の間隔が 2.5cm ほどある。幅 6cm の乳房のふくらみには
// 頂点が 3 つほどしか並ばないので、どんな曲面を当てても断面は三角になり、
// 上から見ると「尖らせただけ」に見える。そこで胸のまわりの三角形だけを 4 分割する。
//
// ・選んだ三角形は辺の中点で 4 つに分ける
// ・となりの三角形で 1 辺だけ分けられたものは 2 つに分け、2 辺以上なら 4 分割に含める
//   （分けた辺と分けない辺が接すると、すき間＝ひびが開くため）
// ・新しい頂点の位置・法線・UV は両端の平均、スキンの重みは両端の重みを合わせて大きい順に 4 つ
// 形そのものは変えない（中点は元の三角形の上に置く）。丸みは、あとで当てる体つきのモーフが作る。
import * as THREE from 'three';

/** スキンをかけたあとのワールド位置（頂点ごと） */
export function skinnedWorld(m) {
  const g = m.geometry, pos = g.attributes.position, N = pos.count;
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

/**
 * 三角形を選んで細かく分ける。
 * @param {THREE.SkinnedMesh} m
 * @param {(a:number, b:number, c:number, W:Float32Array) => boolean} pick 頂点番号とワールド位置から、分けるかどうか
 * @returns {number} 増えた三角形の数
 */
export function refineMesh(m, pick) {
  const g = m.geometry;
  if (!g.index || g.groups.length > 1) return 0;
  for (const a of Object.values(g.attributes)) if (a.isInterleavedBufferAttribute) return 0;
  if (Object.keys(g.morphAttributes).length) return 0;
  const W = skinnedWorld(m);
  const idx = g.index.array;
  const T = idx.length / 3;
  const key = (a, b) => (a < b ? a * 4194304 + b : b * 4194304 + a);

  // 分ける三角形と、分ける辺
  const mark = new Uint8Array(T);
  const split = new Set();
  for (let t = 0; t < T; t++) {
    if (pick(idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2], W)) mark[t] = 1;
  }
  const addEdges = t => {
    const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
    split.add(key(a, b)); split.add(key(b, c)); split.add(key(c, a));
  };
  for (let t = 0; t < T; t++) if (mark[t]) addEdges(t);
  // 2 辺以上が分けられている三角形は 4 分割に入れる（くり返し）
  for (let guardN = 0; guardN < 20; guardN++) {
    let changed = false;
    for (let t = 0; t < T; t++) {
      if (mark[t]) continue;
      const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
      const n = (split.has(key(a, b)) ? 1 : 0) + (split.has(key(b, c)) ? 1 : 0) + (split.has(key(c, a)) ? 1 : 0);
      if (n >= 2) { mark[t] = 1; addEdges(t); changed = true; }
    }
    if (!changed) break;
  }
  if (!split.size) return 0;

  // 中点の頂点を作る
  const N0 = g.attributes.position.count;
  const mid = new Map();
  const pairs = [];
  for (const k of split) {
    const a = Math.floor(k / 4194304), b = k - a * 4194304;
    mid.set(k, N0 + pairs.length);
    pairs.push([a, b]);
  }
  const N1 = N0 + pairs.length;
  for (const [name, attr] of Object.entries(g.attributes)) {
    const sz = attr.itemSize, src = attr.array;
    const dst = new src.constructor(N1 * sz);
    dst.set(src);
    g.setAttribute(name, new THREE.BufferAttribute(dst, sz, attr.normalized));
    if (name === 'skinIndex' || name === 'skinWeight') continue;   // 下でまとめて作る
    for (let p = 0; p < pairs.length; p++) {
      const [a, b] = pairs[p], o = (N0 + p) * sz;
      for (let q = 0; q < sz; q++) dst[o + q] = (src[a * sz + q] + src[b * sz + q]) / 2;
      if (name === 'normal') {
        const l = Math.hypot(dst[o], dst[o + 1], dst[o + 2]) || 1;
        dst[o] /= l; dst[o + 1] /= l; dst[o + 2] /= l;
      }
    }
  }
  // スキンの重み: 両端の重みを半分ずつ足して、大きい順に 4 つ
  {
    const si0 = m.geometry.attributes.skinIndex, sw0 = m.geometry.attributes.skinWeight;
    const SI = si0.array, SW = sw0.array;
    for (let p = 0; p < pairs.length; p++) {
      const [a, b] = pairs[p];
      const acc = new Map();
      for (const v of [a, b]) for (let k = 0; k < 4; k++) {
        const w = SW[v * 4 + k];
        if (w > 0) acc.set(SI[v * 4 + k], (acc.get(SI[v * 4 + k]) || 0) + w / 2);
      }
      const top = [...acc.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
      const sum = top.reduce((s, e) => s + e[1], 0) || 1;
      const o = (N0 + p) * 4;
      for (let k = 0; k < 4; k++) {
        SI[o + k] = top[k] ? top[k][0] : 0;
        SW[o + k] = top[k] ? top[k][1] / sum : 0;
      }
    }
    si0.needsUpdate = true; sw0.needsUpdate = true;
  }

  // 三角形を組み直す（向き＝頂点の順番はそのまま）
  const out = [];
  let added = 0;
  for (let t = 0; t < T; t++) {
    const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
    const ab = mid.get(key(a, b)), bc = mid.get(key(b, c)), ca = mid.get(key(c, a));
    if (mark[t]) {
      out.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
      added += 3;
    } else if (ab !== undefined) {
      out.push(a, ab, c, ab, b, c); added++;
    } else if (bc !== undefined) {
      out.push(a, b, bc, a, bc, c); added++;
    } else if (ca !== undefined) {
      out.push(a, b, ca, ca, b, c); added++;
    } else {
      out.push(a, b, c);
    }
  }
  const Arr = N1 > 65535 ? Uint32Array : Uint16Array;
  g.setIndex(new THREE.BufferAttribute(new Arr(out), 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return added;
}
