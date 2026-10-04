// viewer.js — three.js の描画まわり（ライティング・モデル読み込み・関節操作）
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { JOINTS, JOINT_BY_KEY, JOINT_GROUPS, mapBones, mapBonesByStructure, mapFingers, fingerCount, clampAngles, limitExcess, wrapDeg, normalizeName } from './bones.js';
import { parseSpec, parseFingerSpec } from './poses.js';
import { buildSkeletonView } from './skeletonView.js';
import { buildHeadPlanes, FIG_HEADS, HEADH_MIN, HEADH_MAX } from './headPlanes.js';
import { buildBodyMorphs } from './bodyShape.js';
// 不具合を調べるときの入り口（画面には出ない）
if (typeof window !== 'undefined') window.__positTHREE = THREE;

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
  'hips', 'spine', 'chest', 'neck', 'head', 'jaw',
  'shoulderL', 'upperArmL', 'forearmL', 'handL',
  'shoulderR', 'upperArmR', 'forearmR', 'handR',
  'thighL', 'shinL', 'footL',
  'thighR', 'shinR', 'footR',
];

/** 基準姿勢（A字）での各骨の向き。s はキャラクターの左が world +X なら +1 */
function restTargets(s) {
  const n = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
  // Swift版のリグと同じ基準姿勢（気をつけ）に合わせる:
  //   鎖骨は真横、上腕・前腕・腿・脛は真下、体幹は真上
  return [
    ['hips', 'spine', n(0, 1, 0)],
    ['spine', 'chest', n(0, 1, 0)],
    ['chest', 'neck', n(0, 1, 0)],
    ['neck', 'head', n(0, 1, 0)],
    ['shoulderL', 'upperArmL', n(s, 0, 0)],
    ['shoulderR', 'upperArmR', n(-s, 0, 0)],
    ['upperArmL', 'forearmL', n(0, -1, 0)],
    ['upperArmR', 'forearmR', n(0, -1, 0)],
    ['forearmL', 'handL', n(0, -1, 0)],
    ['forearmR', 'handR', n(0, -1, 0)],
    ['thighL', 'shinL', n(0, -1, 0)],
    ['thighR', 'shinR', n(0, -1, 0)],
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
    this.fingers = { L: {}, R: {} };
    this.headRatio0 = 7.5;   // 読み込んだモデル本来の頭身
    this.headScale = 1;
    this.bodyScale = 1;
    this.restPos = null;      // 元の骨の間隔
    this.headSubtree = null;  // 頭より先の骨
    this.lateral = null;      // 肩・腿の「横向き」の向き
    this.wireMeshes = [];     // 面の線（ワイヤー）
    this.headPlaneGroup = null;
    this.headPlanes = { parts: [], lines: [] };
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
    this.wireOn = false;
    this.bodyType = 'neutral';
    this.headRatio = null;          // null なら元のまま
    this.partView = 'full';         // full / upper / face / hand / foot
    this.headPlanesOn = false;
    this.partSide = 'L';

    this.angles = {};
    for (const j of JOINTS) this.angles[j.key] = { x: 0, y: 0, z: 0 };
    this.selected = null;
    this.handShape = { L: '', R: '' };

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
    renderer.localClippingEnabled = true;
    this.renderer = renderer;
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 10);

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
    const bump = () => this._resize();
    window.addEventListener('resize', bump);
    // iOS は回転した直後だと、まだ古い大きさを返すことがある。
    // 落ち着いたころにもう一度測り直す。
    window.addEventListener('orientationchange', () => {
      bump();
      for (const t of [100, 300, 700]) setTimeout(bump, t);
    });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', bump);
    // いちばん確実なのは、キャンバスの箱そのものを見張ること
    if (window.ResizeObserver) {
      this._sizeWatch = new ResizeObserver(bump);
      this._sizeWatch.observe(this.canvas);
    }
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
    // clientWidth は回転の途中で古い値を返すことがあるので、実測の箱を優先する
    const r = this.canvas.getBoundingClientRect ? this.canvas.getBoundingClientRect() : null;
    const w = Math.round((r && r.width) || this.canvas.clientWidth || window.innerWidth);
    const h = Math.round((r && r.height) || this.canvas.clientHeight || window.innerHeight);
    if (w < 1 || h < 1) return;
    if (w === this._lastW && h === this._lastH) return;
    this._lastW = w; this._lastH = h;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _loop() {
    let reported = false;
    const tick = () => {
      requestAnimationFrame(tick);
      try {
        this._followPart();
        this.controls.update();
        this._updateClipPlane();
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

  /** どのスロットにどんなボーンが入っているかを文字にする（対応がうまくいかないとき用） */
  boneNameReport() {
    const lines = [];
    for (const s of SLOTS) {
      const slot = this.slots[s.key];
      if (!slot.loaded) continue;
      if (!slot.skeleton) { lines.push(`${s.name}: スキン情報なし`); continue; }
      const names = slot.skeleton.bones.slice(0, 24).map(b => b.name);
      const how = slot.mappedBy === 'structure' ? '骨のつながりから割り出し' : 'ボーン名から';
      lines.push(`${s.name}（${slot.skeleton.bones.length}本・関節 ${Object.keys(slot.boneMap).length}・${how}）`);
      const r3 = v => (Math.round(v * 1000) / 1000).toFixed(3);
      lines.push(`  背丈 ${r3(slot.totalH0 || 0)} ／ 頭のボーン ${r3(slot.headBoneY0 || 0)}`
        + ` ／ ボーン→頭頂 ${r3(slot.crownBone0 || 0)}`
        + ` ／ 頭の高さ ${r3(slot.headH0 || 0)} ／ 頭身 ${r3(slot.headRatio0 || 0)}`);
      lines.push(slot.headBox
        ? `  頭の実測(${slot.headBox.source}): あご〜頭頂 ${r3(slot.headBox.headH)}`
          + ` ／ 箱の底 ${r3(slot.headBox.bottom)} ／ あご ${r3(slot.headBox.chin)}`
          + ` ／ 半幅 ${r3(slot.headBox.half)} ／ 頂点 ${slot.headBox.count} 個`
        : '  頭の実測: 使えず（身長 ÷ 7.5 から算出）');
      if (slot.headPlanes && slot.headPlanes.parts.length) {
        lines.push(`  面の頭部: 高さ ${r3(slot.headPlanes.headH || 0)}`
          + ` ／ あご ${r3(slot.headPlanes.chin || 0)} ／ 首 ${r3(slot.headPlanes.neckRel || 0)}`
          + ` ／ 縦 ${r3(slot.headPlanes.sy || 0)} 横 ${r3(slot.headPlanes.sxz || 0)}`
          + ` ／ 元の頭の縮小 ${r3(slot.headPlanes.hide || 0)}`);
      }
      const got = JOINTS.map(j => j.key).filter(k => slot.boneMap[k]);
      const miss = JOINTS.map(j => j.key).filter(k => !slot.boneMap[k]);
      if (got.length) lines.push('  取れた関節: ' + got.map(k => `${k}=${slot.boneMap[k].name}`).join(', '));
      if (miss.length) lines.push('  取れなかった関節: ' + miss.join(', '));
      lines.push('  ボーン名: ' + names.join(', ') + (slot.skeleton.bones.length > 24 ? ' …' : ''));
    }
    return lines.join('\n');
  }

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

  /**
   * 端末から読み込む。次のどれでも受け付ける。
   *  ・GLB / FBX の1ファイル
   *  ・Sketchfab などの zip（中の scene.gltf と scene.bin を自動で結びつける）
   *  ・scene.gltf と scene.bin とテクスチャをまとめて選んだ複数ファイル
   */
  async loadFiles(fileList, slotKey = 'skin') {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    this.onStatus('読み込み中…');

    let entries = new Map();      // ファイル名（小文字） -> Blob
    let label = files[0].name;

    const zip = files.find(f => /\.zip$/i.test(f.name));
    if (zip) {
      const fflate = await import('three/addons/libs/fflate.module.js');
      const unzipped = fflate.unzipSync(new Uint8Array(await zip.arrayBuffer()));
      for (const [path, data] of Object.entries(unzipped)) {
        if (!data || !data.length) continue;
        entries.set(path.toLowerCase(), new Blob([data]));
      }
      label = zip.name;
    } else {
      for (const f of files) entries.set(f.name.toLowerCase(), f);
    }

    // 主役のファイルを選ぶ
    const pickMain = re => {
      for (const key of entries.keys()) if (re.test(key)) return key;
      return null;
    };
    const mainKey = pickMain(/\.glb$/) || pickMain(/\.gltf$/) || pickMain(/\.fbx$/);
    if (!mainKey) {
      throw new Error('GLB / glTF / FBX が見つかりませんでした。'
        + (zip ? 'zip の中身を確認してください。' : 'モデル本体のファイルを選んでください。'));
    }
    if (files.length > 1 || zip) label = mainKey.split('/').pop();

    // 相対パスを、選んだファイルへ差し替えるための対応表
    const urls = new Map();
    for (const [key, blob] of entries) {
      urls.set(key.split('/').pop(), URL.createObjectURL(blob));
    }
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(url => {
      const base = decodeURIComponent(String(url).split('?')[0].split('/').pop() || '').toLowerCase();
      return urls.get(base) || url;
    });

    try {
      const buf = await entries.get(mainKey).arrayBuffer();
      if (/\.fbx$/.test(mainKey)) {
        this._setupModel(new FBXLoader(manager).parse(buf, ''), slotKey, label);
      } else {
        const gltf = await new GLTFLoader(manager).parseAsync(buf, '');
        this._setupModel(gltf.scene, slotKey, label);
      }
    } finally {
      // FBX のテクスチャは後から読み込まれるので、少し待ってから片付ける
      setTimeout(() => { for (const u of urls.values()) URL.revokeObjectURL(u); }, 60000);
    }
  }

  /** 1ファイルだけのとき用 */
  async loadFile(file, slotKey = 'skin') {
    return this.loadFiles([file], slotKey);
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
    if (slot.skullGroup && slot.skullGroup.parent) slot.skullGroup.parent.remove(slot.skullGroup);
    slot.skullGroup = null;
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
    slot.fingers = { L: {}, R: {} };
    slot.restLocal = new Map();
    slot.neutralWorld = new Map();
    slot.neutralParent = new Map();
    slot.originalMaterials = new Map();
    for (const w of slot.wireMeshes) if (w.parent) w.parent.remove(w);
    slot.wireMeshes = [];
    if (slot.headPlaneGroup && slot.headPlaneGroup.parent) {
      slot.headPlaneGroup.parent.remove(slot.headPlaneGroup);
    }
    slot.headPlaneGroup = null;
    slot.headPlanes = { parts: [], lines: [] };
    slot.restPos = null;
    slot.headSubtree = null;
    slot.lateral = null;
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
      slot.mappedBy = 'name';
      // 名前で足りないときは、ボーンのつながりと位置から割り出す
      if (Object.keys(map).length < 12) {
        guard('骨のつながりから関節を割り出す', () => {
          slot.pivot.updateWorldMatrix(true, true);
          const cache = new Map();
          const posOf = b => {
            let v = cache.get(b);
            if (!v) { v = b.getWorldPosition(new THREE.Vector3()); cache.set(b, v); }
            return v;
          };
          const alt = mapBonesByStructure(slot.skeleton.bones, posOf);
          if (Object.keys(alt).length > Object.keys(map).length) {
            // 名前で確実に取れたものは残し、足りない分だけ埋める
            for (const [k, b] of Object.entries(alt)) if (!map[k]) map[k] = b;
            slot.mappedBy = Object.keys(map).length > 12 ? 'structure' : 'name';
          }
        });
      }
      slot.fingers = mapFingers(slot.skeleton.bones);
      slot.boneToJoint = new Map();
      for (const [k, b] of Object.entries(map)) slot.boneToJoint.set(b, k);
      for (const b of slot.skeleton.bones) slot.restLocal.set(b, b.quaternion.clone());
      guard('向きの正規化', () => this._orientToCanonical(slot));
      guard('基準姿勢への補正', () => this._buildNeutral(slot));
      slot.restLowestY = this._lowestBoneY(slot);
      guard('頭身の測定', () => this._measureHeadRatio(slot));
      // 男性・女性の体つき（表面を変形するモーフ）。基準姿勢のうちに作る
      guard('体つきのモーフ', () => buildBodyMorphs(slot, {
        handFrame: { L: this._handFrame(slot, 'L'), R: this._handFrame(slot, 'R') },
      }));
      guard('骨格の生成', () => this._buildBoneView(slot));
    }

    this.applyAll();
    this._reapplyHandShapes();
    guard('面の線の生成', () => this._buildWireframe(slot));
    guard('面取り頭部の生成', () => this._buildHeadPlanes(slot));
    guard('頭身・体型の反映', () => this._applyProportions());
    this.applyMaterialMode(this.materialMode);
    if (!this.slots[this.viewMode] || !this.slots[this.viewMode].loaded) this.viewMode = slotKey;
    this.applyViewMode(this.viewMode);
    this.setSkinOpacity(this.skinOpacity);
    this._reportStatus();
    this.onSlotsChanged();
    if (slot.skeleton && !Object.keys(slot.boneMap).length) {
      this.onNotice(`${SLOTS.find(x => x.key === slotKey).name}: ボーン名が対応表にありません。`
        + '設定→モデル→「読み込んだモデルの中身」でボーン名を確認できます。');
    }
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
    if (this.canonicalRest) guard('手の向きの補正', () => this._correctHands(slot));
    guard('指の軸', () => this._buildFingerAxes(slot));
    for (const b of slot.skeleton.bones) {
      slot.neutralWorld.set(b, b.getWorldQuaternion(new THREE.Quaternion()));
      const pq = new THREE.Quaternion();
      if (b.parent) b.parent.getWorldQuaternion(pq);
      slot.neutralParent.set(b, pq);
    }
  }

  /**
   * 手のひらの向きを基準姿勢に合わせる。
   * 「指は真下・指の付け根の並びは前後」（＝手のひらが腿を向き、親指が前に来る）に揃える。
   * 指の骨の位置から今の向きを測り、その差分だけ手の骨を回す。
   */
  _correctHands(slot) {
    const target = (() => {
      const y = new THREE.Vector3(0, 1, 0);          // 指先から手首へ
      const x = new THREE.Vector3(0, 0, 1);          // 親指の向き（前）
      const z = new THREE.Vector3().crossVectors(x, y);
      return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    })();

    for (const side of ['L', 'R']) {
      const hand = slot.boneMap['hand' + side];
      if (!hand) continue;

      const kids = [];
      (function walk(b, depth) {
        if (depth > 2) return;
        for (const c of b.children) {
          if (!c.isBone) continue;
          kids.push(c);
          walk(c, depth + 1);
        }
      })(hand, 0);
      if (!kids.length) continue;

      const pick = re => kids.find(b => re.test(normalizeName(b.name)));
      const thumb = pick(/thumb/);
      const finger = pick(/middle/) || pick(/index/) || pick(/ring/);
      const index = pick(/index/), little = pick(/pinky|little/) || pick(/ring/);
      if (!finger || (!thumb && !(index && little))) continue;

      const origin = hand.getWorldPosition(new THREE.Vector3());
      const fDir = finger.getWorldPosition(new THREE.Vector3()).sub(origin);
      if (fDir.lengthSq() < 1e-10) continue;
      fDir.normalize();
      const cy = fDir.clone().negate();
      // 「前」に向けるのは指の付け根の並び（小指→人差し指）。
      // 親指は手のひらの面から斜めに出ているので、親指を前に向けると手のひらが 30° ほどねじれる。
      let tDir = null;
      if (index && little && index !== little) {
        tDir = index.getWorldPosition(new THREE.Vector3())
          .sub(little.getWorldPosition(new THREE.Vector3()));
      }
      if (!tDir || tDir.lengthSq() < 1e-10) tDir = thumb.getWorldPosition(new THREE.Vector3()).sub(origin);
      if (tDir.lengthSq() < 1e-10) continue;
      tDir.normalize();
      const cx = tDir.clone().addScaledVector(cy, -tDir.dot(cy));
      if (cx.lengthSq() < 1e-6) continue;             // 親指と指が同じ向き = 測れない
      cx.normalize();
      const cz = new THREE.Vector3().crossVectors(cx, cy);
      const current = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(cx, cy, cz));

      const fix = target.clone().multiply(current.invert());
      this._setBoneWorldQuat(hand, fix.multiply(hand.getWorldQuaternion(new THREE.Quaternion())));
    }
  }

  /**
   * 指ごとの「曲げる・開く・ひねる」の軸を、基準姿勢での骨の位置から決める。
   * 固定の軸で回すと、手のひらの向きや指の付き方がリグごとに違うので崩れる。
   *   曲げる … 指先が手のひらの側へ向かう回転（親指は手のひらを横切って小指側へ）
   *   開く   … 手のひらの面の中で親指側へ向かう回転（親指は人差し指から離れる向き）
   *   ひねる … 指の骨の長さ方向まわり
   * 軸はどれも「動かしたい向き」との外積で作るので、左右の手で勝手に鏡像になる。
   */
  _buildFingerAxes(slot) {
    slot.fingerAxes = new Map();
    const V3 = () => new THREE.Vector3();
    for (const side of ['L', 'R']) {
      const hf = this._handFrame(slot, side);
      const set = slot.fingers && slot.fingers[side];
      if (!hf || !set) continue;
      for (const f of Object.keys(set)) {
        const segs = set[f];
        for (const k of Object.keys(segs)) {
          const bone = segs[k];
          const next = segs[+k + 1] || bone.children.find(c => c.isBone);
          const o = bone.getWorldPosition(V3());
          let d = next ? next.getWorldPosition(V3()).sub(o) : null;
          if (!d || d.lengthSq() < 1e-12) d = hf.along.clone(); else d.normalize();
          const axis = to => {
            const t = to.clone().addScaledVector(d, -to.dot(d));
            if (t.lengthSq() < 1e-8) return null;
            return V3().crossVectors(d, t.normalize()).normalize();
          };
          let flex, spread;
          if (f === 'thumb' && +k === 1) {
            // 親指の付け根（CM関節）は解剖学の定義どおりに分ける。
            //   曲げる … 手のひらの面の中で、手のひらを横切って小指側へ（手のひらの法線まわり）
            //   開く   … 手のひらから前へ離す（掌側外転）
            // 親指の付き方はリグごとに違う（手のひらの面に寝ているもの・前へ立っているもの）が、
            // この分け方ならどちらでも同じ意味になる。
            flex = hf.palmar.clone();
            if (V3().crossVectors(flex, d).dot(hf.radial) > 0) flex.negate();   // ＋回転で小指側へ
            spread = axis(hf.palmar);
          } else if (f === 'thumb') {
            // その先（MP・IP関節）は親指の腹の側＝人差し指と中指の第二関節のほうへ曲がる
            const pip = [set.index && set.index[2], set.middle && set.middle[2]].filter(Boolean);
            let goal = null;
            if (pip.length) {
              goal = V3();
              for (const q of pip) goal.add(q.getWorldPosition(V3()));
              goal.divideScalar(pip.length).sub(o);
            }
            flex = axis(goal || hf.radial.clone().negate().addScaledVector(hf.palmar, 0.3));
            spread = axis(hf.radial.clone().sub(hf.along));
          } else {
            // 人差し指〜小指: 曲げる＝手のひらの側へ、開く＝親指の側へ
            flex = axis(hf.palmar);
            spread = axis(hf.radial);
          }
          if (flex && !spread) spread = V3().crossVectors(flex, d).normalize();
          if (!flex || !spread) continue;
          slot.fingerAxes.set(bone, { flex, spread, twist: d.clone() });
        }
      }
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
    this._reapplyHandShapes();
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

  /** 首の付け根から頭頂までを頭の高さとみなし、身長との比を頭身とする */

  /**
   * 頭の実際の大きさを、スキンの重みから測る。
   * ボーンの位置から当てると、リグによって頭のボーンの高さが違うため外れる。
   * 頭のボーン（とその先）に主に引っ張られる頂点だけを集めて、頭のボーン基準の
   * 箱を作る。戻り値の単位はメートル、y は頭のボーンからの高さ。
   */
  /**
   * 頭の実際の大きさを測る。単位はメートル、y は頭のボーンからの高さ。
   * 二通りのモデルに対応する。
   *   1. スキンのモデル … 頭のボーン（とその先）に主に引っ張られる頂点
   *   2. パーツ分けのモデル … 頭のボーンにぶら下がった、スキンでないメッシュ
   * 球体関節のデッサン人形は 2 のことが多く、1 だけだと何も拾えない。
   */
  _measureHeadBox(slot) {
    const head = slot.boneMap.head;
    if (!head || !slot.skeleton) return null;
    const ids = new Set();
    slot.skeleton.bones.forEach((b, i) => {
      for (let c = b; c; c = c.parent) if (c === head) { ids.add(i); break; }
    });

    slot.pivot.updateMatrixWorld(true);
    head.updateWorldMatrix(true, false);
    const hs = head.getWorldScale(new THREE.Vector3()).x || 1;
    const v = new THREE.Vector3();
    let n = 0;
    const lo = new THREE.Vector3(1e9, 1e9, 1e9);
    const hi = new THREE.Vector3(-1e9, -1e9, -1e9);
    const take = () => {
      head.worldToLocal(v).multiplyScalar(hs);      // 頭のボーン基準・メートル
      lo.min(v); hi.max(v); n++;
    };

    // 1) スキンの重みで頭に属する頂点。
    //    頂点はスキンをかけた後の位置で測る（かける前の位置はモデルの作り方しだいで
    //    まったく別の場所にあり、頭の箱が足元まで伸びてしまう）。
    for (const m of (slot.meshes || [])) {
      const g = m.geometry;
      const pos = g && g.attributes && g.attributes.position;
      const si = g && g.attributes && g.attributes.skinIndex;
      const sw = g && g.attributes && g.attributes.skinWeight;
      if (!pos || !si || !sw || !m.isSkinnedMesh || !m.skeleton) continue;
      const mIds = new Set();
      m.skeleton.bones.forEach((b, i) => {
        for (let c = b; c; c = c.parent) if (c === head) { mIds.add(i); break; }
      });
      if (!mIds.size) continue;
      m.updateWorldMatrix(true, false);
      m.skeleton.update();
      const step = Math.max(1, Math.floor(pos.count / 20000));
      for (let i = 0; i < pos.count; i += step) {
        let best = -1, bw = 0;
        for (let k = 0; k < 4; k++) {
          const w = sw.getComponent(i, k);
          if (w > bw) { bw = w; best = si.getComponent(i, k); }
        }
        if (bw <= 0 || !mIds.has(best)) continue;
        v.fromBufferAttribute(pos, i);
        m.applyBoneTransform(i, v);
        v.applyMatrix4(m.matrixWorld);
        take();
      }
    }

    const nSkin = n;

    // 2) 頭のボーンにぶら下がったパーツ（スキンでないメッシュ）。
    //    こちらで足した骨格・面の頭部は数えない。
    const parts = [];
    head.traverse(o => {
      if (o.isMesh && !o.isSkinnedMesh && !o.userData.headPlane && !o.userData.bonePart
        && !o.userData.jointBone) parts.push(o);
    });
    for (const m of parts) {
      const pos = m.geometry && m.geometry.attributes && m.geometry.attributes.position;
      if (!pos) continue;
      m.updateWorldMatrix(true, false);
      const step = Math.max(1, Math.floor(pos.count / 20000));
      for (let i = 0; i < pos.count; i += step) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        m.localToWorld(v);
        take();
      }
    }
    if (n < 24) return null;

    // あご（＝首との境目）。首のボーンより下は首なので、そこで切る。
    // 頭のメッシュが首にかかっていないモデルでは、箱の底がそのままあごになる。
    let neckRel = -Infinity;
    const neck = slot.boneMap.neck;
    if (neck) {
      neck.updateWorldMatrix(true, false);
      const nv = neck.getWorldPosition(new THREE.Vector3());
      neckRel = head.worldToLocal(nv).multiplyScalar(hs).y;
    }
    const chin = Math.max(lo.y, Math.min(neckRel, hi.y - 1e-3));

    // 頭のボーンより上に頂点がなければ、拾えているのは頭ではない
    if (!(hi.y > 0) || !(hi.y - chin > 1e-3)) return null;

    return {
      top: hi.y, bottom: lo.y, chin, height: hi.y - lo.y,
      headH: hi.y - chin,
      half: Math.max(Math.abs(lo.x), Math.abs(hi.x)),
      zc: (lo.z + hi.z) / 2, depth: hi.z - lo.z, count: n,
      source: nSkin && parts.length ? 'スキン＋パーツ' : (nSkin ? 'スキン' : 'パーツ'),
    };
  }

  _measureHeadRatio(slot) {
    const neck = slot.boneMap.neck || slot.boneMap.head;
    if (!neck) return;
    slot.pivot.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(slot.root);
    const neckY = neck.getWorldPosition(new THREE.Vector3()).y;
    const headH = box.max.y - neckY;
    const total = box.max.y - box.min.y;
    if (headH > 1e-4 && total > 1e-4) {
      // 頭身を変えるときに必要な三つの高さ
      //   headBoneY0 … 頭の骨の高さ（ここから下は体として縮む）
      //   crownH0    … 頭の骨から頭頂まで（ここは頭として拡大する）
      //   totalH0    … 元の背丈
      const hb = slot.boneMap.head;
      slot.headBoneY0 = hb ? hb.getWorldPosition(new THREE.Vector3()).y - box.min.y : neckY - box.min.y;
      slot.crownH0 = Math.max(1e-4, total - slot.headBoneY0);
      slot.crownBone0 = slot.crownH0;      // 実測で上書きしない、骨だけから出した値
      slot.totalH0 = total;
      // 腰と背骨の高さ（頭身を下げたときに、脚を詰めて胴で取り返すのに使う）。
      // ここが取れていないと胴の伸ばし量がずれ、背丈が据え置きにならない。
      const hipB = slot.boneMap.hips;
      const spB = slot.boneMap.spine || slot.boneMap.chest;
      slot.hipY0 = hipB ? hipB.getWorldPosition(new THREE.Vector3()).y - box.min.y : 0;
      slot.spineY0 = spB ? spB.getWorldPosition(new THREE.Vector3()).y - box.min.y : 0;

      // 頭の高さ（あご先〜頭頂）は解剖学的な比率から決める。
      // おとなは 身長 ÷ 7.5（ANSUR 1988 の実測で 7.56 男 / 7.46 女）。
      // 「頭頂〜首のボーン」をそのまま頭の高さにすると、素体によっては
      // 胸の上までを頭に数えてしまい、頭が 3〜4 割大きくなる
      // （首のボーンが胸骨の上＝頭頂から 1.37 頭分のところに置かれているため）。
      const cb = slot.crownBone0;
      const anatH = Math.max(cb * HEADH_MIN,
        Math.min(cb * HEADH_MAX, total / FIG_HEADS));
      slot.headH0 = anatH;
      slot.bodyH0 = total - anatH;
      slot.headRatio0 = total / anatH;

      // スキンの重みから頭の実寸が取れて、解剖学的な値とも食い違わなければ、
      // そちらを正とする。モデルによっては見当違いの頂点を拾うので、
      // 骨から分かる「頭のボーン→頭頂」とも突き合わせ、合わなければ必ず捨てる。
      slot.headBox = this._measureHeadBox(slot);
      const hb2 = slot.headBox;
      const ok = !!hb2
        && hb2.headH > 1e-3
        && hb2.count >= 24
        && hb2.top > cb * 0.3 && hb2.top < cb * 2.5          // 頭頂の高さが骨と合うか
        && hb2.half > cb * 0.15 && hb2.half < cb * 1.5       // 幅が現実的か
        && Math.abs(hb2.headH - anatH) < anatH * 0.25;       // 解剖学的な値と 25% 以内
      if (ok) {
        slot.headH0 = hb2.headH;
        slot.bodyH0 = total - slot.headH0;
        slot.headRatio0 = total / hb2.headH;
        slot.crownH0 = Math.max(1e-4, hb2.top);
      } else {
        slot.headBox = null;                      // 使わない（殻は骨から決める）
      }
    }
    // 元の骨の間隔を覚えておく（頭身を変えるときに縮める）
    slot.restPos = new Map();
    for (const b of slot.skeleton.bones) slot.restPos.set(b, b.position.clone());

    // 頭より先の骨は、頭の拡大にまかせて間隔を触らない
    slot.headSubtree = new Set();
    const head = slot.boneMap.head;
    if (head) {
      (function walk(b) {
        for (const c of b.children) {
          if (!c.isBone) continue;
          slot.headSubtree.add(c);
          walk(c);
        }
      })(head);
    }
    // 肩幅・腰幅を変えるときのための「横向き」
    slot.lateral = new Map();
    for (const key of ['shoulderL', 'shoulderR', 'thighL', 'thighR']) {
      const b = slot.boneMap[key];
      if (!b || !b.parent) continue;
      const pq = b.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      slot.lateral.set(b, new THREE.Vector3(1, 0, 0).applyQuaternion(pq).normalize());
    }
    slot.restLowestY0 = slot.restLowestY;
    slot.headScale = 1;
    slot.bodyScale = 1;
  }

  /** いま基準になっているモデル本来の頭身 */
  get baseHeadRatio() {
    const p = this.primarySlot;
    return p ? p.headRatio0 : 7.5;
  }

  /**
   * 体つき。clavicle … 鎖骨の長さ（肩関節が外へ出る量）、hip … 股関節の左右の間隔、
   * hand … 手の大きさ、index / ring … 人差し指・薬指の長さ（2D:4D 比）、
   * morph … 表面の変形 [男性, 女性]（bodyShape.js）
   */
  static get BODY_TYPES() {
    return {
      neutral: { name: '中性', clavicle: 1.00, hip: 1.00, hand: 1.00, index: 1.00, ring: 1.00, morph: [0, 0] },
      male:    { name: '男性', clavicle: 1.15, hip: 0.94, hand: 1.04, index: 0.98, ring: 1.03, morph: [1, 0] },
      female:  { name: '女性', clavicle: 0.88, hip: 1.08, hand: 0.95, index: 1.01, ring: 0.985, morph: [0, 1] },
    };
  }

  /** いまの体型での手の大きさ（手だけを映すときの距離に使う） */
  get handScale() {
    const bt = Viewer.BODY_TYPES[this.bodyType] || Viewer.BODY_TYPES.neutral;
    return bt.hand || 1;
  }

  setBodyType(type) {
    if (!Viewer.BODY_TYPES[type]) return;
    this.bodyType = type;
    this._applyProportions();
    // 骨格は新しい体の内側に収め直す（表示中なら作り直す）
    for (const s of SLOTS) {
      const slot = this.slots[s.key];
      if (slot.skeleton && (slot.boneParts.length || slot.boneDirty)) this._buildBoneView(slot);
    }
  }

  /**
   * 頭身を変える。頭を大きくするだけでなく、体と手足の長さも縮めて
   * 低頭身ほどデフォルメが効くようにする。全体の背丈は変えない。
   */
  setHeadRatio(ratio) {
    this.headRatio = ratio;
    this._applyProportions();
  }

  /**
   * 頭身と体型を骨に反映する。
   * 体は「腰の骨を丸ごと縮める」方式なので、骨の間隔だけでなく肉付きも一緒に縮み、
   * かかとから脚が突き抜けるようなことが起きない。
   */
  _applyProportions() {
    const bt = Viewer.BODY_TYPES[this.bodyType] || Viewer.BODY_TYPES.neutral;
    for (const s of SLOTS) {
      const slot = this.slots[s.key];
      if (!slot.skeleton || !slot.restPos) continue;
      const r0 = Math.max(2, Math.min(12, slot.headRatio0 || 7.5));
      // スライダーに触っていないときは、読み込んだモデルをそのまま出す。
      // ここで r0 を丸めてしまうと、起動しただけで体型が崩れる。
      const untouched = this.headRatio === null;
      const r = untouched ? r0 : Math.max(2, Math.min(12, this.headRatio));
      const headH = slot.headH0 || 0.22;                    // あご先から頭頂まで
      const A = slot.headBoneY0 || (slot.bodyH0 || 1.48);   // 足元から頭のボーンまで
      const B = slot.crownH0 || headH;                      // 頭のボーンから頭頂まで
      const L = Math.min(A * 0.95, slot.hipY0 || A * 0.6);  // 足元から腰まで（＝脚の長さ）
      const T = slot.totalH0 || (A + B);                    // 元の背丈

      // 頭の高さ = headH*kh、背丈 = 頭のボーンの高さ + B*kh。
      // 背丈を T に据え置いたまま 背丈/頭の高さ = r にすると kh は一意に決まる。
      const kh = untouched ? 1 : Math.max(0.05, T / (r * headH));
      const headBoneY = Math.max(1e-3, T - B * kh);   // 頭のボーンが来るべき高さ
      const kb = untouched ? 1 : Math.max(0.15, headBoneY / A);   // 体ぜんたいの倍率

      // 低頭身ほどデフォルメを強める。
      //   脚と腕をさらに詰め、そのぶん胴を伸ばして頭のボーンの高さを保つ。
      //   ボーンごと縮めるので、長さと一緒に太さも詰まる（関節から先が飛び出さない）。
      const span = Math.max(1e-6, r0 - 2);
      const deform = untouched ? 0 : Math.max(0, Math.min(1, (r0 - r) / span));
      // 胴は「脚を詰めたぶん」を引き受けて、頭のボーンの高さを元どおりにする。
      //   頭のボーンの高さ = L*kb*kl + (Sy-L)*kb + (A-Sy)*kb*kt
      //   ここから kt = 1 + L*(1-kl)/(A-Sy)。
      // 胴が伸びすぎるとリグによっては胸が異様に広がるので、
      // kt に上限を置き、超えるぶんは「脚の詰め幅」のほうを先に減らす。
      const Sy = Math.min(A - 1e-3, Math.max(L, slot.spineY0 || L));
      const gap = Math.max(1e-4, A - Sy);
      const KT_MAX = 1.8;
      const maxDrop = Math.max(0, (KT_MAX - 1) * gap / Math.max(1e-4, L));
      const kl = 1 - Math.min(0.30 * deform, maxDrop);   // 脚
      const ka = 1 - 0.38 * deform;                      // 腕
      const kt = untouched ? 1 : 1 + L * (1 - kl) / gap;

      // いったん元に戻す
      for (const b of slot.skeleton.bones) {
        const rp = slot.restPos.get(b);
        if (rp) b.position.copy(rp);
        b.scale.setScalar(1);
      }

      // 体は腰から丸ごと縮め、頭だけその上で大きくする
      const hips = slot.boneMap.hips;
      if (hips) hips.scale.setScalar(kb);
      const head = slot.boneMap.head;
      // 面で捉えた頭部のときは、元の頭を殻の内側に隠れる分だけ縮める。
      // 縮めすぎると首の頂点まで引っ張られて首が消えるので、縮小量は殻の側で決める。
      const hide = (this.headPlanesOn && slot === this.slots.skin
        && slot.headPlanes && slot.headPlanes.parts.length)
        ? (slot.headPlanes.hide || 0.62) : 1;
      const spine = slot.boneMap.spine || slot.boneMap.chest;
      if (spine && Math.abs(kt - 1) > 1e-3) spine.scale.setScalar(kt);
      const chainK = (hips ? kb : 1) * (spine ? kt : 1);
      if (head) head.scale.setScalar((chainK > 1e-6 ? kh / chainK : kh) * hide);

      for (const key of ['thighL', 'thighR']) {
        const b = slot.boneMap[key];
        if (b) b.scale.setScalar(kl);
      }
      for (const key of ['upperArmL', 'upperArmR']) {
        const b = slot.boneMap[key];
        if (b) b.scale.setScalar(ka);
      }
      if (slot.headPlaneGroup) slot.headPlaneGroup.scale.setScalar(1 / hide);
      if (slot.skullGroup) slot.skullGroup.scale.setScalar(1 / hide);

      // 肩幅: 鎖骨の長さ（肩関節を鎖骨に沿って外へ／内へ）
      for (const key of ['upperArmL', 'upperArmR']) {
        const b = slot.boneMap[key];
        if (b && bt.clavicle !== 1 && b.parent && slot.boneMap['shoulder' + key.slice(-1)] === b.parent) {
          b.position.multiplyScalar(bt.clavicle);
        }
      }
      // 腰幅: 股関節の左右の間隔
      for (const key of ['thighL', 'thighR']) {
        const b = slot.boneMap[key];
        const lat = b && slot.lateral && slot.lateral.get(b);
        if (!lat || bt.hip === 1) continue;
        b.position.addScaledVector(lat, b.position.dot(lat) * (bt.hip - 1));
      }
      // 手の大きさと、人差し指・薬指の長さ
      for (const sd of ['L', 'R']) {
        const hb = slot.boneMap['hand' + sd];
        if (hb && bt.hand && bt.hand !== 1) hb.scale.setScalar(bt.hand);
        const fs = slot.fingers && slot.fingers[sd];
        if (!fs) continue;
        if (fs.index && fs.index[1] && bt.index !== 1) fs.index[1].scale.setScalar(bt.index);
        if (fs.ring && fs.ring[1] && bt.ring !== 1) fs.ring[1].scale.setScalar(bt.ring);
      }
      // 表面の変形（男性・女性）
      for (const m of [...slot.meshes, ...slot.wireMeshes]) {
        if (m.morphTargetInfluences && m.geometry && m.geometry.userData.bodyMorph) {
          m.morphTargetInfluences[0] = bt.morph[0];
          m.morphTargetInfluences[1] = bt.morph[1];
        }
      }

      slot.headScale = kh;
      slot.bodyScale = kb;
      slot.restLowestY = (slot.restLowestY0 || 0) * kb;
    }
    this.applyAll();
    this._reapplyHandShapes();
  }

  resetHeadRatio() { this.headRatio = null; this._applyProportions(); }

  // ---- 面の線（ワイヤー）-----------------------------------------------

  _buildWireframe(slot) {
    for (const w of slot.wireMeshes) if (w.parent) w.parent.remove(w);
    slot.wireMeshes = [];
    if (!slot.meshes.length) return;
    const mat = new THREE.MeshBasicMaterial({
      color: 0x11141a, wireframe: true, transparent: true, opacity: 0.6, depthWrite: false,
    });
    for (const m of slot.meshes) {
      let w;
      if (m.isSkinnedMesh && m.skeleton) {
        w = new THREE.SkinnedMesh(m.geometry, mat);
        w.bind(m.skeleton, m.bindMatrix);
      } else {
        w = new THREE.Mesh(m.geometry, mat);
      }
      w.position.copy(m.position);
      w.quaternion.copy(m.quaternion);
      w.scale.copy(m.scale);
      w.frustumCulled = false;
      w.renderOrder = 5;
      w.visible = false;
      w.userData.slot = slot.key;
      w.userData.wire = true;
      if (m.parent) m.parent.add(w);
      slot.wireMeshes.push(w);
    }
    this._refreshWire();
  }

  _refreshWire() {
    for (const s of SLOTS) {
      const slot = this.slots[s.key];
      for (let i = 0; i < slot.wireMeshes.length; i++) {
        const src = slot.meshes[i];
        slot.wireMeshes[i].visible = this.wireOn && !!src && src.visible;
      }
    }
  }

  setWireframe(on) {
    this.wireOn = on;
    this._refreshWire();
    this._applyClipping();
  }

  // ---- 面で捉えた頭部 ---------------------------------------------------

  _buildHeadPlanes(slot) {
    if (slot.headPlaneGroup && slot.headPlaneGroup.parent) {
      slot.headPlaneGroup.parent.remove(slot.headPlaneGroup);
    }
    slot.headPlaneGroup = null;
    slot.headPlanes = { parts: [], lines: [] };
    // 素体（人のモデル）の頭だけに付ける。骨格・筋肉モデルには付けない
    if (slot !== this.slots.skin) return;
    const head = slot.boneMap.head;
    if (!head) return;
    // 頭身を変えた後でも同じ大きさで作れるように、
    // 頭と腰の拡大をいったん等倍に戻してから縮尺を測る
    const hips = slot.boneMap.hips;
    const keepHead = head.scale.clone();
    const keepHips = hips ? hips.scale.clone() : null;
    head.scale.setScalar(1);
    if (hips) hips.scale.setScalar(1);
    head.updateWorldMatrix(true, false);
    const group = new THREE.Group();
    head.add(group);
    slot.headPlaneGroup = group;
    let neckRel = -Infinity;
    if (slot.boneMap.neck) {
      const hs2 = head.getWorldScale(new THREE.Vector3()).x || 1;
      slot.boneMap.neck.updateWorldMatrix(true, false);
      neckRel = head.worldToLocal(
        slot.boneMap.neck.getWorldPosition(new THREE.Vector3())).multiplyScalar(hs2).y;
    }
    slot.headPlanes = buildHeadPlanes(head, group, {
      box: slot.headBox,
      crownH: slot.crownBone0 || slot.crownH0,   // 頭のボーン→頭頂（上下に挟むのに使う）
      totalH: slot.totalH0,                      // 背丈（頭の高さ＝背丈÷7.5）
      headH: slot.headH0, neckRel,
    });
    head.scale.copy(keepHead);
    if (hips && keepHips) hips.scale.copy(keepHips);
    head.updateWorldMatrix(true, false);
    this._refreshHeadPlanes();
  }

  _refreshHeadPlanes() {
    for (const s of SLOTS) {
      const slot = this.slots[s.key];
      const show = this.headPlanesOn && slot === this.slots.skin
        && this.viewMode !== 'bone' && this.viewMode !== 'muscle';
      for (const p of slot.headPlanes.parts) p.visible = show;
      for (const l of slot.headPlanes.lines) l.visible = show;
    }
  }

  /** 面で捉えた頭部に差し替える。元の頭は小さくして中に隠す */
  setHeadPlanes(on) {
    this.headPlanesOn = on;
    this._applyProportions();      // 頭の縮尺をかけ直す
    this._refreshHeadPlanes();
    this._applyClipping();
    return this.headPlanesAvailable;
  }

  /** 面で捉えた頭部の当てはめ具合を一行で返す（画面に出して確かめる用） */
  headPlaneInfo() {
    const slot = this.slots.skin;
    const hp = slot && slot.headPlanes;
    if (!hp || !hp.parts.length) return '面の頭部: 作れていません';
    const r = v => (Math.round((v || 0) * 1000) / 1000).toFixed(3);
    const b = slot.headBox;
    const h1 = v => (Math.round((v || 0) * 10) / 10).toFixed(1);
    return `頭の高さ ${r(hp.headH)}m（${h1(hp.heads)}頭身）`
      + ` ／ 頭頂 ${r(hp.top)} あご ${r(hp.chin)} 首 ${r(hp.neckRel)}`
      + ` ／ ${b ? `実測(${b.source})` : '身長から算出'}`;
  }

  /** 面で捉えた頭部が今の表示で使えるか */
  get headPlanesAvailable() {
    const slot = this.slots.skin;
    return !!(slot && slot.headPlanes && slot.headPlanes.parts.length
      && this.viewMode !== 'bone' && this.viewMode !== 'muscle');
  }

  // ---- 見る範囲（体の一部だけを切り出す）--------------------------------

  /**
   * 表示する範囲を切り替える。
   * 手・足は「片側の手（足）と、前腕（すね）の手首（足首）寄りの一部」だけを描く。
   * 空間の範囲で切ると、気をつけのように手が腿の横にあるとき腿まで映るので、
   * スキンの重みで「どの骨に属する面か」を見て選ぶ。
   */
  setPartView(part, side) {
    this.partView = part || 'full';
    if (side) this.partSide = side;
    this._applyClipping();
    this.frameOn(this.partView, this.partSide);
  }

  _clipTargets() {
    const out = [];
    for (const s of SLOTS) {
      const slot = this.slots[s.key];
      for (const m of slot.meshes) out.push(m);
      for (const w of slot.wireMeshes) out.push(w);
      for (const p of slot.boneParts) out.push(p);
      for (const p of slot.headPlanes.parts) out.push(p);
      for (const l of slot.headPlanes.lines) out.push(l);
    }
    return out;
  }

  get _partOn() { return this.partView === 'hand' || this.partView === 'foot'; }

  /** 手・足だけを見るときに残すボーン（前腕／すね と、その先すべて） */
  _partBones(slot) {
    if (!this._partOn || !slot.skeleton) return null;
    const isHand = this.partView === 'hand';
    const start = slot.boneMap[(isHand ? 'forearm' : 'shin') + this.partSide]
      || slot.boneMap[(isHand ? 'hand' : 'foot') + this.partSide];
    if (!start) return null;
    const set = new Set();
    (function walk(b) {
      set.add(b);
      for (const c of b.children) if (c.isBone) walk(c);
    })(start);
    return set;
  }

  /**
   * 残すボーンに属する三角形だけを描くよう、形状のインデックスを差し替える。
   * 表示・非表示のフラグには触らないので、ほかの切り替えとぶつからない。
   */
  _maskObject(o, keep) {
    const g = o.geometry;
    if (!g || !g.attributes || !g.attributes.position) return;
    const ud = g.userData;
    if (!ud.maskReady) {
      // インデックスのない形は、全部を指すインデックスを作っておく（あとで戻せるように）
      if (!g.index) {
        const n0 = g.attributes.position.count;
        const all = new (n0 > 65535 ? Uint32Array : Uint16Array)(n0);
        for (let i = 0; i < n0; i++) all[i] = i;
        g.setIndex(new THREE.BufferAttribute(all, 1));
      }
      ud.fullIndex = g.index; ud.maskReady = true; ud.masks = {}; ud.maskKey = 'full';
    }
    // 面の線（ワイヤー表示）は three.js がインデックスの版数で作り直すかを決めるので、
    // 差し替えるたびに版数を必ず増やす（増やさないと、手だけにしても線が全身ぶん残る）
    const swap = idx => { Viewer._maskVer = (Viewer._maskVer || 1000) + 1; idx.version = Viewer._maskVer; g.setIndex(idx); };
    if (!keep) {
      if (ud.maskKey !== 'full') { swap(ud.fullIndex); ud.maskKey = 'full'; }
      return;
    }
    const n = g.attributes.position.count;
    const src = ud.fullIndex ? ud.fullIndex.array : null;
    const isSkin = o.isSkinnedMesh && o.skeleton && g.attributes.skinIndex && g.attributes.skinWeight;
    let key;
    if (isSkin) {
      key = this.partView + this.partSide;
    } else {
      // スキンでないもの（パーツ分けのモデル・骨格表示・面の頭部）は、
      // 残すボーンの下にぶら下がっているかどうかで丸ごと出し入れする
      let inside = false;
      for (let p = o.parent; p; p = p.parent) if (keep.has(p)) { inside = true; break; }
      key = inside ? 'full' : 'none';
      if (key === 'full') {
        if (ud.maskKey !== 'full') { swap(ud.fullIndex); ud.maskKey = 'full'; }
        return;
      }
    }
    if (ud.maskKey === key) return;
    let idx = ud.masks[key];
    if (!idx) {
      const out = [];
      if (isSkin) {
        const bones = o.skeleton.bones;
        const keepIdx = new Uint8Array(bones.length);
        bones.forEach((b, i) => { if (keep.has(b)) keepIdx[i] = 1; });
        const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
        const w = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          let sum = 0;
          for (let k = 0; k < 4; k++) if (keepIdx[si.getComponent(i, k)]) sum += sw.getComponent(i, k);
          w[i] = sum;
        }
        const per = o.isLineSegments ? 2 : 3;
        const count = src ? src.length : n;
        for (let t = 0; t + per <= count; t += per) {
          let mx = 0;
          for (let k = 0; k < per; k++) mx = Math.max(mx, w[src ? src[t + k] : t + k]);
          if (mx >= 0.5) for (let k = 0; k < per; k++) out.push(src ? src[t + k] : t + k);
        }
      }
      idx = new THREE.BufferAttribute(n > 65535 ? new Uint32Array(out) : new Uint16Array(out), 1);
      ud.masks[key] = idx;
    }
    swap(idx);
    ud.maskKey = key;
  }

  _applyClipping() {
    const on = this._partOn;
    const planes = on ? [this.clipPlane] : null;
    const keepBy = new Map();
    for (const s of SLOTS) keepBy.set(s.key, this._partBones(this.slots[s.key]));
    for (const s of SLOTS) {
      const slot = this.slots[s.key];
      const keep = keepBy.get(s.key);
      const list = [...slot.meshes, ...slot.wireMeshes, ...slot.boneParts,
        ...slot.headPlanes.parts, ...slot.headPlanes.lines];
      for (const o of list) guard('見る範囲', () => this._maskObject(o, on ? keep : null));
    }
    for (const o of this._clipTargets()) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mat of mats) {
        if (!mat) continue;
        mat.clippingPlanes = planes;
        mat.clipShadows = true;
        if (!o.userData.keepSide) mat.side = on ? THREE.DoubleSide : THREE.FrontSide;
        mat.needsUpdate = true;
      }
    }
    this._updateClipPlane();
  }

  /** 切る面を、いまの姿勢に合わせて動かす（前腕／すねの途中で切る） */
  _updateClipPlane() {
    if (!this._partOn) return;
    const p = this.primarySlot;
    if (!p) return;
    const isHand = this.partView === 'hand';
    const fromKey = (isHand ? 'forearm' : 'shin') + this.partSide;
    const toKey = (isHand ? 'hand' : 'foot') + this.partSide;
    const a = p.boneMap[fromKey], b = p.boneMap[toKey];
    if (!a || !b) return;
    const pa = a.getWorldPosition(new THREE.Vector3());
    const pb = b.getWorldPosition(new THREE.Vector3());
    const dir = pb.clone().sub(pa);
    const len = dir.length();
    if (len < 1e-6) return;
    dir.divideScalar(len);
    // 手首から前腕の 4 割、足首からすねの 3.5 割だけ残す（腕・脚とのつながりが分かる）
    const cut = pb.clone().addScaledVector(dir, -len * (isHand ? 0.40 : 0.35));
    this.clipPlane.setFromNormalAndCoplanarPoint(dir, cut);
  }

  /**
   * 体型・頭身を変えたあとに呼ばれる。骨格は基準姿勢で組んでボーンの子にしてあり、
   * ボーンの伸び縮みにそのまま付いていくので、まだ作っていないときだけ作る。
   */
  rebuildBoneViews() {
    for (const s of SLOTS) {
      const slot = this.slots[s.key];
      if (slot.skeleton && !slot.boneParts.length && !slot.boneDirty) guard('骨格の作り直し', () => this._buildBoneView(slot));
    }
  }


  /**
   * 手の向き（いまの姿勢）。指の骨の位置から求める。
   *   along  … 手首から中指の付け根へ
   *   radial … 小指側から親指側へ（手のひらの面の中）
   *   palmar … 手のひらが向いている側
   */
  _handFrame(slot, side) {
    const hand = slot && slot.boneMap['hand' + side];
    const fg = slot && slot.fingers && slot.fingers[side];
    if (!hand || !fg) return null;
    const P = b => b.getWorldPosition(new THREE.Vector3());
    const base = f => fg[f] && fg[f][1];
    const mid = base('middle') || base('index') || base('ring');
    const rad = base('index') || base('middle');
    const uln = base('pinky') || base('ring');
    if (!mid || !rad || !uln || rad === uln) return null;
    const o = P(hand);
    const along = P(mid).sub(o);
    if (along.lengthSq() < 1e-12) return null;
    along.normalize();
    const radial = P(rad).sub(P(uln));
    radial.addScaledVector(along, -radial.dot(along));
    if (radial.lengthSq() < 1e-12) return null;
    radial.normalize();
    const palmar = new THREE.Vector3().crossVectors(along, radial)
      .multiplyScalar(side === 'L' ? 1 : -1);
    return { origin: o, along, radial, palmar };
  }

  /** 手だけ・足だけで追いかける骨（手・足のボーン）のいまの位置と向き */
  _partFrame() {
    if (!this._partOn) return null;
    const p = this.primarySlot;
    const b = p && p.boneMap[(this.partView === 'hand' ? 'hand' : 'foot') + this.partSide];
    if (!b) return null;
    return { pos: b.getWorldPosition(new THREE.Vector3()), quat: b.getWorldQuaternion(new THREE.Quaternion()) };
  }

  /**
   * 手だけ・足だけのときは、カメラを手（足）に固定する。
   * 全身のポーズを変えて手が動いても、手との位置関係（見ている向き・距離）はそのまま。
   * 指で回したぶんは OrbitControls がそのまま足し込む。
   */
  _followPart() {
    const f = this._partFrame();
    const prev = this._prevPartFrame;
    if (f && prev) {
      const q = f.quat.clone().multiply(prev.quat.clone().invert());
      const moved = f.pos.distanceToSquared(prev.pos) > 1e-12 || Math.abs(q.w) < 0.9999999;
      if (moved) {
        for (const v of [this.camera.position, this.controls.target]) v.sub(prev.pos).applyQuaternion(q).add(f.pos);
        // 画面の上下も手に合わせて回す（手が画面の中で傾かない）
        this.camera.up.applyQuaternion(q).normalize();
        this._syncControlsUp();
      }
    }
    if (!f && this.camera.up.y < 0.9999) this._resetUp();
    this._prevPartFrame = f;
    this.controls.minDistance = f ? 0.12 : 0.4;
  }

  /** OrbitControls が使う「上」をカメラの上に合わせ直す（r169 の内部の値を更新する） */
  _syncControlsUp() {
    const c = this.controls;
    if (c && c._quat && c._quatInverse) {
      c._quat.setFromUnitVectors(this.camera.up, new THREE.Vector3(0, 1, 0));
      c._quatInverse.copy(c._quat).invert();
    }
  }

  /** 画面の上を真上に戻す */
  _resetUp() {
    this.camera.up.set(0, 1, 0);
    this._syncControlsUp();
  }

  /**
   * いろいろな画角から見る（クロッキー用）。
   * az … 体の正面から右回りの角度、el … 見上げ(-)・見下ろし(+)、mm … レンズの焦点距離
   */
  viewFromAngle(az, el, mm) {
    if (mm) this.setLens(mm);
    this._resetUp();
    const a = az * DEG, e = el * DEG;
    const dir = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
    const fov = this.camera.fov * DEG;
    const aspect = Math.max(0.3, this.camera.aspect || 1);
    let center, radius;
    const f = this._partFrame();
    if (f) {
      // 手・足は骨の向きを基準に回す（手のどの面を見せるかを変える）
      dir.applyQuaternion(f.quat);
      center = this.controls.target.clone();
      radius = this.partView === 'hand' ? 0.16 * this.handScale : 0.2;
    } else {
      const p = this.primarySlot;
      if (!p) return;
      p.pivot.updateWorldMatrix(true, true);
      const box = new THREE.Box3();
      for (const m of p.meshes) if (m.visible) box.expandByObject(m);
      if (box.isEmpty()) box.setFromObject(p.root);
      if (this.partView === 'upper' && p.boneMap.chest) {
        center = p.boneMap.chest.getWorldPosition(new THREE.Vector3()); radius = 0.55;
      } else if (this.partView === 'face' && p.boneMap.head) {
        center = p.boneMap.head.getWorldPosition(new THREE.Vector3()); center.y += 0.08; radius = 0.2;
      } else {
        center = box.getCenter(new THREE.Vector3());
        radius = box.getSize(new THREE.Vector3()).length() * 0.5;
      }
    }
    const half = Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * aspect)) / 2;
    const dist = radius / Math.sin(half) * 0.74;   // 外接球より少し寄せて、体が画面いっぱいに入るように
    this.controls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(dir, dist);
    this.controls.update();
    this._prevPartFrame = this._partFrame();
  }

  /** 見る範囲をカメラで切り替える */
  frameOn(part, side) {
    this._resetUp();
    const p = this.primarySlot;
    const at = new THREE.Vector3(0, 0.95, 0);
    let dist = 3.4;
    let dir = new THREE.Vector3(0, 0.08, 1);
    const posOf = key => {
      const b = p && p.boneMap[key];
      return b ? b.getWorldPosition(new THREE.Vector3()) : null;
    };
    const sd = side || this.partSide;
    if (part === 'upper') {
      const c = posOf('chest');
      if (c) { at.copy(c); dist = 1.5; }
    } else if (part === 'face') {
      const hd = posOf('head');
      if (hd) { at.copy(hd); at.y += 0.09; dist = 0.55; }
    } else if (part === 'hand') {
      // 手の甲の斜め（親指側）から見る。手の形と手首のつながりがいちばん分かる向き
      const hn = posOf('hand' + sd);
      const fg = p && p.fingers && p.fingers[sd];
      const tipBone = fg && fg.middle && (fg.middle[3] || fg.middle[2] || fg.middle[1]);
      if (hn) {
        at.copy(hn);
        if (tipBone) at.lerp(tipBone.getWorldPosition(new THREE.Vector3()), 0.25);
        dist = 0.62 * this.handScale;
        const hf = this._handFrame(p, sd);
        if (hf) {
          dir = hf.palmar.clone().negate().multiplyScalar(0.8)
            .addScaledVector(hf.radial, 0.45).add(new THREE.Vector3(0, 0.25, 0));
        }
      }
    } else if (part === 'foot') {
      // 足は外くるぶし側の斜め前から見る（かかと・土踏まず・足首が一度に見える）
      const ft = posOf('foot' + sd);
      if (ft) {
        at.copy(ft);
        const fb = p.boneMap['foot' + sd];
        const toe = fb.children.find(c => c.isBone);
        if (toe) {
          const tp = toe.getWorldPosition(new THREE.Vector3());
          at.lerp(tp, 0.45);
          const fwd = tp.clone().sub(ft); fwd.y = 0;
          if (fwd.lengthSq() > 1e-10) {
            fwd.normalize();
            const lat = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0))
              .multiplyScalar(sd === 'L' ? -1 : 1);
            dir = fwd.multiplyScalar(0.75).addScaledVector(lat, 0.6).add(new THREE.Vector3(0, 0.4, 0));
          }
        }
        dist = 0.75;
      }
    }
    dir.normalize();
    this.controls.target.copy(at);
    this.camera.position.copy(at).addScaledVector(dir, dist);
    this.controls.update();
    this._prevPartFrame = this._partFrame();
  }

  frameModel() {
    this._resetUp();
    this.controls.target.set(0, 0.95, 0);
    this.camera.position.set(0, 1.15, 3.4);
    this.controls.update();
  }

  // ---- 簡易骨格 -----------------------------------------------------------

  /**
   * 骨格表示を作り直す印を付ける。組み立ては重い（iPad で 1〜2 秒）ので、
   * 実際に骨格を表示するときに初めて組み立てる。
   */
  _buildBoneView(slot) {
    for (const p of slot.boneParts) if (p.parent) p.parent.remove(p);
    slot.boneParts = [];
    if (slot.skullGroup && slot.skullGroup.parent) slot.skullGroup.parent.remove(slot.skullGroup);
    slot.skullGroup = null;
    slot.boneDirty = !!slot.skeleton;
    this._refreshBoneView();
  }

  /** 骨格を今すぐ組み立てる */
  _assembleBoneView(slot) {
    slot.boneDirty = false;
    if (!slot.skeleton || !slot.neutralWorld) return;
    // 骨格は基準姿勢（ポーズなし・倍率 1）で組み立てる。組んだ後はボーンの子として一緒に動く。
    const bones = slot.skeleton.bones;
    const saved = bones.map(b => [b.position.clone(), b.quaternion.clone(), b.scale.clone()]);
    for (const b of bones) {
      const nb = slot.neutralWorld.get(b), np = slot.neutralParent.get(b);
      if (nb && np) b.quaternion.copy(np.clone().invert().multiply(nb));
      const rp = slot.restPos && slot.restPos.get(b);
      if (rp) b.position.copy(rp);
      b.scale.setScalar(1);
    }
    slot.pivot.updateWorldMatrix(true, true);
    try {
      // 頭の骨は、面で捉えた頭部のときに元の頭を縮めても大きさが変わらないよう、別の入れ物に入れる
      const head = slot.boneMap.head;
      if (head) {
        slot.skullGroup = new THREE.Group();
        slot.skullGroup.userData.bonePart = true;
        head.add(slot.skullGroup);
        slot.skullGroup.updateWorldMatrix(true, false);
      }
      const handFrame = { L: this._handFrame(slot, 'L'), R: this._handFrame(slot, 'R') };
      slot.boneParts = buildSkeletonView(slot, { handFrame, skullGroup: slot.skullGroup });
    } finally {
      bones.forEach((b, i) => { b.position.copy(saved[i][0]); b.quaternion.copy(saved[i][1]); b.scale.copy(saved[i][2]); });
      slot.pivot.updateWorldMatrix(true, true);
    }
    // 面で捉えた頭部で元の頭を縮めていても、頭の骨は元の大きさに戻す
    this._applyProportions();
    this._applyClipping();
  }

  _refreshBoneView() {
    const p = this.primarySlot;
    const on = this.boneViewOn || this.showBuiltinSkeleton;
    if (on && p && p.boneDirty && !this._boneBuilding) {
      // 先に「組み立て中」を出してから、次の描画のあとで組み立てる
      this._boneBuilding = true;
      this.onNotice('骨格を組み立てています…');
      setTimeout(() => {
        guard('骨格の生成', () => this._assembleBoneView(p));
        this._boneBuilding = false;
        this.onNotice('');
        this._refreshBoneView();
      }, 40);
    }
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
    this._refreshWire();
    this._refreshHeadPlanes();
    this._applyClipping();
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
    this._applyClipping();
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

  /** 指の骨がいくつ使えるか */
  fingerBoneCount() {
    const p = this.primarySlot;
    return p ? fingerCount(p.fingers) : 0;
  }

  /**
   * 手の形を当てる。spec は左手基準（"index1:-88,0,-3 ..."）。
   * @param {'L'|'R'|'both'} side
   */
  applyHandShape(side, spec) {
    const sides = side === 'both' ? ['L', 'R'] : [side];
    for (const sd of sides) this.handShape[sd] = spec;
    guard('手の形', () => {
      const angles = parseFingerSpec(spec);
      const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), q3 = new THREE.Quaternion();
      for (const sd of sides) {
        for (const s of SLOTS) {
          const slot = this.slots[s.key];
          const set = slot.fingers[sd];
          if (!set || !slot.fingerAxes) continue;
          for (const finger of Object.keys(set)) {
            for (const segStr of Object.keys(set[finger])) {
              const bone = set[finger][segStr];
              const nb = slot.neutralWorld.get(bone);
              const np = slot.neutralParent.get(bone);
              const ax = slot.fingerAxes.get(bone);
              if (!nb || !np || !ax) continue;
              const a = angles[finger + segStr] || { x: 0, y: 0, z: 0 };
              // X はマイナスで曲げる（Swift版からの書式を引き継ぐ）
              q1.setFromAxisAngle(ax.flex, -a.x * DEG);
              q2.setFromAxisAngle(ax.spread, a.z * DEG);
              q3.setFromAxisAngle(ax.twist, a.y * DEG);
              const delta = q1.clone().multiply(q2).multiply(q3);
              bone.quaternion.copy(np).invert().multiply(delta).multiply(nb);
            }
          }
        }
      }
      this.container.updateWorldMatrix(true, true);
    });
  }

  /** 読み込み直後や基準姿勢の作り直しのあとに、今の手の形をかけ直す */
  _reapplyHandShapes() {
    for (const sd of ['L', 'R']) {
      if (this.handShape[sd]) this.applyHandShape(sd, this.handShape[sd]);
    }
  }

  /** 顔の向き・表情。指定された関節だけを書き換える */
  applyFacePreset(spec) {
    const map = parseSpec(spec);
    for (const k of ['head', 'neck', 'jaw']) {
      this.angles[k] = map[k] ? { x: map[k].x || 0, y: map[k].y || 0, z: map[k].z || 0 } : { x: 0, y: 0, z: 0 };
      if (this.limitsEnabled) Object.assign(this.angles[k], clampAngles(k, this.angles[k]));
    }
    this.applyAll();
  }

  /** 四元数から qx·qz·qy 順のオイラー角（度）を取り出す */
  static eulerXZY(q) {
    const e = new THREE.Matrix4().makeRotationFromQuaternion(q).elements;
    const m00 = e[0], m01 = e[4], m02 = e[8];
    const m10 = e[1], m11 = e[5];
    const m20 = e[2], m21 = e[6];
    const sc = Math.max(-1, Math.min(1, -m01));
    const c = Math.asin(sc);
    let a, b;
    if (Math.abs(sc) < 0.9995) {
      b = Math.atan2(m02, m00);
      a = Math.atan2(m21, m11);
    } else {                         // 軸が重なったとき
      b = 0;
      a = Math.atan2(-m20, m10 * (sc > 0 ? 1 : -1));
    }
    return { x: a / DEG, y: b / DEG, z: c / DEG };
  }

  _sideSign(slot) {
    const L = slot.boneMap.shoulderL || slot.boneMap.upperArmL || slot.boneMap.thighL;
    const R = slot.boneMap.shoulderR || slot.boneMap.upperArmR || slot.boneMap.thighR;
    if (!L || !R) return 1;
    return L.getWorldPosition(new THREE.Vector3()).x >= R.getWorldPosition(new THREE.Vector3()).x ? 1 : -1;
  }

  /** いまのポーズの骨の向きを取り出す（逆算の検算にも使う） */
  currentDirections() {
    const p = this.primarySlot;
    if (!p) return {};
    const out = {};
    const pairs = [['spine', 'chest'], ['chest', 'neck'], ['neck', 'head'],
      ['shoulderL', 'upperArmL'], ['upperArmL', 'forearmL'], ['forearmL', 'handL'],
      ['shoulderR', 'upperArmR'], ['upperArmR', 'forearmR'], ['forearmR', 'handR'],
      ['thighL', 'shinL'], ['shinL', 'footL'], ['thighR', 'shinR'], ['shinR', 'footR']];
    for (const [a, b] of pairs) {
      const d = this._boneDirection(p, a, b);
      if (d) out[a] = d;
    }
    const hips = p.boneMap.hips, sl = p.boneMap.shoulderL, sr = p.boneMap.shoulderR, ch = p.boneMap.chest;
    if (hips && sl && sr && ch) {
      const hp = hips.getWorldPosition(new THREE.Vector3());
      const cp = ch.getWorldPosition(new THREE.Vector3());
      out.hips = {
        up: cp.sub(hp).normalize(),
        left: sl.getWorldPosition(new THREE.Vector3())
          .sub(sr.getWorldPosition(new THREE.Vector3())).normalize(),
      };
    }
    return out;
  }

  /**
   * 測った骨の向きから関節角度を逆算して当てる。
   *
   * 向きだけでは骨の「ひねり」が決まらない。そしてひじ・ひざの曲がる向きは
   * 親（上腕・腿）のひねりで決まるので、親子をまとめて解く。
   *
   * @param {Object} dirs 関節キー -> 向き（THREE.Vector3）。hips は {up,left} の全身の向き。
   * @returns {number} 当てられた関節の数
   */
  applyDetectedPose(dirs) {
    const p = this.primarySlot;
    if (!p || !p.skeleton) return 0;
    let applied = 0;
    this.lastSolveReport = [];

    const ORDER_SOLVE = ['hips', 'spine', 'chest', 'neck',
      'shoulderL', 'upperArmL', 'forearmL', 'shoulderR', 'upperArmR', 'forearmR',
      'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
    const HINGE_CHILD = {
      shoulderL: 'upperArmL', shoulderR: 'upperArmR',
      upperArmL: 'forearmL', upperArmR: 'forearmR',
      thighL: 'shinL', thighR: 'shinR',
      shinL: 'footL', shinR: 'footR',
    };
    const CHILD_OF = Object.fromEntries(restTargets(1).map(([a, b]) => [a, b]));
    const targets = Object.fromEntries(restTargets(this._sideSign(p)).map(([a, b, t]) => [a, t]));

    const TWISTS = [0];
    for (let t = 5; t <= 180; t += 5) TWISTS.push(t, -t);

    /** その関節の「基準からの回転」を作る。ひねり t を足せる */
    const rotationFor = (key, t) => {
      if (key === 'hips') {
        const f = dirs.hips;
        if (!f || !f.up || !f.left) return null;
        const up = f.up.clone().normalize();
        const left = f.left.clone().addScaledVector(up, -f.left.dot(up));
        if (left.lengthSq() < 1e-6) return null;
        left.normalize();
        const fwd = new THREE.Vector3().crossVectors(left, up);
        return { F: new THREE.Quaternion().setFromRotationMatrix(
          new THREE.Matrix4().makeBasis(left, up, fwd)), axis: null };
      }
      const d = dirs[key];
      const rest = targets[key];
      if (!d || !rest || d.lengthSq() < 1e-8) return null;
      const axis = d.clone().normalize();
      const F = new THREE.Quaternion().setFromUnitVectors(rest.clone().normalize(), axis);
      if (t) F.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, t * DEG));
      return { F, axis };
    };

    /** いまの親の向きを使って、角度候補とはみ出し量を出す */
    const candidate = (key, t) => {
      const bone = p.boneMap[key];
      if (!bone) return null;
      const nb = p.neutralWorld.get(bone);
      const np = p.neutralParent.get(bone);
      if (!nb || !np) return null;
      const r = rotationFor(key, t);
      if (!r) return null;
      const pc = new THREE.Quaternion();
      if (bone.parent) bone.parent.getWorldQuaternion(pc);
      const delta = np.clone().multiply(pc.invert()).multiply(r.F);
      const a1 = Viewer.eulerXZY(delta);
      const a2 = { x: wrapDeg(a1.x + 180), y: wrapDeg(a1.y + 180), z: wrapDeg(180 - a1.z) };
      const e1 = limitExcess(key, a1), e2 = limitExcess(key, a2);
      return e2 < e1 ? { a: a2, ex: e2, twistable: !!r.axis } : { a: a1, ex: e1, twistable: !!r.axis };
    };

    /** その関節だけを実際に反映する（子を解くために先に効かせる） */
    const applyOne = (key, a) => {
      const d2 = new THREE.Quaternion().setFromAxisAngle(AX, a.x * DEG)
        .multiply(new THREE.Quaternion().setFromAxisAngle(AZ, a.z * DEG))
        .multiply(new THREE.Quaternion().setFromAxisAngle(AY, a.y * DEG));
      for (const sl of SLOTS) {
        const slot = this.slots[sl.key];
        const b2 = slot.boneMap[key];
        if (!b2) continue;
        const n2 = slot.neutralWorld.get(b2), p2 = slot.neutralParent.get(b2);
        if (!n2 || !p2) continue;
        b2.quaternion.copy(p2).invert().multiply(d2).multiply(n2);
      }
      this.container.updateWorldMatrix(true, true);
    };

    /** その関節が狙った向きからどれだけずれているか（度） */
    const dirError = (key) => {
      const childKey = CHILD_OF[key];
      const want = dirs[key];
      if (!childKey || !want || typeof want.dot !== 'function') return 0;
      const got = this._boneDirection(p, key, childKey);
      if (!got) return 0;
      const dot = Math.max(-1, Math.min(1, got.dot(want.clone().normalize())));
      return Math.acos(dot) * 180 / Math.PI;
    };

    guard('ポーズの逆算', () => {
      this.container.updateWorldMatrix(true, true);
      for (const key of ORDER_SOLVE) {
        if (!p.boneMap[key]) continue;
        const child = HINGE_CHILD[key];
        const coupled = child && dirs[child] && p.boneMap[child];

        let best = null;
        const first = candidate(key, 0);
        if (!first) continue;
        const list = first.twistable ? TWISTS : [0];

        for (const t of list) {
          const cand = t === 0 ? first : candidate(key, t);
          if (!cand) continue;
          // 実際に可動域へ収めたうえで、狙った向きにどれだけ近いかで採点する
          const a = this.limitsEnabled ? clampAngles(key, cand.a) : cand.a;
          applyOne(key, a);
          let total = dirError(key);
          if (coupled) {
            const c = candidate(child, 0);
            if (c) {
              const ca = this.limitsEnabled ? clampAngles(child, c.a) : c.a;
              applyOne(child, ca);
              total += dirError(child);
            } else {
              total += 90;
            }
          }
          if (!best || total < best.total) best = { total, a };
          if (total <= 0.05) break;
        }
        if (!best) continue;

        this.angles[key] = best.a;
        applyOne(key, this.angles[key]);
        this.lastSolveReport.push({ key, excess: +best.total.toFixed(1) });
        applied += 1;
      }
    });
    this.applyAll();
    return applied;
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
    if (this._arrowOn) this._placeLightArrow();
  }

  /**
   * 光の向きを変えている間だけ、人形のそばに「光の矢印」を出す。
   * 矢印の根元が光の来るところ、先が光の当たる先（見ている中心）。
   */
  showLightArrow(on) {
    if (!this.lightArrow) {
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: 0xffd84d, transparent: true, opacity: 0.92, depthTest: false });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 10), mat);
      shaft.position.y = 0.5;
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 14), mat);
      head.position.y = 1.0;
      const sun = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), mat);
      g.add(shaft, head, sun);
      g.renderOrder = 999;
      g.traverse(o => { o.raycast = () => {}; o.renderOrder = 999; o.castShadow = false; });
      g.visible = false;
      this.scene.add(g);
      this.lightArrow = g;
      this._arrowParts = { shaft, head, sun };
    }
    this._arrowOn = on;
    clearTimeout(this._arrowTimer);
    if (on) { this.lightArrow.visible = true; this._placeLightArrow(); }
    else this._arrowTimer = setTimeout(() => { this.lightArrow.visible = false; }, 900);
  }

  _placeLightArrow() {
    const g = this.lightArrow;
    if (!g) return;
    const tgt = this.controls.target;
    const dist = this.camera.position.distanceTo(tgt);
    const len = dist * 0.32;
    const d = new THREE.Vector3(
      Math.cos(this.lightElevation * DEG) * Math.sin(this.lightAzimuth * DEG),
      Math.sin(this.lightElevation * DEG),
      Math.cos(this.lightElevation * DEG) * Math.cos(this.lightAzimuth * DEG));
    // 根元（光の来るところ）から中心の少し手前まで
    const from = tgt.clone().addScaledVector(d, len * 1.25);
    g.position.copy(from);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().negate());
    const { shaft, head, sun } = this._arrowParts;
    const L = len * 0.95;
    shaft.scale.set(dist * 0.25, L - len * 0.12, dist * 0.25);
    shaft.position.y = (L - len * 0.12) / 2;
    head.scale.setScalar(dist * 0.25);
    head.position.y = L - len * 0.06;
    sun.scale.setScalar(dist * 0.3);
  }

  setLightIntensity(v) { this.keyLight.intensity = v; }
  setFillIntensity(v) { this.fillLight.intensity = v; }
  setShadowSoftness(v) { this.keyLight.shadow.radius = v; }
  setExposure(v) { this.renderer.toneMappingExposure = v; }
  setEnvIntensity(v) { if ('environmentIntensity' in this.scene) this.scene.environmentIntensity = v; }
  setGridVisible(on) { this.grid.visible = on; }
  setUIHidden(on) { this.marker.visible = on ? false : !!(this.selected && this._boneForJoint(this.selected)); }
  setLens(mm) {
    this.lensMM = mm;
    this.camera.fov = 2 * Math.atan(12 / mm) * (180 / Math.PI);
    this.camera.updateProjectionMatrix();
  }
}

export const THREE_REVISION = THREE.REVISION;
export { JOINTS, JOINT_BY_KEY, JOINT_GROUPS };
