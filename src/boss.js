// ============ ECHO COURIER — LEVEL 20 FINAL VILLAIN: THE SIGNAL WARDEN ============
import * as THREE from 'three';

const CORE_RED = 0xff2255;

export class SignalWarden {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.maxHp = 1600;
    this.hp = this.maxHp;
    this.phase = 1;
    this.active = false;
    this.dead = false;
    this.exposed = 0;          // vulnerability window (phase 3)
    this.boltTimer = 2;
    this.novaTimer = 6;
    this.summonTimer = 8;
    this.chargeTimer = 0;
    this.charging = false;
    this.chargeDir = new THREE.Vector3();
    this.dying = 0;
    this.time = 0;

    this.pos = new THREE.Vector3(0, 5.5, 20);
    this.build();
    this.group.position.copy(this.pos);

    this._pool = [];
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 8),
        new THREE.MeshBasicMaterial({ color: CORE_RED })
      );
      m.visible = false;
      scene.add(m);
      this._pool.push({ mesh: m, vel: new THREE.Vector3(), active: false, damage: 10 });
    }
  }

  build() {
    const g = new THREE.Group();
    this.group = g;
    const metal = new THREE.MeshStandardMaterial({ color: 0x1a1428, roughness: 0.35, metalness: 0.9 });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x22060f, emissive: CORE_RED, emissiveIntensity: 1.6, roughness: 0.2,
    });
    this.coreMat = coreMat;

    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), coreMat);
    g.add(this.core);

    this.plates = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 0.5), metal);
      plate.position.set(Math.cos(a) * 3.2, Math.sin(a * 2) * 0.8, Math.sin(a) * 3.2);
      plate.lookAt(0, 0, 0);
      g.add(plate);
      this.plates.push(plate);
    }

    this.rings = [];
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(4.4 + i * 0.9, 0.18, 8, 40),
        new THREE.MeshBasicMaterial({ color: i === 1 ? 0xff2ea6 : CORE_RED, transparent: true, opacity: 0.7 }));
      ring.rotation.set(i * 1.1, i * 0.7, 0);
      g.add(ring);
      this.rings.push(ring);
    }

    for (const s of [-1, 1]) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.35, 3.4, 6), metal);
      spike.position.set(s * 1.2, 3.4, 0);
      spike.rotation.z = s * 0.25;
      g.add(spike);
    }

    const light = new THREE.PointLight(CORE_RED, 14, 40, 1.6);
    g.add(light);
    this.light = light;

    this.scene.add(g);
  }

  spawn() {
    this.active = true;
    this.group.visible = true;
    this.game.audio.playBossRoar();
  }

  get hpFrac() { return this.hp / this.maxHp; }

  applyDamage(dmg) {
    if (!this.active || this.dead) return;
    const mult = this.exposed > 0 ? 2.2 : 1;
    this.hp = Math.max(0, this.hp - dmg * mult);
    this.coreMat.emissiveIntensity = 2.6;
    setTimeout(() => { if (this.coreMat) this.coreMat.emissiveIntensity = this.exposed > 0 ? 3.2 : 1.6; }, 60);
    this.game.audio.playEnemyHit();
    if (this.hp <= 0) this.beginDeath();
    else if (this.phase === 1 && this.hpFrac <= 0.66) this.enterPhase(2);
    else if (this.phase === 2 && this.hpFrac <= 0.33) this.enterPhase(3);
  }

  enterPhase(p) {
    this.phase = p;
    this.game.audio.playBossPhase();
    this.game.camRig.addShake(0.8);
    this.game.world.pulseFlash();
    const c = this.group.position.clone();
    this.game.particles.ringBurst(c, 60, { color: 0xff2255, speed: 20, life: 1.4, size: 2 });
    this.game.ui.toast(p === 2 ? 'THE SIGNAL WARDEN IS ANGRY' : 'THE CORE IS EXPOSED — STRIKE NOW', 3000);
    if (p === 3) this.exposed = 6;
  }

  fireBolt(target, speed = 24, damage = 10, spread = 0) {
    const p = this._pool.find((p) => !p.active);
    if (!p) return;
    p.active = true;
    p.mesh.visible = true;
    p.mesh.position.copy(this.group.position);
    p.vel.copy(target).sub(this.group.position).normalize();
    if (spread > 0) {
      p.vel.x += (Math.random() - 0.5) * spread;
      p.vel.z += (Math.random() - 0.5) * spread;
      p.vel.y += (Math.random() - 0.5) * spread * 0.4;
      p.vel.normalize();
    }
    p.vel.multiplyScalar(speed);
    p.damage = damage;
  }

  nova(count, speed, damage) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const p = this._pool.find((p) => !p.active);
      if (!p) break;
      p.active = true;
      p.mesh.visible = true;
      p.mesh.position.copy(this.group.position);
      p.vel.set(Math.cos(a), 0.06, Math.sin(a)).multiplyScalar(speed);
      p.damage = damage;
    }
    this.game.audio.playBossPhase();
  }

  summonScouts() {
    if (this.game.enemyManager.roster.length > 8) return;
    for (let i = 0; i < 3; i++) this.game.enemyManager.roster.push('scout');
    this.game.ui.toast('THE WARDEN CALLS ITS SWARM', 2200);
  }

  beginDeath() {
    this.dead = true;
    this.active = false;
    this.dying = 0;
    this.game.audio.playExplosion();
  }

  // per-frame AI
  update(dt, player) {
    if (!this.active || this.dead) return;
    this.time += dt;
    const g = this.game;
    const ppos = player.pos;

    // visual animation
    this.core.rotation.y += dt * (this.phase === 3 ? 2.4 : 1.2);
    this.core.rotation.x += dt * 0.5;
    this.rings[0].rotation.z += dt * 0.6;
    this.rings[1].rotation.y += dt * -0.8;
    this.rings[2].rotation.x += dt * 0.5;
    for (let i = 0; i < this.plates.length; i++) {
      const a = (i / 8) * Math.PI * 2 + this.time * 0.3;
      this.plates[i].position.set(Math.cos(a) * 3.2, Math.sin(a * 2 + this.time) * 0.8, Math.sin(a) * 3.2);
      this.plates[i].lookAt(this.group.position);
    }
    this.group.position.y = 5.5 + Math.sin(this.time * 0.8) * 0.8;
    this.light.intensity = 12 + Math.sin(this.time * 5) * 4 + (this.exposed > 0 ? 10 : 0);

    if (this.exposed > 0) {
      this.exposed -= dt;
      this.core.scale.setScalar(1.3 + Math.sin(this.time * 8) * 0.15);
      this.coreMat.emissiveIntensity = 3.2;
      if (this.exposed <= 0) {
        this.core.scale.setScalar(1);
        this.coreMat.emissiveIntensity = 1.6;
      }
    }

    // drift slowly toward the player, keeping distance
    const toP = new THREE.Vector3().copy(ppos).sub(this.group.position);
    const d = toP.length();
    if (d > 26) {
      toP.normalize();
      this.group.position.addScaledVector(toP, 4 * dt);
    }

    // ---- attacks by phase ----
    if (!player.falling) {
      this.boltTimer -= dt;
      if (this.boltTimer <= 0) {
        const target = ppos.clone().add(new THREE.Vector3(0, 0.8, 0));
        if (this.phase === 1) {
          this.fireBolt(target, 22, 9);
          this.boltTimer = 1.6;
        } else {
          this.fireBolt(target, 24, 10, 0.12);
          this.fireBolt(target, 24, 10, 0.2);
          this.boltTimer = this.phase === 3 ? 0.9 : 1.15;
        }
      }

      if (this.phase >= 2) {
        this.novaTimer -= dt;
        if (this.novaTimer <= 0) {
          this.novaTimer = this.phase === 3 ? 5 : 7;
          this.nova(this.phase === 3 ? 16 : 12, 14, 9);
          if (this.phase === 3) {
            this.exposed = 4.5;
            g.ui.toast('THE CORE IS EXPOSED — STRIKE NOW', 2500);
          }
        }
        this.summonTimer -= dt;
        if (this.summonTimer <= 0) {
          this.summonTimer = 14;
          this.summonScouts();
        }
      }

      if (this.phase === 3) {
        this.chargeTimer -= dt;
        if (!this.charging && this.chargeTimer <= 0 && d < 40) {
          this.charging = true;
          this.chargeTimer = 2.4;
          this.chargeDir.copy(ppos).sub(this.group.position).normalize();
          g.ui.toast('INCOMING CHARGE — DODGE!', 1800);
          g.audio.playBossPhase();
        }
        if (this.charging) {
          this.group.position.addScaledVector(this.chargeDir, 26 * dt);
          this.chargeTimer -= dt * 1.6;
          if (this.group.position.distanceTo(ppos) < 5) {
            g.damagePlayer(22);
            const kb = new THREE.Vector3().copy(ppos).sub(this.group.position).normalize().multiplyScalar(10);
            player.vel.add(kb);
            this.charging = false;
            g.camRig.addShake(0.7);
          }
          if (this.chargeTimer <= 0) {
            this.charging = false;
            this.chargeTimer = 5 + Math.random() * 3;
          }
        }
      }
    }

    // ---- projectile hits ----
    const pCenter = ppos.clone().add(new THREE.Vector3(0, 0.8, 0));
    for (const p of this._pool) {
      if (!p.active) continue;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.distanceTo(pCenter) < 1.4 && !player.falling) {
        p.active = false;
        p.mesh.visible = false;
        g.damagePlayer(p.damage);
        g.particles.burst(p.mesh.position.clone(), 8,
          { color: 0xff2255, speed: 5, spread: 1, life: 0.4, size: 1.3 });
        continue;
      }
      if (p.mesh.position.y < 0.2 || p.mesh.position.length() > 400 || p.mesh.position.distanceTo(ppos) > 110) {
        p.active = false;
        p.mesh.visible = false;
      }
    }
  }

  // death sequence: chain explosions, then callback (true = fully done)
  updateDeath(dt) {
    this.dying += dt;
    const c = this.group.position.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6));
    if (Math.random() < 0.4) {
      this.game.particles.burst(c, 16, { color: 0xff8844, speed: 8, spread: 1, life: 1, size: 2, gravity: 4 });
      this.game.audio.playExplosion();
    }
    this.group.rotation.y += dt * 2;
    this.group.position.y = Math.max(3, this.group.position.y - dt * 1.4);
    this.coreMat.emissiveIntensity = 1.6 + Math.sin(this.dying * 20) * 1.4;
    if (this.dying > 3.4) {
      this.game.particles.burst(this.group.position.clone(), 120,
        { color: 0xffffff, speed: 18, spread: 1, life: 2, size: 2.4, brightness: 2 });
      this.game.particles.ringBurst(this.group.position, 80,
        { color: 0xff2ea6, speed: 24, life: 1.6, size: 2.4 });
      this.game.camRig.addShake(1);
      this.game.audio.playExplosion();
      this.scene.remove(this.group);
      return true;
    }
    return false;
  }
}


