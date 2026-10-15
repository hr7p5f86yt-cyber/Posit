// jointDots.js — 人形の関節に出す「印」（どこを触れば動かせるかが見て分かる）
//
// ・丸 … 腕・脚の関節。四角 … 体幹（腰・腹・胸・首・頭）。二重の丸 … 手・足（押して動かすと腕・脚ごとついてくる）
// ・選んでいる関節は橙色。体の向こう側にある関節は薄く出す
// ・印は画面の上の HTML の点（触る判定はビューアがまとめて行うので、点そのものは指を通す）
// ・印をタップ → その関節を選ぶ。印を押したまま動かす → その関節が指の方へ曲がる（手・足は腕・脚ごと引っ張る）

import * as THREE from 'three';

// 重なったときに残す順（先ほど残る）。選んでいる関節はいつも残す
const PRIORITY = ['handL', 'handR', 'footL', 'footR', 'forearmL', 'forearmR', 'shinL', 'shinR',
  'upperArmL', 'upperArmR', 'thighL', 'thighR', 'head', 'hips', 'chest', 'neck', 'spine', 'shoulderL', 'shoulderR'];

export class JointDots {
  /**
   * @param {object} viewer
   * @param {string[]} keys  印を出す関節
   */
  constructor(viewer, keys) {
    this.v = viewer;
    this.keys = keys;
    this.enabled = true;
    this.layer = document.createElement('div');
    this.layer.id = 'jointDots';
    document.body.appendChild(this.layer);
    this.dots = new Map();
    for (const k of keys) {
      const d = document.createElement('div');
      d.className = 'jdot'
        + (/^(hips|spine|chest|neck|head)$/.test(k) ? ' trunk' : '')
        + (/^(hand|foot)[LR]$/.test(k) ? ' pull' : '');
      d.hidden = true;
      this.layer.appendChild(d);
      this.dots.set(k, { el: d, x: 0, y: 0, depth: 0, far: false, on: false, cls: '' });
    }
    this._tmp = new THREE.Vector3();
    // 固定した手・足の印（錠前）。関節の印を出していなくても出す
    this.pinLayer = document.createElement('div');
    this.pinLayer.id = 'lockPins';
    document.body.appendChild(this.pinLayer);
    this.pins = new Map();
    for (const k of ['handL', 'handR', 'footL', 'footR']) {
      const el = document.createElement('div');
      el.className = 'jpin';
      el.innerHTML = '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/></svg>';
      el.hidden = true;
      this.pinLayer.appendChild(el);
      this.pins.set(k, el);
    }
  }

  _updatePins() {
    const v = this.v, slot = v.primarySlot;
    const show = !v._uiHidden && slot && slot.skeleton && v.locks && v.locks.size;
    this.pinLayer.style.display = show ? '' : 'none';
    if (!show) return;
    const rect = v.canvas.getBoundingClientRect();
    for (const [k, el] of this.pins) {
      const b = slot.boneMap[k];
      if (!v.locks.has(k) || !b) { el.hidden = true; continue; }
      const q = b.getWorldPosition(new THREE.Vector3()).project(v.camera);
      if (q.z > 1) { el.hidden = true; continue; }
      const x = rect.left + (q.x + 1) / 2 * rect.width, y = rect.top + (1 - q.y) / 2 * rect.height;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.hidden = false;
    }
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (!on) for (const d of this.dots.values()) { d.el.hidden = true; d.on = false; }
  }

  _show() {
    const v = this.v;
    return this.enabled && !v._uiHidden && v.pickMode !== 'anatomy' && v.jointDragEnabled
      && v.primarySlot && v.primarySlot.skeleton;
  }

  /** 毎フレーム: 印を関節の位置へ */
  update() {
    this._updatePins();
    const v = this.v;
    const show = this._show();
    this.layer.style.display = show ? '' : 'none';
    if (!show) { for (const d of this.dots.values()) d.on = false; return; }
    const slot = v.primarySlot, cam = v.camera;
    const rect = v.canvas.getBoundingClientRect();
    // 体の中心（胸と腰の間）より向こうにある関節は薄く
    const W = k => (slot.boneMap[k] ? slot.boneMap[k].getWorldPosition(new THREE.Vector3()) : null);
    const ch = W('chest') || W('spine'), hp = W('hips');
    const center = ch && hp ? ch.add(hp).multiplyScalar(0.5) : (ch || hp);
    const camDir = cam.getWorldDirection(new THREE.Vector3());
    const cDepth = center ? center.clone().sub(cam.position).dot(camDir) : 0;
    // 印が重なるときは、よく使う方を残す（引いて小さく見ているとき、胸のまわりに印が固まらないように）
    const placed = [];
    const minGap = 10;
    const order = v.selected && this.dots.has(v.selected) ? [v.selected, ...PRIORITY.filter(k => k !== v.selected)] : PRIORITY;
    for (const k of order) {
      const d = this.dots.get(k);
      if (!d) continue;
      const b = slot.boneMap[k];
      if (!b) { if (d.on) { d.el.hidden = true; d.on = false; } continue; }
      const p = b.getWorldPosition(this._tmp);
      const depth = p.clone().sub(cam.position).dot(camDir);
      const q = p.clone().project(cam);
      const x = rect.left + (q.x + 1) / 2 * rect.width, y = rect.top + (1 - q.y) / 2 * rect.height;
      const inside = q.z < 1 && depth > 0 && x > rect.left - 20 && x < rect.right + 20 && y > rect.top - 20 && y < rect.bottom + 20;
      if (!inside) { if (d.on) { d.el.hidden = true; d.on = false; } continue; }
      const crowded = k !== v.selected && placed.some(p2 => Math.hypot(p2[0] - x, p2[1] - y) < minGap);
      if (crowded) { if (d.on) { d.el.hidden = true; d.on = false; } continue; }
      placed.push([x, y]);
      d.x = x; d.y = y; d.depth = depth;
      d.far = center ? depth > cDepth + 0.06 : false;
      const cls = (k === v.selected ? ' sel' : '') + (d.far ? ' far' : '');
      if (cls !== d.cls) {
        d.el.classList.toggle('sel', k === v.selected);
        d.el.classList.toggle('far', d.far);
        d.cls = cls;
      }
      d.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      if (!d.on) { d.el.hidden = false; d.on = true; }
    }
  }

  /** 画面の点に近い印（手前のものを優先）。{ key, d } か null */
  hit(clientX, clientY, pointerType) {
    if (!this._show()) return null;
    const r = pointerType === 'mouse' ? 12 : 22;
    let best = null;
    for (const [k, d] of this.dots) {
      if (!d.on) continue;
      const dist = Math.hypot(clientX - d.x, clientY - d.y);
      if (dist > r) continue;
      // 向こう側の印は、手前の印より選ばれにくく
      const score = dist + (d.far ? 8 : 0) + d.depth * 2;
      if (!best || score < best.score) best = { key: k, d: dist, score };
    }
    return best;
  }
}

// ===== jointDots.js ここまで =====
