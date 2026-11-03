// props.js — 小物（椅子・スツール・台・箱・棒・壁・ボール）
//
// ・置く: 種類を選ぶと、人形の近くに置く（椅子・スツールは、座っている人形ならお尻の下へ、座面の高さも合わせる）
// ・動かす: 小物を押したまま動かす。床に置く物（椅子・台・箱・壁）は床の上を滑り、棒・ボールは画面の面の中で動く
// ・回す: 選ぶと出る輪を回す（床に置く物は縦の軸だけ、棒・ボールは 3 軸）
// ・手で持つ: 「右手で持つ」「左手で持つ」で、手をいちばん近い所へ寄せて、手と小物をつなぐ
//     棒・ボール … 手に付いて動く（手や腕を動かすと小物がついてくる）。両手で持つと、もう一方の手もついてくる
//     椅子・台・箱・壁 … 小物の側に手を固定する（小物を動かすと手がついてくる。手を引っ張ると面の上を滑る）
//   小物は人形の 1 体目にだけつなぐ

import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// 棒を握る所: 手首から指の付け根までの長さに対する割合（指の向き）と、手のひらからの深さ（m）
let GRIP_A = 0.55, GRIP_P = 0.02;
export function setGripPoint(a, p) { GRIP_A = a; GRIP_P = p; }

export const PROP_TYPES = [
  { key: 'chair', name: '椅子', grounded: true },
  { key: 'stool', name: 'スツール', grounded: true },
  { key: 'table', name: '台', grounded: true },
  { key: 'box', name: '箱', grounded: true },
  { key: 'wall', name: '壁', grounded: true },
  { key: 'stick', name: '棒', grounded: false },
  { key: 'ball', name: 'ボール', grounded: false },
];
const TYPE = Object.fromEntries(PROP_TYPES.map(t => [t.key, t]));

// 形（小物の座標。床の中心が原点、+z が前）。box: 中心 c・大きさ s / cyl: 縦の円柱（中心 c・半径 r・高さ h）/ sph: 球 / rod: y 軸の棒
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
    case 'table': {
      const h = p.h, w = 1.0 * s, d = 0.6 * s, t = 0.04, leg = 0.05;
      const out = [{ k: 'box', c: [0, h - t / 2, 0], s: [w, t, d] }];
      for (const x of [-1, 1]) for (const z of [-1, 1]) out.push({ k: 'box', c: [x * (w / 2 - 0.06), (h - t) / 2, z * (d / 2 - 0.06)], s: [leg, h - t, leg] });
      return out;
    }
    case 'box': { const a = 0.4 * s; return [{ k: 'box', c: [0, a / 2, 0], s: [a, a, a] }]; }
    case 'wall': return [{ k: 'box', c: [0, 1.2 * s, 0], s: [2.0 * s, 2.4 * s, 0.06] }];
    case 'stick': return [{ k: 'rod', c: [0, 0, 0], r: 0.016, h: 1.2 * s }];
    case 'ball': return [{ k: 'sph', c: [0, 0, 0], r: 0.11 * s }];
  }
  return [];
}

function geometryOf(sh) {
  if (sh.k === 'box') return new THREE.BoxGeometry(...sh.s);
  if (sh.k === 'cyl' || sh.k === 'rod') return new THREE.CylinderGeometry(sh.r, sh.r, sh.h, sh.k === 'rod' ? 16 : 32);
  return new THREE.SphereGeometry(sh.r, 32, 20);
}

// 形の表面でいちばん近い点と、外向きの向き（小物の座標で）
function closestOn(sh, q) {
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
  // 円柱（cyl は縦・rod も縦）: 横の面か上下の面
  const d = q.clone().sub(c), hh = sh.h / 2;
  const radial = V(d.x, 0, d.z), rl = radial.length();
  const y = Math.max(-hh, Math.min(hh, d.y));
  const rn = rl > 1e-6 ? radial.clone().divideScalar(rl) : V(1, 0, 0);
  const side = { p: V(rn.x * sh.r, y, rn.z * sh.r).add(c), n: rn };
  if (Math.abs(d.y) > hh && rl < sh.r) return { p: V(d.x, Math.sign(d.y) * hh, d.z).add(c), n: V(0, Math.sign(d.y), 0) };
  return side;
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
    const it = { id: ++this._seq, type, name: T.name, grounded: T.grounded, params: { size: 1, h: type === 'table' ? 0.72 : 0.45 }, group, meshes: [], grips: [] };
    // 置く場所: 人形の前（腰の向き）
    const hips = slot && slot.boneMap.hips;
    const hp = hips ? hips.getWorldPosition(V()) : V(0, 0.9, 0);
    const fwd = hips ? V(0, 0, 1).applyQuaternion(hips.getWorldQuaternion(new THREE.Quaternion())) : V(0, 0, 1);
    fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1); fwd.normalize();
    const side = V(fwd.z, 0, -fwd.x);   // 人形の左
    const yaw = Math.atan2(fwd.x, fwd.z);
    group.quaternion.setFromAxisAngle(V(0, 1, 0), yaw);
    const sit = type === 'chair' || type === 'stool' ? this._seatUnderBody() : null;
    if (sit) {
      it.params.h = Math.max(0.2, Math.min(0.9, sit.h));
      group.position.set(sit.x, 0, sit.z);
    } else if (type === 'chair' || type === 'stool') {
      // 立っているとき: 人形の左横に、同じ向きで置く（座らせるときは椅子を動かして、ポーズの「座る」を当てる）
      group.position.copy(hp).addScaledVector(side, 0.7); group.position.y = 0;
    } else if (type === 'wall') {
      group.position.copy(hp).addScaledVector(fwd, -0.45); group.position.y = 0;
    } else if (type === 'stick') {
      group.position.copy(hp).addScaledVector(side, 0.45).addScaledVector(fwd, 0.15); group.position.y = 0.6;
    } else if (type === 'ball') {
      group.position.copy(hp).addScaledVector(fwd, 0.5); group.position.y = 0.11;
    } else {
      group.position.copy(hp).addScaledVector(fwd, type === 'table' ? 0.55 : 0.6); group.position.y = 0;
    }
    this.v.scene.add(group);
    this.items.push(it);
    this._build(it);
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
    this.items = this.items.filter(x => x !== it);
    if (this.selected === it) this.select(null);
    this.onChange();
  }

  clear() { for (const it of [...this.items]) this.remove(it); }

  /** 自分で置いた小物を隠す（クロッキーの間）。ポーズに付いた小物（auto）はそのまま */
  setHidden(on) {
    this.hidden = !!on;
    for (const it of this.items) it.group.visible = !on || it.auto;
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

  clearAuto() { for (const it of this.items.filter(x => x.auto)) this.remove(it); }

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
        g.position.copy(ctr); g.position.y -= (d.type === 'box' ? 0.2 * it.params.size : 0);
      }
      this._build(it);
      g.updateWorldMatrix(true, true);
      it.group.visible = true;
      for (const k of (d.grips || []).map(sw).sort((a, b) => (/^foot/.test(b) ? 1 : 0) - (/^foot/.test(a) ? 1 : 0))) this.grip(k, it, true);
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
    for (const sh of it.shapes) {
      const m = new THREE.Mesh(geometryOf(sh), this.selected === it ? this.matSel : this.mat);
      m.position.set(...sh.c);
      m.castShadow = true; m.receiveShadow = true;
      m.userData.propItem = it;
      it.group.add(m); it.meshes.push(m);
    }
    it.radius = this._radius(it);
  }

  _radius(it) {
    const b = new THREE.Box3();
    for (const sh of it.shapes) {
      const c = V(...sh.c);
      const e = sh.k === 'box' ? V(...sh.s).multiplyScalar(0.5) : sh.k === 'sph' ? V(sh.r, sh.r, sh.r) : V(sh.r, sh.h / 2, sh.r);
      b.expandByPoint(c.clone().sub(e)); b.expandByPoint(c.clone().add(e));
    }
    it.center = b.getCenter(V());
    return b.getSize(V()).length() / 2;
  }

  /** 大きさ（椅子・スツール・台は座面・天板の高さ）を変える。dir = +1 / -1 */
  resize(dir, it = this.selected) {
    if (!it) return;
    const p = it.params;
    if (it.type === 'chair' || it.type === 'stool' || it.type === 'table') p.h = Math.max(0.2, Math.min(1.1, Math.round((p.h + dir * 0.02) * 100) / 100));
    else p.size = Math.max(0.4, Math.min(2.5, Math.round((p.size + dir * 0.1) * 10) / 10));
    this._build(it);
    // 手でつないでいたら、新しい形に付け直す
    for (const g of [...it.grips]) this.grip(g.key, it, true);
    this.onChange();
  }

  sizeLabel(it = this.selected) {
    if (!it) return '';
    if (it.type === 'chair' || it.type === 'stool') return `座面 ${Math.round(it.params.h * 100)}cm`;
    if (it.type === 'table') return `高さ ${Math.round(it.params.h * 100)}cm`;
    return `×${it.params.size.toFixed(1)}`;
  }

  // ---- 選ぶ ---------------------------------------------------------------
  select(it) {
    if (this.selected === it) { this._syncRings(); return; }
    const prev = this.selected;
    this.selected = it;
    for (const x of [prev, it]) if (x) for (const m of x.meshes) m.material = x === this.selected ? this.matSel : this.mat;
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
    const ms = this.items.filter(it => it.group.visible).flatMap(it => it.meshes);
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
    this._driveHands(it);
  }

  /** 床より下へは入れない。床に置く物は、床の近く（3cm）まで下ろしたら床にぴったり置く */
  _keepAboveFloor(it) {
    const p = it.group.position;
    if (it.grounded) { if (p.y < 0.03) p.y = 0; return; }
    if (it.type === 'ball') { p.y = Math.max(0.11 * it.params.size, p.y); return; }
    // 棒: 下の端が床より下へ行かないように
    const a = V(0, 1, 0).applyQuaternion(it.group.quaternion);
    const half = 0.6 * it.params.size * Math.abs(a.y);
    p.y = Math.max(half + 0.016, p.y);
  }

  pointerUp(e) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (!d.moved && d.mode === 'move') this.select(d.it);
    if (d.moved) this.onChange();
  }

  // ---- 手で持つ・手足を置く ------------------------------------------------
  //   つなぐ所 g = { key: 'handR' | 'handL' | 'footR' | 'footL', rel: 小物から見た手（足）の位置と向き }
  //   どこにつなぐかは決めておかず、押したときの手・足にいちばん近い所（ポーズによって変わる）
  _limbRT(key) {
    const b = this.v.primarySlot.boneMap[key];
    return new THREE.Matrix4().compose(b.getWorldPosition(V()), b.getWorldQuaternion(new THREE.Quaternion()), V(1, 1, 1));
  }
  _propRT(it) { return new THREE.Matrix4().compose(it.group.position, it.group.quaternion, V(1, 1, 1)); }
  static keyOf(k) { return k.length === 1 ? 'hand' + k : k; }

  gripOf(key) { key = Props.keyOf(key); for (const it of this.items) { const g = it.grips.find(x => x.key === key); if (g) return { it, g }; } return null; }

  /**
   * 手・足を小物のいちばん近い所へ寄せて、つなぐ。keepShape: 手の形を変えない。
   * 届かなければ 'far'（何も変えない）
   */
  grip(key, it = this.selected, keepShape = false) {
    key = Props.keyOf(key);
    const v = this.v, slot = v.primarySlot;
    if (!it || !slot || !slot.boneMap[key]) return false;
    const cur = this.gripOf(key);
    if (cur) cur.it.grips = cur.it.grips.filter(g => g.key !== key);
    if (/^foot/.test(key)) return this._placeFoot(key, it);
    const side = key.slice(-1);
    const f = v._handFrame(slot, side);
    if (!f) return false;
    const fg = slot.fingers && slot.fingers[side];
    const mid = fg && fg.middle && fg.middle[1];
    const L = mid ? mid.getWorldPosition(V()).distanceTo(f.origin) : 0.09;
    const sgn = side === 'L' ? 1 : -1;
    const PC = f.origin.clone().addScaledVector(f.along, L * 0.9).addScaledVector(f.palmar, 0.02);
    // 棒・ボールをまだだれも持っていなければ、小物の方を手の中へ動かす（手は今の形のまま）
    if (!it.grounded && !it.grips.length) {
      if (it.type === 'stick') {
        const Q = f.origin.clone().addScaledVector(f.along, L * GRIP_A).addScaledVector(f.palmar, GRIP_P);
        it.group.quaternion.setFromUnitVectors(V(0, 1, 0), f.radial.clone());
        // 持つ所: 指定がなければ棒の真ん中（it.holdAt: 棒の中心からの距離、+ は親指の側）
        it.group.position.copy(Q).addScaledVector(f.radial, -(it.holdAt || 0));
      } else {
        const r = 0.11 * it.params.size;
        it.group.position.copy(f.origin).addScaledVector(f.along, L * 0.9).addScaledVector(f.palmar, r + 0.03);
      }
      it.group.updateWorldMatrix(true, true);
      if (!keepShape && this.onHandShape) this.onHandShape(side, it.type === 'stick' ? 'grip' : 'claw');
      it.grips.push({ key, rel: this._propRT(it).invert().multiply(this._limbRT(key)) });
      this.onChange();
      return true;
    }
    it.group.updateWorldMatrix(true, true);
    const inv = it.group.matrixWorld.clone().invert();
    const q = PC.clone().applyMatrix4(inv);
    let best = null;
    for (const sh of it.shapes) {
      const r = closestOn(sh, q);
      const d = r.p.distanceTo(q);
      if (!best || d < best.d) best = { ...r, d, sh };
    }
    if (!best) return false;
    const toW = p => p.clone().applyMatrix4(it.group.matrixWorld);
    const nW = best.n.clone().transformDirection(it.group.matrixWorld);
    let along, radial, palmar, wrist, shape;
    if (best.sh.k === 'rod') {
      // 棒: 親指の側（radial）を棒の向きに。棒は握ったこぶしの中を通す
      const a = V(0, 1, 0).applyQuaternion(it.group.quaternion);
      const ctr = V(...best.sh.c).applyMatrix4(it.group.matrixWorld);
      const t = Math.max(-best.sh.h / 2 + 0.05, Math.min(best.sh.h / 2 - 0.05, PC.clone().sub(ctr).dot(a)));
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
      shape = best.sh.k === 'sph' ? 'claw' : 'flat';
    }
    const M0 = new THREE.Matrix4().makeBasis(f.along, f.radial, f.palmar);
    const M1 = new THREE.Matrix4().makeBasis(along, radial, palmar);
    const R = new THREE.Quaternion().setFromRotationMatrix(M1.multiply(M0.clone().transpose()));
    const newQ = R.multiply(slot.boneMap[key].getWorldQuaternion(new THREE.Quaternion()));
    const saved = JSON.parse(JSON.stringify(v.angles));
    const savedShape = { ...v.handShape };
    if (!keepShape && this.onHandShape) this.onHandShape(side, shape);
    for (let i = 0; i < 3; i++) { v.pull.solve(key, wrist, newQ); v.applyAll(); }
    if (slot.boneMap[key].getWorldPosition(V()).distanceTo(wrist) > 0.04) {
      for (const k in saved) v.angles[k] = saved[k];
      v.applyAll();
      if (savedShape[side] !== undefined && savedShape[side] !== v.handShape[side]) v.applyHandShape(side, savedShape[side] || '');
      return 'far';
    }
    it.grips.push({ key, rel: this._propRT(it).invert().multiply(this._limbRT(key)) });
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
    for (const sh of it.shapes) {
      if (sh.k === 'rod') continue;
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
    it.grips.push({ key, rel: this._propRT(it).invert().multiply(this._limbRT(key)) });
    this.onChange();
    return true;
  }

  release(it = this.selected, key = null) {
    if (!it) return;
    key = key && Props.keyOf(key);
    it.grips = key ? it.grips.filter(g => g.key !== key) : [];
    this.onChange();
  }

  /** 小物を動かした: つないだ手・足を小物について行かせる */
  _driveHands(it) {
    if (!it.grips.length) return;
    const v = this.v, PR = this._propRT(it);
    this._busy = true;
    try {
      // 足を先に（体の高さが決まってから手）
      for (const g of [...it.grips].sort((a, b) => (/^foot/.test(b.key) ? 1 : 0) - (/^foot/.test(a.key) ? 1 : 0))) {
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
      if (!it.grips.length || (this.drag && this.drag.it === it)) continue;
      let lead = null;
      if (!it.grounded) {
        const hands = it.grips.filter(g => /^hand/.test(g.key));
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
        for (const g of it.grips) {
          if (g === lead || g.key === dragKey) continue;
          const W = PR.clone().multiply(g.rel);
          const p = V(), q = new THREE.Quaternion(); W.decompose(p, q, V());
          const b = slot.boneMap[g.key];
          const dp = b.getWorldPosition(V()).distanceTo(p);
          const dq = b.getWorldQuaternion(new THREE.Quaternion()).angleTo(q);
          if (dp > 0.003 || dq > 0.05) { v.pull.solve(g.key, p, q); moved = true; }
        }
        if (moved) v.applyAll();
      } finally { this._busy = false; }
    }
  }

  /** 手・足を引っ張り終えた: 床に置く物につないだ手足は、面の上の新しい所へ付け直す */
  handDragEnd(key) {
    if (!/^(hand|foot)[LR]$/.test(key || '')) return;
    const gp = this.gripOf(key);
    if (gp && gp.it.grounded) this.grip(key, gp.it, true);
  }
}
// ===== props.js ここまで =====
