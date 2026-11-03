// rotateRings.js — 選んだ関節のまわりに出す「回転の輪」（3軸）
//
// 赤 = X（前後に曲げる）、緑 = Y（ひねる）、青 = Z（左右に倒す）。スライダの 3 本と同じ順・同じ色です。
// 関節の角度は D = Rx·Rz·Ry（親の向きに合わせて運んだ、基準姿勢の世界の軸）なので、
//   X の輪の軸 = G·X、Z の輪の軸 = G·Rx·Z、Y の輪の軸 = G·Rx·Rz·Y   （G = 親の今の向き·基準姿勢の親の向き⁻¹）
// にすると、どの輪を回しても、その軸の角度だけが変わる（スライダ 1 本を動かすのと同じ）。
// 輪は画面の上でいつも同じ大きさ。奥の半分は暗く・薄く描いて、手前と奥が分かるようにする。

import * as THREE from 'three';
import { JOINT_BY_KEY, wrapDeg } from './bones.js';

const DEG = Math.PI / 180;
const AX = new THREE.Vector3(1, 0, 0);
const AY = new THREE.Vector3(0, 1, 0);
const AZ = new THREE.Vector3(0, 0, 1);

export const RING_COLORS = { x: '#ff5468', y: '#8fd44a', z: '#4d8dff' };
// 輪の大きさ（画面の半径に対する割合）。少しずつ違えて、重なっても押し分けやすくする
const SIZE = { x: 1.0, y: 0.8, z: 1.13 };
const LIMIT_IDX = { x: [0, 1], y: [2, 3], z: [4, 5] };

const VERT = `
varying vec3 vW;
varying vec3 vC;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vC = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FRAG = `
uniform vec3 color;
uniform float opacity;
varying vec3 vW;
varying vec3 vC;
void main() {
  // the far half (behind the center as seen from the camera) is darker and fainter
  float d = dot(normalize(vW - vC), normalize(cameraPosition - vC));
  float f = smoothstep(-0.1, 0.1, d);
  gl_FragColor = vec4(mix(color * 0.5, color, f), opacity * mix(0.38, 1.0, f));
}`;

export class RotateRings {
  constructor(viewer) {
    this.v = viewer;
    this.enabled = true;
    this.drag = null;
    this.onChange = () => {};
    const g = new THREE.Group();
    g.visible = false;
    this.rings = {};
    for (const ax of ['x', 'y', 'z']) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { color: { value: new THREE.Color(RING_COLORS[ax]) }, opacity: { value: 0.95 } },
        vertexShader: VERT, fragmentShader: FRAG,
        transparent: true, depthTest: false, depthWrite: false,
      });
      const m = new THREE.Mesh(new THREE.TorusGeometry(SIZE[ax], 0.024, 8, 160), mat);
      m.renderOrder = 1000 + (ax === 'y' ? 2 : ax === 'x' ? 1 : 0);
      m.frustumCulled = false;
      m.castShadow = false;
      m.raycast = () => {};
      g.add(m);
      this.rings[ax] = m;
    }
    viewer.scene.add(g);
    this.group = g;
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (!on) { this.drag = null; this.group.visible = false; }
  }

  /** 選んだ関節の中心と、3 つの輪の軸（世界） */
  frame(key) {
    const slot = this.v.primarySlot;
    const b = slot && key && slot.boneMap[key];
    if (!b || !slot.neutralParent) return null;
    const np = slot.neutralParent.get(b);
    if (!np) return null;
    const Pw = b.parent ? b.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
    const G = Pw.multiply(np.clone().invert());
    const a = this.v.angles[key] || { x: 0, y: 0, z: 0 };
    const qx = new THREE.Quaternion().setFromAxisAngle(AX, a.x * DEG);
    const qz = new THREE.Quaternion().setFromAxisAngle(AZ, a.z * DEG);
    const Gx = G.clone().multiply(qx);
    return {
      center: b.getWorldPosition(new THREE.Vector3()),
      x: AX.clone().applyQuaternion(G).normalize(),
      z: AZ.clone().applyQuaternion(Gx).normalize(),
      y: AY.clone().applyQuaternion(Gx.multiply(qz)).normalize(),
    };
  }

  _rect() { return this.v.canvas.getBoundingClientRect(); }
  _toScreen(p, rect) {
    const q = p.clone().project(this.v.camera);
    return new THREE.Vector2(rect.left + (q.x + 1) / 2 * rect.width, rect.top + (1 - q.y) / 2 * rect.height);
  }

  /** 画面の上での輪の半径（px） */
  _radiusPx() {
    const ins = this.v.insets || { top: 0, right: 0, bottom: 0, left: 0 };
    const r = this._rect();
    const w = Math.max(80, r.width - ins.left - ins.right), h = Math.max(80, r.height - ins.top - ins.bottom);
    return Math.max(54, Math.min(110, Math.min(w, h) * 0.18));
  }

  /** 中心の位置で、世界の 1 が画面の何 px か */
  _pxPerUnit(c, rect) {
    const cam = this.v.camera;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const d = cam.position.distanceTo(c);
    const s0 = this._toScreen(c, rect), s1 = this._toScreen(c.clone().addScaledVector(up, d * 0.05), rect);
    return Math.max(1e-6, s0.distanceTo(s1) / (d * 0.05));
  }

  _visibleFor(key) {
    const v = this.v;
    return this.enabled && key && !v._uiHidden && v.pickMode !== 'anatomy' && v.jointDragEnabled;
  }

  /** 毎フレーム: 輪を関節に合わせる */
  update() {
    const key = this.v.selected;
    const f = this._visibleFor(key) ? this.frame(key) : null;
    if (!f) { this.group.visible = false; return; }
    const rect = this._rect();
    const R = this._radiusPx() / this._pxPerUnit(f.center, rect);
    this.group.visible = true;
    this.group.position.copy(f.center);
    this.group.scale.setScalar(R);
    this._R = R;
    for (const ax of ['x', 'y', 'z']) {
      const m = this.rings[ax];
      m.quaternion.setFromUnitVectors(AZ, f[ax]);
      const on = this.drag ? this.drag.axis === ax : true;
      m.material.uniforms.opacity.value = this.drag ? (on ? 1 : 0.22) : 0.95;
    }
  }

  /** 輪の上の点（軸 ax、角 t） */
  _ringPoint(f, ax, R, t) {
    const a = f[ax];
    const u = Math.abs(a.y) < 0.9 ? new THREE.Vector3(0, 1, 0).cross(a).normalize() : new THREE.Vector3(1, 0, 0).cross(a).normalize();
    const w = a.clone().cross(u).normalize();
    return f.center.clone().addScaledVector(u, Math.cos(t) * R * SIZE[ax]).addScaledVector(w, Math.sin(t) * R * SIZE[ax]);
  }

  /** 画面の点に近い輪（なければ null） */
  hit(clientX, clientY, pointerType) {
    const key = this.v.selected;
    if (!this._visibleFor(key)) return null;
    this.v.camera.updateMatrixWorld();
    const f = this.frame(key);
    if (!f) return null;
    const rect = this._rect();
    const R = this._radiusPx() / this._pxPerUnit(f.center, rect);
    const cam = this.v.camera.position;
    const toCam = cam.clone().sub(f.center);
    const pt = new THREE.Vector2(clientX, clientY);
    const thr = pointerType === 'mouse' ? 12 : 24;
    let best = null;
    for (const ax of ['x', 'y', 'z']) {
      for (let i = 0; i < 120; i++) {
        const P = this._ringPoint(f, ax, R, (i / 120) * Math.PI * 2);
        const front = P.clone().sub(f.center).dot(toCam) >= 0;
        const d = this._toScreen(P, rect).distanceTo(pt) + (front ? 0 : 7);
        if (d < thr && (!best || d < best.d)) best = { d, axis: ax, P };
      }
    }
    return best;
  }

  /** 輪をつかむ */
  begin(h, clientX, clientY) {
    const key = this.v.selected;
    const f = this.frame(key);
    if (!f) return false;
    this.drag = {
      key, axis: h.axis, a: f[h.axis].clone(),
      r0: h.P.clone().sub(f.center),               // つかんだ所（中心から）
      start: (this.v.angles[key] || { x: 0, y: 0, z: 0 })[h.axis],
      total: 0, px: clientX, py: clientY,
    };
    return true;
  }

  /**
   * 輪を回す。戻り値は新しい角度（度）。
   * 指が動いた量を、つかんだ点が「いま」ある所での輪の接線（画面の上の向き）に写して、回す角度にする。
   * 点は回るたびに輪に沿って動くので、正面を向いた輪はぐるっと回せ、横を向いた（細い）輪は接線に沿って押すだけで回る。
   */
  move(clientX, clientY) {
    const drag = this.drag;
    if (!drag) return null;
    const slot = this.v.primarySlot;
    const b = slot && slot.boneMap[drag.key];
    if (!b) return null;
    const rect = this._rect();
    const c = b.getWorldPosition(new THREE.Vector3());
    const r = drag.r0.clone().applyAxisAngle(drag.a, drag.total);
    const P = c.clone().add(r);
    const t = drag.a.clone().cross(r);              // +1 ラジアン回したときの動き（世界）
    const eps = 0.05;
    const s0 = this._toScreen(P, rect), s1 = this._toScreen(P.clone().addScaledVector(t, eps), rect);
    const ts = s1.sub(s0).divideScalar(eps);        // 1 ラジアンで何 px 動くか（向き付き）
    const Rpx = this._radiusPx() * SIZE[drag.axis];
    const L2 = Math.max(ts.lengthSq(), (0.35 * Rpx) * (0.35 * Rpx));
    const dx = clientX - drag.px, dy = clientY - drag.py;
    drag.px = clientX; drag.py = clientY;
    // 1 回の動きで回しすぎない（細い輪の端で急に回らないように）
    const dth = Math.max(-0.5, Math.min(0.5, (dx * ts.x + dy * ts.y) / L2));
    drag.total += dth;
    let val = drag.start + drag.total / DEG;
    const j = JOINT_BY_KEY[drag.key];
    if (this.v.limitsEnabled && j) {
      const [lo, hi] = LIMIT_IDX[drag.axis];
      const cl = Math.max(j.limits[lo], Math.min(j.limits[hi], val));
      // 可動域の端で止めたら、つかんだ点も端に留める（戻すとすぐ戻り始める）
      if (cl !== val) { drag.total = (cl - drag.start) * DEG; val = cl; }
    } else val = wrapDeg(val);
    val = Math.round(val * 10) / 10;
    const a = { ...(this.v.angles[drag.key] || { x: 0, y: 0, z: 0 }) };
    a[drag.axis] = val;
    this.v.angles[drag.key] = a;
    this.v.applyAll();
    this.onChange(drag.key, drag.axis, val);
    return val;
  }

  end() {
    const d = this.drag;
    this.drag = null;
    return d;
  }
}

// ===== rotateRings.js ここまで =====
