// app.js — 画面まわりの配線
import { Viewer, SLOTS, VIEW_MODES, MATERIAL_MODES, THREE_REVISION } from './viewer.js';
import { JOINTS, JOINT_BY_KEY, JOINT_GROUPS, jointLabel } from './bones.js';
import { POSE_CATEGORIES, POSE_PRESETS, POSE_HANDS, HAND_SHAPES, FACE_PRESETS, toSpec } from './poses.js';
import { PoseHistory, relativeTime, HISTORY_LIMIT } from './history.js';
import { CroquisSession, CROQUIS_SECONDS, CROQUIS_COUNTS } from './croquis.js';
import { PROP_TYPES } from './props.js';
import { CroquisScenes, STATUES, SOLIDS } from './croquisScenes.js';
import { LightBall } from './lightBall.js';
import { poseThumbSVG, thumbFromViewer } from './poseThumbs.js';
import { REGIONS } from './anatomy.js';
import * as THREE from 'three';

export const BUILD = '2026-11-13a';

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
      // 面の線・左右のランダム反転ははじめから入れる（v66）。v66 より前に保存した設定も、一度だけ入にそろえる
      cqWire: s.cqDefV66 ? s.cqWire !== false : true,
      cqAngle: s.cqAngle || 'random',
      cqSide: s.cqSide || 'random',
      cqBody: s.cqBody || 'keep',
      cqHandShape: s.cqHandShape !== false,
      cqSubject: ['pose', 'props', 'plaster'].includes(s.cqSubject) ? s.cqSubject : 'pose',
      cqPropMode: s.cqPropMode === 'single' ? 'single' : 'combo',
      cqPlasterKind: ['all', 'statues', 'bust', 'full', 'solids'].includes(s.cqPlasterKind) ? s.cqPlasterKind : 'all',
      lightBall: s.lightBall !== false,
      sheetStage: [0, 1, 2].includes(s.sheetStage) ? s.sheetStage : 1,
      cqBeep: s.cqBeep !== false,
      cqMirror: s.cqDefV66 ? s.cqMirror !== false : true,
      cqDefV66: true,
      guideHeads: !!s.guideHeads,
      guideCenter: !!s.guideCenter,
      guideTilt: !!s.guideTilt,
      musclePal: !!s.musclePal,
      rings: s.rings !== false,
      wireW: Number.isFinite(s.wireW) ? s.wireW : 1,
      wireA: Number.isFinite(s.wireA) ? s.wireA : 0.85,
      shotShadow: !!s.shotShadow,
      shotCrop: s.shotCrop !== false,
      pull: s.pull !== false,
      poseProps: s.poseProps !== false,
      guideSeen: !!s.guideSeen,
      wireMode: s.wireMode === 'lattice' ? 'lattice' : 'mesh',
      wireDensity: [0, 1, 2, 3].includes(s.wireDensity) ? s.wireDensity : 1,
      // 関節の印ははじめは出さない（v47）。自分で切り替えたときだけ、その選び方を覚える
      dots: s.dotsUser ? !!s.dots : false,
      dotsUser: !!s.dotsUser,
    };
  } catch (e) {
    return defaultSettings();
  }
}

function defaultSettings() {
  return { seconds: 30, count: 10, cqCats: [], cqModel: 'skin', cqFrame: 'full', cqWire: true, cqAngle: 'random',
    cqSide: 'random', cqBody: 'keep', cqHandShape: true, cqSubject: 'pose', cqPropMode: 'combo', cqPlasterKind: 'all', lightBall: true, sheetStage: 1,
    cqBeep: true, cqMirror: true, cqDefV66: true, guideHeads: false, guideCenter: false, guideTilt: false, musclePal: false, rings: true, wireW: 1, wireA: 0.85, shotShadow: false, shotCrop: true, pull: true, poseProps: true, wireMode: 'mesh', wireDensity: 1, dots: false, dotsUser: false };
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* 続行 */ }
}

// ---- 元に戻す -------------------------------------------------------------

const undoStack = [];
const redoStack = [];
function syncUndoButtons() {
  $('btnUndo').disabled = !undoStack.length;
  $('btnRedo').disabled = !redoStack.length;
}
/** 変える前に呼ぶ（いまの形を「戻す」に積み、「やり直す」は空にする） */
// 戻す・やり直す: 人形と小物への操作をまとめて残す（メニューの開け閉め・見え方・ライト・カメラは残さない）
//   関節の角度・体全体の位置・手の形（指）・2 体目・小物（種類・大きさ・場所・向き・手足のつなぎ）・体型・頭身
const takeState = () => ({
  ...viewer.allAngles(), _hands: { ...viewer.handShape },
  _second: viewer.secondState(),
  _props: viewer.props.serialize(),
  _body: { type: viewer.bodyType, head: viewer.baseHeadRatio },
});
function putState(st) {
  if (!st) return;
  // 体型・頭身（ほかを戻す前に。2 体目の焼き直しも、この体で）
  let rebuild = false;
  if (st._body) {
    if (st._body.type && st._body.type !== viewer.bodyType) { viewer.setBodyType(st._body.type); buildBodyChips(); rebuild = true; }
    if (st._body.head != null && Math.abs(st._body.head - viewer.baseHeadRatio) > 1e-6) { viewer.setHeadRatio(st._body.head); syncHeadRatio(); rebuild = true; }
  }
  viewer.setAngles(st);
  if (st._hands) for (const sd of ['L', 'R']) if (st._hands[sd] !== undefined && st._hands[sd] !== viewer.handShape[sd]) viewer.applyHandShape(sd, st._hands[sd] || '');
  if ('_second' in st) { viewer.restoreSecond(st._second); syncDuo(); }
  if (st._props) viewer.props.restore(st._props);
  if (rebuild) viewer.rebuildBoneViews();
}
function snapshot(pre) {
  undoStack.push(pre || takeState());
  if (undoStack.length > 50) undoStack.shift();
  redoStack.length = 0;
  syncUndoButtons();
}
$('btnUndo').addEventListener('click', () => {
  const prev = undoStack.pop();
  if (!prev) return;
  redoStack.push(takeState());
  putState(prev);
  viewer.relock();
  syncSliders();
  syncUndoButtons();
});
$('btnRedo').addEventListener('click', () => {
  const next = redoStack.pop();
  if (!next) return;
  undoStack.push(takeState());
  putState(next);
  viewer.relock();
  syncSliders();
  syncUndoButtons();
});
syncUndoButtons();

// ---- タブ -----------------------------------------------------------------

/** タブを切り替える。expand: たたんでいるときにパネルを開くか（関節を選んだときは開かない） */
function showTab(name, expand = true) {
  for (const b of document.querySelectorAll('#tabbar button')) {
    b.classList.toggle('on', b.dataset.tab === name);
  }
  for (const p of document.querySelectorAll('.page')) {
    p.hidden = p.dataset.page !== name;
  }
  // クロッキーの設定は画面いっぱいに出す（下のタブは残す）
  document.body.classList.toggle('cqPage', name === 'croquis');
  if (expand && sheetStage === 0 && name !== 'croquis') setSheetStage(1);
  if (window.__positRelayout) window.__positRelayout();
}
for (const b of document.querySelectorAll('#tabbar button')) {
  b.addEventListener('click', () => {
    // いま開いているタブをもう一度押したら、パネルを閉じる（クロッキーは画面いっぱいの設定を閉じる）
    const name = b.dataset.tab;
    const open = b.classList.contains('on') && (name === 'croquis' ? document.body.classList.contains('cqPage') : sheetStage > 0);
    if (open) {
      document.body.classList.remove('cqPage');
      setSheetStage(0);
      return;
    }
    showTab(name);
  });
}

// ---- パネルの高さ（3 段）と、人形を見せる場所 ------------------------------
//   0 … たたむ（タブだけ）、1 … 半分、2 … 広く。つまみを上下に動かして離すと、近い段へ吸い付く。
//   パネルや上のボタンに隠れない所に人形が収まるよう、カメラの見る窓を合わせる（viewer.setInsets）

const wideLayout = () => window.matchMedia('(min-width: 720px) and (orientation: landscape)').matches;
const stageHeight = k => {
  const H = window.innerHeight;
  if (k === 2) return Math.round(H * 0.8);
  return Math.round(Math.min(H * 0.55, Math.max(345, Math.min(450, H * 0.46))));
};
// パネルは、開くたびにたたんだ状態から始める（v47。人形の上だけで操作できるので）
let sheetStage = 0;

function updateInsets() {
  if (typeof placeAnatCard === 'function' && !$('anatCard').hidden) placeAnatCard();
  if (document.body.classList.contains('croquis')) { viewer.setInsets(null); return; }
  const sheet = $('sheet').getBoundingClientRect();
  const top = Math.round(($('topbar').getBoundingClientRect().bottom || 0) - 4);
  // 画面の下の「見る向き」のボタンの段（約 46px）にも人形がかからないように、そのぶん下を空ける
  const bar = getComputedStyle($('viewBar')).display !== 'none' ? 90 : 0;     // 見る向き＋ポーズ・キープの 2 段
  let ins;
  if (wideLayout()) {
    // 横長の画面：パネルは右。たたんだときは下のタブだけなので、右は空ける
    if (sheetStage === 0) ins = { top, right: 0, bottom: Math.round(window.innerHeight - sheet.top), left: 0 };
    else ins = { top, right: Math.round(window.innerWidth - sheet.left), bottom: 0, left: 0 };
  }
  else ins = { top, right: 0, bottom: Math.max(0, Math.round(window.innerHeight - sheet.top)), left: 0 };
  // 左のポーズ一覧を出しているときは、そのぶん左を空ける（人形は右の残りの真ん中に）
  document.documentElement.style.setProperty('--top-b', `${top + 4}px`);
  if (!$('posePop').hidden) ins.left = Math.round($('posePop').getBoundingClientRect().right);
  // 見る向きのボタンは、空いている所の下の端に置く
  document.documentElement.style.setProperty('--view-b', `${ins.bottom}px`);
  $('viewBar').style.left = `${8 + (ins.left || 0)}px`;
  $('actBar').style.left = `${8 + (ins.left || 0)}px`;
  $('viewBar').style.right = `${8 + (ins.right || 0)}px`;
  $('actBar').style.right = `${8 + (ins.right || 0)}px`;
  viewer.setInsets({ ...ins, bottom: ins.bottom + bar });
}
let insetTimer = null;
const queueInsets = (ms = 0) => {
  if (insetTimer) clearTimeout(insetTimer);
  insetTimer = setTimeout(updateInsets, ms);
};

function setSheetStage(k, save = true) {
  sheetStage = Math.max(0, Math.min(2, k));
  document.body.classList.toggle('collapsed', sheetStage === 0);
  if (sheetStage > 0) document.documentElement.style.setProperty('--sheet-h', stageHeight(sheetStage) + 'px');
  if (save) { settings.sheetStage = sheetStage; saveSettings(); }
  // 高さが変わり終わってから測る（動いている途中も追う）
  queueInsets(0); setTimeout(updateInsets, 140); setTimeout(updateInsets, 300);
  if (window.__positRelayout) window.__positRelayout();
}
const toggleSheet = () => setSheetStage(sheetStage === 0 ? 1 : 0);

// つまみ: 上下にドラッグすると高さが変わる。動かさずに離したら、たたむ／開く。
(() => {
  const grip = $('grip');
  const sheet = $('sheet');
  let startY = 0, startH = 0, moved = false, id = null, lastY = 0, lastT = 0, vel = 0;
  grip.addEventListener('pointerdown', e => {
    id = e.pointerId; startY = e.clientY; lastY = e.clientY; lastT = performance.now(); vel = 0;
    startH = sheet.getBoundingClientRect().height;
    moved = false;
    grip.setPointerCapture(id);
  });
  grip.addEventListener('pointermove', e => {
    if (id === null || e.pointerId !== id) return;
    const dy = e.clientY - startY;
    if (!moved && Math.abs(dy) > 4) {
      moved = true;
      document.body.classList.add('resizing');
      if (document.body.classList.contains('collapsed')) {
        document.body.classList.remove('collapsed');
        startH = 120;
      }
    }
    if (moved) {
      const now = performance.now();
      vel = (e.clientY - lastY) / Math.max(1, now - lastT);    // px/ms（下向きが +）
      lastY = e.clientY; lastT = now;
      const h = Math.max(110, Math.min(window.innerHeight * 0.86, startH - dy));
      document.documentElement.style.setProperty('--sheet-h', h + 'px');
      updateInsets();
      e.preventDefault();
    }
  });
  const end = e => {
    if (id === null || (e && e.pointerId !== id)) return;
    try { grip.releasePointerCapture(id); } catch (err) { /* 続行 */ }
    id = null;
    document.body.classList.remove('resizing');
    if (!moved) { toggleSheet(); return; }
    // 離した高さに近い段へ。速く払ったときはその向きへ 1 段
    const h = sheet.getBoundingClientRect().height;
    const cand = [90, stageHeight(1), stageHeight(2)];
    let k = 0, best = Infinity;
    cand.forEach((c, i) => { if (Math.abs(c - h) < best) { best = Math.abs(c - h); k = i; } });
    if (Math.abs(vel) > 0.6) {
      const cur = cand.reduce((a, c, i) => (c < h ? i : a), 0);
      k = vel > 0 ? Math.max(0, cur) : Math.min(2, cur + 1);
    }
    setSheetStage(k);
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
})();
window.addEventListener('resize', () => { if (sheetStage > 0) document.documentElement.style.setProperty('--sheet-h', stageHeight(sheetStage) + 'px'); queueInsets(60); });
window.addEventListener('orientationchange', () => queueInsets(300));

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
  // ボタンや矢印で送るときは、なめらかに動いている途中のページを印にしない
  // （途中のページの見出しが一瞬光って、二つ光っているように見えるのを防ぐ）
  let lockTo = -1, lockUntil = 0;
  const goSmooth = i => {
    const k = Math.max(0, Math.min(panes.length - 1, i));
    lockTo = k; lockUntil = performance.now() + 3000;
    pager.scrollTo({ left: pager.clientWidth * k, behavior: 'smooth' });
    mark(k);
  };
  if (buttons) buttons.forEach((b, i) => b.addEventListener('click', () => goSmooth(i)));
  let timer = null;
  const onScroll = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const i = Math.max(0, Math.min(panes.length - 1, Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth))));
      if (lockTo >= 0) {
        // 目当てのページに着く（または指で触る・3 秒たつ）までは、途中のページを印にしない
        const atTarget = Math.abs(pager.scrollLeft - pager.clientWidth * lockTo) < 3;
        if (atTarget || performance.now() > lockUntil) lockTo = -1;
        else return;
      }
      mark(i);
    }, 60);
  };
  // 指で触ったら、ボタンで送っている途中でも指の動きを優先する
  const release = () => { lockTo = -1; };
  pager.addEventListener('touchstart', release, { passive: true });
  pager.addEventListener('pointerdown', release);
  if (prevBtn) prevBtn.addEventListener('click', () => goSmooth(cur - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => goSmooth(cur + 1));
  pager.addEventListener('scroll', onScroll);
  pager.__pagerOff = () => {
    pager.removeEventListener('scroll', onScroll);
    pager.removeEventListener('touchstart', release);
    pager.removeEventListener('pointerdown', release);
  };
  return { pager, panes, go: i => { lockTo = -1; pager.scrollLeft = pager.clientWidth * i; mark(i); }, goSmooth };
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
  // 上に出ている帯（小物の帯・関節の帯）に重ならないように、その下に出す
  let top = 0;
  for (const id of ['propBar', 'selBar']) {
    const b = $(id);
    if (b && !b.hidden) top = Math.max(top, b.getBoundingClientRect().bottom + 8);
  }
  el.style.top = top ? `${Math.round(top)}px` : '';
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

let hipsTold = false;
viewer.onSelect = key => {
  const label = key ? jointLabel(key) : '';
  syncSelBar(key);
  $('selBadge').textContent = label;
  $('selName').textContent = label || '選択なし';
  $('btnResetJoint').disabled = !key;
  syncSliders();
  for (const el of document.querySelectorAll('.chip.j')) {
    el.classList.toggle('on', el.dataset.key === key);
  }
  // 関節を選んでも、たたんだパネルは開かない（人形の上で操作できるので）。開いたときは関節のページになっている
  if (key) { showTab('joint', false); focusJointGroup(key); }
  if (key === 'hips' && !hipsTold) {
    hipsTold = true;
    showToast('腰を押して動かすと体全体が動きます。緑の輪で向きを変えます');
  }
};

// 画面の上の、選んだ関節の操作（戻す・左右へ写す・選択を外す）
function syncSelBar(key) {
  $('selBar').hidden = !key;
  $('quickPop').hidden = true;
  if (!key) return;
  $('selBarName').textContent = jointLabel(key);
  const j = JOINT_BY_KEY[key];
  $('selBarCopy').hidden = !(j && j.side && j.base !== 'jaw');
  // 手を選んだら「手の形」、首・頭・あごを選んだら「顔」を、パネルを開かずに選べる
  syncLockBtn(key);
  const more = quickKind(key);
  $('selBarMore').hidden = !more;
  if (more) $('selBarMore').textContent = more === 'hand' ? '手の形' : '顔';
}
// 固定: 手・足はその手・足、腰は両足（足を固定して腰を動かすと、しゃがむ・重心を移す）
function lockKeys(key) {
  if (/^(hand|foot)[LR]$/.test(key || '')) return [key];
  if (key === 'hips') return ['footL', 'footR'];
  return null;
}
function syncLockBtn(key) {
  const ks = lockKeys(key), b = $('selBarLock');
  b.hidden = !ks;
  if (!ks) return;
  const on = ks.every(k => viewer.isLocked(k));
  b.classList.toggle('on', on);
  b.textContent = key === 'hips' ? (on ? '両足を固定中' : '両足を固定') : (on ? '固定中' : '固定');
}
$('selBarLock').addEventListener('click', () => {
  const key = viewer.selected, ks = lockKeys(key);
  if (!ks) return;
  const on = !ks.every(k => viewer.isLocked(k));
  for (const k of ks) viewer.toggleLock(k, on);
  syncLockBar();
  showToast(on
    ? (key === 'hips' ? '両足を固定しました。腰を押して動かすと、足はそのままで腰が動きます' : `${jointLabel(key)}を固定しました。ほかを動かしても、この位置に残ります`)
    : '固定を外しました');
});
function quickKind(key) {
  if (/^hand[LR]$/.test(key || '') && viewer.fingerBoneCount()) return 'hand';
  if (/^(neck|head|jaw)$/.test(key || '')) return 'face';
  return null;
}
function openQuickPop() {
  const key = viewer.selected, kind = quickKind(key);
  if (!kind) return;
  const grid = $('quickPopGrid');
  grid.innerHTML = '';
  const side = kind === 'hand' ? key.slice(-1) : null;
  $('quickPopTitle').textContent = kind === 'hand'
    ? `${side === 'L' ? '人形の左手' : '人形の右手'}の形（人形から見た左右）`
    : '顔の向き・表情';
  for (const it of kind === 'hand' ? HAND_SHAPES : FACE_PRESETS) {
    const b = document.createElement('button');
    b.textContent = it.name;
    b.addEventListener('click', () => {
      if (kind === 'hand') viewer.applyHandShape(side, it.spec);
      else { snapshot(); viewer.applyFacePreset(it.spec); syncSliders(); }
      for (const x of grid.children) x.classList.toggle('on', x === b);
    });
    grid.appendChild(b);
  }
  $('quickPop').hidden = false;
}
$('selBarMore').addEventListener('click', () => {
  if ($('quickPop').hidden) openQuickPop(); else $('quickPop').hidden = true;
});
// 上のバーの「画像に保存」: 画面のまま／背景を透過
$('btnShot').addEventListener('click', e => { e.stopPropagation(); $('shotPop').hidden = !$('shotPop').hidden; });
$('shotPopPlain').addEventListener('click', () => { $('shotPop').hidden = true; exportImage(false); });
$('shotPopClear').addEventListener('click', () => { $('shotPop').hidden = true; exportImage(true); });
// 小窓の外を触ったら閉じる
document.addEventListener('pointerdown', e => {
  if (!$('shotPop').hidden && !e.target.closest('#shotPop, #btnShot')) $('shotPop').hidden = true;
  if (!$('quickPop').hidden && !e.target.closest('#quickPop, #selBar')) $('quickPop').hidden = true;
}, { capture: true });
// 関節の印
$('dotsOn').checked = settings.dots;
viewer.setDotsEnabled(settings.dots);
$('dotsOn').addEventListener('change', e => {
  settings.dots = e.target.checked; settings.dotsUser = true; saveSettings();
  viewer.setDotsEnabled(settings.dots);
});
$('selBarReset').addEventListener('click', () => {
  if (!viewer.selected) return;
  snapshot(); viewer.resetSelected(); syncSliders();
  showToast(`${jointLabel(viewer.selected)}を戻しました`);
});
$('selBarCopy').addEventListener('click', () => {
  if (!viewer.selected) return;
  snapshot();
  const r = viewer.copyLimbToOther(viewer.selected);
  syncSliders();
  if (r) showToast(`${r}へ写しました（鏡に映した形）`);
});
$('selBarClose').addEventListener('click', () => viewer.select(null));

// ---- 画面の左のポーズ一覧・体全体・キープ ----------------------------------------
//   一覧は画面の左に縦 1 列で出す。出したままでも右側で人形を回す・拡大縮小・関節を動かせる。
//   ‹ 前 / 次 › で、いま見ている分類の中を順に送れる（一覧を見ずに次々と確かめられる）
let popCat = '';
let popCurrent = null;
// お気に入り（この端末に残す）
const FAV_KEY = 'posit.favs';
let favs = new Set();
try { favs = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); } catch (e) { /* 使えなくても続行 */ }
function toggleFav(id) {
  if (favs.has(id)) favs.delete(id); else favs.add(id);
  try { localStorage.setItem(FAV_KEY, JSON.stringify([...favs])); } catch (e) { /* 続行 */ }
}
// 分類の順に並べる（「すべて」で同じ分類の見出しが二度出ないように）。★ はお気に入りだけ
const popList = () => (popCat === 'fav'
  ? [...POSE_PRESETS, ...myPoses].filter(p => favs.has(p.id))
  : popCat === 'mine' ? myPoses.slice()
  : POSE_CATEGORIES.flatMap(c => POSE_PRESETS.filter(x => x.category === c.key && (!popCat || x.category === popCat))));

// ---- マイポーズ（自分で作ったポーズに名前を付けて残す。この端末に残し、ファイル・URL で別の端末へ移せる） ----
const MY_KEY = 'posit.myPoses';
let myPoses = [];
function cleanMyPose(o) {
  if (!o || typeof o.spec !== 'string') return null;
  const hands = o.hands && typeof o.hands === 'object' ? { L: String(o.hands.L || ''), R: String(o.hands.R || '') } : { L: '', R: '' };
  return { id: typeof o.id === 'string' && /^my/.test(o.id) ? o.id : 'my' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: String(o.name || 'マイポーズ').slice(0, 40), spec: o.spec, hands, thumb: typeof o.thumb === 'string' ? o.thumb : '', category: 'mine', created: o.created || Date.now(),
    // 小物と 2 体目も一緒に残す（scene = { props, second }。なければ人形 1 体のポーズだけ）
    scene: cleanScene(o.scene) };
}
function cleanScene(sc) {
  if (!sc || typeof sc !== 'object') return null;
  const props = sc.props && Array.isArray(sc.props.items) ? { sel: null, items: sc.props.items.filter(e => e && typeof e.type === 'string' && Array.isArray(e.pos) && Array.isArray(e.quat)).map(e => ({ ...e, grips: Array.isArray(e.grips) ? e.grips.filter(g => g && typeof g.key === 'string' && Array.isArray(g.rel) && g.rel.length === 16) : [] })) } : null;
  const second = sc.second && sc.second.stored && typeof sc.second.stored === 'object' ? { stored: sc.second.stored, hands: sc.second.hands || {}, firstActive: sc.second.firstActive !== false } : null;
  const shift = Array.isArray(sc.shift) && sc.shift.length === 3 && sc.shift.every(Number.isFinite) ? sc.shift : null;
  return props && props.items.length || second ? { props, second, shift } : null;
}
try { myPoses = (JSON.parse(localStorage.getItem(MY_KEY) || '[]') || []).map(cleanMyPose).filter(Boolean); } catch (e) { myPoses = []; }
function saveMyPoses() {
  setTimeout(() => { if (typeof buildSaved === 'function') buildSaved(); }, 0);
  try { localStorage.setItem(MY_KEY, JSON.stringify(myPoses)); return true; } catch (e) { showToast('この端末に保存できませんでした（空き容量・プライベートブラウズを確かめてください）'); return false; }
}
function addMyPose(name) {
  const props = viewer.props.serialize();
  props.items = props.items.map(e => ({ ...e, auto: false }));   // マイポーズの小物は、自分で置いた小物として戻す
  const p = cleanMyPose({ name: name || `マイポーズ ${myPoses.length + 1}`, spec: toSpec(viewer.allAngles()), hands: { ...viewer.handShape }, thumb: thumbFromViewer(viewer, THREE),
    scene: { props, second: viewer.secondState(), shift: viewer.bodyShift.toArray() } });
  myPoses.unshift(p);
  saveMyPoses();
  return p;
}
/** 取り込む（同じ名前・同じ形は二重に入れない） */
function importMyPoses(list) {
  let n = 0;
  for (const o of list) {
    const p = cleanMyPose({ ...o, id: undefined });
    if (!p || myPoses.some(q => q.spec === p.spec && q.name === p.name)) continue;
    myPoses.unshift(p); n++;
  }
  if (n) saveMyPoses();
  return n;
}
const b64e = str => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64d = str => decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))));
function poseURL(p) {
  const data = b64e(JSON.stringify({ n: p.name, s: p.spec, h: p.hands, t: p.thumb, sc: p.scene || undefined }));
  return location.origin + location.pathname + '#pose=' + data;
}
async function shareMyPose(p) {
  const url = poseURL(p);
  try {
    if (navigator.share) { await navigator.share({ title: 'Posit: ' + p.name, url }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); showToast('ポーズの URL をコピーしました。別の端末で開くと、マイポーズに入ります'); }
  catch (e) { window.__positLastURL = url; showToast('URL をコピーできませんでした'); }
}
async function exportMyPoses() {
  if (!myPoses.length) { showToast('マイポーズがまだありません'); return; }
  const json = JSON.stringify({ app: 'Posit', kind: 'myPoses', version: 1, poses: myPoses.map(({ name, spec, hands, thumb, created, scene }) => ({ name, spec, hands, thumb, created, scene: scene || undefined })) }, null, 1);
  const d = new Date(), pad = x => String(x).padStart(2, '0');
  const fname = `posit-poses-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
  const blob = new Blob([json], { type: 'application/json' });
  try {
    const file = new File([blob], fname, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Posit マイポーズ' }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = fname;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function readPoseFile(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const o = JSON.parse(String(r.result));
      const list = Array.isArray(o) ? o : Array.isArray(o.poses) ? o.poses : [];
      const n = importMyPoses(list);
      showToast(n ? `${n} 個のポーズをマイポーズに入れました` : '新しいポーズはありませんでした');
      popCat = 'mine'; if (!$('posePop').hidden) buildPosePop();
    } catch (e) { showToast('ファイルを読めませんでした（Posit で書き出した .json を選んでください）'); }
  };
  r.readAsText(file);
}
// URL の #pose=… で開いたら、そのポーズをマイポーズに入れて当てる
function takePoseFromURL() {
  const m = location.hash.match(/^#pose=([A-Za-z0-9_-]+)/);
  if (!m) return;
  try {
    const o = JSON.parse(b64d(m[1]));
    const n = importMyPoses([{ name: o.n, spec: o.s, hands: o.h, thumb: o.t, scene: o.sc }]);
    const p = myPoses.find(q => q.spec === o.s && q.name === String(o.n || 'マイポーズ').slice(0, 40));
    if (p) { applyPose(p); showToast(`「${p.name}」を${n ? 'マイポーズに入れました' : '開きました（もうマイポーズにあります）'}`); }
  } catch (e) { showToast('URL のポーズを読めませんでした'); }
  try { window.history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* 続行 */ }
}
function markPosePop(scroll) {
  const grid = $('posePopGrid');
  for (const b of grid.querySelectorAll('.ppPick')) {
    const on = b.dataset.id === popCurrent;
    b.classList.toggle('on', on);
    if (on && scroll) b.scrollIntoView({ block: 'nearest' });
  }
}
/** 小さな絵・名前・星の 1 行 */
function poseRow(p, onPick, cls = 'ppRow', pickCls = 'ppPick') {
  const row = document.createElement('div');
  row.className = cls;
  const b = document.createElement('button');
  b.className = pickCls;
  b.dataset.id = p.id;
  b.innerHTML = poseThumbSVG(p.thumb || p.id) + '<span></span>';
  b.querySelector('span').textContent = p.name;
  b.addEventListener('click', onPick);
  const st = document.createElement('button');
  st.className = 'ppStar' + (favs.has(p.id) ? ' fav' : '');
  st.textContent = favs.has(p.id) ? '★' : '☆';
  st.setAttribute('aria-label', 'お気に入り');
  st.addEventListener('click', e => {
    e.stopPropagation(); toggleFav(p.id);
    st.classList.toggle('fav', favs.has(p.id)); st.textContent = favs.has(p.id) ? '★' : '☆';
    if (popCat === 'fav' && !$('posePop').hidden) buildPosePop();
  });
  row.append(b, st);
  return row;
}
function buildPosePop() {
  buildChips('posePopCats', [{ key: 'fav', label: '★' }, { key: 'mine', label: 'マイ' }, { key: '', label: 'すべて' }, ...POSE_CATEGORIES.map(c => ({ key: c.key, label: c.name }))],
    o => popCat === o.key, o => { popCat = o.key; buildPosePop(); });
  const grid = $('posePopGrid');
  grid.innerHTML = '';
  let lastCat = null;
  const list = popList();
  if (popCat === 'mine') { buildMinePop(grid, list); markPosePop(true); return; }
  if (popCat === 'fav' && !list.length) {
    const h = document.createElement('div');
    h.className = 'ppCat'; h.textContent = '☆ を押したポーズがここに並びます';
    grid.appendChild(h);
  }
  for (const p of list) {
    if (!popCat && p.category !== lastCat) {
      const h = document.createElement('div');
      h.className = 'ppCat';
      h.textContent = (POSE_CATEGORIES.find(c => c.key === p.category) || {}).name || '';
      grid.appendChild(h);
      lastCat = p.category;
    }
    grid.appendChild(poseRow(p, () => { popCurrent = p.id; applyPose(p); markPosePop(false); }));
  }
  markPosePop(true);
}
/** マイ: 名前を付けて保存・一覧（共有・消す）・書き出し・読み込み */
function buildMinePop(grid, list) {
  const form = document.createElement('div');
  form.className = 'mySave';
  const inp = document.createElement('input');
  inp.type = 'text'; inp.maxLength = 40; inp.placeholder = `マイポーズ ${myPoses.length + 1}`; inp.setAttribute('aria-label', 'ポーズの名前');
  const sv = document.createElement('button');
  sv.className = 'qb accent'; sv.textContent = '保存';
  const doSave = () => {
    const p = addMyPose(inp.value.trim());
    popCurrent = p.id;
    showToast(`「${p.name}」を保存しました`);
    buildPosePop();
  };
  sv.addEventListener('click', doSave);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doSave(); } });
  form.append(inp, sv);
  grid.appendChild(form);
  const hint = document.createElement('div');
  hint.className = 'ppCat';
  hint.textContent = list.length ? 'いまの形を名前を付けて保存します（手の形も）' : 'いまの人形の形を、名前を付けて保存できます';
  grid.appendChild(hint);
  for (const p of list) {
    const row = poseRow(p, () => { popCurrent = p.id; applyPose(p); markPosePop(false); });
    const sh = document.createElement('button');
    sh.className = 'ppStar myShare'; sh.textContent = '⇪'; sh.setAttribute('aria-label', 'URL で送る');
    sh.addEventListener('click', e => { e.stopPropagation(); shareMyPose(p); });
    const del = document.createElement('button');
    del.className = 'ppStar myDel'; del.textContent = '×'; del.setAttribute('aria-label', '消す');
    del.addEventListener('click', e => {
      e.stopPropagation();
      if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = '消す'; del.classList.add('armed'); setTimeout(() => { if (del.isConnected) { del.dataset.armed = ''; del.textContent = '×'; del.classList.remove('armed'); } }, 2500); return; }
      myPoses = myPoses.filter(q => q.id !== p.id); saveMyPoses(); favs.delete(p.id);
      showToast(`「${p.name}」を消しました`); buildPosePop();
    });
    row.append(sh, del);
    grid.appendChild(row);
  }
  const io = document.createElement('div');
  io.className = 'myIO';
  const ex = document.createElement('button'); ex.className = 'qb'; ex.textContent = '書き出し'; ex.addEventListener('click', exportMyPoses);
  const im = document.createElement('button'); im.className = 'qb'; im.textContent = '読み込み'; im.addEventListener('click', () => $('myPoseFile').click());
  io.append(ex, im);
  grid.appendChild(io);
}
window.addEventListener('hashchange', () => { if (viewer.primarySlot && viewer.primarySlot.skeleton) takePoseFromURL(); });
$('myPoseFile').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) readPoseFile(f); e.target.value = ''; });

function setPosePanel(on) {
  $('posePop').hidden = !on;
  document.body.classList.toggle('posePanel', on);
  $('actPose').classList.toggle('on', on);
  if (on) buildPosePop();
  queueInsets(0);
}
$('actPose').addEventListener('click', () => setPosePanel($('posePop').hidden));
$('posePopClose').addEventListener('click', () => setPosePanel(false));
$('posePopRandom').addEventListener('click', () => {
  const pool = popList().filter(p => p.id !== popCurrent);
  const p = pool[Math.floor(Math.random() * pool.length)];
  if (!p) return;
  popCurrent = p.id; applyPose(p); markPosePop(true);
});
function stepPose(d) {
  const list = popList();
  if (!list.length) return;
  let i = list.findIndex(p => p.id === popCurrent);
  i = i < 0 ? (d > 0 ? 0 : list.length - 1) : (i + d + list.length) % list.length;
  popCurrent = list[i].id; applyPose(list[i]); markPosePop(true);
}
$('posePopPrev').addEventListener('click', () => stepPose(-1));
$('posePopNext').addEventListener('click', () => stepPose(1));
// 体全体: オンの間は、人形のどこを押して動かしても体全体が床の上を滑る。腰を選ぶので、緑の輪で向きが変わる
function setBodyMode(on) {
  viewer.setBodyMode(on);
  $('actBody').classList.toggle('on', on);
}
$('actBody').addEventListener('click', () => {
  const on = !viewer.bodyMode;
  setBodyMode(on);
  if (on) {
    viewer.select('hips');
    showToast('体全体: 人形を押して動かすと体ごと滑ります。緑の輪で向きを変えます。もう一度押すと終わります');
  } else if (viewer.selected === 'hips') viewer.select(null);
});

// 手・足の固定ボタン（右下）。左右は人形から見た左右
function syncLockBar() {
  for (const b of document.querySelectorAll('#lockBar [data-lock]')) b.classList.toggle('on', viewer.isLocked(b.dataset.lock));
  if (viewer.selected) syncLockBtn(viewer.selected);
}
for (const b of document.querySelectorAll('#lockBar [data-lock]')) {
  b.addEventListener('click', () => {
    const k = b.dataset.lock, on = !viewer.isLocked(k);
    viewer.toggleLock(k, on);
    syncLockBar();
    showToast(on ? `${jointLabel(k)}を固定しました（ほかを動かしても、この位置に残ります）` : `${jointLabel(k)}の固定を外しました`);
  });
}
viewer.onLocksChanged = () => syncLockBar();

// キープ: ポーズを 1 つ取っておき、ほかのポーズに変えたあと、ボタンで行き来する（端末に覚えておく）
const KEEP_KEY = 'posit.keep';
let kept = (() => { try { return JSON.parse(localStorage.getItem(KEEP_KEY) || 'null'); } catch (e) { return null; } })();
const currentPoseData = () => ({ spec: toSpec(viewer.allAngles()), hands: { ...viewer.handShape } });
function saveKeep() { try { localStorage.setItem(KEEP_KEY, JSON.stringify(kept)); } catch (e) { /* 続行 */ } }
function syncKeep() {
  const b = $('actKeep');
  b.classList.toggle('kept', !!kept);
  b.textContent = kept ? '⇄ キープ' : 'キープ';
  b.title = kept ? 'キープしたポーズと入れ替える' : 'いまのポーズをキープ';
  $('actKeepClear').hidden = !kept;
}
$('actKeep').addEventListener('click', () => {
  if (!kept) {
    kept = currentPoseData(); saveKeep(); syncKeep();
    showToast('いまのポーズをキープしました。ほかのポーズに変えたあと「⇄ キープ」で行き来できます');
    return;
  }
  // いまのポーズとキープを入れ替える（どちらも残る）
  const now = currentPoseData();
  snapshot();
  viewer.applyPose(kept.spec);
  for (const sd of ['L', 'R']) viewer.applyHandShape(sd, (kept.hands && kept.hands[sd]) || '');
  kept = now; saveKeep(); syncKeep();
  syncSliders();
  showToast('キープしたポーズに切り替えました（もう一度押すと戻ります）');
});
$('actKeepClear').addEventListener('click', () => { kept = null; saveKeep(); syncKeep(); showToast('キープを消しました'); });
syncKeep();

// 操作のしかた（はじめて開いたときに 1 度だけ出す。「？」からいつでも開ける）
function openGuide() { $('guideBox').hidden = false; }
$('guideClose').addEventListener('click', () => {
  $('guideBox').hidden = true;
  if (!settings.guideSeen) { settings.guideSeen = true; saveSettings(); }
});
$('btnGuide').addEventListener('click', () => { $('helpBox').hidden = true; openGuide(); });
if (!settings.guideSeen) setTimeout(openGuide, 600);
let dblTold = false;
viewer.onDoubleTap = () => { if (!dblTold) { dblTold = true; showToast('全体を画面に収めました'); } };
// 見る向き（左右は人形から見た左右）。「全体」は人形全体を画面に収める
for (const b of document.querySelectorAll('#viewBar .qb[data-az]')) {
  b.addEventListener('click', () => viewer.viewFromAngle(+b.dataset.az, +b.dataset.el));
}
$('viewBarFit').addEventListener('click', () => viewer.fitView());

// ---- 保存した角度（カメラの位置・向き・レンズ。この端末に残す） -------------------------
const CAM_KEY = 'posit.cams';
let camSaves = [];
try { camSaves = JSON.parse(localStorage.getItem(CAM_KEY) || '[]'); } catch (e) { camSaves = []; }
const saveCams = () => { try { localStorage.setItem(CAM_KEY, JSON.stringify(camSaves)); } catch (e) { /* 続行 */ } };
function buildCamList() {
  const el = $('camList');
  el.innerHTML = '';
  camSaves.forEach((c, i) => {
    const row = document.createElement('div'); row.className = 'cmRow';
    const go = document.createElement('button'); go.className = 'cmGo ghost'; go.textContent = c.name;
    go.addEventListener('click', () => {
      if (c.lens) { viewer.setLens(c.lens); setRange('lens', c.lens); }
      viewer.camera.position.fromArray(c.pos); viewer.controls.target.fromArray(c.target); viewer.controls.update();
      showToast('角度: ' + c.name);
    });
    const del = document.createElement('button'); del.className = 'cmDel ghost'; del.textContent = '×'; del.setAttribute('aria-label', '消す');
    del.addEventListener('click', () => { camSaves.splice(i, 1); saveCams(); buildCamList(); });
    row.append(go, del); el.appendChild(row);
  });
}
$('viewBarSaved').addEventListener('click', e => { e.stopPropagation(); $('camPop').hidden = !$('camPop').hidden; if (!$('camPop').hidden) buildCamList(); });
$('camSave').addEventListener('click', () => {
  const name = `角度 ${camSaves.length + 1}`;
  camSaves.push({ name, pos: viewer.camera.position.toArray(), target: viewer.controls.target.toArray(), lens: +$('lens').value });
  if (camSaves.length > 24) camSaves.shift();
  saveCams(); buildCamList(); showToast(name + ' を保存しました');
});
document.addEventListener('pointerdown', e => {
  if (!$('camPop').hidden && !e.target.closest('#camPop, #viewBarSaved')) $('camPop').hidden = true;
}, { capture: true });

// ---- 2 体目の人形 --------------------------------------------------------
//   「＋2体目」で、いまの人形をその場に残し、もう 1 体を横に出して動かす。「入れ替え」で動かす人形を替える
function syncDuo() {
  const on = viewer.hasSecond();
  $('actDuo').textContent = on ? '2体目を消す' : '＋2体目';
  $('actDuo').classList.toggle('duoOn', on);
  $('actSwap').hidden = !on;
  // 小物の帯の「右手」「左手」などは、いま動かしている人形のつなぎを出す
  syncPropBar();
}
$('actDuo').addEventListener('click', () => {
  if (viewer.hasSecond()) { snapshot(); viewer.removeSecond(); showToast('2体目を消しました（1体目は残ります）'); }
  else { const pre = takeState(); if (!viewer.addSecond()) return; snapshot(pre); showToast('2体目を出しました（いま動かすのは右の人形）'); }
  syncDuo(); syncSliders();
});
// ---- 小物 --------------------------------------------------------------------
//   「小物」で種類を選んで置く。小物を押したまま動かし、輪で回す。選ぶと上の帯で大きさ・手で持つ・消すを操作する
const props = viewer.props;
props.onHandShape = (sd, id) => {
  const sh = HAND_SHAPES.find(x => x.id === id);
  viewer.applyHandShape(sd, sh ? sh.spec : '');
};
let propGroupShown = null;
for (const t of PROP_TYPES) {
  if (t.list === false) continue;
  if (propGroupShown !== t.grounded) {
    propGroupShown = t.grounded;
    const h = document.createElement('div');
    h.className = 'qpSub';
    h.textContent = t.grounded ? '置く物' : '手に持つ物';
    $('propPopGrid').appendChild(h);
  }
  const b = document.createElement('button');
  b.className = 'ghost';
  b.textContent = t.name;
  b.addEventListener('click', () => {
    $('propPop').hidden = true;
    snapshot();
    const it = props.add(t.key);
    if (it) showToast(t.grounded ? `${t.name}を置きました（押したまま動かす・輪で回す）` : `${t.name}を出しました（「右手」「左手」で手に持たせます）`);
  });
  $('propPopGrid').appendChild(b);
}
// 石膏像（彫刻の 3D スキャン）: 像ごとに並べる
{
  const h = document.createElement('div');
  h.className = 'qpSub';
  h.textContent = '石膏像（胸像・頭像 → 全身像）';
  $('propPopGrid').appendChild(h);
  for (const st of STATUES) {
    const b = document.createElement('button');
    b.className = 'ghost statue';
    b.textContent = st.name.replace(/（.*$/, '');
    b.title = st.name;
    b.addEventListener('click', () => {
      $('propPop').hidden = true;
      snapshot();
      const it = props.add('statue', { variant: st.key, name: st.name.replace(/（.*$/, '') });
      if (it) showToast(`${st.name}を置きました（読み込みに少しかかります）`);
    });
    $('propPopGrid').appendChild(b);
  }
  // 幾何形体（石膏）
  const h2 = document.createElement('div');
  h2.className = 'qpSub';
  h2.textContent = '幾何形体（石膏）';
  $('propPopGrid').appendChild(h2);
  for (const so of SOLIDS) {
    const b = document.createElement('button');
    b.className = 'ghost';
    b.textContent = so.name;
    b.addEventListener('click', () => {
      $('propPop').hidden = true;
      snapshot();
      const it = props.add('solid', { variant: so.key, name: so.name });
      if (it) showToast(`${so.name}を置きました`);
    });
    $('propPopGrid').appendChild(b);
  }
}
function syncPropBar() {
  const it = props.selected;
  $('propBar').hidden = !it;
  $('actProp').classList.toggle('propOn', props.items.length > 0);
  $('propPopClear').hidden = !props.items.length;
  // 「持つ所を変える」は、つないでいる小物を選んでいる間だけ
  const anyGrip = !!it && it.grips.length > 0;
  if (!anyGrip && props.slideMode) props.slideMode = false;
  $('propBarSlide').hidden = !anyGrip;
  $('propBarSlide').classList.toggle('on', !!props.slideMode);
  if (!it) return;
  $('selBar').hidden = true;
  $('propBarName').textContent = it.name;
  $('propBarAxis').textContent = PROP_AXES.find(a => a[0] === propAxis)[1];
  $('propBarSize').textContent = props.sizeLabel(it, propAxis);
  // 2 体のときは、1 体目・2 体目のつなぎを行で分けて出す（押すと、その人形を動かす人形にしてつなぐ）
  const duo = viewer.hasSecond();
  $('propBarRow1').textContent = duo ? '1体目' : 'つなぐ';
  $('propBarRow1').classList.toggle('pbDollA', duo);
  for (const id of ['propBarBreak1', 'propBarBreak2', 'propBarBreak3', 'propBarRow2']) $(id).hidden = !duo;
  for (const [key, id, doll] of PROP_LIMB_BTNS) {
    const b = $(id);
    b.classList.toggle('on', it.grips.some(g => g.key === key && (g.doll || 'A') === doll));
    b.classList.toggle('dollA', duo && doll === 'A');
    b.classList.toggle('dollB', duo && doll === 'B');
    b.hidden = (doll === 'B' && !duo) || (/^foot/.test(key) && !it.grounded && it.type !== 'ball');
  }
}
props.onSelect = () => syncPropBar();
props.onChange = () => syncPropBar();
$('actProp').addEventListener('click', e => { e.stopPropagation(); $('propPop').hidden = !$('propPop').hidden; });
document.addEventListener('pointerdown', e => {
  if (!$('propPop').hidden && !e.target.closest('#propPop, #actProp')) $('propPop').hidden = true;
}, { capture: true });
$('propPopClear').addEventListener('click', () => { snapshot(); props.clear(); $('propPop').hidden = true; showToast('小物をすべて消しました'); });
// 大きさを変える向き（全体 → 縦 → 横 → 奥行き の順に切り替え）
const PROP_AXES = [['all', '全体'], ['y', '縦'], ['x', '横'], ['z', '奥行き']];
let propAxis = 'all';
$('propBarAxis').addEventListener('click', () => {
  const i = PROP_AXES.findIndex(a => a[0] === propAxis);
  propAxis = PROP_AXES[(i + 1) % PROP_AXES.length][0];
  syncPropBar();
});
$('propBarSmaller').addEventListener('click', () => { snapshot(); props.resize(-1, props.selected, propAxis); });
$('propBarBigger').addEventListener('click', () => { snapshot(); props.resize(1, props.selected, propAxis); });
// 右手・左手・右足・左足（人形から見た左右）。押すとつなぎ、もう一度押すと離す
const PROP_LIMBS = [['handR', 'propBarGripR'], ['handL', 'propBarGripL'], ['footR', 'propBarFootR'], ['footL', 'propBarFootL']];
// [つなぐ所, ボタン, 人形（A: 1 体目 / B: 2 体目）]
const PROP_LIMB_BTNS = [...PROP_LIMBS.map(([k, id]) => [k, id, 'A']),
  ['handR', 'propBar2GripR', 'B'], ['handL', 'propBar2GripL', 'B'], ['footR', 'propBar2FootR', 'B'], ['footL', 'propBar2FootL', 'B']];
const LIMB_NAME = { handR: '右手', handL: '左手', footR: '右足', footL: '左足' };
for (const [key, id, doll] of PROP_LIMB_BTNS) $(id).addEventListener('click', () => {
  const it = props.selected; if (!it) return;
  const duo = viewer.hasSecond();
  const nm = (duo ? (doll === 'A' ? '1体目の' : '2体目の') : '') + LIMB_NAME[key];
  const pre = takeState();
  // その人形を動かす人形にしてから（入れ替えを押さなくてよい）
  const swapped = duo && props.liveDoll() !== doll;
  if (swapped) { viewer.swapSecond(); syncSliders(); syncDuo(); }
  if (props.liveGrips(it).some(g => g.key === key)) { snapshot(pre); props.release(it, key); showToast(nm + 'を離しました'); syncPropBar(); return; }
  // つなげたときだけ「戻す」に積む（届かなかったときは何も変わらない）
  const r = props.grip(key, it);
  if (r && r !== 'far') snapshot(pre);
  if (r === 'far') { showToast(nm + 'が届きません。小物を' + nm + 'の近くへ動かしてから押してください'); return; }
  if (!r) return;
  syncSliders();
  const foot = /^foot/.test(key);
  showToast(nm + 'を' + it.name + (foot ? 'の上に置きました（いちばん近い上の面）'
    : it.grounded ? 'に置きました（小物を動かすと手がついてきます。手を引っ張ると面の上で付け直します）' : 'に付けました（手を動かすと一緒に動きます）'));
});
$('propBarDel').addEventListener('click', () => { snapshot(); props.remove(); });
$('propBarSlide').addEventListener('click', () => {
  props.slideMode = !props.slideMode;
  syncPropBar();
  showToast(props.slideMode
    ? '持つ所を変える: 小物を動かすと持つ所が変わり、手足を動かすと離した所で付け直します'
    : '持つ所を変えるのをやめました');
});
// 小物を押したまま動かす・輪で回す: 動かし始めに「戻す」に積む
props.onEditStart = () => snapshot();
$('propBarClose').addEventListener('click', () => props.select(null));

// 止まっている方の人形を押して、動かす人形が切り替わったとき
viewer.onSwap = () => { syncSliders(); syncDuo(); showToast(viewer.secondActive() ? '2体目を動かします' : '1体目を動かします'); };
$('actSwap').addEventListener('click', () => { snapshot(); viewer.swapSecond(); syncSliders(); syncDuo(); showToast(viewer.secondActive() ? '2体目を動かします' : '1体目を動かします'); });
syncDuo();

// ---- 単純化の形 -----------------------------------------------------------
const BLOCK_STYLES = [{ value: 'std', label: '箱と円柱' }, { value: 'egg', label: '卵と円柱（ルーミス風）' }, { value: 'box', label: 'すべて箱' }];
let blockStyle = 'std';
try { blockStyle = localStorage.getItem('posit.blockStyle') || 'std'; } catch (e) { /* 続行 */ }
viewer.blockStyle = blockStyle;

function buildBlockStyleChips() {
  $('blockStyleRow').hidden = viewer.viewMode !== 'block';
  buildChips('blockStyleChips', BLOCK_STYLES, o => blockStyle === o.value, o => {
    blockStyle = o.value; try { localStorage.setItem('posit.blockStyle', blockStyle); } catch (e) { /* 続行 */ }
    viewer.setBlockStyle(blockStyle); buildBlockStyleChips();
  });
}

// 人形の上で関節を押したまま動かす
let jdFrame = 0;
viewer.onJointDragStart = () => { snapshot(); };
viewer.onJointDrag = () => {
  if (jdFrame) return;
  jdFrame = requestAnimationFrame(() => { jdFrame = 0; syncSliders(); });
};
let jdTold = false;
let pullTold = false;
viewer.onJointDragEnd = (key, ring) => {
  syncSliders();
  if (ring === 'pull') {
    if (!pullTold) { pullTold = true; showToast('手・足を引っ張ると、腕・脚ごとついてきます。上の「戻す」で戻せます'); }
    return;
  }
  if (ring) { hideRingInfo(); return; }
  if (!jdTold) { jdTold = true; showToast('関節を直接動かしました。上の「戻す」で戻せます'); }
};

// 回転の輪（3軸）: 赤=X・緑=Y・青=Z。回している間は、軸の名前と角度を画面の上に出す
let ringInfoTimer = 0;
function hideRingInfo() {
  clearTimeout(ringInfoTimer);
  ringInfoTimer = setTimeout(() => { $('ringInfo').hidden = true; }, 700);
}
viewer.rings.onChange = (key, axis, val) => {
  const j = JOINT_BY_KEY[key];
  const name = j ? j.axes[{ x: 0, y: 1, z: 2 }[axis]] : axis.toUpperCase();
  const el = $('ringInfo');
  el.dataset.axis = axis;
  el.textContent = `${jointLabel(key)}・${name} ${Math.round(val)}°`;
  el.hidden = false;
  clearTimeout(ringInfoTimer);
};
$('pullOn').checked = settings.pull;
viewer.setPullEnabled(settings.pull);
$('pullOn').addEventListener('change', e => {
  settings.pull = e.target.checked; saveSettings();
  viewer.setPullEnabled(settings.pull);
});
$('posePropsOn').checked = settings.poseProps;
$('posePropsOn').addEventListener('change', e => {
  settings.poseProps = e.target.checked; saveSettings();
  if (!settings.poseProps) viewer.props.clearAuto();
});
$('ringsOn').checked = settings.rings;
viewer.setRingsEnabled(settings.rings);
$('ringsOn').addEventListener('change', e => {
  settings.rings = e.target.checked; saveSettings();
  viewer.setRingsEnabled(settings.rings);
});

// ---- スライダ --------------------------------------------------------------

const AXES = [
  { axis: 'x', input: 'axX', out: 'outX', lab: 'labX', lo: 0, hi: 1, ai: 0 },
  { axis: 'y', input: 'axY', out: 'outY', lab: 'labY', lo: 2, hi: 3, ai: 1 },
  { axis: 'z', input: 'axZ', out: 'outZ', lab: 'labZ', lo: 4, hi: 5, ai: 2 },
];

function syncSliders() {
  if (typeof syncLockBar === 'function') syncLockBar();
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

// 名前で探す（ひらがな・カタカナは区別しない）
let poseQuery = '';
const kana = t => String(t || '').normalize('NFKC').toLowerCase()
  .replace(/[\u30a1-\u30f6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const matchQuery = p => !poseQuery || kana(p.name).includes(kana(poseQuery))
  || (p.tags && kana(p.tags.join(' ')).includes(kana(poseQuery)));

const currentPoses = () => {
  if (poseQuery) return POSE_PRESETS.filter(matchQuery);
  return poseCategory ? POSE_PRESETS.filter(p => p.category === poseCategory) : POSE_PRESETS;
};

// 1ページに並べるポーズの数。シートの高さに合わせて決めるので、
// 1ページぶんが縦にはみ出さず、左右のスライドだけで全部を見られる。
let posePerPage = 6;
let posePages = [];
let posePager = null;

// 1 行の列数（狭い画面は 3 列、広い画面は 4 列）
function poseCols() {
  const el = $('poseList');
  const w = el ? el.clientWidth : 360;
  return w >= 520 ? 4 : 3;
}
function posesPerPage() {
  const el = $('poseList');
  const h = el ? el.clientHeight : 0;
  const cols = poseCols();
  document.documentElement.style.setProperty('--pose-cols', cols);
  if (!h) return cols * 3;
  const rows = Math.floor((h - 24 + 6) / 44);  // 見出し 24px、1行 38px＋すき間 6px
  return Math.max(1, Math.min(6, rows)) * cols;
}

function poseGroups() {
  if (poseQuery) {
    const hit = POSE_PRESETS.filter(matchQuery);
    return [{ key: '', name: hit.length ? `「${poseQuery}」の結果 ${hit.length} 件` : `「${poseQuery}」は見つかりません`, poses: hit }];
  }
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
  queueInsets(0);
  if (posesPerPage() === posePerPage) return;
  const i = posePager ? Math.round(posePager.pager.scrollLeft
    / Math.max(1, posePager.pager.clientWidth)) : 0;
  buildPoseList(posePages[i] ? posePages[i].cat : null);
}
let poseLayoutTimer = null;
const queueRelayout = () => {
  if (poseLayoutTimer) clearTimeout(poseLayoutTimer);
  poseLayoutTimer = setTimeout(relayoutPoses, 330);     // パネルの高さが変わり終わってから測る
};
window.addEventListener('resize', queueRelayout);
window.addEventListener('orientationchange', queueRelayout);
window.__positRelayout = queueRelayout;
// ポーズ一覧の大きさが変わったら（パネルの段・回転・タブの切り替え）、1 ページの数を測り直す
if (window.ResizeObserver) {
  let lastH = 0, lastW = 0;
  new ResizeObserver(() => {
    const el = $('poseList');
    if (!el.clientHeight || (el.clientHeight === lastH && el.clientWidth === lastW)) return;
    lastH = el.clientHeight; lastW = el.clientWidth;
    queueRelayout();
  }).observe($('poseList'));
}

/** ポーズに合う手の形を当てる（グー・握る・平ら…。決めていないポーズは平ら） */
function applyPoseHands(pose) {
  // マイポーズは、保存したときの手の形（指の角度）をそのまま
  if (pose.hands && typeof pose.hands === 'object' && !Array.isArray(pose.hands)) {
    for (const sd of ['L', 'R']) viewer.applyHandShape(sd, pose.hands[sd] || '');
    return;
  }
  const h = POSE_HANDS[pose.id] || ['', ''];
  ['L', 'R'].forEach((sd, i) => {
    const shape = HAND_SHAPES.find(x => x.id === h[i]);
    viewer.applyHandShape(sd, shape ? shape.spec : '');
  });
  // v67: 体の重なりは直さない（押し出すと形がくずれるため。実際の体も柔らかく沈み込む）。ポーズは作った形のまま出す
}
/** ポーズに付いた小物を置く（前のポーズの小物は片付ける。自分で置いた小物はそのまま） */
function applyPoseProps(pose, mirror = false) {
  viewer.props.applyPoseProps(settings.poseProps ? pose.props : null, mirror);
}
/**
 * 2人のポーズ: 1体目（写し）に A の形、2体目（動かす方）に B の形を当てて並べる。
 * B は B 自身の向きで作ってあるので、回して（yaw）A から見た場所（at, m）へ置き、手が触れる所（join）は B の手を A へ寄せる
 */
function applyDuoPose(pose) {
  const d = pose.duo;
  viewer.props.clearAuto();
  if (viewer.hasSecond()) viewer.dropSecond();
  viewer.applyPose(pose.spec);
  applyPoseHands(pose);
  viewer.addSecond(0);
  viewer.second.auto = true;
  const B = d.ref ? POSE_PRESETS.find(p => p.id === d.ref) : null;
  viewer.applyPose(B ? B.spec : d.spec);
  applyPoseHands(B || { id: '', hands: null, ...{} });
  if (!B && d.hands) for (const [i, sd] of ['L', 'R'].entries()) { const sh = HAND_SHAPES.find(x => x.id === d.hands[i]); viewer.applyHandShape(sd, sh ? sh.spec : ''); }
  if (d.yaw) viewer.turnWhole(d.yaw);
  viewer.bodyShift.x = d.at[0]; viewer.bodyShift.z = d.at[1];
  viewer.applyAll();
  for (const [kb, ka, off] of d.join || []) {
    const t = viewer.secondBonePos(ka);
    if (!t) continue;
    if (off) t.add(new THREE.Vector3(...off));
    const b = viewer.primarySlot.boneMap[kb];
    const q = b.getWorldQuaternion(new THREE.Quaternion());
    for (let i = 0; i < 3; i++) { viewer.pull.solve(kb, t, q); viewer.applyAll(); }
  }
  syncDuo();
  // 2 体とも画面に入るように（向きは今のまま）
  viewer.fitView();
}
function applyPose(pose) {
  snapshot();
  if (pose.duo) {
    applyDuoPose(pose);
  } else {
    // 2人のポーズで出した 2体目は、ほかのポーズにしたら片付ける（自分で出した 2体目はそのまま）
    if (viewer.hasSecond() && viewer.second.auto) { viewer.dropSecond(); syncDuo(); }
    viewer.applyPose(pose.spec);
    applyPoseHands(pose);
  }
  if (pose.scene) {
    // マイポーズ: 保存したときの立ち位置・2 体目・小物に戻す
    if (pose.scene.shift) { viewer.bodyShift.fromArray(pose.scene.shift); viewer.applyAll(); }
    viewer.restoreSecond(pose.scene.second);
    syncDuo();
    viewer.props.restore(pose.scene.props || { items: [] });
  } else applyPoseProps(pose);
  history.add({ poseId: pose.id, name: pose.name, spec: pose.spec });
  buildHistory();
  syncSliders();
  showToast(pose.name);
}

// 確かめ用（ポーズを名前で当てる）
window.__posit.my = { add: n => addMyPose(n), apply: i => applyPose(myPoses[i]), list: () => myPoses };
window.__posit.applyPoseById = id => { const p = POSE_PRESETS.find(x => x.id === id); if (p) applyPose(p); return !!p; };

$('btnRandomPose').addEventListener('click', () => {
  const pool = currentPoses();
  const recent = history.recentIds(10);
  const fresh = pool.filter(p => !recent.has(p.id));
  const list = fresh.length ? fresh : pool;
  applyPose(list[Math.floor(Math.random() * list.length)]);
});

function setPoseSearch(on) {
  $('poseSearchRow').hidden = !on;
  document.body.classList.toggle('poseSearching', on);
  $('btnPoseSearch').classList.toggle('on', on);
  if (on) { setTimeout(() => $('poseSearch').focus(), 30); }
  else { $('poseSearch').value = ''; if (poseQuery) { poseQuery = ''; buildPoseList(); } }
}
$('btnPoseSearch').addEventListener('click', () => setPoseSearch($('poseSearchRow').hidden));
$('poseSearch').addEventListener('input', e => { poseQuery = e.target.value.trim(); buildPoseList(); });
$('poseSearch').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setPoseSearch(false); });

const SEG_WRAPS = { preset: 'presetWrap', hand: 'handWrap', face: 'faceWrap', history: 'historyWrap', saved: 'savedWrap' };

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
  if (seg === 'saved') buildSaved();
}
for (const b of document.querySelectorAll('#poseSeg button')) {
  b.addEventListener('click', () => showSeg(b.dataset.seg));
}

// ---- 手の形 ---------------------------------------------------------------

let handTarget = 'both';

function buildHandList() {
  buildChips('handSide',
    [{ v: 'both', label: '両手' }, { v: 'L', label: '人形の左手' }, { v: 'R', label: '人形の右手' }],
    o => o.v === handTarget,
    o => { handTarget = o.v; buildHandList(); });

  const wrap = $('handList');
  wrap.innerHTML = '';
  for (const h of HAND_SHAPES) {
    const b = document.createElement('button');
    b.textContent = h.name;
    b.addEventListener('click', () => {
      snapshot();
      viewer.applyHandShape(handTarget, h.spec);
      showToast(h.name);
    });
    wrap.appendChild(b);
  }
  const n = viewer.fingerBoneCount();
  $('handNote').textContent = n
    ? `指の骨 ${n} 本を見つけました。左右は人形から見た左右です（人形の左手＝画面で正面から見て右側の手）。`
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
let lastPhoto = null;     // 最後に読み取った写真（重ねて見るとき・手の形に使う）

/** 画像（写真のファイル・貼り付けた画像）からポーズを読み取って、プレビューに出す */
async function readPoseFromImage(blob) {
  $('photoBox').hidden = false;
  $('photoMsg').textContent = '読み取り中…（初回は検出モデルの取得に少し時間がかかります）';
  $('photoApply').disabled = true;
  detected = null;
  try {
    const photo = await import('./photopose.js');
    const img = await photo.fileToImage(blob);
    const res = await photo.detectPose(img);
    if (!res) {
      $('photoMsg').textContent = '人物を見つけられませんでした。全身が大きく写った画像で試してください。';
      return;
    }
    photo.drawPreview($('photoCanvas'), img, res.image);
    const { dirs, missing, pts } = photo.landmarksToDirections(res.world);
    if (missing.length) {
      $('photoMsg').textContent = '肩か腰が写っていないため、姿勢を組み立てられませんでした。';
      return;
    }
    detected = dirs;
    lastPhoto = { img, lm: res.image, pts, hands: {} };
    $('photoApply').disabled = false;
    $('photoMsg').textContent = `${Object.keys(dirs).length} か所を読み取りました。手の形を探しています…`;
    // 手の 21 点（見つからなくても体のポーズはそのまま使える）
    try {
      const found = await photo.detectHands(img, res.image);
      for (const [sd, h] of Object.entries(found)) lastPhoto.hands[sd] = { ...photo.handToSpec(h.world, sd), image: h.image };
      photo.drawPreview($('photoCanvas'), img, res.image, found);
    } catch (e) { /* 手は読めなくてもよい */ }
    const hs = Object.keys(lastPhoto.hands).map(sd => (sd === 'L' ? '左手' : '右手'));
    $('photoMsg').textContent = `${Object.keys(dirs).length} か所を読み取りました。`
      + (hs.length ? `手の形も読み取りました（${hs.join('・')}。人形から見た左右）。` : '手の形は読み取れませんでした（手が小さい・隠れているときは体のポーズだけ当てます）。');
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    $('photoMsg').textContent = '読み取りに失敗しました: ' + msg;
  }
}

$('btnPhoto').addEventListener('click', () => {
  $('photoBox').hidden = false;
  $('photoMsg').textContent = '写真を選ぶか、Pinterest などでコピーした画像を貼り付けてください。';
  $('photoApply').disabled = true;
  detected = null;
  const cv = $('photoCanvas'); cv.width = cv.width;   // 前のプレビューを消す
});
$('photoChoose').addEventListener('click', () => $('photoFile').click());
$('photoClose').addEventListener('click', () => { $('photoBox').hidden = true; });

$('photoFile').addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (f) readPoseFromImage(f);
});

/** クリップボードの画像を取り出す（Safari は押したときにだけ読める。「ペースト」の確認が出る） */
async function pasteImage() {
  if (!navigator.clipboard || !navigator.clipboard.read) {
    $('photoMsg').textContent = 'このブラウザはボタンからの貼り付けに対応していません。画像を写真に保存して「写真を選ぶ」から選んでください。';
    return;
  }
  try {
    const items = await navigator.clipboard.read();
    for (const it of items) {
      const type = it.types.find(t => t.startsWith('image/'));
      if (type) { readPoseFromImage(await it.getType(type)); return; }
    }
    $('photoMsg').textContent = 'コピーされている画像がありません。Pinterest などで画像を長押しして「コピー」してから押してください。';
  } catch (err) {
    const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
    $('photoMsg').textContent = denied
      ? '貼り付けが許可されませんでした。もう一度押して、出てきた「ペースト」をタップしてください。'
      : '貼り付けに失敗しました: ' + (err && err.message ? err.message : err);
  }
}
$('photoPaste').addEventListener('click', pasteImage);

// キーボード（iPad の ⌘V など）での貼り付けも受け付ける（読み取りの窓が開いているとき）
document.addEventListener('paste', e => {
  if ($('photoBox').hidden) return;
  const files = e.clipboardData ? [...e.clipboardData.files] : [];
  const img = files.find(f => f.type.startsWith('image/'));
  if (img) { e.preventDefault(); readPoseFromImage(img); }
});

$('photoApply').addEventListener('click', () => {
  if (!detected) return;
  snapshot();
  const n = viewer.applyDetectedPose(detected);
  const rep = lastPhoto ? viewer.refineDetectedPose({ pts: lastPhoto.pts, hands: lastPhoto.hands }) : { contacts: [], hands: [] };
  syncSliders();
  $('photoBox').hidden = true;
  history.add({ name: '写真から', spec: toSpec(viewer.allAngles()) });
  buildHistory();
  // 写真を撮った向きから見る（写真の人の向きに合わせて人形を回してあるので、正面＝写真のカメラ）
  if (viewer.partView !== 'full') { viewer.setPartView('full', viewer.partSide); buildFrameChips(); }
  viewer.viewFromAngle(0, 0);
  showPhotoOverlay(true);
  const extra = [rep.contacts.length ? `手が触れている所を合わせました（${rep.contacts.join('・')}）` : '',
    rep.hands.length ? `指の形も写しました（${rep.hands.join('・')}）` : ''].filter(Boolean).join('。');
  showToast(`${n} か所の関節を写真に合わせました` + (extra ? '。' + extra : ''));
});

// ---- 写真を重ねて見る（人形と写真のずれを確かめ、関節を直接動かして直せる） ----
function alignPhotoOverlay() {
  const el = $('photoOverlay');
  if (!lastPhoto || el.hidden) return;
  const p = viewer.primarySlot;
  if (!p) return;
  const img = lastPhoto.img, W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const rect = viewer.canvas.getBoundingClientRect();
  const pairs = [[11, 'upperArmL'], [12, 'upperArmR'], [13, 'forearmL'], [14, 'forearmR'], [15, 'handL'], [16, 'handR'],
    [23, 'thighL'], [24, 'thighR'], [25, 'shinL'], [26, 'shinR'], [27, 'footL'], [28, 'footR']];
  const Q = [], P = [];
  for (const [i, k] of pairs) {
    const lm = lastPhoto.lm[i], b = p.boneMap[k];
    if (!lm || !b || (lm.visibility ?? 1) < 0.3) continue;
    const v = b.getWorldPosition(new THREE.Vector3()).project(viewer.camera);
    Q.push([lm.x * W, lm.y * H]);
    P.push([rect.left + (v.x + 1) / 2 * rect.width, rect.top + (1 - v.y) / 2 * rect.height]);
  }
  if (Q.length < 4) return;
  const mean = A => [A.reduce((s, a) => s + a[0], 0) / A.length, A.reduce((s, a) => s + a[1], 0) / A.length];
  const qm = mean(Q), pm = mean(P);
  let num = 0, den = 0;
  Q.forEach((q, i) => { const dq = [q[0] - qm[0], q[1] - qm[1]], dp = [P[i][0] - pm[0], P[i][1] - pm[1]]; num += dq[0] * dp[0] + dq[1] * dp[1]; den += dq[0] * dq[0] + dq[1] * dq[1]; });
  const sc = den > 0 ? num / den : 1;
  el.style.width = (W * sc) + 'px';
  el.style.height = (H * sc) + 'px';
  el.style.left = (pm[0] - qm[0] * sc) + 'px';
  el.style.top = (pm[1] - qm[1] * sc) + 'px';
}
function showPhotoOverlay(on) {
  const el = $('photoOverlay');
  if (on && lastPhoto) {
    if (el.src !== lastPhoto.img.src) el.src = lastPhoto.img.src;
    el.hidden = false;
    $('photoOverlayBar').hidden = false;
    $('photoOverlayToggle').textContent = '写真を消す';
    requestAnimationFrame(alignPhotoOverlay);
  } else {
    el.hidden = true;
    $('photoOverlayToggle').textContent = '写真を重ねる';
  }
}
$('photoOverlayToggle').addEventListener('click', () => {
  const on = $('photoOverlay').hidden;
  if (on) viewer.viewFromAngle(0, 0);
  showPhotoOverlay(on);
});
$('photoOverlayClose').addEventListener('click', () => { showPhotoOverlay(false); $('photoOverlayBar').hidden = true; });
// カメラを回したら写真とは合わなくなるので、写真の向きに戻すボタンで合わせ直す
$('photoOverlayView').addEventListener('click', () => { viewer.viewFromAngle(0, 0); requestAnimationFrame(alignPhotoOverlay); });
window.addEventListener('resize', () => setTimeout(alignPhotoOverlay, 350));

// ---- 保存したポーズ・画像の書き出し ------------------------------------------

// v67: 前の「保存したポーズ」は、マイポーズ（左のポーズ一覧の「マイ」と同じもの）にまとめた。前に保存した分は一度だけ移す
const SAVED_KEY = 'posit.saved.v1';
try {
  const old = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
  if (Array.isArray(old) && old.length && !localStorage.getItem('posit.savedMoved')) {
    importMyPoses(old.slice().reverse().map(o => ({ name: o.name, spec: o.spec, hands: o.hands, created: o.at })));
    localStorage.setItem('posit.savedMoved', '1');
  }
} catch (e) { /* 続行 */ }

function buildSaved() {
  const wrap = $('savedList');
  wrap.innerHTML = '';
  if (!myPoses.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'まだありません。「いまのポーズを保存」で名前を付けて残せます（左のポーズ一覧の「マイ」にも出ます）。';
    wrap.appendChild(p);
    return;
  }
  for (const it of myPoses) {
    const row = document.createElement('div');
    row.className = 'saved';
    const nm = document.createElement('button');
    nm.className = 'nm'; nm.innerHTML = poseThumbSVG(it.thumb) + '<span></span>';
    nm.querySelector('span').textContent = it.name;
    nm.addEventListener('click', () => { applyPose(it); showToast(it.name); });
    const tm = document.createElement('span');
    tm.className = 'tm'; tm.textContent = relativeTime(it.created);
    const sh = document.createElement('button');
    sh.className = 'ghost del'; sh.textContent = '送る';
    sh.addEventListener('click', () => shareMyPose(it));
    const del = document.createElement('button');
    del.className = 'ghost del'; del.textContent = '削除';
    del.addEventListener('click', () => {
      if (!window.confirm(`「${it.name}」を削除しますか？`)) return;
      myPoses = myPoses.filter(q => q.id !== it.id); saveMyPoses(); buildSaved();
    });
    row.append(nm, tm, sh, del);
    wrap.appendChild(row);
  }
}

$('btnSavePose').addEventListener('click', () => {
  const def = `マイポーズ ${myPoses.length + 1}`;
  const name = window.prompt('保存する名前', def);
  if (name === null) return;
  addMyPose(name.trim() || def);
  buildSaved();
  if (!$('posePop').hidden && popCat === 'mine') buildPosePop();
  showToast('保存しました（ポーズ一覧の「マイ」にも出ます）');
});
$('btnExportPoses').addEventListener('click', exportMyPoses);
$('btnImportPoses').addEventListener('click', () => $('myPoseFile').click());

/** いまの画面を PNG にして、共有シート（写真に保存など）かダウンロードで渡す */
/** 画像を共有シートで渡す（できなければダウンロード） */
async function shareImage(blob, name) {
  const file = new File([blob], name, { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Posit' });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  showToast('画像を書き出しました');
}

let shotBlob = null, shotName = '', shotURL = '';
async function exportImage(transparent = false) {
  drawGuides();
  const g = $('guides');
  const blob = await viewer.snapshotPNG(g.hidden ? null : g,
    transparent ? { transparent: true, shadow: settings.shotShadow, crop: settings.shotCrop } : {});
  if (!blob) { showToast('画像を作れませんでした'); return; }
  const d = new Date();
  const name = `posit-${transparent ? 'clear-' : ''}${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}.png`;
  if (!transparent) { await shareImage(blob, name); return; }
  // 透過の画像は、市松模様の上で抜けているのを確かめてから保存・コピーする
  if (shotURL) URL.revokeObjectURL(shotURL);
  shotBlob = blob; shotName = name; shotURL = URL.createObjectURL(blob);
  $('shotImg').src = shotURL;
  $('shotBox').hidden = false;
}
$('shotShare').addEventListener('click', () => { if (shotBlob) shareImage(shotBlob, shotName); });
$('shotCopy').addEventListener('click', async () => {
  if (!shotBlob) return;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': shotBlob })]);
    showToast('コピーしました。お絵描きアプリに貼り付けられます');
  } catch (e) {
    showToast('この端末ではコピーできませんでした。「保存・共有」を使ってください');
  }
});
$('shotClose').addEventListener('click', () => { $('shotBox').hidden = true; });
$('btnExportImg').addEventListener('click', () => exportImage(false));
$('btnExportClear').addEventListener('click', () => exportImage(true));
$('shotShadow').checked = settings.shotShadow;
$('shotCrop').checked = settings.shotCrop;
$('shotShadow').addEventListener('change', e => { settings.shotShadow = e.target.checked; saveSettings(); });
$('shotCrop').addEventListener('change', e => { settings.shotCrop = e.target.checked; saveSettings(); });

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
      // 一覧のポーズなら、いまの一覧の角度で（v53 で直したポーズは、前の履歴でも直った形で出る）
      const preset = it.poseId && POSE_PRESETS.find(p => p.id === it.poseId);
      viewer.applyPose(preset ? preset.spec : it.spec);
      if (preset) applyPoseHands(preset);
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
  { value: 'L', label: '人形の左だけ' },
  { value: 'R', label: '人形の右だけ' },
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
  if (cqSubject !== 'pose') {
    // 小物だけ・石膏像: 向き・高さ・レンズを変え、ライトは見る向きから横へずらす（陰影がはっきり出るように）
    // 像（胸像・全身像）は前から横くらいを、目の高さ近くから見る
    const bust = cqScenes.active && (cqScenes.active.kind === 'bust' || cqScenes.active.kind === 'statue');
    let az = settings.cqAngle === 'random' ? (bust ? rand(-130, 130) : rand(0, 360)) : (bust ? 0 : 30);
    if (settings.cqAngle === 'random' && lastAz !== null) for (let k = 0; k < 6 && Math.abs(((az - lastAz + 540) % 360) - 180) < 40; k++) az = bust ? rand(-130, 130) : rand(0, 360);
    lastAz = az;
    const el = settings.cqAngle === 'random' ? (bust ? rand(-4, 22) : rand(12, 48)) : (bust ? 6 : 25);
    const mm = settings.cqAngle === 'random' ? pick(bust ? [50, 70, 85] : [35, 50, 50, 70]) : 50;
    viewer.viewFromAngle(az, el, mm);
    cqScenes.lightFor(az);
    $('cqAngleText').textContent = bust ? angleLabel(az, el, mm) : `${mm}mm`;
    return;
  }
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

// 終わる前の合図（残り 3・2・1 秒で短い音。振動が使える端末は震わせる）
let audioCtx = null;
function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    // iOS は、ボタンを押したときに一度鳴らしておかないと、あとで音が出ない
    const o = audioCtx.createOscillator(), gn = audioCtx.createGain();
    gn.gain.value = 0.0001; o.connect(gn).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.02);
  } catch (e) { /* 音が出なくても続行 */ }
}
function beep(last) {
  try {
    if (navigator.vibrate) navigator.vibrate(last ? [90, 60, 90] : 40);
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator(), gn = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = last ? 1320 : 880;
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + (last ? 0.35 : 0.14));
    o.connect(gn).connect(audioCtx.destination);
    o.start(t); o.stop(t + 0.4);
  } catch (e) { /* 続行 */ }
}
let lastBeepSec = null;

// 小物だけ・石膏像（クロッキーの間だけ出す）
const cqScenes = new CroquisScenes(viewer);
// 小物の石膏像も、クロッキーと同じ読み込み（1 度読んだ形は使い回す）
props.statueLoader = key => (key.startsWith('solid:') ? cqScenes.solidTemplate(key.slice(6)) : cqScenes.loadStatue(key));
props.statueScale = { LeePerrySmith: 0.045 };
let cqSubject = 'pose';
const CQ_SUBJECTS = [
  { value: 'pose', label: '人物（ポーズ）' },
  { value: 'props', label: '小物だけ' },
  { value: 'plaster', label: '石膏像' },
];
const CQ_PLASTER_KINDS = [
  { value: 'all', label: 'すべて' },
  { value: 'statues', label: '幾何形体以外（胸像・頭像と全身像）' },
  { value: 'bust', label: '胸像・頭像' },
  { value: 'full', label: '全身像' },
  { value: 'solids', label: '幾何形体' },
];
// 像のスキャンを読み終えたら、カメラ・ライトを合わせ直して、記録の画像も撮り直す
cqScenes.onReady = () => {
  if (!croquis.running) return;
  croquisAngle();
  const k = cqLog.length - 1;
  setTimeout(() => { if (cqShots[k] && croquis.running) cqShots[k].canvas = viewer.captureThumb(360); }, 150);
};
const CQ_PROP_MODES = [
  { value: 'combo', label: '組み合わせ（1〜4個）' },
  { value: 'single', label: '1つずつ' },
];

const croquis = new CroquisSession({
  history,
  onPose: (pose, index) => {
    if (pose.subject) {
      // 小物だけ・石膏像
      cqLog.push(pose);
      lastBeepSec = null;
      cqScenes.show(pose);
      croquisAngle();
      $('cqName').textContent = pose.name;
      $('cqIndex').textContent = croquis.count > 0 ? `${index} / ${croquis.count}` : `${index} 枚目`;
      const k = cqLog.length - 1, nm = pose.name;
      cqShots[k] = { name: nm, canvas: null };
      setTimeout(() => { if (cqShots[k] && croquis.running) cqShots[k].canvas = viewer.captureThumb(360); }, 120);
      return;
    }
    cqLog.push(pose.id);
    croquisSetup();
    viewer.applyPose(pose.spec);
    applyPoseHands(pose);
    lastBeepSec = null;
    // ポーズごとに左右をランダムに反転（同じポーズでも違う向きで描ける）
    let mirrored = false;
    if (settings.cqMirror && Math.random() < 0.5) { viewer.mirrorPose(); mirrored = true; }
    cqMeta.mirror = mirrored;
    applyPoseProps(pose, mirrored);
    const hs = croquisHandShape();
    croquisAngle();
    history.add({ poseId: pose.id, name: pose.name + (cqMeta.mirror ? '（反転）' : ''), spec: cqMeta.mirror ? toSpec(viewer.allAngles()) : pose.spec });
    $('cqName').textContent = (hs ? hs.name : pose.name) + (cqMeta.mirror ? '（反転）' : '');
    $('cqIndex').textContent = croquis.count > 0 ? `${index} / ${croquis.count}` : `${index} 枚目`;
    // 記録の画像用に、出したときの見え方を小さく残す（画面の向き・反転も込み）
    const k = cqLog.length - 1, nm = $('cqName').textContent;
    cqShots[k] = { name: nm, canvas: null };
    setTimeout(() => { if (cqShots[k] && croquis.running) cqShots[k].canvas = viewer.captureThumb(360); }, 120);
  },
  onTick: (remain, total) => {
    const sec = Math.max(0, Math.ceil(remain / 1000));
    $('cqTime').textContent = String(sec);
    $('cqTime').classList.toggle('warn', sec <= 5);
    if (settings.cqBeep && !croquis.paused && sec <= 3 && sec >= 1 && sec !== lastBeepSec) {
      lastBeepSec = sec;
      beep(sec === 1);
    }
    $('cqFill').style.transform = `scaleX(${Math.max(0, Math.min(1, remain / total))})`;
  },
  onFinish: (done) => {
    stopCroquis();
    $('cqDoneText').textContent = `${done} 枚おつかれさまでした`;
    lastCqLog = cqLog.slice(0, done);
    lastCqShots = cqShots.slice(0, done);
    lastCqInfo = { at: new Date(), seconds: settings.seconds, done };
    buildCqLog();
    $('cqDone').hidden = false;
  },
});

let wakeLock = null;
// クロッキーで出たポーズの記録（終わったあとに一覧で見る・同じ順番でもう一度）
let cqLog = [], lastCqLog = [], cqReplay = null, cqShots = [], lastCqShots = [], lastCqInfo = null;
function buildCqLog() {
  const el = $('cqLog');
  el.innerHTML = '';
  lastCqLog.forEach((id, i) => {
    if (id && typeof id === 'object') {
      // 小物だけ・石膏像: 押すと、人形の前に小物として置く（「同じ順番でもう一度」で同じ物を出せる）
      const row = document.createElement('div');
      row.className = 'clRow';
      const b = document.createElement('button');
      b.className = 'clPick ghost';
      b.innerHTML = '<span></span>';
      b.querySelector('span').textContent = `${i + 1}. ${id.name}`;
      b.title = '画面に呼び出す（人形の横に小物として置きます）';
      b.addEventListener('click', () => { $('cqDone').hidden = true; recallScene(id); });
      row.appendChild(b);
      el.appendChild(row);
      return;
    }
    const p = POSE_PRESETS.find(x => x.id === id) || myPoses.find(x => x.id === id);
    if (!p) return;
    const row = poseRow(p, () => { $('cqDone').hidden = true; applyPose(p); }, 'clRow', 'clPick ghost');
    row.querySelector('span').textContent = `${i + 1}. ${p.name}`;
    el.appendChild(row);
  });
  $('cqAgain').hidden = !lastCqLog.length;
  $('cqSaveImg').hidden = !lastCqShots.some(x => x && x.canvas);
}
/**
 * クロッキーの記録から、小物だけ・石膏像の出題を呼び出す: 人形の横に、前をカメラへ向けて、自分で置いた小物として並べる。
 * いまある小物は片付ける（戻すで元に戻せる）
 */
async function recallScene(desc) {
  if (desc.kind === 'bust' && !desc.real) { showToast('この胸像は呼び出せません'); return; }
  snapshot();
  props.clear();
  const v = viewer, hips = v.primarySlot.boneMap.hips.getWorldPosition(new THREE.Vector3());
  // 人形の横（カメラから見て右）に、前（+z）をカメラへ向けて置く（人形と並べて見えるように）
  const cdir = v.camera.position.clone().sub(hips); cdir.y = 0;
  if (cdir.lengthSq() < 1e-6) cdir.set(0, 0, 1);
  cdir.normalize();
  const side = new THREE.Vector3().crossVectors(cdir, new THREE.Vector3(0, 1, 0)).negate();
  const O = hips.clone().addScaledVector(side, 1.1); O.y = 0;
  const yaw = Math.atan2(cdir.x, cdir.z);
  const R = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const at = (x, z) => new THREE.Vector3(x, 0, z).applyQuaternion(R).add(O);
  const put = (type, params, q, x, z, baseY, opts = {}) => {
    const p = at(x, z);
    const qq = R.clone().multiply(new THREE.Quaternion(...q));
    return props.addStill(type, params, qq.toArray(), p.x, p.z, baseY, { auto: false, ...opts });
  };
  const yq = deg => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deg * Math.PI / 180);
  const zq = deg => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), deg * Math.PI / 180);
  if (desc.subject === 'props') {
    let baseY = 0;
    if (desc.base) { put('table', { h: desc.base.h }, [0, 0, 0, 1], 0, 0, 0); baseY = desc.base.h; }
    for (const it of desc.items) put(it.type, it.params, it.q, it.x, it.z, baseY);
  } else if (desc.kind === 'solids') {
    if (desc.plinth) put('box', { size: 1, sx: 0.95 / 0.4, sy: desc.plinth / 0.4, sz: 0.7 / 0.4 }, [0, 0, 0, 1], 0, 0, 0);
    for (const so of desc.list) {
      const q = yq(so.yaw); if (so.lie) q.multiply(zq(90));
      put('solid', { sx: so.s, sy: so.s, sz: so.s }, q.toArray(), so.x, so.z, desc.plinth || 0, { variant: so.key, name: (SOLIDS.find(x => x.key === so.key) || {}).name });
    }
  } else {
    // 石膏像: 胸像・頭像は台に載せる
    const key = desc.kind === 'statue' ? desc.key : 'LeePerrySmith';
    const st = STATUES.find(x => x.key === key);
    const stand = desc.kind === 'statue' ? (st && st.kind === 'bust' ? desc.stand : 0) : desc.real.stand;
    await cqScenes.loadStatue(key);   // 大きさが分かってから並べる
    if (stand > 0.01) put('box', { size: 1, sx: 1, sy: stand / 0.4, sz: 0.9 }, [0, 0, 0, 1], 0, 0, 0);
    put('statue', {}, [0, 0, 0, 1], 0, 0, stand, { variant: key, name: st ? st.name.replace(/（.*$/, '') : '石膏像' });
  }
  props.select(null);
  // 石膏像の形ができるのを待つ（読み込み済みなら、すぐ）
  for (let k = 0; k < 20 && props.items.some(it => it.type === 'statue' && !it.statueMesh); k++) await new Promise(r => setTimeout(r, 50));
  // 呼び出した物の、人形に近い端が、人形の横の端（伸ばした手の先など）から 30cm 離れるように横へずらす
  v.scene.updateMatrixWorld(true);
  const dollExt = Math.max(0.25, ...Object.values(v.primarySlot.boneMap).map(b => b.getWorldPosition(new THREE.Vector3()).sub(hips).setY(0).dot(side))) + 0.08;
  const box = new THREE.Box3();
  for (const it of props.items) { it.group.updateWorldMatrix(true, true); box.expandByObject(it.group); }
  if (!box.isEmpty()) {
    const corners = [box.min, box.max].flatMap(a => [box.min, box.max].map(b => new THREE.Vector3(a.x, 0, b.z)));
    const near = Math.min(...corners.map(p => p.clone().sub(hips.clone().setY(0)).dot(side)));
    const shift = side.clone().multiplyScalar(dollExt + 0.3 - near);
    for (const it of props.items) { it.group.position.add(shift); it.group.updateWorldMatrix(true, true); }
    box.translate(shift);
  }
  // カメラ: 人形と呼び出した物が両方入るように
  const all = box.clone();
  // 人形の広がり: 骨の位置から（頭の上・手先まで少し足す）
  v.scene.updateMatrixWorld(true);
  for (const b of Object.values(v.primarySlot.boneMap)) all.expandByPoint(b.getWorldPosition(new THREE.Vector3()));
  all.max.y += 0.15; all.min.y = Math.min(all.min.y, 0);
  v.frameOverride = { center: all.getCenter(new THREE.Vector3()), radius: Math.max(0.8, all.getSize(new THREE.Vector3()).length() * 0.5 * 1.3) };
  v.viewFromAngle(yaw * 180 / Math.PI, 10, 50);
  v.frameOverride = null;
  showToast(`${desc.name}を呼び出しました（戻すで元に戻せます）`);
}

/** 描いたポーズを並べた 1 枚の画像（日付・秒数・枚数の見出し付き） */
function cqLogImage() {
  const shots = lastCqShots.filter(x => x && x.canvas);
  if (!shots.length) return null;
  const n = shots.length, cols = n <= 4 ? n : n <= 9 ? 3 : n <= 16 ? 4 : 5;
  const rows = Math.ceil(n / cols);
  const cw = 300, ch = Math.round(cw * shots[0].canvas.height / shots[0].canvas.width), cap = 34, pad = 14, head = 64;
  const c = document.createElement('canvas');
  c.width = pad + cols * (cw + pad);
  c.height = head + rows * (ch + cap + pad) + pad;
  const g = c.getContext('2d');
  g.fillStyle = '#15181d'; g.fillRect(0, 0, c.width, c.height);
  const d = lastCqInfo ? lastCqInfo.at : new Date(), pad2 = x => String(x).padStart(2, '0');
  g.fillStyle = '#e8eaee'; g.font = 'bold 24px -apple-system, "Hiragino Sans", sans-serif'; g.textBaseline = 'middle';
  g.fillText(`Posit クロッキー  ${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`, pad, head / 2);
  g.fillStyle = '#9aa3b2'; g.font = '18px -apple-system, "Hiragino Sans", sans-serif'; g.textAlign = 'right';
  if (lastCqInfo) g.fillText(`${lastCqInfo.seconds} 秒 × ${n} 枚`, c.width - pad, head / 2);
  g.textAlign = 'left';
  shots.forEach((s, i) => {
    const x = pad + (i % cols) * (cw + pad), y = head + Math.floor(i / cols) * (ch + cap + pad);
    g.drawImage(s.canvas, x, y, cw, ch);
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
    g.fillStyle = '#e8eaee'; g.font = '17px -apple-system, "Hiragino Sans", sans-serif';
    let t = `${i + 1}. ${s.name}`;
    while (g.measureText(t).width > cw - 4 && t.length > 4) t = t.slice(0, -2) + '…';
    g.fillText(t, x + 2, y + ch + cap / 2);
  });
  return c;
}
$('cqSaveImg').addEventListener('click', () => {
  const c = cqLogImage();
  if (!c) { showToast('画像を作れませんでした'); return; }
  c.toBlob(b => {
    if (!b) { showToast('画像を作れませんでした'); return; }
    const d = lastCqInfo ? lastCqInfo.at : new Date(), p2 = x => String(x).padStart(2, '0');
    shareImage(b, `posit-croquis-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}.png`);
  }, 'image/png');
});
$('cqAgain').addEventListener('click', () => { $('cqDone').hidden = true; cqReplay = lastCqLog.slice(); startCroquis(); });

let beforeCroquis = null;

async function startCroquis() {
  if (settings.cqBeep) unlockAudio();
  // クロッキーの間は小物を隠す（ポーズが毎回変わるので、手でつないだ小物が飛び回らないように）
  viewer.props.setHidden(true);
  if (viewer.hasSecond() && viewer.second.auto) { viewer.dropSecond(); syncDuo(); }
  document.body.classList.add('croquis');
  updateInsets();
  $('croquis').hidden = false;
  viewer.select(null);
  // 出題中だけ見え方を切り替え、終わったら戻す
  beforeCroquis = { view: viewer.viewMode, part: viewer.partView, side: viewer.partSide, wire: viewer.wireOn,
    cam: viewer.camera.position.clone(), target: viewer.controls.target.clone(),
    body: viewer.bodyType, hands: { ...viewer.handShape },
    material: viewer.materialMode, light: [viewer.lightAzimuth, viewer.lightElevation],
    angles: cqReplay || settings.cqSubject !== 'pose' ? JSON.parse(JSON.stringify(viewer.angles)) : null };
  lastAz = null;
  lastHandShape = null;
  $('lightPop').hidden = true;
  // 2 体目はクロッキーの間は出さない（終わったら戻す）
  viewer.setSecondHidden(true);
  // 描く物: 「同じ順番でもう一度」のときは前回と同じ物
  cqSubject = cqReplay && cqReplay.length && typeof cqReplay[0] === 'object' ? cqReplay[0].subject : cqReplay && cqReplay.length ? 'pose' : settings.cqSubject;
  if (cqSubject !== 'pose') {
    // 数えている間も人形は出さない（1 枚目から小物・石膏像だけ）。胸像のスキャンはこの間に読み込む
    viewer.setDollHidden(true);
    if (cqSubject === 'plaster') cqScenes.warm(settings.cqPlasterKind);
    // 小物だけ・石膏像: 素体（胸像は石膏の質感）で、全身の見え方。面の線は出さない
    if (viewer.viewMode !== 'skin') viewer.applyViewMode('skin');
    viewer.setPartView('full', viewer.partSide);
    viewer.setWireframe(false);
  } else {
    if (settings.cqModel !== viewer.viewMode) viewer.applyViewMode(settings.cqModel);
    if (settings.cqBody !== 'keep' && settings.cqBody !== 'random' && settings.cqBody !== viewer.bodyType) {
      viewer.setBodyType(settings.cqBody);
    }
    viewer.setPartView(settings.cqFrame, settings.cqSide === 'L' || settings.cqSide === 'R' ? settings.cqSide : viewer.partSide);
    // クロッキーの面の線は少なめ（短い時間で大きな面の向きをつかむため）。終わったらいつもの数に戻す
    viewer.setWireStyle(settings.wireMode, 0);
    viewer.setWireframe(settings.cqWire);
  }
  try {
    if (navigator.wakeLock && navigator.wakeLock.request) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (e) { /* 画面が消えても進行は続く */ }
  $('cqPause').textContent = '一時停止';
  // 始める前に 5 秒数える（紙と鉛筆を構える間）。「次へ」ですぐ始め、「一時停止」で止め、「終了」でやめる
  cqLog = []; cqShots = [];
  const sequence = cqReplay; cqReplay = null;
  cqCountdown(5, () => croquis.start({
    seconds: settings.seconds,
    count: settings.count,
    categories: settings.cqCats.length ? new Set(settings.cqCats) : null,
    extra: myPoses,
    sequence,
    gen: cqSubject === 'props' ? () => cqScenes.genProps(settings.cqPropMode)
      : cqSubject === 'plaster' ? () => cqScenes.genPlaster(settings.cqPlasterKind) : null,
  }));
}

let cqCount = null;   // { left, timer, paused, go }
function cqCountdown(sec, go) {
  cqCancelCount();
  cqCount = { left: sec, timer: null, paused: false, go };
  $('cqName').textContent = 'まもなく始まります';
  $('cqAngleText').textContent = '';
  $('cqIndex').textContent = '';
  $('cqFill').style.width = '0%';
  const show = () => {
    $('cqTime').textContent = String(cqCount.left);
    $('cqTime').classList.add('count');
  };
  const tick = () => {
    if (!cqCount || cqCount.paused) return;
    cqCount.left--;
    if (cqCount.left <= 0) { cqBeginNow(); return; }
    show();
    if (settings.cqBeep && cqCount.left <= 3) beep(false);
  };
  show();
  cqCount.timer = setInterval(tick, 1000);
}
function cqCancelCount() {
  if (cqCount && cqCount.timer) clearInterval(cqCount.timer);
  cqCount = null;
  $('cqTime').classList.remove('count');
}
function cqBeginNow() {
  if (!cqCount) return;
  const go = cqCount.go;
  cqCancelCount();
  if (settings.cqBeep) beep(true);
  go();
}

function stopCroquis() {
  cqCancelCount();
  cqScenes.clear();
  viewer.setSecondHidden(false);
  // 小物だけ・石膏像のときは人形のポーズを戻すので、その前からあった小物（ポーズに付いた物も）は残す
  viewer.props.clearAuto(cqSubject !== 'pose');
  viewer.props.setHidden(false);
  document.body.classList.remove('croquis');
  updateInsets();
  $('croquis').hidden = true;
  if (beforeCroquis) {
    viewer.applyViewMode(beforeCroquis.view);
    if (viewer.materialMode !== beforeCroquis.material) viewer.applyMaterialMode(beforeCroquis.material);
    viewer.setLightDirection(...beforeCroquis.light);
    // 石膏像の胸像で動かした首・頭の向きを、出題前のポーズに戻す
    if (beforeCroquis.angles && cqSubject !== 'pose') { for (const k in beforeCroquis.angles) viewer.angles[k] = beforeCroquis.angles[k]; viewer.applyAll(); }
    if (viewer.bodyType !== beforeCroquis.body) viewer.setBodyType(beforeCroquis.body);
    for (const sd of ['L', 'R']) {
      if (viewer.handShape[sd] !== beforeCroquis.hands[sd]) viewer.applyHandShape(sd, beforeCroquis.hands[sd] || '');
    }
    viewer.setPartView(beforeCroquis.part, beforeCroquis.side);
    viewer.setWireStyle(settings.wireMode, settings.wireDensity);
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
window.__posit.croquis = { settings, start: startCroquis, session: croquis, scenes: cqScenes, stop: () => croquis.finish() };
$('cqSkip').addEventListener('click', () => { if (cqCount) cqBeginNow(); else croquis.skip(); });
$('cqStop').addEventListener('click', () => { if (cqCount) { cqCancelCount(); stopCroquis(); } else croquis.finish(); });
$('cqPause').addEventListener('click', () => {
  if (cqCount) { cqCount.paused = !cqCount.paused; $('cqPause').textContent = cqCount.paused ? '再開' : '一時停止'; return; }
  croquis.togglePause();
  $('cqPause').textContent = croquis.paused ? '再開' : '一時停止';
});
$('cqDoneClose').addEventListener('click', () => { $('cqDone').hidden = true; });
$('cqWire').addEventListener('change', e => { settings.cqWire = e.target.checked; saveSettings(); });
$('cqHandShape').addEventListener('change', e => { settings.cqHandShape = e.target.checked; saveSettings(); });
$('cqMirror').addEventListener('change', e => { settings.cqMirror = e.target.checked; saveSettings(); });
$('cqBeep').addEventListener('change', e => { settings.cqBeep = e.target.checked; saveSettings(); if (e.target.checked) unlockAudio(); });

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

/** プルダウン（select）を作る。options: [{ value, label }]、cur: いまの値 */
function buildSelect(id, options, cur, onPick) {
  const sel = $(id);
  sel.innerHTML = '';
  for (const o of options) {
    const op = document.createElement('option');
    op.value = String(o.value);
    op.textContent = o.label;
    if (o.value === cur) op.selected = true;
    sel.appendChild(op);
  }
  sel.onchange = () => {
    const o = options.find(x => String(x.value) === sel.value);
    if (o) onPick(o);
  };
}

function buildCroquisChips() {
  const save = () => { saveSettings(); buildCroquisChips(); };
  buildSelect('cqSubject', CQ_SUBJECTS, settings.cqSubject, o => { settings.cqSubject = o.value; save(); });

  const sub = settings.cqSubject, pose = sub === 'pose';
  $('cqPropModeRow').hidden = sub !== 'props';
  buildSelect('cqPropMode', CQ_PROP_MODES, settings.cqPropMode, o => { settings.cqPropMode = o.value; save(); });
  $('cqPlasterKindRow').hidden = sub !== 'plaster';
  buildSelect('cqPlasterKind', CQ_PLASTER_KINDS, settings.cqPlasterKind, o => { settings.cqPlasterKind = o.value; save(); });
  $('cqSubjectHint').hidden = pose;
  $('cqSubjectHint').textContent = sub === 'props'
    ? (settings.cqPropMode === 'single' ? '小物を 1 つずつ、置き方・大きさ・見る向き・ライトを毎回変えて出します。人形は隠します。'
      : '小物を 1〜4 個、台の上か床に静物のように並べて出します。人形は隠します。')
    : '古代ギリシャ・ローマ〜19 世紀の彫刻（プラトン・アテナ・ヘルメス・トルヴァルセン・カルポーなど 16 体）の 3D スキャンを、白くつやのない石膏の質感にして出します。胸像・頭像は台に載せ、全身像は床に置きます。幾何形体（立方体・円柱・円すい・球・六角柱など）も選べます。見る向き・ライトは毎回変えます。像の出どころ・ライセンスは 設定 › 体とモデル › クレジット・ライセンス';
  // 人物のときだけの設定
  $('cqPoseOpts').hidden = !pose;
  for (const id of ['cqModelRow', 'cqFrameRow', 'cqWireRow']) $(id).hidden = !pose;

  buildSelect('cqSeconds', CROQUIS_SECONDS.map(s => ({ value: s, label: s >= 60 ? `${s / 60}分` : `${s}秒` })),
    settings.seconds, o => { settings.seconds = o.value; save(); });
  buildSelect('cqCounts', CROQUIS_COUNTS.map(c => ({ value: c, label: c === 0 ? '制限なし' : `${c}枚` })),
    settings.count, o => { settings.count = o.value; save(); });
  buildSelect('cqModel', VIEW_MODES.map(m => ({ value: m.key, label: m.name })),
    settings.cqModel, o => { settings.cqModel = o.value; save(); });
  buildSelect('cqFrame', FRAMES.map(f => ({ value: f.key, label: f.label })),
    settings.cqFrame, o => { settings.cqFrame = o.value; save(); });
  const sided = pose && (settings.cqFrame === 'hand' || settings.cqFrame === 'foot');
  $('cqSideRow').hidden = !sided;
  buildSelect('cqSide', CQ_SIDES, settings.cqSide, o => { settings.cqSide = o.value; save(); });
  $('cqHandShapeRow').hidden = !pose || settings.cqFrame !== 'hand';
  $('cqHandShape').checked = settings.cqHandShape;
  buildSelect('cqBody', CQ_BODIES, settings.cqBody, o => { settings.cqBody = o.value; save(); });
  buildSelect('cqAngle', CQ_ANGLES, settings.cqAngle, o => { settings.cqAngle = o.value; save(); });

  $('cqWire').checked = settings.cqWire;
  $('cqMirror').checked = settings.cqMirror;
  $('cqBeep').checked = settings.cqBeep;

  // カテゴリ（いくつでも選べる）: 開くと並ぶ。閉じているときは選んだ物の名前
  const cats = [...POSE_CATEGORIES.map(c => ({ value: c.key, label: c.name })), ...(myPoses.length ? [{ value: 'mine', label: 'マイポーズ' }] : [])];
  buildChips('cqCats', cats,
    o => settings.cqCats.includes(o.value),
    o => {
      const i = settings.cqCats.indexOf(o.value);
      if (i >= 0) settings.cqCats.splice(i, 1); else settings.cqCats.push(o.value);
      save();
    }, '');
  const chosen = cats.filter(c => settings.cqCats.includes(c.value)).map(c => c.label);
  $('cqCatsVal').textContent = !chosen.length ? '全部' : chosen.length <= 2 ? chosen.join('・') : `${chosen.slice(0, 2).join('・')} ほか${chosen.length - 2}`;
  // まとまりの中で最後に見えている行は、下の線を出さない
  for (const g of document.querySelectorAll('.cqGroup')) {
    const rows = [...g.children].filter(r => r.classList.contains('cqRow'));
    rows.forEach(r => r.classList.remove('lastShown'));
    const last = rows.filter(r => !r.hidden).pop();
    if (last) last.classList.add('lastShown');
  }
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
  try { buildBlockStyleChips(); } catch (e) { /* 起動の途中 */ }
  for (const [i, m] of VIEW_MODES.entries()) {
    // 骨格・筋肉のモデルが無くても、モデルのボーンから組み立てて出せるものは使える
    const ok = viewer.viewModeAvailable ? viewer.viewModeAvailable(m.key) : !m.show.every(k => !viewer.slots[k].loaded);
    if (!ok) $('viewChips').children[i].classList.add('missing');
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
    viewer.resetToDefault();        // はじめのポーズ（両手を広げる）
    syncSliders();
    takePoseFromURL();              // 送られたポーズの URL で開いたとき
    // 両手を広げると横に広いので、パネルの高さが決まってから、手の先まで画面に収める
    setTimeout(() => { updateInsets(); viewer.viewFromAngle(0, 4); }, 350);
  } catch (err) {
    if (window.__positShowError) {
      window.__positShowError('サンプルモデルを取得できませんでした。\n' + SAMPLE_URL
        + '\n' + (err && err.message ? err.message : err));
    }
  }
}

// ---- 骨・筋肉の名前を調べる ------------------------------------------------
//   タップした所の骨・筋肉の名前（日本語・ラテン語）と説明を出し、その部品を光らせる。
//   一覧から選んでも光る。左右は人形から見た左右。

const anatomyMod = { REGIONS };
let anatBefore = null;          // 名前を調べる前の見え方（やめたら戻す）
let anatKind = 'bone';
let anatRegion = '';

/** 名前のカードは、人形の頭にかぶらないよう、パネルのすぐ上に出す */
function placeAnatCard() {
  const card = $('anatCard');
  const o = viewer.insets || { bottom: 0, right: 0 };
  card.style.top = 'auto';
  card.style.bottom = (o.bottom + 8) + 'px';
  card.style.left = '10px';
  card.style.right = 'auto';
  if (o.right) card.style.width = `min(420px, calc(100vw - ${o.right + 20}px))`;
  else card.style.width = '';
}
function showAnatCard(nm) {
  const card = $('anatCard');
  placeAnatCard();
  if (!nm) {
    $('anatJa').textContent = '名前を調べる';
    $('anatLa').textContent = '';
    $('anatInfo').textContent = '';
    $('anatMore').innerHTML = '';
    $('anatHint').hidden = false;
    card.hidden = !viewer.pickMode || viewer.pickMode !== 'anatomy';
    return;
  }
  $('anatJa').textContent = nm.ja + (nm.part ? '' : '');
  $('anatLa').textContent = nm.la || '';
  $('anatInfo').textContent = nm.info || '';
  const dl = $('anatMore');
  dl.innerHTML = '';
  for (const [k, lab] of [['origin', '起始'], ['insertion', '停止'], ['action', 'はたらき']]) {
    if (!nm[k]) continue;
    const dt = document.createElement('dt'); dt.textContent = lab;
    const dd = document.createElement('dd'); dd.textContent = nm[k];
    dl.append(dt, dd);
  }
  $('anatHint').hidden = true;
  card.hidden = false;
}

function setAnatomyMode(on) {
  $('anatOn').checked = on;
  if (on) {
    viewer.select(null);
    viewer.pickMode = 'anatomy';
    // 骨も筋肉も見えていないときは、骨格を重ねて素体を透かす
    const muscleView = viewer.viewMode === 'muscle' || viewer.viewMode === 'overlay' || viewer.viewMode === 'bone';
    if (!muscleView && !viewer.boneViewOn) {
      anatBefore = { opacity: +$('skinOpacity').value };
      setCheck('boneView', true);
      setRange('skinOpacity', Math.min(+$('skinOpacity').value, 0.3));
    }
    showAnatCard(null);
    showToast('骨や筋肉をタップすると名前が出ます');
  } else {
    viewer.pickMode = 'joint';
    viewer.highlightAnatomy(null);
    $('anatCard').hidden = true;
    if (anatBefore) {
      setCheck('boneView', false);
      setRange('skinOpacity', anatBefore.opacity);
      anatBefore = null;
    }
  }
}
viewer.onAnatomy = nm => {
  showAnatCard(nm);
  if (!$('anatBox').hidden) buildAnatList();
};
viewer.onAnatomyChanged = () => { if (!$('anatBox').hidden) buildAnatList(); };
$('anatOn').addEventListener('change', e => setAnatomyMode(e.target.checked));

// 筋肉の色分け（筋肉ごとに違う色。腱は白のまま）
$('musclePal').checked = settings.musclePal;
viewer.setMusclePalette(settings.musclePal);
$('musclePal').addEventListener('change', e => {
  settings.musclePal = e.target.checked; saveSettings();
  viewer.setMusclePalette(settings.musclePal);
  const mv = viewer.viewMode === 'muscle' || viewer.viewMode === 'overlay';
  if (e.target.checked && !mv) {
    // 筋肉を出していなければ、筋肉の表示に切り替える
    if (viewer.applyViewMode('muscle')) buildViewChips();
  }
});
$('anatClose').addEventListener('click', () => setAnatomyMode(false));

let anatSelected = null;
function buildAnatList() {
  const all = viewer.anatomyIndex();
  const regs = anatomyMod ? anatomyMod.REGIONS : [];
  const q = kana($('anatSearch').value.trim());
  const kindList = all.filter(n => n.kind === anatKind);
  buildChips('anatRegions', [{ key: '', label: 'すべて' }, ...regs.filter(r => kindList.some(n => n.region === r.key)).map(r => ({ key: r.key, label: r.name }))],
    r => r.key === anatRegion, r => { anatRegion = r.key; buildAnatList(); });
  const list = kindList.filter(n => (!anatRegion || n.region === anatRegion)
    && (!q || kana(n.ja).includes(q) || kana(n.la).includes(q)));
  const order = new Map(regs.map((r, i) => [r.key, i]));
  list.sort((a, b) => (order.get(a.region) ?? 9) - (order.get(b.region) ?? 9));
  const wrap = $('anatList');
  wrap.innerHTML = '';
  for (const n of list) {
    const b = document.createElement('button');
    b.className = 'anatItem' + (anatSelected === n.key ? ' on' : '');
    const t = document.createElement('b'); t.textContent = n.ja;
    const l = document.createElement('span'); l.textContent = n.la;
    b.append(t, l);
    b.addEventListener('click', () => {
      anatSelected = n.key;
      if (viewer.pickMode !== 'anatomy') setAnatomyMode(true);
      viewer.highlightAnatomy(n.key);
      showAnatCard(n);
      $('anatBox').hidden = true;
    });
    wrap.appendChild(b);
  }
  const none = !all.length;
  $('anatBoxNote').textContent = none
    ? '骨格・筋肉がまだ組み立てられていません。「骨格を重ねる」か、表示するモデルで「筋肉」を選ぶと一覧が出ます。'
    : (anatKind === 'muscle' && !kindList.length
      ? '筋肉は、表示するモデルで「筋肉」か「重ねて」を選ぶと組み立てられて一覧に出ます。'
      : `${list.length} 件（左右は人形から見た左右）`);
}
function openAnatList() {
  // 骨格がまだなら組み立てる（一覧に出すため）
  if (!viewer.anatomyIndex().length) {
    if (viewer.pickMode !== 'anatomy') setAnatomyMode(true);
  }
  $('anatBox').hidden = false;
  buildAnatList();
}
$('btnAnatList').addEventListener('click', openAnatList);
$('anatListBtn').addEventListener('click', openAnatList);
$('anatBoxClose').addEventListener('click', () => { $('anatBox').hidden = true; });
$('anatBox').addEventListener('click', e => { if (e.target === $('anatBox')) $('anatBox').hidden = true; });
$('anatSearch').addEventListener('input', () => buildAnatList());
for (const b of document.querySelectorAll('#anatKind button')) {
  b.addEventListener('click', () => {
    anatKind = b.dataset.kind; anatRegion = '';
    for (const x of document.querySelectorAll('#anatKind button')) x.classList.toggle('on', x === b);
    buildAnatList();
  });
}

// ---- 補助線 -------------------------------------------------------------------
//   頭身の線 … 床から頭ひとつぶんごとの水平線（右に数字）
//   正中線   … 腰〜胸〜首〜頭をつなぐ体の中心の線（ポーズに付いてくる）
//   肩と腰の傾き … 左右の肩・左右の股関節を結んだ線を左右へ延ばす

function drawGuides() {
  const cv = $('guides');
  const any = settings.guideHeads || settings.guideCenter || settings.guideTilt;
  cv.hidden = !any || document.body.classList.contains('croquis') && !any;
  if (!any) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const p = viewer.primarySlot;
  if (!p || !p.skeleton) return;
  const cam = viewer.camera;
  const rect = viewer.canvas.getBoundingClientRect();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const scr = v => { const q = v.clone().project(cam); return { x: rect.left + (q.x + 1) / 2 * rect.width, y: rect.top + (1 - q.y) / 2 * rect.height, ok: q.z < 1 }; };
  const pos = k => (p.boneMap[k] ? p.boneMap[k].getWorldPosition(new THREE.Vector3()) : null);
  const line = (a, b, color, w = 1.5, dash = null) => {
    if (!a.ok || !b.ok) return;
    g.strokeStyle = color; g.lineWidth = w; g.setLineDash(dash || []);
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  };
  // 線を画面の端まで延ばす
  const extend = (a, b, k = 3) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    return [{ x: a.x - dx * k, y: a.y - dy * k, ok: true }, { x: b.x + dx * k, y: b.y + dy * k, ok: true }];
  };
  const hips = pos('hips');
  if (settings.guideHeads && hips) {
    const hh = viewer.visibleHeadHeight();
    const ratio = viewer.headRatio || viewer.baseHeadRatio || 7.5;
    // カメラの右向き（水平）に沿って、体の幅より少し長い線を引く
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0); right.y = 0;
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    // 頭頂（まっすぐ立ったときの高さ）から下へ、頭ひとつぶんごと。床の線も引く
    const crown = ratio * hh;
    const n = Math.floor(ratio + 1e-4);
    g.font = '600 12px -apple-system, sans-serif';
    const hline = (y, strong) => {
      const a = scr(V(hips.x, y, hips.z).addScaledVector(right, -0.42));
      const b = scr(V(hips.x, y, hips.z).addScaledVector(right, 0.42));
      line(a, b, strong ? 'rgba(255,196,77,0.9)' : 'rgba(255,196,77,0.55)', strong ? 1.6 : 1.1, strong ? null : [6, 5]);
    };
    for (let k = 0; k <= n; k++) hline(crown - k * hh, k === 0);
    if (crown - n * hh > hh * 0.08) hline(0, true);
    for (let k = 0; k < Math.ceil(ratio - 1e-4); k++) {
      const yc = crown - (k + 0.5) * hh;
      // 番号は線の左端に出す（右上の光の玉にかぶらないように）
      const mid = scr(V(hips.x, Math.max(yc, (crown - k * hh) / 2), hips.z).addScaledVector(right, -0.42));
      if (!mid.ok) continue;
      g.fillStyle = 'rgba(255,196,77,0.85)';
      g.textAlign = 'right';
      g.fillText(String(k + 1), mid.x - 6, mid.y + 4);
      g.textAlign = 'left';
    }
  }
  if (settings.guideCenter) {
    const keys = ['hips', 'spine', 'chest', 'neck', 'head'].filter(k => p.boneMap[k]);
    const pts = keys.map(k => scr(pos(k)));
    // 頭の上へ少し延ばす
    if (p.boneMap.head) {
      const hb = p.boneMap.head;
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(hb.getWorldQuaternion(new THREE.Quaternion()));
      pts.push(scr(pos('head').addScaledVector(up, viewer.visibleHeadHeight() * 0.7)));
    }
    // 腰の下（恥骨のあたり）まで延ばす
    if (p.boneMap.thighL && p.boneMap.thighR) {
      const m = pos('thighL').lerp(pos('thighR'), 0.5);
      pts.unshift(scr(m));
    }
    g.strokeStyle = 'rgba(120,220,255,0.9)'; g.lineWidth = 1.8; g.setLineDash([]);
    g.beginPath();
    pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
    g.stroke();
  }
  if (settings.guideTilt) {
    for (const [a, b, c] of [['upperArmL', 'upperArmR', 'rgba(255,120,160,0.9)'], ['thighL', 'thighR', 'rgba(160,255,140,0.9)']]) {
      const A = pos(a), B = pos(b);
      if (!A || !B) continue;
      const sa = scr(A), sb = scr(B);
      const [e1, e2] = extend(sa, sb, 0.6);
      line(e1, e2, c, 1.6);
      for (const q of [sa, sb]) { g.fillStyle = c; g.beginPath(); g.arc(q.x, q.y, 3, 0, Math.PI * 2); g.fill(); }
    }
  }
}
(function guideLoop() {
  requestAnimationFrame(guideLoop);
  if (settings.guideHeads || settings.guideCenter || settings.guideTilt) drawGuides();
  else if (!$('guides').hidden) $('guides').hidden = true;
})();
for (const id of ['guideHeads', 'guideCenter', 'guideTilt']) {
  $(id).checked = settings[id];
  $(id).addEventListener('change', e => { settings[id] = e.target.checked; saveSettings(); drawGuides(); });
}

// ---- カメラの向き（左右は人形から見た左右） --------------------------------------
const CAMS = [
  { label: '正面', az: 0, el: 4 },
  { label: '斜め前（左）', az: 40, el: 10 },
  { label: '斜め前（右）', az: -40, el: 10 },
  { label: '左横', az: 90, el: 3 },
  { label: '右横', az: -90, el: 3 },
  { label: '後ろ', az: 180, el: 6 },
  { label: '上から', az: 0, el: 68 },
  { label: '下から（あおり）', az: 15, el: -22 },
  { label: '真上', az: 0, el: 88 },
];
buildChips('camChips', CAMS, () => false, c => {
  viewer.viewFromAngle(c.az, c.el);
  showToast('カメラ: ' + c.label + (/[左右]/.test(c.label) ? '（人形から見て）' : ''));
}, '');

// ---- 各種コントロール ------------------------------------------------------

function bindRange(id, outId, fn, fmt) {
  const el = $(id), out = $(outId);
  const run = () => { const v = parseFloat(el.value); fn(v); out.textContent = fmt(v); };
  el.addEventListener('input', run);
  run();
}

bindRange('skinOpacity', 'outOpacity', v => viewer.setSkinOpacity(v), v => `${Math.round(v * 100)}%`);
// 面の線の太さと濃さ（端末に覚えておく）。動かしている間は線を出して見せる
bindRange('wireWidth', 'outWireW', v => {
  viewer.setWireWidth(v);
  if (settings.wireW !== v) { settings.wireW = v; saveSettings(); }
}, v => `×${+v.toFixed(2)}`);
bindRange('wireAlpha', 'outWireA', v => {
  viewer.setWireOpacity(v);
  if (settings.wireA !== v) { settings.wireA = v; saveSettings(); }
}, v => `${Math.round(v * 100)}%`);
for (const id of ['wireWidth', 'wireAlpha']) {
  $(id).addEventListener('pointerdown', () => { if (!$('wireOn').checked) setCheck('wireOn', true); });
}
// 面の線の数（少なめ = 四角の面 … とても多め = 三角形を 3 分割）と引き方（面の割れ／体に沿った輪切り）
const WIRE_DENSITIES = [
  { value: 0, label: '少なめ' }, { value: 1, label: 'ふつう' }, { value: 2, label: '多め' }, { value: 3, label: 'とても多め' },
];
const WIRE_MODES = [
  { value: 'mesh', label: '面の割れに沿う' }, { value: 'lattice', label: '体に沿った輪切り' },
];
function buildWireChips() {
  viewer.setWireStyle(settings.wireMode, settings.wireDensity);
  const pick = () => { saveSettings(); buildWireChips(); if (!$('wireOn').checked) setCheck('wireOn', true); };
  buildChips('wireDensityChips', WIRE_DENSITIES, o => settings.wireDensity === o.value, o => { settings.wireDensity = o.value; pick(); });
  buildChips('wireModeChips', WIRE_MODES, o => settings.wireMode === o.value, o => { settings.wireMode = o.value; pick(); });
}
buildWireChips();
setRange('wireWidth', settings.wireW);
setRange('wireAlpha', settings.wireA);
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
  { key: 'window', label: '窓辺',     az: 80,  el: 25,  int: 4,   fill: 0.55, env: 0.6,  soft: 8,   exp: 1 },
  { key: 'spot',   label: 'スポット', az: 10,  el: 70,  int: 12,  fill: 0,    env: 0.03, soft: 0.6, exp: 1 },
  { key: 'rembr',  label: '斜め45°',  az: 45,  el: 45,  int: 6,   fill: 0.08, env: 0.12, soft: 1.5, exp: 1 },
];
let lightPreset = 'std';

function applyLightPreset(p, quiet) {
  lightPreset = p.key;
  setRange('lightInt', intToPos(p.int));
  setRange('fillInt', p.fill);
  setRange('envInt', p.env);
  setRange('shadowSoft', p.soft);
  setRange('exposure', p.exp);
  const a = p.az * Math.PI / 180, e = p.el * Math.PI / 180;
  lightBall.setFromView(new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)));
  buildLightPresets();
  if (!quiet) showToast('ライト: ' + p.label);
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
  if (setPager) setPager.go(2);
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
const SIDES = [{ key: 'L', label: '人形の左' }, { key: 'R', label: '人形の右' }];

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
    b => { if (b.key !== viewer.bodyType) snapshot(); viewer.setBodyType(b.key); buildBodyChips(); viewer.rebuildBoneViews(); });
}

function syncHeadRatio() {
  const el = $('headRatio');
  const base = viewer.baseHeadRatio;
  el.value = Math.max(3, Math.min(9, base)).toFixed(1);
  $('outHead').textContent = (+el.value).toFixed(1);
}
let headEditing = false;   // 頭身のつまみを動かしている間（動かし始めに 1 回だけ「戻す」に積む）
$('headRatio').addEventListener('input', e => {
  if (!headEditing) { headEditing = true; snapshot(); }
  const r = parseFloat(e.target.value);
  $('outHead').textContent = r.toFixed(1);
  viewer.setHeadRatio(r);
});
$('headRatio').addEventListener('change', () => { headEditing = false; viewer.rebuildBoneViews(); });
$('btnHeadReset').addEventListener('click', () => {
  snapshot();
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

$('btnReset').addEventListener('click', () => { snapshot(); viewer.resetToDefault(); syncSliders(); showToast('はじめのポーズ（両手を広げる）に戻しました'); });
$('btnMirror').addEventListener('click', () => {
  snapshot();
  viewer.mirrorPose();
  viewer.props.mirrorAll();
  syncSliders();
  history.add({ name: '左右反転', spec: toSpec(viewer.allAngles()) });
  buildHistory();
});
$('btnResetJoint').addEventListener('click', () => { snapshot(); viewer.resetSelected(); syncSliders(); });
$('btnFrame').addEventListener('click', () => viewer.frameModel());

// ---- すべての設定を初期値に戻す ---------------------------------------------
//   履歴・保存したポーズ・読み込んだモデルはそのまま。ポーズ・小物・2 体目・見え方・体つき・ライト・カメラ・
//   クロッキーの設定・パネルの高さを、はじめて開いたときの状態に戻す（小物・2 体目は消す）

function setCheck(id, on) {
  const el = $(id);
  el.checked = on;
  el.dispatchEvent(new Event('change'));    // 画面の印と中身がずれていても必ず当て直す
}

function resetAllSettings() {
  if (!window.confirm('すべての設定とポーズを初期値に戻しますか？\n小物と 2 体目も消します。\n（履歴・保存したポーズ・読み込んだモデルはそのままです。ポーズ・小物・2 体目は「1つ戻す」で戻せます）')) return;
  // ポーズと手の形も戻す（写真から当てたポーズも含む）。小物と 2 体目は消す
  snapshot();
  props.slideMode = false;
  props.clear();
  if (viewer.hasSecond()) viewer.removeSecond();
  syncDuo();
  viewer.resetToDefault();
  showPhotoOverlay(false); $('photoOverlayBar').hidden = true;
  // クロッキーとパネルの設定
  Object.assign(settings, defaultSettings());
  saveSettings();
  setSheetStage(0);
  setAnatomyMode(false);
  for (const id of ['guideHeads', 'guideCenter', 'guideTilt']) $(id).checked = false;
  // 体つき
  viewer.setBodyType('neutral');
  viewer.resetHeadRatio();
  syncHeadRatio();
  // 見え方
  if (viewer.slots.skin && viewer.slots.skin.loaded) viewer.applyViewMode('skin');
  viewer.applyMaterialMode('clay');
  setRange('skinOpacity', 1);
  setCheck('wireOn', false);
  buildWireChips();
  setRange('wireWidth', 1);
  setRange('wireAlpha', 0.85);
  setCheck('headPlanes', false);
  setCheck('boneView', false);
  setCheck('musclePal', false);
  setCheck('canonRest', true);
  setCheck('limitsOn', true);
  setCheck('ringsOn', true);
  setCheck('pullOn', true);
  setCheck('dotsOn', false);
  settings.dotsUser = false; saveSettings();
  setCheck('shotShadow', false);
  setCheck('shotCrop', true);
  // 見る範囲とカメラ（ライトの向きはカメラが基準なので先に戻す）
  viewer.setPartView('full', 'R');
  setRange('lens', 40);
  viewer.frameModel();
  setCheck('gridOn', true);
  // ライトと影
  applyLightPreset(LIGHT_PRESETS[0], true);
  setCheck('lightBallOn', true);
  $('lightPop').hidden = true;
  // 画面の表示を合わせる
  buildFrameChips();
  buildBodyChips();
  buildViewChips();
  buildMaterialChips();
  buildCroquisChips();
  syncSliders();
  if (window.__positRelayout) window.__positRelayout();
  $('helpBox').hidden = true;
  showToast('すべての設定を初期値に戻しました');
}
for (const id of ['btnResetAll', 'btnResetAll2']) $(id).addEventListener('click', resetAllSettings);

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
buildSaved();
syncSliders();
setSheetStage(0, false);
updateInsets();
loadSample();

$('buildTag').textContent = 'バージョン ' + BUILD;
mark('UI構築');
// 古いファイルが混ざっていないか（app.js と viewer.js の版が違う）。混ざっていたら、1 度だけキャッシュを消して読み直す
if (Viewer.BUILD !== BUILD) {
  let tried = false;
  try { tried = sessionStorage.getItem('posit.fixBuild') === BUILD; sessionStorage.setItem('posit.fixBuild', BUILD); } catch (e) { tried = true; }
  if (!tried) {
    (async () => {
      try {
        if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
        if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
      } catch (e) { /* 続行 */ }
      location.replace(location.pathname + '?r=' + Date.now());
    })();
  } else if (window.__positShowError) {
    window.__positShowError(`古いファイルが残っています（app.js ${BUILD} / viewer.js ${Viewer.BUILD || '不明'}）。\n`
      + 'GitHub に viewer.js も上げたか確かめて、「？」→「キャッシュを消して再読込」を押してください。');
  }
}
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

// ===== app.js ここまで =====
