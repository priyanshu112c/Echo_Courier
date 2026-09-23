// ============ ECHO COURIER — DOM HUD & screens ============
export class UI {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      hud: $('hud'),
      objective: $('hud-objective'),
      networkPercent: $('network-percent'),
      networkFill: $('network-fill'),
      energyFill: $('energy-fill'),
      energyCooldown: $('energy-cooldown'),
      energyText: $('energy-text'),
      capsule: $('capsule-indicator'),
      prompt: $('prompt'),
      toast: $('toast'),
      muteBtn: $('mute-btn'),
      mobileControls: $('mobile-controls'),
      screens: {
        title: $('screen-title'),
        pause: $('screen-pause'),
        complete: $('screen-complete'),
        levels: $('screen-levels'),
        levelcomplete: $('screen-levelcomplete'),
      },
      completeStats: $('complete-stats'),
      fade: $('fade-overlay'),
      loading: $('loading'),
    };
    this._toastTimer = null;
    this._promptText = null;
  }

  ready() {
    this.el.loading.classList.add('hidden');
    requestAnimationFrame(() => this.el.fade.classList.add('clear'));
  }

  showScreen(name) {
    for (const [k, el] of Object.entries(this.el.screens)) {
      el.classList.toggle('hidden', k !== name);
    }
    this.el.hud.classList.toggle('hidden', name === 'title');
    if (name === null) this.el.hud.classList.remove('hidden');
  }

  showMobileControls(show) {
    this.el.mobileControls.classList.toggle('hidden', !show);
  }

  setObjective(text, done = false) {
    this.el.objective.textContent = '▸ ' + text;
    this.el.objective.classList.toggle('done', done);
  }

  setNetwork(pct) {
    this.el.networkPercent.textContent = Math.round(pct) + '%';
    this.el.networkFill.style.width = pct + '%';
  }

  setEnergy(cur, max, cooldownFrac) {
    const pct = Math.max(0, Math.min(1, cur / max));
    this.el.energyFill.style.width = (pct * 100) + '%';
    this.el.energyFill.classList.toggle('low', pct < 0.28);
    this.el.energyCooldown.style.width = (cooldownFrac * 100) + '%';
    this.el.energyText.textContent = `${Math.round(cur)} / ${max}`;
  }

  setCapsule(carrying) {
    this.el.capsule.textContent = carrying ? '◈ CAPSULE READY' : '◈ NO CAPSULE';
    this.el.capsule.classList.toggle('carrying', carrying);
    this.el.capsule.classList.toggle('empty', !carrying);
  }

  prompt(text) {
    if (text === this._promptText) return;
    this._promptText = text;
    if (text) {
      this.el.prompt.textContent = text;
      this.el.prompt.classList.remove('hidden');
    } else {
      this.el.prompt.classList.add('hidden');
    }
  }

  toast(text, dur = 2600) {
    this.el.toast.textContent = text;
    this.el.toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.el.toast.classList.add('hidden'), dur);
  }

  setMuted(m) {
    this.el.muteBtn.classList.toggle('muted', m);
  }

  setCompleteStats(text) {
    this.el.completeStats.textContent = text;
  }

  // ---------- v2: level HUD ----------
  $(id) { return document.getElementById(id); }

  setLevelHeader(id, name) {
    this.$('hud-level').textContent = 'LEVEL ' + String(id).padStart(2, '0');
    this.$('hud-mission-name').textContent = name;
  }

  setObjectives(objectives) {
    const box = this.$('hud-objectives');
    if (!box) return;
    box.innerHTML = '';
    for (const o of objectives) {
      const div = document.createElement('div');
      div.className = 'obj' + (o.done ? ' done' : (o.active ? ' active' : ''));
      const mark = o.done ? '✓' : '□';
      div.innerHTML = `<span class="box">${mark}</span><span>${o.label}${o.count ? ` (${o.progress}/${o.count})` : ''}</span>`;
      box.appendChild(div);
    }
  }

  setHP(cur, max) {
    const f = this.$('hp-fill');
    if (!f) return;
    const pct = Math.max(0, Math.min(1, cur / max));
    f.style.width = (pct * 100) + '%';
    f.classList.toggle('low', pct < 0.3);
  }

  setBoss(visible, frac = 1) {
    const bar = this.$('boss-bar');
    if (!bar) return;
    bar.classList.toggle('hidden', !visible);
    this.$('boss-fill').style.width = (Math.max(0, frac) * 100) + '%';
  }

  flashDamage() {
    const v = this.$('damage-vignette');
    if (!v) return;
    v.style.opacity = '1';
    clearTimeout(this._dmgTimer);
    this._dmgTimer = setTimeout(() => { v.style.opacity = '0'; }, 160);
  }

  showLevelComplete(level, objectives, rewardText) {
    this.$('lc-level').textContent = `LEVEL ${String(level.id).padStart(2, '0')} — ${level.name}`;
    const box = this.$('lc-objectives');
    box.innerHTML = '';
    for (const o of objectives) {
      const div = document.createElement('div');
      div.className = 'obj';
      div.textContent = o.label;
      box.appendChild(div);
    }
    this.$('lc-rewards').textContent = rewardText;
    this.showScreen('levelcomplete');
  }

  showLevelSelect(levels, save, onSelect) {
    const grid = this.$('level-grid');
    grid.innerHTML = '';
    levels.forEach((lv) => {
      const cell = document.createElement('div');
      const done = save.isCompleted(lv.id);
      const unlocked = save.isUnlocked(lv.id);
      cell.className = 'level-cell' + (done ? ' done' : '') + (unlocked ? '' : ' locked');
      cell.innerHTML = `<span class="num">${unlocked ? String(lv.id).padStart(2, '0') : '🔒'}</span><span class="name">${lv.name}</span>`;
      if (unlocked) cell.addEventListener('click', () => { this.audio?.playUIClick?.(); onSelect(lv.id); });
      grid.appendChild(cell);
    });
    this.showScreen('levels');
  }

  setContinueVisible(v) {
    this.$('btn-continue').classList.toggle('hidden', !v);
  }
}
