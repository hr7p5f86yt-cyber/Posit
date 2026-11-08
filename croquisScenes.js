// croquisScenes.js — クロッキーの「小物だけ」「石膏像」の出題
//
// ・小物だけ … 組み合わせ（1〜4 個を台の上か床に静物のように置く）／ 1 つずつ（1 個を毎回ちがう置き方で）
// ・石膏像 … 古代ギリシャ・ローマ〜19 世紀の彫刻の 3D スキャン（胸像・頭像は台に載せ、全身像は床に）・現代の頭部スキャン・幾何形体（立方体・円柱・円すい・球・六角柱など）
//     どれも白くつやのない石膏の質感にし、見る向き・ライトを毎回変える。像のスキャンの出どころは STATUES と CREDITS.md
//     胸像の元: "Infinite, 3D Head Scan" by Lee Perry-Smith（CC BY 3.0。www.triplegangers.com / www.ir-ltd.net）。読み込めないときは人形の頭〜胸で代わりにする
// ・どれも人形は隠し、ライトの向きを毎回変える。出題の中身（desc）を残しておけば、同じ順番でもう一度出せる
// ・クロッキーの間だけ使う（終わったら clear で消す）

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FACE_PRESETS } from './poses.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const R = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const DEG = Math.PI / 180;
const qArr = q => [q.x, q.y, q.z, q.w].map(x => +x.toFixed(5));
const qFrom = (ax, deg) => new THREE.Quaternion().setFromAxisAngle(ax, deg * DEG);

const PROP_NAME = {
  chair: '椅子', stool: 'スツール', bench: 'ベンチ', sofa: 'ソファ', table: '台', box: '箱', pedestal: '円柱台',
  stairs: '階段', bar: '鉄棒', stick: '棒', ball: 'ボール', book: '本', cup: 'コップ', umbrella: '傘', sword: '剣',
  bag: 'かばん', dumbbell: 'ダンベル',
};

// 幾何形体（石膏）。s: 大きさ（m）
const SOLIDS = [
  { key: 'cube', name: '立方体' },
  { key: 'cuboid', name: '直方体' },
  { key: 'cylinder', name: '円柱' },
  { key: 'cone', name: '円すい' },
  { key: 'sphere', name: '球' },
  { key: 'hex', name: '六角柱' },
  { key: 'tri', name: '三角柱' },
  { key: 'pyramid', name: '四角すい' },
  { key: 'octa', name: '八面体' },
];
const SOLID_NAME = Object.fromEntries(SOLIDS.map(s => [s.key, s.name]));

// 石膏像（実在の彫刻の 3D スキャン。models/statues/）。kind: 'bust'（胸像・頭像。台に載せる）| 'full'（全身像。床に置く）
//   src: '3ds' … Three D Scans（著作権なし）を Keijiro Takahashi さんが軽くしたもの（github.com/keijiro/ThreeDScans）
//        'dk'  … Geoffrey Marchal さんのスキャン（CC BY 4.0）を Keijiro Takahashi さんが軽くしたもの（github.com/keijiro/DanishStatues）
//        'lee' … Lee Perry-Smith さんの頭部スキャン（CC BY 3.0。models/LeePerrySmith.glb）
export const STATUES = [
  { key: 'Plato', kind: 'bust', src: '3ds', name: 'プラトン（Plato）' },
  { key: 'EpicMetro', kind: 'bust', src: '3ds', name: 'エピクロスとメトロドロスの二重ヘルム' },
  { key: 'Gutenberg', kind: 'bust', src: '3ds', name: 'グーテンベルクの胸像' },
  { key: 'BustManWreath', kind: 'bust', src: 'dk', name: '花冠をつけた男の胸像（1 世紀・ローマ）' },
  { key: 'LeePerrySmith', kind: 'bust', src: 'lee', name: '頭部（現代のスキャン）' },
  { key: 'Athena', kind: 'full', src: '3ds', name: 'アテナ（アレッツォのミネルヴァ）' },
  { key: 'Hermes', kind: 'full', src: '3ds', name: 'ヘルメス（Hermes）' },
  { key: 'Nymph', kind: 'full', src: '3ds', name: 'ニンフ（Nymph）' },
  { key: 'Penelope', kind: 'full', src: '3ds', name: 'ペネロペ（Penelope）' },
  { key: 'BootlegEve', kind: 'full', src: '3ds', name: 'イヴ（Bootleg Eve）' },
  { key: 'MarblePlayer', kind: 'full', src: '3ds', name: 'しゃがむ少年（Marble Player）' },
  { key: 'ShepherdBoy', kind: 'full', src: '3ds', name: '眠る羊飼いの少年' },
  { key: 'DeChalon', kind: 'full', src: '3ds', name: 'ルネ・ド・シャロンのトランジ（リジェ・リシエ）' },
  { key: 'DancingGirl', kind: 'full', src: 'dk', name: '踊る少女（トルヴァルセン）' },
  { key: 'Maria', kind: 'full', src: 'dk', name: 'マリア・バリャチンスカヤ（トルヴァルセン）' },
  { key: 'Ugolino', kind: 'full', src: 'dk', name: 'ウゴリーノと息子たち（カルポー）' },
];
const STATUE = Object.fromEntries(STATUES.map(s => [s.key, s]));

function solidGeometry(key) {
  // どれも底が y = 0（八面体・球は中心を持ち上げる）
  let g;
  switch (key) {
    case 'cube': g = new THREE.BoxGeometry(0.2, 0.2, 0.2); break;
    case 'cuboid': g = new THREE.BoxGeometry(0.14, 0.3, 0.14); break;
    case 'cylinder': g = new THREE.CylinderGeometry(0.085, 0.085, 0.26, 48); break;
    case 'cone': g = new THREE.ConeGeometry(0.11, 0.28, 48); break;
    case 'sphere': g = new THREE.SphereGeometry(0.1, 48, 32); break;
    case 'hex': g = new THREE.CylinderGeometry(0.09, 0.09, 0.26, 6); break;
    case 'tri': g = new THREE.CylinderGeometry(0.1, 0.1, 0.26, 3); break;
    case 'pyramid': g = new THREE.ConeGeometry(0.13, 0.24, 4); break;
    case 'octa': g = new THREE.OctahedronGeometry(0.13); break;
    default: g = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  }
  if (key !== 'sphere' && key !== 'cylinder' && key !== 'cone') {
    // 角のある物は、面ごとに平らな陰（角がはっきり見える）
    const n = g.toNonIndexed(); g.dispose(); g = n; g.computeVertexNormals();
  }
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox.min.y, 0);
  return g;
}

export class CroquisScenes {
  constructor(viewer) {
    this.v = viewer;
    this.group = new THREE.Group();
    this.group.visible = false;
    viewer.scene.add(this.group);
    this.plaster = new THREE.MeshStandardMaterial({ color: 0xf1eee8, roughness: 0.92, metalness: 0 });
    this.active = null;   // いま出している desc
  }

  // ---- 出題を作る（中身だけ。置くのは show） ----------------------------------

  /** ライトの向き: カメラの向きは毎回変わるので、ライトは見る向きからずらして当てる（show で決める） */
  _light() { return { side: pick([-1, 1]), az: R(35, 115), el: R(28, 62) }; }

  /** 小物だけ。mode: 'combo'（組み合わせ）| 'single'（1つずつ） */
  genProps(mode) {
    const P = this.v.props;
    const items = [];
    if (mode === 'single') {
      const types = ['chair', 'stool', 'bench', 'sofa', 'table', 'box', 'pedestal', 'stairs', 'bar', 'stick', 'ball', 'book', 'cup', 'umbrella', 'sword', 'bag', 'dumbbell'];
      const t = pick(types.filter(x => x !== this._lastSingle));
      this._lastSingle = t;
      items.push(this._propItem(t, false));
      items[0].x = 0; items[0].z = 0;
      return { subject: 'props', id: 'cqp' + Date.now() + Math.random().toString(36).slice(2, 6), base: null, items, light: this._light(),
        name: PROP_NAME[t] };
    }
    const onTable = Math.random() < 0.6;
    const n = 1 + Math.floor(Math.random() * 4);
    const pool = ['ball', 'cup', 'book', 'bag', 'dumbbell', 'sword', 'stick', 'box', 'pedestal', 'cup', 'book', 'ball', 'box'];
    if (!onTable) pool.push('umbrella', 'chair', 'stool');
    const once = new Set(['umbrella', 'chair', 'stool', 'sword', 'stick', 'bag', 'dumbbell']);   // 大きい物は 1 つまで
    for (let i = 0; i < n; i++) {
      const t = pick(pool.filter(x => !(once.has(x) && items.some(it => it.type === x))));
      items.push(this._propItem(t, onTable));
    }
    const base = onTable ? { type: 'table', h: +R(0.5, 0.75).toFixed(2) } : null;
    // 置く所: 重ならないように順に並べる（台の上は天板の中）
    const area = onTable ? { x: 0.4, z: 0.2 } : { x: 0.55, z: 0.4 };
    const placed = [];
    for (const it of items) {
      const r = it.r;
      let best = null;
      for (let k = 0; k < 40; k++) {
        const x = R(-area.x + Math.min(r, area.x * 0.8), area.x - Math.min(r, area.x * 0.8)), z = R(-area.z + Math.min(r, area.z * 0.8), area.z - Math.min(r, area.z * 0.8));
        const gap = Math.min(...placed.map(p => Math.hypot(p.x - x, p.z - z) - p.r - r), 9);
        if (!best || gap > best.gap) best = { x, z, gap };
        if (gap > 0.02) break;
      }
      it.x = +best.x.toFixed(3); it.z = +best.z.toFixed(3);
      placed.push({ x: it.x, z: it.z, r });
    }
    const names = [...new Set(items.map(it => PROP_NAME[it.type]))];
    return { subject: 'props', id: 'cqp' + Date.now() + Math.random().toString(36).slice(2, 6), base, items, light: this._light(),
      name: names.join('・') + (onTable ? '（台の上）' : '') };
  }

  /** 1 個の小物の大きさ・置き方（倒す・立てる） */
  _propItem(type, onTable) {
    const it = { type, params: {}, q: [0, 0, 0, 1], r: 0.12 };
    const up = V(0, 1, 0), yaw = qFrom(up, R(0, 360));
    let q = yaw.clone();
    const lie = () => yaw.clone().multiply(qFrom(V(0, 0, 1), 90));
    switch (type) {
      case 'ball': { const s = +R(0.6, 1.15).toFixed(2); it.params = { sx: s, sy: s, sz: s }; it.r = 0.11 * s; break; }
      case 'cup': if (Math.random() < 0.25) q = lie(); it.r = 0.07; break;
      case 'book':
        if (Math.random() < 0.35) q = yaw.clone().multiply(qFrom(V(0, 0, 1), 90));
        it.params = { sx: +R(0.85, 1.25).toFixed(2), sz: +R(0.85, 1.25).toFixed(2) }; it.r = 0.14; break;
      case 'bag': it.r = 0.2; break;
      case 'dumbbell': q = lie(); it.r = 0.2; break;
      case 'sword': q = lie(); it.params = onTable ? { sy: 0.75 } : {}; it.r = onTable ? 0.36 : 0.48; break;
      case 'stick': q = lie(); it.params = { sy: onTable ? 0.6 : 1 }; it.r = onTable ? 0.36 : 0.6; break;
      case 'umbrella': q = Math.random() < 0.5 ? lie() : yaw; it.r = 0.5; break;
      case 'box': { const s = onTable ? R(0.35, 0.6) : R(0.45, 1.2); it.params = { size: +s.toFixed(2), sx: +R(0.7, 1.4).toFixed(2), sz: +R(0.7, 1.4).toFixed(2) }; it.r = 0.2 * s * 1.2; break; }
      case 'pedestal': { const s = onTable ? R(0.25, 0.45) : R(0.4, 1); it.params = { h: +(onTable ? R(0.08, 0.25) : R(0.2, 0.7)).toFixed(2), sx: +s.toFixed(2), sz: +s.toFixed(2) }; it.r = 0.25 * s; break; }
      case 'chair': case 'stool': it.r = 0.3; break;
      default: it.r = 0.6;
    }
    it.q = qArr(q);
    return it;
  }

  /** 石膏像。kind: 'all'（全部）| 'bust'（胸像・頭像）| 'full'（全身像）| 'solids'（幾何形体） */
  genPlaster(kind = 'all') {
    const id = 'cqs' + Date.now() + Math.random().toString(36).slice(2, 6);
    const k = kind === 'all' ? (Math.random() < 0.3 ? 'solids' : 'statue') : kind === 'solids' ? 'solids' : 'statue';
    if (k === 'statue') {
      const key = this._nextStatue(kind === 'all' ? null : kind);
      const st = STATUE[key];
      // 次に出しそうな像を先に読み込んでおく
      this._prefetch = this._nextStatue(kind === 'all' ? null : kind, true);
      this.loadStatue(this._prefetch);
      if (st.src === 'lee') {
        // 頭部スキャン: 少し傾け、ときどき左右を入れ替える
        const real = { tx: +R(-7, 5).toFixed(1), tz: +R(-6, 6).toFixed(1), mirror: Math.random() < 0.5, stand: +R(0.95, 1.15).toFixed(2) };
        const face = pick(FACE_PRESETS);
        const j = { head: [0, 0, 0], neck: [0, 0, 0], chest: [0, 0, 0] };
        return { subject: 'plaster', kind: 'bust', id, real, face: face.spec, jitter: j, light: this._light(), name: st.name };
      }
      this.loadStatue(key);
      return { subject: 'plaster', kind: 'statue', id, key, stand: st.kind === 'bust' ? +R(0.95, 1.15).toFixed(2) : +R(0, 0.12).toFixed(2),
        light: this._light(), name: st.name };
    }
    const n = Math.random() < 0.35 ? 1 : Math.random() < 0.7 ? 2 : 3;
    const keys = [];
    for (let i = 0; i < n; i++) keys.push(pick(SOLIDS.map(s => s.key).filter(k => !keys.includes(k))));
    const list = [];
    const placed = [];
    keys.forEach((k, i) => {
      const s = +R(0.85, 1.35).toFixed(2);
      // 柱は寝かせることもある（円柱・六角柱・三角柱・直方体）
      const lie = /^(cylinder|hex|tri|cuboid)$/.test(k) && Math.random() < 0.35;
      const r = 0.15 * s * (lie ? 1.3 : 1);
      let best = null;
      for (let t = 0; t < 40; t++) {
        const x = i === 0 ? R(-0.05, 0.05) : R(-0.35, 0.35), z = i === 0 ? R(-0.05, 0.05) : R(-0.25, 0.25);
        const gap = Math.min(...placed.map(p => Math.hypot(p.x - x, p.z - z) - p.r - r), 9);
        if (!best || gap > best.gap) best = { x, z, gap };
        if (gap > 0.03) break;
      }
      placed.push({ x: best.x, z: best.z, r });
      list.push({ key: k, s, lie, yaw: +R(0, 360).toFixed(1), x: +best.x.toFixed(3), z: +best.z.toFixed(3) });
    });
    // 台（白い布をかけた低い台の代わり）に載せることもある
    const plinth = Math.random() < 0.5 ? +R(0.12, 0.45).toFixed(2) : 0;
    return { subject: 'plaster', kind: 'solids', id, list, plinth, light: this._light(), name: keys.map(k => SOLID_NAME[k]).join('・') };
  }

  // ---- 置く・消す ----------------------------------------------------------

  /** desc を置く。人形は隠す（胸像は人形の頭〜胸だけを石膏にして出す） */
  show(desc) {
    this.clear();
    this.active = desc;
    const v = this.v;
    if (desc.subject === 'props') {
      v.setDollHidden(true);
      this._showProps(desc);
    } else if (desc.kind === 'bust') {
      this._showBust(desc);
    } else if (desc.kind === 'statue') {
      this._showStatue(desc);
    } else {
      v.setDollHidden(true);
      this._showSolids(desc);
    }
    this._frame(desc);
  }

  _showProps(desc) {
    const P = this.v.props;
    let baseY = 0;
    if (desc.base) {
      const t = P.addStill('table', { h: desc.base.h, sx: 1, sy: 1, sz: 1 }, [0, 0, 0, 1], 0, 0, 0);
      baseY = t.params.h;
    }
    for (const it of desc.items) P.addStill(it.type, it.params, it.q, it.x, it.z, baseY);
    P.setLook('clay');
  }

  /** 次の像（同じ像が続かないよう、全部をひととおり出してから次の一巡へ）。peek: 決めるだけで使わない */
  _nextStatue(kind, peek = false) {
    const pool = STATUES.filter(s => !kind || s.kind === kind).map(s => s.key);
    const bagKey = kind || 'all';
    this._bags = this._bags || {};
    let bag = this._bags[bagKey];
    if (!bag || !bag.length) {
      bag = pool.slice().sort(() => Math.random() - 0.5);
      if (bag.length > 1 && bag[bag.length - 1] === this._lastStatue) bag.unshift(bag.pop());
      this._bags[bagKey] = bag;
    }
    if (peek) return bag[bag.length - 1];
    const key = bag.pop();
    this._lastStatue = key;
    return key;
  }

  /** はじめる前に、1 枚目に出しそうな像を読み込んでおく */
  warm(kind = 'all') {
    if (kind === 'solids') return;
    this.loadStatue(this._nextStatue(kind === 'all' ? null : kind, true));
  }

  /** 像の 3D スキャンを読み込む（1 回だけ。読み込めなかったら null） */
  loadStatue(key) {
    const st = STATUE[key];
    if (!st) return Promise.resolve(null);
    if (st.src === 'lee') return this.preload();
    this._statues = this._statues || new Map();
    this._touch(key);
    if (this._statues.has(key)) return this._statues.get(key);
    const url = new URL('./models/statues/' + key + '.glb', import.meta.url).href;
    const p = new GLTFLoader().loadAsync(url).then(g => {
      let mesh = null;
      g.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
      if (!mesh) return null;
      const old = mesh.material;
      // 石膏: 白く、つやのない面。細かい凹凸は法線の画像、くぼみの陰は陰の画像で
      mesh.material = new THREE.MeshStandardMaterial({ color: 0xf3f0ea, roughness: 0.93, metalness: 0,
        normalMap: old.normalMap || null, aoMap: old.aoMap || null, aoMapIntensity: 1 });
      old.dispose();
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.geometry.computeBoundingBox();
      mesh.userData.keep = true;
      mesh.position.set(0, 0, 0); mesh.rotation.set(0, 0, 0); mesh.scale.set(1, 1, 1);
      mesh.removeFromParent();
      return mesh;
    }).catch(() => null);
    this._statues.set(key, p);
    p.then(m => { this._statueMesh = this._statueMesh || {}; this._statueMesh[key] = m; });
    return p;
  }

  /**
   * 読み込んだ像は、新しい順に 5 体まで取っておく（iPhone・iPad のメモリを使い過ぎないように）。
   * それより古い像は捨てる。ただし、いま出している像・次に出す像・小物として置いている像は捨てない
   */
  _touch(key) {
    this._lru = (this._lru || []).filter(k => k !== key);
    this._lru.push(key);
    const KEEP = 5;
    for (const k of [...this._lru]) {
      if (this._lru.length <= KEEP) break;
      if (k === key || k === this._prefetch || (this.active && this.active.key === k)) continue;
      if (this.v.props.items.some(it => it.variant === k)) continue;
      const m = this._statueMesh && this._statueMesh[k];
      if (!m) continue;   // まだ読み込み中
      m.removeFromParent();
      m.geometry.dispose();
      for (const t of ['normalMap', 'aoMap']) if (m.material[t]) m.material[t].dispose();
      m.material.dispose();
      delete this._statueMesh[k];
      this._statues.delete(k);
      this._lru = this._lru.filter(x => x !== k);
    }
  }

  _showStatue(desc) {
    const v = this.v;
    v.setDollHidden(true);
    const m = this._statueMesh && this._statueMesh[desc.key];
    if (!m) {
      // まだ読み込み中: 読み終わったら、まだ同じ出題なら置き直す
      this._waiting = desc;
      this.loadStatue(desc.key).then(mm => {
        if (this.active !== desc || this._waiting !== desc) return;
        this._waiting = null;
        if (!mm) return;
        this.show(desc);
        if (this.onReady) this.onReady(desc);
      });
      this._bust = { center: V(0, 1, 0), radius: 0.6 };
      return;
    }
    const st = STATUE[desc.key];
    const bb = m.geometry.boundingBox;
    const top = desc.stand || 0;
    if (top > 0.01) {
      // 胸像は台の上に。全身像は低い台に
      const w = Math.max(0.3, (bb.max.x - bb.min.x) * 1.05), d = Math.max(0.3, (bb.max.z - bb.min.z) * 1.05);
      const stand = new THREE.Mesh(new THREE.BoxGeometry(st.kind === 'bust' ? Math.min(w, 0.5) : w + 0.1, top, st.kind === 'bust' ? Math.min(d, 0.45) : d + 0.1), this.plaster);
      stand.position.set(0, top / 2, 0);
      stand.castShadow = stand.receiveShadow = true; stand.userData.base = true;
      this.group.add(stand);
    }
    const piv = new THREE.Group();
    piv.position.set(0, top, 0);
    piv.userData.keep = true;
    piv.add(m);
    this.group.add(piv);
    this.group.visible = true;
    const h = bb.max.y - bb.min.y;
    const size = V().subVectors(bb.max, bb.min);
    this._bust = { center: V(0, top + h * (st.kind === 'bust' ? 0.5 : 0.5), 0), radius: Math.max(0.28, size.length() * (st.kind === 'bust' ? 0.5 : 0.45)) };
  }

  /** 胸像の 3D スキャンを読み込む（1 回だけ。読み込めなかったら null） */
  preload() {
    if (this._headP) return this._headP;
    const base = new URL('./models/', import.meta.url).href;
    this._headP = Promise.all([
      new GLTFLoader().loadAsync(base + 'LeePerrySmith.glb'),
      new THREE.TextureLoader().loadAsync(base + 'LeePerrySmith_normal.jpg').catch(() => null),
    ]).then(([g, nm]) => {
      let mesh = null;
      g.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
      if (!mesh) return null;
      if (nm) { nm.flipY = false; nm.colorSpace = THREE.NoColorSpace; }
      // 石膏: 白く、つやのない面。細かい凹凸は法線の画像で
      mesh.material = new THREE.MeshStandardMaterial({ color: 0xf3f0ea, roughness: 0.93, metalness: 0, normalMap: nm || null,
        normalScale: new THREE.Vector2(0.8, 0.8) });
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.geometry.computeBoundingBox();
      mesh.userData.keep = true;
      this.head = mesh;
      return mesh;
    }).catch(() => null);
    return this._headP;
  }

  _showRealBust(desc) {
    const v = this.v, r = desc.real, m = this.head;
    v.setDollHidden(true);
    const S = 0.045;                       // 頭のてっぺん〜肩の下で約 36cm
    const bb = m.geometry.boundingBox;
    const top = r.stand;                   // 台の上の高さ
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.34, top, 0.3), this.plaster);
    stand.position.set(0, top / 2, 0);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.035, 0.36), this.plaster);
    cap.position.set(0, top - 0.0175, 0);
    for (const o of [stand, cap]) { o.castShadow = true; o.receiveShadow = true; o.userData.base = true; this.group.add(o); }
    const piv = new THREE.Group();          // 台の上の、胸像の底の真ん中で傾ける
    piv.position.set(0, top, 0);
    piv.rotation.set(r.tx * DEG, 0, r.tz * DEG);
    m.scale.set(r.mirror ? -S : S, S, S);
    m.position.set(0, -bb.min.y * S - 0.004, -(bb.min.z + bb.max.z) / 2 * S);
    piv.add(m);
    piv.userData.keep = true;
    this.group.add(piv);
    this.group.visible = true;
    const h = (bb.max.y - bb.min.y) * S;
    this._bust = { center: V(0, top + h * 0.42, 0), radius: Math.max(0.28, h * 0.72) };
  }

  _showBust(desc) {
    if (desc.real && this.head) { this._showRealBust(desc); return; }
    if (desc.real && !this._headFailed) {
      // 頭部スキャンを読み込み中: 読み終わったら置き直す（読み込めなければ人形の胸像で代わりにする）
      this.v.setDollHidden(true);
      this.preload().then(m => {
        if (this.active !== desc) return;
        if (!m) this._headFailed = true;
        this.show(desc);
        if (this.onReady) this.onReady(desc);
      });
      this._bust = { center: V(0, 1.2, 0), radius: 0.4 };
      return;
    }
    const v = this.v;
    v.setDollHidden(false);
    if (v.second && v.second.holder) v.second.holder.visible = false;   // 2 体目は出さない
    const j = desc.jitter;
    // 腕は体の横に下ろす（胸の高さで切ると、肩の付け根が残る）
    const base = 'upperArmL:2,0,4 upperArmR:2,0,-4 forearmL:-4,0,0 forearmR:-4,0,0';
    const m = {};
    for (const tok of (desc.face || '').split(/\s+/).filter(Boolean)) {
      const [k, a] = tok.split(':'); m[k] = a.split(',').map(Number);
    }
    for (const k of ['head', 'neck', 'chest']) {
      const a = m[k] || [0, 0, 0];
      m[k] = a.map((x, i) => +(x + j[k][i]).toFixed(1));
    }
    const spec = base + ' ' + Object.entries(m).map(([k, a]) => `${k}:${a.join(',')}`).join(' ');
    v.applyPose(spec);
    v.applyAll(); v.scene.updateMatrixWorld(true);
    const slot = v.primarySlot, bm = slot.boneMap;
    const chest = bm.chest.getWorldPosition(V()), neck = bm.neck.getWorldPosition(V());
    // 切る高さ: 胸の骨の少し下（わきの下あたり）
    const cutY = chest.y - (neck.y - chest.y) * 0.55;
    v.setBustCut(cutY);
    // 台座: 切り口の下（切り口を隠す）
    const g = new THREE.CylinderGeometry(0.15, 0.17, 0.09, 64);
    const plinth = new THREE.Mesh(g, this.plaster);
    plinth.position.set(chest.x, cutY - 0.045 + 0.004, chest.z);
    // 台座の下は、床まで届く四角い柱
    const ch = Math.max(0.2, cutY - 0.09);
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.3, ch, 0.3), this.plaster);
    stem.position.set(chest.x, ch / 2, chest.z);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.36), this.plaster);
    foot.position.set(chest.x, ch - 0.02, chest.z);
    for (const o of [plinth, stem, foot]) { o.castShadow = true; o.receiveShadow = true; this.group.add(o); }
    this.group.visible = true;
    v.applyMaterialMode('plaster');
    // 見る範囲: 台座の上の端〜頭のてっぺん
    const top = bm.head.getWorldPosition(V()).y + 0.16, bot = cutY - 0.1;
    this._bust = { center: V(chest.x, (top + bot) / 2, chest.z), radius: Math.max(0.3, (top - bot) * 0.72) };
  }

  _showSolids(desc) {
    let base = 0;
    if (desc.plinth) {
      const g = new THREE.BoxGeometry(0.95, desc.plinth, 0.7);
      const m = new THREE.Mesh(g, this.plaster);
      m.position.set(0, desc.plinth / 2, 0);
      m.castShadow = true; m.receiveShadow = true;
      m.userData.base = true;   // 見る範囲には入れない（載せた形を大きく見せる）
      this.group.add(m);
      base = desc.plinth;
    }
    for (const s of desc.list) {
      const m = new THREE.Mesh(solidGeometry(s.key), this.plaster);
      m.scale.setScalar(s.s);
      const q = qFrom(V(0, 1, 0), s.yaw);
      if (s.lie) q.multiply(qFrom(V(0, 0, 1), 90));
      m.quaternion.copy(q);
      m.position.set(s.x, 0, s.z);
      m.castShadow = true; m.receiveShadow = true;
      this.group.add(m);
      // いちばん下の所を台の上（床）に
      m.updateWorldMatrix(true, false);
      const pos = m.geometry.attributes.position, w = V();
      let minY = Infinity;
      for (let i = 0; i < pos.count; i++) { w.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); minY = Math.min(minY, w.y); }
      m.position.y += base - minY;
    }
    this.group.visible = true;
  }

  /** カメラが入れる範囲（ライトの向きもここで決める: 見る向きから横へずらす） */
  _frame(desc) {
    const v = this.v;
    let center, radius;
    if ((desc.kind === 'bust' || desc.kind === 'statue') && this._bust) ({ center, radius } = this._bust);
    else {
      const box = new THREE.Box3();
      this.group.updateWorldMatrix(true, true);
      for (const o of this.group.children) if (!o.userData.base) box.expandByObject(o);
      for (const it of v.props.items) if (it.auto && it.group.visible) { it.group.updateWorldMatrix(true, true); box.expandByObject(it.group); }
      if (box.isEmpty()) box.set(V(-0.3, 0, -0.3), V(0.3, 0.6, 0.3));
      center = box.getCenter(V());
      radius = Math.max(0.2, box.getSize(V()).length() * 0.5) * 1.25;   // 少し引いて、まわりの床と影も入れる
    }
    v.frameOverride = { center, radius };
  }

  /** カメラを置いたあとに呼ぶ: ライトを見る向きから横へずらして当てる（陰影がはっきり出るように） */
  lightFor(az) {
    const d = this.active && this.active.light;
    if (!d) return;
    this.v.setLightDirection((az + d.side * d.az + 360) % 360, d.el);
  }

  clear() {
    const v = this.v;
    for (const o of [...this.group.children]) {
      this.group.remove(o);
      if (o.userData.keep) { for (const c of [...o.children]) if (c.userData.keep) o.remove(c); continue; }   // 像のスキャンは使い回す
      o.geometry && o.geometry.dispose();
    }
    this.group.visible = false;
    v.props.clearAuto();
    v.props.setLook(null);
    v.setBustCut(null);
    v.setDollHidden(false);
    v.frameOverride = null;
    this._bust = null;
    this.active = null;
  }
}

export const SCENE_NAMES = { PROP_NAME, SOLID_NAME };
// ===== croquisScenes.js ここまで =====
