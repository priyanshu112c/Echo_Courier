// ============ ECHO COURIER — courier character + hover-bike ============
import * as THREE from 'three';
import { CONFIG } from './config.js';

const CYAN = 0x28e7ff;
const MAGENTA = 0xff2ea6;

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.55,
    metalness: opts.metalness ?? 0.35,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
}
function box(w, h, d, m) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
}

// ----------------------------------------------------------------
// Stylized futuristic courier riding a compact hover-bike.
// Forward axis = -Z.
// ----------------------------------------------------------------
export function buildCourier() {
  const root = new THREE.Group();      // world transform (position + heading)
  const lean = new THREE.Group();      // lean/pitch animations
  root.add(lean);

  // ---------- HOVER-BIKE ----------
  const bike = new THREE.Group();
  lean.add(bike);

  const hullMat = mat(0x1a2438, { roughness: 0.35, metalness: 0.8 });
  const darkMat = mat(0x0c1220, { roughness: 0.5, metalness: 0.6 });
  const glowCyan = mat(0x0a2a33, { emissive: CYAN, emissiveIntensity: 2.4, roughness: 0.4 });
  const glowMag = mat(0x330a22, { emissive: MAGENTA, emissiveIntensity: 2.0, roughness: 0.4 });

  const hull = box(0.55, 0.28, 2.3, hullMat);
  hull.position.set(0, 0.42, 0.1);
  bike.add(hull);

  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.3, 0.9, 6), hullMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0.44, -1.4);
  bike.add(nose);

  const noseLight = box(0.08, 0.05, 0.75, glowCyan);
  noseLight.position.set(0, 0.52, -1.35);
  bike.add(noseLight);

  const seat = box(0.42, 0.1, 0.7, darkMat);
  seat.position.set(0, 0.6, 0.45);
  bike.add(seat);

  for (const s of [-1, 1]) {
    const skirt = box(0.16, 0.16, 1.6, darkMat);
    skirt.position.set(s * 0.36, 0.34, 0.05);
    bike.add(skirt);
    const stripGlow = box(0.03, 0.05, 1.5, glowCyan);
    stripGlow.position.set(s * 0.45, 0.3, 0.05);
    bike.add(stripGlow);
  }

  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8), darkMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 0.95, -0.62);
  bike.add(bar);
  for (const s of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 8), glowMag);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(s * 0.36, 0.95, -0.62);
    bike.add(grip);
    const strut = box(0.05, 0.42, 0.05, darkMat);
    strut.position.set(s * 0.14, 0.72, -0.6);
    strut.rotation.x = 0.25;
    bike.add(strut);
  }

  const dash = box(0.3, 0.02, 0.16, glowCyan);
  dash.position.set(0, 0.88, -0.5);
  dash.rotation.x = -0.5;
  bike.add(dash);

  const thrusters = [];
  for (const s of [-1, 1]) {
    const th = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.5, 10), darkMat);
    th.rotation.x = Math.PI / 2;
    th.position.set(s * 0.26, 0.42, 1.28);
    bike.add(th);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 0.55, 8),
      new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    flame.rotation.x = Math.PI / 2;
    flame.position.set(s * 0.26, 0.42, 1.62);
    bike.add(flame);
    thrusters.push(flame);
  }

  const underGlow = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 20),
    new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  underGlow.rotation.x = -Math.PI / 2;
  underGlow.position.y = 0.06;
  bike.add(underGlow);

  const bikeLight = new THREE.PointLight(CYAN, 6, 9, 2);
  bikeLight.position.set(0, 0.4, 0);
  bike.add(bikeLight);

  // ---------- RIDER ----------
  const rider = new THREE.Group();
  lean.add(rider);

  const suitMat = mat(0x232c44, { roughness: 0.7, metalness: 0.2 });
  const jacketMat = mat(0x2e3a5c, { roughness: 0.65, metalness: 0.25 });
  const trimCyan = mat(0x0a2a33, { emissive: CYAN, emissiveIntensity: 1.8 });
  const trimMag = mat(0x330a22, { emissive: MAGENTA, emissiveIntensity: 1.6 });
  const skinDark = mat(0x11141f, { roughness: 0.4, metalness: 0.3 });

  const hips = box(0.34, 0.22, 0.3, suitMat);
  hips.position.set(0, 0.78, 0.4);
  rider.add(hips);

  const torso = new THREE.Group();
  torso.position.set(0, 0.9, 0.35);
  torso.rotation.x = 0.42;
  rider.add(torso);

  const chest = box(0.42, 0.5, 0.3, jacketMat);
  chest.position.set(0, 0.3, 0);
  torso.add(chest);
  const zip = box(0.04, 0.44, 0.02, trimCyan);
  zip.position.set(0, 0.3, -0.16);
  torso.add(zip);
  const collar = box(0.36, 0.05, 0.26, trimMag);
  collar.position.set(0, 0.55, 0);
  torso.add(collar);

  const pack = box(0.34, 0.42, 0.18, darkMat);
  pack.position.set(0, 0.32, 0.24);
  torso.add(pack);
  const canister = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), trimCyan);
  canister.position.set(0.12, 0.36, 0.36);
  torso.add(canister);
  const packLight = box(0.2, 0.04, 0.02, trimMag);
  packLight.position.set(0, 0.18, 0.34);
  torso.add(packLight);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 6), darkMat);
  antenna.position.set(-0.14, 0.68, 0.28);
  torso.add(antenna);
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8),
    new THREE.MeshBasicMaterial({ color: MAGENTA }));
  antennaTip.position.set(-0.14, 0.9, 0.28);
  torso.add(antennaTip);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.66, -0.02);
  torso.add(headGroup);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 14),
    mat(0xdfe6ee, { roughness: 0.25, metalness: 0.55 }));
  helmet.scale.set(1, 1.08, 1.1);
  headGroup.add(helmet);
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 16, 10, -Math.PI / 2.6, Math.PI / 1.3, Math.PI / 4.4, Math.PI / 2.4),
    new THREE.MeshStandardMaterial({ color: 0x081018, roughness: 0.1, metalness: 0.9, emissive: CYAN, emissiveIntensity: 0.55 })
  );
  visor.position.z = -0.035;
  visor.scale.set(1, 1.05, 1.08);
  headGroup.add(visor);
  const helmetStripe = box(0.03, 0.02, 0.3, trimCyan);
  helmetStripe.position.set(0, 0.17, 0.02);
  headGroup.add(helmetStripe);

  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.26, 0.48, -0.05);
    torso.add(arm);
    const upper = box(0.11, 0.34, 0.12, jacketMat);
    upper.position.set(0, -0.15, -0.06);
    upper.rotation.x = 0.55;
    arm.add(upper);
    const elbowStripe = box(0.115, 0.05, 0.125, trimCyan);
    elbowStripe.position.set(0, -0.3, -0.15);
    elbowStripe.rotation.x = 0.55;
    arm.add(elbowStripe);
    const fore = box(0.09, 0.34, 0.1, suitMat);
    fore.position.set(s * 0.04, -0.36, -0.34);
    fore.rotation.x = 1.25;
    arm.add(fore);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), skinDark);
    glove.position.set(s * 0.05, -0.4, -0.5);
    arm.add(glove);
    arms.push(arm);
  }

  for (const s of [-1, 1]) {
    const thigh = box(0.13, 0.34, 0.15, suitMat);
    thigh.position.set(s * 0.18, 0.66, 0.22);
    thigh.rotation.x = -1.15;
    rider.add(thigh);
    const kneePad = box(0.14, 0.08, 0.16, trimMag);
    kneePad.position.set(s * 0.18, 0.56, 0.02);
    rider.add(kneePad);
    const shin = box(0.11, 0.34, 0.12, suitMat);
    shin.position.set(s * 0.2, 0.38, 0.14);
    shin.rotation.x = 0.35;
    rider.add(shin);
    const boot = box(0.11, 0.08, 0.26, skinDark);
    boot.position.set(s * 0.2, 0.2, 0.05);
    rider.add(boot);
  }

  return {
    group: root, leanGroup: lean, rider, torso, headGroup, arms,
    thrusters, underGlow, bikeLight, antennaTip, canister,
  };
}


// ----------------------------------------------------------------
// Player controller: hover-bike physics, collision, animation.
// ----------------------------------------------------------------
export class Player {
  constructor(scene) {
    this.mesh = buildCourier();
    scene.add(this.mesh.group);

    this.pos = new THREE.Vector3(0, 0, 40);
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.groundY = 0;
    this.falling = false;
    this.fallTimer = 0;
    this.lastSafe = new THREE.Vector3(0, 0, 40);
    this.safeTimer = 0;
    this.speed = 0;
    this.boosting = false;
    this.turnVisual = 0;
    this.accelVisual = 0;
    this.time = 0;
    this._v = new THREE.Vector3();
  }

  spawnAt(x, z, heading) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.heading = heading;
    this.lastSafe.set(x, 0, z);
    this.falling = false;
  }

  update(dt, axes, wantBoost, colliders, groundInfo) {
    this.time += dt;
    const C = CONFIG;

    if (this.falling) {
      this.fallTimer += dt;
      this.pos.y -= 14 * dt;
      this.mesh.group.position.copy(this.pos);
      this.mesh.group.rotation.y = this.heading;
      return this.fallTimer > 1.0 ? 'respawn' : null;
    }

    // --- steering ---
    const speedNorm = Math.min(1, this.speed / C.MAX_SPEED);
    const turnAuthority = 0.35 + 0.65 * Math.min(1, this.speed / 6);
    this.heading -= axes.x * C.TURN_RATE * turnAuthority * dt;

    // --- throttle ---
    const fwd = this._v.set(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    this.boosting = wantBoost && axes.y > 0.1;
    const maxSpeed = this.boosting ? C.BOOST_SPEED : C.MAX_SPEED;
    const accel = this.boosting ? C.BOOST_ACCEL : C.ACCEL;

    if (axes.y > 0.05) {
      this.vel.addScaledVector(fwd, axes.y * accel * dt);
    } else if (axes.y < -0.05) {
      // brake / gentle reverse
      const along = this.vel.dot(fwd);
      if (along > 0.5) this.vel.addScaledVector(fwd, axes.y * C.BRAKE * dt * -1);
      else this.vel.addScaledVector(fwd, axes.y * C.ACCEL * 0.45 * dt * -1);
    }

    // friction (only lateral grip + mild drag -> hover feel, not slippery)
    const dragK = Math.max(0, 1 - 1.1 * dt);
    this.vel.multiplyScalar(dragK);
    // strong lateral grip: kill sideways slide relative to heading
    const rightX = -fwd.z, rightZ = fwd.x;
    const lat = this.vel.x * rightX + this.vel.z * rightZ;
    const latK = Math.max(0, 1 - 8 * dt);
    this.vel.x -= rightX * lat * (1 - latK);
    this.vel.z -= rightZ * lat * (1 - latK);
    if (axes.y < 0.05 && axes.y > -0.05) {
      const fk = Math.max(0, 1 - C.FRICTION * dt);
      this.vel.multiplyScalar(fk);
    }

    // cap speed
    this.speed = this.vel.length();
    if (this.speed > maxSpeed) this.vel.multiplyScalar(maxSpeed / this.speed);
    this.speed = Math.min(this.speed, maxSpeed);

    // --- integrate + collide (circle vs AABB, axis separated slide) ---
    const r = C.PLAYER_RADIUS;
    let nx = this.pos.x + this.vel.x * dt;
    for (const c of colliders) {
      if (nx + r > c.minX && nx - r < c.maxX && this.pos.z + r > c.minZ && this.pos.z - r < c.maxZ) {
        nx = this.vel.x > 0 ? c.minX - r : c.maxX + r;
        this.vel.x = 0;
      }
    }
    this.pos.x = nx;
    let nz = this.pos.z + this.vel.z * dt;
    for (const c of colliders) {
      if (this.pos.x + r > c.minX && this.pos.x - r < c.maxX && nz + r > c.minZ && nz - r < c.maxZ) {
        nz = this.vel.z > 0 ? c.minZ - r : c.maxZ + r;
        this.vel.z = 0;
      }
    }
    this.pos.z = nz;

    // --- ground / canal holes ---
    const g = groundInfo(this.pos.x, this.pos.z);
    this.groundY = g;
    if (g === null) {
      this.falling = true;
      this.fallTimer = 0;
      return 'fall';
    }
    this.pos.y += (g - this.pos.y) * Math.min(1, 10 * dt);

    // track last safe ground position
    this.safeTimer += dt;
    if (this.safeTimer > 0.5 && this.speed < C.MAX_SPEED * 0.9) {
      this.lastSafe.copy(this.pos);
      this.safeTimer = 0;
    }

    // --- animation ---
    const hover = C.HOVER_HEIGHT + Math.sin(this.time * 2.2) * 0.05 + Math.sin(this.time * 3.7) * 0.02;
    this.mesh.group.position.set(this.pos.x, this.pos.y + hover, this.pos.z);
    this.mesh.group.rotation.y = this.heading;

    // lean into turns, pitch on accel
    this.turnVisual += ((-axes.x * speedNorm * 0.5) - this.turnVisual) * Math.min(1, 8 * dt);
    this.accelVisual += ((axes.y * 0.16 + (this.boosting ? 0.1 : 0)) - this.accelVisual) * Math.min(1, 6 * dt);
    this.mesh.leanGroup.rotation.z = this.turnVisual;
    this.mesh.leanGroup.rotation.x = this.accelVisual;

    // rider idle breathing + head scan
    this.mesh.rider.position.y = Math.sin(this.time * 1.8) * 0.015;
    this.mesh.headGroup.rotation.y = Math.sin(this.time * 0.6) * 0.14 * (1 - speedNorm);
    this.mesh.torso.rotation.x = 0.42 + this.accelVisual * 0.5;

    // thruster flames scale with speed
    const fl = 0.5 + speedNorm * 1.3 + (this.boosting ? 0.7 : 0);
    for (const f of this.mesh.thrusters) {
      f.scale.set(1, fl * (0.9 + Math.random() * 0.25), 1);
      f.material.opacity = 0.5 + speedNorm * 0.45;
    }
    this.mesh.underGlow.material.opacity = 0.16 + speedNorm * 0.14 + Math.sin(this.time * 6) * 0.03;
    this.mesh.bikeLight.intensity = 5 + speedNorm * 5 + (this.boosting ? 4 : 0);
    this.mesh.antennaTip.material.color.setHex(Math.sin(this.time * 4) > 0 ? 0xff2ea6 : 0x66173f);

    return null;
  }

  respawn() {
    this.pos.copy(this.lastSafe);
    this.pos.y = 0;
    this.vel.set(0, 0, 0);
    this.falling = false;
    this.fallTimer = 0;
  }
}

