// outfit.js — 服と髪（素体に着せる簡単な形）
//
// ・服 … 素体の表面をそのまま写して少し外へふくらませ、骨と一緒に動く網（スキン付き）にする。
//         上: Tシャツ・長袖・タンクトップ ／ 下: ズボン・短パン・スカート（スカートは腰と一緒に動く円すい）
//         男性・女性の体つき（モーフ）も、元の素体と同じようにかかる
// ・髪 … 頭の骨に付ける固い形。ショート・ボブ・ロング・ポニーテール・おだんご
//         頭の大きさ（素体の頭の頂点）に合わせて作るので、頭身を変えても頭と一緒に大きさが変わる
// ・素体（skin）の人形にだけ着せる。2 体目は、写したときに一緒に写る

import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export const OUTFIT_TOPS = [
  { key: 'none', name: 'なし' }, { key: 'tshirt', name: 'Tシャツ' }, { key: 'long', name: '長袖' }, { key: 'tank', name: 'タンクトップ' },
];
export const OUTFIT_BOTTOMS = [
  { key: 'none', name: 'なし' }, { key: 'pants', name: 'ズボン' }, { key: 'shorts', name: '短パン' }, { key: 'skirt', name: 'スカート' },
];
export const OUTFIT_HAIRS = [
  { key: 'none', name: 'なし' }, { key: 'short', name: 'ショート' }, { key: 'bob', name: 'ボブ' }, { key: 'long', name: 'ロング' },
  { key: 'pony', name: 'ポニーテール' }, { key: 'bun', name: 'おだんご' },
];

// 色（描くときに部分が分かれて見えるように、はっきり違う色）
const COL = { top: 0x7f9cc9, bottom: 0x3f4a5c, skirt: 0x8a5f86, hair: 0x3a2c25 };

export class Outfit {
  constructor(viewer) {
    this.v = viewer;
    this.state = { top: 'none', bottom: 'none', hair: 'none' };
    this.meshes = [];   // 服（スキン付き）
    this.hair = null;   // 髪（頭の骨の子）
    this.mats = {
      top: new THREE.MeshStandardMaterial({ color: COL.top, roughness: 0.85, side: THREE.DoubleSide }),
      bottom: new THREE.MeshStandardMaterial({ color: COL.bottom, roughness: 0.85, side: THREE.DoubleSide }),
      skirt: new THREE.MeshStandardMaterial({ color: COL.skirt, roughness: 0.85, side: THREE.DoubleSide }),
      hair: new THREE.MeshStandardMaterial({ color: COL.hair, roughness: 0.7, side: THREE.DoubleSide }),
    };
  }

  get slot() { const s = this.v.slots && this.v.slots.skin; return s && s.loaded && s.skeleton ? s : null; }

  /** 着せる（state の一部だけでもよい）。素体を読み込む前なら、読み込んでから着せる */
  set(state) {
    Object.assign(this.state, state || {});
    const slot = this.slot;
    if (!slot) { this._pending = true; return false; }
    this._pending = false;
    this.clear();
    try {
      if (this.state.top !== 'none') this._cloth(slot, 'top', this.state.top);
      if (this.state.bottom === 'skirt') this._skirt(slot);
      else if (this.state.bottom !== 'none') this._cloth(slot, 'bottom', this.state.bottom);
      if (this.state.hair !== 'none') this._hair(slot, this.state.hair);
    } catch (e) { console.warn('服と髪', e); }
    slot.clothes = this.meshes;
    // 女性の乳房（別の部品）も、上の服の色で覆う
    this.v.breastCover = this.state.top !== 'none' ? this.mats.top : null;
    this.v.applyAll && this.v.applyAll();
    if (this.v.markSecondDirty) this.v.markSecondDirty();
    return true;
  }

  /** 素体を読み込み直したときなど */
  refresh() { if (this._pending || this.meshes.length || this.hair) this.set({}); }

  clear() {
    for (const m of this.meshes) { m.parent && m.parent.remove(m); m.geometry.dispose(); }
    this.meshes = [];
    if (this.hair) { this.hair.parent && this.hair.parent.remove(this.hair); this.hair.traverse(o => o.geometry && o.geometry.dispose()); this.hair = null; }
    const slot = this.v.slots && this.v.slots.skin;
    if (slot) slot.clothes = [];
  }

  // ---- 骨の情報（素体の形を作ったときの姿勢 = バインドの姿勢で） ----
  _bind(slot, mesh) {
    const sk = mesh.skeleton;
    const keyOf = new Map(Object.entries(slot.boneMap).map(([k, b]) => [b, k]));
    // 名前の付いていない骨（指・背骨の途中など）は、名前の付いた親の骨にまとめる
    const boneKey = sk.bones.map(b => { let o = b; while (o && !keyOf.has(o)) o = o.parent; return o ? keyOf.get(o) : null; });
    const bindPos = sk.boneInverses.map(m => V().setFromMatrixPosition(m.clone().invert()));
    const P = k => { const i = sk.bones.indexOf(slot.boneMap[k]); return i >= 0 ? bindPos[i] : null; };
    return { sk, boneKey, P };
  }

  // 素体の表面を写して、決めた所だけの服にする
  _cloth(slot, part, kind) {
    const src = slot.meshes.filter(m => m.isSkinnedMesh);
    for (const mesh of src) {
      const { boneKey, P } = this._bind(slot, mesh);
      const hips = P('hips'), chest = P('chest') || P('spine');
      if (!hips || !chest) continue;
      const U = hips.distanceTo(chest);                 // 骨の空間の長さの目安（腰〜胸）
      const g0 = mesh.geometry;
      const pos = g0.attributes.position, nor = g0.attributes.normal, si = g0.attributes.skinIndex, sw = g0.attributes.skinWeight;
      const bm = mesh.bindMatrix, sb = bm.getMaxScaleOnAxis() || 1;
      const p = V();
      // 骨の線の上での位置（0: 付け根 … 1: 次の関節）
      const along = (q, a, b) => { const A = P(a), B = P(b); if (!A || !B) return 0; const d = V().subVectors(B, A); return V().subVectors(q, A).dot(d) / d.lengthSq(); };
      const waistY = hips.y + 0.32 * U, hemY = hips.y - 0.12 * U;
      const keep = new Uint8Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        // いちばん重い骨
        let bi = 0, bw = -1;
        for (let c = 0; c < 4; c++) { const w = sw.getComponent(i, c); if (w > bw) { bw = w; bi = si.getComponent(i, c); } }
        const k = boneKey[bi];
        if (!k) continue;
        p.fromBufferAttribute(pos, i).applyMatrix4(bm);
        let on = false;
        const side = /L$/.test(k) ? 'L' : /R$/.test(k) ? 'R' : '';
        if (part === 'top') {
          if (k === 'spine' || k === 'chest') on = true;
          else if (k === 'hips') on = p.y > hemY;
          else if (k === 'neck') on = along(p, 'neck', 'head') < 0.18;
          else if (/^shoulder/.test(k)) on = kind !== 'tank';
          else if (/^upperArm/.test(k)) on = kind === 'long' || (kind === 'tshirt' && along(p, 'upperArm' + side, 'forearm' + side) < 0.45);
          else if (/^forearm/.test(k)) on = kind === 'long' && along(p, 'forearm' + side, 'hand' + side) < 0.93;
          // タンクトップ: 肩の端は出す
          if (on && kind === 'tank' && (k === 'chest' || k === 'spine') && Math.abs(p.x - chest.x) > U * 0.42 && p.y > chest.y + U * 0.15) on = false;
        } else {
          if (k === 'hips') on = p.y < waistY;
          else if (k === 'spine') on = p.y < waistY;
          else if (/^thigh/.test(k)) on = kind === 'pants' || along(p, 'thigh' + side, 'shin' + side) < 0.5;
          else if (/^shin/.test(k)) on = kind === 'pants' && along(p, 'shin' + side, 'foot' + side) < 0.9;
        }
        keep[i] = on ? 1 : 0;
      }
      // 三角形を選ぶ（3 つの頂点がみな服の所）
      const idx = g0.index ? g0.index.array : null, n = idx ? idx.length : pos.count;
      const tri = [];
      for (let t = 0; t < n; t += 3) {
        const a = idx ? idx[t] : t, b = idx ? idx[t + 1] : t + 1, c = idx ? idx[t + 2] : t + 2;
        if (keep[a] && keep[b] && keep[c]) tri.push(a, b, c);
      }
      if (!tri.length) continue;
      const g = g0.clone();
      g.setIndex(tri);
      // 外へふくらませる（服の厚み。上 7mm・下 9mm 相当）
      const unitPerM = U / Math.max(1e-4, this._worldU(slot));
      const th = (part === 'top' ? 0.007 : 0.009) * unitPerM / sb;
      const gp = g.attributes.position;
      for (let i = 0; i < gp.count; i++) {
        if (!keep[i]) continue;
        gp.setXYZ(i, gp.getX(i) + nor.getX(i) * th, gp.getY(i) + nor.getY(i) * th, gp.getZ(i) + nor.getZ(i) * th);
      }
      g.computeBoundingSphere();
      const m = new THREE.SkinnedMesh(g, part === 'top' ? this.mats.top : this.mats.bottom);
      this._attach(m, mesh);
    }
  }

  _worldU(slot) {
    const a = slot.boneMap.hips.getWorldPosition(V()), b = (slot.boneMap.chest || slot.boneMap.spine).getWorldPosition(V());
    return a.distanceTo(b);
  }

  _attach(m, mesh) {
    m.bind(mesh.skeleton, mesh.bindMatrix);
    m.position.copy(mesh.position); m.quaternion.copy(mesh.quaternion); m.scale.copy(mesh.scale);
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    m.userData.cloth = true;
    if (mesh.morphTargetInfluences && m.geometry.morphAttributes.position) {
      m.morphTargetInfluences = mesh.morphTargetInfluences.slice();
      m.morphTargetDictionary = mesh.morphTargetDictionary;
    }
    mesh.parent.add(m);
    this.meshes.push(m);
  }

  // スカート: 腰と一緒に動く、すそが広がる円すい（腰の骨に付けたスキン）
  _skirt(slot) {
    const mesh = slot.meshes.filter(m => m.isSkinnedMesh).sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count)[0];
    if (!mesh) return;
    const { sk, boneKey, P } = this._bind(slot, mesh);
    const hips = P('hips'), chest = P('chest') || P('spine'), shinL = P('shinL'), shinR = P('shinR');
    if (!hips || !chest || !shinL || !shinR) return;
    const U = hips.distanceTo(chest);
    const topY = hips.y + 0.3 * U, botY = (shinL.y + shinR.y) / 2 + 0.25 * U;
    // 腰回りの幅・厚み（ウエストの高さの素体の断面）
    const bm = mesh.bindMatrix, p = V();
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, hx0 = Infinity, hx1 = -Infinity, hz0 = Infinity, hz1 = -Infinity;
    // 腰の帯は継ぎ目の網（Beta_Joints）にあるので、素体の網をぜんぶ見る
    for (const mm of slot.meshes.filter(m => m.isSkinnedMesh)) {
      const pos = mm.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i).applyMatrix4(mm.bindMatrix);
        if (Math.abs(p.y - topY) < 0.08 * U) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
        if (Math.abs(p.y - (hips.y - 0.1 * U)) < 0.08 * U) { hx0 = Math.min(hx0, p.x); hx1 = Math.max(hx1, p.x); hz0 = Math.min(hz0, p.z); hz1 = Math.max(hz1, p.z); }
      }
    }
    if (!isFinite(hx0)) { hx0 = x0; hx1 = x1; hz0 = z0; hz1 = z1; }
    if (!isFinite(x0)) return;
    const pad = 0.03 * U;
    const rxT = (x1 - x0) / 2 + pad, rzT = (z1 - z0) / 2 + pad;
    // お尻の高さは、腿・お尻の張り出しより外に（脚を少し動かしても突き抜けにくいように余裕を持たせる）
    const rxH = Math.max(rxT, (hx1 - hx0) / 2 * 1.1 + pad * 2), rzH = Math.max(rzT, (hz1 - hz0) / 2 * 1.15 + pad * 2);
    const cx = (hx0 + hx1) / 2, cz = (hz0 + hz1) / 2;
    // 断面: 上（ウエスト）→ お尻の高さ → すそ（広がる）
    const rings = [[topY, rxT, rzT], [hips.y - 0.1 * U, rxH, rzH], [botY, rxH * 1.45, rzH * 1.7]];
    const seg = 48, rows = 14, verts = [], idx = [];
    for (let r = 0; r <= rows; r++) {
      const t = r / rows;
      const k = t < 0.3 ? t / 0.3 : (t - 0.3) / 0.7;
      const [ya, xa, za] = t < 0.3 ? rings[0] : rings[1], [yb, xb, zb] = t < 0.3 ? rings[1] : rings[2];
      const y = ya + (yb - ya) * k, rx = xa + (xb - xa) * k, rz = za + (zb - za) * k;
      for (let s = 0; s <= seg; s++) {
        const a = s / seg * Math.PI * 2;
        // ゆるいひだ（すそほど深い）
        const pleat = 1 + 0.035 * t * Math.sin(a * 12);
        verts.push(cx + Math.sin(a) * rx * pleat, y, cz + Math.cos(a) * rz * pleat);
      }
    }
    for (let r = 0; r < rows; r++) for (let s = 0; s < seg; s++) {
      const a = r * (seg + 1) + s, b = a + seg + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    // 骨の空間 → 網の空間
    const inv = bm.clone().invert();
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(verts.length);
    for (let i = 0; i < verts.length; i += 3) { p.set(verts[i], verts[i + 1], verts[i + 2]).applyMatrix4(inv); arr[i] = p.x; arr[i + 1] = p.y; arr[i + 2] = p.z; }
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // すそは脚にも少し付けて、脚を上げたときに付いてくるように（左右）
    const n = arr.length / 3, skI = new Uint16Array(n * 4), skW = new Float32Array(n * 4);
    const hi = sk.bones.indexOf(slot.boneMap.hips), li = sk.bones.indexOf(slot.boneMap.thighL), ri = sk.bones.indexOf(slot.boneMap.thighR);
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / (seg + 1)), t = r / rows, s = (i % (seg + 1)) / seg * Math.PI * 2;
      const legW = Math.max(0, (t - 0.3) / 0.7) * 0.55;
      const xs = Math.sin(s);   // +x / -x の側
      // 人形の左右（骨の空間の +x が人形の左かどうかは、腿の骨の位置で決める）
      const lx = P('thighL').x - hips.x;
      const toL = Math.sign(xs) === Math.sign(lx) ? Math.abs(xs) : 0, toR = Math.sign(xs) !== Math.sign(lx) ? Math.abs(xs) : 0;
      const wl = legW * toL, wr = legW * toR;
      skI[i * 4] = hi; skW[i * 4] = 1 - wl - wr;
      skI[i * 4 + 1] = li >= 0 ? li : hi; skW[i * 4 + 1] = li >= 0 ? wl : 0;
      skI[i * 4 + 2] = ri >= 0 ? ri : hi; skW[i * 4 + 2] = ri >= 0 ? wr : 0;
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skW, 4));
    const m = new THREE.SkinnedMesh(g, this.mats.skirt);
    this._attach(m, mesh);
  }

  // ---- 髪 ----
  _hair(slot, kind) {
    const head = slot.boneMap.head;
    if (!head) return;
    slot.pivot.updateWorldMatrix(true, true);
    // 頭の頂点（いまの姿勢の位置）を、頭の骨の座標に
    const inv = head.matrixWorld.clone().invert();
    const pts = [];
    for (const mesh of slot.meshes.filter(m => m.isSkinnedMesh)) {
      const { boneKey } = this._bind(slot, mesh);
      const g = mesh.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, v = V();
      if (mesh.skeleton) mesh.skeleton.update();
      for (let i = 0; i < g.attributes.position.count; i += 2) {
        let bi = 0, bw = -1;
        for (let c = 0; c < 4; c++) { const w = sw.getComponent(i, c); if (w > bw) { bw = w; bi = si.getComponent(i, c); } }
        if (boneKey[bi] !== 'head') continue;
        mesh.getVertexPosition(i, v);
        pts.push(v.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(inv));
      }
    }
    if (pts.length < 20) return;
    // 頭の向き（世界の上・前を、頭の骨の座標で）
    const hq = head.getWorldQuaternion(new THREE.Quaternion()).invert();
    const up = V(0, 1, 0).applyQuaternion(hq).normalize();
    const hips = slot.boneMap.hips.getWorldQuaternion(new THREE.Quaternion());
    const fw = V(0, 0, 1).applyQuaternion(hips).applyQuaternion(hq);
    fw.addScaledVector(up, -fw.dot(up)).normalize();
    const rt = V().crossVectors(up, fw).normalize();
    // 頭の大きさ（上・前・横の向きで）
    const c0 = pts.reduce((a, b) => a.add(b), V()).divideScalar(pts.length);
    let x0 = Infinity, x1 = -Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const q of pts) {
      const d = q.clone().sub(c0);
      const x = d.dot(rt), y = d.dot(up), z = d.dot(fw);
      if (y > -0.02 * (y1 > -Infinity ? 1 : 1)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      y1 = Math.max(y1, y);
    }
    const rx = (x1 - x0) / 2 * 1.1, rz = (z1 - z0) / 2 * 1.1, ry = Math.max(rx, rz) * 1.05;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, cy = y1 - ry / 1.1 + ry * 0.04;
    const group = new THREE.Group();
    // 頭の骨の座標の中の、髪の座標（右・上・前、中心 = 頭の丸みの中心）
    const basis = new THREE.Matrix4().makeBasis(rt, up, fw);
    const center = c0.clone().addScaledVector(rt, cx).addScaledVector(up, cy).addScaledVector(fw, cz);
    group.matrix.copy(basis).setPosition(center);
    group.matrixAutoUpdate = false;
    // 髪の生え際（前 θ=0 → 横 → 後ろ θ=π）。値は丸みの中心からの高さ（半径を 1）
    const LINES = {
      short: [0.32, -0.05, -0.55], bob: [0.3, -0.85, -0.85], long: [0.35, -0.75, -0.7],
      pony: [0.5, 0.05, -0.35], bun: [0.5, 0.05, -0.35],
    };
    const [hf, hs, hb] = LINES[kind] || LINES.short;
    const hl = th => { const c = Math.cos(th); return c >= 0 ? hs + (hf - hs) * c : hs + (hb - hs) * -c; };
    const flare = kind === 'bob' ? 0.16 : kind === 'long' ? 0.08 : 0.02;
    const shell = this._shell(rx, ry, rz, hl, flare);
    const mat = this.mats.hair;
    group.add(new THREE.Mesh(shell, mat));
    if (kind === 'long') group.add(new THREE.Mesh(this._curtain(rx, ry, rz), mat));
    if (kind === 'pony') group.add(new THREE.Mesh(this._tail(rx, ry, rz), mat));
    if (kind === 'bun') {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.42 * rx, 24, 16), mat);
      b.position.set(0, 0.62 * ry, -0.62 * rz);
      group.add(b);
    }
    group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; o.userData.hair = true; } });
    head.add(group);
    this.hair = group;
  }

  // 頭を包む髪（上から、生え際まで）
  _shell(rx, ry, rz, hl, flare) {
    const nT = 64, nP = 22, s = 1.09, verts = [], idx = [];
    for (let j = 0; j <= nP; j++) {
      for (let i = 0; i <= nT; i++) {
        const th = i / nT * Math.PI * 2;
        const yEnd = hl(th);                            // 生え際の高さ（-1〜1）
        const phiEnd = Math.acos(Math.max(-0.98, Math.min(0.98, yEnd)));
        const extra = yEnd < -0.6 ? (-0.6 - yEnd) : 0;  // 頭の丸みより下へ伸びる分（ボブ・ロング）
        const t = j / nP;
        let phi = t * phiEnd, y = Math.cos(phi), r = Math.sin(phi);
        // 下へ伸びるときは、丸みの下で真下へまっすぐ下ろす
        if (extra > 0 && t > 0.75) {
          const k = (t - 0.75) / 0.25;
          phi = phiEnd; r = Math.sin(Math.acos(-0.6)); y = -0.6 - extra * k;
        }
        const f = 1 + flare * Math.max(0, -y);
        verts.push(Math.sin(th) * r * rx * s * f, y * ry * s, Math.cos(th) * r * rz * s * f);
      }
    }
    for (let j = 0; j < nP; j++) for (let i = 0; i < nT; i++) {
      const a = j * (nT + 1) + i, b = a + nT + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // ロング: 後ろへ下りる髪（肩甲骨の下あたりまで）
  _curtain(rx, ry, rz) {
    const nT = 28, nY = 16, verts = [], idx = [];
    for (let j = 0; j <= nY; j++) {
      const t = j / nY, y = -0.6 - t * 2.4;
      for (let i = 0; i <= nT; i++) {
        const th = Math.PI * (0.45 + 1.1 * i / nT);    // 後ろ半分
        const r = 1.1 * (1 - 0.12 * t) + 0.12 * t;
        const back = Math.cos(th) < 0 ? -Math.cos(th) : 0;
        verts.push(Math.sin(th) * r * rx * (1 + 0.1 * t), y * ry, Math.cos(th) * r * rz - back * 0.25 * t * rz);
      }
    }
    for (let j = 0; j < nY; j++) for (let i = 0; i < nT; i++) {
      const a = j * (nT + 1) + i, b = a + nT + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // ポニーテール: 後頭部の高い所から後ろ下へ、先が細くなる束
  _tail(rx, ry, rz) {
    const curve = new THREE.CatmullRomCurve3([
      V(0, 0.45 * ry, -0.95 * rz), V(0, 0.35 * ry, -1.35 * rz), V(0, -0.2 * ry, -1.55 * rz), V(0, -1.0 * ry, -1.45 * rz), V(0, -1.7 * ry, -1.3 * rz)]);
    const tub = 40, rad = 12;
    const g = new THREE.TubeGeometry(curve, tub, 0.32 * rx, rad, false);
    const p = g.attributes.position, c = V(), v = V();
    for (let i = 0; i < p.count; i++) {
      const t = Math.floor(i / (rad + 1)) / tub;
      curve.getPointAt(t, c);
      const k = t < 0.12 ? 0.45 + t / 0.12 * 0.55 : 1 - 0.75 * ((t - 0.12) / 0.88) ** 1.2;
      v.fromBufferAttribute(p, i).sub(c).multiplyScalar(k).add(c);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }
}
// ===== outfit.js ここまで =====
