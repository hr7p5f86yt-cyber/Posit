// blockModel.js — 体を単純な立体（箱・球・円柱・角錐台・くさび）に置き換えた「ブロック人形」
//
// ・デッサンで体を立体として捉える練習用。各部位は 1 つの単純な形で、向き・傾き・前後関係が読み取りやすい
//     頭部 … 卵形（頭蓋）＋あごの箱（顔の向きが分かる）、首 … 円柱
//     胸部 … 上が広い箱（胸郭）、腹部 … 楕円柱、腰部 … 下がすぼまる箱（骨盤）
//     上腕・前腕・大腿・下腿 … 円錐台、手 … 手のひらの箱＋指の箱＋親指、足 … くさび（三角柱）
//     肩・肘・手首・股関節・膝・足首 … 球（関節は色を変えて、どこで曲がるかが見えるように）
// ・形は基準姿勢（気をつけ）で作り、それぞれの骨の子として付けるので、ポーズを付けると一緒に動く
// ・箱の面の境目には細い線を引く（面の向きが変わる所が見えるように）
// ・左右は人形から見た左右（+X が人形の左）

import * as THREE from 'three';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function materials() {
  return {
    body: new THREE.MeshStandardMaterial({ color: 0xdcd6cc, roughness: 0.75, metalness: 0, flatShading: true, side: THREE.DoubleSide }),
    round: new THREE.MeshStandardMaterial({ color: 0xdcd6cc, roughness: 0.75, metalness: 0 }),
    joint: new THREE.MeshStandardMaterial({ color: 0x7f97b0, roughness: 0.6, metalness: 0 }),
    face: new THREE.MeshStandardMaterial({ color: 0xc9c1b4, roughness: 0.75, metalness: 0, flatShading: true, side: THREE.DoubleSide }),
    edge: new THREE.LineBasicMaterial({ color: 0x3a4250, transparent: true, opacity: 0.55 }),
  };
}

/** 3 本の軸（ex, ey, ez）と中心で、単位の形をその向きに置く行列 */
function frameMatrix(c, ex, ey, ez) {
  return new THREE.Matrix4().makeBasis(ex, ey, ez).setPosition(c);
}

/** 直交する 3 本の軸を作る（ey を主に、ez を前の目安に） */
function axes(ey, fwdHint) {
  const y = ey.clone().normalize();
  let z = fwdHint.clone().addScaledVector(y, -fwdHint.dot(y));
  if (z.lengthSq() < 1e-8) z = Math.abs(y.z) < 0.9 ? V3(0, 0, 1) : V3(1, 0, 0);
  z.normalize();
  const x = V3().crossVectors(y, z).normalize();
  return [x, y, z];
}

/** 上下で幅の違う箱（top/bot は [幅, 奥行き]）。中心から上下に h/2 */
function taperBox(h, top, bot) {
  const g = new THREE.BoxGeometry(1, h, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const up = p.getY(i) > 0;
    const [w, d] = up ? top : bot;
    p.setX(i, p.getX(i) * w);
    p.setZ(i, p.getZ(i) * d);
  }
  g.computeVertexNormals();
  return g;
}

/** a → b の円錐台（rA, rB は半径。ratio で断面を楕円に） */
function frustum(a, b, rA, rB, fwd, ratio = 1, seg = 12) {
  const L = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(rB, rA, L, seg, 1);
  g.scale(1, 1, ratio);
  const [x, y, z] = axes(b.clone().sub(a), fwd);
  g.applyMatrix4(frameMatrix(a.clone().lerp(b, 0.5), x, y, z));
  return g;
}

function ball(c, r) {
  const g = new THREE.SphereGeometry(r, 16, 12);
  g.translate(c.x, c.y, c.z);
  return g;
}

/** 足のくさび（三角柱）: かかとは高く、つま先へ低くなる */
function wedge(heel, toe, up, width, hHeel, hToe) {
  const fwd = toe.clone().sub(heel); const L = fwd.length(); fwd.normalize();
  const side = V3().crossVectors(up, fwd).normalize();
  const pts = [];
  for (const s of [-1, 1]) {
    const o = side.clone().multiplyScalar(s * width / 2);
    const o2 = side.clone().multiplyScalar(s * width * 0.62);   // かかとは細め、指の付け根で広い
    pts.push(heel.clone().addScaledVector(side, s * width * 0.32),                          // かかとの底
      heel.clone().addScaledVector(side, s * width * 0.32).addScaledVector(up, hHeel),     // かかとの上（足首の後ろ）
      toe.clone().add(o2).addScaledVector(fwd, -L * 0.28),                                 // 指の付け根の底
      toe.clone().add(o).addScaledVector(up, hToe));                                       // つま先の上
  }
  // 0..3 = 右側、4..7 = 左側
  const P = pts;
  const tri = [];
  const quad = (a, b, c, d) => tri.push(a, b, c, a, c, d);
  // 側面（四角形 0-1-3-2）
  quad(0, 2, 3, 1); quad(4, 5, 7, 6);
  quad(0, 4, 6, 2);       // 底
  quad(1, 3, 7, 5);       // 甲（斜め）
  quad(0, 1, 5, 4);       // かかと
  quad(2, 6, 7, 3);       // つま先
  // つま先の先端（指の付け根からつま先まで、底を延ばす）
  const g = new THREE.BufferGeometry();
  const pos = [];
  for (const i of tri) pos.push(P[i].x, P[i].y, P[i].z);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // 向きが逆の面があれば裏返す（中心から外を向くように）
  const c = V3(); for (const p of P) c.add(p); c.divideScalar(P.length);
  const pa = g.attributes.position;
  for (let i = 0; i < pa.count; i += 3) {
    const A = V3().fromBufferAttribute(pa, i), B = V3().fromBufferAttribute(pa, i + 1), C = V3().fromBufferAttribute(pa, i + 2);
    const n = V3().subVectors(B, A).cross(V3().subVectors(C, A));
    if (n.dot(A.clone().add(B).add(C).divideScalar(3).sub(c)) < 0) { pa.setXYZ(i + 1, C.x, C.y, C.z); pa.setXYZ(i + 2, B.x, B.y, B.z); }
  }
  g.computeVertexNormals();
  return g;
}

/**
 * ブロック人形を組み立てる。呼ぶ前に骨を基準姿勢に戻しておくこと。
 * @param {object} slot   viewer のスロット
 * @param {object} extra  { handFrame: {L, R}, floor }
 * @returns {THREE.Object3D[]} 各ボーンの子として追加したメッシュと線（初期は非表示）
 */
export function buildBlockModel(slot, extra = {}) {
  const map = slot.boneMap || {};
  if (!slot.skeleton || !map.hips) return [];
  slot.pivot.updateWorldMatrix(true, true);
  const W = k => (map[k] ? map[k].getWorldPosition(V3()) : null);
  const mats = materials();
  const out = [];
  const hips = W('hips'), neck = W('neck'), head = W('head');
  const fL = W('footL'), fR = W('footR');
  const footY = Math.min(fL ? fL.y : hips.y - 0.9, fR ? fR.y : hips.y - 0.9);
  // 背丈のおおよそ（足首 → 頭の骨 + 頭の上）と、床（足首の 4.5%×身長 下）
  const H0 = head ? head.y - footY : 1.45;
  const s = H0 / 1.40;                                  // 身長 1.70m の人で 足首〜頭の骨 ≒ 1.40m
  const floor = extra.floor ?? footY - 0.078 * s;
  const FWD = V3(0, 0, 1), UP = V3(0, 1, 0);
  // 箱・くさびは面の境目に線を引く（丸い形は輪郭だけで十分なので引かない）
  const add = (boneKey, geo, kind = 'body', edges = kind === 'body' || kind === 'face') => {
    const bone = map[boneKey];
    if (!bone || !geo) return;
    bone.updateWorldMatrix(true, false);
    const inv = bone.matrixWorld.clone().invert();
    geo.applyMatrix4(inv);
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mats[kind]);
    m.castShadow = true; m.receiveShadow = true; m.visible = false; m.frustumCulled = false;
    m.userData.blockPart = true; m.userData.jointBone = bone; m.userData.slot = slot.key;
    bone.add(m); out.push(m);
    if (edges) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), mats.edge);
      e.visible = false; e.userData.blockPart = true; e.userData.blockEdge = true; e.raycast = () => {};
      bone.add(e); out.push(e);
    }
  };

  // ---- 体幹 ---------------------------------------------------------------
  const shL = W('upperArmL'), shR = W('upperArmR');
  const shoulderW = shL && shR ? shL.distanceTo(shR) : 0.29 * s;
  const hipL = W('thighL'), hipR = W('thighR');
  const hipW = hipL && hipR ? hipL.distanceTo(hipR) : 0.17 * s;
  const chestB = map.chest ? 'chest' : 'spine';
  const yNeck = neck ? neck.y : hips.y + 0.44 * s;
  const yChestTop = yNeck - 0.035 * s, yChestBot = yChestTop - 0.30 * s;
  const yPelvTop = hips.y + 0.05 * s, yPelvBot = (hipL ? hipL.y : hips.y - 0.06 * s) - 0.07 * s;
  const zc = hips.z;
  // 胸部: 胸郭の箱（上が広く、少し前へ傾く）
  {
    const g = taperBox(yChestTop - yChestBot, [shoulderW * 1.0, 0.21 * s], [shoulderW * 0.86, 0.19 * s]);
    g.translate(0, 0, 0);
    g.applyMatrix4(frameMatrix(V3(hips.x, (yChestTop + yChestBot) / 2, zc + 0.005 * s), V3(1, 0, 0), UP, FWD));
    add(chestB, g);
  }
  // 腹部: 楕円柱（胸と骨盤のあいだ）
  {
    const a = V3(hips.x, yPelvTop - 0.01 * s, zc), b = V3(hips.x, yChestBot + 0.01 * s, zc);
    add(map.spine ? 'spine' : 'hips', frustum(a, b, shoulderW * 0.40, shoulderW * 0.42, FWD, 0.66, 16), 'round');
  }
  // 腰部: 骨盤の箱（下がすぼまる）
  {
    const g = taperBox(yPelvTop - yPelvBot, [hipW * 2.05, 0.20 * s], [hipW * 1.55, 0.17 * s]);
    g.applyMatrix4(frameMatrix(V3(hips.x, (yPelvTop + yPelvBot) / 2, zc - 0.005 * s), V3(1, 0, 0), UP, FWD));
    add('hips', g);
  }
  // 首: 円柱（胸の上 → 頭の下）
  if (neck && head) {
    add('neck', frustum(V3(neck.x, yChestTop - 0.01 * s, neck.z), head.clone().add(V3(0, 0.01 * s, 0)), 0.055 * s, 0.050 * s, FWD, 1, 14), 'round');
  }
  // 頭部: 頭蓋の卵形＋あご（顔の向き）
  if (head) {
    const g = new THREE.SphereGeometry(1, 14, 10);
    g.scale(0.090 * s, 0.112 * s, 0.103 * s);
    g.translate(head.x, head.y + 0.11 * s, head.z - 0.005 * s);
    add('head', g);
    const jaw = taperBox(0.07 * s, [0.11 * s, 0.10 * s], [0.07 * s, 0.07 * s]);
    jaw.applyMatrix4(frameMatrix(V3(head.x, head.y + 0.035 * s, head.z + 0.035 * s), V3(1, 0, 0), UP, FWD));
    add('head', jaw, 'face');
  }

  // ---- 腕 -----------------------------------------------------------------
  for (const sd of ['L', 'R']) {
    const sx = sd === 'L' ? 1 : -1;
    const S = W('upperArm' + sd), E = W('forearm' + sd), Wr = W('hand' + sd);
    if (!S || !E || !Wr) continue;
    add('upperArm' + sd, ball(S, 0.056 * s), 'joint');                            // 肩
    add('upperArm' + sd, frustum(S, E, 0.050 * s, 0.040 * s, FWD, 0.95), 'round');          // 上腕
    add('forearm' + sd, ball(E, 0.045 * s), 'joint');                              // 肘
    add('forearm' + sd, frustum(E, Wr, 0.040 * s, 0.028 * s, FWD, 0.8), 'round');           // 前腕
    add('hand' + sd, ball(Wr, 0.031 * s), 'joint');                                // 手首
    // 手: 手のひらの箱＋指の箱＋親指
    const hf = extra.handFrame && extra.handFrame[sd];
    const fg = slot.fingers && slot.fingers[sd];
    if (hf) {
      const along = hf.along.clone().normalize(), rad = hf.radial.clone().normalize(), pal = hf.palmar.clone().normalize();
      const m1 = fg && fg.middle && fg.middle[1] ? fg.middle[1].getWorldPosition(V3()) : Wr.clone().addScaledVector(along, 0.09 * s);
      const palmL = Wr.distanceTo(m1);
      const pc = Wr.clone().addScaledVector(along, palmL * 0.55);
      const palm = new THREE.BoxGeometry(0.088 * s, palmL * 0.95, 0.032 * s);
      palm.applyMatrix4(frameMatrix(pc, V3().crossVectors(along, pal).normalize(), along, pal));
      add('hand' + sd, palm);
      // 指: 中指の付け根の骨に付ける（指を曲げると箱も曲がる）
      if (fg && fg.middle && fg.middle[1]) {
        const bone = fg.middle[1];
        let tip = bone; while (tip.children.find(c => c.isBone)) tip = tip.children.find(c => c.isBone);
        const T = tip.getWorldPosition(V3()).addScaledVector(along, 0.012 * s);
        const fl = m1.distanceTo(T);
        const fing = new THREE.BoxGeometry(0.084 * s, fl, 0.024 * s);
        fing.applyMatrix4(frameMatrix(m1.clone().lerp(T, 0.5), V3().crossVectors(along, pal).normalize(), along, pal));
        bone.updateWorldMatrix(true, false);
        const m = new THREE.Mesh(fing.applyMatrix4(bone.matrixWorld.clone().invert()), mats.body);
        m.castShadow = true; m.visible = false; m.frustumCulled = false;
        m.userData.blockPart = true; m.userData.jointBone = map['hand' + sd]; m.userData.slot = slot.key;
        bone.add(m); out.push(m);
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), mats.edge);
        e.visible = false; e.userData.blockPart = true; e.userData.blockEdge = true; e.raycast = () => {};
        bone.add(e); out.push(e);
      }
      const t1 = fg && fg.thumb && fg.thumb[1];
      if (t1) {
        let tip = t1; while (tip.children.find(c => c.isBone)) tip = tip.children.find(c => c.isBone);
        const A = t1.getWorldPosition(V3()), B = tip.getWorldPosition(V3());
        const g = frustum(A, B, 0.016 * s, 0.012 * s, pal, 1, 8);
        t1.updateWorldMatrix(true, false);
        const m = new THREE.Mesh(g.applyMatrix4(t1.matrixWorld.clone().invert()), mats.body);
        m.castShadow = true; m.visible = false; m.frustumCulled = false;
        m.userData.blockPart = true; m.userData.jointBone = map['hand' + sd]; m.userData.slot = slot.key;
        t1.add(m); out.push(m);
      }
    }
  }

  // ---- 脚 -----------------------------------------------------------------
  for (const sd of ['L', 'R']) {
    const Hj = W('thigh' + sd), K = W('shin' + sd), A = W('foot' + sd);
    if (!Hj || !K || !A) continue;
    add('thigh' + sd, ball(Hj, 0.072 * s), 'joint');                               // 股関節
    add('thigh' + sd, frustum(Hj, K, 0.082 * s, 0.056 * s, FWD, 0.95), 'round');            // 大腿
    add('shin' + sd, ball(K, 0.060 * s), 'joint');                                 // 膝
    add('shin' + sd, frustum(K, A, 0.055 * s, 0.034 * s, FWD, 0.9), 'round');               // 下腿
    add('foot' + sd, ball(A, 0.040 * s), 'joint');                                 // 足首
    // 足: かかと〜つま先のくさび
    const toeB = map['foot' + sd].children.find(c => c.isBone);
    const Tb = toeB ? toeB.getWorldPosition(V3()) : A.clone().add(V3(0, -0.06 * s, 0.13 * s));
    const fwd = Tb.clone().sub(A); fwd.y = 0; fwd.normalize();
    const heel = A.clone().addScaledVector(fwd, -0.055 * s); heel.y = floor;
    const toe = Tb.clone().addScaledVector(fwd, 0.065 * s); toe.y = floor;
    add('foot' + sd, wedge(heel, toe, UP, 0.095 * s, (A.y - floor) + 0.01 * s, 0.022 * s));
  }
  return out;
}

// ===== blockModel.js ここまで =====
