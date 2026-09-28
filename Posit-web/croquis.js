// croquis.js — 30秒ドローイング（クロッキー）の進行
import { POSE_PRESETS } from './poses.js';

export const CROQUIS_SECONDS = [30, 45, 60, 90, 120, 300];
export const CROQUIS_COUNTS = [5, 10, 20, 0];   // 0 = 制限なし

export class CroquisSession {
  /**
   * @param {{history:import('./history.js').PoseHistory,
   *          onPose:(pose:object, index:number)=>void,
   *          onTick:(remain:number, total:number)=>void,
   *          onFinish:(count:number)=>void}} deps
   */
  constructor(deps) {
    this.history = deps.history;
    this.onPose = deps.onPose || (() => {});
    this.onTick = deps.onTick || (() => {});
    this.onFinish = deps.onFinish || (() => {});

    this.running = false;
    this.paused = false;
    this.seconds = 30;
    this.count = 10;
    this.categories = null;      // null = 全カテゴリ
    this.index = 0;
    this.used = new Set();
    this._timer = null;
    this._deadline = 0;
    this._remain = 0;
  }

  /** 候補のうち、履歴と今回で未使用のものから選ぶ。尽きたら今回分だけ除外して選び直す */
  _pick() {
    let pool = POSE_PRESETS;
    if (this.categories && this.categories.size) {
      pool = pool.filter(p => this.categories.has(p.category));
    }
    if (!pool.length) pool = POSE_PRESETS;

    const recent = this.history ? this.history.recentIds() : new Set();
    let candidates = pool.filter(p => !this.used.has(p.id) && !recent.has(p.id));
    if (!candidates.length) candidates = pool.filter(p => !this.used.has(p.id));
    if (!candidates.length) { this.used.clear(); candidates = pool; }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  start(config = {}) {
    this.seconds = config.seconds || this.seconds;
    this.count = config.count === undefined ? this.count : config.count;
    this.categories = config.categories || null;
    this.index = 0;
    this.used = new Set();
    this.running = true;
    this.paused = false;
    this._next();
    this._timer = setInterval(() => this._tick(), 100);
  }

  _next() {
    if (this.count > 0 && this.index >= this.count) { this.finish(); return; }
    const pose = this._pick();
    if (!pose) { this.finish(); return; }
    this.used.add(pose.id);
    this.index += 1;
    this._remain = this.seconds * 1000;
    this._deadline = performance.now() + this._remain;
    this.onPose(pose, this.index);
    this.onTick(this._remain, this.seconds * 1000);
  }

  _tick() {
    if (!this.running || this.paused) return;
    const remain = this._deadline - performance.now();
    this._remain = remain;
    if (remain <= 0) { this._next(); return; }
    this.onTick(remain, this.seconds * 1000);
  }

  skip() { if (this.running) this._next(); }

  setPaused(on) {
    if (!this.running) return;
    this.paused = on;
    if (!on) this._deadline = performance.now() + Math.max(this._remain, 0);
  }

  togglePause() { this.setPaused(!this.paused); }

  finish() {
    const done = this.index;
    this.running = false;
    this.paused = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this.onFinish(done);
  }
}
