// bones.js — ボーン名の吸収と関節定義
// Mixamo / VRM / Rigify / UE風 など、リグごとに違うボーン名を共通の関節キーに対応づける。

// ---- 関節定義 -------------------------------------------------------------
// limits: [xMin,xMax, yMin,yMax, zMin,zMax]（度）— Swift版で検証した値をそのまま使う
// x=前後(曲げ) / y=ひねり / z=左右  ※右側は左をミラーする

/** 左の可動域を右用に反転する */
function mirrorLimits(l) {
  return [l[0], l[1], -l[3], -l[2], -l[5], -l[4]];
}

const FREE = [-180, 180, -180, 180, -180, 180];

const BASE = {
  hips:     { name: '腰',   limits: FREE,                                  axes: ['前後に傾く', '向き', '左右に傾く'] },
  spine:    { name: '腹',   limits: [-40, 60, -50, 50, -40, 40],           axes: ['前後', 'ひねり', '左右'] },
  chest:    { name: '胸',   limits: [-40, 55, -50, 50, -40, 40],           axes: ['前後', 'ひねり', '左右'] },
  neck:     { name: '首',   limits: [-55, 65, -75, 75, -45, 45],           axes: ['うなずく', '振り向く', 'かしげる'] },
  head:     { name: '頭',   limits: [-45, 45, -50, 50, -35, 35],           axes: ['うなずく', '振り向く', 'かしげる'] },
  jaw:      { name: 'あご', limits: [0, 35, -10, 10, -10, 10],             axes: ['口を開く', '左右にずらす', '傾き'] },
  shoulder: { name: '肩',   limits: [-25, 25, -40, 25, -20, 40],  sided: true, axes: ['前後', '前に出す', 'すくめる'] },
  upperArm: { name: '上腕', limits: [-185, 80, -110, 100, -50, 185], sided: true, axes: ['前後', 'ひねり', '左右'] },
  forearm:  { name: '前腕', limits: [-160, 10, -100, 100, -15, 15], sided: true, axes: ['曲げる', 'ひねり', '左右'] },
  hand:     { name: '手',   limits: [-90, 85, -100, 100, -35, 45], sided: true, axes: ['前後', 'ひねり', '左右'] },
  thigh:    { name: '腿',   limits: [-150, 60, -70, 70, -40, 110], sided: true, axes: ['前後', 'ひねり', '左右'] },
  shin:     { name: '脛',   limits: [-5, 165, -40, 40, -12, 12],   sided: true, axes: ['曲げる', 'ひねり', '左右'] },
  foot:     { name: '足',   limits: [-40, 70, -40, 40, -40, 40],   sided: true, axes: ['つま先の上下', '内外に向ける', '内外に傾ける'] },
};

const ORDER = ['hips', 'spine', 'chest', 'neck', 'head', 'jaw',
  'shoulder', 'upperArm', 'forearm', 'hand', 'thigh', 'shin', 'foot'];

export const JOINTS = (() => {
  const list = [];
  for (const base of ORDER) {
    const b = BASE[base];
    if (b.sided) {
      list.push({ key: base + 'L', base, name: b.name, side: 'L', limits: b.limits, axes: b.axes });
      list.push({ key: base + 'R', base, name: b.name, side: 'R', limits: mirrorLimits(b.limits), axes: b.axes });
    } else {
      list.push({ key: base, base, name: b.name, side: null, limits: b.limits, axes: b.axes });
    }
  }
  return list;
})();

export const JOINT_BY_KEY = Object.fromEntries(JOINTS.map(j => [j.key, j]));

/** 「左上腕」のような表示名 */
export function jointLabel(key) {
  const j = JOINT_BY_KEY[key];
  if (!j) return '';
  return (j.side ? (j.side === 'L' ? '左' : '右') : '') + j.name;
}

export const JOINT_GROUPS = [
  { title: '体幹', keys: ['hips', 'spine', 'chest', 'neck', 'head', 'jaw'] },
  { title: '左腕', keys: ['shoulderL', 'upperArmL', 'forearmL', 'handL'] },
  { title: '右腕', keys: ['shoulderR', 'upperArmR', 'forearmR', 'handR'] },
  { title: '左脚', keys: ['thighL', 'shinL', 'footL'] },
  { title: '右脚', keys: ['thighR', 'shinR', 'footR'] },
];

// ---- ボーン名の正規化 -----------------------------------------------------

const PREFIXES = [
  'mixamorig', 'armature', 'root_', 'bip01_', 'bip01', 'bip_', 'b_',
  'def_', 'org_', 'ctrl_', 'j_bip_', 'j_sec_', 'j_adj_', 'cc_base_', 'skel_',
];

function stripPrefixes(s) {
  let out = s;
  for (let pass = 0; pass < 3; pass++) {
    for (const p of PREFIXES) {
      if (out.startsWith(p) && out.length > p.length) { out = out.slice(p.length); break; }
    }
  }
  return out;
}

/** 記号をすべて "_" に寄せ、前置詞を落とした小文字名を返す */
export function normalizeName(raw) {
  let s = String(raw || '').toLowerCase();
  s = s.replace(/[\s:.\-|]+/g, '_');
  s = s.replace(/_+/g, '_').replace(/^_|_$/g, '');
  s = stripPrefixes(s);
  s = s.replace(/^_|_$/g, '');
  return s;
}

const LEFT_TOKENS = new Set(['left', 'l', 'lft', 'lf']);
const RIGHT_TOKENS = new Set(['right', 'r', 'rgt', 'rt']);
const CENTER_TOKENS = new Set(['c', 'center', 'ctr', 'mid', 'm']);

/**
 * 左右を判定し、左右を示す語を取り除いた「芯」の名前を返す。
 * 例: "leftupleg" -> { side:'L', core:'upleg' }
 *     "upper_arm_l" -> { side:'L', core:'upperarm' }
 *     "shoulder" -> { side:null, core:'shoulder' }
 */
export function splitSide(normalized) {
  const tokens = normalized.split('_').filter(Boolean);
  const kept = [];
  let side = null;
  for (const t of tokens) {
    if (side === null && LEFT_TOKENS.has(t)) { side = 'L'; continue; }
    if (side === null && RIGHT_TOKENS.has(t)) { side = 'R'; continue; }
    if (CENTER_TOKENS.has(t)) continue;   // VRM の "J_Bip_C_Hips" などの中央マーカー
    kept.push(t);
  }
  let core = kept.join('');
  if (side === null) {
    // 区切りのない "LeftUpLeg" / "UpLeg_L" のような形
    if (core.startsWith('left')) { side = 'L'; core = core.slice(4); }
    else if (core.startsWith('right')) { side = 'R'; core = core.slice(5); }
    else if (core.endsWith('left')) { side = 'L'; core = core.slice(0, -4); }
    else if (core.endsWith('right')) { side = 'R'; core = core.slice(0, -5); }
  }
  return { side, core };
}

// ---- 芯の名前 → 関節 ------------------------------------------------------
// 具体的なものから順に解決し、一度使ったボーンは他の関節に渡さない。
const PATTERNS = [
  ['head',     ['head', 'skull', 'cranium']],
  ['jaw',      ['jaw', 'chin', 'lowerjaw', 'jawroot']],
  ['neck',     ['neck', 'neck1', 'neck01', 'cervical', 'neck02']],
  ['chest',    ['spine2', 'spine02', 'spine3', 'spine03', 'upperchest', 'chest', 'ribcage', 'thoracic', 'torso2', 'sternum']],
  ['spine',    ['spine1', 'spine01', 'spine', 'abdomen', 'waist', 'torso', 'lumbar', 'belly']],
  ['hips',     ['hips', 'hip', 'pelvis', 'root', 'sacrum', 'cog', 'center']],
  ['shoulder', ['shoulder', 'clavicle', 'collar', 'shoulderblade', 'scapula']],
  ['upperArm', ['upperarm', 'arm', 'upperarmtwist', 'humerus', 'arm1', 'upperarm1']],
  ['forearm',  ['forearm', 'lowerarm', 'elbow', 'forearmtwist', 'ulna', 'radius', 'arm2', 'lowerarm1']],
  ['hand',     ['hand', 'wrist', 'palm', 'carpal', 'metacarpal']],
  ['thigh',    ['upleg', 'upperleg', 'thigh', 'femur', 'thighs', 'leg1', 'upperleg1']],
  ['shin',     ['leg', 'lowerleg', 'calf', 'shin', 'knee', 'tibia', 'fibula', 'leg2', 'lowerleg1']],
  ['foot',     ['foot', 'ankle', 'tarsal', 'calcaneus', 'heel']],
];

const SIDED = new Set(['shoulder', 'upperArm', 'forearm', 'hand', 'thigh', 'shin', 'foot']);

/**
 * skeleton.bones から 関節キー -> Bone の対応表を作る。
 * @returns {{ map: Object<string, THREE.Bone>, unmatched: string[] }}
 */
export function mapBones(bones) {
  const entries = bones.map(b => {
    const n = normalizeName(b.name);
    const { side, core } = splitSide(n);
    return { bone: b, normalized: n, side, core };
  });

  const used = new Set();
  const map = {};

  const take = (jointKey, predicate) => {
    if (map[jointKey]) return;
    for (const e of entries) {
      if (used.has(e.bone)) continue;
      if (predicate(e)) { map[jointKey] = e.bone; used.add(e.bone); return; }
    }
  };

  for (const [base, cores] of PATTERNS) {
    const sides = SIDED.has(base) ? ['L', 'R'] : [null];
    for (const side of sides) {
      const key = side ? base + side : base;
      // 1) 芯の完全一致（最優先）
      for (const c of cores) {
        take(key, e => e.core === c && e.side === side);
        if (map[key]) break;
      }
      // 2) 芯の前方一致（"spine1x" のような派生）
      if (!map[key]) {
        for (const c of cores) {
          take(key, e => e.side === side && e.core.startsWith(c) && e.core.length <= c.length + 2);
          if (map[key]) break;
        }
      }
      // 3) 中央のボーンだけ、左右不明でも部分一致を許す
      if (!map[key] && side === null) {
        for (const c of cores) {
          take(key, e => e.side === null && e.core.includes(c));
          if (map[key]) break;
        }
      }
    }
  }

  const unmatched = entries.filter(e => !used.has(e.bone)).map(e => e.bone.name);
  return { map, unmatched };
}

/** 角度を -180〜180 に畳む */
export function wrapDeg(d) {
  return ((d + 180) % 360 + 360) % 360 - 180;
}

/** 可動域からどれだけはみ出しているか（度の合計） */
export function limitExcess(jointKey, a) {
  const j = JOINT_BY_KEY[jointKey];
  if (!j) return 0;
  const [xa, xb, ya, yb, za, zb] = j.limits;
  const over = (v, lo, hi) => (v < lo ? lo - v : (v > hi ? v - hi : 0));
  return over(a.x, xa, xb) + over(a.y, ya, yb) + over(a.z, za, zb);
}

/** 角度を可動域に収める */
export function clampAngles(jointKey, a) {
  const j = JOINT_BY_KEY[jointKey];
  if (!j) return a;
  const [xa, xb, ya, yb, za, zb] = j.limits;
  return {
    x: Math.min(xb, Math.max(xa, a.x)),
    y: Math.min(yb, Math.max(ya, a.y)),
    z: Math.min(zb, Math.max(za, a.z)),
  };
}


// ---- 指の骨 ---------------------------------------------------------------

const FINGER_ALIASES = {
  thumb: 'thumb', index: 'index', middle: 'middle', mid: 'middle',
  ring: 'ring', pinky: 'pinky', little: 'pinky', pinkie: 'pinky',
};
const SEGMENT_WORDS = { proximal: 1, intermediate: 2, middle: 2, distal: 3 };

/**
 * 指の骨を {L:{index:{1:骨,2:骨,3:骨}, ...}, R:{...}} の形に対応づける。
 * Mixamo の "LeftHandIndex1"、VRM の "J_Bip_L_Index1" / "LeftIndexProximal"、
 * UE の "index_01_l"、Blender の "f_index.01.L" などを吸収する。
 */
export function mapFingers(bones) {
  const out = { L: {}, R: {} };
  for (const b of bones) {
    const { side, core } = splitSide(normalizeName(b.name));
    if (!side) continue;
    let c = core;
    if (c.startsWith('hand')) c = c.slice(4);
    else if (c.startsWith('f') && !c.startsWith('foot')) c = c.slice(1);

    let finger = null;
    for (const key of Object.keys(FINGER_ALIASES)) {
      if (c.startsWith(key)) { finger = FINGER_ALIASES[key]; c = c.slice(key.length); break; }
    }
    if (!finger) continue;

    let seg = null;
    const digits = c.match(/^0*([1-4])/);
    if (digits) {
      seg = parseInt(digits[1], 10);
    } else {
      for (const w of Object.keys(SEGMENT_WORDS)) {
        if (c.startsWith(w)) { seg = SEGMENT_WORDS[w]; break; }
      }
    }
    if (!seg || seg > 3) continue;

    if (!out[side][finger]) out[side][finger] = {};
    if (!out[side][finger][seg]) out[side][finger][seg] = b;
  }
  return out;
}

/** 指の骨がいくつ見つかったか */
export function fingerCount(fingers) {
  let n = 0;
  for (const side of ['L', 'R']) {
    for (const f of Object.keys(fingers[side] || {})) n += Object.keys(fingers[side][f]).length;
  }
  return n;
}

// ---------------------------------------------------------------------------
// 名前に頼らない関節の割り出し
// ---------------------------------------------------------------------------
// 解剖学の名前が付いた骨格モデルなど、名前の対応表で拾えないリグ向け。
// ボーンのつながり方と、休めの姿勢での位置関係だけを見て関節を決める。
//
// 考え方
//   1. いちばん上の骨（頭頂）と、そこへ至る道筋＝背骨の並び を見つける
//   2. 左右いちばん外へ伸びる先（指先）から親をたどり、背骨に着いた所を胸とする
//   3. 腕・脚は「続けて2本いちばん長い区間」を上腕と前腕、腿とすねに当てる
//      （鎖骨や手首の小さな骨が何本挟まっていても効く）
// ---------------------------------------------------------------------------

/** 子のボーンだけを返す */
function boneChildren(b) {
  return (b.children || []).filter(c => c.isBone);
}

/** 骨のつながりを上へたどる（配列は自分→親→…の順） */
function ancestry(b, inSet) {
  const out = [];
  let cur = b;
  while (cur && inSet.has(cur)) { out.push(cur); cur = cur.parent; }
  return out;
}

/** a から b へ下る道筋。無ければ null */
function pathDown(a, b, inSet) {
  const up = ancestry(b, inSet);
  const idx = up.indexOf(a);
  if (idx < 0) return null;
  return up.slice(0, idx + 1).reverse();
}

/** 続けて 2 本、いちばん長い区間を探して [手前, 真ん中, 先] を返す */
function longestTwoLinks(chain, P) {
  if (chain.length < 3) return null;
  const len = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const a = P(chain[i]), b = P(chain[i + 1]);
    len.push(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  }
  let best = -1, at = 0;
  for (let i = 0; i < len.length - 1; i++) {
    const v = len[i] + len[i + 1];
    if (v > best) { best = v; at = i; }
  }
  return { root: chain[at], mid: chain[at + 1], tip: chain[at + 2], before: at > 0 ? chain[at - 1] : null };
}

/**
 * ボーンのつながりと位置だけから関節を割り出す。
 * @param {Array} bones     スケルトンのボーン
 * @param {Function} posOf  ボーン → {x,y,z}（休めの姿勢でのワールド座標）
 * @returns {Object} 関節キー → ボーン
 */
export function mapBonesByStructure(bones, posOf) {
  const map = {};
  if (!bones || bones.length < 8 || typeof posOf !== 'function') return map;
  const inSet = new Set(bones);
  const P = b => posOf(b);

  // --- 上下・左右のいちばん端 ---
  let top = null, xMax = null, xMin = null;
  for (const b of bones) {
    const p = P(b);
    if (!p) continue;
    if (!top || p.y > P(top).y) top = b;
    if (!xMax || p.x > P(xMax).x) xMax = b;
    if (!xMin || p.x < P(xMin).x) xMin = b;
  }
  if (!top || !xMax || !xMin) return map;

  // --- 根元から頭頂までの道筋 ---
  const upTop = ancestry(top, inSet);
  const rootBone = upTop[upTop.length - 1];
  const trunk = pathDown(rootBone, top, inSet);
  if (!trunk || trunk.length < 3) return map;

  // 各ボーンの「その先が届くいちばん低いところ／いちばん外側」を測っておく
  const reach = new Map();
  (function measure(b) {
    const p = P(b);
    let lowY = p ? p.y : 0, farX = p ? Math.abs(p.x) : 0;
    for (const c of boneChildren(b)) {
      const r = measure(c);
      lowY = Math.min(lowY, r.lowY);
      farX = Math.max(farX, r.farX);
    }
    const r = { lowY, farX };
    reach.set(b, r);
    return r;
  })(rootBone);

  // --- 腰：道筋のうち、下へ伸びる枝を二本持ついちばん深いところ ---
  const floorY = reach.get(rootBone).lowY;
  const topY = P(top).y;
  const legLine = floorY + (topY - floorY) * 0.35;     // ここより下へ届けば脚
  const onTrunk = new Set(trunk);
  let hips = null;
  for (let i = trunk.length - 1; i >= 0; i--) {
    const legs = boneChildren(trunk[i]).filter(c => !onTrunk.has(c) && reach.get(c).lowY < legLine);
    if (legs.length >= 2) { hips = trunk[i]; break; }
  }
  if (!hips) hips = trunk[0];
  map.hips = hips;

  // --- 背骨の道筋（腰 → 頭頂）---
  const spinePath = pathDown(hips, top, inSet);
  if (!spinePath || spinePath.length < 3) return map;
  const onSpine = new Set(spinePath);

  // --- 腕：背骨から左右へ出る枝のうち、いちばん外へ届く二本 ---
  const branches = [];
  for (const sp of spinePath) {
    for (const c of boneChildren(sp)) {
      if (onSpine.has(c)) continue;
      const r = reach.get(c);
      if (!r || r.lowY < legLine) continue;          // 脚は除く
      const p = P(c);
      branches.push({ root: c, chest: sp, farX: r.farX, sign: p && p.x >= 0 ? 1 : -1 });
    }
  }
  branches.sort((a, b) => b.farX - a.farX);
  const arms = [];
  for (const sign of [1, -1]) {
    const pick = branches.find(x => x.sign === sign);
    if (!pick) continue;
    // 枝の中で、根元からいちばん遠くまで伸びた先が指先
    let tip = pick.root, best = 0;
    (function walk(b, d) {
      if (d > best) { best = d; tip = b; }
      const p = P(b);
      for (const c of boneChildren(b)) {
        const q = P(c);
        walk(c, d + (p && q ? Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) : 0));
      }
    })(pick.root, 0);
    arms.push({ tip, chest: pick.chest, rootBone: pick.root });
  }
  const chest = arms.length ? arms[0].chest : null;
  if (chest) map.chest = chest;

  // --- 背骨：腰と胸のあいだ ---
  const toChest = chest ? pathDown(hips, chest, inSet) : null;
  if (toChest && toChest.length >= 2) {
    map.spine = toChest[1];
    if (toChest.length >= 3) map.chest = toChest[toChest.length - 1];
  }

  // --- 首と頭：胸から上を高さで分ける ---
  if (chest) {
    const above = pathDown(chest, top, inSet);
    if (above && above.length >= 2) {
      const y0 = P(chest).y, y1 = P(top).y;
      const line = y0 + (y1 - y0) * 0.55;
      let head = null, neck = null;
      for (let i = 1; i < above.length; i++) {
        if (!neck) neck = above[i];
        if (!head && P(above[i]).y >= line) head = above[i];
      }
      if (head && head === neck && above.length >= 3) neck = above[1], head = above[2];
      // 頭頂そのものが末端の目印なら、その一つ手前を頭にする
      if (head === top && boneChildren(top).length === 0 && above.length >= 3) head = above[above.length - 2];
      if (neck) map.neck = neck;
      if (head && head !== neck) map.head = head;
      else if (head) map.head = head;
    }
  }

  // --- 腕の三本（上腕・前腕・手）と鎖骨 ---
  for (const arm of arms) {
    const chain = pathDown(arm.rootBone, arm.tip, inSet);
    if (!chain) continue;
    const seg = longestTwoLinks(chain, P);
    if (!seg) continue;
    const side = P(arm.tip).x >= 0 ? 'L' : 'R';
    map['upperArm' + side] = seg.root;
    map['forearm' + side] = seg.mid;
    map['hand' + side] = seg.tip;
    const clav = seg.before || (arm.rootBone !== seg.root ? arm.rootBone : null);
    if (clav && clav !== seg.root) map['shoulder' + side] = clav;
  }

  // --- 脚：腰から下へ伸びる枝のうち、いちばん下まで届く二本 ---
  const legTips = [];
  for (const c of boneChildren(hips)) {
    if (onSpine.has(c) || !reach.get(c) || reach.get(c).lowY >= legLine) continue;
    let low = null;
    (function walk(b) {
      if (!low || P(b).y < P(low).y) low = b;
      for (const k of boneChildren(b)) walk(k);
    })(c);
    if (low) legTips.push({ root: c, tip: low });
  }
  legTips.sort((a, b) => P(a.tip).y - P(b.tip).y);
  for (const leg of legTips.slice(0, 2)) {
    const chain = pathDown(leg.root, leg.tip, inSet);
    if (!chain) continue;
    const seg = longestTwoLinks(chain, P);
    if (!seg) continue;
    const side = P(leg.tip).x >= 0 ? 'L' : 'R';
    map['thigh' + side] = seg.root;
    map['shin' + side] = seg.mid;
    map['foot' + side] = seg.tip;
  }

  // 同じボーンを二つの関節に割り当てない
  const used = new Set();
  for (const k of Object.keys(map)) {
    if (used.has(map[k])) delete map[k];
    else used.add(map[k]);
  }
  return map;
}
