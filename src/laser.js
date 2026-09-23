// ============ ECHO COURIER — manual laser weapon (hold to fire) ============
import * as THREE from 'three';
import { CONFIG } from './config.js';

export class LaserSystem {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.firing = false;
    this.tickTimer = 0;

    // beam (cylinder stretched between muzzle and hit point)
    const geo = new THREE.CylinderGeometry(0.045, 0.045, 1, 6, 1, true);
    geo.translate(0, 0.5, 0); // origin at base, extends +Y
    geo.rotateX(Math.PI / 2); // extends -Z
    this.beamMat = new THREE.MeshBasicMaterial({
      color: 0xff3366, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.beam = new THREE.Mesh(geo, this.beamMat);
    this.beam.visible = false;
    this.beam.frustumCulled = false;
    scene.add(this.beam);

    // outer glow beam
    const glowGeo = new THREE.CylinderGeometry(0.14, 0.14, 1, 6, 1, true);
    glowGeo.translate(0, 0.5, 0);
    glowGeo.rotateX(Math.PI / 2);
    this.glowMat = new THREE.MeshBasicMaterial({
      color: 0xff88aa, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.glowBeam = new THREE.Mesh(glowGeo, this.glowMat);
    this.glowBeam.visible = false;
    this.glowBeam.frustumCulled = false;
    scene.add(this.glowBeam);

    // muzzle flash sprite
    this.muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffddaa, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.muzzle.visible = false;
    scene.add(this.muzzle);

    this._end = new THREE.Vector3();
    this._origin = new THREE.Vector3();
  }

  setFiring(on) {
    if (on === this.firing) return;
    this.firing = on;
    if (on) {
      this.game.audio.startLaser();
      this.beam.visible = true;
      this.glowBeam.visible = true;
      this.muzzle.visible = true;
    } else {
      this.game.audio.stopLaser();
      this.beam.visible = false;
      this.glowBeam.visible = false;
      this.muzzle.visible = false;
    }
  }

  update(dt) {
    if (!this.firing) return;
    const g = this.game;
    const p = g.player;

    // muzzle: bike nose
    this._origin.set(
      p.pos.x - Math.sin(p.heading) * 1.5,
      p.pos.y + 0.95,
      p.pos.z - Math.cos(p.heading) * 1.5
    );

    // aim along the camera crosshair
    const dir = g.camera.getWorldDirection(new THREE.Vector3()).normalize();
    const hit = g.findLaserTarget(g.camera.position, dir, CONFIG.LASER_RANGE);

    let endPoint;
    if (hit) {
      endPoint = hit.point;
    } else {
      endPoint = g.camera.position.clone().addScaledVector(dir, CONFIG.LASER_RANGE);
    }
    this._end.copy(endPoint);

    // orient beams: cylinder extends -Z from origin
    const len = this._origin.distanceTo(this._end);
    this.beam.position.copy(this._origin);
    this.beam.lookAt(this._end);
    this.beam.scale.set(1 + Math.sin(g.time * 60) * 0.25, 1 + Math.sin(g.time * 60) * 0.25, len);
    this.beamMat.opacity = 0.85;
    this.glowBeam.position.copy(this._origin);
    this.glowBeam.lookAt(this._end);
    this.glowBeam.scale.set(1, 1, len);
    this.glowMat.opacity = 0.3;
    this.muzzle.position.copy(this._origin);
    this.muzzle.material.opacity = 0.7 + Math.random() * 0.3;
    this.muzzle.scale.setScalar(0.8 + Math.random() * 0.6);

    // damage ticks
    this.tickTimer -= dt;
    while (this.tickTimer <= 0) {
      this.tickTimer += CONFIG.LASER_TICK;
      if (hit) hit.applyDamage(CONFIG.LASER_DPS * CONFIG.LASER_TICK);
      g.audio.playLaserTick();
    }
  }
}
