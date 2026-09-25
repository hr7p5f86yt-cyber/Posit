// app.js — 画面まわりの配線
import { Viewer, MATERIAL_MODES } from './viewer.js';
import { JOINTS, JOINT_BY_KEY, JOINT_GROUPS } from './bones.js';

const SAMPLE_URL = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r169/examples/models/gltf/Xbot.glb';

const $ = id => document.getElementById(id);
const viewer = new Viewer($('view'));

// ---- 状態表示 --------------------------------------------------------------

viewer.onStatus = msg => { $('status').textContent = msg; };

viewer.onSelect = key => {
  const j = key ? JOINT_BY_KEY[key] : null;
  $('selName').textContent = j
    ? (j.side ? `${j.side === 'L' ? '左' : '右'}${j.name}` : j.name)
    : '体のパーツをタップして選択';
  $('btnResetJoint').disabled = !j;
  syncSliders();
  for (const el of document.querySelectorAll('.chip.j')) {
    el.classList.toggle('on', el.dataset.key === key);
  }
};

// ---- スライダ --------------------------------------------------------------

const AXES = [
  { axis: 'x', input: 'axX', out: 'outX', lo: 0, hi: 1 },
  { axis: 'y', input: 'axY', out: 'outY', lo: 2, hi: 3 },
  { axis: 'z', input: 'axZ', out: 'outZ', lo: 4, hi: 5 },
];

function syncSliders() {
  const key = viewer.selected;
  const j = key ? JOINT_BY_KEY[key] : null;
  const a = key ? viewer.getAngles(key) : { x: 0, y: 0, z: 0 };
  for (const spec of AXES) {
    const el = $(spec.input);
    if (j && viewer.limitsEnabled) {
      el.min = j.limits[spec.lo];
      el.max = j.limits[spec.hi];
    } else {
      el.min = -180; el.max = 180;
    }
    el.disabled = !j || !viewer.boneMap[key];
    el.value = Math.round(a[spec.axis]);
    $(spec.out).textContent = `${Math.round(a[spec.axis])}°`;
  }
}

for (const spec of AXES) {
  $(spec.input).addEventListener('input', e => {
    if (!viewer.selected) return;
    const v = parseFloat(e.target.value);
    viewer.setAngle(viewer.selected, spec.axis, v);
    const a = viewer.getAngles(viewer.selected);
    $(spec.out).textContent = `${Math.round(a[spec.axis])}°`;
  });
}

// ---- 関節一覧 --------------------------------------------------------------

function buildJointList() {
  const wrap = $('jointList');
  wrap.innerHTML = '';
  for (const g of JOINT_GROUPS) {
    const box = document.createElement('div');
    const t = document.createElement('div');
    t.className = 'group-title';
    t.textContent = g.title;
    box.appendChild(t);
    const chips = document.createElement('div');
    chips.className = 'group-chips';
    for (const key of g.keys) {
      const j = JOINT_BY_KEY[key];
      const b = document.createElement('button');
      b.className = 'chip j';
      b.dataset.key = key;
      b.textContent = j.name;
      b.addEventListener('click', () => viewer.select(key));
      chips.appendChild(b);
    }
    box.appendChild(chips);
    wrap.appendChild(box);
  }
}

function markMissingJoints() {
  for (const el of document.querySelectorAll('.chip.j')) {
    el.classList.toggle('missing', !viewer.boneMap[el.dataset.key]);
  }
  const mapped = Object.keys(viewer.boneMap).length;
  const missing = JOINTS.filter(j => !viewer.boneMap[j.key]).map(j =>
    (j.side ? (j.side === 'L' ? '左' : '右') : '') + j.name);
  $('boneReport').textContent = mapped
    ? `対応した関節 ${mapped}/${JOINTS.length}` + (missing.length ? ` ／ 未対応: ${missing.join('・')}` : '')
    : 'スキン（ボーン）情報が見つかりませんでした。表示のみになります。';
}

// ---- 見た目 ---------------------------------------------------------------

function buildMaterialChips() {
  const wrap = $('matChips');
  wrap.innerHTML = '';
  for (const m of MATERIAL_MODES) {
    const b = document.createElement('button');
    b.className = 'chip' + (m.key === viewer.materialMode ? ' on' : '');
    b.textContent = m.name;
    b.addEventListener('click', () => {
      viewer.applyMaterialMode(m.key);
      for (const el of wrap.children) el.classList.remove('on');
      b.classList.add('on');
    });
    wrap.appendChild(b);
  }
}

// ---- 各種コントロール ------------------------------------------------------

function bindRange(id, outId, fn, fmt) {
  const el = $(id), out = $(outId);
  const run = () => {
    const v = parseFloat(el.value);
    fn(v);
    out.textContent = fmt(v);
  };
  el.addEventListener('input', run);
  run();
}

bindRange('exposure', 'outExp', v => viewer.setExposure(v), v => v.toFixed(2));
bindRange('envInt', 'outEnv', v => viewer.setEnvIntensity(v), v => v.toFixed(2));
bindRange('lightAz', 'outAz', v => viewer.setLightDirection(v, viewer.lightElevation), v => `${v | 0}°`);
bindRange('lightEl', 'outEl', v => viewer.setLightDirection(viewer.lightAzimuth, v), v => `${v | 0}°`);
bindRange('lightInt', 'outInt', v => viewer.setLightIntensity(v), v => v.toFixed(2));
bindRange('fillInt', 'outFill', v => viewer.setFillIntensity(v), v => v.toFixed(2));
bindRange('shadowSoft', 'outSoft', v => viewer.setShadowSoftness(v), v => v.toFixed(1));
bindRange('lens', 'outLens', v => viewer.setLens(v), v => `${v | 0}mm`);

$('gridOn').addEventListener('change', e => viewer.setGridVisible(e.target.checked));
$('limitsOn').addEventListener('change', e => { viewer.setLimitsEnabled(e.target.checked); syncSliders(); });

$('btnReset').addEventListener('click', () => { viewer.resetPose(); syncSliders(); });
$('btnMirror').addEventListener('click', () => { viewer.mirrorPose(); syncSliders(); });
$('btnResetJoint').addEventListener('click', () => { viewer.resetSelected(); syncSliders(); });
$('btnFrame').addEventListener('click', () => viewer.frameModel());

// ---- パネルの開閉 ----------------------------------------------------------

$('handle').addEventListener('click', () => $('panel').classList.toggle('collapsed'));

// ---- モデル読み込み --------------------------------------------------------

$('btnPick').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  try {
    await viewer.loadFile(f);
    afterLoad();
  } catch (err) {
    $('status').textContent = '読み込み失敗: ' + (err && err.message ? err.message : err);
  }
  e.target.value = '';
});

$('btnSample').addEventListener('click', () => loadSample());

async function loadSample() {
  try {
    await viewer.loadURL(SAMPLE_URL);
    afterLoad();
  } catch (err) {
    $('status').textContent = 'サンプル取得失敗（通信を確認）';
  }
}

function afterLoad() {
  markMissingJoints();
  syncSliders();
}

// ---- 起動 -----------------------------------------------------------------

buildJointList();
buildMaterialChips();
syncSliders();
loadSample();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
