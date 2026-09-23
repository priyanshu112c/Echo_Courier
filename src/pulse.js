// ============ ECHO COURIER — Echo Pulse effect ============
import * as THREE from 'three';
import { CONFIG } from './config.js';

const CYAN = 0x28e7ff;

export class EchoPulse {
  constructor(scene) {
    this.scene = scene;
    this.cooldown = 0;
    this.activeWaves = [];

    // pool of expanding rings
    this.rings = [];
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.RingGeometry(0.94, 1.0, 72);
      const mat = new THREE.MeshBasicMaterial({
        color: CYAN, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scene.add(m);
      this.rings.push({ mesh: m, t: 0, active: false, delay: i * 0.12 });
    }

    // flash light
    this.light = new THREE.PointLight(CYAN, 0, 40, 1.6);
    scene.add(this.light);
  }

  get ready() { return this.cooldown <= 0; }
  get cooldownFrac() { return Math.max(0, this.cooldown) / CONFIG.PULSE_COOLDOWN; }

  tryFire(pos, energy) {
    if (!this.ready || energy < CONFIG.PULSE_COST) return false;
    this.cooldown = CONFIG.PULSE_COOLDOWN;

    for (const r of this.rings) {
      r.t = -r.delay;
      r.active = true;
      r.mesh.position.set(pos.x, 0.5, pos.z);
      r.mesh.visible = true;
    }
    this.light.position.set(pos.x, 2.5, pos.z);
    this.light.intensity = 60;
    return true;
  }

  update(dt) {
    this.cooldown -= dt;
    for (const r of this.rings) {
      if (!r.active) continue;
      r.t += dt;
      if (r.t < 0) continue;
      const k = r.t / CONFIG.PULSE_DURATION;
      if (k >= 1) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const ease = 1 - Math.pow(1 - k, 2.2);
      const radius = ease * CONFIG.PULSE_RADIUS;
      r.mesh.scale.setScalar(Math.max(radius, 0.01));
      r.mesh.material.opacity = (1 - k) * 0.85;
    }
    if (this.light.intensity > 0) {
      this.light.intensity = Math.max(0, this.light.intensity - dt * 90);
    }
  }
}
