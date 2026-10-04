// bodyShape.js — 男性・女性の体つきを、素体の表面そのものを変形して作る
//
// 骨の位置を少しずらすだけでは、肩幅・腰幅が数ミリしか変わらず違いが見えない。
// そこで、成人の平均的な男女差（解剖学・人体計測の値）に沿って
// 素体の表面を押し出す・寄せる「モーフターゲット」を 2 つ（男性・女性）作る。
// モーフはスキンをかける前の形にかかるので、どんなポーズでも一緒に動く。
//
// 主な男女差（成人の平均）
//   肩幅（肩峰間）  … 男性は女性より約 1 割広い
//   腰回り（転子間） … 女性は肩幅と同じか広い。男性は肩幅より狭い
//   ウエスト/ヒップ比 … 女性 約0.7、男性 約0.9
//   胸             … 女性は乳房（第4肋間の高さ・正中から約9cm）、男性は胸郭が厚い
//   臀部           … 女性は後ろへの張り出しが大きい
//   腕・首・ふくらはぎ … 男性は筋量が多く太い
//   大腿の付け根    … 女性は外側と内側に厚みがある
import * as THREE from 'three';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const bump = (y, c, w) => Math.exp(-(((y - c) / w) ** 2));          // なだらかな山
const smooth = t => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };

/** 骨とその先の骨の集合 */
function subtree(b) {
  const set = new Set();
  (function walk(x) { set.add(x); for (const c of x.children) if (c.isBone) walk(c); })(b);
  return set;
}

/**
 * スロットの素体に、男性・女性のモーフを作って付ける。
 * 呼ぶ前に骨を基準姿勢（ポーズなし・倍率 1）にしておくこと。
 * @returns {boolean} 作れたら true
 */
export function buildBodyMorphs(slot) {
  const map = slot.boneMap;
  if (!slot.skeleton || !map || !map.hips || !map.chest) return false;
  slot.pivot.updateWorldMatrix(true, true);
  const W = b => (b ? b.getWorldPosition(V3()) : null);
  const J = {};
  for (const [k, b] of Object.entries(map)) J[k] = W(b);

  const meshes = (slot.meshes || []).filter(m => m.isSkinnedMesh && m.skeleton && m.geometry
    && m.geometry.attributes.skinIndex && !m.userData.headPlane);
  if (!meshes.length) return false;

  // 背丈と床
  let floor = Infinity, top = -Infinity;
  const box = new THREE.Box3();
  for (const m of meshes) { m.geometry.computeBoundingBox(); box.expandByObject(m); }
  floor = box.min.y; top = box.max.y;
  const H = Math.max(0.3, top - floor), s = H / 1.70;
  const cx = J.hips.x;

  // 目印の高さ
  const ySN = floor + 0.819 * H;                          // 胸骨上切痕
  const yShoulder = J.upperArmL ? J.upperArmL.y : ySN - 0.02 * s;
  const yBreast = ySN - 0.125 * s;                        // 乳頭の高さ（第4肋間）
  const yWaist = floor + 0.630 * H;                       // いちばん細いところ
  const yHip = (J.thighL ? J.thighL.y : floor + 0.53 * H) - 0.035 * s;   // 大転子＝腰のいちばん広いところ
  const yGlute = yHip + 0.005 * s;
  const hipHalf = J.thighL && J.thighR ? Math.abs(J.thighL.x - J.thighR.x) / 2 + 0.06 * s : 0.13 * s;

  // 骨の受け持ち
  const head = map.head ? subtree(map.head) : new Set();
  const armL = map.upperArmL ? subtree(map.upperArmL) : new Set();
  const armR = map.upperArmR ? subtree(map.upperArmR) : new Set();
  const legL = map.thighL ? subtree(map.thighL) : new Set();
  const legR = map.thighR ? subtree(map.thighR) : new Set();
  const segs = [];   // 手足の太さを変える区間 [骨, 子の関節キー, 男性, 女性]
  for (const sd of ['L', 'R']) {
    segs.push([map['upperArm' + sd], 'forearm' + sd, 0.13, -0.08]);
    segs.push([map['forearm' + sd], 'hand' + sd, 0.09, -0.06]);
    segs.push([map['thigh' + sd], 'shin' + sd, 0.03, 0.06]);
    segs.push([map['shin' + sd], 'foot' + sd, 0.08, -0.03]);
  }
  if (map.neck) segs.push([map.neck, 'head', 0.13, -0.08]);
  const segOf = new Map();
  for (const sg of segs) if (sg[0] && J[sg[1]]) segOf.set(sg[0], sg);

  const v = V3(), n = V3(), M = new THREE.Matrix4(), tmp = new THREE.Matrix4();
  for (const m of meshes) {
    const g = m.geometry;
    const pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    const N = pos.count;
    m.updateWorldMatrix(true, false);
    m.skeleton.update();
    const bones = m.skeleton.bones, bm = m.skeleton.boneMatrices;
    // スキン後のワールド位置と、その点の変形（線形部分）の逆行列
    const wp = new Float32Array(N * 3);
    const invL = new Array(N);
    const boneMat = k => tmp.fromArray(bm, k * 16);
    for (let i = 0; i < N; i++) {
      M.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (!w) continue;
        const e = boneMat(si.getComponent(i, k)).elements, me = M.elements;
        for (let q = 0; q < 16; q++) me[q] += e[q] * w;
      }
      // ワールド = matrixWorld · bindMatrixInverse · Σ(w·骨) · bindMatrix
      const L = m.matrixWorld.clone().multiply(m.bindMatrixInverse).multiply(M).multiply(m.bindMatrix);
      v.fromBufferAttribute(pos, i).applyMatrix4(L);
      wp[i * 3] = v.x; wp[i * 3 + 1] = v.y; wp[i * 3 + 2] = v.z;
      invL[i] = new THREE.Matrix3().setFromMatrix4(L).invert();
    }
    // ワールドでの法線（表を向いているかの判定に使う）
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(wp, 3));
    if (g.index) tg.setIndex(g.index);
    tg.computeVertexNormals();
    const wn = tg.attributes.normal.array;

    const dM = new Float32Array(N * 3), dF = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const x = wp[i * 3], y = wp[i * 3 + 1], z = wp[i * 3 + 2];
      n.set(wn[i * 3], wn[i * 3 + 1], wn[i * 3 + 2]);
      // 骨ごとの重み
      let wHead = 0, wArm = 0, wLeg = 0, wTrunk = 0, dom = null, domW = -1;
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (!w) continue;
        const b = bones[si.getComponent(i, k)];
        if (w > domW) { domW = w; dom = b; }
        if (head.has(b)) wHead += w;
        else if (armL.has(b) || armR.has(b)) wArm += w;
        else if (legL.has(b) || legR.has(b)) wLeg += w;
        else wTrunk += w;
      }
      const dm = V3(), df = V3();
      const lx = x - cx;
      const ax = Math.abs(lx);

      // 1) 体幹の横幅: 肩まわり・ウエスト・腰（大転子）の高さで、正中から外へ／内へ
      if (wTrunk + wLeg > 0) {
        const shoulderBand = bump(y, yShoulder - 0.03 * s, 0.075 * s) * wTrunk;
        const waistBand = bump(y, yWaist, 0.07 * s) * wTrunk;
        const hipBand = bump(y, yHip, 0.07 * s) * wTrunk;
        // 男性は胸郭の横幅（広背筋）も広く、逆三角形になる
        const latBand = bump(y, yBreast - 0.02 * s, 0.08 * s) * wTrunk;
        dm.x += lx * (0.11 * shoulderBand + 0.05 * latBand + 0.03 * waistBand - 0.06 * hipBand);
        df.x += lx * (-0.07 * shoulderBand - 0.09 * waistBand + 0.11 * hipBand);
        // 脚の付け根は形を変えずに外へ／内へずらす（横に引き伸ばすと腿の上が張り出して見える）
        if (wLeg > 0) {
          const top = smooth((y - (yHip - 0.16 * s)) / (0.12 * s));
          const shift = Math.sign(lx) * hipHalf * top * wLeg;
          dm.x += shift * -0.04; df.x += shift * 0.05;
        }
      }
      // 2) 胸: 女性は乳房、男性は大胸筋の厚み（前を向いた面だけ）
      if (wTrunk > 0 && n.z > 0.15) {
        const front = smooth((n.z - 0.15) / 0.5) * wTrunk;
        for (const sx of [1, -1]) {
          const bx = cx + sx * 0.092 * s;
          const r = Math.hypot(x - bx, (y - yBreast) * 1.1) / (0.075 * s);
          if (r < 1) {
            const a = (1 - r * r) ** 2 * front;
            df.addScaledVector(V3(sx * 0.12, -0.28, 1).normalize(), 0.034 * s * a);
          }
          const pr = Math.hypot(x - (cx + sx * 0.075 * s), (y - (yBreast + 0.03 * s)) * 0.9) / (0.095 * s);
          if (pr < 1) dm.z += 0.010 * s * (1 - pr * pr) ** 2 * front;
        }
      }
      // 3) 臀部: 女性は後ろへ張り出し、男性は平たく
      if ((wTrunk + wLeg) > 0 && n.z < -0.1) {
        const back = smooth((-n.z - 0.1) / 0.5) * bump(y, yGlute, 0.07 * s) * (wTrunk + wLeg) * smooth(ax / (0.03 * s));
        df.z -= 0.022 * s * back;
        dm.z += 0.006 * s * back;
      }
      // 4) 手足と首の太さ（骨の軸から放射状に）
      const sg = segOf.get(dom);
      if (sg && wHead < 0.5) {
        const a = W(sg[0]), b = J[sg[1]];
        const d = b.clone().sub(a); const len = d.length(); d.divideScalar(len || 1);
        const rel = V3(x, y, z).sub(a);
        const t = rel.dot(d) / (len || 1);
        const radial = rel.addScaledVector(d, -rel.dot(d));
        // 区間の端（関節）では弱める
        const mid = smooth(t / 0.18) * smooth((1 - t) / 0.18);
        let km = sg[2], kf = sg[3];
        // 大腿は女性の付け根（外側・内側）を厚く、男性は膝上（大腿四頭筋）を厚く
        if (sg[1].startsWith('shin')) { kf *= 1.6 * (1 - t); km *= 1.4 * t; }
        dm.addScaledVector(radial, km * mid * domW);
        df.addScaledVector(radial, kf * mid * domW);
      }
      // ワールドの変位を、スキン前の形の変位に直す
      const toLocal = (d, arr) => {
        if (d.lengthSq() < 1e-14) return;
        d.applyMatrix3(invL[i]);
        arr[i * 3] = d.x; arr[i * 3 + 1] = d.y; arr[i * 3 + 2] = d.z;
      };
      toLocal(dm, dM); toLocal(df, dF);
    }

    // 法線もモーフに合わせて変える（元の法線に「変形前後の差」だけを足す）
    const baseN = (() => { const q = new THREE.BufferGeometry(); q.setAttribute('position', pos.clone()); if (g.index) q.setIndex(g.index); q.computeVertexNormals(); return q.attributes.normal.array; })();
    const morphN = d => {
      const q = new THREE.BufferGeometry();
      const p2 = new Float32Array(N * 3);
      for (let i = 0; i < N * 3; i++) p2[i] = pos.array[i] + d[i];
      q.setAttribute('position', new THREE.BufferAttribute(p2, 3));
      if (g.index) q.setIndex(g.index);
      q.computeVertexNormals();
      const nn = q.attributes.normal.array, delta = new Float32Array(N * 3);
      for (let i = 0; i < N * 3; i++) delta[i] = nn[i] - baseN[i];
      return delta;
    };
    if (pos.array.length !== N * 3 || pos.isInterleavedBufferAttribute) continue;   // 共有バッファの形は扱わない
    g.morphAttributes.position = [new THREE.BufferAttribute(dM, 3), new THREE.BufferAttribute(dF, 3)];
    if (g.attributes.normal) g.morphAttributes.normal = [new THREE.BufferAttribute(morphN(dM), 3), new THREE.BufferAttribute(morphN(dF), 3)];
    g.morphTargetsRelative = true;
    g.userData.bodyMorph = true;
    m.updateMorphTargets();
    m.morphTargetInfluences.fill(0);
  }
  slot.bodyMorphs = true;
  return true;
}
