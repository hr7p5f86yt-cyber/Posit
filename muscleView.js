// muscleView.js — 素体の内側に、名前の付いた表層の筋肉を一つずつ組み立てる
//
// 考え方
//   1. 筋肉は「起始（付け根）」と「停止（付く先）」の線をつなぐ、たくさんの筋線維の束として作る。
//      起始・停止の位置は、体幹・手足・首・頭の「枠」の中の位置（高さ・向き）で書く。
//   2. 枠の芯（体幹の中心線・手足の骨の線）から外へ向けて、素体の表面までの距離を測り、
//      その少し内側に筋肉の表の面を置く。筋肉の端ほど深くして、筋肉と筋肉のあいだに溝を作る。
//   3. 筋肉の腹（まん中）はふくらませ、端の腱は細く薄くする。
//   4. スキンの重みは、付け根の近くは付け根の骨、付く先の近くは付く先の骨の素体の重みを写す。
//      ポーズを付けると、筋肉は骨と一緒に伸び縮みする。
//
// 左右は人形から見た左右（+X が人形の左）。形は単純化した美術解剖学の図に近いもの。
import * as THREE from 'three';
import { measureBody, trunkProfile, spineChain } from './skeletonView.js';
import { partName } from './anatomy.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };
const DEG = Math.PI / 180;

function slerpDir(a, b, t) {
  const d = clamp(a.dot(b), -1, 1);
  if (d > 0.9995) return a.clone().lerp(b, t).normalize();
  const th = Math.acos(d), s = Math.sin(th);
  return a.clone().multiplyScalar(Math.sin((1 - t) * th) / s).addScaledVector(b, Math.sin(t * th) / s).normalize();
}

/** 色: 筋肉・腱 */
function muscleMaterial(tendon) {
  return new THREE.MeshStandardMaterial({
    color: tendon ? 0xe2d6c4 : 0xb4584c, roughness: tendon ? 0.5 : 0.62, metalness: 0,
    emissive: 0x000000, side: THREE.DoubleSide,
  });
}

/**
 * スロットの素体に、筋肉を組み立てる。呼ぶ前に骨を基準姿勢（ポーズなし・倍率 1）にしておくこと。
 * @param {object} slot   viewer のスロット
 * @param {object} extra  { handFrame: {L, R} }
 * @returns {THREE.SkinnedMesh[]}
 */
export function buildMuscles(slot, extra = {}) {
  const map = slot.boneMap;
  if (!slot.skeleton || !map || !map.hips || !map.upperArmL) return [];
  slot.pivot.updateWorldMatrix(true, true);
  const T0 = performance.now();
  const W = b => (b ? b.getWorldPosition(V3()) : null);
  const J = {};
  for (const [k, b] of Object.entries(map)) J[k] = W(b);

  const body = measureBody(slot);
  if (!body.count) return [];
  let floor = Infinity, top = -Infinity;
  for (let i = 0; i < body.count; i++) { const y = body.pos[i * 3 + 1]; if (y < floor) floor = y; if (y > top) top = y; }
  const H = Math.max(0.3, top - floor), s = H / 1.70;
  const cx = J.hips.x;

  const chain = spineChain(map);
  const trunkBones = new Set(chain.filter(b => b !== map.head));
  for (const k of ['shoulderL', 'shoulderR']) if (map[k]) trunkBones.add(map[k]);
  const armBones = new Set();
  for (const k of ['shoulderL', 'shoulderR']) if (map[k]) armBones.add(map[k]);
  const prof = trunkProfile(body, trunkBones, armBones, cx, s);
  const zc = y => (prof ? (prof.back(clamp(y, prof.ymin, prof.ymax)) + prof.front(clamp(y, prof.ymin, prof.ymax))) / 2 : J.hips.z);

  // 頭の箱
  const headSet = new Set();
  if (map.head) (function walk(b) { headSet.add(b); for (const c of b.children) if (c.isBone) walk(c); })(map.head);
  let head = null;
  {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity, n = 0;
    for (let i = 0; i < body.count; i++) {
      if (!headSet.has(body.dom[i])) continue;
      const x = body.pos[i * 3], y = body.pos[i * 3 + 1], z = body.pos[i * 3 + 2];
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z); n++;
    }
    if (n > 24) head = { top: y1, bottom: y0, h: y1 - y0, half: Math.max(x1 - cx, cx - x0), zf: z1, zb: z0 };
  }

  // ---- 目印の高さ ----------------------------------------------------------
  const GH = { L: J.upperArmL, R: J.upperArmR };
  const ySN = Math.min(floor + 0.819 * H, Math.min(GH.L.y, GH.R ? GH.R.y : GH.L.y) + 0.03 * s);   // 胸骨上切痕
  const yXiph = ySN - 0.178 * s;                      // 剣状突起
  const yHJ = J.thighL ? J.thighL.y : floor + 0.50 * H;
  const yCrest = yHJ + 0.105 * s;                     // 腸骨稜のいちばん高い所
  const yASIS = yHJ + 0.068 * s;                      // 上前腸骨棘
  const yPubis = yHJ - 0.025 * s;                     // 恥骨結合
  const yNavel = lerp(yPubis, yXiph, 0.52);           // へそ
  const yC7 = J.neck ? J.neck.y + 0.012 * s : ySN + 0.05 * s;
  const ySacrum = yHJ + 0.02 * s, yCoccyx = yHJ - 0.05 * s;

  // ---- 枠 -------------------------------------------------------------------
  const fingers = slot.fingers || {};
  const seg = (sd) => {
    const fg = fingers[sd];
    const mid1 = fg && fg.middle && fg.middle[1];
    const ft = map['foot' + sd];
    const toe = ft && ft.children.find(c => c.isBone);
    return {
      ua: [J['upperArm' + sd], J['forearm' + sd]],
      fa: [J['forearm' + sd], J['hand' + sd]],
      hd: [J['hand' + sd], mid1 ? W(mid1) : null],
      th: [J['thigh' + sd], J['shin' + sd]],
      sh: [J['shin' + sd], J['foot' + sd]],
      ft: [J['foot' + sd], toe ? W(toe) : null],
    };
  };
  const SEG = { L: seg('L'), R: seg('R') };
  const neckA = V3(cx, yC7, zc(yC7));
  const neckB = J.head ? J.head.clone() : neckA.clone().add(V3(0, 0.1 * s, 0));
  const headC = head ? V3(cx, head.top - 0.52 * head.h, (head.zf + head.zb) / 2 - 0.004 * s) : neckB.clone();

  /** 区間の枠（a … 骨の向き、f … 前、l … 外側） */
  const frameOf = (A, B, sx, kind) => {
    const a = B.clone().sub(A).normalize();
    let f, l;
    if (kind === 'ft') {
      f = V3(0, 1, 0).addScaledVector(a, -a.y).normalize();                // 足の甲
      l = V3().crossVectors(a, f).multiplyScalar(-sx).normalize();
    } else if (kind === 'hd' && extra.handFrame && extra.handFrame[sx > 0 ? 'L' : 'R']) {
      const hf = extra.handFrame[sx > 0 ? 'L' : 'R'];
      f = hf.palmar.clone(); l = hf.radial.clone();
    } else {
      f = V3(0, 0, 1).addScaledVector(a, -a.z);
      if (f.lengthSq() < 1e-6) f = V3(0, 1, 0).addScaledVector(a, -a.y);
      f.normalize();
      l = V3(sx, 0, 0).addScaledVector(a, -a.x * sx).addScaledVector(f, -f.x * sx).normalize();
    }
    return { a, f, l };
  };

  // 骨の受け持ち（スキンの重みを写すときに、どの骨の頂点から取るか）
  const sub = b => { const set = new Set(); if (b) (function w(x) { set.add(x); for (const c of x.children) if (c.isBone) w(c); })(b); return set; };
  const only = (...bs) => new Set(bs.filter(Boolean));
  const REG = {
    trunk: new Set([...trunkBones]),
    neck: only(map.neck, ...chain.filter(b => b === map.neck)),
    head: headSet,
  };
  for (const sd of ['L', 'R']) {
    REG['ua' + sd] = only(map['upperArm' + sd]);
    REG['fa' + sd] = only(map['forearm' + sd]);
    REG['hd' + sd] = sub(map['hand' + sd]);
    REG['th' + sd] = only(map['thigh' + sd]);
    REG['sh' + sd] = only(map['shin' + sd]);
    REG['ft' + sd] = sub(map['foot' + sd]);
  }
  if (!REG.neck.size) REG.neck = REG.trunk;

  // ---- 素体の表面までの距離（芯から外へ） ----------------------------------
  const depth = body.depth;
  const tmpP = V3();
  const cast = (C, d, maxR) => {
    let t = 0.0015 * s, prev = 0;
    tmpP.copy(C).addScaledVector(d, t);
    let dd = depth(tmpP);
    if (dd > 0) return null;                          // 芯が素体の外
    for (let k = 0; k < 90 && t < maxR; k++) {
      prev = t;
      t += Math.max(0.002 * s, -dd * 0.8);
      tmpP.copy(C).addScaledVector(d, t);
      dd = depth(tmpP);
      if (dd > 0) {
        let a = prev, b = t;
        for (let q = 0; q < 6; q++) {
          const m = (a + b) / 2;
          tmpP.copy(C).addScaledVector(d, m);
          if (depth(tmpP) > 0) b = m; else a = m;
        }
        return (a + b) / 2;
      }
    }
    return null;                                      // 外へ抜けなかった（となりの体の部分に触れている）
  };

  // ---- 頭の筋肉は頭蓋骨の上に置く ------------------------------------------
  // 素体の頭（つるっとした卵形）の表面に置くと、骨格の頭蓋骨から 1〜2cm 浮いて見える。
  // 顔・頭の筋肉は骨に直接のっているので、頭蓋骨の表面までの距離を測って、その上に置く
  const skullMeshes = (extra.skull || []).filter(m => m.isMesh);
  const ray = new THREE.Raycaster();
  const skullCast = (C, d) => {
    if (!skullMeshes.length) return null;
    const far = 0.25 * s;
    ray.set(C.clone().addScaledVector(d, far), d.clone().negate());
    ray.far = far;
    const hit = ray.intersectObjects(skullMeshes, false)[0];
    return hit ? far - hit.distance : null;
  };

  // ---- 位置の書き方 --------------------------------------------------------
  //   T(θ, y)   … 体幹。θ は前 0°・外 90°・後ろ 180°、y は高さ。el で上下へ傾ける
  //   U(区間, t, θ) … 手足。t は区間の付け根 0 〜 先 1、θ は前 0°・外 90°・後ろ 180°・内 -90°
  //   N(t, θ)   … 首（第7頸椎の高さ → 頭のボーン）
  //   Hd(x, y, z) … 頭。頭の中心からの向き（x は外向き）
  const mk = (sx) => ({
    T: (th, y, el = 0) => {
      const a = th * DEG;
      // 体幹の断面（楕円）の少し外までしか測らない（腕が胴に触れていると、測る線が腕の向こうまで抜けるため）
      let maxR = 0.26 * s;
      if (prof) {
        const yy = clamp(y, prof.ymin, prof.ymax);
        const ha = Math.max(0.04 * s, prof.half(yy)), hb = Math.max(0.04 * s, (prof.front(yy) - prof.back(yy)) / 2);
        const re = 1 / Math.sqrt((Math.sin(a) / ha) ** 2 + (Math.cos(a) / hb) ** 2);
        maxR = Math.min(maxR, re * 1.12 + 0.012 * s);
      }
      return { C: V3(cx, y, zc(y)), d: V3(sx * Math.sin(a), el, Math.cos(a)).normalize(), reg: 'trunk', maxR };
    },
    U: (kind, t, th) => {
      const sd = sx > 0 ? 'L' : 'R';
      const [A, B] = SEG[sd][kind];
      if (!A || !B) return null;
      const fr = frameOf(A, B, sx, kind);
      const a = th * DEG;
      const len = A.distanceTo(B);
      // 手足の太さより遠くは測らない（腕を下ろすと前腕の内側が腰に触れていて、測る線が腰の向こうまで抜けるため）
      const LIMB_R = { ua: 0.075, fa: 0.055, hd: 0.035, th: 0.115, sh: 0.075, ft: 0.06 };
      return { C: A.clone().lerp(B, t), d: fr.f.clone().multiplyScalar(Math.cos(a)).addScaledVector(fr.l, Math.sin(a)).normalize(),
        reg: kind + sd, maxR: Math.min(Math.max(0.05 * s, len * 0.6), (LIMB_R[kind] || 0.1) * s) };
    },
    N: (t, th) => {
      const fr = frameOf(neckA, neckB, sx, 'neck');
      const a = th * DEG;
      return { C: neckA.clone().lerp(neckB, t), d: fr.f.clone().multiplyScalar(Math.cos(a)).addScaledVector(fr.l, Math.sin(a)).normalize(), reg: 'neck', maxR: 0.12 * s };
    },
    Hd: (x, y, z) => ({ C: headC.clone(), d: V3(sx * x, y, z).normalize(), reg: 'head', maxR: 0.2 * s }),
  });

  /** 線（いくつかの位置）を u ∈ [0,1] でたどる */
  const along = (pts, u) => {
    if (pts.length === 1) return pts[0];
    const f = clamp(u, 0, 1) * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(f)), t = f - i;
    const a = pts[i], b = pts[i + 1];
    return { C: a.C.clone().lerp(b.C, t), d: slerpDir(a.d, b.d, t), reg: t < 0.5 ? a.reg : b.reg, maxR: lerp(a.maxR, b.maxR, t) };
  };

  // ---- スキンの重みを写すための、素体の頂点の一覧 --------------------------
  const skins = (slot.meshes || []).filter(m => m.isSkinnedMesh && m.skeleton && m.geometry.attributes.skinIndex && !m.userData.headPlane && !m.userData.breastPart);
  if (!skins.length) return [];
  const ref = skins.reduce((a, b) => (b.geometry.attributes.position.count > a.geometry.attributes.position.count ? b : a));
  const refIdx = new Map(ref.skeleton.bones.map((b, i) => [b, i]));
  const SV = [];       // [x, y, z, domBone, [[boneIdx, w]...]]
  {
    const v = V3();
    for (const m of skins) {
      m.updateWorldMatrix(true, false);
      m.skeleton.update();
      const g = m.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
      for (let i = 0; i < g.attributes.position.count; i += 1) {
        m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld);
        const ws = [];
        let dom = null, dw = -1;
        for (let k = 0; k < 4; k++) {
          const w = sw.getComponent(i, k);
          if (!w) continue;
          const b = m.skeleton.bones[si.getComponent(i, k)];
          const ri = refIdx.get(b);
          if (ri === undefined) continue;
          ws.push([ri, w]);
          if (w > dw) { dw = w; dom = b; }
        }
        if (ws.length) SV.push([v.x, v.y, v.z, dom, ws]);
      }
    }
  }
  // 受け持ちの骨ごとのます目
  const CELL = 0.025;
  // ます目の番号（数で引く。ハッシュの衝突で遠くの頂点を拾わないように、重ならない番号にする）
  const KC = (i, j, k) => ((i + 1024) * 2048 + (j + 1024)) * 2048 + (k + 1024);
  const key3 = (x, y, z) => KC(Math.floor(x / CELL), Math.floor(y / CELL), Math.floor(z / CELL));
  const regGrid = {};
  const gridFor = reg => {
    if (regGrid[reg]) return regGrid[reg];
    // 'trunk+uaL' のように「+」でつないだときは、その骨たちと、親・子の骨まで含める
    let set;
    if (reg.includes('+')) {
      const parts = reg.split('+');
      const wide = parts[0] !== parts[1];          // 体幹だけの筋肉は、腕の骨まで広げない
      set = new Set();
      for (const r of parts) for (const b of (REG[r] || REG.trunk)) {
        set.add(b);
        if (!wide && r === 'trunk') continue;
        if (b.parent && b.parent.isBone) set.add(b.parent);
        for (const c of b.children) if (c.isBone) set.add(c);
      }
    } else set = REG[reg] || REG.trunk;
    const g = new Map();
    for (let i = 0; i < SV.length; i++) {
      if (!set.has(SV[i][3])) continue;
      const k = key3(SV[i][0], SV[i][1], SV[i][2]);
      let a = g.get(k); if (!a) { a = []; g.set(k, a); } a.push(i);
    }
    regGrid[reg] = g;
    return g;
  };
  const weightsNear = (p, reg) => {
    const g = gridFor(reg);
    const cx0 = Math.floor(p.x / CELL), cy0 = Math.floor(p.y / CELL), cz0 = Math.floor(p.z / CELL);
    const found = [];
    let stopAt = 6;
    for (let r = 0; r <= stopAt; r++) {
      // 見つかったら、もう一回り外まで見てから止める（ます目の角の方が近いことがあるため）
      if (found.length >= 6 && stopAt === 6) stopAt = r;
      for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let c = -r; c <= r; c++) {
        if (Math.max(Math.abs(a), Math.abs(b), Math.abs(c)) !== r) continue;
        const list = g.get(KC(cx0 + a, cy0 + b, cz0 + c));
        if (!list) continue;
        for (const i of list) {
          const q = SV[i];
          found.push([(q[0] - p.x) ** 2 + (q[1] - p.y) ** 2 + (q[2] - p.z) ** 2, i]);
        }
      }
    }
    if (!found.length) return null;
    found.sort((x, y) => x[0] - y[0]);
    const acc = new Map();
    for (const [d2, i] of found.slice(0, 6)) {
      const w0 = 1 / (d2 + 1e-5);
      for (const [bi, w] of SV[i][4]) acc.set(bi, (acc.get(bi) || 0) + w * w0);
    }
    return acc;
  };
  const mixWeights = (A, B, t) => {
    const acc = new Map();
    const add = (M, k) => { if (!M) return; let sum = 0; for (const w of M.values()) sum += w; for (const [b, w] of M) acc.set(b, (acc.get(b) || 0) + (w / sum) * k); };
    add(A, 1 - t); add(B, t);
    const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((a, e) => a + e[1], 0) || 1;
    return top.map(e => [e[0], e[1] / sum]);
  };

  // ---- 1 本の筋肉を作る ----------------------------------------------------
  ref.updateWorldMatrix(true, false);
  ref.skeleton.update();
  const bm = ref.skeleton.boneMatrices;
  const out = [];
  const stats = { muscles: 0, rays: 0 };

  /**
   * @param {object} m  id, side, o: 起始の位置の列, i: 停止の位置の列, via: 途中を通る位置の列（任意）,
   *                    nu, nv, thick, bulge, groove, belly（腹の位置 0〜1）, bands（腱画の位置）, ubands（縦の溝）,
   *                    inset（表面からの深さ）, tendon（腱の色）, part（部分名）
   */
  const build = (m) => {
    const nu = m.nu || 8, nv = m.nv || 12;
    const o = m.o.filter(Boolean), ii = m.i.filter(Boolean), via = m.via ? m.via.filter(Boolean) : null;
    if (!o.length || !ii.length) return;
    const ring = !!m.ring;                         // 輪の筋（眼輪筋・口輪筋）
    // 線維ごとの芯と向き
    const C = [], D = [], R = [], REGA = [], REGB = [], REGM = [];
    for (let a = 0; a <= nu; a++) {
      const u = a / nu;
      const O = along(o, u), I = along(ii, u), M = via ? along(via, u) : null;
      for (let b = 0; b <= nv; b++) {
        const v = b / nv;
        let c, d, maxR;
        if (M) {
          // 2 次のベジェで途中の位置を通す
          const p0 = O.C, p1 = M.C, p2 = I.C;
          c = p0.clone().multiplyScalar((1 - v) ** 2).addScaledVector(p1, 2 * v * (1 - v)).addScaledVector(p2, v * v);
          d = v < 0.5 ? slerpDir(O.d, M.d, v * 2) : slerpDir(M.d, I.d, v * 2 - 1);
          maxR = v < 0.5 ? lerp(O.maxR, M.maxR, v * 2) : lerp(M.maxR, I.maxR, v * 2 - 1);
        } else {
          c = O.C.clone().lerp(I.C, v); d = slerpDir(O.d, I.d, v); maxR = lerp(O.maxR, I.maxR, v);
        }
        C.push(c); D.push(d);
        let r = cast(c, d, maxR);
        // 頭の側の端（付け根か付く先が頭）ほど、頭蓋骨の上の高さへ寄せる
        const hw = (O.reg === 'head' ? 1 - v : 0) + (I.reg === 'head' ? v : 0);
        if (hw > 0 && skullMeshes.length) {
          const rs = skullCast(c, d);
          if (rs !== null) {
            const onBone = rs + ((m.thick ?? 0.010) + (m.inset ?? 0.0012)) * s;
            const t = (O.reg === 'head' && I.reg === 'head') ? 1 : smooth((hw - 0.45) / 0.45);
            r = r === null ? onBone : lerp(r, onBone, t);
          }
        }
        stats.rays++;
        R.push(r);
        // 付け根が上の骨にあっても、筋肉の腹が下の骨の上にあるもの（前腕の筋・腓腹筋）は skinFrom で下の骨から拾う
        REGA.push(m.skinFrom ? m.skinFrom + O.reg.slice(-1) : O.reg); REGB.push(I.reg); REGM.push(M ? M.reg : null);
      }
    }
    const idx = (a, b) => a * (nv + 1) + b;
    // 測れなかった所は近くの値で埋め、ならす（殻の継ぎ目の段差を写さない）
    for (let pass = 0; pass < 3; pass++) {
      for (let a = 0; a <= nu; a++) for (let b = 0; b <= nv; b++) {
        if (R[idx(a, b)] !== null) continue;
        let sum = 0, n = 0;
        for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const q = R[idx(clamp(a + da, 0, nu), clamp(b + db, 0, nv))];
          if (q !== null) { sum += q; n++; }
        }
        if (n) R[idx(a, b)] = sum / n;
      }
    }
    for (let k = 0; k < R.length; k++) if (R[k] === null) R[k] = 0.02 * s;
    // 外れ値（隣の体の部分まで突き抜けた）を中央値で抑える
    {
      const R2 = R.slice();
      for (let a = 0; a <= nu; a++) for (let b = 0; b <= nv; b++) {
        const w = [];
        for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) w.push(R[idx(clamp(a + da, 0, nu), clamp(b + db, 0, nv))]);
        w.sort((x, y) => x - y);
        const med = w[4];
        if (R[idx(a, b)] > med * 1.25) R2[idx(a, b)] = med;
      }
      for (let k = 0; k < R.length; k++) R[k] = R2[k];
    }
    for (let it = 0; it < 2; it++) {
      const R2 = R.slice();
      for (let a = 0; a <= nu; a++) for (let b = 0; b <= nv; b++) {
        let sum = R[idx(a, b)] * 2, n = 2;
        for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const aa = ring ? (a + da + nu) % nu : clamp(a + da, 0, nu);
          sum += R[idx(aa, clamp(b + db, 0, nv))]; n++;
        }
        R2[idx(a, b)] = sum / n;
      }
      for (let k = 0; k < R.length; k++) R[k] = R2[k];
    }

    // 表と裏の面
    const peak = m.belly ?? 0.5;
    const bellyAt = v => {
      const w = v < peak ? v / peak : (1 - v) / (1 - peak);
      return Math.pow(Math.sin(Math.PI / 2 * clamp(w, 0, 1)), m.flat ? 0.4 : 0.8);
    };
    const thick = (m.thick ?? 0.010) * s, bulge = (m.bulge ?? 0.003) * s;
    const groove = (m.groove ?? 0.0018) * s, inset = (m.inset ?? 0.0012) * s;
    // 粗い格子で測った値を、細かい格子に写す（面をなめらかにする）
    const F = 2, fu = nu * F, fvN = nv * F;
    const fidx = (a, b) => a * (fvN + 1) + b;
    const top = [], bot = [], fD = [], regA = [], regB = [], cw = [];
    for (let A = 0; A <= fu; A++) {
      const u = A / fu;
      const a0 = Math.min(Math.floor(A / F), nu - 1), ta = A / F - a0;
      // 断面はレンズの形（まん中が厚く、ふちで 0 になって表と裏が出会う）
      const e = ring ? 1 : Math.pow(Math.max(0, Math.sin(Math.PI * u)), 0.55);
      for (let Bf = 0; Bf <= fvN; Bf++) {
        const v = Bf / fvN;
        const b0 = Math.min(Math.floor(Bf / F), nv - 1), tb = Bf / F - b0;
        const w00 = (1 - ta) * (1 - tb), w10 = ta * (1 - tb), w01 = (1 - ta) * tb, w11 = ta * tb;
        const k00 = idx(a0, b0), k10 = idx(a0 + 1, b0), k01 = idx(a0, b0 + 1), k11 = idx(a0 + 1, b0 + 1);
        const c = V3().addScaledVector(C[k00], w00).addScaledVector(C[k10], w10).addScaledVector(C[k01], w01).addScaledVector(C[k11], w11);
        const d = V3().addScaledVector(D[k00], w00).addScaledVector(D[k10], w10).addScaledVector(D[k01], w01).addScaledVector(D[k11], w11).normalize();
        const r = R[k00] * w00 + R[k10] * w10 + R[k01] * w01 + R[k11] * w11;
        const ev = ring ? Math.pow(Math.max(0, Math.sin(Math.PI * v)), 0.55) : 1;
        const ee = e * ev;
        const bl = ring ? 1 : bellyAt(v);
        let dep = inset + groove * Math.pow(1 - ee, 1.5) - bulge * ee * bl;
        if (m.bands) for (const q of m.bands) dep += 0.0035 * s * Math.exp(-(((v - q) / 0.025) ** 2)) * e;
        if (m.ubands) for (const q of m.ubands) dep += 0.004 * s * Math.exp(-(((u - q) / 0.035) ** 2)) * bl;
        // 腱のところ（両端）はやや沈め、薄くする
        const tend = m.tendons ? Math.max(smooth((m.tendons[0] - v) / 0.08), smooth((v - m.tendons[1]) / 0.08)) : 0;
        dep += 0.0015 * s * tend;
        const th = thick * ee * Math.pow(bl, 0.6) * (1 - 0.75 * tend);
        const rT = Math.max(0.002 * s, r - dep), rB = Math.max(0.001 * s, rT - th);
        top.push(c.clone().addScaledVector(d, rT));
        bot.push(c.clone().addScaledVector(d, rB));
        fD.push(d);
        const kn = idx(Math.round(A / F), Math.round(Bf / F));
        regA.push(REGA[kn]); regB.push(REGB[kn]);
        cw.push([[k00, w00], [k10, w10], [k01, w01], [k11, w11]]);
      }
    }

    // 面を張る（表と裏だけ。ふちは厚みが 0 なので壁はいらない）
    const nT = top.length;
    const posW = [...top, ...bot];
    const index = [];
    const quad = (p, q, r, t) => { index.push(p, q, r, p, r, t); };
    const ua = fu;   // 輪の筋は最後の列を最初の列につなぐ
    for (let a = 0; a < ua; a++) {
      const a1 = ring && a === fu - 1 ? 0 : a + 1;
      for (let b = 0; b < fvN; b++) {
        quad(fidx(a, b), fidx(a1, b), fidx(a1, b + 1), fidx(a, b + 1));
        quad(nT + fidx(a, b), nT + fidx(a, b + 1), nT + fidx(a1, b + 1), nT + fidx(a1, b));
      }
    }
    if (ring) {
      // 輪の筋も v の両端で厚みが 0 になるので、ふたはいらない
    }
    // 表が外を向くようにそろえる（まん中の線維の、表の面の向きと芯からの向きを比べる）
    {
      const k0 = fidx(Math.floor(fu / 2), Math.floor(fvN / 2));
      const p0 = top[k0], p1 = top[k0 + 1], p2 = top[k0 + fvN + 1];
      const fn = V3().subVectors(p2, p0).cross(V3().subVectors(p1, p0));
      const DF = fD[k0];
      if (fn.dot(DF) < 0) for (let t = 0; t < index.length; t += 3) { const q = index[t + 1]; index[t + 1] = index[t + 2]; index[t + 2] = q; }
    }

    // スキンの重み：粗い格子の点で測り、細かい点へは 4 つの角から混ぜて写す
    const coarseW = new Array(C.length).fill(undefined);
    // 重みは、その点の真上の皮膚（芯から外へ測ったときに当たった所）の重みを写す。
    // 筋肉は皮膚のすぐ下にあるので、皮膚と同じように動かせば、曲げても皮膚から飛び出さない。
    const wAt = k => {
      if (coarseW[k] !== undefined) return coarseW[k];
      const P = C[k].clone().addScaledVector(D[k], R[k]);
      // 拾う皮膚は、付け根と付く先の骨のまわりだけ（腕を下ろすと手が腿に触れるので、全身からは拾わない）
      //   付け根の側は付け根の骨のまわりだけ、付く先へ近づくにつれて付く先の骨のまわりも混ぜる
      //   （広背筋の背中の部分が、横に下ろした腕の皮膚を拾ってはがれないように）
      //   線維のどこにあるかで、付け根・途中・付く先のどの体の部分の皮膚から拾うかを決める
      const v = (k % (nv + 1)) / nv;
      let rA = REGA[k], rB = REGB[k], t;
      if (REGM[k]) {
        if (v < 0.5) { rB = REGM[k]; t = smooth((v - 0.15) / 0.2); }
        else { rA = REGM[k]; t = smooth((v - 0.65) / 0.2); }
      } else t = smooth((v - 0.3) / 0.4);
      const wa = weightsNear(P, rA);
      const wb = rB === rA ? wa : weightsNear(P, rB);
      const ws = (wa || wb) ? mixWeights(wa || wb, wb || wa, t) : null;
      coarseW[k] = ws;
      return ws;
    };
    const NV = posW.length;
    const sIdx = new Uint16Array(NV * 4), sWgt = new Float32Array(NV * 4);
    const lpos = new Float32Array(NV * 3);
    const Mx = new THREE.Matrix4(), B = new THREE.Matrix4(), L = new THREE.Matrix4();
    const vv = V3();
    for (let k = 0; k < nT; k++) {
      const acc = new Map();
      for (const [kc, w] of cw[k]) {
        if (w <= 1e-6) continue;
        const ws0 = wAt(kc);
        if (!ws0) continue;
        for (const [bi, ww] of ws0) acc.set(bi, (acc.get(bi) || 0) + ww * w);
      }
      let ws = [...acc.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
      const sum = ws.reduce((x, e2) => x + e2[1], 0) || 1;
      ws = ws.map(e2 => [e2[0], e2[1] / sum]);
      if (!ws.length) ws = [[0, 1]];
      for (const kk of [k, k + nT]) {
        Mx.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        ws.forEach(([bi, w], q) => {
          sIdx[kk * 4 + q] = bi; sWgt[kk * 4 + q] = w;
          B.fromArray(bm, bi * 16);
          for (let e = 0; e < 16; e++) Mx.elements[e] += B.elements[e] * w;
        });
        L.copy(ref.matrixWorld).multiply(ref.bindMatrixInverse).multiply(Mx).multiply(ref.bindMatrix).invert();
        vv.copy(posW[kk]).applyMatrix4(L);
        lpos[kk * 3] = vv.x; lpos[kk * 3 + 1] = vv.y; lpos[kk * 3 + 2] = vv.z;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(sIdx, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sWgt, 4));
    geo.setIndex(index);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const mesh = new THREE.SkinnedMesh(geo, muscleMaterial(m.tendon));
    mesh.bind(ref.skeleton, ref.bindMatrix);
    mesh.position.copy(ref.position); mesh.quaternion.copy(ref.quaternion); mesh.scale.copy(ref.scale);
    mesh.frustumCulled = false;
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.visible = false;
    mesh.userData.musclePart = true;
    mesh.userData.slot = slot.key;
    mesh.userData.anat = partName(m.id, { side: m.side, part: m.part });
    if (m.part) mesh.userData.anat.ja = mesh.userData.anat.ja.replace(/（(左|右)）$/, `（${m.part}・$1）`);
    mesh.name = 'muscle:' + m.id + (m.side || '');
    ref.parent.add(mesh);
    out.push(mesh);
    stats.muscles++;
  };

  // ---- 筋肉の一覧（左右） --------------------------------------------------
  for (const [sd, sx] of [['L', 1], ['R', -1]]) {
    const { T, U, N, Hd } = mk(sx);
    const S = (id, def) => build({ id, side: sd, ...def });

    // 胸・腹 ----------------------------------------------------------------
    S('pecMajor', {
      o: [T(46, ySN + 0.010 * s), T(26, ySN + 0.006 * s), T(6, ySN - 0.012 * s), T(5, ySN - 0.080 * s), T(7, yXiph - 0.004 * s), T(20, yXiph - 0.022 * s)],
      i: [U('ua', 0.20, 18), U('ua', 0.17, 10), U('ua', 0.14, 4), U('ua', 0.12, -2), U('ua', 0.10, -10), U('ua', 0.08, -18)],
      nu: 12, nv: 12, thick: 0.014, bulge: 0.004, belly: 0.35, tendons: [0, 0.88],
    });
    S('serratus', {
      o: [T(58, ySN - 0.085 * s), T(64, ySN - 0.115 * s), T(70, yXiph - 0.005 * s), T(74, yXiph - 0.035 * s)],
      i: [T(100, ySN - 0.075 * s), T(104, ySN - 0.100 * s), T(108, ySN - 0.125 * s), T(112, ySN - 0.150 * s)],
      nu: 8, nv: 8, thick: 0.006, bulge: 0.002, ubands: [0.25, 0.5, 0.75], groove: 0.003,
    });
    S('rectusAbd', {
      o: [T(3, yPubis + 0.012 * s), T(11, yPubis + 0.014 * s)],
      i: [T(4, yXiph + 0.004 * s), T(19, yXiph - 0.012 * s)],
      via: [T(3, yNavel), T(15, yNavel)],
      nu: 6, nv: 18, thick: 0.010, bulge: 0.003, belly: 0.6, bands: [0.5, 0.71, 0.88], flat: true,
    });
    S('extOblique', {
      o: [T(42, ySN - 0.105 * s), T(62, yXiph + 0.01 * s), T(80, yXiph - 0.06 * s), T(92, yCrest + 0.05 * s)],
      i: [T(21, yXiph - 0.030 * s), T(21, yNavel + 0.01 * s), T(28, yPubis + 0.055 * s), T(78, yCrest + 0.004 * s)],
      nu: 9, nv: 10, thick: 0.009, bulge: 0.003, belly: 0.55, flat: true,
    });
    // 背中 ------------------------------------------------------------------
    S('trapezius', {
      o: [N(0.95, 178), N(0.55, 178), N(0.1, 178), T(179, yC7 - 0.02 * s), T(179, ySN - 0.10 * s), T(179, ySN - 0.24 * s)],
      i: [U('ua', -0.14, 70), U('ua', -0.14, 110), U('ua', -0.12, 150), T(146, ySN - 0.025 * s), T(150, ySN - 0.05 * s), T(158, ySN - 0.085 * s)],
      nu: 12, nv: 10, thick: 0.008, bulge: 0.003, belly: 0.5, flat: true,
    });
    S('latissimus', {
      o: [T(179, ySN - 0.14 * s), T(179, ySN - 0.22 * s), T(179, yCrest + 0.04 * s), T(160, yCrest + 0.004 * s), T(130, yCrest)],
      i: [U('ua', 0.15, -95), U('ua', 0.14, -105), U('ua', 0.13, -115), U('ua', 0.12, -125), U('ua', 0.11, -135)],
      via: [T(150, ySN - 0.10 * s), T(146, ySN - 0.15 * s), T(128, yXiph - 0.01 * s), T(110, yXiph - 0.04 * s), T(98, yXiph - 0.06 * s)],
      nu: 12, nv: 14, thick: 0.009, bulge: 0.003, belly: 0.45, flat: true,
    });
    S('erector', {
      o: [T(176, ySacrum), T(166, ySacrum + 0.01 * s)],
      i: [T(176, ySN - 0.06 * s), T(162, ySN - 0.06 * s)],
      nu: 4, nv: 14, thick: 0.012, bulge: 0.002, inset: 0.0045, belly: 0.3,
    });
    S('infraspinatus', {
      o: [T(130, ySN - 0.06 * s), T(134, ySN - 0.12 * s), T(140, ySN - 0.15 * s)],
      i: [U('ua', 0.02, 150), U('ua', 0.03, 158), U('ua', 0.04, 165)],
      nu: 6, nv: 8, thick: 0.007, inset: 0.0025,
    });
    S('teresMajor', {
      o: [T(125, ySN - 0.15 * s), T(128, ySN - 0.165 * s)],
      i: [U('ua', 0.15, -150), U('ua', 0.17, -160)],
      nu: 4, nv: 8, thick: 0.008, inset: 0.002,
    });
    // 肩・腕 ----------------------------------------------------------------
    S('deltoidA', {
      o: [U('ua', -0.16, 5), U('ua', -0.16, 25), U('ua', -0.16, 45)],
      i: [U('ua', 0.44, 55), U('ua', 0.45, 62), U('ua', 0.46, 70)],
      nu: 6, nv: 10, thick: 0.012, bulge: 0.004, belly: 0.35, tendons: [0, 0.9],
    });
    S('deltoidM', {
      o: [U('ua', -0.16, 45), U('ua', -0.17, 80), U('ua', -0.16, 115)],
      i: [U('ua', 0.46, 70), U('ua', 0.47, 80), U('ua', 0.46, 90)],
      nu: 6, nv: 10, thick: 0.013, bulge: 0.005, belly: 0.35, tendons: [0, 0.9],
    });
    S('deltoidP', {
      o: [U('ua', -0.16, 115), U('ua', -0.15, 145), U('ua', -0.13, 170)],
      i: [U('ua', 0.46, 90), U('ua', 0.45, 98), U('ua', 0.44, 106)],
      nu: 6, nv: 10, thick: 0.011, bulge: 0.004, belly: 0.35, tendons: [0, 0.9],
    });
    S('biceps', {
      o: [U('ua', 0.16, -28), U('ua', 0.16, 22)],
      i: [U('fa', 0.10, -8), U('fa', 0.10, 8)],
      via: [U('ua', 0.6, -38), U('ua', 0.6, 32)],
      nu: 6, nv: 14, thick: 0.016, bulge: 0.006, belly: 0.62, tendons: [0.12, 0.85],
    });
    S('brachialis', {
      o: [U('ua', 0.5, -75), U('ua', 0.5, 75)],
      i: [U('fa', 0.08, -25), U('fa', 0.08, 25)],
      nu: 6, nv: 8, thick: 0.009, inset: 0.0035, belly: 0.55,
    });
    S('triceps', {
      o: [U('ua', 0.08, 118), U('ua', 0.06, 180), U('ua', 0.10, 238)],
      i: [U('fa', -0.04, 160), U('fa', -0.05, 180), U('fa', -0.04, 200)],
      via: [U('ua', 0.5, 110), U('ua', 0.5, 180), U('ua', 0.5, 250)],
      nu: 8, nv: 14, thick: 0.016, bulge: 0.005, belly: 0.45, tendons: [0.05, 0.78], ubands: [0.42],
    });
    S('brachiorad', {
      skinFrom: 'fa',
      o: [U('ua', 0.70, 72), U('ua', 0.70, 100)],
      i: [U('fa', 0.93, 8), U('fa', 0.93, 22)],
      via: [U('fa', 0.25, 20), U('fa', 0.25, 58)],
      nu: 4, nv: 14, thick: 0.011, bulge: 0.004, belly: 0.3, tendons: [0, 0.62],
    });
    S('flexorsFA', {
      skinFrom: 'fa',
      o: [U('ua', 1.0, -110), U('ua', 1.0, -80), U('ua', 0.98, -40)],
      i: [U('fa', 0.92, -160), U('fa', 0.94, -95), U('fa', 0.92, -25)],
      via: [U('fa', 0.3, -175), U('fa', 0.32, -100), U('fa', 0.3, -15)],
      nu: 8, nv: 14, thick: 0.012, bulge: 0.004, belly: 0.25, tendons: [0, 0.66], ubands: [0.33, 0.66],
    });
    S('extensorsFA', {
      skinFrom: 'fa',
      o: [U('ua', 0.98, 100), U('ua', 1.0, 120), U('ua', 1.0, 140)],
      i: [U('fa', 0.94, 30), U('fa', 0.95, 95), U('fa', 0.94, 165)],
      via: [U('fa', 0.3, 62), U('fa', 0.32, 110), U('fa', 0.3, 175)],
      nu: 8, nv: 14, thick: 0.011, bulge: 0.004, belly: 0.25, tendons: [0, 0.66], ubands: [0.35, 0.68],
    });
    S('thenar', {
      o: [U('hd', 0.10, 20), U('hd', 0.12, 55)],
      i: [U('hd', 0.42, 75), U('hd', 0.48, 100)],
      nu: 4, nv: 8, thick: 0.007, bulge: 0.003, inset: 0.0012,
    });
    S('hypothenar', {
      o: [U('hd', 0.12, -40), U('hd', 0.12, -75)],
      i: [U('hd', 0.85, -60), U('hd', 0.85, -95)],
      nu: 4, nv: 8, thick: 0.006, bulge: 0.002, inset: 0.0012,
    });
    // 首・頭 ----------------------------------------------------------------
    S('scm', {
      o: [T(4, ySN + 0.004 * s, 0.25), T(20, ySN + 0.006 * s, 0.25)],
      i: [Hd(0.80, -0.40, -0.40), Hd(0.86, -0.32, -0.36)],
      via: [N(0.45, 28), N(0.45, 48)],
      nu: 4, nv: 12, thick: 0.009, bulge: 0.003, tendons: [0.1, 0.92],
    });
    if (head) {
      S('temporalis', {
        o: [Hd(0.72, 0.50, 0.40), Hd(0.86, 0.48, 0.05), Hd(0.80, 0.42, -0.35)],
        i: [Hd(0.84, -0.12, 0.30), Hd(0.88, -0.10, 0.20), Hd(0.86, -0.12, 0.12)],
        nu: 8, nv: 8, thick: 0.004, bulge: 0.001, inset: 0.001, flat: true,
      });
      S('masseter', {
        o: [Hd(0.82, -0.18, 0.42), Hd(0.88, -0.18, 0.24)],
        i: [Hd(0.72, -0.62, 0.32), Hd(0.78, -0.62, 0.10)],
        nu: 4, nv: 8, thick: 0.007, bulge: 0.003, inset: 0.001,
      });
      S('frontalis', {
        o: [Hd(0.04, 0.70, 0.71), Hd(0.42, 0.62, 0.66)],
        i: [Hd(0.05, 0.12, 0.99), Hd(0.48, 0.10, 0.87)],
        nu: 5, nv: 8, thick: 0.003, bulge: 0.0005, inset: 0.0008, flat: true,
      });
      const ringAt = (dir, r1, r2, n = 14) => {
        const e = V3(dir[0], dir[1], dir[2]).normalize();
        const t1 = V3().crossVectors(e, V3(0, 1, 0)).normalize(), t2 = V3().crossVectors(t1, e).normalize();
        const ptsI = [], ptsO = [];
        for (let k = 0; k <= n; k++) {
          const a = (k / n) * Math.PI * 2;
          const di = e.clone().addScaledVector(t1, Math.cos(a) * r1).addScaledVector(t2, Math.sin(a) * r1 * 0.75).normalize();
          const dO = e.clone().addScaledVector(t1, Math.cos(a) * r2).addScaledVector(t2, Math.sin(a) * r2 * 0.75).normalize();
          ptsI.push(Hd(di.x, di.y, di.z)); ptsO.push(Hd(dO.x, dO.y, dO.z));
        }
        return { ptsI, ptsO, n };
      };
      { const r = ringAt([0.33, 0.12, 0.94], 0.10, 0.24); S('orbOculi', { o: r.ptsI, i: r.ptsO, nu: r.n, nv: 4, ring: true, thick: 0.003, bulge: 0.001, inset: 0.0008 }); }
      S('zygomaticus', {
        o: [Hd(0.62, -0.06, 0.78), Hd(0.68, -0.04, 0.73)],
        i: [Hd(0.24, -0.42, 0.88), Hd(0.28, -0.40, 0.87)],
        nu: 3, nv: 8, thick: 0.003, bulge: 0.001, inset: 0.0008,
      });
    }
    // 骨盤・脚 --------------------------------------------------------------
    S('gluteusMax', {
      o: [T(150, yCrest - 0.002 * s), T(166, ySacrum + 0.03 * s), T(177, ySacrum - 0.01 * s), T(178, yCoccyx)],
      i: [U('th', 0.12, 105), U('th', 0.18, 118), U('th', 0.24, 130), U('th', 0.30, 140)],
      via: [T(135, yHJ + 0.03 * s), T(150, yHJ - 0.005 * s), T(160, yHJ - 0.04 * s), T(165, yHJ - 0.07 * s)],
      nu: 10, nv: 12, thick: 0.022, bulge: 0.007, belly: 0.45, tendons: [0, 0.9],
    });
    S('gluteusMed', {
      o: [T(92, yCrest - 0.008 * s), T(118, yCrest), T(140, yCrest - 0.004 * s)],
      i: [U('th', -0.04, 85), U('th', -0.04, 100), U('th', -0.03, 115)],
      nu: 8, nv: 8, thick: 0.012, bulge: 0.004, belly: 0.45, inset: 0.002,
    });
    S('tfl', {
      o: [T(58, yASIS), T(70, yASIS + 0.004 * s)],
      i: [U('th', 0.28, 78), U('th', 0.28, 92)],
      nu: 4, nv: 10, thick: 0.010, bulge: 0.003, belly: 0.4, tendons: [0, 0.75],
    });
    S('sartorius', {
      o: [T(58, yASIS - 0.004 * s), T(62, yASIS - 0.008 * s)],
      i: [U('sh', 0.10, -105), U('sh', 0.10, -95)],
      via: [U('th', 0.55, -42), U('th', 0.55, -32)],
      nu: 3, nv: 18, thick: 0.007, bulge: 0.002, groove: 0.002,
    });
    S('rectusFem', {
      o: [U('th', 0.04, -8), U('th', 0.04, 10)],
      i: [U('th', 0.96, -6), U('th', 0.96, 8)],
      via: [U('th', 0.5, -20), U('th', 0.5, 22)],
      nu: 6, nv: 14, thick: 0.018, bulge: 0.006, belly: 0.5, tendons: [0.06, 0.88],
    });
    S('vastusLat', {
      o: [U('th', 0.06, 40), U('th', 0.08, 105)],
      i: [U('th', 0.96, 14), U('th', 0.94, 36)],
      via: [U('th', 0.5, 30), U('th', 0.5, 118)],
      nu: 6, nv: 14, thick: 0.017, bulge: 0.005, belly: 0.52, tendons: [0, 0.88],
    });
    S('vastusMed', {
      o: [U('th', 0.40, -40), U('th', 0.35, -75)],
      i: [U('th', 0.96, -12), U('th', 0.94, -28)],
      via: [U('th', 0.75, -28), U('th', 0.72, -78)],
      nu: 5, nv: 12, thick: 0.018, bulge: 0.006, belly: 0.72, tendons: [0, 0.9],
    });
    S('adductors', {
      o: [U('th', 0.0, -50), U('th', 0.0, -100), U('th', 0.04, -140)],
      i: [U('th', 0.65, -70), U('th', 0.68, -95), U('th', 0.70, -125)],
      nu: 8, nv: 12, thick: 0.016, bulge: 0.004, belly: 0.35, ubands: [0.5],
    });
    S('bicepsFem', {
      o: [U('th', 0.06, 150), U('th', 0.08, 172)],
      i: [U('sh', 0.04, 112), U('sh', 0.04, 126)],
      via: [U('th', 0.55, 130), U('th', 0.55, 165)],
      nu: 4, nv: 14, thick: 0.015, bulge: 0.005, belly: 0.5, tendons: [0.06, 0.86],
    });
    S('semitend', {
      o: [U('th', 0.06, 182), U('th', 0.08, 208)],
      i: [U('sh', 0.10, -140), U('sh', 0.10, -122)],
      via: [U('th', 0.55, 190), U('th', 0.55, 228)],
      nu: 4, nv: 14, thick: 0.015, bulge: 0.005, belly: 0.5, tendons: [0.06, 0.84],
    });
    S('gastroc', {
      skinFrom: 'sh',
      o: [U('sh', -0.03, 115), U('sh', -0.03, 245)],
      i: [U('sh', 0.62, 172), U('sh', 0.62, 188)],
      via: [U('sh', 0.25, 100), U('sh', 0.25, 260)],
      nu: 8, nv: 12, thick: 0.020, bulge: 0.007, belly: 0.35, tendons: [0, 0.82], ubands: [0.5],
    });
    S('soleus', {
      o: [U('sh', 0.20, 100), U('sh', 0.20, 260)],
      i: [U('sh', 0.82, 165), U('sh', 0.82, 195)],
      via: [U('sh', 0.55, 95), U('sh', 0.55, 265)],
      nu: 8, nv: 10, thick: 0.012, bulge: 0.003, inset: 0.0035, belly: 0.55,
    });
    S('achilles', {
      o: [U('sh', 0.70, 172), U('sh', 0.70, 188)],
      i: [U('ft', -0.32, 172), U('ft', -0.32, 188)],
      nu: 3, nv: 8, thick: 0.004, bulge: 0.001, tendon: true, inset: 0.001,
    });
    S('tibialisAnt', {
      o: [U('sh', 0.10, 28), U('sh', 0.10, 62)],
      i: [U('sh', 0.94, -14), U('sh', 0.94, -4)],
      via: [U('sh', 0.5, 25), U('sh', 0.5, 55)],
      nu: 4, nv: 14, thick: 0.010, bulge: 0.003, belly: 0.35, tendons: [0, 0.68],
    });
    S('peroneus', {
      o: [U('sh', 0.06, 80), U('sh', 0.06, 112)],
      i: [U('sh', 0.86, 112), U('sh', 0.86, 128)],
      nu: 4, nv: 12, thick: 0.009, bulge: 0.002, belly: 0.4, tendons: [0, 0.7],
    });
  }
  // 正中にひとつの筋（口輪筋）
  if (head) {
    const { Hd } = mk(1);
    const e = V3(0, -0.42, 0.91).normalize();
    const ptsI = [], ptsO = [];
    for (let k = 0; k <= 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const t1 = V3(1, 0, 0), t2 = V3().crossVectors(t1, e).normalize();
      const di = e.clone().addScaledVector(t1, Math.cos(a) * 0.13).addScaledVector(t2, Math.sin(a) * 0.06).normalize();
      const dO = e.clone().addScaledVector(t1, Math.cos(a) * 0.24).addScaledVector(t2, Math.sin(a) * 0.14).normalize();
      ptsI.push(Hd(di.x, di.y, di.z)); ptsO.push(Hd(dO.x, dO.y, dO.z));
    }
    build({ id: 'orbOris', side: null, o: ptsI, i: ptsO, nu: 16, nv: 4, ring: true, thick: 0.004, bulge: 0.001, inset: 0.0008 });
  }
  // ---- 深い層（筋肉と筋肉のあいだの溝の底） --------------------------------
  // 素体の表面を少し内側へ縮め、視線の奥へ 1.4cm 押しやったものを暗い筋肉の色で敷く。すき間から骨や向こう側が
  // 見えて穴に見えるのを防ぎ、筋肉の境目が「溝」として読めるようにする。頭は骨を見せるので除く。
  for (const m of skins) {
    const deep = deepLayer(m, headSet, 0.002 * s, 0.014 * s);
    if (deep) { out.push(deep); stats.deep = (stats.deep || 0) + 1; }
  }
  slot.muscleDebug = { ...stats, ms: Math.round(performance.now() - T0) };
  return out;
}

/** 素体のスキンを共有したまま、法線の内側へ inset（メートル）だけ沈めた面を作る */
function deepLayer(src, skipBones, inset, pushBack) {
  const g0 = src.geometry;
  const si = g0.attributes.skinIndex, sw = g0.attributes.skinWeight;
  if (!si || !sw) return null;
  const n = g0.attributes.position.count;
  const dom = new Array(n);
  for (let i = 0; i < n; i++) {
    let bw = -1, bi = 0;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; bi = si.getComponent(i, k); } }
    dom[i] = src.skeleton.bones[bi];
  }
  const src3 = g0.index ? g0.index.array : null;
  const tri = src3 ? src3.length / 3 : n / 3;
  const idx = [];
  for (let t = 0; t < tri; t++) {
    const a = src3 ? src3[t * 3] : t * 3, b = src3 ? src3[t * 3 + 1] : t * 3 + 1, c = src3 ? src3[t * 3 + 2] : t * 3 + 2;
    if (skipBones.has(dom[a]) && skipBones.has(dom[b]) && skipBones.has(dom[c])) continue;
    idx.push(a, b, c);
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry();
  for (const [k, v] of Object.entries(g0.attributes)) g.setAttribute(k, v);
  for (const [k, v] of Object.entries(g0.morphAttributes)) g.morphAttributes[k] = v;
  g.morphTargetsRelative = g0.morphTargetsRelative;
  g.setIndex(idx);
  g.boundingSphere = g0.boundingSphere;
  // メッシュの座標の 1 がワールドで何メートルか（Mixamo は cm のことがある）
  // シェーダーの中の位置（スキンをかけた後・モデル行列の前）の 1 は、ワールドでメッシュの倍率ぶん
  src.updateWorldMatrix(true, false);
  const ws = new THREE.Vector3().setFromMatrixScale(src.matrixWorld).x || 1;
  const mat = new THREE.MeshStandardMaterial({ color: 0x7e352e, roughness: 0.7, metalness: 0 });
  const u = { value: inset / ws };
  const push = { value: pushBack };
  mat.userData.inset = u;
  mat.userData.push = push;
  // ① 法線の内側へ少し沈める（輪郭が筋肉より外へ出ないように）
  // ② 視線の奥へ押しやる（画面上の位置は変えずに、近くにある筋肉の方を必ず手前に描く）
  mat.onBeforeCompile = sh => {
    sh.uniforms.deepInset = u;
    sh.uniforms.deepPush = push;
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'uniform float deepInset;\nuniform float deepPush;\nvoid main() {')
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>\n  transformed -= normalize(objectNormal) * deepInset;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  mvPosition.xyz += normalize(mvPosition.xyz) * deepPush;\n  gl_Position = projectionMatrix * mvPosition;');
  };
  mat.customProgramCacheKey = () => 'posit-deep-muscle';
  const mesh = new THREE.SkinnedMesh(g, mat);
  mesh.bind(src.skeleton, src.bindMatrix);
  mesh.bindMode = src.bindMode;
  mesh.position.copy(src.position); mesh.quaternion.copy(src.quaternion); mesh.scale.copy(src.scale);
  if (src.morphTargetInfluences) {
    mesh.morphTargetInfluences = src.morphTargetInfluences;     // 体つきのモーフも同じ値で動く
    mesh.morphTargetDictionary = src.morphTargetDictionary;
  }
  mesh.frustumCulled = false;
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.visible = false;
  mesh.userData.musclePart = true;
  mesh.userData.deepMuscle = true;
  mesh.userData.sharedGeo = true;
  mesh.name = 'muscle:deep';
  src.parent.add(mesh);
  return mesh;
}
