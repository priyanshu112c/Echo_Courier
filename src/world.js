// ============ ECHO COURIER — cyberpunk city generation ============
import * as THREE from 'three';
import { CONFIG } from './config.js';

const CYAN = 0x28e7ff;
const MAGENTA = 0xff2ea6;
const AMBER = 0xffb454;

// ---------- canvas texture helpers ----------
function windowTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#04050c';
  g.fillRect(0, 0, 128, 256);
  const palette = ['#28e7ff', '#ffb454', '#ff2ea6', '#9fd8ff', '#7c6bff'];
  for (let y = 8; y < 248; y += 14) {
    for (let x = 8; x < 120; x += 14) {
      if (Math.random() < 0.42) {
        g.fillStyle = palette[Math.floor(Math.random() * palette.length)];
        g.globalAlpha = 0.25 + Math.random() * 0.65;
        g.fillRect(x, y, 8, 9);
      }
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTexture(text, color, sub = '') {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(2,4,12,0.85)';
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = color; g.lineWidth = 3;
  g.strokeRect(6, 6, 244, 116);
  g.font = 'bold 52px "Orbitron", monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 22;
  g.fillStyle = color;
  g.fillText(text, 128, sub ? 48 : 64);
  if (sub) {
    g.font = 'bold 22px monospace';
    g.fillText(sub, 128, 94);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function groundTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  g.fillStyle = '#070912';
  g.fillRect(0, 0, 512, 512);
  // asphalt noise
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.25)';
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  // faint cyan grid
  g.strokeStyle = 'rgba(40,231,255,0.05)';
  g.lineWidth = 1;
  for (let i = 0; i <= 512; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  return tex;
}

// sky dome with vertical gradient + stars (day/night aware)
function makeSky() {
  const geo = new THREE.SphereGeometry(600, 24, 16);
  const matSky = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uHorizon: { value: new THREE.Color(0.10, 0.05, 0.16) },
      uMid: { value: new THREE.Color(0.03, 0.03, 0.09) },
      uTop: { value: new THREE.Color(0.005, 0.008, 0.03) },
      uGlow: { value: 0.85 },
    },
    vertexShader: `
      varying vec3 vP;
      void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vP;
      uniform vec3 uHorizon; uniform vec3 uMid; uniform vec3 uTop; uniform float uGlow;
      void main(){
        float h = normalize(vP).y;
        vec3 c = h < 0.25 ? mix(uHorizon, uMid, smoothstep(0.0, 0.25, h))
                          : mix(uMid, uTop, smoothstep(0.25, 0.8, h));
        // magenta/cyan city glow at horizon, scaled by uGlow (fades by day)
        c += vec3(0.10, 0.02, 0.10) * uGlow * pow(max(0.0, 1.0 - abs(h * 3.0)), 3.0);
        c += vec3(0.0, 0.08, 0.10) * uGlow * pow(max(0.0, 1.0 - abs((h - 0.05) * 4.0)), 4.0) * 0.6;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(geo, matSky);

  const starGeo = new THREE.BufferGeometry();
  const n = 350;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const e = 0.15 + Math.random() * 0.8;
    const r = 560;
    pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    pos[i * 3 + 1] = Math.sin(e) * r;
    pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0x9fd8ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.7, depthWrite: false,
  }));
  const g = new THREE.Group();
  g.add(sky); g.add(stars);
  return { group: g, skyMat: matSky, stars };
}

// street coordinates & layout data
export const STREETS = [-51, -17, 17, 51];
const STREET_W = 10;
const BLOCKS = [-68, -34, 0, 34, 68];

// canals (holes in the ground) — cross them via bridges
const CANALS = [
  { minX: -86, maxX: 14, minZ: -9, maxZ: -3 },     // west canal
  { minX: 30, maxX: 36, minZ: 20, maxZ: 86 },      // east canal
];

export const TOWER_DEFS = [
  { name: 'A', x: -62, z: -62 },
  { name: 'B', x: 62, z: -58 },
  { name: 'C', x: -60, z: 60 },
  { name: 'D', x: 60, z: 62 },
];

export const STATION_DEFS = [
  { x: -6, z: 26 },
  { x: 44, z: -30 },
];

function inCanal(x, z, pad = 0) {
  for (const c of CANALS) {
    if (x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad) return true;
  }
  return false;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.buildings = [];
    this.hidden = [];        // pulse-revealable objects
    this.towers = [];
    this.stations = [];
    this.fragments = [];
    this.holoAds = [];
    this.traffic = [];
    this.flickerLights = [];
    this.time = 0;
    this.cityBrightness = 0; // rises on completion
    this._pulseFlash = 0;

    scene.fog = new THREE.Fog(CONFIG.FOG_COLOR, CONFIG.FOG_NEAR, CONFIG.FOG_FAR);
    const sky = makeSky();
    scene.add(sky.group);
    this.skyMat = sky.skyMat;
    this.stars = sky.stars;
    this.dayEmissive = 0.78;   // driven by DayNight system

    // lighting
    const ambient = new THREE.AmbientLight(0x2a3a66, 1.15);
    scene.add(ambient);
    this.ambient = ambient;
    const hemi = new THREE.HemisphereLight(0x33477a, 0x0d0918, 0.65);
    scene.add(hemi);
    this.hemi = hemi;
    const moon = new THREE.DirectionalLight(0x8fb8ff, 0.5);
    moon.position.set(-60, 120, 40);
    scene.add(moon);
    this.moon = moon;

    this.buildGround();
    this.buildCanals();
    this.buildBuildings();
    this.buildSkyline();
    this.buildStreetLights();
    this.buildBridges();
    this.buildTowers();
    this.buildStations();
    this.buildFragments();
    this.buildSignsAndAds();
    this.buildHighway();
    this.buildHiddenPaths();
    this.buildPlatforms();
    this.addBoundaryColliders();
  }

  buildGround() {
    const geo = new THREE.PlaneGeometry(CONFIG.WORLD_SIZE * 2.4, CONFIG.WORLD_SIZE * 2.4);
    const m = new THREE.MeshStandardMaterial({
      map: groundTexture(), color: 0xaab4c8, roughness: 0.8, metalness: 0.3,
    });
    const g = new THREE.Mesh(geo, m);
    g.rotation.x = -Math.PI / 2;
    g.position.y = -0.02;
    this.scene.add(g);

    // glowing street center lines
    const lineMat = new THREE.MeshBasicMaterial({
      color: CYAN, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const lineGeoH = new THREE.PlaneGeometry(CONFIG.WORLD_SIZE * 2, 0.35);
    const lineGeoV = new THREE.PlaneGeometry(0.35, CONFIG.WORLD_SIZE * 2);
    for (const s of STREETS) {
      const h = new THREE.Mesh(lineGeoH, lineMat);
      h.rotation.x = -Math.PI / 2;
      h.position.set(0, 0.02, s);
      this.scene.add(h);
      const v = new THREE.Mesh(lineGeoV, lineMat);
      v.rotation.x = -Math.PI / 2;
      v.position.set(s, 0.02, 0);
      this.scene.add(v);
    }
  }

  buildCanals() {
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x06121f, roughness: 0.15, metalness: 0.9,
      emissive: 0x0a3550, emissiveIntensity: 0.35,
    });
    this.waterMats = [];
    const edgeMat = new THREE.MeshBasicMaterial({
      color: MAGENTA, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    for (const c of CANALS) {
      const w = c.maxX - c.minX, d = c.maxZ - c.minZ;
      const water = new THREE.Mesh(new THREE.PlaneGeometry(w, d), waterMat.clone());
      water.rotation.x = -Math.PI / 2;
      water.position.set((c.minX + c.maxX) / 2, -3.2, (c.minZ + c.maxZ) / 2);
      this.scene.add(water);
      this.waterMats.push(water.material);
      // glowing canal edges
      const horiz = w > d;
      const eGeo = horiz ? new THREE.PlaneGeometry(w, 0.3) : new THREE.PlaneGeometry(0.3, d);
      for (const side of [0, 1]) {
        const e = new THREE.Mesh(eGeo, edgeMat);
        e.rotation.x = -Math.PI / 2;
        e.position.set(
          horiz ? (c.minX + c.maxX) / 2 : (side ? c.maxX : c.minX),
          0.06,
          horiz ? (side ? c.maxZ : c.minZ) : (c.minZ + c.maxZ) / 2
        );
        this.scene.add(e);
      }
    }
  }


  buildBuildings() {
    const winTex = windowTexture();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const m = new THREE.MeshStandardMaterial({
      color: 0x11141f,
      roughness: 0.7,
      metalness: 0.3,
      emissive: 0xffffff,
      emissiveMap: winTex,
      emissiveIntensity: 0.75,
      map: winTex,
    });

    const placements = [];
    const clearZones = [
      { x: 0, z: 40, r: 12 },                       // spawn plaza
      ...STATION_DEFS.map(s => ({ x: s.x, z: s.z, r: 10 })),
      ...TOWER_DEFS.map(t => ({ x: t.x, z: t.z, r: 13 })),
    ];
    for (const bx of BLOCKS) {
      for (const bz of BLOCKS) {
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          const w = 5 + Math.random() * 7;
          const d = 5 + Math.random() * 7;
          const x = bx + (Math.random() - 0.5) * (23 - w);
          const z = bz + (Math.random() - 0.5) * (23 - d);
          if (Math.abs(x) > 82 || Math.abs(z) > 82) continue;
          if (inCanal(x, z, Math.max(w, d) / 2 + 3)) continue;
          let bad = false;
          for (const cz of clearZones) {
            if (Math.hypot(x - cz.x, z - cz.z) < cz.r + Math.max(w, d) / 2) { bad = true; break; }
          }
          if (bad) continue;
          // avoid overlapping existing buildings
          for (const p of placements) {
            if (Math.abs(x - p.x) < (w + p.w) / 2 + 0.8 && Math.abs(z - p.z) < (d + p.d) / 2 + 0.8) { bad = true; break; }
          }
          if (bad) continue;
          const h = 9 + Math.random() * Math.random() * 42;
          placements.push({ x, z, w, d, h });
        }
      }
    }

    const inst = new THREE.InstancedMesh(geo, m, placements.length);
    const M = new THREE.Matrix4();
    const col = new THREE.Color();
    placements.forEach((p, i) => {
      M.makeScale(p.w, p.h, p.d);
      M.setPosition(p.x, 0, p.z);
      inst.setMatrixAt(i, M);
      const tint = 0.55 + Math.random() * 0.45;
      col.setRGB(tint * (0.7 + Math.random() * 0.3), tint * (0.75 + Math.random() * 0.25), tint);
      inst.setColorAt(i, col);
      this.colliders.push({
        minX: p.x - p.w / 2, maxX: p.x + p.w / 2,
        minZ: p.z - p.d / 2, maxZ: p.z + p.d / 2,
      });
      this.buildings.push(p);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    this.scene.add(inst);
    this.buildingMesh = inst;
    this.buildingMat = m;

    // rooftop antennae on some buildings
    const antGeo = new THREE.CylinderGeometry(0.08, 0.14, 1, 5);
    antGeo.translate(0, 0.5, 0);
    const antMat = new THREE.MeshStandardMaterial({ color: 0x0c1220, roughness: 0.5, metalness: 0.7, emissive: MAGENTA, emissiveIntensity: 0.25 });
    const ants = this.buildings.filter((b, i) => i % 3 === 0);
    const antInst = new THREE.InstancedMesh(antGeo, antMat, ants.length);
    ants.forEach((b, i) => {
      const ah = 3 + Math.random() * 5;
      M.makeScale(1, ah, 1);
      M.setPosition(b.x + (Math.random() - 0.5) * b.w * 0.5, b.h, b.z + (Math.random() - 0.5) * b.d * 0.5);
      antInst.setMatrixAt(i, M);
    });
    antInst.instanceMatrix.needsUpdate = true;
    this.scene.add(antInst);

    // beacon tips on tallest few
    for (const b of this.buildings.filter(b => b.h > 34)) {
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff3355 }));
      tip.position.set(b.x, b.h + 4.5, b.z);
      this.scene.add(tip);
      this.flickerLights.push({ mesh: tip, phase: Math.random() * 10, kind: 'beacon' });
    }
  }

  buildSkyline() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const m = new THREE.MeshStandardMaterial({
      color: 0x0a0d18, roughness: 0.9, metalness: 0.1,
      emissive: 0x4a6a9a, emissiveIntensity: 0.18,
      emissiveMap: windowTexture(),
    });
    const n = 70;
    const inst = new THREE.InstancedMesh(geo, m, n);
    const M = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.06;
      const r = 200 + Math.random() * 130;
      const w = 14 + Math.random() * 26;
      const h = 30 + Math.random() * 90;
      M.makeScale(w, h, w);
      M.setPosition(Math.cos(a) * r, -2, Math.sin(a) * r);
      inst.setMatrixAt(i, M);
    }
    inst.instanceMatrix.needsUpdate = true;
    this.scene.add(inst);
  }

  buildStreetLights() {
    const positions = [];
    for (const s of STREETS) {
      for (let t = -80; t <= 80; t += 16) {
        positions.push([t, s + STREET_W / 2 + 0.8], [t, s - STREET_W / 2 - 0.8]);
        positions.push([s + STREET_W / 2 + 0.8, t], [s - STREET_W / 2 - 0.8, t]);
      }
    }
    const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 4.4, 6);
    poleGeo.translate(0, 2.2, 0);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x131a2c, roughness: 0.6, metalness: 0.6 });
    const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, positions.length);
    const lampGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xbfe9ff });
    const lampInst = new THREE.InstancedMesh(lampGeo, lampMat, positions.length);
    const M = new THREE.Matrix4();
    positions.forEach((p, i) => {
      if (inCanal(p[0], p[1], 1)) { M.makeScale(0, 0, 0); }
      else M.identity();
      M.setPosition(p[0], 0, p[1]);
      poleInst.setMatrixAt(i, M);
      const M2 = M.clone();
      M2.setPosition(p[0], 4.4, p[1]);
      lampInst.setMatrixAt(i, M2);
    });
    poleInst.instanceMatrix.needsUpdate = true;
    lampInst.instanceMatrix.needsUpdate = true;
    this.scene.add(poleInst);
    this.scene.add(lampInst);
    this.lampMat = lampMat;
  }


  // ---------- bridges over the canals ----------
  buildBridges() {
    this.bridges = [];
    const vis = this.makeBridge(-17, -6, 9, 12, false);
    vis.revealAmount = 1;
    vis.everRevealed = true;
    this.makeBridge(-48, -6, 9, 13, true);   // west canal hidden shortcut
    this.makeBridge(33, 55, 13, 9, true);    // east canal hidden shortcut
  }

  makeBridge(cx, cz, w, d, hidden) {
    const g = new THREE.Group();
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x1a2438, roughness: 0.4, metalness: 0.7,
      transparent: hidden, opacity: hidden ? 0 : 1,
    });
    const glowMat = new THREE.MeshBasicMaterial({
      color: CYAN, transparent: true, opacity: hidden ? 0 : 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), deckMat);
    deck.position.set(cx, 0.05, cz);
    g.add(deck);
    const horiz = w > d;
    const railGeo = horiz ? new THREE.BoxGeometry(w, 0.12, 0.18) : new THREE.BoxGeometry(0.18, 0.12, d);
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(railGeo, glowMat);
      rail.position.set(
        horiz ? cx : cx + s * (w / 2 - 0.2),
        0.35,
        horiz ? cz + s * (d / 2 - 0.2) : cz
      );
      g.add(rail);
    }
    this.scene.add(g);
    const bridge = {
      group: g, mats: [deckMat, glowMat],
      minX: cx - w / 2 - 0.5, maxX: cx + w / 2 + 0.5,
      minZ: cz - d / 2 - 0.5, maxZ: cz + d / 2 + 0.5,
      hidden, revealAmount: hidden ? 0 : 1,
      revealTimer: 0, everRevealed: !hidden,
      center: { x: cx, z: cz },
      kind: 'bridge',
    };
    this.bridges.push(bridge);
    if (hidden) this.hidden.push(bridge);
    return bridge;
  }


  // ---------- signal towers ----------
  buildTowers() {
    const labels = { A: '#ff2ea6', B: '#28e7ff', C: '#ffb454', D: '#7c6bff' };
    const colors = { A: MAGENTA, B: CYAN, C: AMBER, D: 0x7c6bff };
    for (const def of TOWER_DEFS) {
      const g = new THREE.Group();
      g.position.set(def.x, 0, def.z);
      const col = colors[def.name];

      const darkMetal = new THREE.MeshStandardMaterial({ color: 0x141b2e, roughness: 0.45, metalness: 0.8 });
      const glow = new THREE.MeshStandardMaterial({
        color: 0x0a0f1c, roughness: 0.4, metalness: 0.5,
        emissive: col, emissiveIntensity: 0.06,
      });

      const base = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.0, 1.2, 8), darkMetal);
      base.position.y = 0.6;
      g.add(base);
      let y = 1.2;
      for (let i = 0; i < 5; i++) {
        const s = 1.5 - i * 0.22;
        const seg = new THREE.Mesh(new THREE.BoxGeometry(s, 4.4, s), i % 2 ? glow : darkMetal);
        seg.position.y = y + 2.2;
        seg.rotation.y = i * 0.35;
        g.add(seg);
        y += 4.4;
      }
      const dish = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.0, 12, 1, true), darkMetal);
      dish.position.set(1.4, y - 3.5, 0);
      dish.rotation.z = -Math.PI / 2.4;
      g.add(dish);
      const rings = [];
      for (let i = 0; i < 2; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1 + i * 0.55, 0.07, 8, 28),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
        ring.position.y = y + 0.6 + i * 0.9;
        ring.rotation.x = Math.PI / 2;
        g.add(ring);
        rings.push(ring);
      }
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.25 }));
      beacon.position.y = y + 1.4;
      g.add(beacon);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.8, 60, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.y = y + 30;
      g.add(beam);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.3),
        new THREE.MeshBasicMaterial({ map: signTexture('TOWER ' + def.name, labels[def.name]), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      label.position.y = y + 4.2;
      g.add(label);

      const light = new THREE.PointLight(col, 0, 30, 1.8);
      light.position.y = 6;
      g.add(light);

      this.scene.add(g);
      this.colliders.push({ minX: def.x - 3.6, maxX: def.x + 3.6, minZ: def.z - 3.6, maxZ: def.z + 3.6 });
      this.towers.push({
        def, group: g, glowMat: glow, rings, beacon, beam, label, light,
        state: 'dormant',
        revealTimer: 0,
        pos: new THREE.Vector3(def.x, 0, def.z),
        name: def.name,
      });
    }
  }


  // ---------- recharge stations ----------
  buildStations() {
    for (const def of STATION_DEFS) {
      const g = new THREE.Group();
      g.position.set(def.x, 0, def.z);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, 0.25, 20),
        new THREE.MeshStandardMaterial({ color: 0x141b2e, roughness: 0.35, metalness: 0.8 }));
      pad.position.y = 0.12;
      g.add(pad);
      const ringGlow = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.09, 8, 40),
        new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      ringGlow.rotation.x = Math.PI / 2;
      ringGlow.position.y = 0.3;
      g.add(ringGlow);
      for (const s of [-1, 1]) {
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.2, 0.35),
          new THREE.MeshStandardMaterial({ color: 0x1a2438, roughness: 0.4, metalness: 0.8, emissive: AMBER, emissiveIntensity: 0.35 }));
        pylon.position.set(s * 2.9, 2.1, 0);
        g.add(pylon);
      }
      const topBar = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.3, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x1a2438, roughness: 0.4, metalness: 0.8, emissive: AMBER, emissiveIntensity: 0.5 }));
      topBar.position.y = 4.3;
      g.add(topBar);
      const holo = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.7),
        new THREE.MeshBasicMaterial({ map: signTexture('CHARGE', '#ffb454', 'ECHO STATION'), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
      holo.position.y = 5.4;
      g.add(holo);
      const light = new THREE.PointLight(AMBER, 5, 16, 1.8);
      light.position.y = 3;
      g.add(light);
      this.scene.add(g);
      this.stations.push({ group: g, pos: new THREE.Vector3(def.x, 0, def.z), holo, ringGlow, light });
    }
  }

  // ---------- energy fragments ----------
  buildFragments() {
    const geo = new THREE.OctahedronGeometry(0.42);
    const spots = [
      [0, 12], [-17, -30], [17, 8], [51, -20], [-51, 20], [30, 51],
      [-34, 51], [8, -51], [-60, -17], [60, 17], [-17, 68], [17, -68],
    ];
    const hiddenSpots = [
      [-48, 8], [33, 40], [-70, -34], [70, 40], [-8, -60], [44, 8],
    ];
    for (const [x, z] of spots) this.addFragment(geo, x, z, false);
    for (const [x, z] of hiddenSpots) this.addFragment(geo, x, z, true);
  }

  addFragment(geo, x, z, hidden) {
    const m = new THREE.MeshStandardMaterial({
      color: 0x0a2a33, emissive: CYAN, emissiveIntensity: 2.4,
      roughness: 0.3, metalness: 0.4, transparent: true, opacity: hidden ? 0 : 1,
    });
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, 1.2, z);
    this.scene.add(mesh);
    const frag = {
      mesh, pos: new THREE.Vector3(x, 1.2, z),
      taken: false, hidden, revealTimer: 0, baseY: 1.2,
      phase: Math.random() * 6.28, kind: 'fragment',
      center: { x, z },
    };
    this.fragments.push(frag);
    if (hidden) this.hidden.push(frag);
  }


  // ---------- neon signs, holo ads, cables ----------
  buildSignsAndAds() {
    const signDefs = [
      ['NEON', '#ff2ea6', 'DISTRICT'], ['宅配', '#28e7ff', 'EXPRESS'],
      ['PULSE', '#28e7ff', ''], ['NOODLE', '#ffb454', 'BAR'],
      ['NET-7', '#7c6bff', ''], ['ECHO', '#ff2ea6', 'RELAY'],
      ['SYNTH', '#28e7ff', 'LOUNGE'], ['24H', '#ffb454', 'REPAIR'],
    ];
    let si = 0;
    const candidates = this.buildings.filter(b => b.h > 14);
    for (const b of candidates) {
      if (si >= signDefs.length * 2) break;
      if (Math.random() < 0.45) continue;
      const [txt, col, sub] = signDefs[si++ % signDefs.length];
      const w = 5 + Math.random() * 3;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2),
        new THREE.MeshBasicMaterial({
          map: signTexture(txt, col, sub), transparent: true,
          opacity: 0.95, side: THREE.DoubleSide, depthWrite: false,
        }));
      // face nearest street axis
      const faceX = Math.abs(b.x % 34) > Math.abs(b.z % 34);
      if (faceX) {
        plane.position.set(b.x + (b.x > 0 ? -b.w / 2 - 0.15 : b.w / 2 + 0.15), 6 + Math.random() * (b.h - 8), b.z);
        plane.rotation.y = b.x > 0 ? -Math.PI / 2 : Math.PI / 2;
      } else {
        plane.position.set(b.x, 6 + Math.random() * (b.h - 8), b.z + (b.z > 0 ? -b.d / 2 - 0.15 : b.d / 2 + 0.15));
        plane.rotation.y = b.z > 0 ? Math.PI : 0;
      }
      this.scene.add(plane);
      this.holoAds.push({ mesh: plane, baseOpacity: 0.95, phase: Math.random() * 10, glitch: 0 });
    }

    // catenary cables across streets
    const cableMat = new THREE.LineBasicMaterial({ color: 0x2a3a55, transparent: true, opacity: 0.8 });
    let made = 0;
    for (const b of this.buildings) {
      if (made >= 16) break;
      // find a neighbour across a street
      for (const o of this.buildings) {
        if (o === b) continue;
        const dx = o.x - b.x, dz = o.z - b.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 22 && dist < 42 && b.h > 12 && o.h > 12 && Math.random() < 0.25) {
          const p0 = new THREE.Vector3(b.x, b.h * 0.8, b.z);
          const p1 = new THREE.Vector3(o.x, o.h * 0.8, o.z);
          const pts = [];
          for (let i = 0; i <= 12; i++) {
            const t = i / 12;
            const p = p0.clone().lerp(p1, t);
            p.y -= Math.sin(t * Math.PI) * dist * 0.06;
            pts.push(p);
          }
          const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cableMat);
          this.scene.add(line);
          made++;
          break;
        }
      }
    }
  }

  // ---------- elevated highway with moving light traffic ----------
  buildHighway() {
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x11141f, roughness: 0.6, metalness: 0.5 });
    const edgeMat = new THREE.MeshBasicMaterial({ color: MAGENTA, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    const mkRoad = (x, z, len, alongX) => {
      const g = new THREE.Group();
      const geo = alongX ? new THREE.BoxGeometry(len, 0.7, 7) : new THREE.BoxGeometry(7, 0.7, len);
      const road = new THREE.Mesh(geo, roadMat);
      road.position.set(x, 13, z);
      g.add(road);
      const eGeo = alongX ? new THREE.BoxGeometry(len, 0.12, 0.15) : new THREE.BoxGeometry(0.15, 0.12, len);
      for (const s of [-1, 1]) {
        const e = new THREE.Mesh(eGeo, edgeMat);
        e.position.set(alongX ? x : x + s * 3.4, 13.4, alongX ? z + s * 3.4 : z);
        g.add(e);
      }
      // pillars
      const pGeo = new THREE.CylinderGeometry(0.7, 0.9, 13, 8);
      for (let t = -len / 2 + 10; t < len / 2; t += 24) {
        const px = alongX ? x + t : x;
        const pz = alongX ? z : z + t;
        if (inCanal(px, pz, 2)) continue;
        const p = new THREE.Mesh(pGeo, roadMat);
        p.position.set(px, 6.5, pz);
        g.add(p);
      }
      this.scene.add(g);
    };
    mkRoad(0, -68, 340, true);
    mkRoad(-68, 0, 340, false);

    // moving traffic light streaks
    const tGeo = new THREE.BoxGeometry(2.2, 0.3, 0.3);
    for (let i = 0; i < 14; i++) {
      const col = i % 2 ? 0xff5566 : 0xffd9a0;
      const m = new THREE.Mesh(tGeo, new THREE.MeshBasicMaterial({ color: col }));
      const alongX = i % 2 === 0;
      m.position.set(0, 13.6, 0);
      this.scene.add(m);
      this.traffic.push({
        mesh: m, alongX,
        lane: (i % 3 - 1) * 1.8,
        off: Math.random() * 340,
        speed: (14 + Math.random() * 14) * (i % 4 < 2 ? 1 : -1),
      });
    }
  }


  // ---------- hidden guide paths (revealed by pulse) ----------
  buildHiddenPaths() {
    this.paths = [];
    const colors = { A: MAGENTA, B: CYAN, C: AMBER, D: 0x7c6bff };
    // Manhattan routes along street grid toward each tower
    const routes = {
      A: [[-17, -17], [-51, -17], [-51, -51], [-58, -58]],
      B: [[17, -17], [51, -17], [51, -51], [58, -55]],
      C: [[-17, 17], [-51, 17], [-51, 51], [-57, 57]],
      D: [[17, 17], [51, 17], [51, 51], [57, 58]],
    };
    const quad = new THREE.PlaneGeometry(1.5, 0.7);
    for (const [name, pts] of Object.entries(routes)) {
      const mat = new THREE.MeshBasicMaterial({
        color: colors[name], transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const g = new THREE.Group();
      let cx = 0, cz = 0, count = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
        const dx = x1 - x0, dz = z1 - z0;
        const len = Math.hypot(dx, dz);
        const steps = Math.floor(len / 4);
        const ang = Math.atan2(dx, dz);
        for (let s = 0; s < steps; s++) {
          const t = (s + 0.5) / steps;
          const q = new THREE.Mesh(quad, mat);
          q.rotation.x = -Math.PI / 2;
          q.rotation.z = -ang;
          q.position.set(x0 + dx * t, 0.06, z0 + dz * t);
          g.add(q);
          cx += q.position.x; cz += q.position.z; count++;
        }
      }
      this.scene.add(g);
      const path = {
        group: g, mat, kind: 'path', hidden: true,
        center: { x: cx / count, z: cz / count },
        revealTimer: 0, tower: name,
      };
      this.hidden.push(path);
      this.paths.push(path);
    }
  }

  // ---------- dormant floating platforms (environmental reaction) ----------
  buildPlatforms() {
    const defs = [
      [-48, 6, 2.5], [33, 44, 2.5], [-30, -40, 3.5], [40, 30, 3],
      [-8, -44, 3], [8, 60, 2.8],
    ];
    this.platforms = [];
    for (const [x, z, s] of defs) {
      const g = new THREE.Group();
      const m = new THREE.MeshStandardMaterial({
        color: 0x182136, roughness: 0.4, metalness: 0.7,
        emissive: CYAN, emissiveIntensity: 0.05, transparent: true, opacity: 0.35,
      });
      const plat = new THREE.Mesh(new THREE.CylinderGeometry(s, s * 1.15, 0.4, 8), m);
      plat.position.y = 1.5;
      g.add(plat);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(s, 0.07, 8, 24),
        new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false }));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 1.72;
      g.add(rim);
      g.position.set(x, 0, z);
      this.scene.add(g);
      const p = {
        group: g, plat, rim, mat: m, kind: 'platform', hidden: true,
        center: { x, z }, revealTimer: 0, phase: Math.random() * 6.28,
        baseY: 1.5,
      };
      this.hidden.push(p);
      this.platforms.push(p);
    }
  }


  // ---------- world edge walls ----------
  addBoundaryColliders() {
    const E = 86;
    this.colliders.push(
      { minX: -999, maxX: -E, minZ: -999, maxZ: 999 },
      { minX: E, maxX: 999, minZ: -999, maxZ: 999 },
      { minX: -999, maxX: 999, minZ: -999, maxZ: -E },
      { minX: -999, maxX: 999, minZ: E, maxZ: 999 },
    );
  }

  // ---------- echo pulse reveal ----------
  revealPulse(pos, radius) {
    let revealed = 0;
    for (const h of this.hidden) {
      const d = Math.hypot(h.center.x - pos.x, h.center.z - pos.z);
      if (d < radius) {
        if (h.revealTimer <= 0) revealed++;
        h.revealTimer = CONFIG.REVEAL_DURATION;
        h.everRevealed = true;
      }
    }
    for (const t of this.towers) {
      if (t.state === 'dormant' && t.pos.distanceTo(pos) < radius) {
        t.state = 'revealed';
        t.revealTimer = CONFIG.REVEAL_DURATION;
        revealed++;
      } else if (t.state === 'revealed' && t.pos.distanceTo(pos) < radius) {
        t.revealTimer = CONFIG.REVEAL_DURATION;
      }
    }
    return revealed;
  }

  // ---------- ground sampling (null = hole) ----------
  getGroundInfo(x, z) {
    if (inCanal(x, z)) {
      for (const b of this.bridges) {
        if (b.revealAmount > 0.35 &&
            x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) {
          return 0.22;
        }
      }
      return null;
    }
    return 0;
  }

  nearestInactiveTower(pos) {
    let best = null, bd = Infinity;
    for (const t of this.towers) {
      if (t.state === 'active') continue;
      const d = t.pos.distanceTo(pos);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }


  // ---------- per-frame world animation ----------
  update(dt, camera) {
    this.time += dt;
    const t = this.time;

    // hidden objects fade in/out
    for (const h of this.hidden) {
      if (h.revealTimer > 0) h.revealTimer -= dt;
      const target = h.revealTimer > 0 ? 1 : (h.everRevealed ? 0.07 : 0);
      if (h.kind === 'bridge') {
        h.revealAmount += (target - h.revealAmount) * Math.min(1, 3 * dt);
        h.mats[0].opacity = h.revealAmount * 0.9;
        h.mats[1].opacity = h.revealAmount * 0.85;
      } else if (h.kind === 'fragment') {
        if (!h.taken) {
          const cur = h.mesh.material.opacity;
          h.mesh.material.opacity = cur + (target - cur) * Math.min(1, 3 * dt);
        }
      } else if (h.kind === 'path') {
        const cur = h.mat.opacity;
        h.mat.opacity = cur + (target * 0.65 - cur) * Math.min(1, 3 * dt);
      } else if (h.kind === 'platform') {
        const cur = h.mat.opacity;
        h.mat.opacity = cur + ((h.revealTimer > 0 ? 0.95 : 0.35) - cur) * Math.min(1, 2 * dt);
        const rise = h.revealTimer > 0 ? 1.6 : 0;
        h.plat.position.y += ((h.baseY + rise + Math.sin(t * 1.4 + h.phase) * 0.15) - h.plat.position.y) * Math.min(1, 2.5 * dt);
        h.mat.emissiveIntensity += ((h.revealTimer > 0 ? 1.2 : 0.05) - h.mat.emissiveIntensity) * Math.min(1, 2.5 * dt);
        h.rim.material.opacity += ((h.revealTimer > 0 ? 0.8 : 0.06) - h.rim.material.opacity) * Math.min(1, 2.5 * dt);
        h.rim.position.y = h.plat.position.y + 0.22;
      }
    }

    // fragments spin & bob
    for (const f of this.fragments) {
      if (f.taken) continue;
      f.mesh.rotation.y = t * 1.6 + f.phase;
      f.mesh.rotation.x = Math.sin(t * 0.9 + f.phase) * 0.3;
      f.mesh.position.y = f.baseY + Math.sin(t * 2 + f.phase) * 0.25;
    }

    // towers
    for (const tw of this.towers) {
      if (tw.state === 'revealed') {
        tw.revealTimer -= dt;
        if (tw.revealTimer <= 0) tw.state = 'dormant';
      }
      const active = tw.state === 'active';
      const revealed = tw.state === 'revealed';
      const glowT = active ? 1.6 : revealed ? 0.9 : 0.06;
      tw.glowMat.emissiveIntensity += (glowT - tw.glowMat.emissiveIntensity) * Math.min(1, 2.5 * dt);
      tw.light.intensity += ((active ? 9 : revealed ? 5 : 0) - tw.light.intensity) * Math.min(1, 2.5 * dt);
      const pulse = 0.5 + Math.sin(t * (active ? 5 : 2.4)) * 0.5;
      tw.beacon.material.opacity = active ? 0.75 + pulse * 0.25 : revealed ? 0.3 + pulse * 0.5 : 0.18;
      for (const r of tw.rings) {
        r.rotation.z = t * (active ? 1.2 : 0.3);
        r.material.opacity = active ? 0.85 : revealed ? 0.55 : 0.12;
      }
      tw.beam.material.opacity += ((active ? 0.3 + pulse * 0.15 : 0) - tw.beam.material.opacity) * Math.min(1, 2 * dt);
      const labelT = active || revealed ? 0.95 : 0;
      tw.label.material.opacity += (labelT - tw.label.material.opacity) * Math.min(1, 2.5 * dt);
      if (tw.label.material.opacity > 0.02) tw.label.lookAt(camera.position);
    }

    // holo ads flicker
    for (const ad of this.holoAds) {
      const g = Math.sin(t * 7 + ad.phase) * Math.sin(t * 13.7 + ad.phase * 2);
      ad.mesh.material.opacity = ad.baseOpacity * (g > -0.85 ? 1 : 0.25) + this._pulseFlash * 0.3;
    }
    for (const st of this.stations) {
      st.holo.lookAt(camera.position);
      st.ringGlow.scale.setScalar(1 + Math.sin(t * 2.5) * 0.05);
      st.light.intensity = 4 + Math.sin(t * 2.5) * 1.2;
    }

    // traffic streaks
    for (const tr of this.traffic) {
      tr.off = (tr.off + tr.speed * dt + 340) % 340;
      const p = tr.off - 170;
      if (tr.alongX) tr.mesh.position.set(p, 13.6, -68 + tr.lane);
      else tr.mesh.position.set(-68 + tr.lane, 13.6, p);
    }

    // rooftop beacons blink
    for (const b of this.flickerLights) {
      b.mesh.material.color.setHex(Math.sin(t * 2.4 + b.phase) > 0.4 ? 0xff3355 : 0x441118);
    }

    // water shimmer
    for (const w of this.waterMats) w.emissiveIntensity = 0.3 + Math.sin(t * 1.8) * 0.12;

    // pulse flash / completion brightness
    if (this._pulseFlash > 0) this._pulseFlash = Math.max(0, this._pulseFlash - dt * 1.4);
    this.buildingMat.emissiveIntensity = this.dayEmissive + this._pulseFlash * 0.9 + this.cityBrightness;
  }

  pulseFlash() { this._pulseFlash = 1; }
}

