// ============ ECHO COURIER — localStorage save system ============
const KEY = 'echo-courier-save-v1';

const DEFAULTS = {
  unlocked: 1,          // highest playable level (1-20)
  completed: [],        // level ids completed
  muted: false,
  totalDeliveries: 0,
  totalKills: 0,
};

export class SaveSystem {
  constructor() {
    this.data = { ...DEFAULTS };
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = { ...DEFAULTS, ...parsed };
        if (!Array.isArray(this.data.completed)) this.data.completed = [];
        this.data.unlocked = Math.min(20, Math.max(1, this.data.unlocked | 0));
      }
    } catch (e) {
      console.warn('Save load failed, using defaults', e);
      this.data = { ...DEFAULTS };
    }
    return this.data;
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Save write failed', e);
    }
  }

  isCompleted(id) { return this.data.completed.includes(id); }
  isUnlocked(id) { return id <= this.data.unlocked; }

  completeLevel(id) {
    if (!this.data.completed.includes(id)) this.data.completed.push(id);
    if (id < 20 && this.data.unlocked < id + 1) this.data.unlocked = id + 1;
    this.save();
  }

  setMuted(m) { this.data.muted = m; this.save(); }

  addStats({ deliveries = 0, kills = 0 }) {
    this.data.totalDeliveries += deliveries;
    this.data.totalKills += kills;
    this.save();
  }

  resetProgress() {
    this.data.unlocked = 1;
    this.data.completed = [];
    this.save();
  }
}
