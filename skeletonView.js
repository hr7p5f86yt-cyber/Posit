// skeletonView.js — 読み込んだモデルのボーンに沿って、骨らしい形を組み立てる
// 寸法は身長1.7mを前提にメートルで書き、骨ごとの縮尺に換算して置く。
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UPW = V(0, 1, 0);
const FWDW = V(0, 0, 1);

function makeMaterials() {
  return {
    bone: new THREE.MeshStandardMaterial({ color: 0xeae1c9, roughness: 0.52, metalness: 0.0 }),
    disc: new THREE.MeshStandardMaterial({ color: 0xc9bfa6, roughness: 0.7, metalness: 0.0 }),
  };
}

class Builder {
  constructor(slot) {
    this.slot = slot;
    this.map = slot.boneMap;
    this.parts = [];
    this.mats = makeMaterials();
  }

  /** メートル -> その骨の局所単位 */
  u(bone, meters) {
    const s = bone.getWorldScale(new THREE.Vector3()).x || 1;
    return meters / s;
  }

  /** ワールドの向きを、その骨の局所ベクトルに直す */
  dirOf(bone, worldDir) {
    const o = bone.getWorldPosition(new THREE.Vector3());
    return bone.worldToLocal(o.add(worldDir)).normalize();
  }

  /** 骨の局所空間での「横・上・前」と、その姿勢を表す四元数 */
  frame(bone) {
    const up = this.dirOf(bone, UPW);
    const fwd = this.dirOf(bone, FWDW);
    const side = new THREE.Vector3().crossVectors(up, fwd).normalize();
    const quat = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(side, up, fwd));
    return { side, up, fwd, quat };
  }

  /** 子の関節までの、局所空間でのベクトル */
  toChild(bone, childKey) {
    const c = this.map[childKey];
    if (!c) return null;
    const p = c.getWorldPosition(new THREE.Vector3());
    const v = bone.worldToLocal(p);
    return v.lengthSq() > 1e-12 ? v : null;
  }

  _attach(bone, mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.visible = false;
    mesh.userData.jointBone = bone;
    mesh.userData.slot = this.slot.key;
    bone.add(mesh);
    this.parts.push(mesh);
    return mesh;
  }

  /** 骨の「横・上・前」を基準に、指定の位置・姿勢で置く（数値は局所単位） */
  place(bone, geo, x, y, z, opts = {}) {
    const f = opts.frame || this.frame(bone);
    const m = new THREE.Mesh(geo, opts.material || this.mats.bone);
    m.position.copy(f.side).multiplyScalar(x)
      .addScaledVector(f.up, y).addScaledVector(f.fwd, z);
    m.quaternion.copy(f.quat);
    if (opts.tilt) m.quaternion.multiply(opts.tilt);
    if (opts.scale) m.scale.copy(opts.scale);
    return this._attach(bone, m);
  }

  /** 子の関節へ向かう長い骨。先端を細くし、必要なら骨頭の球をつける */
  longBone(bone, childKey, o) {
    const v = this.toChild(bone, childKey);
    if (!v) return null;
    const len = v.length();
    const dir = v.clone().normalize();
    const U = m => this.u(bone, m);
    const top = U(o.rTop), bottom = U(o.rBottom);
    const gap = o.gap === undefined ? 0.12 : o.gap;
    const shaftLen = len * (1 - gap);

    const geo = new THREE.CylinderGeometry(top, bottom, shaftLen, 14, 1);
    const m = new THREE.Mesh(geo, this.mats.bone);
    m.quaternion.setFromUnitVectors(UPW, dir);
    m.position.copy(dir).multiplyScalar(len * 0.5);
    this._attach(bone, m);

    if (o.headR) {
      const hs = new THREE.Mesh(new THREE.SphereGeometry(U(o.headR), 14, 12), this.mats.bone);
      hs.position.copy(dir).multiplyScalar(len * (o.headAt || 0.06));
      if (o.headShift) {
        const f = this.frame(bone);
        hs.position.addScaledVector(f.side, U(o.headShift.x || 0))
          .addScaledVector(f.up, U(o.headShift.y || 0))
          .addScaledVector(f.fwd, U(o.headShift.z || 0));
      }
      this._attach(bone, hs);
    }
    if (o.condyleR) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(U(o.condyleR), 14, 12), this.mats.bone);
      c.position.copy(dir).multiplyScalar(len * 0.95);
      c.scale.set(1.25, 0.85, 1.0);
      this._attach(bone, c);
    }
    return { len, dir };
  }

  /** 平行に走るもう一本（橈骨・腓骨） */
  sideBone(bone, childKey, offsetM, radiusM) {
    const v = this.toChild(bone, childKey);
    if (!v) return;
    const len = v.length();
    const dir = v.clone().normalize();
    const f = this.frame(bone);
    const U = m => this.u(bone, m);
    const geo = new THREE.CylinderGeometry(U(radiusM) * 0.8, U(radiusM), len * 0.82, 10, 1);
    const m = new THREE.Mesh(geo, this.mats.bone);
    m.quaternion.setFromUnitVectors(UPW, dir);
    m.position.copy(dir).multiplyScalar(len * 0.5)
      .addScaledVector(f.side, U(offsetM.x || 0))
      .addScaledVector(f.fwd, U(offsetM.z || 0));
    this._attach(bone, m);
  }

  /** 椎骨を積む */
  vertebrae(bone, childKey, count, radiusM) {
    const v = this.toChild(bone, childKey);
    if (!v) return;
    const len = v.length();
    const dir = v.clone().normalize();
    const U = m => this.u(bone, m);
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const r = U(radiusM) * (1 - 0.12 * t);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len / count * 0.62, 10), this.mats.bone);
      body.quaternion.setFromUnitVectors(UPW, dir);
      body.position.copy(dir).multiplyScalar(len * t);
      this._attach(bone, body);

      const f = this.frame(bone);
      const spineProc = new THREE.Mesh(
        new THREE.BoxGeometry(U(0.012), len / count * 0.5, U(0.03)), this.mats.bone);
      spineProc.quaternion.copy(f.quat);
      spineProc.position.copy(body.position).addScaledVector(f.fwd, -U(0.028));
      this._attach(bone, spineProc);
    }
  }
}

// ---- 各部位 ---------------------------------------------------------------

function buildSkull(b) {
  const head = b.map.head;
  if (!head) return;
  const U = m => b.u(head, m);
  const f = b.frame(head);
  const sphere = new THREE.SphereGeometry(1, 20, 16);

  b.place(head, sphere, 0, U(0.085), U(0.004), {
    frame: f, scale: V(U(0.073), U(0.098), U(0.088)),
  });
  b.place(head, new THREE.BoxGeometry(U(0.085), U(0.055), U(0.055)), 0, U(0.028), U(0.052), { frame: f });
  b.place(head, new THREE.BoxGeometry(U(0.088), U(0.042), U(0.068)), 0, U(-0.012), U(0.042), { frame: f });
  // 眼窩
  for (const sx of [-1, 1]) {
    b.place(head, new THREE.SphereGeometry(U(0.018), 10, 8),
      sx * U(0.028), U(0.062), U(0.068), { frame: f, material: b.mats.disc });
  }
}

function buildSpine(b) {
  if (b.map.neck) b.vertebrae(b.map.neck, 'head', 4, 0.017);
  if (b.map.chest) b.vertebrae(b.map.chest, 'neck', 6, 0.020);
  if (b.map.spine) b.vertebrae(b.map.spine, 'chest', 5, 0.023);
  if (b.map.hips) b.vertebrae(b.map.hips, 'spine', 2, 0.025);
}

function buildRibcage(b) {
  const chest = b.map.chest;
  if (!chest) return;
  // 胸郭は胸の骨から「下」へ伸びる。腰椎側の骨を目印に向きと長さを決める
  const down = b.toChild(chest, 'spine') || b.toChild(chest, 'hips');
  if (!down) return;
  const L = down.length();
  const dir = down.clone().normalize();
  const f = b.frame(chest);
  const U = m => b.u(chest, m);

  // 胸骨
  const sternum = new THREE.Mesh(
    new THREE.BoxGeometry(U(0.032), L * 0.62, U(0.014)), b.mats.bone);
  sternum.quaternion.setFromUnitVectors(UPW, dir);
  sternum.position.copy(dir).multiplyScalar(L * 0.34).addScaledVector(f.fwd, U(0.082));
  b._attach(chest, sternum);

  const LEVELS = 9;
  for (let i = 0; i < LEVELS; i++) {
    const t = -0.16 + (1.14 * i) / (LEVELS - 1);      // 胸の骨より少し上から腰椎まで
    const bulge = Math.sin(Math.PI * Math.min(1, Math.max(0, (t + 0.16) / 1.18)));
    const wide = 0.064 + 0.052 * bulge;
    const deep = 0.046 + 0.034 * bulge;
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.085, 5, 18, Math.PI * 0.84), b.mats.bone);
      m.quaternion.setFromUnitVectors(UPW, dir);
      m.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2));
      m.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1),
        sx > 0 ? -Math.PI * 0.08 : Math.PI + Math.PI * 0.08));
      m.scale.set(U(wide), U(deep), U(0.085));
      m.position.copy(dir).multiplyScalar(L * t).addScaledVector(f.fwd, U(-0.008));
      b._attach(chest, m);
    }
  }
}

function buildPelvis(b) {
  const hips = b.map.hips;
  if (!hips) return;
  const f = b.frame(hips);
  const U = m => b.u(hips, m);

  // 仙骨
  b.place(hips, new THREE.BoxGeometry(U(0.052), U(0.105), U(0.032)), 0, U(-0.022), U(-0.034), { frame: f });

  for (const sx of [-1, 1]) {
    // 腸骨（骨盤の羽）— 寝かせぎみにして器の形に近づける
    b.place(hips, new THREE.SphereGeometry(1, 18, 14), sx * U(0.066), U(0.016), U(0.004), {
      frame: f,
      tilt: new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), sx * -0.26),
      scale: V(U(0.026), U(0.074), U(0.080)),
    });
    // 坐骨・寛骨臼（脚の付け根が収まるところ）
    b.place(hips, new THREE.SphereGeometry(1, 14, 12), sx * U(0.076), U(-0.052), U(-0.004), {
      frame: f, scale: V(U(0.026), U(0.030), U(0.034)),
    });
  }

  // 恥骨のアーチ
  const ring = new THREE.Mesh(new THREE.TorusGeometry(U(0.050), U(0.012), 6, 20, Math.PI), b.mats.bone);
  ring.quaternion.copy(f.quat);
  ring.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), Math.PI));
  ring.position.copy(f.up).multiplyScalar(U(-0.062)).addScaledVector(f.fwd, U(0.018));
  b._attach(hips, ring);
}

function buildArms(b) {
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    const sh = b.map['shoulder' + side];
    if (sh) {
      b.longBone(sh, 'upperArm' + side, { rTop: 0.009, rBottom: 0.011, gap: 0.1 });
      const f = b.frame(sh);
      const U = m => b.u(sh, m);
      b.place(sh, new THREE.BoxGeometry(U(0.085), U(0.10), U(0.010)),
        sx * U(0.030), U(-0.02), U(-0.045), {
          frame: f, tilt: new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), sx * 0.25),
        });
    }
    const ua = b.map['upperArm' + side];
    if (ua) {
      b.longBone(ua, 'forearm' + side, {
        rTop: 0.016, rBottom: 0.020, headR: 0.023, headAt: 0.02, condyleR: 0.019,
      });
    }
    const fa = b.map['forearm' + side];
    if (fa) {
      b.longBone(fa, 'hand' + side, { rTop: 0.012, rBottom: 0.016 });
      b.sideBone(fa, 'hand' + side, { x: sx * 0.016, z: 0.004 }, 0.010);
    }
    const hd = b.map['hand' + side];
    if (hd) {
      // 手根骨・中手骨のかたまりを、指の付け根へ向けて置く
      const kid = hd.children.find(c => c.isBone);
      const dir = kid && kid.position.lengthSq() > 1e-12
        ? kid.position.clone().normalize() : null;
      const U = m => b.u(hd, m);
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(U(0.058), U(0.062), U(0.020)), b.mats.bone);
      if (dir) {
        block.quaternion.setFromUnitVectors(UPW, dir);
        block.position.copy(dir).multiplyScalar(U(0.030));
      }
      b._attach(hd, block);
    }
  }
}

function buildLegs(b) {
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    const th = b.map['thigh' + side];
    if (th) {
      b.longBone(th, 'shin' + side, {
        rTop: 0.020, rBottom: 0.026, headR: 0.026, headAt: 0.0,
        headShift: { x: -sx * 0.035, y: 0.02 }, condyleR: 0.028,
      });
    }
    const sn = b.map['shin' + side];
    if (sn) {
      b.longBone(sn, 'foot' + side, { rTop: 0.016, rBottom: 0.024 });
      b.sideBone(sn, 'foot' + side, { x: sx * 0.020 }, 0.009);
      const f = b.frame(sn);
      const U = m => b.u(sn, m);
      b.place(sn, new THREE.SphereGeometry(U(0.019), 10, 8), 0, U(0.01), U(0.030), {
        frame: f, scale: V(1.1, 1.0, 0.55),
      });
    }
    const ft = b.map['foot' + side];
    if (ft) {
      const f = b.frame(ft);
      const U = m => b.u(ft, m);
      b.place(ft, new THREE.SphereGeometry(U(0.026), 12, 10), 0, U(0.006), U(-0.030), { frame: f });
      b.place(ft, new THREE.BoxGeometry(U(0.062), U(0.030), U(0.115)), 0, U(-0.008), U(0.042), { frame: f });
    }
  }
}

/** 指やつま先など、対応表にない細い骨は元のボーンからそのまま描く */
function buildSmallBones(b) {
  const roots = [];
  for (const side of ['L', 'R']) {
    if (b.map['hand' + side]) roots.push(b.map['hand' + side]);
    if (b.map['foot' + side]) roots.push(b.map['foot' + side]);
  }
  const walk = (bone) => {
    for (const c of bone.children) {
      if (!c.isBone) continue;
      const len = c.position.length();
      if (len > 1e-6) {
        const r = Math.max(len * 0.11, 1e-5);
        const geo = new THREE.CapsuleGeometry(r, Math.max(len - 2 * r, len * 0.1), 3, 8);
        const m = new THREE.Mesh(geo, b.mats.bone);
        m.position.copy(c.position).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(UPW, c.position.clone().normalize());
        b._attach(bone, m);
      }
      walk(c);
    }
  };
  for (const r of roots) walk(r);
}

/**
 * スロットのボーンに沿って骨格を組み立てる。
 * @returns {THREE.Mesh[]} 作ったパーツ（各ボーンの子として追加済み・初期は非表示）
 */
export function buildSkeletonView(slot) {
  if (!slot.skeleton || !Object.keys(slot.boneMap).length) return [];
  const b = new Builder(slot);
  buildSkull(b);
  buildSpine(b);
  buildRibcage(b);
  buildPelvis(b);
  buildArms(b);
  buildLegs(b);
  buildSmallBones(b);
  return b.parts;
}
