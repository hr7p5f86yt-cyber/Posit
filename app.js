// app.js — 画面まわりの配線
import { Viewer, SLOTS, VIEW_MODES, MATERIAL_MODES, THREE_REVISION } from './viewer.js';
import { JOINTS, JOINT_BY_KEY, JOINT_GROUPS } from './bones.js';

const SAMPLE_URL = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r169/examples/models/gltf/Xbot.glb';

const mark = n => { if (window.__positMark) window.__positMark(n); };

const $ = id => document.getElementById(id);
mark('モジュール読込');
const viewer = new Viewer($('view'));
mark('シーン作成');
let pendingSlot = 'skin';

// ---- 状態表示 --------------------------------------------------------------

viewer.onStatus = msg => { $('status').textContent = msg; };
viewer.onSlotsChanged = () => { buildSlotRows(); buildViewChips(); markMissingJoints(); };

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
  const usable = !!(j && viewer.hasJoint(key));
  for (const spec of AXES) {
    const el = $(spec.input);
    if (j && viewer.limitsEnabled) {
      el.min = j.limits[spec.lo];
      el.max = j.limits[spec.hi];
    } else {
      el.min = -180; el.max = 180;
    }
    el.disabled = !usable;
    el.value = Math.round(a[spec.axis]);
    $(spec.out).textContent = `${Math.round(a[spec.axis])}°`;
  }
}

for (const spec of AXES) {
  $(spec.input).addEventListener('input', e => {
    if (!viewer.selected) return;
    viewer.setAngle(viewer.selected, spec.axis, parseFloat(e.target.value));
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
      const b = document.createElement('button');
      b.className = 'chip j';
      b.dataset.key = key;
      b.textContent = JOINT_BY_KEY[key].name;
      b.addEventListener('click', () => viewer.select(key));
      chips.appendChild(b);
    }
    box.appendChild(chips);
    wrap.appendChild(box);
  }
}

function markMissingJoints() {
  for (const el of document.querySelectorAll('.chip.j')) {
    el.classList.toggle('missing', !viewer.hasJoint(el.dataset.key));
  }
  const info = viewer.slotInfo().filter(s => s.loaded);
  if (!info.length) { $('boneReport').textContent = ''; return; }
  $('boneReport').textContent = info.map(s => {
    if (!s.posable) return `${s.name}: スキン情報なし（表示のみ）`;
    return `${s.name}: ボーン ${s.boneCount} 本・関節 ${s.jointCount}/${JOINTS.length}`;
  }).join(' ／ ');
}

// ---- 表示モード・質感 ------------------------------------------------------

function buildViewChips() {
  const wrap = $('viewChips');
  wrap.innerHTML = '';
  for (const m of VIEW_MODES) {
    const empty = m.show.every(k => !viewer.slots[k].loaded);
    const b = document.createElement('button');
    b.className = 'chip' + (m.key === viewer.viewMode ? ' on' : '') + (empty ? ' missing' : '');
    b.textContent = m.name;
    b.addEventListener('click', () => {
      viewer.applyViewMode(m.key);
      buildViewChips();
    });
    wrap.appendChild(b);
  }
}

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

// ---- モデルスロット --------------------------------------------------------

function buildSlotRows() {
  const wrap = $('slotRows');
  wrap.innerHTML = '';
  for (const s of viewer.slotInfo()) {
    const row = document.createElement('div');
    row.className = 'slot-row';

    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = s.name;

    const fn = document.createElement('span');
    fn.className = 'fn';
    fn.textContent = s.loaded ? s.fileName : '未読込';

    const load = document.createElement('button');
    load.textContent = s.loaded ? '差替' : '読込';
    load.addEventListener('click', () => { pendingSlot = s.key; $('file').click(); });

    row.append(nm, fn, load);

    if (s.loaded) {
      const del = document.createElement('button');
      del.className = 'ghost';
      del.textContent = '削除';
      del.addEventListener('click', () => viewer.clearSlot(s.key));
      row.appendChild(del);
    }
    wrap.appendChild(row);
  }
}

$('file').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  try {
    await viewer.loadFile(f, pendingSlot);
    syncSliders();
  } catch (err) {
    $('status').textContent = '読み込み失敗: ' + (err && err.message ? err.message : err);
  }
  e.target.value = '';
});

$('btnSample').addEventListener('click', () => loadSample());

async function loadSample() {
  try {
    mark('サンプル取得開始');
    await viewer.loadURL(SAMPLE_URL, 'skin');
    mark('サンプル取得完了');
    syncSliders();
  } catch (err) {
    $('status').textContent = 'サンプル取得失敗';
    if (window.__positShowError) {
      window.__positShowError('サンプルモデルを取得できませんでした。\n' + SAMPLE_URL
        + '\n' + (err && err.message ? err.message : err));
    }
  }
}

// ---- 各種コントロール ------------------------------------------------------

function bindRange(id, outId, fn, fmt) {
  const el = $(id), out = $(outId);
  const run = () => { const v = parseFloat(el.value); fn(v); out.textContent = fmt(v); };
  el.addEventListener('input', run);
  run();
}

bindRange('skinOpacity', 'outOpacity', v => viewer.setSkinOpacity(v), v => `${Math.round(v * 100)}%`);
bindRange('exposure', 'outExp', v => viewer.setExposure(v), v => v.toFixed(2));
bindRange('envInt', 'outEnv', v => viewer.setEnvIntensity(v), v => v.toFixed(2));
bindRange('lightAz', 'outAz', v => viewer.setLightDirection(v, viewer.lightElevation), v => `${v | 0}°`);
bindRange('lightEl', 'outEl', v => viewer.setLightDirection(viewer.lightAzimuth, v), v => `${v | 0}°`);
bindRange('lightInt', 'outInt', v => viewer.setLightIntensity(v), v => v.toFixed(2));
bindRange('fillInt', 'outFill', v => viewer.setFillIntensity(v), v => v.toFixed(2));
bindRange('shadowSoft', 'outSoft', v => viewer.setShadowSoftness(v), v => v.toFixed(1));
bindRange('lens', 'outLens', v => viewer.setLens(v), v => `${v | 0}mm`);

$('boneView').addEventListener('change', e => viewer.setBoneViewOn(e.target.checked));
$('gridOn').addEventListener('change', e => viewer.setGridVisible(e.target.checked));
$('limitsOn').addEventListener('change', e => { viewer.setLimitsEnabled(e.target.checked); syncSliders(); });

$('btnReset').addEventListener('click', () => { viewer.resetPose(); syncSliders(); });
$('btnMirror').addEventListener('click', () => { viewer.mirrorPose(); syncSliders(); });
$('btnResetJoint').addEventListener('click', () => { viewer.resetSelected(); syncSliders(); });
$('btnFrame').addEventListener('click', () => viewer.frameModel());

$('handle').addEventListener('click', () => $('panel').classList.toggle('collapsed'));

// ---- 困ったとき -----------------------------------------------------------

$('btnPurge').addEventListener('click', async () => {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (e) { /* 消せなくても読み直す */ }
  location.replace(location.pathname + '?r=' + Date.now());
});

async function showDiagnostics() {
  const parts = [];
  parts.push('URL: ' + location.href);
  parts.push('three.js: r' + THREE_REVISION);
  parts.push('importmap: ' + (window.HTMLScriptElement && HTMLScriptElement.supports
    && HTMLScriptElement.supports('importmap') ? '対応' : '未対応'));
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      parts.push('Service Worker: ' + (regs.length ? '登録済み ' + regs.length : '未登録'));
    } else {
      parts.push('Service Worker: 使えません（httpsで開いていない可能性）');
    }
    if (window.caches) {
      const keys = await caches.keys();
      parts.push('キャッシュ: ' + (keys.join(', ') || 'なし'));
    }
  } catch (e) { /* 取れなくても表示は続ける */ }
  parts.push('画面: ' + window.innerWidth + '×' + window.innerHeight
    + ' / DPR ' + (window.devicePixelRatio || 1));
  parts.push('UA: ' + navigator.userAgent);
  if (window.__positStages) parts.push('経過: ' + window.__positStages.join(' → '));
  $('diag').textContent = parts.join('\n');
}

// ---- 起動 -----------------------------------------------------------------

buildJointList();
buildMaterialChips();
buildViewChips();
buildSlotRows();
syncSliders();
loadSample();

mark('UI構築');
window.__booted = true;
setTimeout(showDiagnostics, 1200);
$('diag').addEventListener('click', showDiagnostics);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
