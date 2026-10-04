// lightBall.js — 画面右上の「光の玉」。光がどちらから当たっているかを、
// いま見ている向き（画面）を基準に見せ、指でなぞって向きを変えられるようにする。
//
//  ・玉の陰影 … いまのライトで球を照らしたときの見え方（明暗の境目がそのまま分かる）
//  ・黄色い点 … 光の来る方向。点から玉の中心へ向かう矢印が光の進む向き
//  ・内側の円 … 手前（カメラ側）から当たる光
//  ・外側の輪 … 奥から当たる光（逆光）。輪のいちばん外が真後ろ
//  ・タップ   … 強さとプリセットの小窓を開く
import * as THREE from 'three';

const DEG = Math.PI / 180;
const SIZE = 104;         // CSS ピクセル
const R_OUT = 40;         // 外側の輪（真後ろ）
const R_IN = 27;          // 内側の円（真横）

/** 方位・高さ（世界）→ 光の来る向き（世界、単位ベクトル） */
export function dirFromAzEl(az, el) {
  const a = az * DEG, e = el * DEG;
  return new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));
}

/** 光の来る向き（世界）→ 方位・高さ */
export function azElFromDir(d) {
  const el = Math.asin(Math.max(-1, Math.min(1, d.y))) / DEG;
  let az = Math.atan2(d.x, d.z) / DEG;
  if (Math.abs(Math.cos(el * DEG)) < 1e-4) az = 0;
  return { az, el };
}

/** 画面から見た光の向きを、ことばで（「右上・手前から」など） */
export function describeLight(v) {
  const th = Math.acos(Math.max(-1, Math.min(1, v.z))) / DEG;   // 0 = 真正面（カメラの位置）から
  const h = Math.hypot(v.x, v.y);
  let where = '';
  if (h > 0.26) {
    const ang = Math.atan2(v.y, v.x) / DEG;   // 0 = 右、90 = 上
    const names = ['右', '右上', '上', '左上', '左', '左下', '下', '右下'];
    where = names[(Math.round(((ang % 360) + 360) % 360 / 45)) % 8];
  }
  if (th < 25) return '正面（順光）';
  if (th > 155) return '真後ろ（逆光）';
  if (th > 112) return (where ? where + '・' : '') + '奥から（逆光ぎみ）';
  if (th > 68) return (where || '') + (where ? 'から（真横ぎみ）' : '真横から');
  return (where ? where + '・' : '') + '手前から';
}

export class LightBall {
  /**
   * @param {HTMLElement} wrap  #lightBall
   * @param {object} viewer
   * @param {{onDirection:(az:number, el:number)=>void, onTap:()=>void, onDragState:(on:boolean)=>void}} cb
   */
  constructor(wrap, viewer, cb) {
    this.wrap = wrap;
    this.viewer = viewer;
    this.cb = cb;
    this.canvas = wrap.querySelector('canvas');
    this.tip = wrap.querySelector('.tip');
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.canvas.width = SIZE * dpr;
    this.canvas.height = SIZE * dpr;
    this.canvas.style.width = SIZE + 'px';
    this.canvas.style.height = SIZE + 'px';
    this.ctx = this.canvas.getContext('2d');
    // 玉の陰影は小さな画像に描いてから拡大する（毎フレーム描いても軽い）
    this.shadeN = Math.round(R_IN * 2 * dpr * 0.7);
    this.shade = document.createElement('canvas');
    this.shade.width = this.shade.height = this.shadeN;
    this.sctx = this.shade.getContext('2d');
    this.img = this.sctx.createImageData(this.shadeN, this.shadeN);
    this._last = '';
    this._dragging = false;
    this._bind();
    const loop = () => { this.draw(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  /** いまのライトの向き（カメラから見た向き、単位ベクトル。z が正ならカメラ側） */
  viewDir() {
    const v = this.viewer;
    const d = dirFromAzEl(v.lightAzimuth, v.lightElevation);
    const qi = v.camera.quaternion.clone().invert();
    return d.applyQuaternion(qi);
  }

  /** 玉の上の位置（中心からの px、上が +y）→ 光の向き（カメラから見た向き） */
  _posToView(px, py) {
    const rho = Math.hypot(px, py);
    const phi = Math.atan2(py, px);
    let th;
    if (rho <= R_IN) th = (rho / R_IN) * 90;
    else th = 90 + Math.min(1, (rho - R_IN) / (R_OUT - R_IN)) * 90;
    th = Math.min(178, th) * DEG;
    return new THREE.Vector3(Math.sin(th) * Math.cos(phi), Math.sin(th) * Math.sin(phi), Math.cos(th));
  }

  _viewToPos(v) {
    const th = Math.acos(Math.max(-1, Math.min(1, v.z))) / DEG;
    const phi = Math.atan2(v.y, v.x);
    const rho = th <= 90 ? (th / 90) * R_IN : R_IN + ((th - 90) / 90) * (R_OUT - R_IN);
    return { x: Math.cos(phi) * rho, y: Math.sin(phi) * rho, back: th > 90 };
  }

  /** カメラから見た向きで光を置く */
  setFromView(vd) {
    const w = vd.clone().applyQuaternion(this.viewer.camera.quaternion).normalize();
    let { az, el } = azElFromDir(w);
    el = Math.max(-60, Math.min(88, el));
    this.cb.onDirection(Math.round(az), Math.round(el));
  }

  _bind() {
    const c = this.canvas;
    let start = null, moved = false, pid = null;
    const local = e => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left - r.width / 2, y: -(e.clientY - r.top - r.height / 2) };
    };
    c.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();
      pid = e.pointerId;
      try { c.setPointerCapture(pid); } catch (err) { /* 続行 */ }
      start = { x: e.clientX, y: e.clientY, t: performance.now() };
      moved = false;
    });
    c.addEventListener('pointermove', e => {
      if (start === null || e.pointerId !== pid) return;
      if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) return;
      if (!moved) { moved = true; this._dragging = true; this.cb.onDragState(true); this.wrap.classList.add('drag'); }
      const p = local(e);
      this.setFromView(this._posToView(p.x, p.y));
    });
    const end = e => {
      if (start === null || (e && e.pointerId !== pid)) return;
      const wasTap = !moved && performance.now() - start.t < 450;
      start = null;
      if (moved) {
        this._dragging = false;
        this.cb.onDragState(false);
        setTimeout(() => this.wrap.classList.remove('drag'), 1200);
      }
      if (wasTap) this.cb.onTap();
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }

  /** 変わったときだけ描き直す */
  draw() {
    const v = this.viewer;
    if (!v || !v.camera) return;
    const q = v.camera.quaternion;
    const key = [q.x, q.y, q.z, q.w, v.lightAzimuth, v.lightElevation,
      v.keyLight.intensity, v.fillLight.intensity, v.scene.environmentIntensity]
      .map(n => (+n).toFixed(3)).join(',');
    if (key === this._last) return;
    this._last = key;
    const L = this.viewDir();
    const F = v.fillLight.position.clone().normalize().applyQuaternion(q.clone().invert());
    const kI = v.keyLight.intensity, fI = v.fillLight.intensity;
    const env = v.scene.environmentIntensity != null ? v.scene.environmentIntensity : 0.5;

    // 球の陰影（ACES に近い、明るいところが飽和するトーンカーブで）
    const N = this.shadeN, d = this.img.data;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = (i + 0.5) / N * 2 - 1, y = 1 - (j + 0.5) / N * 2;
        const rr = x * x + y * y, o = (j * N + i) * 4;
        if (rr > 1) { d[o + 3] = 0; continue; }
        const z = Math.sqrt(1 - rr);
        const lam = Math.max(0, x * L.x + y * L.y + z * L.z);
        const fl = Math.max(0, x * F.x + y * F.y + z * F.z);
        const lin = 0.30 * (kI * lam + fI * fl) + 0.42 * env * (0.6 + 0.4 * y);
        const t = lin / (lin + 0.6) * 1.35;
        const g = Math.round(Math.max(0, Math.min(1, t)) ** (1 / 1.15) * 236 + 10);
        d[o] = g; d[o + 1] = g; d[o + 2] = Math.min(255, g + 6);
        d[o + 3] = rr > 0.94 ? Math.round((1 - rr) / 0.06 * 255) : 255;
      }
    }
    this.sctx.putImageData(this.img, 0, 0);

    const ctx = this.ctx, s = this.dpr, cx = SIZE / 2, cy = SIZE / 2;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    // 外側の輪（奥＝逆光の領域）
    ctx.beginPath(); ctx.arc(cx, cy, R_OUT, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,24,30,0.72)'; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.stroke();
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.arc(cx, cy, (R_IN + R_OUT) / 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.stroke();
    ctx.setLineDash([]);
    // 球
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.shade, cx - R_IN, cy - R_IN, R_IN * 2, R_IN * 2);

    // 光の点と矢印
    const p = this._viewToPos(L);
    const sx = cx + p.x, sy = cy - p.y;
    const ang = Math.atan2(cy - sy, cx - sx);
    const dist = Math.hypot(cx - sx, cy - sy);
    const sun = p.back ? '#ffcf5a' : '#ffd84d';
    if (dist > 9) {
      const ex = cx - Math.cos(ang) * 6, ey = cy - Math.sin(ang) * 6;
      const bx = sx + Math.cos(ang) * 8, by = sy + Math.sin(ang) * 8;
      ctx.strokeStyle = p.back ? 'rgba(255,207,90,0.55)' : 'rgba(255,216,77,0.95)';
      ctx.lineWidth = 2.2;
      if (p.back) ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(ex + Math.cos(ang) * 1.5, ey + Math.sin(ang) * 1.5);
      ctx.lineTo(ex - Math.cos(ang - 0.5) * 7, ey - Math.sin(ang - 0.5) * 7);
      ctx.lineTo(ex - Math.cos(ang + 0.5) * 7, ey - Math.sin(ang + 0.5) * 7);
      ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(sx, sy, 6.5, 0, Math.PI * 2);
    if (p.back) {
      ctx.fillStyle = 'rgba(20,24,30,0.9)'; ctx.fill();
      ctx.lineWidth = 2.2; ctx.strokeStyle = sun; ctx.stroke();
    } else {
      ctx.fillStyle = sun; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.stroke();
    }
    // 光の筋（太陽らしく）
    ctx.strokeStyle = sun; ctx.lineWidth = 1.4;
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * 8.5, sy + Math.sin(a) * 8.5);
      ctx.lineTo(sx + Math.cos(a) * 11, sy + Math.sin(a) * 11);
      ctx.stroke();
    }

    if (this.tip) this.tip.textContent = `${describeLight(L)}・強さ ${kI.toFixed(1)}`;
  }
}
