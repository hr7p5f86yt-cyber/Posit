// app.js — 画面まわりの配線
import { Viewer, SLOTS, VIEW_MODES, MATERIAL_MODES, THREE_REVISION } from './viewer.js';
import { JOINTS, JOINT_BY_KEY, JOINT_GROUPS, jointLabel } from './bones.js';
import { POSE_CATEGORIES, POSE_PRESETS, HAND_SHAPES, FACE_PRESETS, toSpec } from './poses.js';
import { PoseHistory, relativeTime, HISTORY_LIMIT } from './history.js';
import { CroquisSession, CROQUIS_SECONDS, CROQUIS_COUNTS } from './croquis.js';
import { LightBall } from './lightBall.js';
import * as THREE from 'three';

export const BUILD = '2026-10-04g';

const SAMPLE_URL = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r169/examples/models/gltf/Xbot.glb';
const SETTINGS_KEY = 'posit.settings.v1';

const mark = n => { if (window.__positMark) window.__positMark(n); };
const $ = id => document.getElementById(id);

mark('モジュール読込');
const viewer = new Viewer($('view'));
// 不具合を調べるときの入り口（画面には出ない）
window.__posit = { viewer };
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
      cqModel: s.cqModel || 'skin',
      cqFrame: s.cqFrame || 'full',
      cqWire: !!s.cqWire,
      cqAngle: s.cqAngle || 'random',
      cqSide: s.cqSide || 'random',
      cqBody: s.cqBody || 'keep',
      cqHandShape: s.cqHandShape !== false,
      lightBall: s.lightBall !== false,
      sheetH: typeof s.sheetH === 'number' ? s.sheetH : 0,
    };
  } catch (e) {
    return { seconds: 30, count: 10, cqCats: [], cqModel: 'skin', cqFrame: 'full', cqWire: false, cqAngle: 'random',
      cqSide: 'random', cqBody: 'keep', cqHandShape: true, lightBall: true, sheetH: 0 };
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
  if (window.__positRelayout) window.__positRelayout();
}
for (const b of document.querySelectorAll('#tabbar button')) {
  b.addEventListener('click', () => showTab(b.dataset.tab));
}

const toggleSheet = () => document.body.classList.toggle('collapsed');

// つまみ: 上下にドラッグすると高さが変わる。動かさずに離したら、たたむ／開く。
(() => {
  const grip = $('grip');
  const sheet = $('sheet');
  const clampH = v => Math.max(180, Math.min(window.innerHeight * 0.82, v));
  const setH = v => {
    const h = clampH(v);
    document.documentElement.style.setProperty('--sheet-h', h + 'px');
    settings.sheetH = Math.round(h);
  };
  if (settings.sheetH) setH(settings.sheetH);

  let startY = 0, startH = 0, moved = false, id = null;
  grip.addEventListener('pointerdown', e => {
    if (document.body.classList.contains('collapsed')) return;
    id = e.pointerId; startY = e.clientY; startH = sheet.getBoundingClientRect().height;
    moved = false;
    document.body.classList.add('resizing');
    grip.setPointerCapture(id);
  });
  grip.addEventListener('pointermove', e => {
    if (id === null || e.pointerId !== id) return;
    const dy = e.clientY - startY;
    if (Math.abs(dy) > 4) moved = true;
    if (moved) { setH(startH - dy); e.preventDefault(); }
  });
  const end = e => {
    if (id === null || (e && e.pointerId !== id)) return;
    try { grip.releasePointerCapture(id); } catch (err) { /* 続行 */ }
    id = null;
    document.body.classList.remove('resizing');
    if (moved) { saveSettings(); if (window.__positRelayout) window.__positRelayout(); }
    else toggleSheet();
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  grip.addEventListener('click', e => { if (moved) e.preventDefault(); });
})();

// 横スライドと見出しボタン・点の表示を連動させる
function linkPager(pagerId, buttons, onChange, dotsId) {
  const pager = $(pagerId);
  if (!pager) return null;
  const panes = [...pager.querySelectorAll(':scope > .pane')];
  // 作り直したときに前の見張りが残らないようにする
  if (pager.__pagerOff) pager.__pagerOff();

  let dots = null, counter = null, marks = null, prevBtn = null, nextBtn = null;
  if (dotsId) {
    dots = $(dotsId);
    if (dots) {
      dots.innerHTML = '';
      dots.hidden = panes.length < 2;
      // 左右の矢印でもページを送れる（スライドが苦手なときや、端まで行きたいとき）
      prevBtn = document.createElement('button');
      prevBtn.className = 'pg'; prevBtn.textContent = '‹'; prevBtn.setAttribute('aria-label', '前のページ');
      nextBtn = document.createElement('button');
      nextBtn.className = 'pg'; nextBtn.textContent = '›'; nextBtn.setAttribute('aria-label', '次のページ');
      marks = document.createElement('span');
      marks.className = 'marks';
      // 点が多すぎると読めないので、13ページ以上は「3 / 15」と数で出す
      if (panes.length > 12) {
        dots.classList.add('count');
        counter = document.createElement('b');
        marks.appendChild(counter);
      } else {
        dots.classList.remove('count');
        for (let i = 0; i < panes.length; i++) marks.appendChild(document.createElement('i'));
      }
      dots.append(prevBtn, marks, nextBtn);
    }
  }

  let cur = -1;
  const mark = i => {
    if (buttons) {
      buttons.forEach((b, k) => b.classList.toggle('on', k === i));
      if (buttons[i] && buttons[i].scrollIntoView) {
        buttons[i].scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      }
    }
    if (counter) counter.textContent = `${i + 1} / ${panes.length}`;
    else if (marks) [...marks.children].forEach((d, k) => d.classList.toggle('on', k === i));
    if (prevBtn) prevBtn.disabled = i <= 0;
    if (nextBtn) nextBtn.disabled = i >= panes.length - 1;
    if (i === cur) return;
    cur = i;
    if (onChange) onChange(i, panes[i]);
  };
  if (buttons) {
    buttons.forEach((b, i) => b.addEventListener('click', () => {
      pager.scrollTo({ left: pager.clientWidth * i, behavior: 'smooth' });
      mark(i);
    }));
  }
  let timer = null;
  const onScroll = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const i = Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth));
      mark(Math.max(0, Math.min(panes.length - 1, i)));
    }, 60);
  };
  const goSmooth = i => {
    const k = Math.max(0, Math.min(panes.length - 1, i));
    pager.scrollTo({ left: pager.clientWidth * k, behavior: 'smooth' });
    mark(k);
  };
  if (prevBtn) prevBtn.addEventListener('click', () => goSmooth(cur - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => goSmooth(cur + 1));
  pager.addEventListener('scroll', onScroll);
  pager.__pagerOff = () => pager.removeEventListener('scroll', onScroll);
  return { pager, panes, go: i => { pager.scrollLeft = pager.clientWidth * i; mark(i); } };
}

const setPager = linkPager('setPager',
  [...document.querySelectorAll('#setSeg button')], null, 'setDots');
if (setPager) setPager.go(0);

$('btnCollapse').addEventListener('click', toggleSheet);

// ---- 困ったとき（いつでも開ける小さなボタン）-------------------------------

const openHelp = () => { $('helpBox').hidden = false; showDiagnostics(); };
const closeHelp = () => { $('helpBox').hidden = true; };
$('btnHelp').addEventListener('click', openHelp);
$('helpClose').addEventListener('click', closeHelp);
$('helpBox').addEventListener('click', e => { if (e.target === $('helpBox')) closeHelp(); });

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
viewer.onSlotsChanged = () => {
  buildSlotRows(); buildViewChips(); markMissingJoints(); syncHeadRatio();
  if ($('handWrap').classList.contains('on')) buildHandList();
  if ($('faceWrap').classList.contains('on')) buildFaceList();
};

viewer.onSelect = key => {
  const label = key ? jointLabel(key) : '';
  $('selBadge').textContent = label;
  $('selName').textContent = label || '選択なし';
  $('btnResetJoint').disabled = !key;
  syncSliders();
  for (const el of document.querySelectorAll('.chip.j')) {
    el.classList.toggle('on', el.dataset.key === key);
  }
  if (key) { showTab('joint'); focusJointGroup(key); }
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
    b.dataset.cat = key == null ? '' : key;
    b.textContent = label;
    b.addEventListener('click', () => { poseCategory = key; buildPoseCats(); buildPoseList(); });
    wrap.appendChild(b);
  };
  mk('すべて', null);
  for (const c of POSE_CATEGORIES) mk(c.name, c.key);
}

const currentPoses = () =>
  poseCategory ? POSE_PRESETS.filter(p => p.category === poseCategory) : POSE_PRESETS;

// 1ページに並べるポーズの数。シートの高さに合わせて決めるので、
// 1ページぶんが縦にはみ出さず、左右のスライドだけで全部を見られる。
let posePerPage = 6;
let posePages = [];
let posePager = null;

function posesPerPage() {
  const el = $('poseList');
  const h = el ? el.clientHeight : 0;
  if (!h) return 6;
  const rows = Math.floor((h - 24) / 56);      // 見出し 24px、1行 56px
  return Math.max(2, Math.min(5, rows)) * 2;   // 2列なので倍にする
}

function poseGroups() {
  const of = key => POSE_PRESETS.filter(p => p.category === key);
  if (poseCategory) {
    const c = POSE_CATEGORIES.find(x => x.key === poseCategory);
    return [{ key: poseCategory, name: c ? c.name : 'ポーズ', poses: of(poseCategory) }];
  }
  return POSE_CATEGORIES
    .map(c => ({ key: c.key, name: c.name, poses: of(c.key) }))
    .filter(g => g.poses.length);
}

function buildPoseList(keepCat) {
  const wrap = $('poseList');
  posePerPage = posesPerPage();
  wrap.innerHTML = '';
  posePages = [];
  for (const g of poseGroups()) {
    const n = Math.max(1, Math.ceil(g.poses.length / posePerPage));
    for (let i = 0; i < n; i++) {
      posePages.push({
        cat: g.key,
        name: g.name + (n > 1 ? `（${i + 1}/${n}）` : ''),
        poses: g.poses.slice(i * posePerPage, (i + 1) * posePerPage),
      });
    }
  }
  for (const pg of posePages) {
    const pane = document.createElement('section');
    pane.className = 'pane';
    const t = document.createElement('div');
    t.className = 'pane-title';
    t.textContent = pg.name;
    pane.appendChild(t);
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const p of pg.poses) {
      const b = document.createElement('button');
      b.textContent = p.name;
      b.addEventListener('click', () => applyPose(p));
      grid.appendChild(b);
    }
    pane.appendChild(grid);
    wrap.appendChild(pane);
  }
  posePager = linkPager('poseList', null, i => {
    const pg = posePages[i];
    for (const el of document.querySelectorAll('#poseCats .chip')) {
      el.classList.toggle('at', !poseCategory && !!pg && el.dataset.cat === pg.cat);
    }
  }, 'poseDots');
  const back = keepCat ? posePages.findIndex(pg => pg.cat === keepCat) : 0;
  if (posePager) posePager.go(Math.max(0, back));
}

/** シートの高さが変わったら、1ページぶんの数を測り直す */
function relayoutPoses() {
  if (posesPerPage() === posePerPage) return;
  const i = posePager ? Math.round(posePager.pager.scrollLeft
    / Math.max(1, posePager.pager.clientWidth)) : 0;
  buildPoseList(posePages[i] ? posePages[i].cat : null);
}
let poseLayoutTimer = null;
const queueRelayout = () => {
  if (poseLayoutTimer) clearTimeout(poseLayoutTimer);
  poseLayoutTimer = setTimeout(relayoutPoses, 180);
};
window.addEventListener('resize', queueRelayout);
window.addEventListener('orientationchange', queueRelayout);
window.__positRelayout = queueRelayout;

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

const SEG_WRAPS = { preset: 'presetWrap', hand: 'handWrap', face: 'faceWrap', history: 'historyWrap' };

function showSeg(seg) {
  for (const k of Object.keys(SEG_WRAPS)) {
    const el = $(SEG_WRAPS[k]);
    if (el) el.classList.toggle('on', k === seg);
  }
  for (const b of document.querySelectorAll('#poseSeg button')) {
    b.classList.toggle('on', b.dataset.seg === seg);
  }
  if (seg === 'hand') buildHandList();
  if (seg === 'face') buildFaceList();
}
for (const b of document.querySelectorAll('#poseSeg button')) {
  b.addEventListener('click', () => showSeg(b.dataset.seg));
}

// ---- 手の形 ---------------------------------------------------------------

let handTarget = 'both';

function buildHandList() {
  buildChips('handSide',
    [{ v: 'both', label: '両手' }, { v: 'L', label: '左手' }, { v: 'R', label: '右手' }],
    o => o.v === handTarget,
    o => { handTarget = o.v; buildHandList(); });

  const wrap = $('handList');
  wrap.innerHTML = '';
  for (const h of HAND_SHAPES) {
    const b = document.createElement('button');
    b.textContent = h.name;
    b.addEventListener('click', () => {
      viewer.applyHandShape(handTarget, h.spec);
      showToast(h.name);
    });
    wrap.appendChild(b);
  }
  const n = viewer.fingerBoneCount();
  $('handNote').textContent = n
    ? `指の骨 ${n} 本を見つけました。形は左手基準で、右手には左右反転して当てます。`
    : 'このモデルには指の骨がありません。指のあるモデルを読み込むと使えます。';
  for (const b of wrap.children) b.disabled = !n;
}

// ---- 顔の向き・表情 --------------------------------------------------------

function buildFaceList() {
  const wrap = $('faceList');
  wrap.innerHTML = '';
  for (const f of FACE_PRESETS) {
    const b = document.createElement('button');
    b.textContent = f.name;
    b.addEventListener('click', () => {
      snapshot();
      viewer.applyFacePreset(f.spec);
      syncSliders();
      showToast(f.name);
    });
    wrap.appendChild(b);
  }
  $('faceNote').textContent = viewer.hasJoint('jaw')
    ? '首と頭の向きに加えて、あごの開閉も反映します。'
    : 'このモデルにはあごの骨が無いので、首と頭の向きだけ変わります。';
}

// ---- 写真からポーズ --------------------------------------------------------

let detected = null;

$('btnPhoto').addEventListener('click', () => {
  $('photoBox').hidden = false;
  $('photoMsg').textContent = '写真を選んでください。全身が写っているものが向いています。';
  $('photoApply').disabled = true;
  detected = null;
  $('photoFile').click();
});
$('photoClose').addEventListener('click', () => { $('photoBox').hidden = true; });

$('photoFile').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) { $('photoBox').hidden = true; return; }
  $('photoBox').hidden = false;
  $('photoMsg').textContent = '読み取り中…（初回は検出モデルの取得に少し時間がかかります）';
  $('photoApply').disabled = true;
  try {
    const photo = await import('./photopose.js');
    const img = await photo.fileToImage(f);
    const res = await photo.detectPose(img);
    if (!res) {
      $('photoMsg').textContent = '人物を見つけられませんでした。全身が大きく写った写真で試してください。';
      return;
    }
    photo.drawPreview($('photoCanvas'), img, res.image);
    const { dirs, missing } = photo.landmarksToDirections(res.world);
    if (missing.length) {
      $('photoMsg').textContent = '肩か腰が写っていないため、姿勢を組み立てられませんでした。';
      return;
    }
    detected = dirs;
    $('photoApply').disabled = false;
    $('photoMsg').textContent = `${Object.keys(dirs).length} か所を読み取りました。`;
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    $('photoMsg').textContent = '読み取りに失敗しました: ' + msg;
  }
});

$('photoApply').addEventListener('click', () => {
  if (!detected) return;
  snapshot();
  const n = viewer.applyDetectedPose(detected);
  syncSliders();
  $('photoBox').hidden = true;
  history.add({ name: '写真から', spec: toSpec(viewer.allAngles()) });
  buildHistory();
  showToast(`${n} か所の関節を写真に合わせました`);
});

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

// ---- クロッキーの画角 ----
const CQ_ANGLES = [
  { value: 'random', label: 'いろいろな画角' },
  { value: 'front', label: '正面だけ' },
];
const rand = (a, b) => a + Math.random() * (b - a);

/** 方位と高さを、絵を描く人のことばで */
function angleLabel(az, el, mm) {
  const a = ((az % 360) + 360) % 360;
  const dirs = ['正面', '左斜め前', '左横', '左斜め後ろ', '後ろ', '右斜め後ろ', '右横', '右斜め前'];
  const d = dirs[Math.round(a / 45) % 8];
  const h = el < -5 ? 'あおり' : el < 15 ? '目の高さ' : el < 45 ? '見下ろし' : '俯瞰';
  return `${d}・${h}・${mm}mm`;
}

// ---- クロッキーの範囲・左右・体型 ----
const CQ_SIDES = [
  { value: 'random', label: '左右ランダム' },
  { value: 'L', label: '左だけ' },
  { value: 'R', label: '右だけ' },
];
const CQ_BODIES = [
  { value: 'keep', label: 'いまのまま' },
  { value: 'neutral', label: '中性' },
  { value: 'male', label: '男性' },
  { value: 'female', label: '女性' },
  { value: 'random', label: '毎回ランダム' },
];
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
let cqMeta = { body: '', side: '' };
let lastHandShape = null;

/** 1枚ごとの体型と左右を決める（ポーズを当てる前に呼ぶ） */
function croquisSetup() {
  cqMeta = { body: '', side: '' };
  if (settings.cqBody === 'random') {
    const keys = ['neutral', 'male', 'female'].filter(k => k !== viewer.bodyType);
    const k = pick(keys);
    viewer.setBodyType(k);
    cqMeta.body = BODY_TYPES.find(b => b.key === k).label;
  }
  const part = settings.cqFrame;
  if (part === 'hand' || part === 'foot') {
    const sd = settings.cqSide === 'random' ? pick(['L', 'R']) : settings.cqSide;
    if (sd !== viewer.partSide || viewer.partView !== part) viewer.setPartView(part, sd);
    cqMeta.side = (sd === 'L' ? '左' : '右') + (part === 'hand' ? '手' : '足');
  }
}

/** 手だけのときは手の形もランダムに（平らな初期形は除く・前回と変える） */
function croquisHandShape() {
  if (settings.cqFrame !== 'hand' || !settings.cqHandShape || !viewer.fingerBoneCount()) return null;
  const pool = HAND_SHAPES.filter(h => h.id !== 'flat' && h.id !== lastHandShape);
  const h = pick(pool);
  lastHandShape = h.id;
  viewer.applyHandShape('both', h.spec);
  return h;
}

/** 毎回ちがう向き・高さ・レンズで見せる（同じ向きばかりにならないよう前回と離す） */
let lastAz = null;
function croquisAngle() {
  const meta = [cqMeta.side, cqMeta.body].filter(Boolean);
  if (settings.cqAngle !== 'random') { $('cqAngleText').textContent = meta.join('・'); return; }
  let az = rand(0, 360);
  if (lastAz !== null) for (let k = 0; k < 6 && Math.abs(((az - lastAz + 540) % 360) - 180) < 50; k++) az = rand(0, 360);
  lastAz = az;
  const r = Math.random();
  const el = r < 0.18 ? rand(-25, -8) : r < 0.6 ? rand(-5, 12) : r < 0.9 ? rand(16, 40) : rand(46, 65);
  const lenses = [24, 35, 35, 50, 50, 50, 70, 85];
  const mm = lenses[Math.floor(Math.random() * lenses.length)];
  viewer.viewFromAngle(az, el, mm);
  // 手・足は骨の向きを基準に回すので、体の向きのことばは使わずレンズだけ出す
  const part = settings.cqFrame === 'hand' || settings.cqFrame === 'foot';
  $('cqAngleText').textContent = [...meta, part ? `${mm}mm` : angleLabel(az, el, mm)].join('・');
}

const croquis = new CroquisSession({
  history,
  onPose: (pose, index) => {
    croquisSetup();
    viewer.applyPose(pose.spec);
    const hs = croquisHandShape();
    croquisAngle();
    history.add({ poseId: pose.id, name: pose.name, spec: pose.spec });
    $('cqName').textContent = hs ? hs.name : pose.name;
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

let beforeCroquis = null;

async function startCroquis() {
  document.body.classList.add('croquis');
  $('croquis').hidden = false;
  viewer.select(null);
  // 出題中だけ見え方を切り替え、終わったら戻す
  beforeCroquis = { view: viewer.viewMode, part: viewer.partView, side: viewer.partSide, wire: viewer.wireOn,
    cam: viewer.camera.position.clone(), target: viewer.controls.target.clone(),
    body: viewer.bodyType, hands: { ...viewer.handShape } };
  lastAz = null;
  lastHandShape = null;
  $('lightPop').hidden = true;
  if (settings.cqModel !== viewer.viewMode) viewer.applyViewMode(settings.cqModel);
  if (settings.cqBody !== 'keep' && settings.cqBody !== 'random' && settings.cqBody !== viewer.bodyType) {
    viewer.setBodyType(settings.cqBody);
  }
  viewer.setPartView(settings.cqFrame, settings.cqSide === 'L' || settings.cqSide === 'R' ? settings.cqSide : viewer.partSide);
  viewer.setWireframe(settings.cqWire);
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
  if (beforeCroquis) {
    viewer.applyViewMode(beforeCroquis.view);
    if (viewer.bodyType !== beforeCroquis.body) viewer.setBodyType(beforeCroquis.body);
    for (const sd of ['L', 'R']) {
      if (viewer.handShape[sd] !== beforeCroquis.hands[sd]) viewer.applyHandShape(sd, beforeCroquis.hands[sd] || '');
    }
    viewer.setPartView(beforeCroquis.part, beforeCroquis.side);
    viewer.setWireframe(beforeCroquis.wire);
    $('wireOn').checked = beforeCroquis.wire;
    // 画角とレンズも出題前に戻す
    viewer.setLens(+$('lens').value);
    if (beforeCroquis.part === 'full' || beforeCroquis.part === 'upper' || beforeCroquis.part === 'face') {
      viewer.camera.position.copy(beforeCroquis.cam);
      viewer.controls.target.copy(beforeCroquis.target);
      viewer.controls.update();
    }
    buildFrameChips();
    buildViewChips();
    buildBodyChips();
    beforeCroquis = null;
  }
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
$('cqWire').addEventListener('change', e => { settings.cqWire = e.target.checked; saveSettings(); });
$('cqHandShape').addEventListener('change', e => { settings.cqHandShape = e.target.checked; saveSettings(); });

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

  buildChips('cqModel',
    VIEW_MODES.map(m => ({ value: m.key, label: m.name })),
    o => settings.cqModel === o.value,
    o => { settings.cqModel = o.value; saveSettings(); buildCroquisChips(); });

  buildChips('cqFrame',
    FRAMES.map(f => ({ value: f.key, label: f.label })),
    o => settings.cqFrame === o.value,
    o => { settings.cqFrame = o.value; saveSettings(); buildCroquisChips(); });

  const sided = settings.cqFrame === 'hand' || settings.cqFrame === 'foot';
  $('cqSide').hidden = !sided;
  if (sided) {
    buildChips('cqSide', CQ_SIDES,
      o => settings.cqSide === o.value,
      o => { settings.cqSide = o.value; saveSettings(); buildCroquisChips(); });
  }
  $('cqHandShapeRow').hidden = settings.cqFrame !== 'hand';
  $('cqHandShape').checked = settings.cqHandShape;

  buildChips('cqBody', CQ_BODIES,
    o => settings.cqBody === o.value,
    o => { settings.cqBody = o.value; saveSettings(); buildCroquisChips(); });

  $('cqWire').checked = settings.cqWire;

  buildChips('cqAngle', CQ_ANGLES,
    o => settings.cqAngle === o.value,
    o => { settings.cqAngle = o.value; saveSettings(); buildCroquisChips(); });

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

let jointPager = null;

function buildJointList() {
  const seg = $('jointSeg');
  const wrap = $('jointList');
  seg.innerHTML = '';
  wrap.innerHTML = '';
  for (const g of JOINT_GROUPS) {
    const tab = document.createElement('button');
    tab.textContent = g.title;
    seg.appendChild(tab);

    const pane = document.createElement('section');
    pane.className = 'pane';
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
    pane.appendChild(chips);
    wrap.appendChild(pane);
  }
  jointPager = linkPager('jointList', [...seg.children], null);
  if (jointPager) jointPager.go(0);
}

/** 選ばれている関節が入っているまとまりへページを送る */
function focusJointGroup(key) {
  if (!jointPager || !key) return;
  const i = JOINT_GROUPS.findIndex(g => g.keys.includes(key));
  if (i >= 0) jointPager.go(i);
}

function markMissingJoints() {
  for (const el of document.querySelectorAll('.chip.j')) {
    el.classList.toggle('missing', !viewer.hasJoint(el.dataset.key));
  }
  const info = viewer.slotInfo().filter(s => s.loaded);
  $('boneReport').textContent = info.length ? info.map(s => s.posable
    ? `${s.name}: ボーン ${s.boneCount} 本・関節 ${s.jointCount}/${JOINTS.length}`
    : (s.boneCount ? `${s.name}: ボーン ${s.boneCount} 本／関節 0（ボーン名が未対応）`
                   : `${s.name}: スキン情報なし（表示のみ）`)).join(' ／ ') : '';
  $('boneNames').textContent = viewer.boneNameReport();
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
  if (!f) { e.target.value = ''; return; }
  try {
    await viewer.loadFiles(e.target.files, pendingSlot);
    syncSliders();
  } catch (err) {
    if (window.__positShowError) {
      const msg = err && err.message ? err.message : String(err);
      const hint = /buffer|\.bin|texture/i.test(msg)
        ? '\n\nこの .gltf は別ファイル（scene.bin など）に中身が入っています。'
          + '\nダウンロードした zip をそのまま選ぶか、'
          + '\nscene.gltf と scene.bin をまとめて選んでください。'
        : '';
      window.__positShowError('読み込みに失敗しました: ' + f.name + '\n' + msg + hint);
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
bindRange('fillInt', 'outFill', v => viewer.setFillIntensity(v), v => v.toFixed(2));
bindRange('shadowSoft', 'outSoft', v => viewer.setShadowSoftness(v), v => v.toFixed(1));

// ---- ライト ---------------------------------------------------------------

// 強さは 0〜20。弱いところを細かく、強いところは大きく動くように、つまみの位置を 2.2 乗で割り当てる
const INT_MAX = 20;
const posToInt = p => INT_MAX * Math.pow(Math.max(0, p) / 100, 2.2);
const intToPos = i => 100 * Math.pow(Math.max(0, Math.min(INT_MAX, i)) / INT_MAX, 1 / 2.2);
function setRange(id, v) { const el = $(id); el.value = v; el.dispatchEvent(new Event('input')); }

bindRange('lightInt', 'outInt', v => {
  const I = posToInt(v);
  viewer.setLightIntensity(I);
  $('lightIntQuick').value = v;
  $('outIntQuick').textContent = I.toFixed(2);
}, v => posToInt(v).toFixed(2));
$('lightIntQuick').addEventListener('input', e => { lightPreset = null; buildLightPresets(); setRange('lightInt', e.target.value); });
setRange('lightInt', intToPos(2.4));

/**
 * ライトの組み合わせ。az・el は「見ている方向」が基準
 * （az … 右が +、0 が手前、180 が真後ろ。el … 上が +）。
 */
const LIGHT_PRESETS = [
  { key: 'std',    label: '標準',     az: 35,  el: 45,  int: 2.4, fill: 0.35, env: 0.55, soft: 3,   exp: 1 },
  { key: 'hard',   label: '強い明暗', az: 62,  el: 35,  int: 7,   fill: 0,    env: 0.04, soft: 0.5, exp: 1 },
  { key: 'soft',   label: 'やわらか', az: 25,  el: 50,  int: 1.3, fill: 0.9,  env: 1.3,  soft: 10,  exp: 1 },
  { key: 'side',   label: '真横から', az: 90,  el: 4,   int: 6,   fill: 0.03, env: 0.08, soft: 1,   exp: 1 },
  { key: 'top',    label: '真上から', az: 0,   el: 84,  int: 6,   fill: 0.03, env: 0.1,  soft: 1.5, exp: 1 },
  { key: 'rim',    label: '逆光',     az: 145, el: 18,  int: 15,  fill: 0.1,  env: 0.18, soft: 2,   exp: 1.15 },
  { key: 'under',  label: '下から',   az: 12,  el: -40, int: 5,   fill: 0.03, env: 0.08, soft: 1.5, exp: 1 },
  { key: 'bright', label: 'まぶしく', az: 40,  el: 40,  int: 16,  fill: 0.2,  env: 0.3,  soft: 2,   exp: 1 },
];
let lightPreset = 'std';

function applyLightPreset(p) {
  lightPreset = p.key;
  setRange('lightInt', intToPos(p.int));
  setRange('fillInt', p.fill);
  setRange('envInt', p.env);
  setRange('shadowSoft', p.soft);
  setRange('exposure', p.exp);
  const a = p.az * Math.PI / 180, e = p.el * Math.PI / 180;
  lightBall.setFromView(new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)));
  buildLightPresets();
  showToast('ライト: ' + p.label);
}

function buildLightPresets() {
  for (const id of ['lightPresets', 'lightPresetsQuick']) {
    buildChips(id, LIGHT_PRESETS, p => p.key === lightPreset, p => applyLightPreset(p));
  }
}

// 光の玉
const lightBall = new LightBall($('lightBall'), viewer, {
  onDirection: (az, el) => {
    az = ((az + 540) % 360) - 180;
    setRange('lightAz', az);
    setRange('lightEl', el);
  },
  onDragState: on => { viewer.showLightArrow(on); if (on) { lightPreset = null; buildLightPresets(); } },
  onTap: () => { $('lightPop').hidden = !$('lightPop').hidden; },
});
$('lightPopMore').addEventListener('click', () => {
  $('lightPop').hidden = true;
  showTab('setting');
  if (setPager) setPager.go(3);
});
// 小窓の外を触ったら閉じる
document.addEventListener('pointerdown', e => {
  if ($('lightPop').hidden) return;
  if (e.target.closest && (e.target.closest('#lightPop') || e.target.closest('#lightBall'))) return;
  $('lightPop').hidden = true;
}, true);
// 方位・高さのスライダーを動かしている間も、光の矢印を出す
for (const id of ['lightAz', 'lightEl']) {
  const el = $(id);
  el.addEventListener('pointerdown', () => viewer.showLightArrow(true));
  el.addEventListener('input', e => { if (e.isTrusted) { lightPreset = null; buildLightPresets(); } });
  for (const ev of ['pointerup', 'pointercancel', 'change']) el.addEventListener(ev, () => viewer.showLightArrow(false));
}
for (const id of ['lightInt', 'fillInt', 'envInt', 'shadowSoft', 'exposure']) {
  $(id).addEventListener('input', e => { if (e.isTrusted && lightPreset) { lightPreset = null; buildLightPresets(); } });
}
$('lightBallOn').checked = settings.lightBall;
document.body.classList.toggle('noLightBall', !settings.lightBall);
$('lightBallOn').addEventListener('change', e => {
  settings.lightBall = e.target.checked; saveSettings();
  document.body.classList.toggle('noLightBall', !settings.lightBall);
  if (!settings.lightBall) $('lightPop').hidden = true;
});
bindRange('lens', 'outLens', v => viewer.setLens(v), v => `${v | 0}mm`);

const FRAMES = [
  { key: 'full',  label: '全身' },
  { key: 'upper', label: '上半身' },
  { key: 'face',  label: '顔' },
  { key: 'hand',  label: '手だけ' },
  { key: 'foot',  label: '足だけ' },
];
const SIDES = [{ key: 'L', label: '左' }, { key: 'R', label: '右' }];

function buildFrameChips() {
  buildChips('frameChips', FRAMES, f => f.key === viewer.partView,
    f => { viewer.setPartView(f.key, viewer.partSide); buildFrameChips(); });
  const sided = viewer.partView === 'hand' || viewer.partView === 'foot';
  $('sideChips').hidden = !sided;
  if (sided) {
    buildChips('sideChips', SIDES, s => s.key === viewer.partSide,
      s => { viewer.setPartView(viewer.partView, s.key); buildFrameChips(); });
  }
}

const BODY_TYPES = [
  { key: 'neutral', label: '中性' },
  { key: 'male', label: '男性' },
  { key: 'female', label: '女性' },
];
function buildBodyChips() {
  buildChips('bodyChips', BODY_TYPES, b => b.key === viewer.bodyType,
    b => { viewer.setBodyType(b.key); buildBodyChips(); viewer.rebuildBoneViews(); });
}

function syncHeadRatio() {
  const el = $('headRatio');
  const base = viewer.baseHeadRatio;
  el.value = Math.max(3, Math.min(9, base)).toFixed(1);
  $('outHead').textContent = (+el.value).toFixed(1);
}
$('headRatio').addEventListener('input', e => {
  const r = parseFloat(e.target.value);
  $('outHead').textContent = r.toFixed(1);
  viewer.setHeadRatio(r);
});
$('headRatio').addEventListener('change', () => viewer.rebuildBoneViews());
$('btnHeadReset').addEventListener('click', () => {
  viewer.resetHeadRatio();
  syncHeadRatio();
  viewer.rebuildBoneViews();
});

$('wireOn').addEventListener('change', e => viewer.setWireframe(e.target.checked));
$('headPlanes').addEventListener('change', e => {
  const ok = viewer.setHeadPlanes(e.target.checked);
  if (e.target.checked && !ok) {
    showToast('面で捉えた頭部は、組み込みの素体を表示しているときだけ使えます。');
  } else if (e.target.checked) {
    showToast(viewer.headPlaneInfo());
  }
});
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
buildFrameChips();
buildBodyChips();
buildLightPresets();
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
