// wireLines.js — 太さを変えられる「面の線」
//
// WebGL の線（wireframe: true）は、どの端末でも 1px より太く描けない。
// そこで三角形そのものを塗り、三角形の縁に近い所だけを線の色にする（重心座標を使う方法）。
//   - 形状をインデックスなしに展開し、三角形の 3 頂点に (1,0,0)(0,1,0)(0,0,1) を持たせる
//   - 画面の上で縁から何画素かは fwidth で測れるので、太さを画素で決められる（1 = 前の版までの 1 画素の線）
//   - 描かない辺（乳房の網目の、線にしない辺）は edgeOn で消す
// スキン・モーフ・クリップ面はふつうの MeshBasicMaterial のまま効く。

import * as THREE from 'three';

/** 太さ・濃さは全部の線で共有する（設定のつまみ 1 つで全部変わる） */
export const WIRE = {
  width: { value: 1.0 },     // 線の太さ（画面の画素。1 = 前の版までの線と同じ 1 画素）
};

const _mats = new Set();

/**
 * 面の線の材質。opacity は濃さ。
 * @param {object} [opts]  { color, opacity }
 */
export function makeWireMaterial(opts = {}) {
  if (opts.grid) return makeGridWireMaterial(opts);
  const mat = new THREE.MeshBasicMaterial({
    color: opts.color ?? 0x11141a, transparent: true, opacity: opts.opacity ?? 0.85,
    depthWrite: false, side: THREE.FrontSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
  });
  mat.userData.wireLine = true;
  mat.onBeforeCompile = sh => {
    sh.uniforms.uWireW = WIRE.width;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 bary;\nattribute vec3 edgeOn;\nvarying vec3 vBary;\nvarying vec3 vEdgeOn;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBary = bary;\nvEdgeOn = edgeOn;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWireW;\nvarying vec3 vBary;\nvarying vec3 vEdgeOn;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  {
    // distance to the nearest drawn edge, in device pixels (each side paints half the width)
    vec3 gx = dFdx(vBary), gy = dFdy(vBary);
    vec3 px = vBary / max(sqrt(gx * gx + gy * gy), vec3(1e-6));
    px += (1.0 - vEdgeOn) * 1e4;                 // edges not drawn
    float d = min(min(px.x, px.y), px.z);
    float hw = max(0.25, uWireW * 0.5);
    float a = 1.0 - smoothstep(hw - 0.3, hw + 0.3, d);
    // lines thinner than one pixel are drawn fainter instead
    a *= min(1.0, uWireW);
    if (a < 0.01) discard;
    diffuseColor.a *= a;
  }`);
  };
  mat.customProgramCacheKey = () => 'posit-wire-line';
  _mats.add(mat);
  return mat;
}

/**
 * 網目の座標（輪・向き）に沿った線の材質（乳房用）。
 * 乳房の網目は 1 つ 2〜5mm と細かいので、三角形の縁を塗る方法だと、太い線が三角形からはみ出して途切れる。
 * そこで頂点に「何本目の輪・何本目の向きか」を持たせ、その値が整数になる所を線として塗る
 * （方眼のような線。三角形の大きさに関係なく、太さどおりにつながる）。
 * grid = (輪 / 輪の間隔, 向き / 向きの間隔, 最後の輪 / 輪の間隔)
 */
function makeGridWireMaterial(opts) {
  const mat = new THREE.MeshBasicMaterial({
    color: opts.color ?? 0x11141a, transparent: true, opacity: opts.opacity ?? 0.85,
    depthWrite: false, side: THREE.FrontSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
  });
  mat.userData.wireLine = true;
  mat.onBeforeCompile = sh => {
    sh.uniforms.uWireW = WIRE.width;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 grid;\nvarying vec3 vGrid;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrid = grid;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWireW;\nvarying vec3 vGrid;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  {
    vec2 g = vGrid.xy;
    vec2 gx = dFdx(g), gy = dFdy(g);
    vec2 fw = max(sqrt(gx * gx + gy * gy), vec2(1e-6));
    // rings (not at the apex, not past the last ring) and radial lines
    float kr = floor(g.x + 0.5);
    float dRing = (kr >= 1.0 && kr <= floor(vGrid.z + 1e-3)) ? abs(g.x - kr) / fw.x : 1e4;
    float dRad = abs(g.y - floor(g.y + 0.5)) / fw.y;
    // one diagonal in every other cell, like the body mesh triangles
    float cr = floor(g.x), ca = floor(g.y);
    float dDia = 1e4;
    if (mod(ca, 2.0) < 0.5 && cr >= 1.0 && cr + 1.0 <= vGrid.z + 1e-3) {
      float du = (g.y - ca) - (g.x - cr);
      dDia = abs(du) / max(length(vec2(dFdx(du), dFdy(du))), 1e-6);
    }
    float d = min(min(dRing, dRad), dDia);
    float hw = max(0.25, uWireW * 0.5);
    float a = 1.0 - smoothstep(hw - 0.3, hw + 0.3, d);
    a *= min(1.0, uWireW);
    if (a < 0.01) discard;
    diffuseColor.a *= a;
  }`);
  };
  mat.customProgramCacheKey = () => 'posit-wire-grid';
  _mats.add(mat);
  return mat;
}

/**
 * 網目の座標付きの、面の線用の形状（乳房用）。
 * @param {THREE.BufferGeometry} geo  インデックス付きの網目
 * @param {Float32Array} vr  頂点ごとの輪の番号（頂点 = 0）
 * @param {Float32Array} va  頂点ごとの向きの番号（0〜NA-1。頂点は使わない）
 * @param {{RS:number, AS:number, NR:number, NA:number}} o  輪・向きの間隔と数
 */
export function makeGridWireGeometry(geo, vr, va, o) {
  const index = geo.index.array;
  const nTri = Math.floor(index.length / 3);
  const g = geo.toNonIndexed();
  const grid = new Float32Array(nTri * 9);
  for (let t = 0; t < nTri; t++) {
    const ids = [index[t * 3], index[t * 3 + 1], index[t * 3 + 2]];
    const rs = ids.map(i => vr[i]);
    let as = ids.map(i => va[i]);
    // 継ぎ目（向き 71 と 0）をまたぐ三角形は、0 を 72 として続ける
    const real = as.filter((_, k) => rs[k] > 0);
    if (real.length && Math.max(...real) - Math.min(...real) > o.NA / 2) as = as.map((a, k) => (rs[k] > 0 && a < o.NA / 2 ? a + o.NA : a));
    // 頂の頂点は向きを持たないので、ほかの 2 点の真ん中にする
    const ra = as.filter((_, k) => rs[k] > 0);
    const mid = ra.length ? ra.reduce((x, y) => x + y, 0) / ra.length : 0;
    for (let k = 0; k < 3; k++) {
      grid[t * 9 + k * 3] = rs[k] / o.RS;
      grid[t * 9 + k * 3 + 1] = (rs[k] > 0 ? as[k] : mid) / o.AS;
      grid[t * 9 + k * 3 + 2] = o.NR / o.RS;
    }
  }
  g.setAttribute('grid', new THREE.BufferAttribute(grid, 3));
  g.boundingBox = geo.boundingBox; g.boundingSphere = geo.boundingSphere;
  return g;
}

/** すべての面の線の濃さ（0〜1） */
export function setWireOpacity(v) {
  for (const m of _mats) m.opacity = v;
}

/**
 * 面の線用の形状を作る（インデックスなしに展開して、重心座標と描く辺の印を付ける）。
 * @param {THREE.BufferGeometry} geo
 * @param {Set<string>|null} keep  描く辺（"小さい頂点番号_大きい頂点番号"）。null なら全部の辺
 */
export function makeWireGeometry(geo, keep = null) {
  const index = geo.index ? geo.index.array : null;
  const nTri = Math.floor((index ? index.length : geo.attributes.position.count) / 3);
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const bary = new Float32Array(nTri * 9);
  const edge = new Float32Array(nTri * 9);
  for (let t = 0; t < nTri; t++) {
    const i0 = index ? index[t * 3] : t * 3, i1 = index ? index[t * 3 + 1] : t * 3 + 1, i2 = index ? index[t * 3 + 2] : t * 3 + 2;
    const on = e => (keep ? (keep.has(e[0] < e[1] ? `${e[0]}_${e[1]}` : `${e[1]}_${e[0]}`) ? 1 : 0) : 1);
    // 頂点 k の向かいの辺が k 番目
    const eo = [on([i1, i2]), on([i0, i2]), on([i0, i1])];
    for (let k = 0; k < 3; k++) {
      bary[t * 9 + k * 3 + k] = 1;
      edge[t * 9 + k * 3] = eo[0]; edge[t * 9 + k * 3 + 1] = eo[1]; edge[t * 9 + k * 3 + 2] = eo[2];
    }
  }
  g.setAttribute('bary', new THREE.BufferAttribute(bary, 3));
  g.setAttribute('edgeOn', new THREE.BufferAttribute(edge, 3));
  g.userData = { ...geo.userData };
  delete g.userData.maskReady; delete g.userData.masks; delete g.userData.fullIndex; delete g.userData.maskKey;
  g.boundingBox = geo.boundingBox; g.boundingSphere = geo.boundingSphere;
  return g;
}

/** 辺の集まり（線分の頂点番号の組から） */
export function edgeSet(pairs) {
  const s = new Set();
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    const a = pairs[i], b = pairs[i + 1];
    if (a !== b) s.add(a < b ? `${a}_${b}` : `${b}_${a}`);
  }
  return s;
}

// ===== wireLines.js ここまで =====
