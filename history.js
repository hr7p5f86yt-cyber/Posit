// history.js — 直近のポーズ履歴（端末内に保存）
const KEY = 'posit.history.v1';
export const HISTORY_LIMIT = 30;

export class PoseHistory {
  constructor() { this.items = this._load(); }

  _load() {
    try {
      const raw = localStorage.getItem(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.slice(0, HISTORY_LIMIT) : [];
    } catch (e) {
      return [];
    }
  }

  _save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.items)); } catch (e) { /* 保存できなくても続行 */ }
  }

  /** @param {{poseId?:string, name:string, spec:string}} entry */
  add(entry) {
    if (!entry || !entry.name) return;
    const top = this.items[0];
    if (top && top.spec === entry.spec) return;      // 直前と同じなら足さない
    this.items.unshift({
      poseId: entry.poseId || '',
      name: entry.name,
      spec: entry.spec || '',
      at: Date.now(),
    });
    if (this.items.length > HISTORY_LIMIT) this.items.length = HISTORY_LIMIT;
    this._save();
  }

  /** 直近で使ったポーズID（クロッキーの重複回避に使う） */
  recentIds(n = HISTORY_LIMIT) {
    const out = new Set();
    for (const it of this.items.slice(0, n)) if (it.poseId) out.add(it.poseId);
    return out;
  }

  clear() { this.items = []; this._save(); }
}

/** 1758950000000 のような時刻を「3分前」「昨日 14:05」のように書く */
export function relativeTime(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}時間前`;
  const d = new Date(ts);
  const day = Math.floor(hour / 24);
  const hhmm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (day === 1) return `昨日 ${hhmm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hhmm}`;
}
