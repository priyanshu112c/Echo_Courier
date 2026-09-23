// ============ ECHO COURIER — main game orchestration (20-level campaign) ============
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { ParticleSystem } from './particles.js';
import { Player } from './player.js';
import { World } from './world.js';
import { EchoPulse } from './pulse.js';
import { CameraRig } from './cameraRig.js';
import { UI } from './ui.js';
import { SaveSystem } from './save.js';
import { LEVELS, getLevel } from './levels.js';
import { DayNight } from './daynight.js';
import { EnemyManager } from './enemies.js';
import { LaserSystem } from './laser.js';
import { SignalWarden } from './boss.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: true, powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CONFIG.CAM_FOV, window.innerWidth / window.innerHeight, 0.1, 900);

    this.save = new SaveSystem();
    this.ui = new UI();
    this.input = new Input();
    this.audio = new AudioEngine();
    this.world = new World(this.scene);
    this.dayNight = new DayNight(this);
    this.particles = new ParticleSystem(this.scene);
    this.player = new Player(this.scene);
    this.pulse = new EchoPulse(this.scene);
    this.camRig = new CameraRig(this.camera);
    this.enemies = new EnemyManager(this.scene, this);
    this.laser = new LaserSystem(this.scene, this);
    this.boss = null;

    this.state = 'title';
    this.level = null;
    this.objectives = [];
    this.energy = CONFIG.ENERGY_MAX;
    this.hp = CONFIG.HP_MAX;
    this.invuln = 0;
    this.hasCapsule = false;
    this.levelKills = 0;
    this.levelFragments = 0;
    this.levelReveals = 0;
    this.levelDeliveries = 0;
    this.pulsesUsed = 0;
    this.playTime = 0;
    this.boostWasOn = false;
    this.muted = this.save.data.muted;
    this._objKey = '';

    this.player.spawnAt(0, 40, 0);
    this.player.mesh.canister.material = this.player.mesh.canister.material.clone();

    this.clock = new THREE.Clock();
    this.time = 0;
    this._speedTrailTimer = 0;

    this.bindUI();
    this.setupTitle();

    window.addEventListener('resize', () => this.onResize());
    this.ui.ready();
    this.audio.setMuted(this.muted);
    this.ui.setMuted(this.muted);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  bindUI() {
    const click = (id, fn) => document.getElementById(id).addEventListener('click', () => {
      this.audio.start();
      this.audio.resume();
      this.audio.playUIClick();
      fn();
    });
    click('btn-newgame', () => this.startLevel(1));
    click('btn-continue', () => this.startLevel(this.save.data.unlocked));
    click('btn-levels', () => this.openLevelSelect());
    click('btn-settings', () => this.toggleMute());
    click('btn-resume', () => this.resumeGame());
    click('btn-audio', () => this.toggleMute());
    click('btn-quit', () => this.toTitle());
    click('btn-levels-back', () => this.setupTitle());
    click('btn-lc-continue', () => this.nextLevel());
    click('btn-lc-levels', () => this.openLevelSelect());
    click('btn-lc-title', () => this.toTitle());
    click('btn-again', () => this.startLevel(1));
    click('btn-lc-continue2', () => this.openLevelSelect());
    click('btn-title2', () => this.toTitle());
    this.ui.el.muteBtn.addEventListener('click', () => {
      this.audio.start();
      this.toggleMute();
    });
  }

  toggleMute() {
    this.muted = !this.muted;
    this.audio.setMuted(this.muted);
    this.save.setMuted(this.muted);
    this.ui.setMuted(this.muted);
    for (const id of ['btn-audio', 'btn-settings']) {
      const b = document.getElementById(id);
      if (b) b.textContent = this.muted ? 'AUDIO: OFF' : 'AUDIO: ON';
    }
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ---------------- title / menus ----------------
  setupTitle() {
    this.state = 'title';
    this.ui.showScreen('title');
    this.ui.showMobileControls(false);
    this.ui.setBoss(false);
    this.ui.setContinueVisible(this.save.data.unlocked > 1 || this.save.data.completed.length > 0);
    const s = document.getElementById('btn-settings');
    if (s) s.textContent = this.muted ? 'AUDIO: OFF' : 'AUDIO: ON';
    this.camRig.startCinematic((t, cam) => {
      const a = t * 0.08;
      cam.position.set(Math.cos(a) * 90, 34 + Math.sin(t * 0.2) * 4, Math.sin(a) * 90);
      cam.lookAt(0, 8, 0);
      return false;
    });
  }

  openLevelSelect() {
    this.ui.showLevelSelect(LEVELS, this.save, (id) => this.startLevel(id));
  }

  // ---------------- level lifecycle ----------------
  resetWorldState() {
    for (const t of this.world.towers) { t.state = 'dormant'; t.revealTimer = 0; }
    for (const f of this.world.fragments) {
      f.taken = false;
      f.mesh.visible = true;
      f.mesh.material.opacity = f.hidden ? 0 : 1;
      f.revealTimer = 0;
    }
    for (const h of this.world.hidden) { h.revealTimer = 0; if (h.kind !== 'fragment') h.everRevealed = false; }
    for (const b of this.world.bridges) if (b.hidden) { b.revealAmount = 0; b.everRevealed = false; }
    this.world.cityBrightness = 0;
  }

  buildObjectives(level) {
    this.objectives = level.objectives.map((o) => ({
      ...o,
      progress: 0,
      done: false,
      label: o.label || o.type,
    }));
  }

  objProgress(type, n = 1) {
    for (const o of this.objectives) {
      if (o.type !== type || o.done) continue;
      o.progress = Math.min(o.count ?? 1, o.progress + n);
      if (o.progress >= (o.count ?? 1)) o.done = true;
    }
    this.refreshObjectiveHUD();
    this.checkLevelComplete();
  }

  refreshObjectiveHUD() {
    const key = JSON.stringify(this.objectives.map((o) => [o.done, o.progress]));
    if (key === this._objKey) return;
    this._objKey = key;
    let activeSet = false;
    for (const o of this.objectives) {
      o.active = !o.done && !activeSet;
      if (o.active) activeSet = true;
    }
    this.ui.setObjectives(this.objectives);
  }

  checkLevelComplete() {
    if (this.state !== 'playing') return;
    if (!this.objectives.every((o) => o.done)) return;
    this.completeLevel();
  }


  // ---------------- level lifecycle ----------------
  startLevel(id) {
    const level = getLevel(id);
    this.level = level;
    this.resetWorldState();
    this.buildObjectives(level);
    this._objKey = '';

    this.energy = CONFIG.ENERGY_MAX;
    this.hp = CONFIG.HP_MAX;
    this.invuln = 0;
    this.hasCapsule = false;
    this.levelKills = 0;
    this.levelFragments = 0;
    this.levelReveals = 0;
    this.levelDeliveries = 0;
    this.pulsesUsed = 0;
    this.playTime = 0;
    this.player.spawnAt(0, 40, 0);

    // enemies
    this.enemies.onKill = (type) => {
      this.levelKills++;
      this.objProgress('destroy');
      this.save.addStats({ kills: 1 });
    };
    this.enemies.reset(level.enemies, level.difficulty);
    if (this.boss) { this.scene.remove(this.boss.group); this.boss = null; }
    if (level.boss) this.boss = new SignalWarden(this.scene, this);
    this.ui.setBoss(false, 1);

    // atmosphere
    this.dayNight.set(level.time, true);

    // UI
    this.ui.showScreen(null);
    this.ui.setLevelHeader(level.id, level.name);
    this.ui.setNetwork((level.id - 1) * 5);
    this.ui.setCapsule(false);
    this.ui.setHP(this.hp, CONFIG.HP_MAX);
    this.refreshObjectiveHUD();
    this.ui.showMobileControls(this.input.isTouch);
    this.input.clearTransient();
    this.laser.setFiring(false);

    // intro cinematic sweep
    this.state = 'intro';
    const p = this.player.pos;
    const startPos = new THREE.Vector3(p.x + 30, 42, p.z + 46);
    const endPos = new THREE.Vector3(p.x, CONFIG.CAM_HEIGHT, p.z + CONFIG.CAM_DIST);
    this.camRig.startCinematic((t, cam) => {
      const k = Math.min(1, t / 3.0);
      const e = 1 - Math.pow(1 - k, 3);
      cam.position.lerpVectors(startPos, endPos, e);
      cam.lookAt(p.x, 2, p.z - 6);
      if (k >= 1) {
        this.state = 'playing';
        this.camRig.snapBehind(this.player.pos, this.player.heading);
        this.ui.toast(`LEVEL ${level.id} — ${level.name}`, 3000);
        const hint = level.hint || '';
        if (hint) setTimeout(() => this.ui.toast(hint, 3400), 3100);
        if (level.boss && this.boss) this.beginBossIntro();
        return true;
      }
      return false;
    });
  }

  nextLevel() {
    const next = this.level ? this.level.id + 1 : 1;
    if (next > 20) { this.setupTitle(); return; }
    this.startLevel(next);
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.showScreen('pause');
    this.audio.stopEngineSound();
    this.audio.stopLaser();
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.showScreen(null);
    this.input.clearTransient();
    this.clock.getDelta();
  }

  toTitle() {
    this.audio.stopEngineSound();
    this.audio.stopLaser();
    this.enemies.reset({}, 1);
    if (this.boss) { this.scene.remove(this.boss.group); this.boss = null; }
    this.ui.setBoss(false);
    this.setupTitle();
  }

  // ---------------- player health ----------------
  damagePlayer(dmg) {
    if (this.invuln > 0 || this.state !== 'playing') return;
    this.hp = Math.max(0, this.hp - dmg);
    this.invuln = CONFIG.CONTACT_INVULN;
    this.audio.playHurt();
    this.ui.flashDamage();
    this.camRig.addShake(0.4);
    this.ui.setHP(this.hp, CONFIG.HP_MAX);
    if (this.hp <= 0) this.handleDown();
  }

  handleDown() {
    this.ui.toast('SIGNAL LOST — REBOOTING…', 3000);
    this.hp = CONFIG.HP_MAX;
    this.hasCapsule = false;
    this.ui.setCapsule(false);
    this.ui.setHP(this.hp, CONFIG.HP_MAX);
    this.player.spawnAt(0, 40, 0);
    this.camRig.snapBehind(this.player.pos, this.player.heading);
    for (const e of [...this.enemies.active]) {
      if (e.pos.distanceTo(this.player.pos) < 30) this.enemies.kill(e);
    }
  }


  // ---------------- boss sequence ----------------
  beginBossIntro() {
    this.state = 'bossintro';
    this.ui.toast('⚠ WARNING — SIGNAL SOURCE DETECTED', 3200);
    this.audio.playBossRoar();
    const p = this.boss.group.position.clone();
    this.camRig.startCinematic((t, cam) => {
      const k = Math.min(1, t / 5.0);
      const a = 2.4 + t * 0.5;
      const r = 40 - k * 18;
      cam.position.set(p.x + Math.cos(a) * r, 10 + (1 - k) * 14, p.z + Math.sin(a) * r);
      cam.lookAt(p.x, 8, p.z);
      if (t > 2.2 && !this.boss.active) {
        this.boss.spawn();
        this.ui.setBoss(true, 1);
      }
      if (k >= 1) {
        this.state = 'playing';
        this.camRig.snapBehind(this.player.pos, this.player.heading);
        this.ui.setBoss(true, 1);
        this.ui.toast('THE SIGNAL WARDEN — HOLD LMB / LASER TO FIGHT', 3600);
        return true;
      }
      return false;
    });
  }

  onBossDefeated() {
    this.objProgress('boss');
  }

  // ---------------- laser targeting hook ----------------
  findLaserTarget(origin, dir, maxDist) {
    const hit = this.enemies.raycast(origin, dir, maxDist);
    if (hit) {
      const point = origin.clone().addScaledVector(dir, hit.dist);
      return { point, applyDamage: (d) => this.enemies.damage(hit.enemy, d, point) };
    }
    if (this.boss && this.boss.active) {
      // generous cone check so the hover-bike can track the huge Warden
      const toB = this.boss.group.position.clone().sub(origin);
      const dist = toB.length();
      if (dist < maxDist * 1.25) {
        const ang = toB.normalize().angleTo(dir);
        if (ang < 0.42) {                 // ~24° cone
          const point = this.boss.group.position.clone();
          return { point, applyDamage: (d) => {
            this.boss.applyDamage(d);
            this.particles.burst(point, 4, { color: 0xffee88, speed: 5, spread: 1, life: 0.3, size: 1.1 });
          } };
        }
      }
    }
    return null;
  }


  // ---------------- gameplay update ----------------
  updatePlaying(dt) {
    this.playTime += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    const p = this.player;
    const axes = this.input.getAxes();

    if (this.input.consumePause()) { this.pauseGame(); return; }
    if (this.input.consumeMute()) this.toggleMute();

    // ----- movement -----
    const groundFn = (x, z) => this.world.getGroundInfo(x, z);
    const ev = p.update(dt, axes, this.input.boost, this.world.colliders, groundFn);
    if (ev === 'fall') {
      this.audio.playFall();
      this.ui.toast('SIGNAL LOST — rerouting…');
      this.energy = Math.max(0, this.energy - CONFIG.RESPAWN_ENERGY_PENALTY);
      this.damagePlayer(6);
    } else if (ev === 'respawn') {
      p.respawn();
      this.camRig.snapBehind(p.pos, p.heading);
    }

    // ----- boost feedback -----
    if (p.boosting && !this.boostWasOn) {
      this.audio.playBoost();
      this.camRig.addShake(0.35);
    }
    this.boostWasOn = p.boosting;

    // speed particles
    this._speedTrailTimer -= dt;
    if (p.speed > 6 && this._speedTrailTimer <= 0) {
      this._speedTrailTimer = p.boosting ? 0.016 : 0.045;
      const back = p.heading;
      this.particles.spawn(
        p.pos.x + Math.sin(back) * 1.6 + (Math.random() - 0.5) * 0.5,
        p.pos.y + 0.5,
        p.pos.z + Math.cos(back) * 1.6 + (Math.random() - 0.5) * 0.5,
        {
          vx: Math.sin(back) * 4, vz: Math.cos(back) * 4, vy: 0.6,
          spread: 0.25, speed: 2, life: p.boosting ? 0.8 : 0.5,
          size: p.boosting ? 1.5 : 0.9,
          color: p.boosting ? 0xffb454 : 0x28e7ff,
        }
      );
    }

    // ----- laser (manual hold only) -----
    this.laser.setFiring(this.input.laserHeld);
    this.laser.update(dt);

    // ----- energy regen -----
    this.energy = Math.min(CONFIG.ENERGY_MAX, this.energy + CONFIG.ENERGY_REGEN * dt);


    // ----- recharge stations: energy + capsule + HP -----
    for (const st of this.world.stations) {
      const d = st.pos.distanceTo(p.pos);
      if (d < CONFIG.STATION_RADIUS) {
        this.energy = Math.min(CONFIG.ENERGY_MAX, this.energy + CONFIG.STATION_ENERGY_RATE * dt);
        if (this.hp < CONFIG.HP_MAX) {
          this.hp = Math.min(CONFIG.HP_MAX, this.hp + CONFIG.HP_REGEN_STATION * dt);
          this.ui.setHP(this.hp, CONFIG.HP_MAX);
        }
        if (!this.hasCapsule && this.objectives.some((o) => o.type === 'deliver' && !o.done)) {
          this.hasCapsule = true;
          this.audio.playCapsule();
          this.ui.setCapsule(true);
          this.ui.toast('ENERGY CAPSULE ACQUIRED');
          const t = this.world.nearestInactiveTower(p.pos);
          if (t) this.ui.toast(`Deliver it to Signal Tower ${t.name}`, 2400);
          this.particles.burst(new THREE.Vector3(p.pos.x, p.pos.y + 1.5, p.pos.z), 24,
            { color: 0xffb454, speed: 4, spread: 1, life: 0.9, size: 1.6 });
        }
        if (Math.random() < dt * 20) {
          this.particles.spawn(
            st.pos.x + (Math.random() - 0.5) * 4, 0.4, st.pos.z + (Math.random() - 0.5) * 4,
            { vy: 3, spread: 0.3, speed: 1, life: 0.8, size: 1.2, color: 0xffb454, gravity: -2 }
          );
        }
      }
    }

    // ----- energy fragments -----
    for (const f of this.world.fragments) {
      if (f.taken) continue;
      const visible = !f.hidden || f.revealTimer > 0 || f.mesh.material.opacity > 0.4;
      if (!visible) continue;
      if (f.pos.distanceTo(p.pos) < CONFIG.FRAGMENT_RADIUS) {
        f.taken = true;
        f.mesh.visible = false;
        this.levelFragments++;
        this.energy = Math.min(CONFIG.ENERGY_MAX, this.energy + CONFIG.FRAGMENT_ENERGY);
        this.hp = Math.min(CONFIG.HP_MAX, this.hp + 5);
        this.ui.setHP(this.hp, CONFIG.HP_MAX);
        this.audio.playPickup();
        this.particles.burst(f.pos, 16, { color: 0x28e7ff, speed: 5, spread: 1, life: 0.7, size: 1.5 });
        this.ui.toast(`+${CONFIG.FRAGMENT_ENERGY} ECHO ENERGY`, 1400);
        this.objProgress('fragments');
      }
    }

    // ----- reach objectives -----
    for (const o of this.objectives) {
      if (o.type !== 'reach' || o.done) continue;
      if (Math.hypot(p.pos.x - o.x, p.pos.z - o.z) < (o.r || 8)) {
        this.audio.playObjective();
        this.ui.toast('LOCATION REACHED', 1800);
        this.objProgress('reach');
      }
    }


    // ----- delivery / pulse (shared key: delivery takes priority) -----
    let deliverTower = null;
    if (this.hasCapsule) {
      for (const t of this.world.towers) {
        if (t.state !== 'active' && t.pos.distanceTo(p.pos) < CONFIG.DELIVER_RADIUS) {
          deliverTower = t;
          break;
        }
      }
    }
    const pressed = this.input.consumePulse();
    if (deliverTower) {
      this.ui.prompt(this.input.isTouch ? 'PULSE — DELIVER CAPSULE' : 'E / SPACE — DELIVER CAPSULE');
      if (pressed) this.deliver(deliverTower);
    } else {
      this.ui.prompt(null);
      if (pressed) this.firePulse();
    }

    // ----- enemies & boss -----
    this.enemies.update(dt, p);
    if (this.boss) {
      if (this.boss.active && this.state === 'playing') {
        this.boss.update(dt, p);
        this.ui.setBoss(true, this.boss.hpFrac);
      } else if (this.boss.dead) {
        if (this.boss.updateDeath(dt)) {
          this.boss = null;
          this.ui.setBoss(false);
          this.onBossDefeated();
        }
      }
    }

    // engine audio follows speed
    this.audio.updateEngine(p.speed / CONFIG.BOOST_SPEED, p.boosting);

    // HUD
    this.ui.setEnergy(this.energy, CONFIG.ENERGY_MAX, this.pulse.cooldownFrac);
  }

  firePulse() {
    if (!this.pulse.ready) { this.audio.playDenied(); return; }
    if (this.energy < CONFIG.PULSE_COST) {
      this.audio.playDenied();
      this.ui.toast('NOT ENOUGH ECHO ENERGY', 1500);
      return;
    }
    this.energy -= CONFIG.PULSE_COST;
    this.pulsesUsed++;
    this.pulse.tryFire(this.player.pos, this.energy);
    this.audio.playPulse();
    this.camRig.addShake(0.5);
    this.world.pulseFlash();
    const revealed = this.world.revealPulse(this.player.pos, CONFIG.PULSE_RADIUS);
    const exposed = this.enemies.revealFrom(this.player.pos, CONFIG.PULSE_RADIUS);
    if (revealed + exposed > 0) this.objProgress('reveal', revealed + exposed);
    this.particles.ringBurst(this.player.pos, 90, {
      color: 0x28e7ff, speed: 16, life: 1.4, size: 1.8, drag: 1.1, brightness: 1.4,
    });
    this.particles.burst(new THREE.Vector3(this.player.pos.x, this.player.pos.y + 1, this.player.pos.z),
      20, { color: 0x9ff5ff, speed: 6, spread: 1, life: 0.8, size: 1.4 });
    if (revealed > 0) this.ui.toast(`${revealed} SIGNAL${revealed > 1 ? 'S' : ''} LOCATED`, 1800);
  }

  deliver(tower) {
    this.hasCapsule = false;
    tower.state = 'active';
    tower.revealTimer = 1e9;   // stay revealed permanently
    this.levelDeliveries++;
    this.ui.setCapsule(false);
    this.audio.playTowerActivate();
    this.camRig.addShake(0.4);
    this.energy = Math.min(CONFIG.ENERGY_MAX, this.energy + 30);

    const top = tower.pos.clone(); top.y = 14;
    this.particles.burst(top, 60, { color: 0xffffff, speed: 8, spread: 1, life: 1.6, size: 2, gravity: 2 });
    this.particles.ringBurst(tower.pos, 50, { color: 0xffb454, speed: 10, life: 1.2, size: 1.6 });

    this.ui.toast(`SIGNAL TOWER ${tower.name} ONLINE`);
    this.audio.playObjective();
    this.save.addStats({ deliveries: 1 });
    this.ui.setNetwork((this.level.id / 20) * 100);
    this.objProgress('deliver');
  }

  // ---------------- level completion ----------------
  completeLevel() {
    const level = this.level;
    if (level.id >= 20) { this.completeCampaign(); return; }
    this.state = 'levelcomplete';
    this.laser.setFiring(false);
    this.audio.stopEngineSound();
    this.audio.playComplete();
    this.save.completeLevel(level.id);

    const mins = Math.floor(this.playTime / 60);
    const secs = Math.floor(this.playTime % 60).toString().padStart(2, '0');
    const reward = `TIME ${mins}:${secs} · PULSES ${this.pulsesUsed} · FRAGMENTS ${this.levelFragments} · KILLS ${this.levelKills}`;
    this.ui.showLevelComplete(level, this.objectives, reward);
    this.ui.showMobileControls(false);
    this.ui.setBoss(false);
  }

  completeCampaign() {
    this.state = 'completing';
    this.save.completeLevel(20);
    this.ui.prompt(null);
    this.laser.setFiring(false);
    this.audio.playComplete();
    this.audio.completionMode = true;
    this.audio.stopEngineSound();

    const p = this.player.pos.clone();
    this.camRig.startCinematic((t, cam) => {
      const dur = 6.5;
      const k = Math.min(1, t / dur);
      this.world.cityBrightness = k * 1.1;
      const a = t * 0.35;
      const r = 16 + t * 4.5;
      cam.position.set(p.x + Math.cos(a) * r, 5 + t * 4.5, p.z + Math.sin(a) * r);
      cam.lookAt(p.x, 3 + t * 2, p.z);
      if (Math.random() < 0.5) {
        const ang = Math.random() * Math.PI * 2;
        const rr = 10 + Math.random() * 40;
        this.particles.spawn(p.x + Math.cos(ang) * rr, 1, p.z + Math.sin(ang) * rr, {
          vy: 8 + Math.random() * 8, spread: 0.2, speed: 1, life: 2.4, size: 2,
          color: Math.random() < 0.5 ? 0x28e7ff : 0xff2ea6, gravity: -1,
        });
      }
      if (k >= 1) {
        this.state = 'complete';
        const mins = Math.floor(this.playTime / 60);
        const secs = Math.floor(this.playTime % 60).toString().padStart(2, '0');
        this.ui.setCompleteStats(
          `TIME ${mins}:${secs} · PULSES ${this.pulsesUsed} · FRAGMENTS ${this.levelFragments} · KILLS ${this.levelKills}`
        );
        this.ui.showScreen('complete');
        this.ui.showMobileControls(false);
        return true;
      }
      return false;
    });
  }


  // ---------------- frame loop ----------------
  frame() {
    try {
      this.frameInner();
    } catch (err) {
      if (!this._errLogged) { this._errLogged = true; console.error('[EchoCourier]', err); }
    }
  }

  frameInner() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

    if (this.state === 'playing') {
      this.updatePlaying(dt);
    } else if (this.state === 'intro' || this.state === 'completing' || this.state === 'bossintro') {
      // idle player hover animation during cinematics
      this.player.update(0.0001, { x: 0, y: 0 }, false, this.world.colliders,
        (x, z) => this.world.getGroundInfo(x, z));
      if (this.state === 'bossintro' && this.boss && !this.boss.active) {
        this.boss.time += dt;
      }
    } else if (this.state === 'paused') {
      if (this.input.consumePause()) this.resumeGame();
    } else {
      this.input.clearTransient();
    }

    // world & fx always animate (even behind menus for a living background)
    if (this.state !== 'paused') {
      this.world.update(dt, this.camera);
      this.dayNight.update(dt);
      this.pulse.update(dt);
      this.particles.update(dt);
    }
    this.camRig.update(dt, this.player);

    // carried capsule indicator on backpack
    const cm = this.player.mesh.canister.material;
    const target = this.hasCapsule ? 0xffb454 : 0x28e7ff;
    if (cm.emissive.getHex() !== target) cm.emissive.setHex(target);

    this.renderer.render(this.scene, this.camera);
  }
}

// boot
try {
  window.__game = new Game();
} catch (err) {
  const el = document.querySelector('.loading-text');
  if (el) el.textContent = 'FAILED TO START: ' + err.message;
  console.error(err);
}

