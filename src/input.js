// ============ ECHO COURIER — keyboard + touch input ============
export class Input {
  constructor() {
    this.keys = new Set();
    this.pulseQueued = false;    // edge-triggered
    this.pauseQueued = false;
    this.muteQueued = false;
    this.interactQueued = false;
    this.joystick = { x: 0, y: 0, active: false };
    this.touchBoost = false;
    this.laserHeld = false;
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.code;
      this.keys.add(k);
      if (k === 'Space' || k === 'KeyE') { this.pulseQueued = true; this.interactQueued = true; e.preventDefault(); }
      if (k === 'Escape') this.pauseQueued = true;
      if (k === 'KeyM') this.muteQueued = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.laserHeld = false; });

    // manual laser — hold left mouse button (never auto-fires)
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.laserHeld = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.laserHeld = false;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    if (this.isTouch) this.setupTouch();
  }

  setupTouch() {
    const zone = document.getElementById('joystick-zone');
    const base = document.getElementById('joystick-base');
    const stick = document.getElementById('joystick-stick');
    const btnPulse = document.getElementById('btn-pulse');
    const btnBoost = document.getElementById('btn-boost');
    if (!zone) return;

    let touchId = null;
    const radius = 55;

    const setStick = (dx, dy) => {
      stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    };
    const handle = (t) => {
      const r = base.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = t.clientX - cx;
      let dy = t.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > radius) { dx = (dx / len) * radius; dy = (dy / len) * radius; }
      setStick(dx, dy);
      this.joystick.x = dx / radius;
      this.joystick.y = dy / radius;
      this.joystick.active = true;
    };

    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      touchId = t.identifier;
      handle(t);
    }, { passive: false });
    zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === touchId) handle(t);
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === touchId) {
          touchId = null;
          this.joystick.x = 0; this.joystick.y = 0; this.joystick.active = false;
          setStick(0, 0);
        }
      }
    };
    zone.addEventListener('touchend', end);
    zone.addEventListener('touchcancel', end);

    btnPulse.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.pulseQueued = true;
      this.interactQueued = true;
    }, { passive: false });
    const btnLaser = document.getElementById('btn-laser');
    if (btnLaser) {
      btnLaser.addEventListener('touchstart', (e) => { e.preventDefault(); this.laserHeld = true; }, { passive: false });
      btnLaser.addEventListener('touchend', () => { this.laserHeld = false; });
      btnLaser.addEventListener('touchcancel', () => { this.laserHeld = false; });
    }
    btnBoost.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchBoost = true; }, { passive: false });
    btnBoost.addEventListener('touchend', () => { this.touchBoost = false; });
    btnBoost.addEventListener('touchcancel', () => { this.touchBoost = false; });
  }

  // movement axes: x = strafe/turn, y = forward(+)/back(-)
  getAxes() {
    let x = 0, y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.joystick.active) {
      x += this.joystick.x;
      y += -this.joystick.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  get boost() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchBoost;
  }

  consumePulse() { const p = this.pulseQueued; this.pulseQueued = false; return p; }
  consumePause() { const p = this.pauseQueued; this.pauseQueued = false; return p; }
  consumeMute() { const p = this.muteQueued; this.muteQueued = false; return p; }
  consumeInteract() { const p = this.interactQueued; this.interactQueued = false; return p; }
  clearTransient() { this.pulseQueued = false; this.pauseQueued = false; this.interactQueued = false; this.laserHeld = false; }
}
