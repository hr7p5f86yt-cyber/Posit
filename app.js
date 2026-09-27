// app.js — 画面まわりの配線
import { Viewer, SLOTS, VIEW_MODES, MATERIAL_MODES, THREE_REVISION } from './viewer.js';
import { JOINTS, JOINT_BY_KEY, JOINT_GROUPS, jointLabel } from './bones.js';
import { POSE_CATEGORIES, POSE_PRESETS, toSpec } from './poses.js';
import { PoseHistory, relativeTime, HISTORY_LIMIT } from './history.js';
import { CroquisSession, CROQUIS_SECONDS, CROQUIS_COUNTS } from './croquis.js';

export const BUILD = '2026-09-27d';

const SAMPLE_URL = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r169/examples/models/gltf/Xbot.glb';
const SETTINGS_KEY = 'posit.settings.v1';

const mark = n => { if (window.__positMark) window.__positMark(n); };
const $ = id => document.getElementById(id);

mark('モジュール読込');
const viewer = new Viewer($('view'));
const history = new PoseHistory();
window.__positViewer = viewer;
mark('シーン作成');

let pendingSlot = 'skin';
let poseCategory = null;
const settings = loadSettings();

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      seconds: CROQUIS_SECONDS.includes(s.seconds) ? s.seconds : 30,
      count: CROQUIS_COUNTS.includes(s.count) ? s.count : 10,
      cqCats: Array.isArray(s.cqCats) ? s.cqCats : [],
    };
  } catch (e) {
    return { seconds: 30, count: 10, cqCats: [] };
  }
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* 続行 */ }
}

// ---- 元に戻す -------------------------------------------------------------

const undoStack = [];
function snapshot() {
  undoStack.push(viewer.allAngles());
  if (undoStack.length > 30) undoStack.shift();
  $('btnUndo').disabled = false;
}
$('btnUndo').addEventListener('click', () => {
  const prev = undoStack.pop();
  if (!prev) return;
  viewer.setAngles(prev);
  syncSliders();
  $('btnUndo').disabled = !undoStack.length;
});
$('btnUndo').disabled = true;

// ---- タブ -----------------------------------------------------------------

function showTab(name) {
  for (const b of document.querySelectorAll('#tabbar button')) {
    b.classList.toggle('on', b.dataset.tab === name);
  }
  for (const p of document.querySelectorAll('.page')) {
    p.hidden = p.dataset.page !== name;
  }
  document.body.classList.remove('collapsed');
}
for (const b of document.querySelectorAll('#tabbar button')) {
  b.addEventListener('click', () => showTab(b.dataset.tab));
}

const toggleSheet = () => document.body.classList.toggle('collapsed');
$('grip').addEventListener('click', toggleSheet);
$('btnCollapse').addEventListener('click', toggleSheet);

// ---- 状態表示 --------------------------------------------------------------

let toastTimer = null;
function showToast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('show'));
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { el.hidden = true; }, 220);
  }, 2800);
}

viewer.onStatus = msg => { if (msg && !/読み込み中/.test(msg)) showToast(msg); };
viewer.onNotice = msg => { if (msg) { $('viewNote').textContent = msg; showToast(msg); } };
viewer.onSlotsChanged = () => { buildSlotRows(); buildViewChips(); markMissingJoints(); };

viewer.onSelect = key => {
  const label = key ? jointLabel(key) : '';
  $('selBadge').textContent = label;
  $('selName').textContent = label || '選択なし';
  $('btnResetJoint').disabled = !key;
  syncSliders();
  for (const el of document.querySelectorAll('.chip.j')) {
    el.classList.toggle('on', el.dataset.key === key);
  }
  if (key) showTab('joint');
};

// ---- スライダ --------------------------------------------------------------

const AXES = [
  { axis: 'x', input: 'axX', out: 'outX', lab: 'labX', lo: 0, hi: 1, ai: 0 },
  { axis: 'y', input: 'axY', out: 'outY', lab: 'labY', lo: 2, hi: 3, ai: 1 },
  { axis: 'z', input: 'axZ', out: 'outZ', lab: 'labZ', lo: 4, hi: 5, ai: 2 },
];

function syncSliders() {
  const key = viewer.selected;
  const j = key ? JOINT_BY_KEY[key] : null;
  const a = key ? viewer.getAngles(key) : { x: 0, y: 0, z: 0 };
  const usable = !!(j && viewer.hasJoint(key));
  for (const spec of AXES) {
    const el = $(spec.input);
    $(spec.lab).textContent = j ? j.axes[spec.ai] : ['前後', 'ひねり', '左右'][spec.ai];
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

let dragging = false;
for (const spec of AXES) {
  const el = $(spec.input);
  el.addEventListener('input', e => {
    if (!viewer.selected) return;
    if (!dragging) { dragging = true; snapshot(); }
    viewer.setAngle(viewer.selected, spec.axis, parseFloat(e.target.value));
    const a = viewer.getAngles(viewer.selected);
    $(spec.out).textContent = `${Math.round(a[spec.axis])}°`;
  });
  el.addEventListener('change', () => { dragging = false; });
}

// ---- ポーズ ---------------------------------------------------------------

function buildPoseCats() {
  const wrap = $('poseCats');
  wrap.innerHTML = '';
  const mk = (label, key) => {
    const b = document.createElement('button');
    b.className = 'chip cat' + (poseCategory === key ? ' on' : '');
    b.textContent = label;
    b.addEventListener('click', () => { poseCategory = key; buildPoseCats(); buildPoseList(); });
    wrap.appendChild(b);
  };
  mk('すべて', null);
  for (const c of POSE_CATEGORIES) mk(c.name, c.key);
}

const currentPoses = () =>
  poseCategory ? POSE_PRESETS.filter(p => p.category === poseCategory) : POSE_PRESETS;

function buildPoseList() {
  const wrap = $('poseList');
  wrap.innerHTML = '';
  for (const p of currentPoses()) {
    const b = document.createElement('button');
    b.textContent = p.name;
    b.addEventListener('click', () => applyPose(p));
    wrap.appendChild(b);
  }
}

function applyPose(pose) {
  snapshot();
  viewer.applyPose(pose.spec);
  history.add({ poseId: pose.id, name: pose.name, spec: pose.spec });
  buildHistory();
  syncSliders();
  showToast(pose.name);
}

$('btnRandomPose').addEventListener('click', () => {
  const pool = currentPoses();
  const recent = history.recentIds(10);
  const fresh = pool.filter(p => !recent.has(p.id));
  const list = fresh.length ? fresh : pool;
  applyPose(list[Math.floor(Math.random() * list.length)]);
});

for (const b of document.querySelectorAll('#poseSeg button')) {
  b.addEventListener('click', () => {
    for (const x of document.querySelectorAll('#poseSeg button')) x.classList.remove('on');
    b.classList.add('on');
    const preset = b.dataset.seg === 'preset';
    $('presetWrap').hidden = !preset;
    $('historyWrap').hidden = preset;
    $('btnRandomPose').parentElement.hidden = !preset;
  });
}

// ---- 履歴 -----------------------------------------------------------------

function buildHistory() {
  const wrap = $('historyList');
  wrap.innerHTML = '';
  if (!history.items.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = `まだありません。プリセットを選ぶかクロッキーを回すと、ここに最大${HISTORY_LIMIT}件たまります。`;
    wrap.appendChild(p);
    return;
  }
  for (const it of history.items) {
    const b = document.createElement('button');
    b.className = 'hist';
    const nm = document.createElement('span');
    nm.className = 'nm'; nm.textContent = it.name;
    const tm = document.createElement('span');
    tm.className = 'tm'; tm.textContent = relativeTime(it.at);
    b.append(nm, tm);
    b.addEventListener('click', () => {
      snapshot();
      viewer.applyPose(it.spec);
      syncSliders();
      showToast(it.name);
    });
    wrap.appendChild(b);
  }
}

$('btnClearHistory').addEventListener('click', () => { history.clear(); buildHistory(); });

// ---- クロッキー ------------------------------------------------------------

const croquis = new CroquisSession({
  history,
  onPose: (pose, index) => {
    viewer.applyPose(pose.spec);
    history.add({ poseId: pose.id, name: pose.name, spec: pose.spec });
    $('cqName').textContent = pose.name;
    $('cqIndex').textContent = croquis.count > 0 ? `${index} / ${croquis.count}` : `${index} 枚目`;
  },
  onTick: (remain, total) => {
    const sec = Math.max(0, Math.ceil(remain / 1000));
    $('cqTime').textContent = String(sec);
    $('cqTime').classList.toggle('warn', sec <= 5);
    $('cqFill').style.transform = `scaleX(${Math.max(0, Math.min(1, remain / total))})`;
  },
  onFinish: (done) => {
    stopCroquis();
    $('cqDoneText').textContent = `${done} 枚おつかれさまでした`;
    $('cqDone').hidden = false;
  },
});

let wakeLock = null;

async function startCroquis() {
  document.body.classList.add('croquis');
  $('croquis').hidden = false;
  viewer.select(null);
  try {
    if (navigator.wakeLock && navigator.wakeLock.request) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (e) { /* 画面が消えても進行は続く */ }
  croquis.start({
    seconds: settings.seconds,
    count: settings.count,
    categories: settings.cqCats.length ? new Set(settings.cqCats) : null,
  });
  $('cqPause').textContent = '一時停止';
}

function stopCroquis() {
  document.body.classList.remove('croquis');
  $('croquis').hidden = true;
  buildHistory();
  syncSliders();
  if (wakeLock) { try { wakeLock.release(); } catch (e) { /* 続行 */ } wakeLock = null; }
}

$('btnCroquis').addEventListener('click', () => startCroquis());
$('cqSkip').addEventListener('click', () => croquis.skip());
$('cqStop').addEventListener('click', () => croquis.finish());
$('cqPause').addEventListener('click', () => {
  croquis.togglePause();
  $('cqPause').textContent = croquis.paused ? '再開' : '一時停止';
});
$('cqDoneClose').addEventListener('click', () => { $('cqDone').hidden = true; });

function buildChips(wrapId, options, isOn, onPick, cls) {
  const wrap = $(wrapId);
  wrap.innerHTML = '';
  for (const opt of options) {
    const b = document.createElement('button');
    b.className = (cls || 'chip') + (isOn(opt) ? ' on' : '');
    b.textContent = opt.label;
    b.addEventListener('click', () => onPick(opt));
    wrap.appendChild(b);
  }
}

function buildCroquisChips() {
  buildChips('cqSeconds',
    CROQUIS_SECONDS.map(s => ({ value: s, label: s >= 60 ? `${s / 60}分` : `${s}秒` })),
    o => settings.seconds === o.value,
    o => { settings.seconds = o.value; saveSettings(); buildCroquisChips(); });

  buildChips('cqCounts',
    CROQUIS_COUNTS.map(c => ({ value: c, label: c === 0 ? '制限なし' : `${c}枚` })),
    o => settings.count === o.value,
    o => { settings.count = o.value; saveSettings(); buildCroquisChips(); });

  buildChips('cqCats',
    POSE_CATEGORIES.map(c => ({ value: c.key, label: c.name })),
    o => settings.cqCats.includes(o.value),
    o => {
      const i = settings.cqCats.indexOf(o.value);
      if (i >= 0) settings.cqCats.splice(i, 1); else settings.cqCats.push(o.value);
      saveSettings();
      buildCroquisChips();
    }, '');
}

// ---- 関節一覧 --------------------------------------------------------------

function buildJointList() {
  const wrap = $('jointList');
  wrap.innerHTML = '';
  for (const g of JOINT_GROUPS) {
    const box = document.createElement('div');
    const t = document.createElement('div');
    t.className = 'group-title'; t.textContent = g.title;
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
  $('boneReport').textContent = info.length ? info.map(s => s.posable
    ? `${s.name}: ボーン ${s.boneCount} 本・関節 ${s.jointCount}/${JOINTS.length}`
    : `${s.name}: スキン情報なし（表示のみ）`).join(' ／ ') : '';
}

// ---- 表示まわり ------------------------------------------------------------

function buildViewChips() {
  buildChips('viewChips',
    VIEW_MODES.map(m => ({ ...m, label: m.name })),
    m => m.key === viewer.viewMode,
    m => { if (viewer.applyViewMode(m.key)) buildViewChips(); });
  for (const [i, m] of VIEW_MODES.entries()) {
    if (m.show.every(k => !viewer.slots[k].loaded)) {
      $('viewChips').children[i].classList.add('missing');
    }
  }
}

function buildMaterialChips() {
  buildChips('matChips',
    MATERIAL_MODES.map(m => ({ ...m, label: m.name })),
    m => m.key === viewer.materialMode,
    m => { viewer.applyMaterialMode(m.key); buildMaterialChips(); });
}

function buildSlotRows() {
  const wrap = $('slotRows');
  wrap.innerHTML = '';
  for (const s of viewer.slotInfo()) {
    const row = document.createElement('div');
    row.className = 'slot-row';
    const nm = document.createElement('span');
    nm.className = 'nm'; nm.textContent = s.name;
    const fn = document.createElement('span');
    fn.className = 'fn'; fn.textContent = s.loaded ? s.fileName : '未読込';
    const load = document.createElement('button');
    load.textContent = s.loaded ? '差替' : '読込';
    load.addEventListener('click', () => { pendingSlot = s.key; $('file').click(); });
    row.append(nm, fn, load);
    if (s.loaded) {
      const del = document.createElement('button');
      del.className = 'ghost'; del.textContent = '削除';
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
    if (window.__positShowError) {
      window.__positShowError('読み込みに失敗しました: ' + f.name + '\n'
        + (err && err.message ? err.message : err));
    }
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
$('canonRest').addEventListener('change', e => { viewer.setCanonicalRest(e.target.checked); syncSliders(); });
$('gridOn').addEventListener('change', e => viewer.setGridVisible(e.target.checked));
$('limitsOn').addEventListener('change', e => { viewer.setLimitsEnabled(e.target.checked); syncSliders(); });

$('btnReset').addEventListener('click', () => { snapshot(); viewer.resetPose(); syncSliders(); });
$('btnMirror').addEventListener('click', () => {
  snapshot();
  viewer.mirrorPose();
  syncSliders();
  history.add({ name: '左右反転', spec: toSpec(viewer.allAngles()) });
  buildHistory();
});
$('btnResetJoint').addEventListener('click', () => { snapshot(); viewer.resetSelected(); syncSliders(); });
$('btnFrame').addEventListener('click', () => viewer.frameModel());

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
  const parts = ['バージョン: ' + BUILD, 'URL: ' + location.href, 'three.js: r' + THREE_REVISION];
  parts.push('importmap: ' + (window.HTMLScriptElement && HTMLScriptElement.supports
    && HTMLScriptElement.supports('importmap') ? '対応' : '未対応'));
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      parts.push('Service Worker: ' + (regs.length ? '登録済み ' + regs.length : '未登録'));
    } else {
      parts.push('Service Worker: 使えません（httpsで開いていない可能性）');
    }
    if (window.caches) parts.push('キャッシュ: ' + ((await caches.keys()).join(', ') || 'なし'));
  } catch (e) { /* 続行 */ }
  parts.push('画面: ' + window.innerWidth + '×' + window.innerHeight + ' / DPR ' + (window.devicePixelRatio || 1));
  parts.push('UA: ' + navigator.userAgent);
  if (window.__positStages) parts.push('経過: ' + window.__positStages.join(' → '));
  $('diag').textContent = parts.join('\n');
}

// ---- 起動 -----------------------------------------------------------------

buildJointList();
buildMaterialChips();
buildViewChips();
buildSlotRows();
buildPoseCats();
buildPoseList();
buildCroquisChips();
buildHistory();
syncSliders();
loadSample();

$('buildTag').textContent = 'バージョン ' + BUILD;
mark('UI構築');
window.__booted = true;
setTimeout(showDiagnostics, 1200);
$('diag').addEventListener('click', showDiagnostics);

if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) return;
    refreshing = true;
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then(reg => { try { reg.update(); } catch (e) { /* 続行 */ } })
      .catch(() => {});
  });
}
