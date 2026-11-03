// wireLines.js — 面の線（線の数・引き方・太さ・濃さを変えられる）
//
// WebGL の線（wireframe: true）は、どの端末でも 1px より太く描けず、線の数も網目のまま変えられない。
// そこで三角形そのものを塗り、線にしたい所だけを線の色にする。
//
// 線の引き方は 2 通り:
//   面の割れ（mesh）… 網目の三角形の縁に沿う。重心座標 (1,0,0)(0,1,0)(0,0,1) が 0 になる所が縁
//     - 少なめ … 四角の面: 2 つの三角形が四角を作っている所は、その対角線を描かない（元の網目は四角でできている）
//     - ふつう … 三角形の縁
//     - 多め／とても多め … 三角形を 2 分割・3 分割した線も描く（重心座標が 1/2, 1/3 … になる所）
//   体に沿った輪切り（lattice）… 胴・首と頭・腕・脚・足のそれぞれを、その部分の軸に直角な輪と、
//     軸に沿った縦の線で切る（v48。前の版は世界の 3 方向の平面で切っていたので、斜めの部分で線が詰まった）。
//     網目に関係なく線の数を大きく減らせる（輪の間隔・縦の線の本数で数が決まる）
//
// 縁や線からの距離は、画面の画素で測る（dFdx / dFdy）。拡大・縮小しても線は同じ太さ。
// スキン・モーフ・クリップ面はふつうの MeshBasicMaterial のまま効く。

import * as THREE from 'three';

/** 全部の線で共有する設定（つまみ・ボタン 1 つで全部変わる） */
export const WIRE = {
  width: { value: 1.0 },     // 線の太さ（画面の画素。1 = 前の版までの線と同じ 1 画素）
  mode: { value: 0 },        // 0 = 面の割れに沿う、1 = 等間隔の輪切り
  div: { value: 1 },         // 面の割れ: 三角形を何分割するか（1・2・3）
  quad: { value: 0 },        // 面の割れ: 1 なら四角の面（対角線を描かない）
  latF: { value: 1 / 28 },   // 輪切り: 間隔（体の高さに対する割合）
  mer: { value: 12 },        // 輪切り: 縦の線の本数（ひと回り）
};

/** 線の数の段（0 = 少なめ … 3 = とても多め）ごとの値 */
export const WIRE_DENSITY = [
  { name: '少なめ', div: 1, quad: 1, latF: 1 / 16, mer: 6 },
  { name: 'ふつう', div: 1, quad: 0, latF: 1 / 26, mer: 8 },
  { name: '多め', div: 2, quad: 0, latF: 1 / 42, mer: 12 },
  { name: 'とても多め', div: 3, quad: 0, latF: 1 / 64, mer: 16 },
];

/** 線の数と引き方を変える */
export function setWireStyle(mode, density) {
  const d = WIRE_DENSITY[Math.max(0, Math.min(WIRE_DENSITY.length - 1, density | 0))];
  WIRE.mode.value = mode === 'lattice' ? 1 : 0;
  WIRE.div.value = d.div;
  WIRE.quad.value = d.quad;
  WIRE.latF.value = d.latF;
  WIRE.mer.value = d.mer;
}

const _mats = new Set();

const baseMaterial = opts => {
  const mat = new THREE.MeshBasicMaterial({
    color: opts.color ?? 0x11141a, transparent: true, opacity: opts.opacity ?? 0.85,
    depthWrite: false, side: THREE.FrontSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
  });
  mat.userData.wireLine = true;
  // 輪切りの間隔の基準（その形の体の高さ。形の座標の単位で）
  mat.userData.uLatH = { value: opts.latH || 1.8 };
  _mats.add(mat);
  return mat;
};

// 共通: 輪切りの線までの距離と、線の濃さ
const LATTICE = `
    // rings across the body part (vCont.x = distance along its axis) and lines along it (vCont.y = turns around it)
    vec2 q = vec2(vCont.x / max(uLatH * uLatF, 1e-6), vCont.y * uMer);
    vec2 qx = dFdx(q), qy = dFdy(q);
    vec2 qp = abs(q - floor(q + 0.5)) / max(sqrt(qx * qx + qy * qy), vec2(1e-6));
    float dLat = vCont.z > 0.5 ? min(qp.x, qp.y) : 1e4;`;
const ALPHA = `
    float hw = max(0.25, uWireW * 0.5);
    float a = 1.0 - smoothstep(hw - 0.3, hw + 0.3, d);
    // lines thinner than one pixel are drawn fainter instead
    a *= min(1.0, uWireW);
    if (a < 0.01) discard;
    diffuseColor.a *= a;`;
const UNIFORMS = 'uniform float uWireW;\nuniform float uWireMode;\nuniform float uWireDiv;\nuniform float uWireQuad;\nuniform float uLatF;\nuniform float uLatH;\nuniform float uMer;\nvarying vec3 vCont;\n';
const bindUniforms = (sh, mat) => {
  sh.uniforms.uWireW = WIRE.width;
  sh.uniforms.uWireMode = WIRE.mode;
  sh.uniforms.uWireDiv = WIRE.div;
  sh.uniforms.uWireQuad = WIRE.quad;
  sh.uniforms.uLatF = WIRE.latF;
  sh.uniforms.uLatH = mat.userData.uLatH;
  sh.uniforms.uMer = WIRE.mer;
};

/**
 * 面の線の材質。opacity は濃さ。
 * @param {object} [opts]  { color, opacity, grid（乳房の網目用）, latH（輪切りの基準の高さ） }
 */
export function makeWireMaterial(opts = {}) {
  if (opts.grid) return makeGridWireMaterial(opts);
  const mat = baseMaterial(opts);
  mat.onBeforeCompile = sh => {
    bindUniforms(sh, mat);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 bary;\nattribute vec3 edgeOn;\nattribute vec3 edgeQuad;\nattribute vec3 cont;\nvarying vec3 vBary;\nvarying vec3 vEdgeOn;\nvarying vec3 vEdgeQuad;\nvarying vec3 vCont;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBary = bary;\nvEdgeOn = edgeOn;\nvEdgeQuad = edgeQuad;\nvCont = cont;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + UNIFORMS + 'varying vec3 vBary;\nvarying vec3 vEdgeOn;\nvarying vec3 vEdgeQuad;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  {
    float d;
    if (uWireMode < 0.5) {
      // distance to the nearest drawn edge / subdivision line, in device pixels
      vec3 b = vBary * uWireDiv;
      vec3 gx = dFdx(b), gy = dFdy(b);
      vec3 near = floor(b + 0.5);
      vec3 px = abs(b - near) / max(sqrt(gx * gx + gy * gy), vec3(1e-6));
      // the triangle's own edges (b = 0) can be switched off (quad view, or edges not drawn)
      vec3 on = mix(vEdgeOn, vEdgeOn * vEdgeQuad, uWireQuad);
      px += step(near, vec3(0.5)) * (1.0 - on) * 1e4;
      // b = 1 is only the opposite corner, not a line
      px += step(uWireDiv - 0.5, near) * 1e4;
      d = min(min(px.x, px.y), px.z);
    } else {${LATTICE}
      d = dLat;
    }${ALPHA}
  }`);
  };
  mat.customProgramCacheKey = () => 'posit-wire-line3';
  return mat;
}

/**
 * 網目の座標（輪・向き）に沿った線の材質（乳房用）。
 * 乳房の網目は 1 つ 2〜5mm と細かいので、三角形の縁を塗る方法だと、太い線が三角形からはみ出して途切れる。
 * そこで頂点に「何本目の輪・何本目の向きか」を持たせ、その値が整数になる所を線として塗る
 * （方眼のような線。三角形の大きさに関係なく、太さどおりにつながる）。
 * grid = (輪 / 輪の間隔, 向き / 向きの間隔, 最後の輪 / 輪の間隔)
 * 線の数: 少なめは斜めの線を描かない（四角の面）、多め・とても多めは間隔を 1/2・1/3 にする。
 * 等間隔の輪切りのときは、体と同じ輪切りの線を描く（形の座標が体と同じなので、線が体とつながる）
 */
function makeGridWireMaterial(opts) {
  const mat = baseMaterial(opts);
  mat.onBeforeCompile = sh => {
    bindUniforms(sh, mat);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 grid;\nattribute vec3 cont;\nvarying vec3 vGrid;\nvarying vec3 vCont;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrid = grid;\nvCont = cont;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + UNIFORMS + 'varying vec3 vGrid;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  {
    float d;
    if (uWireMode < 0.5) {
      vec2 g = vGrid.xy * uWireDiv;
      float last = vGrid.z * uWireDiv;
      vec2 gx = dFdx(g), gy = dFdy(g);
      vec2 fw = max(sqrt(gx * gx + gy * gy), vec2(1e-6));
      // rings (not at the apex, not past the last ring) and radial lines
      float kr = floor(g.x + 0.5);
      float dRing = (kr >= 1.0 && kr <= floor(last + 1e-3)) ? abs(g.x - kr) / fw.x : 1e4;
      float dRad = abs(g.y - floor(g.y + 0.5)) / fw.y;
      // one diagonal in every other cell, like the body mesh triangles (none in the quad view)
      float cr = floor(g.x), ca = floor(g.y);
      float du = (g.y - ca) - (g.x - cr);
      float dDu = abs(du) / max(length(vec2(dFdx(du), dFdy(du))), 1e-6);
      float dDia = (uWireQuad < 0.5 && mod(ca, 2.0) < 0.5 && cr >= 1.0 && cr + 1.0 <= last + 1e-3) ? dDu : 1e4;
      d = min(min(dRing, dRad), dDia);
    } else {${LATTICE}
      d = dLat;
    }${ALPHA}
  }`);
  };
  mat.customProgramCacheKey = () => 'posit-wire-grid3';
  return mat;
}

/** 輪切りの基準の高さを変える（読み込んだ形の大きさに合わせる） */
export function setWireLatticeHeight(mat, h) {
  if (mat && mat.userData.uLatH && h > 1e-6) mat.userData.uLatH.value = h;
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
 * edgeOn … 描く辺（keep で選ぶ。null なら全部）
 * edgeQuad … 四角の面のときに描く辺（2 つの三角形が四角を作っているとき、その対角線 = 両方でいちばん長い辺は 0）
 * @param {THREE.BufferGeometry} geo
 * @param {Set<string>|null} keep  描く辺（"小さい頂点番号_大きい頂点番号"）。null なら全部の辺
 */
export function makeWireGeometry(geo, keep = null) {
  // 見る範囲（手だけ等）でインデックスを差し替えている最中でも、元の全部の面から作る
  const idxAttr = (geo.userData && geo.userData.fullIndex) || geo.index;
  const index = idxAttr ? idxAttr.array : null;
  const pos = geo.attributes.position;
  const nTri = Math.floor((index ? index.length : pos.count) / 3);
  let g;
  if (index) {
    const keepIdx = geo.index;
    geo.setIndex(idxAttr);
    g = geo.toNonIndexed();
    geo.setIndex(keepIdx);
  } else g = geo.clone();
  const vid = (t, k) => (index ? index[t * 3 + k] : t * 3 + k);
  const key = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  // 四角の面: 三角形ごとのいちばん長い辺を数え、2 つの三角形で共通（どちらでもいちばん長い）なら対角線
  const longest = new Array(nTri);
  const count = new Map();
  const d2 = (a, b) => {
    const dx = pos.getX(a) - pos.getX(b), dy = pos.getY(a) - pos.getY(b), dz = pos.getZ(a) - pos.getZ(b);
    return dx * dx + dy * dy + dz * dz;
  };
  for (let t = 0; t < nTri; t++) {
    const i0 = vid(t, 0), i1 = vid(t, 1), i2 = vid(t, 2);
    const ls = [d2(i1, i2), d2(i0, i2), d2(i0, i1)];
    const k = ls[0] >= ls[1] && ls[0] >= ls[2] ? 0 : ls[1] >= ls[2] ? 1 : 2;
    const e = k === 0 ? key(i1, i2) : k === 1 ? key(i0, i2) : key(i0, i1);
    longest[t] = { k, e };
    count.set(e, (count.get(e) || 0) + 1);
  }
  const bary = new Float32Array(nTri * 9);
  const edge = new Float32Array(nTri * 9);
  const quad = new Float32Array(nTri * 9).fill(1);
  for (let t = 0; t < nTri; t++) {
    const i0 = vid(t, 0), i1 = vid(t, 1), i2 = vid(t, 2);
    const on = (a, b) => (keep ? (keep.has(key(a, b)) ? 1 : 0) : 1);
    // 頂点 k の向かいの辺が k 番目
    const eo = [on(i1, i2), on(i0, i2), on(i0, i1)];
    const L = longest[t];
    const diag = count.get(L.e) === 2 ? L.k : -1;
    for (let k = 0; k < 3; k++) {
      bary[t * 9 + k * 3 + k] = 1;
      edge[t * 9 + k * 3] = eo[0]; edge[t * 9 + k * 3 + 1] = eo[1]; edge[t * 9 + k * 3 + 2] = eo[2];
      if (diag >= 0) quad[t * 9 + k * 3 + diag] = 0;
    }
  }
  g.setAttribute('bary', new THREE.BufferAttribute(bary, 3));
  g.setAttribute('edgeOn', new THREE.BufferAttribute(edge, 3));
  g.setAttribute('edgeQuad', new THREE.BufferAttribute(quad, 3));
  g.userData = { ...geo.userData };
  delete g.userData.maskReady; delete g.userData.masks; delete g.userData.fullIndex; delete g.userData.maskKey;
  g.boundingBox = geo.boundingBox; g.boundingSphere = geo.boundingSphere;
  return g;
}

/**
 * 体に沿った輪切りの座標を、面の線の形（インデックスなし）に付ける。
 * 三角形ごとに「いちばん重みの大きい骨」から体の部分（胴・首と頭・左右の腕・左右の脚・左右の足）を決め、
 * その部分の軸（骨の基準の並び）に沿った距離と、軸のまわりの角度を、3 頂点とも同じ部分で測る
 * （三角形の中で部分が混ざらないので、線が途切れず素直に引ける。部分の境目では線が切り替わる）。
 * 座標は形の座標（スキン前）で測るので、ポーズを変えても線は体に付いたまま。
 * cont = (軸に沿った距離, 軸のまわりの回転（1 = ひと回り）, 1 = 線を引く／0 = 引かない)
 * @param {THREE.BufferGeometry} g  インデックスなしの形（position・skinIndex・skinWeight）
 * @param {THREE.SkinnedMesh} mesh  骨と結び付いたメッシュ（骨の基準の位置を出すのに使う）
 * @param {object} slot  ビューアの slot（boneMap・boneToJoint）
 */
export function addContourAttribute(g, mesh, slot) {
  const pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const n = pos.count, nTri = Math.floor(n / 3);
  const cont = new Float32Array(n * 3);
  g.setAttribute('cont', new THREE.BufferAttribute(cont, 3));
  if (!mesh || !mesh.isSkinnedMesh || !mesh.skeleton || !si || !sw || !slot || !slot.boneMap) return g;
  const sk = mesh.skeleton, bones = sk.bones;
  // 骨の基準の位置（形の座標）: bindMatrixInverse · boneInverse⁻¹ の原点
  const bindInv = mesh.bindMatrixInverse;
  const bp = b => {
    const i = bones.indexOf(b);
    if (i < 0) return null;
    return new THREE.Vector3().applyMatrix4(bindInv.clone().multiply(sk.boneInverses[i].clone().invert()));
  };
  const P = k => (slot.boneMap[k] ? bp(slot.boneMap[k]) : null);
  // 体の部分ごとの軸と起点
  const parts = {};
  const def = (name, from, to, ext = null) => {
    const a = P(from);
    let b = to ? P(to) : null;
    if (a && !b && ext) b = a.clone().add(ext);
    if (!a || !b || a.distanceTo(b) < 1e-6) return;
    const axis = b.clone().sub(a).normalize();
    // 角度の基準: 人形の前（形の座標の +Z）を軸に直角にしたもの。足のように軸が前を向くときは上（+Y）
    let ref = new THREE.Vector3(0, 0, 1);
    if (Math.abs(ref.dot(axis)) > 0.8) ref = new THREE.Vector3(0, 1, 0);
    ref.addScaledVector(axis, -ref.dot(axis)).normalize();
    parts[name] = { o: a, axis, ref, side: axis.clone().cross(ref).normalize() };
  };
  def('trunk', 'hips', 'neck');
  def('head', 'neck', 'head');        // 首の付け根→頭のボーンの向きを、頭の上までそのまま延ばす
  for (const sd of ['L', 'R']) {
    def('arm' + sd, 'upperArm' + sd, 'hand' + sd);
    def('leg' + sd, 'thigh' + sd, 'foot' + sd);
    const foot = slot.boneMap['foot' + sd];
    const toe = foot && foot.children.find(c => c.isBone);
    if (foot && toe) {
      const a = bp(foot), b = bp(toe);
      if (a && b && a.distanceTo(b) > 1e-6) {
        const axis = b.clone().sub(a).normalize();
        let ref = new THREE.Vector3(0, 1, 0);
        if (Math.abs(ref.dot(axis)) > 0.8) ref = new THREE.Vector3(0, 0, 1);
        ref.addScaledVector(axis, -ref.dot(axis)).normalize();
        parts['foot' + sd] = { o: a, axis, ref, side: axis.clone().cross(ref).normalize() };
      }
    }
  }
  const partOfKey = k => {
    if (/^(hips|spine|chest|shoulder[LR])$/.test(k)) return 'trunk';
    if (/^(neck|head|jaw)$/.test(k)) return 'head';
    const m = k.match(/^(upperArm|forearm|hand)([LR])$/); if (m) return 'arm' + m[2];
    const l = k.match(/^(thigh|shin)([LR])$/); if (l) return 'leg' + l[2];
    const f = k.match(/^foot([LR])$/); if (f) return parts['foot' + f[1]] ? 'foot' + f[1] : 'leg' + f[1];
    return null;
  };
  // 骨の番号 → 体の部分（指・つま先などは、関節の付いた親までたどる）
  const partOfBone = bones.map(b => {
    for (let x = b, i = 0; x && i < 30; x = x.parent, i++) {
      const k = slot.boneToJoint && slot.boneToJoint.get(x);
      if (k) return partOfKey(k);
    }
    return null;
  });
  const v = new THREE.Vector3();
  for (let t = 0; t < nTri; t++) {
    // 三角形でいちばん重みの大きい骨
    const acc = new Map();
    for (let c = 0; c < 3; c++) for (let q = 0; q < 4; q++) {
      const w = sw.getComponent(t * 3 + c, q);
      if (w > 0) { const bi = si.getComponent(t * 3 + c, q); acc.set(bi, (acc.get(bi) || 0) + w); }
    }
    let bi = -1, bw = -1;
    for (const [k, w] of acc) if (w > bw) { bw = w; bi = k; }
    const pn = bi >= 0 ? partOfBone[bi] : null;
    const pt = pn && parts[pn];
    if (!pt) continue;
    const th = [];
    for (let c = 0; c < 3; c++) {
      const i = t * 3 + c;
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(pt.o);
      const along = v.dot(pt.axis);
      cont[i * 3] = along;
      th.push(Math.atan2(v.dot(pt.side), v.dot(pt.ref)) / (Math.PI * 2));
      cont[i * 3 + 2] = 1;
    }
    // 継ぎ目（ひと回りの境目）をまたぐ三角形は、続けて数える
    const mx = Math.max(...th), mn = Math.min(...th);
    for (let c = 0; c < 3; c++) {
      let a = th[c];
      if (mx - mn > 0.5 && a < 0) a += 1;
      cont[(t * 3 + c) * 3 + 1] = a;
    }
  }
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
