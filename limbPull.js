// limbPull.js — 手先・足先を引っ張ると、腕・脚がついてくる（2 本の骨の IK）
//
// 手（手首）か足（足首）を押したまま動かすと、そこが指の下へ来るように
//   腕: 上腕・前腕、 脚: 腿・脛
// を回す。手・足の世界での向きはつかんだときのまま保つ（足の裏が床を向いたまま、など）。
//
// 解き方（毎回、式で一度に解く。動かすたびに試行を繰り返さないので軽い）:
//   1. 肩（股）から目標までの距離 d を、届く範囲に収める
//   2. 肘（膝）の位置: 余弦定理で、肩→目標の線からの高さ h を出す。どちら側に曲げるかは今の肘の側
//      （まっすぐ伸びているときは、関節が自然に曲がる向きに試しに曲げてみた側）
//   3. 上腕（腿）の回転: 骨の向きと「肘の曲がる軸」の 2 本を合わせる回転にする。
//      これで肘は蝶番（ちょうつがい）のまま曲がり、前腕に無理なひねりが入らない
//   4. 前腕（脛）は、肘の軸のまわりに目標へ向ける
//   5. それぞれの世界での向きを、関節の角度（D = Rx·Rz·Ry）に直し、可動域に収める

import * as THREE from 'three';
import { JOINT_BY_KEY, clampAngles, limitExcess } from './bones.js';

const DEG = Math.PI / 180;
const AX = new THREE.Vector3(1, 0, 0);
/** 1 回解くごとに、肘・膝を自然な向きへ寄せる割合 */
const NATURAL_PULL = 0.35;

export const PULL_CHAINS = {
  handL: ['upperArmL', 'forearmL', 'handL'],
  handR: ['upperArmR', 'forearmR', 'handR'],
  footL: ['thighL', 'shinL', 'footL'],
  footR: ['thighR', 'shinR', 'footR'],
};

const wpos = b => b.getWorldPosition(new THREE.Vector3());
const wquat = b => b.getWorldQuaternion(new THREE.Quaternion());

/** 2 本の向き（x と、x に直交させた y）から作る回転 */
function frameQuat(x, y) {
  const X = x.clone().normalize();
  const Y = y.clone().addScaledVector(X, -y.dot(X)).normalize();
  const Z = X.clone().cross(Y);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
}

/** 角度（度）の差を -180〜180 に */
const wrap = a => ((a + 180) % 360 + 360) % 360 - 180;

/** D（関節の回転）→ 角度 {x,y,z}。2 通りの解のうち、いまの角度に近い方 */
function anglesFrom(D, cur) {
  const e = new THREE.Euler().setFromQuaternion(D, 'XZY');
  const a1 = { x: e.x / DEG, y: e.y / DEG, z: e.z / DEG };
  const a2 = { x: wrap(a1.x + 180), y: wrap(a1.y + 180), z: wrap(180 - a1.z) };
  const dist = a => Math.abs(wrap(a.x - cur.x)) + Math.abs(wrap(a.y - cur.y)) + Math.abs(wrap(a.z - cur.z));
  const best = dist(a1) <= dist(a2) ? a1 : a2;
  // いまの角度から連続するように（-185 のような可動域の端を越えて飛ばない）
  return { x: cur.x + wrap(best.x - cur.x), y: cur.y + wrap(best.y - cur.y), z: cur.z + wrap(best.z - cur.z) };
}

export class LimbPull {
  constructor(viewer) {
    this.v = viewer;
    this.enabled = true;
    this.drag = null;
  }

  setEnabled(on) { this.enabled = !!on; if (!on) this.drag = null; }

  /** この関節を引っ張れるか */
  canPull(key) {
    const slot = this.v.primarySlot;
    const ch = PULL_CHAINS[key];
    return !!(this.enabled && ch && slot && slot.skeleton && ch.every(k => slot.boneMap[k]));
  }

  _rayPoint(clientX, clientY, plane) {
    const rect = this.v.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.v.camera);
    return ray.ray.intersectPlane(plane, new THREE.Vector3());
  }

  begin(key, clientX, clientY) {
    if (!this.canPull(key)) return false;
    this.v.camera.updateMatrixWorld();
    const slot = this.v.primarySlot;
    const [, , kc] = PULL_CHAINS[key];
    const C = slot.boneMap[kc];
    const H0 = wpos(C);
    const n = new THREE.Vector3();
    this.v.camera.getWorldDirection(n);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, H0);
    const P0 = this._rayPoint(clientX, clientY, plane);
    if (!P0) return false;
    // 床に合わせて体が上下しても、つかんだ所との差がずれないように、入れ物の位置からの相対で持つ
    const c0 = this.v.container.position.clone();
    this.drag = { key, H0, P0, plane, endQ: wquat(C), c0 };
    return true;
  }

  move(clientX, clientY) {
    const d = this.drag;
    if (!d) return false;
    const P = this._rayPoint(clientX, clientY, d.plane);
    if (!P) return false;
    // 体が床合わせで動いた分は目標にも足す（足を持ち上げると体が下がる、など）
    const shift = this.v.container.position.clone().sub(d.c0);
    const T = d.H0.clone().add(P.sub(d.P0)).add(shift);
    const ok = this.solve(d.key, T, d.endQ);
    if (ok) this.v.applyAll();
    return ok;
  }

  end() { const d = this.drag; this.drag = null; return d; }

  /**
   * 腕（脚）を、先（手首・足首）が T に来るように回す。endQ: 手・足の世界での向き（null なら今の角度のまま）
   * @returns {boolean}
   */
  solve(key, T, endQ = null) {
    const v = this.v, slot = v.primarySlot;
    const ch = PULL_CHAINS[key];
    if (!ch || !slot) return false;
    const [ka, kb, kc] = ch;
    const A = slot.boneMap[ka], B = slot.boneMap[kb], C = slot.boneMap[kc];
    if (!A || !B || !C) return false;
    const npA = slot.neutralParent.get(A), nbA = slot.neutralWorld.get(A);
    const npB = slot.neutralParent.get(B), nbB = slot.neutralWorld.get(B);
    const npC = slot.neutralParent.get(C), nbC = slot.neutralWorld.get(C);
    if (!npA || !nbA || !npB || !nbB || !npC || !nbC) return false;

    const S = wpos(A), E = wpos(B), H = wpos(C);
    const L1 = E.distanceTo(S), L2 = H.distanceTo(E);
    if (L1 < 1e-5 || L2 < 1e-5) return false;
    const WA = wquat(A), WB = wquat(B);
    const PwA = A.parent ? wquat(A.parent) : new THREE.Quaternion();

    // 1. 届く範囲に収める
    const ST = T.clone().sub(S);
    let dist = ST.length();
    if (dist < 1e-6) return false;
    const u = ST.divideScalar(dist);
    dist = Math.max(Math.abs(L1 - L2) + 1e-4, Math.min((L1 + L2) * 0.9995, dist));
    const Tc = S.clone().addScaledVector(u, dist);

    // 肘（膝）の曲がる軸（いま）と、自然に曲がる向き（前腕は −、脛は +）
    const hingeCur = AX.clone().applyQuaternion(WA.clone().multiply(npB.clone().invert())).normalize();
    const jb = JOINT_BY_KEY[kb];
    const flex = jb && Math.abs(jb.limits[0]) > Math.abs(jb.limits[1]) ? -1 : 1;

    // 2. 肘（膝）の位置。肘が「肩→手の線」のどちら側に出ているかを、線が振れたのと同じだけ回して保つ
    //    （手を横へ持ち上げると、腕全体が振り子のように振れる。肘の向きが急にねじれない）
    const toE = E.clone().sub(S);
    let uCur = H.clone().sub(S).normalize();
    let side = toE.clone().addScaledVector(uCur, -toE.dot(uCur));
    if (side.length() < 0.06 * L1) {
      // ほぼまっすぐ: 自然な向きに少し曲げてみて、肘の出る側を決める
      const Ht = E.clone().add(H.clone().sub(E).applyAxisAngle(hingeCur, flex * 25 * DEG));
      uCur = Ht.sub(S).normalize();
      side = toE.clone().addScaledVector(uCur, -toE.dot(uCur));
    }
    side.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(uCur, u));
    side.addScaledVector(u, -side.dot(u));
    if (side.lengthSq() < 1e-12) return false;
    side.normalize();
    const sideCur = side.clone();
    const nat = this._naturalSide(slot, key);
    if (nat) nat.addScaledVector(u, -nat.dot(u));
    const natOk = nat && nat.length() > 0.2;
    if (natOk) nat.normalize();
    const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const dirU = toE.clone().normalize();
    const cur = k => ({ ...(v.angles[k] || { x: 0, y: 0, z: 0 }) });
    const Dof = (Pw, np, W2, nb) => Pw.clone().multiply(np.clone().invert()).invert().multiply(W2).multiply(nb.clone().invert());

    // 肘（膝）を出す側 sd のときの、上腕・前腕の世界の向きと角度
    const trySide = sd => {
      const E2 = S.clone().addScaledVector(u, a).addScaledVector(sd, h);
      // 3. 上腕（腿）: 骨の向きと肘の軸を合わせる
      const dirU2 = E2.clone().sub(S).normalize();
      const dirF2 = Tc.clone().sub(E2).normalize();
      let hingeNew = dirU2.clone().cross(dirF2);
      if (hingeNew.length() < Math.sin(6 * DEG) || h < 0.08 * L1) {
        // 伸びきり: 軸は今の軸を、骨の向きの変化と同じだけ回したもの
        hingeNew = hingeCur.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(dirU, dirU2));
      } else hingeNew.normalize().multiplyScalar(flex);
      const qU = frameQuat(dirU2, hingeNew).multiply(frameQuat(dirU, hingeCur).invert());
      const WA2 = qU.clone().multiply(WA);
      // 4. 前腕（脛）: 肘の軸のまわりに、目標へ向ける
      const dirF = H.clone().sub(E).normalize().applyQuaternion(qU);
      const WB2 = new THREE.Quaternion().setFromUnitVectors(dirF, dirF2).multiply(qU).multiply(WB);
      const aA = anglesFrom(Dof(PwA, npA, WA2, nbA), cur(ka));
      const aB = anglesFrom(Dof(WA2, npB, WB2, nbB), cur(kb));
      return { WA2, WB2, aA, aB };
    };
    // 肘（膝）の出る側の候補: 今の側（線の振れに合わせて回したもの）、自然な側へ寄せたもの、まわり 16 方向。
    // 可動域を越える量（無理な形）・今の側からの変わり方・自然な側からのずれ、で点を付け、いちばん良いものにする
    //  （下ろした手を真上へ引くと、肘が後ろへ引けきる……のような形を避ける。肘は下・外へ逃がす）
    const cands = [sideCur];
    if (natOk) {
      cands.push(sideCur.clone().multiplyScalar(1 - NATURAL_PULL).addScaledVector(nat, NATURAL_PULL).normalize());
      const b1 = sideCur.clone(), b2 = u.clone().cross(sideCur).normalize();
      for (let i = 0; i < 16; i++) {
        const t = (i / 16) * Math.PI * 2;
        cands.push(b1.clone().multiplyScalar(Math.cos(t)).addScaledVector(b2, Math.sin(t)));
      }
    }
    const angDeg = (p, q) => Math.acos(Math.max(-1, Math.min(1, p.dot(q)))) / DEG;
    let bestSide = null;
    for (const sd of cands) {
      if (sd.lengthSq() < 1e-8) continue;
      const r = trySide(sd);
      const over = v.limitsEnabled ? limitExcess(ka, r.aA) + limitExcess(kb, r.aB) : 0;
      // 曲がりが小さいとき（伸びきり近く）は、どちら側でも形はほぼ同じなので、今の側を強く保つ
      const bend = Math.min(1, h / (0.3 * L1));
      const cost = over * 4 + angDeg(sd, sideCur) * (0.25 + 0.75 * (1 - bend))
        + (natOk ? angDeg(sd, nat) * 0.35 * bend : 0);
      if (!bestSide || cost < bestSide.cost) bestSide = { ...r, cost };
    }
    const { WA2, WB2 } = bestSide;

    // 5. 世界の向き → 関節の角度（親の今の向きを使う）。可動域に収める
    const lim = (k, ang) => (v.limitsEnabled ? clampAngles(k, ang) : ang);
    let aA = lim(ka, anglesFrom(Dof(PwA, npA, WA2, nbA), cur(ka)));
    // 子の角度は、親を可動域に収めた「後」の向きから出す（収めた分のずれを子で取り戻す）
    let aB = lim(kb, anglesFrom(Dof(this._worldFromAngles(slot, ka, aA, PwA), npB, WB2, nbB), cur(kb)));

    // 可動域で止まって届かないときは、可動域の中で目標にいちばん近づく角度を探す
    // （骨は形を変えないので、肩→肘・肘→手首の向きを骨の中で持っておけば、骨を動かさずに先の位置が出せる）
    const rA = toE.clone().applyQuaternion(WA.clone().invert());
    const rB = H.clone().sub(E).applyQuaternion(WB.clone().invert());
    const tipOf = (a1, a2) => {
      const q1 = this._worldFromAngles(slot, ka, a1, PwA);
      const q2 = this._worldFromAngles(slot, kb, a2, q1);
      return S.clone().add(rA.clone().applyQuaternion(q1)).add(rB.clone().applyQuaternion(q2));
    };
    const err = (a1, a2) => tipOf(a1, a2).distanceTo(Tc);
    let best = err(aA, aB);
    if (best > 0.004 * (L1 + L2)) {
      // いまの角度から始めた方が近ければ、そちらから
      const c1 = lim(ka, cur(ka)), c2 = lim(kb, cur(kb));
      const e0 = err(c1, c2);
      if (e0 < best) { aA = c1; aB = c2; best = e0; }
      const P = [[0, 'x'], [0, 'z'], [0, 'y'], [1, 'x']];
      const arr = [aA, aB], keys = [ka, kb];
      for (const step of [16, 8, 4, 2, 1, 0.5]) {
        for (let it = 0; it < 10; it++) {
          let improved = false;
          for (const [i, ax] of P) {
            for (const sg of [1, -1]) {
              const t = lim(keys[i], { ...arr[i], [ax]: arr[i][ax] + sg * step });
              if (t[ax] === arr[i][ax]) continue;
              const trial = arr.slice(); trial[i] = t;
              const e = err(trial[0], trial[1]);
              if (e < best - 1e-7) { arr[i] = t; best = e; improved = true; }
            }
          }
          if (!improved) break;
        }
      }
      aA = arr[0]; aB = arr[1];
    }
    v.angles[ka] = aA;
    v.angles[kb] = aB;
    if (endQ) {
      const qB = this._worldFromAngles(slot, kb, aB, this._worldFromAngles(slot, ka, aA, PwA));
      v.angles[kc] = lim(kc, anglesFrom(Dof(qB, npC, endQ, nbC), cur(kc)));
    }
    return true;
  }

  /** 肘（膝）が自然に向く向き（世界）。体（胸・腰）の向きに合わせて回す */
  _naturalSide(slot, key) {
    const arm = /^hand/.test(key);
    const out = key.endsWith('L') ? 1 : -1;            // 人形の左 = +X
    const body = slot.boneMap[arm ? 'chest' : 'hips'] || slot.boneMap.hips;
    if (!body) return null;
    const nb = slot.neutralWorld.get(body);
    if (!nb) return null;
    const q = wquat(body).multiply(nb.clone().invert());    // 基準姿勢からの体の回り
    // 基準姿勢: 人形は +Z を向き、上が +Y
    const v = arm ? new THREE.Vector3(0.35 * out, -0.8, -0.5) : new THREE.Vector3(0.15 * out, 0, 1);
    return v.normalize().applyQuaternion(q);
  }

  /** 角度から骨の世界での向き（親の世界の向き Pw のもとで） */
  _worldFromAngles(slot, key, a, Pw) {
    const b = slot.boneMap[key];
    const np = slot.neutralParent.get(b), nb = slot.neutralWorld.get(b);
    const D = new THREE.Quaternion().setFromAxisAngle(AX, a.x * DEG)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a.z * DEG))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a.y * DEG));
    return Pw.clone().multiply(np.clone().invert()).multiply(D).multiply(nb);
  }
}

// ===== limbPull.js ここまで =====
