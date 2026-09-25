// viewer.js — three.js の描画まわり（ライティング・モデル読み込み・関節操作）
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { JOINTS, JOINT_BY_KEY, JOINT_GROUPS, mapBones, clampAngles } from './bones.js';

/** 例外を握りつぶさず、どの処理で落ちたかを画面に出す */
function guard(label, fn) {
  try {
    return fn();
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    const stack = err && err.stack ? String(err.stack).split('\n').slice(0, 4).join('\n') : '';
    if (window.__positShowError) window.__positShowError('[' + label + '] ' + msg + (stack ? '\n' + stack : ''));
    return undefined;
  }
}

const DEG = Math.PI / 180;
const AX = new THREE.Vector3(1, 0, 0);
const AY = new THREE.Vector3(0, 1, 0);
const AZ = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);

/** モデルスロット: 素体 / 筋肉 / 骨格 */
export const SLOTS = [
  { key: 'skin',   name: '素体' },
  { key: 'muscle', name: '筋肉' },
  { key: 'bone',   name: '骨格' },
];

/** 表示モード */
export const VIEW_MODES = [
  { key: 'skin',    name: '素体',   show: ['skin'] },
  { key: 'muscle',  name: '筋肉',   show: ['muscle'] },
  { key: 'bone',    name: '骨格',   show: ['bone'] },
  { key: 'overlay', name: '重ねて', show: ['skin', 'muscle', 'bone'] },
];

export const MATERIAL_MODES = [
  { key: 'original', name: '元の質感' },
  { key: 'clay',     name: '粘土' },
  { key: 'plaster',  name: '石膏' },
];

class Slot {
  constructor(key) {
    this.key = key;
    this.root = null;
    this.fileName = '';
    this.meshes = [];
    this.skeleton = null;
    this.boneMap = {};
    this.boneToJoint = new Map();
    this.restQuats = new Map();
    this.originalMaterials = new Map();
    this.restLowestY = 0;
    this.boneParts = [];
  }
  get loaded() { return !!this.root; }
  get posable() { return !!this.skeleton && Object.keys(this.boneMap).length > 0; }
}

export class Viewer {
  constructor(canvas) {
    this.canvas = canvas;
    this.slots = {};
    for (const s of SLOTS) this.slots[s.key] = new Slot(s.key);

    this.viewMode = 'skin';
    this.materialMode = 'clay';
    this.skinOpacity = 1.0;
    this.boneViewOn = false;
    this.limitsEnabled = true;

    this.angles = {};
    for (const j of JOINTS) this.angles[j.key] = { x: 0, y: 0, z: 0 };
    this.selected = null;

    this.onSelect = () => {};
    this.onStatus = () => {};
    this.onSlotsChanged = () => {};

    this._initScene();
    this._initLights();
    this._initGround();
    this._initMarker();
    this._bindPointer();
    this._loop();
  }

  // ---- 初期化 -------------------------------------------------------------

  _initScene() {
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x15181d);
    this.scene = scene;

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    if ('environmentIntensity' in scene) scene.environmentIntensity = 0.55;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
    camera.position.set(0, 1.15, 3.4);
    this.camera = camera;

    const controls = new OrbitControls(camera, this.canvas);
    controls.target.set(0, 0.95, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.4;
    controls.maxDistance = 14;
    controls.maxPolarAngle = Math.PI * 0.95;
    controls.update();
    this.controls = controls;

    this.container = new THREE.Group();
    scene.add(this.container);

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _initLights() {
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 14;
    key.shadow.camera.left = -2.2;
    key.shadow.camera.right = 2.2;
    key.shadow.camera.top = 2.8;
    key.shadow.camera.bottom = -0.6;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 3;
    this.scene.add(key);
    this.scene.add(key.target);
    this.keyLight = key;

    const fill = new THREE.DirectionalLight(0xdfe7ff, 0.35);
    fill.position.set(-2.5, 1.6, -2.0);
    this.scene.add(fill);
    this.fillLight = fill;

    this.lightAzimuth = 35;
    this.lightElevation = 45;
    this.setLightDirection(35, 45);
  }

  _initGround() {
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.ShadowMaterial({ opacity: 0.42 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.receiveShadow = true;
    this.scene.add(shadowPlane);

    const grid = new THREE.GridHelper(20, 40, 0x3a4250, 0x262c36);
    grid.material.transparent = true;
    grid.material.opacity = 0.5;
    grid.position.y = 0.001;
    this.scene.add(grid);
    this.grid = grid;
  }

  _initMarker() {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.85, depthTest: false })
    );
    marker.renderOrder = 999;
    marker.visible = false;
    this.scene.add(marker);
    this.marker = marker;
  }

  _resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
  }

  _loop() {
    let reported = false;
    const tick = () => {
      requestAnimationFrame(tick);
      try {
        this.controls.update();
        const bone = this.selected ? this._boneForJoint(this.selected) : null;
        if (bone) bone.getWorldPosition(this.marker.position);
        this.renderer.render(this.scene, this.camera);
        if (!this._firstFrame) { this._firstFrame = true; if (window.__positMark) window.__positMark('初回描画'); }
      } catch (err) {
        if (!reported) {
          reported = true;
          if (window.__positMark) window.__positMark('描画で失敗');
          const msg = err && err.message ? err.message : String(err);
          const stack = err && err.stack ? String(err.stack).split('\n').slice(0, 4).join('\n') : '';
          if (window.__positShowError) window.__positShowError('[描画ループ] ' + msg + (stack ? '\n' + stack : ''));
        }
      }
    };
    tick();
  }

  // ---- スロット -----------------------------------------------------------

  /** 基準になるスロット（接地・関節対応の判定に使う） */
  get primarySlot() {
    if (this.slots.skin.posable) return this.slots.skin;
    for (const s of SLOTS) {
      if (this.slots[s.key].posable) return this.slots[s.key];
    }
    for (const s of SLOTS) {
      if (this.slots[s.key].loaded) return this.slots[s.key];
    }
    return null;
  }

  _boneForJoint(jointKey) {
    const p = this.primarySlot;
    if (p && p.boneMap[jointKey]) return p.boneMap[jointKey];
    for (const s of SLOTS) {
      const b = this.slots[s.key].boneMap[jointKey];
      if (b) return b;
    }
    return null;
  }

  /** 関節キー -> その関節を持つスロットが1つでもあるか */
  hasJoint(jointKey) { return !!this._boneForJoint(jointKey); }

  slotInfo() {
    return SLOTS.map(s => {
      const slot = this.slots[s.key];
      return {
        key: s.key, name: s.name,
        loaded: slot.loaded, posable: slot.posable,
        fileName: slot.fileName,
        boneCount: slot.skeleton ? slot.skeleton.bones.length : 0,
        jointCount: Object.keys(slot.boneMap).length,
      };
    });
  }

  // ---- モデル読み込み -----------------------------------------------------

  async loadURL(url, slotKey = 'skin') {
    const clean = url.split('?')[0];
    const ext = (clean.split('.').pop() || '').toLowerCase();
    const name = clean.split('/').pop() || url;
    this.onStatus('読み込み中…');
    if (ext === 'fbx') {
      const obj = await new FBXLoader().loadAsync(url);
      this._setupModel(obj, slotKey, name);
    } else {
      const gltf = await new GLTFLoader().loadAsync(url);
      this._setupModel(gltf.scene, slotKey, name);
    }
  }

  async loadFile(file, slotKey = 'skin') {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const buf = await file.arrayBuffer();
    this.onStatus('読み込み中…');
    if (ext === 'fbx') {
      this._setupModel(new FBXLoader().parse(buf, ''), slotKey, file.name);
    } else {
      const gltf = await new GLTFLoader().parseAsync(buf, '');
      this._setupModel(gltf.scene, slotKey, file.name);
    }
  }

  clearSlot(slotKey) {
    const slot = this.slots[slotKey];
    this._disposeSlot(slot);
    this.applyViewMode(this.viewMode);
    this._ground();
    this.onSlotsChanged();
    this._reportStatus();
  }

  _disposeSlot(slot) {
    for (const p of slot.boneParts) if (p.parent) p.parent.remove(p);
    slot.boneParts = [];
    if (slot.root) {
      this.container.remove(slot.root);
      slot.root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    slot.root = null;
    slot.fileName = '';
    slot.meshes = [];
    slot.skeleton = null;
    slot.boneMap = {};
    slot.boneToJoint = new Map();
    slot.restQuats = new Map();
    slot.originalMaterials = new Map();
  }

  _setupModel(root, slotKey, fileName) {
    const slot = this.slots[slotKey];
    this._disposeSlot(slot);

    slot.root = root;
    slot.fileName = fileName || '';

    root.traverse(o => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
        o.userData.slot = slotKey;
        slot.meshes.push(o);
        slot.originalMaterials.set(o, o.material);
      }
      if (o.isSkinnedMesh && !slot.skeleton) slot.skeleton = o.skeleton;
    });

    this.container.add(root);
    guard('大きさの正規化', () => this._normalizeScale(root));

    if (slot.skeleton) {
      const { map } = mapBones(slot.skeleton.bones);
      slot.boneMap = map;
      slot.boneToJoint = new Map();
      for (const [k, b] of Object.entries(map)) slot.boneToJoint.set(b, k);
      for (const b of slot.skeleton.bones) slot.restQuats.set(b, b.quaternion.clone());
      slot.restLowestY = this._lowestBoneY(slot);
      guard('簡易骨格の生成', () => this._buildBoneView(slot));
    }

    this.applyAll();
    this.applyMaterialMode(this.materialMode);
    this.applyViewMode(this.viewMode);
    this.setSkinOpacity(this.skinOpacity);
    this._reportStatus();
    this.onSlotsChanged();
  }

  _reportStatus() {
    const p = this.primarySlot;
    if (!p) { this.onStatus('モデルが読み込まれていません'); return; }
    if (!p.skeleton) { this.onStatus('スキン情報なし（表示のみ・ポーズ不可）'); return; }
    const loaded = SLOTS.filter(s => this.slots[s.key].loaded).map(s => s.name).join('・');
    this.onStatus(`${loaded}／ボーン ${p.skeleton.bones.length} 本・関節 ${Object.keys(p.boneMap).length}/${JOINTS.length}`);
  }

  _normalizeScale(root) {
    root.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const h = size.y;
    if (!isFinite(h) || h <= 1e-6) return;
    root.scale.multiplyScalar(1.7 / h);
    root.updateWorldMatrix(true, true);

    const box2 = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box2.min.y;
    root.updateWorldMatrix(true, true);
  }

  _lowestBoneY(slot) {
    if (!slot.skeleton) return 0;
    const v = new THREE.Vector3();
    let min = Infinity;
    for (const b of slot.skeleton.bones) {
      b.getWorldPosition(v);
      if (v.y < min) min = v.y;
    }
    return isFinite(min) ? min : 0;
  }

  frameModel() {
    this.controls.target.set(0, 0.95, 0);
    this.camera.position.set(0, 1.15, 3.4);
    this.controls.update();
  }

  // ---- 簡易骨格（モデル内蔵のボーンから作る） -------------------------------

  _buildBoneView(slot) {
    for (const p of slot.boneParts) if (p.parent) p.parent.remove(p);
    slot.boneParts = [];
    if (!slot.skeleton) return;

    const boneMat = new THREE.MeshStandardMaterial({
      color: 0xeae3d2, roughness: 0.5, metalness: 0.0,
    });
    const jointMat = new THREE.MeshStandardMaterial({
      color: 0xb8c4d0, roughness: 0.35, metalness: 0.05,
    });

    for (const b of slot.skeleton.bones) {
      const kids = b.children.filter(c => c.isBone);
      let maxLen = 0;
      for (const c of kids) {
        const len = c.position.length();
        if (len < 1e-6) continue;
        maxLen = Math.max(maxLen, len);
        const r = len * 0.14;
        const cyl = Math.max(len - 2 * r, len * 0.05);
        const seg = new THREE.Mesh(new THREE.CapsuleGeometry(r, cyl, 4, 10), boneMat);
        seg.position.copy(c.position).multiplyScalar(0.5);
        seg.quaternion.setFromUnitVectors(UP, c.position.clone().normalize());
        seg.castShadow = true;
        seg.receiveShadow = true;
        seg.visible = false;
        seg.userData.jointBone = b;
        seg.userData.slot = slot.key;
        b.add(seg);
        slot.boneParts.push(seg);
      }
      if (maxLen > 0) {
        const ball = new THREE.Mesh(new THREE.SphereGeometry(maxLen * 0.17, 12, 10), jointMat);
        ball.castShadow = true;
        ball.visible = false;
        ball.userData.jointBone = b;
        ball.userData.slot = slot.key;
        b.add(ball);
        slot.boneParts.push(ball);
      }
    }
    this._refreshBoneView();
  }

  _refreshBoneView() {
    const p = this.primarySlot;
    for (const s of SLOTS) {
      const slot = this.slots[s.key];
      const on = this.boneViewOn && slot === p;
      for (const part of slot.boneParts) part.visible = on;
    }
  }

  setBoneViewOn(on) {
    this.boneViewOn = on;
    this._refreshBoneView();
  }

  // ---- 表示モード ---------------------------------------------------------

  applyViewMode(modeKey) {
    this.viewMode = modeKey;
    const mode = VIEW_MODES.find(m => m.key === modeKey) || VIEW_MODES[0];
    // 指定のスロットが空なら、読み込まれているものへ自動で落とす
    let show = mode.show.filter(k => this.slots[k].loaded);
    if (!show.length) {
      const first = SLOTS.find(s => this.slots[s.key].loaded);
      show = first ? [first.key] : [];
    }
    for (const s of SLOTS) {
      const slot = this.slots[s.key];
      const on = show.includes(s.key);
      if (slot.root) slot.root.visible = on;
    }
    this._refreshBoneView();
  }

  setSkinOpacity(v) {
    this.skinOpacity = v;
    const slot = this.slots.skin;
    const solid = v >= 0.99;
    for (const m of slot.meshes) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (!mat) continue;
        mat.transparent = !solid;
        mat.opacity = v;
        mat.depthWrite = solid;
        mat.needsUpdate = true;
      }
      m.castShadow = solid;
    }
  }

  applyMaterialMode(mode) {
    this.materialMode = mode;
    const slot = this.slots.skin;
    for (const m of slot.meshes) {
      if (mode === 'original') {
        const orig = slot.originalMaterials.get(m);
        if (orig) m.material = orig;
        continue;
      }
      const preset = mode === 'clay'
        ? { color: 0xd6cec2, roughness: 0.72 }
        : { color: 0xeeeae4, roughness: 0.9 };
      if (!m.userData.studioMat) m.userData.studioMat = {};
      if (!m.userData.studioMat[mode]) {
        m.userData.studioMat[mode] = new THREE.MeshStandardMaterial({
          color: preset.color, roughness: preset.roughness, metalness: 0.0, envMapIntensity: 0.9,
        });
      }
      m.material = m.userData.studioMat[mode];
    }
    this.setSkinOpacity(this.skinOpacity);
  }

  // ---- 関節操作 -----------------------------------------------------------

  setAngle(jointKey, axis, deg) {
    const a = this.angles[jointKey];
    if (!a) return;
    a[axis] = deg;
    if (this.limitsEnabled) Object.assign(a, clampAngles(jointKey, a));
    this._applyJoint(jointKey);
    this._ground();
  }

  getAngles(jointKey) { return this.angles[jointKey] || { x: 0, y: 0, z: 0 }; }

  setLimitsEnabled(on) {
    this.limitsEnabled = on;
    if (!on) return;
    for (const j of JOINTS) Object.assign(this.angles[j.key], clampAngles(j.key, this.angles[j.key]));
    this.applyAll();
  }

  /** 1つの関節角度を、読み込まれている全スロットへ同時に適用する */
  _applyJoint(jointKey) {
    const a = this.angles[jointKey];
    const qx = new THREE.Quaternion().setFromAxisAngle(AX, a.x * DEG);
    const qy = new THREE.Quaternion().setFromAxisAngle(AY, a.y * DEG);
    const qz = new THREE.Quaternion().setFromAxisAngle(AZ, a.z * DEG);
    const delta = qx.multiply(qz).multiply(qy);   // Posit と同じ合成順 qx·qz·qy
    for (const s of SLOTS) {
      const slot = this.slots[s.key];
      const bone = slot.boneMap[jointKey];
      if (!bone) continue;
      const rest = slot.restQuats.get(bone);
      if (!rest) continue;
      bone.quaternion.copy(rest).multiply(delta);
    }
  }

  applyAll() {
    for (const j of JOINTS) this._applyJoint(j.key);
    this._ground();
  }

  resetPose() {
    for (const j of JOINTS) this.angles[j.key] = { x: 0, y: 0, z: 0 };
    this.applyAll();
  }

  resetSelected() {
    if (!this.selected) return;
    this.angles[this.selected] = { x: 0, y: 0, z: 0 };
    this._applyJoint(this.selected);
    this._ground();
  }

  mirrorPose() {
    const swap = (aKey, bKey) => {
      const a = this.angles[aKey], b = this.angles[bKey];
      this.angles[aKey] = { x: b.x, y: -b.y, z: -b.z };
      this.angles[bKey] = { x: a.x, y: -a.y, z: -a.z };
    };
    swap('shoulderL', 'shoulderR');
    swap('upperArmL', 'upperArmR');
    swap('forearmL', 'forearmR');
    swap('handL', 'handR');
    swap('thighL', 'thighR');
    swap('shinL', 'shinR');
    swap('footL', 'footR');
    for (const k of ['hips', 'spine', 'chest', 'neck', 'head']) {
      this.angles[k].y *= -1;
      this.angles[k].z *= -1;
    }
    this.applyAll();
  }

  _ground() {
    const p = this.primarySlot;
    if (!p || !p.skeleton) return;
    guard('接地', () => {
      this.container.position.y = 0;
      this.container.updateWorldMatrix(true, true);
      this.container.position.y = p.restLowestY - this._lowestBoneY(p);
    });
  }

  // ---- 選択 ---------------------------------------------------------------

  _bindPointer() {
    let startX = 0, startY = 0, moved = false;
    const el = this.canvas;
    el.addEventListener('pointerdown', e => { startX = e.clientX; startY = e.clientY; moved = false; });
    el.addEventListener('pointermove', e => {
      if (Math.abs(e.clientX - startX) > 6 || Math.abs(e.clientY - startY) > 6) moved = true;
    });
    el.addEventListener('pointerup', e => {
      if (!moved) guard('タップ選択', () => this._pick(e.clientX, e.clientY));
    });
  }

  _visibleTargets() {
    const out = [];
    for (const s of SLOTS) {
      const slot = this.slots[s.key];
      if (!slot.root || !slot.root.visible) continue;
      for (const m of slot.meshes) if (m.visible) out.push(m);
      for (const p of slot.boneParts) if (p.visible) out.push(p);
    }
    return out;
  }

  _pick(clientX, clientY) {
    const targets = this._visibleTargets();
    if (!targets.length) return;
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    for (const m of targets) {
      if (!m.isSkinnedMesh) continue;
      try {
        m.computeBoundingBox?.();
        m.computeBoundingSphere?.();
      } catch (err) {
        if (window.__positShowError) {
          window.__positShowError('[境界の計算] ' + (m.name || '(名前なし)') + ': '
            + (err && err.message ? err.message : err));
        }
      }
    }
    let hits = [];
    try {
      hits = ray.intersectObjects(targets, false);
    } catch (err) {
      // スキン付きメッシュのレイキャストが落ちる場合は、簡易骨格のパーツだけで拾い直す
      const parts = targets.filter(t => t.userData && t.userData.jointBone);
      if (window.__positShowError) {
        window.__positShowError('[レイキャスト] ' + (err && err.message ? err.message : err)
          + (parts.length ? '\n簡易骨格のパーツで代替します。' : '\n「簡易骨格を重ねる」を ON にすると選択できます。'));
      }
      try { hits = ray.intersectObjects(parts, false); } catch (e2) { hits = []; }
    }
    if (!hits.length) { this.select(null); return; }
    this.select(this._jointFromHit(hits[0]));
  }

  _jointFromHit(hit) {
    const obj = hit.object;
    // 簡易骨格のパーツを叩いた場合
    if (obj.userData && obj.userData.jointBone) {
      return this._walkToJoint(obj.userData.jointBone, obj.userData.slot);
    }
    if (!obj.isSkinnedMesh || !obj.skeleton || !hit.face) return null;
    const si = obj.geometry.attributes.skinIndex;
    const sw = obj.geometry.attributes.skinWeight;
    if (!si || !sw) return null;
    const tally = new Map();
    for (const vi of [hit.face.a, hit.face.b, hit.face.c]) {
      for (let k = 0; k < 4; k++) {
        const idx = si.getComponent(vi, k);
        const w = sw.getComponent(vi, k);
        if (w > 0) tally.set(idx, (tally.get(idx) || 0) + w);
      }
    }
    let best = -1, bestW = -1;
    for (const [idx, w] of tally) if (w > bestW) { bestW = w; best = idx; }
    if (best < 0) return null;
    return this._walkToJoint(obj.skeleton.bones[best], obj.userData.slot);
  }

  /** 指など未対応のボーンは、親をたどって対応済みの関節に寄せる */
  _walkToJoint(bone, slotKey) {
    const slot = this.slots[slotKey] || this.primarySlot;
    if (!slot) return null;
    let b = bone, guard = 0;
    while (b && guard++ < 24) {
      const key = slot.boneToJoint.get(b);
      if (key) return key;
      b = b.parent;
    }
    return null;
  }

  select(jointKey) {
    this.selected = jointKey;
    this.marker.visible = !!(jointKey && this._boneForJoint(jointKey));
    this.onSelect(jointKey);
  }

  // ---- ライト・カメラ -----------------------------------------------------

  setLightDirection(azimuthDeg, elevationDeg) {
    this.lightAzimuth = azimuthDeg;
    this.lightElevation = elevationDeg;
    const a = azimuthDeg * DEG, e = elevationDeg * DEG, r = 5;
    this.keyLight.position.set(
      r * Math.cos(e) * Math.sin(a),
      r * Math.sin(e),
      r * Math.cos(e) * Math.cos(a)
    );
    this.keyLight.target.position.set(0, 0.9, 0);
    this.keyLight.target.updateMatrixWorld();
  }

  setLightIntensity(v) { this.keyLight.intensity = v; }
  setFillIntensity(v) { this.fillLight.intensity = v; }
  setShadowSoftness(v) { this.keyLight.shadow.radius = v; }
  setExposure(v) { this.renderer.toneMappingExposure = v; }
  setEnvIntensity(v) { if ('environmentIntensity' in this.scene) this.scene.environmentIntensity = v; }
  setGridVisible(on) { this.grid.visible = on; }
  setLens(mm) {
    this.camera.fov = 2 * Math.atan(12 / mm) * (180 / Math.PI);
    this.camera.updateProjectionMatrix();
  }
}

export const THREE_REVISION = THREE.REVISION;
export { JOINTS, JOINT_BY_KEY, JOINT_GROUPS };
