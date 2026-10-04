// proportions.js — 頭身を変えたときの体の比率
//
// 頭身は「解剖学」ではなく、絵のための約束ごと（プロポーションのカノン）。
// ここでは、実際の人の計測値（おとな約 7.5 頭身、6 歳ごろ約 6 頭身、1 歳ごろ約 4 頭身）と、
// 漫画・イラストで使われるデフォルメの比率（3 頭身・2 頭身）をつないだ表から決める。
//
// 表の数字は「頭の高さ」を 1 とした長さ。背丈は頭身の数（r）になる。
//   torso … あご先から股まで（首を含む）
//   neck  … あご先から首の付け根（胸骨の上）まで
//   legs  … 股から足の裏まで（= r − 1 − torso）
//
// 背丈を据え置いて頭身を下げたとき、絵の約束では
//   ・胴（首の付け根〜股）の長さは、背丈に対してほとんど変わらない（7.5 頭身で 0.33、3 頭身でも 0.32）
//   ・そのぶん脚が大きく縮む（股の高さ 0.49 → 3 頭身 0.32 → 2 頭身 0.23）
//   ・首は短くなり、2 頭身ではほぼ無くなる
//   ・肩幅や胴の厚み、手足の太さは、背丈に対してむしろ少し増える（ずんぐりする）
//   ・腕は胴とほぼ同じ長さ（垂らした手首が股のあたり）のまま
// つまり「胸の大きさはあまり変わらない」のは正しく、変えるべきは長さの配分と太さ。
//
// 長さと太さを別々に変えるため、骨ごとに「骨の向きにだけ伸び縮みする」倍率を持たせる。
// three.js の骨の scale は子の骨にもそのまま伝わり、向きの違う子では形がゆがむので、
// 子の骨には親の伸び縮みを打ち消して渡す（Maya の Segment Scale Compensate と同じ考え方）。
import * as THREE from 'three';

// 腕 … 肩から手首まで（背丈に対して）。デフォルメが強いほど短く、垂らした手が腰の横に来る
//          r     torso  neck  肩幅/背丈 手足の太さ 手の大きさ 足の長さ 足の幅 腕/背丈
const CANON = [
  [2.0,  0.55, 0.03, 0.300, 1.30, 1.12, 0.88, 1.20, 0.205],
  [2.5,  0.80, 0.06, 0.285, 1.24, 1.10, 0.90, 1.16, 0.240],
  [3.0,  1.05, 0.09, 0.270, 1.18, 1.08, 0.92, 1.12, 0.270],
  [4.0,  1.55, 0.17, 0.250, 1.10, 1.04, 0.96, 1.06, 0.310],
  [5.0,  2.00, 0.23, 0.237, 1.04, 1.02, 0.98, 1.02, 0.325],
  [6.0,  2.35, 0.28, 0.231, 1.01, 1.00, 1.00, 1.00, 0.330],
  [7.0,  2.65, 0.32, 0.230, 1.00, 1.00, 1.00, 1.00, 0.330],
  [7.5,  2.80, 0.33, 0.230, 1.00, 1.00, 1.00, 1.00, 0.330],
  [8.0,  2.95, 0.34, 0.232, 0.98, 1.00, 1.00, 1.00, 0.335],
  [9.0,  3.20, 0.36, 0.235, 0.95, 0.98, 1.02, 0.98, 0.340],
];

function canonAt(r) {
  r = Math.max(CANON[0][0], Math.min(CANON[CANON.length - 1][0], r));
  let i = 0;
  while (i < CANON.length - 2 && CANON[i + 1][0] < r) i++;
  const a = CANON[i], b = CANON[i + 1];
  const t = (r - a[0]) / (b[0] - a[0]);
  const v = a.map((x, k) => x + (b[k] - x) * t);
  const [rr, torso, neck, shoulder, limb, hand, footL, footW, arm] = v;
  return {
    r: rr,
    legs: (rr - 1 - torso) / rr,       // 股の高さ ÷ 背丈
    body: (torso - neck) / rr,         // 首の付け根〜股 ÷ 背丈
    neck: neck / rr,                   // 首 ÷ 背丈
    shoulder, limb, hand, footL, footW, arm,
  };
}

/** 比率の表（説明・テスト用） */
export function canonTable() {
  return CANON.map(row => {
    const c = canonAt(row[0]);
    return { r: row[0], crotch: +c.legs.toFixed(3), body: +c.body.toFixed(3), neck: +c.neck.toFixed(3), shoulder: row[3] };
  });
}

/**
 * モデル本来の頭身 r0 から r に変えるときの倍率（背丈は据え置き）。
 * どれも「モデルのその部分」を何倍にするか。
 * model … モデル自身の比率（脚 legs0＝股関節の高さ÷背丈、胴 body0＝首の付け根〜股関節÷背丈）。
 *   モデル本来の頭身の近くではモデルの個性（脚の長さなど）を残し、
 *   頭身を大きく変えるほど表の比率に寄せる（そうしないと脚の長いモデルは 2 頭身でも脚が長いまま）。
 */
export function deformFactors(r, r0, model = null) {
  const a = canonAt(r), b = canonAt(r0);
  // 表の比率へ寄せる度合い（モデル本来の頭身で 0、2 頭身・9 頭身で 1）
  const span = r < r0 ? Math.max(1e-3, r0 - 2) : Math.max(1e-3, 9 - r0);
  const t = Math.max(0, Math.min(1, Math.abs(r - r0) / span));
  const wgt = t * t * (3 - 2 * t);
  const blend = (rel, canon, own) => {
    if (!own || own <= 0) return rel;
    return ((1 - wgt) * own * rel + wgt * canon) / own;
  };
  // 股の高さは股関節より少し下（背丈の約 3%）。表の legs は股の高さなので合わせる
  const legs0 = model && model.legs0, body0 = model && model.body0;
  return {
    head: r0 / r,                                         // 頭の大きさ
    legL: blend(a.legs / b.legs, a.legs + 0.03, legs0),   // 脚の長さ
    trunkL: blend(a.body / b.body, a.body - 0.03, body0), // 胴の長さ（首の付け根〜股関節）
    neckL: a.neck / b.neck,                               // 首の長さ
    armL: a.arm / b.arm,                                  // 腕の長さ
    trunkW: a.shoulder / b.shoulder,    // 肩幅・胴の幅と厚み
    limbW: a.limb / b.limb,             // 手足の太さ
    hand: a.hand / b.hand,              // 手の大きさ
    footL: a.footL / b.footL,
    footW: a.footW / b.footW,
  };
}

// ---- 骨の向きにだけ伸び縮みする倍率 ----------------------------------------

const _t = new THREE.Vector3();

/** 方向 d に l 倍、それと直角な向きに w 倍する行列 */
function segMatrix(d, w, l, out) {
  const k = l - w;
  out.set(
    w + k * d.x * d.x, k * d.x * d.y, k * d.x * d.z, 0,
    k * d.y * d.x, w + k * d.y * d.y, k * d.y * d.z, 0,
    k * d.z * d.x, k * d.z * d.y, w + k * d.z * d.z, 0,
    0, 0, 0, 1);
  return out;
}

/**
 * 骨の行列の組み立て方を差し替える。
 *   自分 … 位置・回転・（ふつうの）倍率のあとに、骨の向きの伸び縮み S をかける
 *   子   … 親の S を打ち消してから、親の S で動かした位置に置く
 * こうすると、子の骨は回してもゆがまず、子の付け根は伸び縮みした親の先端に来る。
 */
export function installSegmentScale(bones) {
  for (const b of bones) {
    if (b.userData.segInstalled) continue;
    b.userData.segInstalled = true;
    b.updateMatrix = function () {
      const ps = this.parent && this.parent.userData && this.parent.userData.seg;
      if (ps) {
        _t.copy(this.position).applyMatrix4(ps.S);
        this.matrix.compose(_t, this.quaternion, this.scale);
        this.matrix.premultiply(ps.inv);
      } else {
        this.matrix.compose(this.position, this.quaternion, this.scale);
      }
      const s = this.userData.seg;
      if (s) this.matrix.multiply(s.S);
      this.matrixWorldNeedsUpdate = true;
    };
  }
}

/** 骨 b を、骨の向き d（骨の座標で）に l 倍・太さ w 倍にする。1・1 なら外す */
export function setSegment(b, d, w, l) {
  if (!d || (Math.abs(w - 1) < 1e-4 && Math.abs(l - 1) < 1e-4)) { b.userData.seg = null; return; }
  const S = segMatrix(d, w, l, new THREE.Matrix4());
  b.userData.seg = { S, inv: S.clone().invert(), w, l };
}

export function clearSegments(bones) {
  for (const b of bones) b.userData.seg = null;
}
