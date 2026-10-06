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
//   手             … 男性は掌が幅広く厚い・指が太く節が目立つ・手首が太い。
//                    女性は掌が細く薄い・指が細く先へ細る・手首が細い。
//                    薬指と人差し指の長さの比（2D:4D）は男性のほうが薬指が長い
//
// 違いが見て分かるよう、平均値の差を少し強めに（およそ 1.5 倍）出している。
// それでも成人の個人差の範囲（平均 ± 2 標準偏差）には収まる量にしてある。
import * as THREE from 'three';

/** 変形の量。m … 男性、f … 女性。体の大きさ（身長 1.70m 換算）に対する割合 */
export const SHAPE = {
  shoulder: { m: 0.17, f: -0.11 },   // 肩まわりの横幅（三角筋・僧帽筋）
  lat:      { m: 0.09, f: 0 },       // 胸郭の横幅（広背筋）。男性の逆三角形
  waist:    { m: 0.04, f: -0.15 },   // ウエスト
  hip:      { m: -0.08, f: 0.17 },   // 腰（大転子）の横幅
  legShift: { m: -0.06, f: 0.085 },  // 脚の付け根の左右位置
  pec:      { m: 0.020 },            // 大胸筋の厚み
  trap:     { m: 0.016 },            // 僧帽筋（首の付け根から肩への盛り上がり）
  glute:    { m: 0.008, f: -0.036 }, // 臀部（マイナスが後ろへ張り出す）
  belly:    { f: 0.008 },            // 下腹部の丸み
  upperArm: { m: 0.21, f: -0.12 },
  forearm:  { m: 0.15, f: -0.10 },
  wrist:    { m: 0.06, f: -0.08 },   // 前腕の手首寄りにさらに足す
  thigh:    { m: 0.06, f: 0.10 },    // 男性は膝寄り、女性は付け根寄りを太く
  shin:     { m: 0.12, f: -0.05 },
  neck:     { m: 0.22, f: -0.14 },
  palmW:    { m: 0.09, f: -0.07 },   // 掌の幅
  palmT:    { m: 0.13, f: -0.08 },   // 掌の厚み
  finger:   { m: 0.15, f: -0.14 },   // 指の太さ（女性は先ほど細く）
  knuckle:  { m: 0.0034, f: -0.0012 }, // 拳の山（中手骨頭）・指の関節の出っぱり（m。男性は骨ばって目立ち、女性はなだらか）
};

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
export function buildBodyMorphs(slot, opts = {}) {
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
    segs.push([map['upperArm' + sd], 'forearm' + sd, SHAPE.upperArm.m, SHAPE.upperArm.f]);
    segs.push([map['forearm' + sd], 'hand' + sd, SHAPE.forearm.m, SHAPE.forearm.f]);
    segs.push([map['thigh' + sd], 'shin' + sd, SHAPE.thigh.m, SHAPE.thigh.f]);
    segs.push([map['shin' + sd], 'foot' + sd, SHAPE.shin.m, SHAPE.shin.f]);
  }
  if (map.neck) segs.push([map.neck, 'head', SHAPE.neck.m, SHAPE.neck.f]);
  const segOf = new Map();
  for (const sg of segs) if (sg[0] && J[sg[1]]) segOf.set(sg[0], sg);

  // 手: 掌と指。手の向き（指先・親指側・手のひら側）は viewer から受け取る
  const hands = {};
  for (const sd of ['L', 'R']) {
    const hb = map['hand' + sd], hf = opts.handFrame && opts.handFrame[sd];
    const fs = slot.fingers && slot.fingers[sd];
    if (!hb || !hf || !fs) continue;
    const set = subtree(hb);
    // 掌の中心: 手首と中指の付け根の中間、人差し指〜小指の付け根の幅の中央
    const base = f => fs[f] && fs[f][1] ? W(fs[f][1]) : null;
    const mid = base('middle') || base('index');
    const rad = base('index'), uln = base('pinky') || base('ring');
    const o = W(hb);
    const c = mid ? o.clone().lerp(mid, 0.55) : o.clone();
    if (rad && uln) {
      const rc = (rad.clone().sub(c).dot(hf.radial) + uln.clone().sub(c).dot(hf.radial)) / 2;
      c.addScaledVector(hf.radial, rc);
    }
    const palmLen = mid ? mid.distanceTo(o) : 0.08 * s;
    // 指の各節: 骨の付け根から次の節（なければ同じ向きに延ばした先）まで
    const fseg = new Map();
    for (const [finger, chain] of Object.entries(fs)) {
      for (let k = 1; k <= 3; k++) {
        const b = chain[k];
        if (!b) continue;
        const a = W(b);
        const nx = chain[k + 1] || b.children.find(q => q.isBone);
        let e = nx ? W(nx) : null;
        if (!e || e.distanceTo(a) < 1e-5) {
          const pr = chain[k - 1] ? W(chain[k - 1]) : (b.parent ? W(b.parent) : null);
          e = pr ? a.clone().add(a.clone().sub(pr).multiplyScalar(0.75)) : a.clone();
        }
        fseg.set(b, { a, e, k, thumb: finger === 'thumb' });
      }
    }
    // 拳の山（人差し指〜小指の付け根＝中手骨頭）と、指の第2関節。手の甲の側へ少しずらした所
    const kn = [];
    for (const f of ['index', 'middle', 'ring', 'pinky']) {
      const ch = fs[f];
      if (!ch) continue;
      if (ch[1]) kn.push({ p: W(ch[1]).addScaledVector(hf.palmar, -0.006 * s), r: 0.011 * s, w: 1 });
      if (ch[2]) kn.push({ p: W(ch[2]).addScaledVector(hf.palmar, -0.004 * s), r: 0.0075 * s, w: 0.55 });
    }
    hands[sd] = { bone: hb, set, hf, c, palmLen, fseg, kn };
  }

  // 乳房は別の部品として作る（breastParts.js）。ここでは胸の殻そのものは変形しない
  const zc0 = J.chest ? J.chest.z : J.hips.z;
  slot.bodyLandmarks = { s, cx, yBreast, ySN, zc: zc0, floor, H };

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

    // 男性の大胸筋の厚み（胴に引っ張られる頂点、胴の中心より前にあるものだけ）
    const chestF = new Float32Array(N * 3), chestM = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      let wT = 0;
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (!w) continue;
        const b = bones[si.getComponent(i, k)];
        if (!head.has(b) && !armL.has(b) && !armR.has(b) && !legL.has(b) && !legR.has(b)) wT += w;
      }
      if (wT <= 0) continue;
      const x = wp[i * 3], y = wp[i * 3 + 1], z = wp[i * 3 + 2];
      const front = smooth((z - zc0) / (0.075 * s)) * wT;
      if (front <= 0) continue;
      for (const sx of [1, -1]) {
        const pr = Math.hypot(x - (cx + sx * 0.078 * s), (y - (yBreast + 0.03 * s)) * 0.9) / (0.105 * s);
        if (pr < 1) chestM[i * 3 + 2] += SHAPE.pec.m * s * smooth(1 - pr) * front;
      }
    }

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
        dm.x += lx * (SHAPE.shoulder.m * shoulderBand + SHAPE.lat.m * latBand
          + SHAPE.waist.m * waistBand + SHAPE.hip.m * hipBand);
        df.x += lx * (SHAPE.shoulder.f * shoulderBand + SHAPE.waist.f * waistBand + SHAPE.hip.f * hipBand);
        // ウエストは前後の厚みも（女性は腹が薄く、腰の反りでくびれが横からも見える）
        df.z += (z - (J.spine ? J.spine.z : J.hips.z)) * -0.06 * waistBand;
        // 脚の付け根は形を変えずに外へ／内へずらす（横に引き伸ばすと腿の上が張り出して見える）
        if (wLeg > 0) {
          const top = smooth((y - (yHip - 0.16 * s)) / (0.12 * s));
          const shift = Math.sign(lx) * hipHalf * top * wLeg;
          dm.x += shift * SHAPE.legShift.m; df.x += shift * SHAPE.legShift.f;
        }
      }
      // 2) 胸（乳房・大胸筋）は前もって計算して、面に沿ってなめらかにしてある
      df.x += chestF[i * 3]; df.y += chestF[i * 3 + 1]; df.z += chestF[i * 3 + 2];
      dm.x += chestM[i * 3]; dm.y += chestM[i * 3 + 1]; dm.z += chestM[i * 3 + 2];
      // 男性の僧帽筋: 首の付け根から肩先へ、上を向いた面を持ち上げる
      if (wTrunk > 0 && n.y > 0.2) {
        const t = bump(ax, 0.075 * s, 0.045 * s) * bump(y, ySN + 0.015 * s, 0.05 * s) * smooth((n.y - 0.2) / 0.4);
        dm.y += SHAPE.trap.m * s * t * wTrunk;
      }
      // 女性の下腹部: へその下を少し丸く
      if (wTrunk > 0 && n.z > 0.3) {
        df.z += SHAPE.belly.f * s * bump(y, yHip + 0.06 * s, 0.05 * s) * bump(ax, 0, 0.08 * s) * wTrunk;
      }
      // 3) 臀部: 女性は後ろへ張り出し、男性は平たく
      if ((wTrunk + wLeg) > 0 && n.z < -0.1) {
        const back = smooth((-n.z - 0.1) / 0.5) * bump(y, yGlute, 0.075 * s) * (wTrunk + wLeg) * smooth(ax / (0.03 * s));
        df.z += SHAPE.glute.f * s * back;
        dm.z += SHAPE.glute.m * s * back;
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
        // 手首: 男性は太く、女性は細く（前腕の手首寄りにだけ足す）
        if (sg[1].startsWith('hand')) {
          const wr = smooth((t - 0.55) / 0.35);
          km += SHAPE.wrist.m * wr; kf += SHAPE.wrist.f * wr;
        }
        dm.addScaledVector(radial, km * mid * domW);
        df.addScaledVector(radial, kf * mid * domW);
      }
      // 5) 手: 掌の幅と厚み、指の太さ
      for (const sd of ['L', 'R']) {
        const hd = hands[sd];
        if (!hd || !hd.set.has(dom)) continue;
        const P = V3(x, y, z);
        const fsg = hd.fseg.get(dom);
        if (fsg) {
          // 指は節の軸から放射状に。女性は先の節ほど細くして、先細りの指にする
          const d = fsg.e.clone().sub(fsg.a); const len = d.length() || 1; d.divideScalar(len);
          const rel = P.clone().sub(fsg.a);
          const radial = rel.addScaledVector(d, -rel.dot(d));
          const km = SHAPE.finger.m * (fsg.thumb ? 0.85 : 1);
          const kf = SHAPE.finger.f * (0.75 + 0.2 * fsg.k) * (fsg.thumb ? 0.85 : 1);
          dm.addScaledVector(radial, km * domW);
          df.addScaledVector(radial, kf * domW);
        } else if (dom === hd.bone) {
          // 掌は中心から、親指側⇔小指側（幅）と、手のひら⇔手の甲（厚み）に広げる／狭める
          const rel = P.clone().sub(hd.c);
          const a = rel.dot(hd.hf.along) + hd.palmLen * 0.55;    // 手首からの距離
          const fade = smooth(a / (hd.palmLen * 0.45));          // 手首に近いほど弱める（前腕とつながるように）
          const r = rel.dot(hd.hf.radial), p = rel.dot(hd.hf.palmar);
          const k = domW * fade;
          dm.addScaledVector(hd.hf.radial, r * SHAPE.palmW.m * k).addScaledVector(hd.hf.palmar, p * SHAPE.palmT.m * k);
          df.addScaledVector(hd.hf.radial, r * SHAPE.palmW.f * k).addScaledVector(hd.hf.palmar, p * SHAPE.palmT.f * k);
        }
        // 拳の山・指の関節: 手の甲の側の皮膚だけを、山の中心からの距離でなだらかに持ち上げる（女性は下げる）
        if (hd.kn) {
          const back = -P.clone().sub(hd.c).dot(hd.hf.palmar);
          let bump = 0;
          for (const q of hd.kn) {
            const d2 = P.distanceToSquared(q.p) / (q.r * q.r);
            if (d2 < 4) bump += q.w * Math.exp(-d2 * 1.6);
          }
          if (bump > 0 && back > -0.004 * s) {
            const kb = Math.min(1, bump) * smooth((back + 0.004 * s) / (0.008 * s)) * domW;
            dm.addScaledVector(hd.hf.palmar, -SHAPE.knuckle.m * s * kb);
            df.addScaledVector(hd.hf.palmar, -SHAPE.knuckle.f * s * kb);
          }
        }
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
