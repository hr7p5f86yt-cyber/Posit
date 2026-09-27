// bones.js — ボーン名の吸収と関節定義
// Mixamo / VRM / Rigify / UE風 など、リグごとに違うボーン名を共通の関節キーに対応づける。

// ---- 関節定義 -------------------------------------------------------------
// limits: [xMin,xMax, yMin,yMax, zMin,zMax]（度）
// x=前後(曲げ) / y=ひねり / z=左右(開き)  ※Positと同じ約束
export const JOINTS = [
  { key: 'hips',     name: '腰',       side: null,    limits: [-40, 40, -60, 60, -35, 35] },
  { key: 'spine',    name: '腹',       side: null,    limits: [-35, 55, -40, 40, -35, 35] },
  { key: 'chest',    name: '胸',       side: null,    limits: [-30, 40, -45, 45, -30, 30] },
  { key: 'neck',     name: '首',       side: null,    limits: [-45, 45, -60, 60, -40, 40] },
  { key: 'head',     name: '頭',       side: null,    limits: [-35, 35, -50, 50, -35, 35] },

  { key: 'shoulderL', name: '肩',      side: 'L',     limits: [-30, 30, -25, 25, -30, 45] },
  { key: 'shoulderR', name: '肩',      side: 'R',     limits: [-30, 30, -25, 25, -45, 30] },
  { key: 'upperArmL', name: '上腕',    side: 'L',     limits: [-95, 95, -90, 90, -30, 165] },
  { key: 'upperArmR', name: '上腕',    side: 'R',     limits: [-95, 95, -90, 90, -165, 30] },
  { key: 'forearmL',  name: '前腕',    side: 'L',     limits: [-5, 20, -90, 90, 0, 150] },
  { key: 'forearmR',  name: '前腕',    side: 'R',     limits: [-5, 20, -90, 90, -150, 0] },
  { key: 'handL',     name: '手',      side: 'L',     limits: [-80, 80, -30, 30, -30, 30] },
  { key: 'handR',     name: '手',      side: 'R',     limits: [-80, 80, -30, 30, -30, 30] },

  { key: 'thighL',   name: '腿',       side: 'L',     limits: [-120, 45, -50, 50, -25, 80] },
  { key: 'thighR',   name: '腿',       side: 'R',     limits: [-120, 45, -50, 50, -80, 25] },
  { key: 'shinL',    name: '脛',       side: 'L',     limits: [0, 150, -25, 25, -10, 10] },
  { key: 'shinR',    name: '脛',       side: 'R',     limits: [0, 150, -25, 25, -10, 10] },
  { key: 'footL',    name: '足',       side: 'L',     limits: [-50, 45, -30, 30, -25, 25] },
  { key: 'footR',    name: '足',       side: 'R',     limits: [-50, 45, -30, 30, -25, 25] },
];

export const JOINT_BY_KEY = Object.fromEntries(JOINTS.map(j => [j.key, j]));

export const JOINT_GROUPS = [
  { title: '体幹', keys: ['hips', 'spine', 'chest', 'neck', 'head'] },
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
