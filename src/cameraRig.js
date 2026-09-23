// ============ ECHO COURIER — cinematic third-person camera ============
import * as THREE from 'three';
import { CONFIG } from './config.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3();
    this.pos = new THREE.Vector3(0, 30, 60);
    this.lookAt = new THREE.Vector3();
    this.shake = 0;
    this.headingSmooth = 0;
    this.cinematic = null;   // {update(dt) -> bool done}
    this._v = new THREE.Vector3();
  }

  addShake(amount) { this.shake = Math.min(1, this.shake + amount); }

  // start a scripted cinematic; fn(t) sets camera, returns true when done
  startCinematic(fn) { this.cinematic = { fn, t: 0 }; }

  snapBehind(pos, heading) {
    this.headingSmooth = heading;
    const d = CONFIG.CAM_DIST;
    this.pos.set(
      pos.x + Math.sin(heading) * d,
      pos.y + CONFIG.CAM_HEIGHT,
      pos.z + Math.cos(heading) * d
    );
    this.camera.position.copy(this.pos);
  }

  update(dt, player) {
    if (this.cinematic) {
      const cin = this.cinematic;
      cin.t += dt;
      const done = cin.fn(cin.t, this.camera);
      // only clear if the callback did not start a new cinematic itself
      if (done && this.cinematic === cin) this.cinematic = null;
      this.shake = Math.max(0, this.shake - dt * 2.5);
      return;
    }

    // smooth heading (shortest arc)
    let dh = player.heading - this.headingSmooth;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.headingSmooth += dh * Math.min(1, 3.2 * dt);

    const boosting = player.boosting;
    // portrait screens: pull the camera up & back so the road stays visible
    const portrait = this.camera.aspect < 0.85 ? 1.45 : 1;
    const dist = (boosting ? CONFIG.CAM_BOOST_DIST : CONFIG.CAM_DIST) * portrait;
    const h = (CONFIG.CAM_HEIGHT + (boosting ? -0.4 : 0)) * portrait;

    this._v.set(
      player.pos.x + Math.sin(this.headingSmooth) * dist,
      player.pos.y + h,
      player.pos.z + Math.cos(this.headingSmooth) * dist
    );

    const k = Math.min(1, CONFIG.CAM_LAG * dt);
    this.pos.lerp(this._v, k);

    // keep camera above ground
    if (this.pos.y < 1.6) this.pos.y = 1.6;

    // shake
    if (this.shake > 0.001) {
      const s = this.shake * 0.22;
      this.pos.x += (Math.random() - 0.5) * s;
      this.pos.y += (Math.random() - 0.5) * s * 0.6;
      this.pos.z += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }

    this.camera.position.copy(this.pos);

    // look slightly ahead of the bike
    this.lookAt.set(
      player.pos.x - Math.sin(this.headingSmooth) * 4,
      player.pos.y + 1.6,
      player.pos.z - Math.cos(this.headingSmooth) * 4
    );
    this.camera.lookAt(this.lookAt);

    // FOV kick on boost
    const targetFov = boosting ? CONFIG.CAM_BOOST_FOV : CONFIG.CAM_FOV;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, 5 * dt);
      this.camera.updateProjectionMatrix();
    }
  }
}
