// contactFix.js — ポーズを当てたあと、手・腕・脚が体の別の部分にめり込んでいたら、外へ逃がす
//
// ・素体のスキンの頂点を、いまのポーズの形で読み、体の部分（胴・頭・上腕・前腕・手・腿・脛・足）に分ける
// ・前腕と手（腕）、脛と足と腿（脚）の頂点が、隣り合わない別の部分の皮膚より内側にあれば「めり込み」とする
//   （内側かどうかは、相手のいちばん近い頂点の法線で判定）
// ・めり込んだ分だけ、手首（足首）を相手の面の外向きへずらし、手（足）の向きは保ったまま腕（脚）を引き直す。
//   両手どうし・両脚どうしは、半分ずつ動かす。数回くり返す
// ・脚は、もう一方の脚に当たったときだけ動かす（正座・座る…のように、お尻や床に乗る形は崩さない）
// ・体型（腰幅など）や読み込んだモデルによって、同じ角度でも手が腿に入ることがあるので、ポーズの一覧から当てるたびに行う

import * as THREE from 'three';

const GROUPS = ['trunk', 'head', 'uaL', 'uaR', 'faL', 'faR', 'hdL', 'hdR', 'thL', 'thR', 'shL', 'shR', 'ftL', 'ftR'];
const GI = Object.fromEntries(GROUPS.map((g, i) => [g, i]));
const ADJ_PAIRS = [['trunk', 'head'], ['trunk', 'uaL'], ['trunk', 'uaR'], ['trunk', 'thL'], ['trunk', 'thR'],
  ['uaL', 'faL'], ['uaR', 'faR'], ['faL', 'hdL'], ['faR', 'hdR'], ['thL', 'shL'], ['thR', 'shR'], ['shL', 'ftL'], ['shR', 'ftR']];
// 手足ごとに、調べる部分（自分）と、動かす先の骨
const LIMBS = [
  { key: 'handL', own: ['uaL', 'faL', 'hdL'], probe: ['faL', 'hdL'], arm: true },
  { key: 'handR', own: ['uaR', 'faR', 'hdR'], probe: ['faR', 'hdR'], arm: true },
  // 脚は脛と足だけを調べる（腿どうしは股の付け根でいつも触れている）
  { key: 'footL', own: ['thL', 'shL', 'ftL'], probe: ['shL', 'ftL'], only: ['thR', 'shR', 'ftR'] },
  { key: 'footR', own: ['thR', 'shR', 'ftR'], probe: ['shR', 'ftR'], only: ['thL', 'shL', 'ftL'] },
];
const LIMB_OF = new Int8Array(GROUPS.length).fill(-1);
LIMBS.forEach((l, li) => { for (const g of l.own) LIMB_OF[GI[g]] = li; });

export class ContactFix {
  constructor(viewer) {
    this.v = viewer;
    this.enabled = true;
    this.cache = new WeakMap();
    const n = GROUPS.length;
    this.adj = new Uint8Array(n * n);
    for (let i = 0; i < n; i++) this.adj[i * n + i] = 1;
    for (const [a, b] of ADJ_PAIRS) { this.adj[GI[a] * n + GI[b]] = 1; this.adj[GI[b] * n + GI[a]] = 1; }
    // 手足ごとの「相手にしてよい部分」
    this.targets = LIMBS.map(l => {
      const ok = new Uint8Array(n);
      for (let g = 0; g < n; g++) {
        if (l.own.includes(GROUPS[g])) continue;
        if (l.only && !l.only.includes(GROUPS[g])) continue;
        ok[g] = 1;
      }
      return ok;
    });
    this.probeOf = LIMBS.map(l => new Set(l.probe.map(g => GI[g])));
  }

  /** スロットごとに一度: 頂点の受け持ちの骨と、体の部分 */
  _prep(slot) {
    let c = this.cache.get(slot);
    if (c) return c;
    const rev = new Map(Object.entries(slot.boneMap || {}).map(([k, b]) => [b, k]));
    const gcache = new Map();
    const grpOf = b => {
      if (gcache.has(b)) return gcache.get(b);
      let g = 'trunk';
      for (let x = b; x; x = x.parent) {
        const k = rev.get(x);
        if (!k) continue;
        if (/^(neck|head)$/.test(k)) g = 'head';
        else {
          const m = k.match(/^(upperArm|forearm|hand|thigh|shin|foot)([LR])$/);
          if (m) g = { upperArm: 'ua', forearm: 'fa', hand: 'hd', thigh: 'th', shin: 'sh', foot: 'ft' }[m[1]] + m[2];
        }
        break;
      }
      gcache.set(b, GI[g]);
      return GI[g];
    };
    const meshes = [];
    let total = 0;
    for (const m of slot.meshes || []) {
      if (!m.isSkinnedMesh || !m.skeleton) continue;
      if (m.userData.headPlane || m.userData.bonePart || m.userData.wire || m.userData.musclePart) continue;
      const g = m.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
      if (!pos || !si || !sw) continue;
      if (!g.attributes.normal) g.computeVertexNormals();
      const n = pos.count, dom = new Uint16Array(n), grp = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        let bw = -1, bi = 0;
        for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; bi = si.getComponent(i, k); } }
        dom[i] = bi;
        grp[i] = grpOf(m.skeleton.bones[bi]);
      }
      meshes.push({ m, n, dom, grp, off: total });
      total += n;
    }
    c = { meshes, total, P: new Float32Array(total * 3), N: new Float32Array(total * 3), G: new Uint8Array(total) };
    for (const me of meshes) c.G.set(me.grp, me.off);
    this.cache.set(slot, c);
    return c;
  }

  /** いまの形の頂点（ワールド）と法線 */
  _read(c) {
    const v = new THREE.Vector3(), nn = new THREE.Vector3();
    const M = new THREE.Matrix4(), R = new THREE.Matrix3();
    for (const me of c.meshes) {
      const m = me.m;
      m.updateWorldMatrix(true, false);
      m.skeleton.update();
      const nor = m.geometry.attributes.normal, bm = m.skeleton.boneMatrices;
      const rot = new Map();
      for (let i = 0; i < me.n; i++) {
        m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld);
        const k = (me.off + i) * 3;
        c.P[k] = v.x; c.P[k + 1] = v.y; c.P[k + 2] = v.z;
        const bi = me.dom[i];
        let r = rot.get(bi);
        if (!r) {
          M.fromArray(bm, bi * 16).premultiply(m.bindMatrixInverse).premultiply(m.matrixWorld).multiply(m.bindMatrix);
          r = new THREE.Matrix3().setFromMatrix4(M);
          rot.set(bi, r);
        }
        nn.fromBufferAttribute(nor, i).applyMatrix3(r).normalize();
        c.N[k] = nn.x; c.N[k + 1] = nn.y; c.N[k + 2] = nn.z;
      }
    }
  }

  /** 手足ごとのめり込み: [{ push: Vector3（外への向き×深さの和）, max, n }] */
  detect(slot) {
    const c = this._prep(slot);
    if (!c.total) return null;
    this._read(c);
    const { P, N, G, total } = c, NG = GROUPS.length;
    // 空間のます目（型付き配列のハッシュ表。衝突しても距離で選ぶので問題ない）
    const cell = 0.02, MASK = (1 << 16) - 1;
    const H = (a, b, d) => ((a * 73856093) ^ (b * 19349663) ^ (d * 83492791)) & MASK;
    if (!c.head || c.head.length !== MASK + 1) { c.head = new Int32Array(MASK + 1); c.next = new Int32Array(total); }
    const head = c.head, next = c.next;
    head.fill(-1);
    for (let i = 0; i < total; i++) {
      const h = H(Math.floor(P[i * 3] / cell), Math.floor(P[i * 3 + 1] / cell), Math.floor(P[i * 3 + 2] / cell));
      next[i] = head[h]; head[h] = i;
    }
    const out = LIMBS.map(() => ({ push: new THREE.Vector3(), max: 0, n: 0, other: new Map() }));
    const bestD = new Float64Array(NG), bestJ = new Int32Array(NG);
    for (let i = 0; i < total; i += 3) {
      const g1 = G[i], li = LIMB_OF[g1];
      if (li < 0 || !this.probeOf[li].has(g1)) continue;
      const ok = this.targets[li];
      const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
      const cx = Math.floor(px / cell), cy = Math.floor(py / cell), cz = Math.floor(pz / cell);
      bestD.fill(Infinity);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) {
        for (let j = head[H(cx + a, cy + b, cz + d)]; j >= 0; j = next[j]) {
          const g2 = G[j];
          if (!ok[g2] || this.adj[g1 * NG + g2]) continue;
          const dx = px - P[j * 3], dy = py - P[j * 3 + 1], dz = pz - P[j * 3 + 2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < bestD[g2]) { bestD[g2] = d2; bestJ[g2] = j; }
        }
      }
      for (let g2 = 0; g2 < NG; g2++) {
        if (bestD[g2] > 0.025 * 0.025) continue;
        const j = bestJ[g2];
        const sd = (px - P[j * 3]) * N[j * 3] + (py - P[j * 3 + 1]) * N[j * 3 + 1] + (pz - P[j * 3 + 2]) * N[j * 3 + 2];
        if (sd > -0.003) continue;
        const o = out[li], dep = -sd;
        o.push.x += N[j * 3] * dep; o.push.y += N[j * 3 + 1] * dep; o.push.z += N[j * 3 + 2] * dep;
        o.n++;
        if (dep > o.max) o.max = dep;
        o.other.set(g2, (o.other.get(g2) || 0) + 1);
      }
    }
    return out;
  }

  /**
   * めり込みを外へ逃がす。@returns {{ moved: string[], left: number }} 動かした手足と、残った深さ（m）
   */
  resolve(opts = {}) {
    const v = this.v, slot = v.primarySlot;
    if (!this.enabled || !slot || !slot.skeleton || !v.pull) return null;
    const iters = opts.iters ?? 7;
    const moved = new Set();
    let left = 0;
    for (let it = 0; it < iters; it++) {
      v.applyAll();
      slot.pivot.updateWorldMatrix(true, true);
      const res = this.detect(slot);
      if (!res) return null;
      left = 0;
      let any = false;
      res.forEach((r, li) => {
        if (r.n < 2 || r.max < 0.004) return;
        left = Math.max(left, r.max);
        const L = LIMBS[li];
        const end = slot.boneMap[L.key];
        if (!end || (v.isLocked && v.isLocked(L.key))) return;
        // 相手も動く手足（両手・両脚）なら半分ずつ
        let share = 1;
        for (const g2 of r.other.keys()) if (LIMB_OF[g2] >= 0 && LIMB_OF[g2] !== li && LIMBS[LIMB_OF[g2]].arm === L.arm) share = 0.5;
        const dir = r.push.clone();
        if (dir.lengthSq() < 1e-12) return;
        dir.normalize();
        // 前腕の真ん中が体に入っているときは、手首を動かしても肘の側はあまり動かないので、多めに動かす
        const dist = Math.min(0.06, (r.max * share + 0.004) * (L.arm && it >= 2 ? 1.6 : 1));
        const E = end.getWorldPosition(new THREE.Vector3());
        const q = end.getWorldQuaternion(new THREE.Quaternion());
        if (v.pull.solve(L.key, E.addScaledVector(dir, dist), q)) { moved.add(L.key); any = true; }
      });
      if (!any) break;
    }
    v.applyAll();
    return { moved: [...moved], left };
  }
}

// ===== contactFix.js ここまで =====
