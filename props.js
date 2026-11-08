// props.js — 小物
//   置く物: 椅子・スツール・ベンチ・ソファ・台・箱・円柱台・階段・鉄棒・壁・石膏像（彫刻の 3D スキャン 16 体）
//   手に持つ物: 棒・ボール・本・コップ・傘・剣・かばん・ダンベル・拳銃・ライフル・刀・槍・弓・バット・ラケット・杖・盾・スマホ・ペン
//
// ・置く: 種類を選ぶと、人形の近くに置く（椅子・スツール・ベンチ・ソファは、座っている人形ならお尻の下へ、座面の高さも合わせる）
// ・動かす: 小物を押したまま、画面の面の中で上下左右に動かす（床に置く物は床より下へは行かない）
// ・回す: 選ぶと出る輪を回す（床に置く物は縦の軸だけ、手に持つ物は 3 軸）
// ・大きさ: 全体・縦・横・奥行きを別々に変える（座面・天板の高さがある物の「縦」はその高さ）
// ・手で持つ: 「右手」「左手」で、手と小物をつなぐ
//     手に持つ物 … 決めた持つ所（柄・取っ手など）を手の中へ動かして、手に付いて動く。両手で持つと、もう一方の手もついてくる
//     置く物 … 手をいちばん近い所へ寄せて、小物の側に手を固定する（小物を動かすと手がついてくる。手を引っ張ると面の上を滑る）
//   2 体のときは、いま動かしている人形につなぐ（入れ替えると、もう一方の人形のつなぎが生きる）

import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// 棒を握る所: 手首から指の付け根までの長さに対する割合（指の向き）と、手のひらからの深さ（m）
let GRIP_A = 0.55, GRIP_P = 0.02;
export function setGripPoint(a, p) { GRIP_A = a; GRIP_P = p; }

export const PROP_TYPES = [
  { key: 'chair', name: '椅子', grounded: true },
  { key: 'stool', name: 'スツール', grounded: true },
  { key: 'bench', name: 'ベンチ', grounded: true },
  { key: 'sofa', name: 'ソファ', grounded: true },
  { key: 'table', name: '台', grounded: true },
  { key: 'box', name: '箱', grounded: true },
  { key: 'pedestal', name: '円柱台', grounded: true },
  { key: 'stairs', name: '階段', grounded: true },
  { key: 'bar', name: '鉄棒', grounded: true },
  { key: 'wall', name: '壁', grounded: true },
  { key: 'stick', name: '棒', grounded: false },
  { key: 'ball', name: 'ボール', grounded: false },
  { key: 'book', name: '本', grounded: false },
  { key: 'cup', name: 'コップ', grounded: false },
  { key: 'umbrella', name: '傘', grounded: false },
  { key: 'sword', name: '剣', grounded: false },
  { key: 'bag', name: 'かばん', grounded: false },
  { key: 'dumbbell', name: 'ダンベル', grounded: false },
  { key: 'pistol', name: '拳銃', grounded: false },
  { key: 'rifle', name: 'ライフル', grounded: false },
  { key: 'katana', name: '刀', grounded: false },
  { key: 'spear', name: '槍', grounded: false },
  { key: 'bow', name: '弓', grounded: false },
  { key: 'bat', name: 'バット', grounded: false },
  { key: 'racket', name: 'ラケット', grounded: false },
  { key: 'cane', name: '杖', grounded: false },
  { key: 'shield', name: '盾', grounded: false },
  { key: 'phone', name: 'スマホ', grounded: false },
  { key: 'pen', name: 'ペン', grounded: false },
  // 石膏像（彫刻の 3D スキャン）。一覧には像ごとに並べる（opts.variant で像を選ぶ）
  { key: 'statue', name: '石膏像', grounded: true, list: false },
  // 幾何形体（石膏。立方体・円柱など。opts.variant で形を選ぶ）
  { key: 'solid', name: '幾何形体', grounded: true, list: false },
];
const MESH_TYPES = new Set(['statue', 'solid']);   // 形そのもの（3D の網）で当たる物
const TYPE = Object.fromEntries(PROP_TYPES.map(t => [t.key, t]));
// 座面・天板などの高さ（h）を持つ物。「縦」で大きさを変えるときは、この高さを変える
const H_TYPES = { chair: 0.45, stool: 0.45, bench: 0.43, sofa: 0.42, table: 0.72, pedestal: 0.6, bar: 1.1 };
const SEAT_TYPES = new Set(['chair', 'stool', 'bench', 'sofa']);

// 手に持つ物の、持つ所（小物の座標）
//   rod: 握る軸（c: 握る所・ax: 軸の向き → 親指の側）。down: 手の指の向き（hang: 真下）へ向ける向き / face: 手のひらの向きへ向ける向き / off: 握りこぶしの中心から手のひらの側へずらす
//   palm: 手のひらに載せる（c: 当てる所・n: 手のひらに向ける外向き・along: 指の向きへ向ける向き）
//   ball: 手のひらで包む
const HANDLES = {
  stick: { k: 'rod', c: [0, 0, 0], ax: 'y', shape: 'grip' },
  ball: { k: 'ball', shape: 'hold' },
  book: { k: 'palm', c: [0, -0.015, 0], n: [0, -1, 0], along: [0, 0, 1], shape: 'press' },
  cup: { k: 'rod', c: [0, 0, 0], ax: 'y', off: 0.026, shape: 'grip' },
  umbrella: { k: 'rod', c: [0, 0.09, 0], ax: 'y', shape: 'grip' },
  sword: { k: 'rod', c: [0, 0.1, 0], ax: 'y', face: [0, 0, 1], shape: 'grip' },
  bag: { k: 'rod', c: [0, 0, 0], ax: 'x', down: [0, -1, 0], hang: true, shape: 'grip' },
  dumbbell: { k: 'rod', c: [0, 0, 0], ax: 'y', shape: 'grip' },
  // 銃: 握り（縦）を握り、銃身（+z）を指の向き（前腕の先）へ
  pistol: { k: 'rod', c: [0, 0, 0], ax: 'y', down: [0, 0, 1], shape: 'grip' },
  rifle: { k: 'rod', c: [0, 0, 0], ax: 'y', down: [0, 0, 1], shape: 'grip' },
  katana: { k: 'rod', c: [0, 0.2, 0], ax: 'y', face: [0, 0, 1], shape: 'grip' },
  spear: { k: 'rod', c: [0, 0, 0], ax: 'y', shape: 'grip' },
  // 弓: 握りを握り、弦（-z）を手首の側へ
  bow: { k: 'rod', c: [0, 0, 0], ax: 'y', down: [0, 0, 1], shape: 'grip' },
  bat: { k: 'rod', c: [0, 0.08, 0], ax: 'y', shape: 'grip' },
  racket: { k: 'rod', c: [0, 0.07, 0], ax: 'y', face: [0, 0, 1], shape: 'grip' },
  // 杖: 上の握り（前後）を握り、杖（-y）を真下へ（床につく向き）
  cane: { k: 'rod', c: [0, 0.9, 0.03], ax: 'z', down: [0, -1, 0], hang: true, shape: 'grip' },
  // 盾: 裏の取っ手を握り、盾（+z）を手の甲の側へ
  shield: { k: 'rod', c: [0, 0, -0.06], ax: 'y', face: [0, 0, -1], shape: 'grip' },
  phone: { k: 'palm', c: [0, 0, -0.004], n: [0, 0, -1], along: [0, 1, 0], shape: 'press' },
  pen: { k: 'rod', c: [0, -0.02, 0], ax: 'y', shape: 'grip' },
};
const AXV = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

// 形（小物の座標。床の中心が原点、+z が前）。box: 中心 c・大きさ s / cyl: 円柱（中心 c・半径 r・高さ h）/ sph: 球 / rod: 棒 / cone: 円すい（上がとがる）
//   円柱・棒・円すいの軸はふつう y。ax: 'x' | 'z' でその向きにする
function shapesOf(type, p) {
  const s = p.size || 1;
  switch (type) {
    case 'chair': {
      const h = p.h, w = 0.44, d = 0.42, t = 0.04, leg = 0.035;
      const out = [{ k: 'box', c: [0, h - t / 2, 0], s: [w, t, d] },
        { k: 'box', c: [0, h + 0.24, -d / 2 + 0.015], s: [w, 0.40, 0.03] }];
      for (const x of [-1, 1]) for (const z of [-1, 1]) out.push({ k: 'box', c: [x * (w / 2 - leg / 2), (h - t) / 2, z * (d / 2 - leg / 2)], s: [leg, h - t, leg] });
      return out;
    }
    case 'stool': {
      const h = p.h, r = 0.17, t = 0.04;
      const out = [{ k: 'cyl', c: [0, h - t / 2, 0], r, h: t }];
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; out.push({ k: 'cyl', c: [Math.cos(a) * 0.11, (h - t) / 2, Math.sin(a) * 0.11], r: 0.016, h: h - t }); }
      return out;
    }
    case 'bench': {
      const h = p.h, w = 1.2, d = 0.36, t = 0.05;
      const out = [{ k: 'box', c: [0, h - t / 2, 0], s: [w, t, d] }];
      for (const x of [-1, 1]) out.push({ k: 'box', c: [x * (w / 2 - 0.1), (h - t) / 2, 0], s: [0.05, h - t, d - 0.04] });
      return out;
    }
    case 'sofa': {
      const h = p.h, w = 1.6, d = 0.8;
      return [{ k: 'box', c: [0, h / 2, 0], s: [w, h, d] },
        { k: 'box', c: [0, h + 0.21, -d / 2 + 0.1], s: [w, 0.42, 0.2] },
        { k: 'box', c: [-(w / 2 - 0.09), h + 0.11, 0.1], s: [0.18, 0.22, d - 0.2] },
        { k: 'box', c: [w / 2 - 0.09, h + 0.11, 0.1], s: [0.18, 0.22, d - 0.2] }];
    }
    case 'table': {
      const h = p.h, w = 1.0 * s, d = 0.6 * s, t = 0.04, leg = 0.05;
      const out = [{ k: 'box', c: [0, h - t / 2, 0], s: [w, t, d] }];
      for (const x of [-1, 1]) for (const z of [-1, 1]) out.push({ k: 'box', c: [x * (w / 2 - 0.06), (h - t) / 2, z * (d / 2 - 0.06)], s: [leg, h - t, leg] });
      return out;
    }
    case 'box': { const a = 0.4 * s; return [{ k: 'box', c: [0, a / 2, 0], s: [a, a, a] }]; }
    case 'pedestal': return [{ k: 'cyl', c: [0, p.h / 2, 0], r: 0.25 * s, h: p.h }];
    case 'stairs': {
      // 3 段（手前がいちばん低い）
      const w = 0.8, rise = 0.18, tr = 0.28, out = [];
      for (let i = 0; i < 3; i++) out.push({ k: 'box', c: [0, (i + 1) * rise / 2, (1 - i) * tr], s: [w, (i + 1) * rise, tr] });
      return out;
    }
    case 'bar': {
      const h = p.h, w = 1.5;
      return [{ k: 'rod', c: [-w / 2, h / 2, 0], r: 0.022, h },
        { k: 'rod', c: [w / 2, h / 2, 0], r: 0.022, h },
        { k: 'rod', c: [0, h, 0], r: 0.017, h: w + 0.044, ax: 'x' }];
    }
    case 'wall': return [{ k: 'box', c: [0, 1.2 * s, 0], s: [2.0 * s, 2.4 * s, 0.06] }];
    case 'solid':
    case 'statue': {
      // 当たり・持つ所は、像を囲む箱（読み込む前は仮の大きさ）
      const b = p.bb || [0.35, 0.7, 0.35];
      return [{ k: 'box', c: [0, b[1] / 2, 0], s: b }];
    }
    case 'stick': return [{ k: 'rod', c: [0, 0, 0], r: 0.016, h: 1.2 * s }];
    case 'ball': return [{ k: 'sph', c: [0, 0, 0], r: 0.11 * s }];
    case 'book': return [{ k: 'box', c: [0, 0, 0], s: [0.17, 0.03, 0.24] }];
    case 'cup': return [{ k: 'cyl', c: [0, 0, 0], r: 0.042, h: 0.1 }];
    case 'umbrella': return [{ k: 'rod', c: [0, 0.43, 0], r: 0.012, h: 0.86 },
      { k: 'cone', c: [0, 0.75, 0], r: 0.5, h: 0.22 }];
    case 'sword': return [{ k: 'rod', c: [0, 0.1, 0], r: 0.016, h: 0.2 },
      { k: 'box', c: [0, 0.212, 0], s: [0.2, 0.024, 0.035] },
      { k: 'box', c: [0, 0.6, 0], s: [0.045, 0.75, 0.008] }];
    case 'bag': return [{ k: 'rod', c: [0, 0, 0], r: 0.011, h: 0.13, ax: 'x' },
      { k: 'box', c: [-0.06, -0.035, 0], s: [0.014, 0.07, 0.014] },
      { k: 'box', c: [0.06, -0.035, 0], s: [0.014, 0.07, 0.014] },
      { k: 'box', c: [0, -0.21, 0], s: [0.38, 0.28, 0.12] }];
    case 'pistol': return [{ k: 'box', c: [0, 0, 0], s: [0.03, 0.11, 0.045] },
      { k: 'box', c: [0, 0.072, 0.055], s: [0.03, 0.034, 0.2] },
      { k: 'box', c: [0, 0.036, 0.035], s: [0.008, 0.026, 0.04] }];
    case 'rifle': return [{ k: 'box', c: [0, 0, 0], s: [0.03, 0.1, 0.04] },
      { k: 'box', c: [0, 0.075, 0.08], s: [0.05, 0.075, 0.48] },
      { k: 'rod', c: [0, 0.085, 0.55], r: 0.011, h: 0.46, ax: 'z' },
      { k: 'box', c: [0, 0.03, 0.14], s: [0.03, 0.13, 0.05] },
      { k: 'box', c: [0, 0.05, -0.3], s: [0.04, 0.11, 0.3] }];
    case 'katana': return [{ k: 'rod', c: [0, 0.14, 0], r: 0.015, h: 0.28 },
      { k: 'cyl', c: [0, 0.29, 0], r: 0.04, h: 0.01 },
      { k: 'box', c: [0, 0.66, 0.004], s: [0.03, 0.72, 0.007] }];
    case 'spear': return [{ k: 'rod', c: [0, 0.3, 0], r: 0.014, h: 1.9 },
      { k: 'cone', c: [0, 1.35, 0], r: 0.025, h: 0.2 }];
    case 'bow': return [{ k: 'rod', c: [0, 0, 0], r: 0.017, h: 0.13 },
      { k: 'rod', c: [0, 0.33, 0.03], r: 0.011, h: 0.55 },
      { k: 'rod', c: [0, -0.33, 0.03], r: 0.011, h: 0.55 },
      { k: 'rod', c: [0, 0, -0.11], r: 0.0025, h: 1.2 }];
    case 'bat': return [{ k: 'rod', c: [0, 0.17, 0], r: 0.016, h: 0.34 },
      { k: 'cyl', c: [0, 0.58, 0], r: 0.033, h: 0.5 },
      { k: 'cyl', c: [0, 0, 0], r: 0.024, h: 0.015 }];
    case 'racket': return [{ k: 'rod', c: [0, 0.1, 0], r: 0.014, h: 0.2 },
      { k: 'rod', c: [0, 0.25, 0], r: 0.01, h: 0.12 },
      { k: 'cyl', c: [0, 0.44, 0], r: 0.13, h: 0.02, ax: 'z' }];
    case 'cane': return [{ k: 'rod', c: [0, 0.45, 0], r: 0.012, h: 0.9 },
      { k: 'rod', c: [0, 0.9, 0.03], r: 0.014, h: 0.13, ax: 'z' }];
    case 'shield': return [{ k: 'cyl', c: [0, 0, 0], r: 0.3, h: 0.03, ax: 'z' },
      { k: 'rod', c: [0, 0, -0.06], r: 0.012, h: 0.12 },
      { k: 'box', c: [0, 0.07, -0.035], s: [0.02, 0.02, 0.05] },
      { k: 'box', c: [0, -0.07, -0.035], s: [0.02, 0.02, 0.05] }];
    case 'phone': return [{ k: 'box', c: [0, 0, 0], s: [0.072, 0.15, 0.008] }];
    case 'pen': return [{ k: 'rod', c: [0, 0, 0], r: 0.005, h: 0.14 },
      { k: 'cone', c: [0, 0.08, 0], r: 0.005, h: 0.02 }];
    case 'dumbbell': return [{ k: 'rod', c: [0, 0, 0], r: 0.016, h: 0.38 },
      { k: 'cyl', c: [0, 0.12, 0], r: 0.075, h: 0.05 }, { k: 'cyl', c: [0, -0.12, 0], r: 0.075, h: 0.05 },
      { k: 'cyl', c: [0, 0.165, 0], r: 0.062, h: 0.035 }, { k: 'cyl', c: [0, -0.165, 0], r: 0.062, h: 0.035 }];
  }
  return [];
}

function geometryOf(sh) {
  let g;
  if (sh.k === 'box') return new THREE.BoxGeometry(...sh.s);
  if (sh.k === 'sph') return new THREE.SphereGeometry(sh.r, 32, 20);
  if (sh.k === 'cone') g = new THREE.ConeGeometry(sh.r, sh.h, 40);
  else g = new THREE.CylinderGeometry(sh.r, sh.r, sh.h, sh.k === 'rod' ? 16 : 32);
  if (sh.ax === 'x') g.rotateZ(-Math.PI / 2);
  else if (sh.ax === 'z') g.rotateX(Math.PI / 2);
  return g;
}

// 軸の向き（x・z）を y と入れ替える（入れ替えは自分に戻る）
const swapAx = (ax, v) => (ax === 'x' ? V(v.y, v.x, v.z) : ax === 'z' ? V(v.x, v.z, v.y) : v.clone());

// 形の表面でいちばん近い点と、外向きの向き（小物の座標で）
function closestOn(sh, q) {
  if (sh.ax && sh.ax !== 'y' && sh.k !== 'box' && sh.k !== 'sph') {
    const r = closestOn({ ...sh, ax: null, c: swapAx(sh.ax, V(...sh.c)).toArray() }, swapAx(sh.ax, q));
    return { p: swapAx(sh.ax, r.p), n: swapAx(sh.ax, r.n) };
  }
  if (sh.k === 'cone') {
    // 円すい: その高さの半径の円柱として見る（おおよそ）
    const dy = Math.max(-sh.h / 2, Math.min(sh.h / 2, q.y - sh.c[1]));
    return closestOn({ ...sh, k: 'cyl', r: Math.max(0.005, sh.r * (0.5 - dy / sh.h)) }, q);
  }
  const c = V(...sh.c);
  if (sh.k === 'box') {
    const h = V(...sh.s).multiplyScalar(0.5), d = q.clone().sub(c);
    const inside = Math.abs(d.x) <= h.x && Math.abs(d.y) <= h.y && Math.abs(d.z) <= h.z;
    if (!inside) {
      const p = V(Math.max(-h.x, Math.min(h.x, d.x)), Math.max(-h.y, Math.min(h.y, d.y)), Math.max(-h.z, Math.min(h.z, d.z)));
      const n = d.clone().sub(p);
      // いちばん外へ出ている軸の面
      const ax = ['x', 'y', 'z'].reduce((a, b) => (Math.abs(n[b]) / h[b] > Math.abs(n[a]) / h[a] ? b : a), 'x');
      const nn = V(); nn[ax] = Math.sign(n[ax]) || 1;
      return { p: p.add(c), n: nn };
    }
    const ax = ['x', 'y', 'z'].reduce((a, b) => (h[b] - Math.abs(d[b]) < h[a] - Math.abs(d[a]) ? b : a), 'x');
    const p = d.clone(); p[ax] = Math.sign(d[ax] || 1) * h[ax];
    const nn = V(); nn[ax] = Math.sign(d[ax] || 1);
    return { p: p.add(c), n: nn };
  }
  if (sh.k === 'sph') {
    const n = q.clone().sub(c); if (n.lengthSq() < 1e-10) n.set(0, 1, 0); n.normalize();
    return { p: c.clone().addScaledVector(n, sh.r), n };
  }
  // 円柱（縦）: 横の面か上下の面
  const d = q.clone().sub(c), hh = sh.h / 2;
  const radial = V(d.x, 0, d.z), rl = radial.length();
  const y = Math.max(-hh, Math.min(hh, d.y));
  const rn = rl > 1e-6 ? radial.clone().divideScalar(rl) : V(1, 0, 0);
  const side = { p: V(rn.x * sh.r, y, rn.z * sh.r).add(c), n: rn };
  if (Math.abs(d.y) > hh && rl < sh.r) return { p: V(d.x, Math.sign(d.y) * hh, d.z).add(c), n: V(0, Math.sign(d.y), 0) };
  return side;
}

/** 3D の網（石膏像など）の表面でいちばん近い点と外向き（mesh: 小物の中の網。q・答えは小物の座標） */
const _tri = new THREE.Triangle(), _a = V(), _b = V(), _c = V(), _cp = V();
function closestOnMesh(mesh, q) {
  const g = mesh.geometry, pos = g.attributes.position, idx = g.index;
  // 小物の座標 → 網の座標
  const ql = q.clone().sub(mesh.position).divide(mesh.scale);
  const n = idx ? idx.count : pos.count;
  let best = Infinity, bp = null, bn = null;
  for (let i = 0; i < n; i += 3) {
    const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
    _a.fromBufferAttribute(pos, i0); _b.fromBufferAttribute(pos, i1); _c.fromBufferAttribute(pos, i2);
    // 遠い三角形は飛ばす（いちばん近い頂点が、いまの答えより遠いもの。大まかに）
    const dmin = Math.min(_a.distanceToSquared(ql), _b.distanceToSquared(ql), _c.distanceToSquared(ql));
    if (dmin > best + 0.01 && dmin > best * 4) continue;
    _tri.set(_a, _b, _c);
    _tri.closestPointToPoint(ql, _cp);
    const d = _cp.distanceToSquared(ql);
    if (d < best) { best = d; bp = _cp.clone(); bn = _tri.getNormal(V()); }
  }
  if (!bp) return null;
  // 外向きは、q の側を向くように
  if (ql.clone().sub(bp).dot(bn) < 0 && ql.distanceTo(bp) > 1e-4) bn.negate();
  if (mesh.scale.x < 0) bn.x = -bn.x;
  return { p: bp.multiply(mesh.scale).add(mesh.position), n: bn.normalize() };
}

/** 小物の向き: 小物の向き a1・b1 を、それぞれ a2・b2（b は a に直交するようにならす）へ向ける回転 */
function basisRot(a1, b1, a2, b2) {
  const mk = (a, b) => {
    const A = a.clone().normalize();
    const B = b.clone().addScaledVector(A, -b.dot(A));
    if (B.lengthSq() < 1e-8) B.copy(Math.abs(A.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0)).addScaledVector(A, -(Math.abs(A.y) < 0.9 ? A.y : A.x));
    B.normalize();
    return new THREE.Matrix4().makeBasis(A, B, V().crossVectors(A, B));
  };
  const M = mk(a2, b2).multiply(mk(a1, b1).transpose());
  return new THREE.Quaternion().setFromRotationMatrix(M);
}

export class Props {
  constructor(viewer) {
    this.v = viewer;
    this.items = [];
    this.selected = null;
    this.drag = null;
    this.hidden = false;
    this.onSelect = () => {};
    this.onChange = () => {};
    this._seq = 0;
    this.mat = new THREE.MeshStandardMaterial({ color: 0x8e9bb0, roughness: 0.75, metalness: 0.0 });
    this.matSel = new THREE.MeshStandardMaterial({ color: 0x9fb4d6, roughness: 0.7, metalness: 0.0, emissive: 0x1d3a66, emissiveIntensity: 0.55 });
    // 回す輪（選んだ小物のまわり。軸ごとの色は関節の輪と同じ）
    this.ringGroup = new THREE.Group();
    this.ringGroup.visible = false;
    this.rings = {};
    for (const [ax, col] of [['x', 0xff5468], ['y', 0x8fd44a], ['z', 0x4d8dff]]) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 128),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }));
      m.renderOrder = 1001; m.frustumCulled = false;
      this.ringGroup.add(m); this.rings[ax] = m;
    }
    viewer.scene.add(this.ringGroup);
  }

  // ---- 置く・消す ---------------------------------------------------------
  add(type, opts = {}) {
    const T = TYPE[type];
    if (!T) return null;
    const slot = this.v.primarySlot;
    const group = new THREE.Group();
    group.userData.prop = true;
    const it = { id: ++this._seq, type, name: opts.name || T.name, grounded: T.grounded, params: { size: 1, h: H_TYPES[type] || 0.45, sx: 1, sy: 1, sz: 1 }, group, meshes: [], grips: [] };
    if (MESH_TYPES.has(type)) it.variant = opts.variant;
    // 置く場所: 人形の前（腰の向き）
    const hips = slot && slot.boneMap.hips;
    const hp = hips ? hips.getWorldPosition(V()) : V(0, 0.9, 0);
    const fwd = hips ? V(0, 0, 1).applyQuaternion(hips.getWorldQuaternion(new THREE.Quaternion())) : V(0, 0, 1);
    fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1); fwd.normalize();
    const side = V(fwd.z, 0, -fwd.x);   // 人形の左
    const yaw = Math.atan2(fwd.x, fwd.z);
    group.quaternion.setFromAxisAngle(V(0, 1, 0), yaw);
    const sit = SEAT_TYPES.has(type) ? this._seatUnderBody() : null;
    if (sit) {
      it.params.h = Math.max(0.2, Math.min(0.9, sit.h));
      group.position.set(sit.x, 0, sit.z);
      // ソファは座面の真ん中が少し前（背もたれの分）
      if (type === 'sofa') group.position.addScaledVector(fwd, -0.1);
    } else if (SEAT_TYPES.has(type)) {
      // 立っているとき: 人形の左横に、同じ向きで置く（座らせるときは椅子を動かして、ポーズの「座る」を当てる）
      group.position.copy(hp).addScaledVector(side, type === 'sofa' ? 1.2 : type === 'bench' ? 0.95 : 0.7); group.position.y = 0;
    } else if (type === 'wall') {
      group.position.copy(hp).addScaledVector(fwd, -0.45); group.position.y = 0;
    } else if (type === 'stick') {
      group.position.copy(hp).addScaledVector(side, 0.45).addScaledVector(fwd, 0.15); group.position.y = 0.6;
    } else if (type === 'ball') {
      group.position.copy(hp).addScaledVector(fwd, 0.5); group.position.y = 0.11;
    } else if (!T.grounded) {
      // 手に持つ物: 人形の左前の、腰の高さ（「右手」「左手」で手の中へ）
      group.position.copy(hp).addScaledVector(side, 0.45).addScaledVector(fwd, 0.25); group.position.y = Math.max(0.3, hp.y - 0.1);
    } else if (type === 'bar') {
      group.position.copy(hp).addScaledVector(fwd, 0.45); group.position.y = 0;
    } else {
      group.position.copy(hp).addScaledVector(fwd, type === 'table' ? 0.55 : type === 'stairs' ? 0.75 : type === 'statue' ? 1.0 : 0.6); group.position.y = 0;
    }
    this.v.scene.add(group);
    this.items.push(it);
    this._build(it);
    if (MESH_TYPES.has(type)) this._loadStatue(it);
    if (!T.grounded) { group.updateWorldMatrix(true, true); this._keepAboveFloor(it); }
    group.visible = !this.hidden;
    if (opts.select !== false) this.select(it);
    this.onChange();
    return it;
  }

  /** 座っている人形のお尻の下（座面の高さ・場所）。座っていなければ null */
  _seatUnderBody(force = false) {
    const v = this.v, slot = v.primarySlot, cf = v.contactFix;
    if (!slot || !cf) return null;
    const hips = slot.boneMap.hips, tL = slot.boneMap.thighL, tR = slot.boneMap.thighR, kL = slot.boneMap.shinL, kR = slot.boneMap.shinR;
    if (!hips || !tL || !kL || !tR || !kR) return null;
    const P = b => b.getWorldPosition(V());
    const hp = P(hips);
    // 腿がほぼ水平（座っている）か
    const dL = P(kL).sub(P(tL)), dR = P(kR).sub(P(tR));
    const flat = d => Math.abs(d.y) / d.length() < 0.5;
    if (!force && (!flat(dL) || !flat(dR) || hp.y > 1.0 || hp.y < 0.3)) return null;
    let c;
    try { c = cf._prep(slot); v.scene.updateMatrixWorld(true); cf._read(c); } catch (e) { return null; }
    let minY = Infinity;
    const knee = P(kL).add(P(kR)).multiplyScalar(0.5);
    const fwd = knee.clone().sub(hp); fwd.y = 0; const fl = fwd.length(); if (fl < 1e-4) return null; fwd.divideScalar(fl);
    for (let i = 0; i < c.total; i++) {
      const g = c.G[i];
      if (g !== 0 && g !== 8 && g !== 9) continue;       // 体幹と腿だけ
      const x = c.P[i * 3], y = c.P[i * 3 + 1], z = c.P[i * 3 + 2];
      const along = (x - hp.x) * fwd.x + (z - hp.z) * fwd.z;
      if (along < -0.15 || along > fl * 0.6) continue;  // お尻〜腿の中ほど
      if (y < minY) minY = y;
    }
    if (!isFinite(minY)) return null;
    // 座面の中心は、お尻の少し前（腿の付け根の下）
    const ctr = hp.clone().addScaledVector(fwd, 0.08);
    return { h: minY + 0.004, x: ctr.x, z: ctr.z };
  }

  remove(it = this.selected) {
    if (!it) return;
    this.release(it);
    it.group.parent && it.group.parent.remove(it.group);
    for (const m of it.meshes) m.geometry.dispose();
    if (it.statueMesh) it.statueMesh.material.dispose();
    this.items = this.items.filter(x => x !== it);
    if (this.selected === it) this.select(null);
    this.onChange();
  }

  clear() { for (const it of [...this.items]) this.remove(it); }

  /** 戻す・やり直す用: 小物の中身（種類・大きさ・場所・向き・手足のつなぎ） */
  serialize() {
    return {
      sel: this.selected ? this.selected.id : null,
      items: this.items.map(it => ({
        id: it.id, type: it.type, variant: it.variant, name: it.name, auto: !!it.auto, holdAt: it.holdAt,
        params: JSON.parse(JSON.stringify(it.params)),
        pos: it.group.position.toArray(), quat: it.group.quaternion.toArray(),
        grips: it.grips.map(g => ({ key: g.key, doll: g.doll || 'A', rel: g.rel.elements.slice() })),
      })),
    };
  }

  /** 戻す・やり直す用: serialize の中身のとおりにする（同じ小物は作り直さずに直す） */
  restore(st) {
    const list = (st && st.items) || [];
    const ids = new Set(list.map(e => e.id));
    for (const it of [...this.items]) if (!ids.has(it.id)) {
      it.group.parent && it.group.parent.remove(it.group);
      for (const m of it.meshes) m.geometry.dispose();
      if (it.statueMesh) it.statueMesh.material.dispose();
      this.items = this.items.filter(x => x !== it);
      if (this.selected === it) this.select(null);
    }
    for (const e of list) {
      let it = this.items.find(x => x.id === e.id);
      if (it && (it.type !== e.type || it.variant !== e.variant)) { this.remove(it); it = null; }
      if (!it) {
        it = this.add(e.type, { select: false, variant: e.variant, name: e.name, restoring: true });
        if (!it) continue;
        it.id = e.id;
        this._seq = Math.max(this._seq, e.id);
        it.params = {};
      }
      const same = JSON.stringify(it.params) === JSON.stringify(e.params);
      it.params = JSON.parse(JSON.stringify(e.params));
      it.auto = e.auto; it.holdAt = e.holdAt;
      it.group.position.fromArray(e.pos);
      it.group.quaternion.fromArray(e.quat);
      if (!same) this._build(it);
      it.grips = e.grips.map(g => ({ key: g.key, doll: g.doll || 'A', rel: new THREE.Matrix4().fromArray(g.rel) }));
      it.group.visible = !this.hidden || it.auto;
      it.group.updateWorldMatrix(true, true);
    }
    const sel = st && st.sel != null ? this.items.find(x => x.id === st.sel) : null;
    if (this.selected !== (sel || null)) this.select(sel || null);
    this.onChange();
  }

  /** 自分で置いた小物を隠す（クロッキーの間）。ポーズに付いた小物（auto）はそのまま */
  setHidden(on) {
    this.hidden = !!on;
    this._pre = on ? new Set(this.items) : null;
    // 隠すときは、ポーズに付いた小物も含めて、いまある小物を全部隠す（クロッキーで出す小物は、そのあと出す）
    for (const it of this.items) it.group.visible = !on;
    if (on) this.select(null);
  }

  // ---- ポーズに付いた小物 ---------------------------------------------------
  //   def = { type, h, size, carry, grips: ['handR', …], holdAt,
  //           seat: true（お尻の下）| under: ['footL'] / ['handL','handR']（その手足の下に上の面）, shift: [dx, dz]
  //           | back: true（背中の後ろの壁）| side: 'handR'（手のひらが当たる壁）| near: 'footR', off: [x, y, z]（その近くに置く） }
  //   置き場所は、ポーズを当てたあとの体から決める（体型・頭身が変わっても合うように）。mirror: 左右を入れ替えたポーズ
  _contactOf(key) {
    const v = this.v, slot = v.primarySlot;
    if (/^elbow/.test(key)) {
      // 肘の下の面（台に肘をつく）
      const p = slot.boneMap['forearm' + key.slice(-1)].getWorldPosition(V()); p.y -= 0.035;
      return { p, n: V(0, -1, 0), along: V(0, 0, 1) };
    }
    if (/^hand/.test(key)) {
      const sd = key.slice(-1), f = v._handFrame(slot, sd);
      const fg = slot.fingers && slot.fingers[sd], mid = fg && fg.middle && fg.middle[1];
      const L = mid ? mid.getWorldPosition(V()).distanceTo(f.origin) : 0.09;
      return { p: f.origin.clone().addScaledVector(f.along, L * 0.9).addScaledVector(f.palmar, 0.028), n: f.palmar.clone(), along: f.along.clone() };
    }
    const fb = slot.boneMap[key], A = fb.getWorldPosition(V());
    const tb = fb.children.find(c => c.isBone);
    const fwd = (tb ? tb.getWorldPosition(V()) : A.clone().add(V(0, 0, 0.1))).sub(A); fwd.y = 0; fwd.normalize();
    const p = A.clone().addScaledVector(fwd, 0.06); p.y -= 0.08;
    return { p, n: V(0, -1, 0), along: fwd };
  }

  /**
   * 人形の左右反転に合わせて、小物も左右反転（体の真ん中の面 x = 0 で鏡に映す）。つないだ手足も左右を入れ替える。
   * 人形を反転したあとに呼ぶ
   */
  mirrorAll() {
    const sw = k => k.replace(/[LR]$/, m => (m === 'L' ? 'R' : 'L'));
    for (const it of this.items) {
      const g = it.group;
      g.position.x *= -1;
      const q = g.quaternion; q.set(q.x, -q.y, -q.z, q.w);
      g.updateWorldMatrix(true, true);
      for (const gr of this.liveGrips(it)) gr.key = sw(gr.key);
      for (const gr of this.liveGrips(it)) gr.rel = this._propRT(it).invert().multiply(this._limbRT(gr.key));
    }
    this.onChange();
  }

  /** ポーズに付いた小物を片付ける。keepPre: クロッキーの前からあった物は残す（小物だけ・石膏像の出題を片付けるとき） */
  clearAuto(keepPre = false) { for (const it of this.items.filter(x => x.auto && !(keepPre && this._pre && this._pre.has(x)))) this.remove(it); }

  /**
   * 静物として置く（クロッキーの「小物だけ」）。params: 大きさ（sx・sy・sz・size・h）、q: 向き、x・z: 床の上の場所、
   * baseY: 載せる面の高さ（いちばん下の所をそこへ）。ポーズに付いた小物と同じく auto（クロッキーの間も見える）
   */
  addStill(type, params, q, x, z, baseY = 0, opts = {}) {
    const it = this.add(type, { select: false, variant: opts.variant, name: opts.name });
    if (!it) return null;
    it.auto = opts.auto !== false;
    Object.assign(it.params, params || {});
    it.group.quaternion.set(...q);
    it.group.position.set(x, 0, z);
    this._build(it);
    it.group.updateWorldMatrix(true, true);
    let minY = Infinity;
    // 幾何形体は形そのものの頂点で（石膏像は読み込む前なので、床から baseY の高さに置く）
    const src = it.statueMesh ? [it.statueMesh] : it.type === 'statue' ? [] : it.meshes;
    for (const m of src) {
      m.updateWorldMatrix(true, false);
      const pos = m.geometry.attributes.position, w = V();
      for (let i = 0; i < pos.count; i++) { w.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); if (w.y < minY) minY = w.y; }
    }
    it.group.position.y = baseY - (isFinite(minY) ? minY : 0);
    it.group.updateWorldMatrix(true, true);
    it.group.visible = true;
    return it;
  }

  /** 見た目: null（いつもの）| 'clay'（粘土）| 'plaster'（石膏）。クロッキーの間だけ */
  setLook(look) {
    this.look = look;
    if (!this._looks) this._looks = {
      clay: new THREE.MeshStandardMaterial({ color: 0xd6cec2, roughness: 0.72, metalness: 0 }),
      plaster: new THREE.MeshStandardMaterial({ color: 0xf1eee8, roughness: 0.92, metalness: 0 }),
    };
    for (const it of this.items) for (const m of it.meshes) m.material = this._matOf(it);
  }
  _matOf(it) { return this.look ? this._looks[this.look] : this.selected === it ? this.matSel : this.mat; }

  applyPoseProps(defs, mirror = false) {
    this.clearAuto();
    if (!defs || !defs.length) return;
    const v = this.v, slot = v.primarySlot;
    if (!slot || !slot.skeleton) return;
    // 床合わせのあと、肌の点（スキン）の行列まで新しくする
    v.applyAll(); v.scene.updateMatrixWorld(true);
    const sw = k => (mirror ? k.replace(/[LR]$/, m => (m === 'L' ? 'R' : 'L')) : k);
    const mx = mirror ? -1 : 1;
    const hp = slot.boneMap.hips.getWorldPosition(V());
    for (const d of defs) {
      const it = this.add(d.type, { select: false });
      if (!it) continue;
      it.auto = true;
      if (d.carry) it.grounded = false;
      if (d.holdAt) it.holdAt = d.holdAt;
      if (d.size) it.params.size = d.size;
      if (d.h) it.params.h = d.h;
      const g = it.group;
      g.quaternion.setFromAxisAngle(V(0, 1, 0), (d.yaw || 0) * mx * Math.PI / 180);
      if (d.seat) {
        const st = this._seatUnderBody(true);
        if (st) {
          if (d.type === 'box') it.params.size = Math.max(0.4, st.h / 0.4); else it.params.h = Math.max(0.2, st.h);
          g.position.set(st.x + (d.shift ? d.shift[0] * mx : 0), 0, st.z + (d.shift ? d.shift[1] : 0));
        }
      } else if (d.under) {
        const cs = d.under.map(k => this._contactOf(sw(k)).p);
        const c = cs.reduce((a, b) => a.add(b), V()).multiplyScalar(1 / cs.length);
        const top = Math.max(0.1, c.y);
        if (d.type === 'box') it.params.size = Math.max(0.4, top / 0.4); else it.params.h = top;
        g.position.set(c.x + (d.shift ? d.shift[0] * mx : 0), 0, c.z + (d.shift ? d.shift[1] : 0));
      } else if (d.back) {
        // 背中のいちばん後ろに、壁の前の面を合わせる
        const cf = v.contactFix, c = cf._prep(slot); v.scene.updateMatrixWorld(true); cf._read(c);
        let minZ = Infinity;
        for (let i = 0; i < c.total; i++) if (c.G[i] === 0 && c.P[i * 3 + 1] > hp.y - 0.15) minZ = Math.min(minZ, c.P[i * 3 + 2]);
        g.position.set(hp.x + (d.shift ? d.shift[0] * mx : 0), 0, (isFinite(minZ) ? minZ : hp.z - 0.15) - 0.03 + (d.gap || 0));
      } else if (d.side) {
        // 手のひらが当たる壁: 壁の前の面（+z）を手のひらへ向ける
        const ct = this._contactOf(sw(d.side));
        const nrm = ct.n.clone().negate(); nrm.y = 0; nrm.normalize();     // 壁の前の面の向き（人形の方）
        g.quaternion.setFromUnitVectors(V(0, 0, 1), nrm);
        g.position.copy(ct.p).addScaledVector(nrm, -0.03); g.position.y = 0;
        if (d.shift) g.position.add(V(d.shift[0], 0, d.shift[1]).applyQuaternion(g.quaternion));
      } else if (d.backTop) {
        // 椅子の背もたれの上に手を置く: 背もたれの上の端を手のひらの下へ（座面の高さも合わせる）
        const ct = this._contactOf(sw(d.backTop));
        it.params.h = Math.max(0.25, ct.p.y - 0.44);
        g.position.copy(ct.p).sub(V(0, 0, -0.195).applyQuaternion(g.quaternion)); g.position.y = 0;
      } else if (d.near) {
        const ct = this._contactOf(sw(d.near));
        const o = d.off || [0, 0, 0];
        g.position.copy(ct.p).add(V(o[0] * mx, o[1], o[2]));
        if (it.grounded) g.position.y = 0;
      } else if (d.between) {
        // 両手のあいだ（箱を抱える・運ぶ）。手のひらの間の幅に大きさを合わせる
        const a = this._contactOf(sw(d.between[0])).p, b = this._contactOf(sw(d.between[1])).p;
        const ctr = a.clone().add(b).multiplyScalar(0.5);
        const w = Math.max(0.16, a.distanceTo(b) - 0.01);
        if (d.type === 'box') it.params.size = w / 0.4;
        const dir = b.clone().sub(a); dir.y = 0;
        const yaw = Math.atan2(-dir.z, dir.x);
        g.quaternion.setFromAxisAngle(V(0, 1, 0), yaw);
        // 箱は手のひらが側面の下寄りに来る高さ（底が手のひらの少し下）
        g.position.copy(ctr); g.position.y -= (d.type === 'box' ? 0.06 : 0);
      }
      this._build(it);
      g.updateWorldMatrix(true, true);
      it.group.visible = true;
      const keys = (d.grips || []).map(sw).sort((a, b) => (/^foot/.test(b) ? 1 : 0) - (/^foot/.test(a) ? 1 : 0));
      keys.forEach((k, i) => {
        this.grip(k, it, true);
        // aim: 棒の向き（人形の向きから見た方向）。最初の手で握ったあと、握りこぶしを中心に棒をその向きへ回し、手元を棒の端の近くにする
        if (i === 0 && d.aim && it.type === 'stick') {
          const sd = k.slice(-1), f = v._handFrame(slot, sd);
          const fg = slot.fingers && slot.fingers[sd], mid = fg && fg.middle && fg.middle[1];
          const L = mid ? mid.getWorldPosition(V()).distanceTo(f.origin) : 0.09;
          const Q = f.origin.clone().addScaledVector(f.along, L * GRIP_A).addScaledVector(f.palmar, GRIP_P);
          const yawQ = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.atan2(...(() => { const z = V(0, 0, 1).applyQuaternion(slot.boneMap.hips.getWorldQuaternion(new THREE.Quaternion())); return [z.x, z.z]; })()));
          const dir = V(d.aim[0] * mx, d.aim[1], d.aim[2]).normalize().applyQuaternion(yawQ);
          const half = 0.6 * it.params.size;
          g.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
          g.position.copy(Q).addScaledVector(dir, half - (d.grip0 != null ? d.grip0 : 0.06));
          g.updateWorldMatrix(true, true);
          it.grips[it.grips.length - 1].rel = this._propRT(it).invert().multiply(this._limbRT(k));
        }
      });
      // center: 棒を体の真ん中へすべらせる（両手は握ったまま、棒が手の中を通る）
      if (d.center && it.type === 'stick') {
        const ax = V(0, 1, 0).applyQuaternion(g.quaternion);
        const t = hp.clone().sub(g.position).dot(ax);
        g.position.addScaledVector(ax, t);
        g.updateWorldMatrix(true, true);
        for (const gr of it.grips) gr.rel = this._propRT(it).invert().multiply(this._limbRT(gr.key));
      }
    }
    this.onChange();
  }

  _build(it) {
    for (const m of it.meshes) { it.group.remove(m); m.geometry.dispose(); }
    it.meshes = [];
    it.shapes = shapesOf(it.type, it.params);
    const p = it.params;
    it.group.scale.set(p.sx || 1, p.sy || 1, p.sz || 1);
    for (const sh of it.shapes) {
      const m = new THREE.Mesh(geometryOf(sh), this._matOf(it));
      m.position.set(...sh.c);
      m.castShadow = true; m.receiveShadow = true;
      m.userData.propItem = it;
      it.group.add(m); it.meshes.push(m);
    }
    it.radius = this._radius(it);
    if (MESH_TYPES.has(it.type)) {
      // 箱は見せずに当たりだけに使い、像を出す（読み込む前は箱をうっすら出す）
      for (const m of it.meshes) m.visible = !it.statueMesh;
      if (it.statueMesh && it.statueMesh.parent !== it.group) it.group.add(it.statueMesh);
    }
  }

  /** 石膏像の形を読み込んで、像を出す（loader は app.js が渡す: key → 型の Mesh） */
  _loadStatue(it) {
    if (!this.statueLoader) return;
    const res = this.statueLoader(it.type === 'solid' ? 'solid:' + it.variant : it.variant);
    // 幾何形体はすぐ作れるので、その場で出す（石膏像は読み込んでから）
    const apply = tpl => {
      if (!tpl || !this.items.includes(it)) return;
      const g = tpl.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      const S = (this.statueScale && this.statueScale[it.variant]) || 1;
      const b = g.boundingBox;
      const mat = tpl.material.clone();
      const m = new THREE.Mesh(g, mat);
      m.scale.setScalar(S);
      m.position.set(-(b.min.x + b.max.x) / 2 * S, -b.min.y * S, -(b.min.z + b.max.z) / 2 * S);
      m.castShadow = true; m.receiveShadow = true;
      m.userData.propItem = it;
      m.userData.shared = true;   // 形は croquisScenes と共有（消さない）
      it.statueMesh = m;
      const had = !!it.params.bb;
      it.params.bb = [(b.max.x - b.min.x) * S, (b.max.y - b.min.y) * S, (b.max.z - b.min.z) * S].map(x => +x.toFixed(3));
      this._build(it);
      this._tint(it);
      // 手足をつないでいたら、新しい大きさに付け直す（戻すで作り直したときは、大きさが同じなのでそのまま）
      if (!had) for (const gr of this.liveGrips(it)) this.grip(gr.key, it, true);
      this.onChange();
    };
    if (res && typeof res.then === 'function') res.then(apply); else apply(res);
  }

  /** 石膏像は石膏の色のまま、選んでいるときだけ少し青く光らせる */
  _tint(it) {
    if (!it || !it.statueMesh) return;
    it.statueMesh.material.emissive.setHex(this.selected === it && !this.look ? 0x0b2a40 : 0x000000);
  }

  _radius(it) {
    const b = new THREE.Box3();
    for (const sh of it.shapes) {
      const c = V(...sh.c);
      const e = sh.k === 'box' ? V(...sh.s).multiplyScalar(0.5) : sh.k === 'sph' ? V(sh.r, sh.r, sh.r) : swapAx(sh.ax, V(sh.r, sh.h / 2, sh.r));
      b.expandByPoint(c.clone().sub(e)); b.expandByPoint(c.clone().add(e));
    }
    it.center = b.getCenter(V());
    it.dims = b.getSize(V()).multiply(it.group.scale);   // 本当の大きさ（m）
    return it.dims.length() / 2;
  }

  /**
   * 大きさを変える。dir = +1 / -1。axis: 'all'（全体）| 'y'（縦）| 'x'（横）| 'z'（奥行き）
   *   縦: 座面・天板の高さがある物（椅子・台など）はその高さを 2cm ずつ、ほかは縦だけ 1 割ずつ
   */
  resize(dir, it = this.selected, axis = 'all') {
    if (!it) return;
    const p = it.params;
    const clampF = x => Math.max(0.25, Math.min(4, Math.round(x * 100) / 100));
    const k = dir > 0 ? 1.1 : 1 / 1.1;
    if (axis === 'y' && H_TYPES[it.type]) {
      const sy = p.sy || 1, top = it.type === 'bar' ? 2.4 : 1.1;
      const hh = Math.max(0.2, Math.min(top, Math.round((p.h * sy + dir * 0.02) * 100) / 100));
      p.h = hh / sy;
    } else if (axis === 'all') { p.sx = clampF(p.sx * k); p.sy = clampF(p.sy * k); p.sz = clampF(p.sz * k); }
    else { const key = 's' + axis; p[key] = clampF((p[key] || 1) * k); }
    this._build(it);
    if (!it.grounded) { it.group.updateWorldMatrix(true, true); if (!it.grips.length) this._keepAboveFloor(it); }
    // 手でつないでいたら、新しい形に付け直す
    for (const g of this.liveGrips(it)) this.grip(g.key, it, true);
    this.onChange();
  }

  /** 大きさの表示（cm）。axis は resize と同じ */
  sizeLabel(it = this.selected, axis = 'all') {
    if (!it || !it.dims) return '';
    const cm = x => Math.round(x * 100);
    const d = it.dims;
    if (axis === 'x') return `幅 ${cm(d.x)}cm`;
    if (axis === 'z') return `奥行き ${cm(d.z)}cm`;
    if (axis === 'y') {
      if (H_TYPES[it.type]) {
        const hh = cm(it.params.h * (it.params.sy || 1));
        return (SEAT_TYPES.has(it.type) ? '座面 ' : it.type === 'bar' ? '棒の高さ ' : '高さ ') + hh + 'cm';
      }
      return (/^(stick|sword|umbrella|dumbbell|katana|spear|bat|cane|pen|bow)$/.test(it.type) ? '長さ ' : '高さ ') + cm(d.y) + 'cm';
    }
    return `${cm(d.x)}×${cm(d.z)}×${cm(d.y)}cm`;
  }

  // ---- 選ぶ ---------------------------------------------------------------
  select(it) {
    if (this.selected === it) { this._syncRings(); return; }
    const prev = this.selected;
    this.selected = it;
    for (const x of [prev, it]) if (x) { for (const m of x.meshes) m.material = this._matOf(x); this._tint(x); }
    if (it && this.v.selected) { this._selecting = true; try { this.v.select(null); } finally { this._selecting = false; } }
    this._syncRings();
    this.onSelect(it);
  }

  _syncRings() {
    const it = this.selected;
    this.ringGroup.visible = !!it && !this.hidden;
    if (!it) return;
    this.rings.x.visible = !it.grounded;
    this.rings.z.visible = !it.grounded;
  }

  /** 輪の位置と向き（毎フレーム） */
  _placeRings() {
    const it = this.selected;
    if (!it || !this.ringGroup.visible) return;
    it.group.updateWorldMatrix(true, false);
    const c = it.center.clone().applyMatrix4(it.group.matrixWorld);
    const R = Math.max(0.12, Math.min(0.32, it.radius * 1.05));
    const q = it.group.quaternion;
    this.ringGroup.position.copy(c);
    // y の輪: 縦の軸のまわり（水平の輪）。x・z の輪は小物の軸のまわり
    const base = { x: new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2), y: new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2), z: new THREE.Quaternion() };
    for (const ax of ['x', 'y', 'z']) {
      const m = this.rings[ax];
      m.scale.setScalar(R * (ax === 'x' ? 1 : ax === 'y' ? 0.9 : 1.1));
      m.quaternion.copy(it.grounded && ax === 'y' ? base.y : q.clone().multiply(base[ax]));
    }
  }

  _axisOf(it, ax) {
    if (ax === 'y' && it.grounded) return V(0, 1, 0);
    return V(ax === 'x' ? 1 : 0, ax === 'y' ? 1 : 0, ax === 'z' ? 1 : 0).applyQuaternion(it.group.quaternion);
  }

  // ---- 押す・動かす --------------------------------------------------------
  _ndc(x, y) {
    const r = this.v.canvas.getBoundingClientRect();
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  }
  _toScreen(p) {
    const r = this.v.canvas.getBoundingClientRect();
    const q = p.clone().project(this.v.camera);
    return new THREE.Vector2(r.left + (q.x + 1) / 2 * r.width, r.top + (1 - q.y) / 2 * r.height);
  }

  /** 輪を押したか（{ax, d}） */
  hitRing(x, y, pointerType) {
    const it = this.selected;
    if (!it || !this.ringGroup.visible) return null;
    this._placeRings();
    this.ringGroup.updateWorldMatrix(true, true);
    const tol = pointerType === 'mouse' ? 10 : 18;
    let best = null;
    for (const ax of ['x', 'y', 'z']) {
      const m = this.rings[ax];
      if (!m.visible) continue;
      for (let i = 0; i < 96; i++) {
        const a = i / 96 * Math.PI * 2;
        const p = V(Math.cos(a), Math.sin(a), 0).applyMatrix4(m.matrixWorld);
        const d = this._toScreen(p).distanceTo(new THREE.Vector2(x, y));
        if (d < tol && (!best || d < best.d)) best = { ax, d };
      }
    }
    return best;
  }

  /** 画面の点にある小物と、その距離（カメラから） */
  pick(x, y) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(this._ndc(x, y), this.v.camera);
    // 石膏像は像の形そのもので選ぶ（囲む箱ではなく）
    const ms = this.items.filter(it => it.group.visible).flatMap(it => it.statueMesh ? [it.statueMesh] : it.meshes);
    if (!ms.length) return null;
    const h = ray.intersectObjects(ms, false)[0];
    return h ? { it: h.object.userData.propItem, dist: h.distance, point: h.point } : null;
  }

  /**
   * 押したとき（viewer から）。小物か輪を押したら true（関節・カメラは動かさない）。
   * dollDist: 人形の面までの距離（人形の方が手前なら小物は押さない）
   */
  pointerDown(e, dollDist) {
    if (this.hidden) return false;
    let rh = this.hitRing(e.clientX, e.clientY, e.pointerType);
    // 小物の上を押したときは、輪の線の真上（6px 以内）でなければ動かす方を優先
    if (rh && rh.d > 6) { const pk0 = this.pick(e.clientX, e.clientY); if (pk0 && pk0.it === this.selected) rh = null; }
    if (rh) {
      const it = this.selected;
      const c = this._toScreen(it.center.clone().applyMatrix4(it.group.matrixWorld));
      this.drag = { mode: 'rot', it, ax: rh.ax, c, a0: Math.atan2(e.clientY - c.y, e.clientX - c.x), q0: it.group.quaternion.clone(), p0: it.group.position.clone(),
        ctr: it.center.clone().applyMatrix4(it.group.matrixWorld), moved: false };
      return true;
    }
    const pk = this.pick(e.clientX, e.clientY);
    if (!pk || (dollDist != null && dollDist < pk.dist - 0.005)) return false;
    const it = pk.it;
    // 手・足と同じく、画面の面の中で上下左右に動かす（奥行きはカメラを回して動かす）
    const n = V(); this.v.camera.getWorldDirection(n);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, pk.point);
    this.drag = { mode: 'move', it, plane, P0: pk.point.clone(), p0: it.group.position.clone(), moved: false, wasSel: this.selected === it };
    return true;
  }

  pointerMove(e) {
    const d = this.drag;
    if (!d) return;
    // 動かし始め: 「戻す」に積む（app.js）
    if (!d.moved && this.onEditStart) this.onEditStart();
    d.moved = true;
    const it = d.it;
    if (d.mode === 'move') {
      const ray = new THREE.Raycaster(); ray.setFromCamera(this._ndc(e.clientX, e.clientY), this.v.camera);
      const P = ray.ray.intersectPlane(d.plane, V());
      if (!P) return;
      it.group.position.copy(d.p0).add(P.sub(d.P0));
      this._keepAboveFloor(it);
    } else {
      const a = Math.atan2(e.clientY - d.c.y, e.clientX - d.c.x);
      let da = a - d.a0;
      const axis = this._axisOf({ ...it, group: { quaternion: d.q0 } }, d.ax);
      // 輪の軸が手前を向いているときと奥を向いているときで、回る向きを合わせる
      const toCam = this.v.camera.position.clone().sub(d.ctr).normalize();
      if (axis.dot(toCam) > 0) da = -da;
      const r = new THREE.Quaternion().setFromAxisAngle(axis, da);
      it.group.quaternion.copy(r.clone().multiply(d.q0));
      // 中心のまわりに回す
      const off = d.p0.clone().sub(d.ctr).applyQuaternion(r);
      it.group.position.copy(d.ctr).add(off);
    }
    it.group.updateWorldMatrix(true, true);
    // 「持つ所を変える」のときは、手足はそのまま（小物だけ動かし、離したときに付け直す）
    if (!this.slideMode) this._driveHands(it);
  }

  /** 床より下へは入れない。床に置く物は、床の近く（3cm）まで下ろしたら床にぴったり置く。手に持つ物は、いちばん下の所を床の上に */
  _keepAboveFloor(it) {
    const p = it.group.position;
    if (it.grounded) { if (p.y < 0.03) p.y = 0; return; }
    it.group.updateWorldMatrix(true, true);
    let minY = Infinity;
    for (const m of it.meshes) {
      const g = m.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      // 形の頂点の数は少ないので、頂点で見る（回した箱でも余らない）
      const pos = g.attributes.position, w = V();
      for (let i = 0; i < pos.count; i++) { w.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); if (w.y < minY) minY = w.y; }
    }
    if (isFinite(minY) && minY < 0) { p.y -= minY; it.group.updateWorldMatrix(true, true); }
  }

  pointerUp(e) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (!d.moved && d.mode === 'move') this.select(d.it);
    if (d.moved && this.slideMode) this._regrip(d.it);
    if (d.moved) this.onChange();
  }

  /**
   * 「持つ所を変える」で小物を動かし終えた: いまの手足の所で付け直す。
   * 手に持つ物は、手はそのままで小物の中の持つ所が変わる。床に置く物は、手足をいちばん近い面へ寄せ直す
   */
  _regrip(it) {
    it.group.updateWorldMatrix(true, true);
    for (const g of this.liveGrips(it)) {
      if (it.grounded || /^foot/.test(g.key) || it.grips.some(x => !this.isLive(x))) {
        this._surface = true;
        try { this.grip(g.key, it, true, 0.3); } finally { this._surface = false; }
      }
      else g.rel = this._propRT(it).invert().multiply(this._limbRT(g.key));
    }
  }

  // ---- 手で持つ・手足を置く ------------------------------------------------
  //   つなぐ所 g = { key: 'handR' | 'handL' | 'footR' | 'footL', rel: 小物から見た手（足）の位置と向き }
  //   どこにつなぐかは決めておかず、押したときの手・足にいちばん近い所（ポーズによって変わる）
  _limbRT(key) {
    const b = this.v.primarySlot.boneMap[key];
    return new THREE.Matrix4().compose(b.getWorldPosition(V()), b.getWorldQuaternion(new THREE.Quaternion()), V(1, 1, 1));
  }
  _propRT(it) { return new THREE.Matrix4().compose(it.group.position, it.group.quaternion, V(1, 1, 1)); }

  // ---- 2 体のとき: つなぎは人形ごと（A: 1 体目 / B: 2 体目）。動かしている人形のつなぎだけが生きる ----
  //   もう一方の人形は止まった写しなので、その人形のつなぎはそのまま止めておく（入れ替えると、また生きる）
  liveDoll() { const sd = this.v.second; return sd && !sd.firstActive ? 'B' : 'A'; }
  isLive(g) { return (g.doll || 'A') === this.liveDoll(); }
  liveGrips(it) { return it ? it.grips.filter(g => this.isLive(g)) : []; }
  /** 人形が 1 体に戻った: 残った人形（keep）のつなぎだけ残し、それを 1 体目（A）とする */
  dollGone(keep) {
    for (const it of this.items) {
      it.grips = it.grips.filter(g => (g.doll || 'A') === keep);
      for (const g of it.grips) g.doll = 'A';
    }
    this.onChange();
  }
  static keyOf(k) { return k.length === 1 ? 'hand' + k : k; }

  gripOf(key) { key = Props.keyOf(key); for (const it of this.items) { const g = it.grips.find(x => x.key === key && this.isLive(x)); if (g) return { it, g }; } return null; }

  /**
   * 手・足を小物のいちばん近い所へ寄せて、つなぐ。keepShape: 手の形を変えない。
   * 届かなければ 'far'（何も変えない）
   */
  grip(key, it = this.selected, keepShape = false, tol = 0.04) {
    key = Props.keyOf(key);
    const v = this.v, slot = v.primarySlot;
    if (!it || !slot || !slot.boneMap[key]) return false;
    const cur = this.gripOf(key);
    if (cur) cur.it.grips = cur.it.grips.filter(g => g !== cur.g);
    if (/^foot/.test(key)) return this._placeFoot(key, it);
    const side = key.slice(-1);
    const f = v._handFrame(slot, side);
    if (!f) return false;
    const fg = slot.fingers && slot.fingers[side];
    const mid = fg && fg.middle && fg.middle[1];
    const L = mid ? mid.getWorldPosition(V()).distanceTo(f.origin) : 0.09;
    const sgn = side === 'L' ? 1 : -1;
    const PC = f.origin.clone().addScaledVector(f.along, L * 0.9).addScaledVector(f.palmar, 0.02);
    // 手に持つ物をまだだれも持っていなければ、小物の方を手の中へ動かす（手は今の形のまま）
    if (!it.grounded && !it.grips.length && !this._surface) {
      const H = HANDLES[it.type] || HANDLES.stick;
      const sc = it.group.scale;
      if (H.k === 'rod') {
        // 握る軸を親指の側へ（down: 指の向きへ / face: 手のひらの向きへ）。握る所を握りこぶしの中へ
        const Q = f.origin.clone().addScaledVector(f.along, L * GRIP_A).addScaledVector(f.palmar, GRIP_P + (H.off || 0) * Math.max(sc.x, sc.z));
        const a = V(...AXV[H.ax]);
        const q = H.down ? basisRot(a, V(...H.down), f.radial, H.hang ? V(0, -1, 0) : f.along)
          : H.face ? basisRot(a, V(...H.face), f.radial, f.palmar)
          : new THREE.Quaternion().setFromUnitVectors(a, f.radial.clone());
        it.group.quaternion.copy(q);
        // 持つ所: 指定がなければ決めた握る所（it.holdAt: そこからの距離、+ は親指の側）
        const gl = V(...H.c).addScaledVector(a, it.holdAt || 0).multiply(sc).applyQuaternion(q);
        it.group.position.copy(Q).sub(gl);
      } else if (H.k === 'palm') {
        // 手のひらに載せる: 当てる所を手のひらの真ん中へ、外向きを手のひらと向かい合わせに
        const q = basisRot(V(...H.n), V(...H.along), f.palmar.clone().negate(), f.along);
        it.group.quaternion.copy(q);
        const P = f.origin.clone().addScaledVector(f.along, L * 0.75).addScaledVector(f.palmar, 0.014);
        it.group.position.copy(P).sub(V(...H.c).multiply(sc).applyQuaternion(q));
      } else {
        const r = 0.11 * it.params.size * Math.max(sc.x, sc.y, sc.z);
        // ボールの中心: 手のひらの真ん中（指の付け根寄り）から、手のひらの向きへ半径＋手の厚みの半分
        it.group.position.copy(f.origin).addScaledVector(f.along, L * 0.85).addScaledVector(f.palmar, r + 0.015);
      }
      it.group.updateWorldMatrix(true, true);
      if (!keepShape && this.onHandShape) this.onHandShape(side, H.shape);
      it.grips.push({ key, doll: this.liveDoll(), rel: this._propRT(it).invert().multiply(this._limbRT(key)) });
      this.onChange();
      return true;
    }
    it.group.updateWorldMatrix(true, true);
    const inv = it.group.matrixWorld.clone().invert();
    const q = PC.clone().applyMatrix4(inv);
    let best = null;
    if (it.statueMesh) {
      // 石膏像・幾何形体: 形そのものの表面
      const r = closestOnMesh(it.statueMesh, q);
      if (r) best = { ...r, d: r.p.distanceTo(q), sh: { k: 'mesh' } };
    } else for (const sh of it.shapes) {
      const r = closestOn(sh, q);
      const d = r.p.distanceTo(q);
      if (!best || d < best.d) best = { ...r, d, sh };
    }
    if (!best) return false;
    const toW = p => p.clone().applyMatrix4(it.group.matrixWorld);
    // 外向き: 縦・横・奥行きを別々に伸ばしたときも面に直交するように
    const nW = best.n.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(it.group.matrixWorld)).normalize();
    let along, radial, palmar, wrist, shape;
    if (best.sh.k === 'rod') {
      // 棒: 親指の側（radial）を棒の向きに。棒は握ったこぶしの中を通す
      const al = V(...AXV[best.sh.ax || 'y']);
      const a = al.clone().applyQuaternion(it.group.quaternion);
      const hl = best.sh.h / 2 * Math.abs(al.dot(it.group.scale));
      const ctr = V(...best.sh.c).applyMatrix4(it.group.matrixWorld);
      const t = Math.max(-hl + 0.05, Math.min(hl - 0.05, PC.clone().sub(ctr).dot(a)));
      const Q = ctr.clone().addScaledVector(a, t);
      radial = f.radial.dot(a) >= 0 ? a.clone() : a.clone().negate();
      along = f.along.clone().addScaledVector(radial, -f.along.dot(radial));
      if (along.lengthSq() < 1e-6) along = V(0, 1, 0).cross(radial);
      along.normalize();
      palmar = new THREE.Vector3().crossVectors(along, radial).multiplyScalar(sgn);
      wrist = Q.clone().addScaledVector(along, -L * GRIP_A).addScaledVector(palmar, -GRIP_P);
      shape = 'grip';
    } else {
      // 面・球: 手のひらを面に当てる（手のひらの向き = 面の内向き）。指の向きは今の向きを面に沿わせたもの
      palmar = nW.clone().negate();
      along = f.along.clone().addScaledVector(palmar, -f.along.dot(palmar));
      if (along.lengthSq() < 1e-6) along = Math.abs(palmar.y) < 0.9 ? V(0, 1, 0).addScaledVector(palmar, -palmar.y) : V(0, 0, 1);
      along.normalize();
      radial = new THREE.Vector3().crossVectors(palmar, along).multiplyScalar(sgn);
      const S = toW(best.p);
      wrist = S.clone().addScaledVector(nW, best.sh.k === 'sph' ? 0.03 : 0.028).addScaledVector(along, -L * 0.9);
      shape = best.sh.k === 'sph' ? 'hold' : 'press';
    }
    const M0 = new THREE.Matrix4().makeBasis(f.along, f.radial, f.palmar);
    const M1 = new THREE.Matrix4().makeBasis(along, radial, palmar);
    const R = new THREE.Quaternion().setFromRotationMatrix(M1.multiply(M0.clone().transpose()));
    const newQ = R.multiply(slot.boneMap[key].getWorldQuaternion(new THREE.Quaternion()));
    const saved = JSON.parse(JSON.stringify(v.angles));
    const savedShape = { ...v.handShape };
    if (!keepShape && this.onHandShape) this.onHandShape(side, shape);
    for (let i = 0; i < 3; i++) { v.pull.solve(key, wrist, newQ); v.applyAll(); }
    if (slot.boneMap[key].getWorldPosition(V()).distanceTo(wrist) > tol) {
      for (const k in saved) v.angles[k] = saved[k];
      v.applyAll();
      if (savedShape[side] !== undefined && savedShape[side] !== v.handShape[side]) v.applyHandShape(side, savedShape[side] || '');
      return 'far';
    }
    it.grips.push({ key, doll: this.liveDoll(), rel: this._propRT(it).invert().multiply(this._limbRT(key)) });
    this.onChange();
    return true;
  }

  /** 足の裏を、小物の上の面（いちばん近い所）に平らに置く */
  _placeFoot(key, it) {
    const v = this.v, slot = v.primarySlot, fb = slot.boneMap[key];
    const A = fb.getWorldPosition(V());
    const tb = fb.children.find(c => c.isBone);
    const toe = tb ? tb.getWorldPosition(V()) : A.clone().add(V(0, 0, 0.1));
    // いまの足先の向き（水平）
    const fwd = toe.clone().sub(A); fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
    fwd.normalize();
    const ANK = 0.08, MID = 0.06;   // 足首の高さ・足首から足の裏の真ん中まで
    const sole = A.clone().addScaledVector(fwd, MID); sole.y -= ANK;
    it.group.updateWorldMatrix(true, true);
    const inv = it.group.matrixWorld.clone().invert();
    const up = V(0, 1, 0);
    let best = null;
    if (it.statueMesh) {
      // 石膏像・幾何形体: 足の裏の真ん中の真上から下へ見て、最初に当たる所（上を向いた面だけ）
      const rc = new THREE.Raycaster(V(sole.x, sole.y + 3, sole.z), V(0, -1, 0), 0, 6);
      const hits = rc.intersectObject(it.statueMesh, false);
      const h = hits.find(x => x.face && x.face.normal.clone().transformDirection(it.statueMesh.matrixWorld).y > 0.5);
      if (h) best = { p: h.point.clone(), d: h.point.distanceTo(sole) };
      // 真下に面がなければ、像のいちばん近い所の上
      if (!best) {
        const ql = sole.clone().applyMatrix4(inv), r = closestOnMesh(it.statueMesh, ql);
        if (r && r.n.y > 0.3) { const p = r.p.applyMatrix4(it.group.matrixWorld); best = { p, d: p.distanceTo(sole) }; }
      }
    }
    for (const sh of (it.statueMesh ? [] : it.shapes)) {
      if (sh.k === 'rod' || sh.k === 'cone' || (sh.ax && sh.ax !== 'y')) continue;
      // 上の面の上で、足の裏の真ん中にいちばん近い点
      const c = V(...sh.c);
      let pW;
      if (sh.k === 'sph') pW = c.clone().add(V(0, sh.r, 0)).applyMatrix4(it.group.matrixWorld);
      else {
        const top = sh.k === 'box' ? sh.s[1] / 2 : sh.h / 2;
        const q = sole.clone().applyMatrix4(inv).sub(c);
        let x = q.x, z = q.z;
        if (sh.k === 'box') { x = Math.max(-sh.s[0] / 2 + 0.03, Math.min(sh.s[0] / 2 - 0.03, x)); z = Math.max(-sh.s[2] / 2 + 0.05, Math.min(sh.s[2] / 2 - 0.05, z)); }
        else { const r = Math.hypot(x, z), m = Math.max(0, sh.r - 0.04); if (r > m && r > 0) { x *= m / r; z *= m / r; } }
        pW = V(x, top, z).add(c).applyMatrix4(it.group.matrixWorld);
        // 上の面が上を向いていないもの（倒した物・壁の横の面など）は使わない
        if (V(0, 1, 0).transformDirection(it.group.matrixWorld).dot(up) < 0.7) continue;
      }
      const d = pW.distanceTo(sole);
      if (!best || d < best.d) best = { p: pW, d };
    }
    if (!best) return 'far';
    const target = best.p.clone().addScaledVector(fwd, -MID); target.y += ANK;
    // 足は平らに（基準姿勢の向きを、いまのつま先の向きへ水平に回したもの）
    const nb = slot.neutralWorld.get(fb).clone();
    const nTip = tb ? V(0, 0, 1) : V(0, 0, 1);
    const yaw = Math.atan2(fwd.x, fwd.z) - Math.atan2(nTip.x, nTip.z);
    const q = new THREE.Quaternion().setFromAxisAngle(up, yaw).multiply(nb);
    const saved = JSON.parse(JSON.stringify(v.angles));
    for (let i = 0; i < 3; i++) { v.pull.solve(key, target, q); v.applyAll(); }
    if (fb.getWorldPosition(V()).distanceTo(target) > 0.05) {
      for (const k in saved) v.angles[k] = saved[k];
      v.applyAll();
      return 'far';
    }
    it.grips.push({ key, doll: this.liveDoll(), rel: this._propRT(it).invert().multiply(this._limbRT(key)) });
    this.onChange();
    return true;
  }

  release(it = this.selected, key = null) {
    if (!it) return;
    key = key && Props.keyOf(key);
    it.grips = it.grips.filter(g => !this.isLive(g) || (key && g.key !== key));
    this.onChange();
  }

  /** 小物を動かした: つないだ手・足を小物について行かせる */
  _driveHands(it) {
    const live = this.liveGrips(it);
    if (!live.length) return;
    const v = this.v, PR = this._propRT(it);
    this._busy = true;
    try {
      // 足を先に（体の高さが決まってから手）
      for (const g of [...live].sort((a, b) => (/^foot/.test(b.key) ? 1 : 0) - (/^foot/.test(a.key) ? 1 : 0))) {
        const W = PR.clone().multiply(g.rel);
        const p = V(), q = new THREE.Quaternion(); W.decompose(p, q, V());
        v.pull.solve(g.key, p, q);
      }
      v.applyAll();
    } finally { this._busy = false; }
  }

  /** 人形の形が変わったあと（毎フレーム）: 棒・ボールは手について行き、もう一方の手・床に置く物の手足は小物へ戻す */
  update() {
    this._placeRings();
    if (this._busy || !this.items.length) return;
    const v = this.v, slot = v.primarySlot;
    if (!slot) return;
    const dragKey = v._jd && v._jd.key;
    for (const it of this.items) {
      const live = this.liveGrips(it);
      if (!live.length || (this.drag && this.drag.it === it)) continue;
      let lead = null;
      // 止まっている方の人形も持っているときは、小物はそちらの手に止めておき、動かしている人形の手を小物へ寄せる（2 体で同時に持つ）
      const heldByOther = it.grips.some(g => !this.isLive(g)) || (this.slideMode && live.some(g => g.key === dragKey));
      if (!it.grounded && !heldByOther) {
        const hands = live.filter(g => /^hand/.test(g.key));
        lead = hands.find(g => g.key === dragKey) || hands[0] || null;
        if (lead) {
          const W = this._limbRT(lead.key).multiply(lead.rel.clone().invert());
          W.decompose(it.group.position, it.group.quaternion, V());
          it.group.updateWorldMatrix(true, true);
        }
      }
      const PR = this._propRT(it);
      let moved = false;
      this._busy = true;
      try {
        for (const g of live) {
          if (g === lead || g.key === dragKey) continue;
          const W = PR.clone().multiply(g.rel);
          const p = V(), q = new THREE.Quaternion(); W.decompose(p, q, V());
          const b = slot.boneMap[g.key];
          const dp = b.getWorldPosition(V()).distanceTo(p);
          const dq = b.getWorldQuaternion(new THREE.Quaternion()).angleTo(q);
          if (dp > 0.003 || dq > 0.05) { v.pull.solve(g.key, p, q); moved = true; g._tp = p; }
        }
        if (moved) {
          v.applyAll();
          // 腕・脚が伸びきって届かなかった手足は、小物から離さずに、届いた所のいちばん近い面へ滑らせる
          //   （手の向きも、その面に合わせて付け直す）
          v.scene.updateMatrixWorld(true);
          let slid = false;
          for (const g of [...live]) {
            if (!g._tp) continue;
            const miss = slot.boneMap[g.key].getWorldPosition(V()).distanceTo(g._tp);
            g._tp = null;
            if (miss > 0.02) {
              this._surface = true;
              try { this.grip(g.key, it, true, 0.8); slid = true; } finally { this._surface = false; }
            }
          }
          if (slid) v.applyAll();
        }
      } finally { this._busy = false; }
    }
  }

  /** 手・足を引っ張り終えた: 床に置く物につないだ手足は、面の上の新しい所へ付け直す */
  handDragEnd(key) {
    if (!/^(hand|foot)[LR]$/.test(key || '')) return;
    const gp = this.gripOf(key);
    if (!gp) return;
    const it = gp.it;
    // 床に置く物・2 体で持っている物・「持つ所を変える」のとき: 手足を、離した所のいちばん近い面へ付け直す
    if (it.grounded || it.grips.some(g => !this.isLive(g)) || this.slideMode) {
      this._surface = true;
      try { this.grip(key, it, true, 0.3); } finally { this._surface = false; }
      this.onChange();
    }
  }
}
// ===== props.js ここまで =====
