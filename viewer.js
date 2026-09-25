// viewer.js — three.js の描画まわり（ライティング・モデル読み込み・関節操作）
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { JOINTS, JOINT_BY_KEY, mapBones, clampAngles } from './bones.js';

const DEG = Math.PI / 180;
const AX = new THREE.Vector3(1, 0, 0);
const AY = new THREE.Vector3(0, 1, 0);
const AZ = new THREE.Vector3(0, 0, 1);

export const MATERIAL_MODES = [
  { key: 'original', name: '素体' },
  { key: 'clay',     name: '粘土' },
  { key: 'plaster',  name: '石膏' },
];

export class Viewer {
  constructor(canvas) {
    this.canvas = canvas;
    this.model = null;
    this.meshes = [];
    this.skeleton = null;
    this.boneMap = {};        // jointKey -> Bone
    this.boneToJoint = new Map(); // Bone -> jointKey
    this.restQuats = new Map();
    this.angles = {};         // jointKey -> {x,y,z}
    this.selected = null;     // jointKey
    this.limitsEnabled = true;
    this.materialMode = 'clay';
    this.originalMaterials = new Map();
    this.restLowestY = 0;
    this.onSelect = () => {};
    this.onStatus = () => {};

    this._initScene();
    this._initLights();
    this._initGround();
    this._initMarker();
    this._bindPointer();
    this._loop();

    for (const j of JOINTS) this.angles[j.key] = { x: 0, y: 0, z: 0 };
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
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = this.envRT.texture;
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
    const tick = () => {
      requestAnimationFrame(tick);
      this.controls.update();
      if (this.selected && this.boneMap[this.selected]) {
        this.boneMap[this.selected].getWorldPosition(this.marker.position);
      }
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  // ---- モデル読み込み -----------------------------------------------------

  async loadURL(url) {
    const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
    this.onStatus('読み込み中…');
    if (ext === 'fbx') {
      const obj = await new FBXLoader().loadAsync(url);
      this._setupModel(obj);
    } else {
      const gltf = await new GLTFLoader().loadAsync(url);
      this._setupModel(gltf.scene);
    }
  }

  async loadFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const buf = await file.arrayBuffer();
    this.onStatus('読み込み中…');
    if (ext === 'fbx') {
      const obj = new FBXLoader().parse(buf, '');
      this._setupModel(obj);
    } else {
      const loader = new GLTFLoader();
      const gltf = await loader.parseAsync(buf, '');
      this._setupModel(gltf.scene);
    }
  }

  _setupModel(root) {
    if (this.model) {
      this.container.remove(this.model);
      this.model.traverse(o => {
        if (o.geometry) o.geometry.dispose();
      });
    }
    this.model = root;
    this.meshes = [];
    this.skeleton = null;
    this.originalMaterials.clear();

    root.traverse(o => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
        this.meshes.push(o);
        this.originalMaterials.set(o, o.material);
      }
      if (o.isSkinnedMesh && !this.skeleton) this.skeleton = o.skeleton;
    });

    this.container.add(root);
    this._normalizeScale(root);

    if (this.skeleton) {
      const { map, unmatched } = mapBones(this.skeleton.bones);
      this.boneMap = map;
      this.boneToJoint = new Map();
      for (const [k, b] of Object.entries(map)) this.boneToJoint.set(b, k);
      this.restQuats = new Map();
      for (const b of this.skeleton.bones) this.restQuats.set(b, b.quaternion.clone());
      this.unmatchedBones = unmatched;
      this.restLowestY = this._lowestBoneY();
      const n = Object.keys(map).length;
      this.onStatus(`ボーン ${this.skeleton.bones.length} 本 / 関節 ${n}/${JOINTS.length} 対応`);
    } else {
      this.boneMap = {};
      this.boneToJoint = new Map();
      this.onStatus('スキン情報なし（表示のみ・ポーズ不可）');
    }

    this.resetPose();
    this.applyMaterialMode(this.materialMode);
    this.frameModel();
  }

  _normalizeScale(root) {
    root.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const h = size.y;
    if (!isFinite(h) || h <= 1e-6) return;
    const s = 1.7 / h;
    root.scale.multiplyScalar(s);
    root.updateWorldMatrix(true, true);

    const box2 = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box2.min.y;
    root.updateWorldMatrix(true, true);
  }

  _lowestBoneY() {
    if (!this.skeleton) return 0;
    const v = new THREE.Vector3();
    let min = Infinity;
    for (const b of this.skeleton.bones) {
      b.getWorldPosition(v);
      if (v.y < min) min = v.y;
    }
    return isFinite(min) ? min : 0;
  }

  frameModel() {
    if (!this.model) return;
    this.controls.target.set(0, 0.95, 0);
    this.camera.position.set(0, 1.15, 3.4);
    this.controls.update();
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

  getAngles(jointKey) {
    return this.angles[jointKey] || { x: 0, y: 0, z: 0 };
  }

  setLimitsEnabled(on) {
    this.limitsEnabled = on;
    if (!on) return;
    for (const j of JOINTS) {
      Object.assign(this.angles[j.key], clampAngles(j.key, this.angles[j.key]));
      this._applyJoint(j.key);
    }
    this._ground();
  }

  _applyJoint(jointKey) {
    const bone = this.boneMap[jointKey];
    if (!bone) return;
    const rest = this.restQuats.get(bone);
    if (!rest) return;
    const a = this.angles[jointKey];
    const qx = new THREE.Quaternion().setFromAxisAngle(AX, a.x * DEG);
    const qy = new THREE.Quaternion().setFromAxisAngle(AY, a.y * DEG);
    const qz = new THREE.Quaternion().setFromAxisAngle(AZ, a.z * DEG);
    const delta = qx.multiply(qz).multiply(qy);   // Posit と同じ合成順 qx·qz·qy
    bone.quaternion.copy(rest).multiply(delta);
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
      const na = { x: b.x, y: -b.y, z: -b.z };
      const nb = { x: a.x, y: -a.y, z: -a.z };
      this.angles[aKey] = na;
      this.angles[bKey] = nb;
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
    if (!this.skeleton || !this.model) return;
    this.container.position.y = 0;
    this.container.updateWorldMatrix(true, true);
    const low = this._lowestBoneY();
    this.container.position.y = this.restLowestY - low;
  }

  // ---- 選択 ---------------------------------------------------------------

  _bindPointer() {
    let startX = 0, startY = 0, moved = false;
    const el = this.canvas;
    el.addEventListener('pointerdown', e => {
      startX = e.clientX; startY = e.clientY; moved = false;
    });
    el.addEventListener('pointermove', e => {
      if (Math.abs(e.clientX - startX) > 6 || Math.abs(e.clientY - startY) > 6) moved = true;
    });
    el.addEventListener('pointerup', e => {
      if (moved) return;
      this._pick(e.clientX, e.clientY);
    });
  }

  _pick(clientX, clientY) {
    if (!this.meshes.length) return;
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    for (const m of this.meshes) {
      if (m.isSkinnedMesh) { m.computeBoundingBox?.(); m.computeBoundingSphere?.(); }
    }
    const hits = ray.intersectObjects(this.meshes, false);
    if (!hits.length) { this.select(null); return; }
    const key = this._jointFromHit(hits[0]);
    this.select(key);
  }

  _jointFromHit(hit) {
    const mesh = hit.object;
    if (!mesh.isSkinnedMesh || !mesh.skeleton || !hit.face) return null;
    const si = mesh.geometry.attributes.skinIndex;
    const sw = mesh.geometry.attributes.skinWeight;
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
    let bone = mesh.skeleton.bones[best];
    // 指など未対応のボーンは、親をたどって対応済みの関節に寄せる
    let guard = 0;
    while (bone && guard++ < 24) {
      const key = this.boneToJoint.get(bone);
      if (key) return key;
      bone = bone.parent;
    }
    return null;
  }

  select(jointKey) {
    this.selected = jointKey;
    this.marker.visible = !!(jointKey && this.boneMap[jointKey]);
    this.onSelect(jointKey);
  }

  // ---- 見た目 -------------------------------------------------------------

  applyMaterialMode(mode) {
    this.materialMode = mode;
    for (const m of this.meshes) {
      if (mode === 'original') {
        const orig = this.originalMaterials.get(m);
        if (orig) m.material = orig;
        continue;
      }
      const preset = mode === 'clay'
        ? { color: 0xd6cec2, roughness: 0.72 }
        : { color: 0xeeeae4, roughness: 0.9 };
      if (!m.userData.studioMat) m.userData.studioMat = {};
      if (!m.userData.studioMat[mode]) {
        m.userData.studioMat[mode] = new THREE.MeshStandardMaterial({
          color: preset.color, roughness: preset.roughness, metalness: 0.0,
          envMapIntensity: 0.9,
        });
      }
      m.material = m.userData.studioMat[mode];
    }
  }

  setLightDirection(azimuthDeg, elevationDeg) {
    this.lightAzimuth = azimuthDeg;
    this.lightElevation = elevationDeg;
    const a = azimuthDeg * DEG, e = elevationDeg * DEG;
    const r = 5;
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
    // 35mm判換算の焦点距離 -> 垂直画角
    this.camera.fov = 2 * Math.atan(12 / mm) * (180 / Math.PI);
    this.camera.updateProjectionMatrix();
  }
}

export { JOINTS, JOINT_BY_KEY };
