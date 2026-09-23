// ============ ECHO COURIER — hostile drone framework ============
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { SPAWN_ZONES } from './levels.js';

const C = CONFIG;

// ---- type definitions ----
export const ENEMY_TYPES = {
  scout: {
    hp: 30, speed: 10.5, aggro: 65, damage: 8, score: 1,
    bodyColor: 0x3a4a66, glow: 0xff4455, size: 0.9, attack: 'ram',
  },
  hunter: {
    hp: 55, speed: 8, aggro: 70, damage: 6, score: 1,
    bodyColor: 0x2a2440, glow: 0xff2ea6, size: 1.1, attack: 'shoot',
    fireInterval: 2.2, fireRange: 26,
  },
  tank: {
    hp: 170, speed: 3.6, aggro: 55, damage: 18, score: 2,
    bodyColor: 0x2e2a1c, glow: 0xffb454, size: 1.6, attack: 'ram',
  },
  elite: {
    hp: 110, speed: 9.5, aggro: 75, damage: 8, score: 3,
    bodyColor: 0x1c1630, glow: 0x7c6bff, size: 1.2, attack: 'shoot',
    fireInterval: 1.4, fireRange: 30, stealth: true,
  },
};

function makeEnemyMesh(type, def) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: def.bodyColor, roughness: 0.4, metalness: 0.8,
    transparent: !!def.stealth, opacity: def.stealth ? 0.22 : 1,
  });
  const glowMat = new THREE.MeshBasicMaterial({ color: def.glow });
  const s = def.size;

  if (type === 'scout') {
    const body = new THREE.Mesh(new THREE.TetrahedronGeometry(0.7 * s), bodyMat);
    g.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9 * s, 0.05 * s, 6, 18), glowMat);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
 g.ring = ring;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 8, 8), glowMat);
    eye.position.z = -0.55 * s;
    g.add(eye);
  } else if (type === 'hunter') {
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.8 * s), bodyMat);
    g.add(body);
    for (const sx of [-1, 1]) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.3 * s, 0.2 * s, 0.9 * s), bodyMat);
      pod.position.set(sx * 0.75 * s, 0, 0.1 * s);
      g.add(pod);
      const podGlow = new THREE.Mesh(new THREE.BoxGeometry(0.32 * s, 0.06 * s, 0.6 * s), glowMat);
      podGlow.position.set(sx * 0.75 * s, -0.12 * s, 0.1 * s);
      g.add(podGlow);
    }
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 8, 8), glowMat);
    eye.position.z = -0.7 * s;
    g.add(eye);
  } else if (type === 'tank') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7 * s, 0.9 * s, 2.1 * s), bodyMat);
    g.add(body);
    for (const sx of [-1, 1]) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.25 * s, 1.1 * s, 1.5 * s), bodyMat);
      plate.position.set(sx * 0.95 * s, 0, 0);
      g.add(plate);
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 10, 10), glowMat);
    core.position.z = -1.05 * s;
    g.add(core);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.5 * s, 0.08 * s, 0.08 * s), glowMat);
    stripe.position.y = 0.5 * s;
    g.add(stripe);
  } else { // elite
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.55 * s, 2.2 * s, 6), bodyMat);
    body.rotation.x = -Math.PI / 2;
    g.add(body);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.85 * s, 0.06 * s, 6, 22), glowMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.15 * s;
    g.add(halo);
    g.ring = halo;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18 * s, 8, 8), glowMat);
    eye.position.z = -0.85 * s;
    g.add(eye);
  }

  const light = new THREE.PointLight(def.glow, 2.2, 8, 2);
  g.add(light);
  return { group: g, bodyMat, glowMat };
}

// ---- manager ----
export class EnemyManager {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.active = [];
    this.projectiles = [];
    this.roster = [];
    this.difficulty = 1;
    this.kills = 0;
    this.spawnTimer = 0;
    this.enabled = false;
    this.onKill = null;
    this._projPool = [];
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff5577 })
      );
      m.visible = false;
      scene.add(m);
      this._projPool.push({ mesh: m, vel: new THREE.Vector3(), active: false, damage: 0 });
    }
  }

  reset(roster, difficulty) {
    for (const e of this.active) this.scene.remove(e.mesh.group);
    this.active = [];
    for (const p of this._projPool) { p.active = false; p.mesh.visible = false; }
    this.roster = [];
    for (const [type, count] of Object.entries(roster || {})) {
      for (let i = 0; i < count; i++) this.roster.push(type);
    }
    for (let i = this.roster.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.roster[i], this.roster[j]] = [this.roster[j], this.roster[i]];
    }
    this.difficulty = difficulty;
    this.kills = 0;
    this.spawnTimer = 1.5;
    this.enabled = this.roster.length > 0;
  }

  get remaining() { return this.roster.length + this.active.length; }
  get activeCount() { return this.active.length; }

  trySpawn(dt, playerPos) {
    if (!this.enabled) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    if (this.active.length >= C.ENEMY_MAX_ACTIVE) return;
    if (this.roster.length === 0) return;

    const zones = [...SPAWN_ZONES].sort(() => Math.random() - 0.5);
    for (const z of zones) {
      if (Math.hypot(z.x - playerPos.x, z.z - playerPos.z) < C.ENEMY_SPAWN_MIN_DIST) continue;
      if (this.game.world.getGroundInfo(z.x, z.z) === null) continue;
      const type = this.roster.shift();
      this.spawn(type, z.x, z.z);
      this.spawnTimer = 2.2 + Math.random();
      return;
    }
  }

  spawn(type, x, z) {
    const def = ENEMY_TYPES[type];
    const mesh = makeEnemyMesh(type, def);
    mesh.group.position.set(x, 2.5 + Math.random() * 1.5, z);
    this.scene.add(mesh.group);
    this.active.push({
      type, def, mesh,
      pos: mesh.group.position,
      hp: def.hp * this.difficulty,
      maxHp: def.hp * this.difficulty,
      speed: def.speed * (0.92 + Math.random() * 0.16),
      fireTimer: 1 + Math.random() * (def.fireInterval || 2),
      contactTimer: 0,
      exposed: def.stealth ? 0 : 999,
      bobPhase: Math.random() * 6.28,
      wander: new THREE.Vector3((Math.random() - 0.5), 0, (Math.random() - 0.5)).normalize(),
    });
    this.game.audio.playEnemyAlert();
  }


  // nearest enemy whose position lies on the laser ray (with slight aim assist)
  raycast(origin, dir, maxDist) {
    let best = null, bestT = maxDist;
    const to = new THREE.Vector3();
    for (const e of this.active) {
      to.copy(e.pos).sub(origin);
      const t = to.dot(dir);
      if (t < 0 || t > bestT) continue;
      const perp = to.addScaledVector(dir, -t).length();
      const assist = Math.max(e.def.size * 1.6, t * 0.10);   // aim assist cone
      if (perp < assist) { best = e; bestT = t; }
    }
    return best ? { enemy: best, dist: bestT } : null;
  }

  damage(e, dmg, hitPoint) {
    if (e.hp <= 0) return;
    const stealthMult = (e.def.stealth && e.exposed <= 0) ? 0.4 : 1;
    e.hp -= dmg * stealthMult;
    e.exposed = Math.max(e.exposed, 1.2);
    e.mesh.bodyMat.emissive = new THREE.Color(0xffffff);
    e.mesh.bodyMat.emissiveIntensity = 0.9;
    setTimeout(() => { e.mesh.bodyMat.emissiveIntensity = 0; }, 70);
    this.game.audio.playEnemyHit();
    this.game.particles.burst(hitPoint, 5, {
      color: 0xffee88, speed: 6, spread: 1, life: 0.35, size: 1.1,
    });
    if (e.hp <= 0) this.kill(e);
  }

  kill(e) {
    const i = this.active.indexOf(e);
    if (i < 0) return;
    this.active.splice(i, 1);
    this.scene.remove(e.mesh.group);
    this.kills++;
    const p = e.pos.clone();
    this.game.particles.burst(p, 34, {
      color: 0xff8844, speed: 9, spread: 1, life: 1.0, size: 2.2, gravity: 6, brightness: 1.5,
    });
    this.game.particles.burst(p, 14, {
      color: 0xffeeaa, speed: 5, spread: 1, life: 0.7, size: 1.4,
    });
    this.game.audio.playExplosion();
    this.game.camRig.addShake(0.15);
    if (this.onKill) this.onKill(e.type);
  }

  fireProjectile(e, targetPos) {
    const p = this._projPool.find((p) => !p.active);
    if (!p) return;
    p.active = true;
    p.mesh.visible = true;
    p.mesh.position.copy(e.pos);
    p.vel.copy(targetPos).sub(e.pos).normalize().multiplyScalar(C.ENEMY_PROJECTILE_SPEED);
    p.damage = e.def.damage;
    p.mesh.material.color.setHex(e.def.glow);
  }

  update(dt, player) {
    if (!this.enabled) return;
    const ppos = player.pos;

    this.trySpawn(dt, ppos);

    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      const def = e.def;
      const d = e.pos.distanceTo(ppos);

      if (e.exposed !== 999) e.exposed -= dt;
      const stealth = def.stealth && e.exposed <= 0;
      e.mesh.bodyMat.opacity = stealth ? 0.22 : (def.stealth ? 0.95 : 1);
      if (e.mesh.ring) e.mesh.ring.rotation.z += dt * 2;

      e.pos.y = 2.5 + Math.sin(this.game.time * 2 + e.bobPhase) * 0.5;

      const aggro = stealth ? def.aggro * 0.55 : def.aggro;
      if (d < aggro && !player.falling) {
        const dir = new THREE.Vector3().copy(ppos).sub(e.pos).normalize();
        if (def.attack === 'ram') {
          if (d > def.size + 2.2) e.pos.addScaledVector(dir, e.speed * dt);
        } else {
          const ideal = 16;
          const move = d > ideal ? 1 : -0.6;
          e.pos.addScaledVector(dir, e.speed * move * dt);
          const side = new THREE.Vector3(-dir.z, 0, dir.x);
          e.pos.addScaledVector(side, Math.sin(this.game.time * 0.8 + e.bobPhase) * 3 * dt);
          e.fireTimer -= dt;
          if (e.fireTimer <= 0 && d < def.fireRange && !stealth) {
            e.fireTimer = def.fireInterval;
            this.fireProjectile(e, ppos.clone().add(new THREE.Vector3(0, 0.8, 0)));
          }
        }
      } else {
        e.pos.addScaledVector(e.wander, e.speed * 0.35 * dt);
        if (Math.random() < dt * 0.4) {
          e.wander.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        }
      }

      // building avoidance (2D push-out)
      for (const c of this.game.world.colliders) {
        if (e.pos.x > c.minX - 1 && e.pos.x < c.maxX + 1 && e.pos.z > c.minZ - 1 && e.pos.z < c.maxZ + 1) {
          const dl = e.pos.x - c.minX, dr = c.maxX - e.pos.x;
          const dn = e.pos.z - c.minZ, df = c.maxZ - e.pos.z;
          const m = Math.min(dl, dr, dn, df);
          if (m === dl) e.pos.x = c.minX - 1;
          else if (m === dr) e.pos.x = c.maxX + 1;
          else if (m === dn) e.pos.z = c.minZ - 1;
          else e.pos.z = c.maxZ + 1;
        }
      }

      e.mesh.group.lookAt(ppos.x, e.pos.y, ppos.z);

      // contact damage (ram types)
      e.contactTimer -= dt;
      if (def.attack === 'ram' && d < def.size + 2.4 && e.contactTimer <= 0 && !player.falling) {
        e.contactTimer = 1.1;
        this.game.damagePlayer(def.damage);
        const kb = new THREE.Vector3().copy(ppos).sub(e.pos).normalize().multiplyScalar(6);
        player.vel.add(kb);
        this.game.particles.burst(ppos.clone().add(new THREE.Vector3(0, 1, 0)), 10,
          { color: def.glow, speed: 6, spread: 1, life: 0.5, size: 1.5 });
      }
    }

    // projectiles
    const pCenter = ppos.clone().add(new THREE.Vector3(0, 0.8, 0));
    for (const p of this._projPool) {
      if (!p.active) continue;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.distanceTo(pCenter) < 1.3 && !player.falling) {
        p.active = false;
        p.mesh.visible = false;
        this.game.damagePlayer(p.damage);
        this.game.particles.burst(p.mesh.position.clone(), 8,
          { color: p.mesh.material.color, speed: 5, spread: 1, life: 0.4, size: 1.2 });
        continue;
      }
      if (p.mesh.position.y < 0.2 || p.mesh.position.length() > 400 || p.mesh.position.distanceTo(ppos) > 90) {
        p.active = false;
        p.mesh.visible = false;
      }
    }
  }

  // echo pulse support: expose stealthed enemies nearby
  revealFrom(pos, radius) {
    let n = 0;
    for (const e of this.active) {
      if (e.pos.distanceTo(pos) < radius) {
        e.exposed = 8;
        n++;
      }
    }
    return n;
  }
}

