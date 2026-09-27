// viewer.js — three.js の描画まわり（ライティング・モデル読み込み・関節操作）
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { JOINTS, JOINT_BY_KEY, JOINT_GROUPS, mapBones, clampAngles } from './bones.js';
import { parseSpec } from './poses.js';
import { buildSkeletonView } from './skeletonView.js';

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

/** 親から子の順に並べた関節。ポーズはこの順で適用する */
const APPLY_ORDER = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'shoulderL', 'upperArmL', 'forearmL', 'handL',
  'shoulderR', 'upperArmR', 'forearmR', 'handR',
  'thighL', 'shinL', 'footL',
  'thighR', 'shinR', 'footR',
];

/** 基準姿勢（A字）での各骨の向き。s はキャラクターの左が world +X なら +1 */
function restTargets(s) {
  const n = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
  return [
    ['hips', 'spine', n(0, 1, 0)],
    ['spine', 'chest', n(0, 1, 0)],
    ['chest', 'neck', n(0, 1, 0)],
    ['neck', 'head', n(0, 1, 0)],
    ['shoulderL', 'upperArmL', n(s * 0.94, 0.34, 0)],
    ['shoulderR', 'upperArmR', n(-s * 0.94, 0.34, 0)],
    ['upperArmL', 'forearmL', n(s * 0.20, -0.98, 0)],
    ['upperArmR', 'forearmR', n(-s * 0.20, -0.98, 0)],
    ['forearmL', 'handL', n(s * 0.20, -0.98, 0)],
    ['forearmR', 'handR', n(-s * 0.20, -0.98, 0)],
    ['thighL', 'shinL', n(s * 0.04, -1, 0)],
    ['thighR', 'shinR', n(-s * 0.04, -1, 0)],
    ['shinL', 'footL', n(0, -1, 0)],
    ['shinR', 'footR', n(0, -1, 0)],
  ];
}

export const SLOTS = [
  { key: 'skin',   name: '素体' },
  { key: 'muscle', name: '筋肉' },
  { key: 'bone',   name: '骨格' },
];

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
    this.pivot = null;
    this.root = null;
    this.fileName = '';
    this.meshes = [];
    this.skeleton = null;
    this.boneMap = {};
    this.boneToJoint = new Map();
    this.restLocal = new Map();        // 読み込み直後の姿勢
    this.neutralWorld = new Map();     // 基準姿勢に補正したあとの世界向き
    this.neutralParent = new Map();    // そのときの親の世界向き
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
    this.showBuiltinSkeleton = false;
    this.limitsEnabled = true;
    this.canonicalRest = true;

    this.angles = {};
    for (const j of JOINTS) this.angles[j.key] = { x: 0, y: 0, z: 0 };
    this.selected = null;

    this.onSelect = () => {};
    this.onStatus = () => {};
    this.onSlotsChanged = () => {};
    this.onNotice = () => {};

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

  get primarySlot() {
    if (this.slots.skin.posable) return this.slots.skin;
    for (const s of SLOTS) if (this.slots[s.key].posable) return this.slots[s.key];
    for (const s of SLOTS) if (this.slots[s.key].loaded) return this.slots[s.key];
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

  hasJoint(jointKey) { return !!this._boneForJoint(jointKey); }

  slotInfo() {
    return SLOTS.map(s => {
      const slot = this.slots[s.key];
      return {
        key: s.key, name: s.name,
        loaded: slot.loaded, posable: slot.posable, fileName: slot.fileName,
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
      this._setupModel(await new FBXLoader().loadAsync(url), slotKey, name);
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
    this._disposeSlot(this.slots[slotKey]);
    if (!this.slots[this.viewMode] || !this.slots[this.viewMode].loaded) {
      const first = SLOTS.find(s => this.slots[s.key].loaded);
      this.viewMode = first ? first.key : 'skin';
    }
    this.applyViewMode(this.viewMode);
    this._ground();
    this.onSlotsChanged();
    this._reportStatus();
  }

  _disposeSlot(slot) {
    for (const p of slot.boneParts) if (p.parent) p.parent.remove(p);
    slot.boneParts = [];
    if (slot.pivot) {
      this.container.remove(slot.pivot);
      slot.pivot.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    slot.pivot = null;
    slot.root = null;
    slot.fileName = '';
    slot.meshes = [];
    slot.skeleton = null;
    slot.boneMap = {};
    slot.boneToJoint = new Map();
    slot.restLocal = new Map();
    slot.neutralWorld = new Map();
    slot.neutralParent = new Map();
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

    const pivot = new THREE.Group();
    pivot.add(root);
    slot.pivot = pivot;
    this.container.add(pivot);

    guard('大きさの正規化', () => this._normalizeScale(root));

    if (slot.skeleton) {
      const { map } = mapBones(slot.skeleton.bones);
      slot.boneMap = map;
      slot.boneToJoint = new Map();
      for (const [k, b] of Object.entries(map)) slot.boneToJoint.set(b, k);
      for (const b of slot.skeleton.bones) slot.restLocal.set(b, b.quaternion.clone());
      guard('向きの正規化', () => this._orientToCanonical(slot));
      guard('基準姿勢への補正', () => this._buildNeutral(slot));
      slot.restLowestY = this._lowestBoneY(slot);
      guard('骨格の生成', () => this._buildBoneView(slot));
    }

    this.applyAll();
    this.applyMaterialMode(this.materialMode);
    if (!this.slots[this.viewMode] || !this.slots[this.viewMode].loaded) this.viewMode = slotKey;
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
    if (!isFinite(size.y) || size.y <= 1e-6) return;
    root.scale.multiplyScalar(1.7 / size.y);
    root.updateWorldMatrix(true, true);

    const box2 = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box2.min.y;
    root.updateWorldMatrix(true, true);
  }

  /** キャラクターの左が world +X を向くように、ピボットを Y 軸まわりに回す */
  _orientToCanonical(slot) {
    const L = slot.boneMap.shoulderL || slot.boneMap.upperArmL || slot.boneMap.thighL;
    const R = slot.boneMap.shoulderR || slot.boneMap.upperArmR || slot.boneMap.thighR;
    if (!L || !R) return;
    const a = L.getWorldPosition(new THREE.Vector3());
    const b = R.getWorldPosition(new THREE.Vector3());
    const dx = a.x - b.x, dz = a.z - b.z;
    if (dx * dx + dz * dz < 1e-8) return;
    slot.pivot.rotation.y = -Math.atan2(dz, dx);
    slot.pivot.updateWorldMatrix(true, true);
  }

  _boneDirection(slot, fromKey, toKey) {
    const a = slot.boneMap[fromKey], b = slot.boneMap[toKey];
    if (!a || !b) return null;
    const pa = a.getWorldPosition(new THREE.Vector3());
    const pb = b.getWorldPosition(new THREE.Vector3());
    const d = pb.sub(pa);
    if (d.lengthSq() < 1e-10) return null;
    return d.normalize();
  }

  /** 読み込んだ姿勢を A 字の基準姿勢へ寄せ、その世界向きを neutral として記録する */
  _buildNeutral(slot) {
    slot.neutralWorld = new Map();
    slot.neutralParent = new Map();
    if (this.canonicalRest) {
      const L = slot.boneMap.shoulderL || slot.boneMap.upperArmL || slot.boneMap.thighL;
      const R = slot.boneMap.shoulderR || slot.boneMap.upperArmR || slot.boneMap.thighR;
      let s = 1;
      if (L && R) {
        const ax = L.getWorldPosition(new THREE.Vector3()).x;
        const bx = R.getWorldPosition(new THREE.Vector3()).x;
        s = ax >= bx ? 1 : -1;
      }
      for (const [fromKey, toKey, target] of restTargets(s)) {
        const bone = slot.boneMap[fromKey];
        const from = this._boneDirection(slot, fromKey, toKey);
        if (!bone || !from) continue;
        const swing = new THREE.Quaternion().setFromUnitVectors(from, target);
        const current = bone.getWorldQuaternion(new THREE.Quaternion());
        this._setBoneWorldQuat(bone, swing.multiply(current));
      }
    }
    for (const b of slot.skeleton.bones) {
      slot.neutralWorld.set(b, b.getWorldQuaternion(new THREE.Quaternion()));
      const pq = new THREE.Quaternion();
      if (b.parent) b.parent.getWorldQuaternion(pq);
      slot.neutralParent.set(b, pq);
    }
  }

  _setBoneWorldQuat(bone, desiredWorld) {
    const pq = new THREE.Quaternion();
    if (bone.parent) bone.parent.getWorldQuaternion(pq);
    bone.quaternion.copy(pq.invert().multiply(desiredWorld));
    bone.updateWorldMatrix(false, true);
  }

  setCanonicalRest(on) {
    this.canonicalRest = on;
    for (const s of SLOTS) {
      const slot = this.slots[s.key];
      if (!slot.skeleton) continue;
      for (const b of slot.skeleton.bones) {
        const r = slot.restLocal.get(b);
        if (r) b.quaternion.copy(r);
      }
      slot.pivot.updateWorldMatrix(true, true);
      guard('基準姿勢への補正', () => this._buildNeutral(slot));
      slot.restLowestY = this._lowestBoneY(slot);
      guard('骨格の生成', () => this._buildBoneView(slot));
    }
    this.applyAll();
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

  // ---- 簡易骨格 -----------------------------------------------------------

  _buildBoneView(slot) {
    for (const p of slot.boneParts) if (p.parent) p.parent.remove(p);
    slot.boneParts = [];
    if (!slot.skeleton) return;
    slot.pivot.updateWorldMatrix(true, true);
    slot.boneParts = buildSkeletonView(slot);
    this._refreshBoneView();
  }

  _refreshBoneView() {
    const p = this.primarySlot;
    const on = this.boneViewOn || this.showBuiltinSkeleton;
    for (const s of SLOTS) {
      const slot = this.slots[s.key];
      const show = on && slot === p;
      for (const part of slot.boneParts) part.visible = show;
    }
  }

  setBoneViewOn(on) {
    this.boneViewOn = on;
    this._refreshBoneView();
  }

  // ---- 表示モード ---------------------------------------------------------

  /** @returns {boolean} 切り替えられたら true、出せるものが無ければ false */
  applyViewMode(modeKey) {
    const mode = VIEW_MODES.find(m => m.key === modeKey) || VIEW_MODES[0];
    const p = this.primarySlot;
    const hasSkeleton = !!(p && p.skeleton);

    if (modeKey === 'muscle' && !this.slots.muscle.loaded) {
      this.onNotice('筋肉モデルが読み込まれていません。「モデル」から読み込んでください。');
      return false;
    }
    if (modeKey === 'bone' && !this.slots.bone.loaded && !hasSkeleton) {
      this.onNotice('骨格モデルが読み込まれていません。「モデル」から読み込んでください。');
      return false;
    }

    this.viewMode = modeKey;
    // 骨格モデルが無いときは、モデル内蔵のボーンから作る簡易骨格で代替する
    this.showBuiltinSkeleton =
      (modeKey === 'bone' && !this.slots.bone.loaded && hasSkeleton) ||
      (modeKey === 'overlay' && !this.slots.bone.loaded && !this.slots.muscle.loaded && hasSkeleton);

    const show = mode.show.filter(k => this.slots[k].loaded);
    if (modeKey === 'bone' && this.showBuiltinSkeleton) show.length = 0;   // 肌を消して骨組みだけ出す

    for (const s of SLOTS) {
      const slot = this.slots[s.key];
      for (const m of slot.meshes) m.visible = show.includes(s.key);
    }
    this._refreshBoneView();
    if (this.showBuiltinSkeleton && modeKey === 'bone') {
      this.onNotice('骨格モデルが無いので、モデル内蔵のボーンから作った簡易骨格を表示しています。');
    } else {
      this.onNotice('');
    }
    return true;
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
    this.applyAll();
  }

  getAngles(jointKey) { return this.angles[jointKey] || { x: 0, y: 0, z: 0 }; }

  /** 角度一式をまとめて差し替える（省略した関節は 0 に戻る） */
  setAngles(map) {
    for (const j of JOINTS) {
      const src = map[j.key];
      this.angles[j.key] = src
        ? { x: src.x || 0, y: src.y || 0, z: src.z || 0 }
        : { x: 0, y: 0, z: 0 };
      if (this.limitsEnabled) Object.assign(this.angles[j.key], clampAngles(j.key, this.angles[j.key]));
    }
    this.applyAll();
  }

  applyPose(spec) { this.setAngles(parseSpec(spec)); }

  allAngles() {
    const out = {};
    for (const j of JOINTS) out[j.key] = { ...this.angles[j.key] };
    return out;
  }

  setLimitsEnabled(on) {
    this.limitsEnabled = on;
    if (!on) return;
    for (const j of JOINTS) Object.assign(this.angles[j.key], clampAngles(j.key, this.angles[j.key]));
    this.applyAll();
  }

  /**
   * 全関節にポーズを当てる。
   * 角度は「基準姿勢のときのワールド軸」で解釈するが、適用は局所回転として行うので、
   * 親を動かせば子もついていく（肩を開けば前腕も一緒に開く）。
   *   局所 = 親の基準向き⁻¹ · 角度 · 自分の基準向き
   */
  applyAll() {
    guard('ポーズ適用', () => {
      const delta = new THREE.Quaternion();
      const qz = new THREE.Quaternion();
      const qy = new THREE.Quaternion();
      for (const key of APPLY_ORDER) {
        const a = this.angles[key] || { x: 0, y: 0, z: 0 };
        delta.setFromAxisAngle(AX, a.x * DEG);
        qz.setFromAxisAngle(AZ, a.z * DEG);
        qy.setFromAxisAngle(AY, a.y * DEG);
        delta.multiply(qz).multiply(qy);
        for (const s of SLOTS) {
          const slot = this.slots[s.key];
          const bone = slot.boneMap[key];
          if (!bone) continue;
          const nb = slot.neutralWorld.get(bone);
          const np = slot.neutralParent.get(bone);
          if (!nb || !np) continue;
          bone.quaternion.copy(np).invert().multiply(delta).multiply(nb);
        }
      }
      this.container.updateWorldMatrix(true, true);
    });
    this._ground();
  }

  resetPose() {
    for (const j of JOINTS) this.angles[j.key] = { x: 0, y: 0, z: 0 };
    this.applyAll();
  }

  resetSelected() {
    if (!this.selected) return;
    this.angles[this.selected] = { x: 0, y: 0, z: 0 };
    this.applyAll();
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
      try { m.computeBoundingBox?.(); m.computeBoundingSphere?.(); } catch (err) { /* 続行 */ }
    }
    let hits = [];
    try {
      hits = ray.intersectObjects(targets, false);
    } catch (err) {
      const parts = targets.filter(t => t.userData && t.userData.jointBone);
      if (window.__positShowError) {
        window.__positShowError('[レイキャスト] ' + (err && err.message ? err.message : err));
      }
      try { hits = ray.intersectObjects(parts, false); } catch (e2) { hits = []; }
    }
    if (!hits.length) { this.select(null); return; }
    this.select(this._jointFromHit(hits[0]));
  }

  _jointFromHit(hit) {
    const obj = hit.object;
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

  _walkToJoint(bone, slotKey) {
    const slot = this.slots[slotKey] || this.primarySlot;
    if (!slot) return null;
    let b = bone, guardCount = 0;
    while (b && guardCount++ < 24) {
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
      r * Math.cos(e) * Math.sin(a), r * Math.sin(e), r * Math.cos(e) * Math.cos(a)
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
  setUIHidden(on) { this.marker.visible = on ? false : !!(this.selected && this._boneForJoint(this.selected)); }
  setLens(mm) {
    this.camera.fov = 2 * Math.atan(12 / mm) * (180 / Math.PI);
    this.camera.updateProjectionMatrix();
  }
}

export const THREE_REVISION = THREE.REVISION;
export { JOINTS, JOINT_BY_KEY, JOINT_GROUPS };
