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
  ['head',     ['head']],
  ['jaw',      ['jaw', 'chin', 'lowerjaw', 'jawroot']],
  ['neck',     ['neck', 'neck1', 'neck01']],
  ['chest',    ['spine2', 'spine02', 'spine3', 'spine03', 'upperchest', 'chest', 'ribcage']],
  ['spine',    ['spine1', 'spine01', 'spine', 'abdomen', 'waist', 'torso']],
  ['hips',     ['hips', 'hip', 'pelvis', 'root']],
  ['shoulder', ['shoulder', 'clavicle', 'collar', 'shoulderblade']],
  ['upperArm', ['upperarm', 'arm', 'upperarmtwist', 'humerus']],
  ['forearm',  ['forearm', 'lowerarm', 'elbow', 'forearmtwist', 'ulna']],
  ['hand',     ['hand', 'wrist', 'palm']],
  ['thigh',    ['upleg', 'upperleg', 'thigh', 'femur', 'thighs']],
  ['shin',     ['leg', 'lowerleg', 'calf', 'shin', 'knee', 'tibia']],
  ['foot',     ['foot', 'ankle']],
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
