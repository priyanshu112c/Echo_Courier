// ============ ECHO COURIER — pooled particle system ============
import * as THREE from 'three';

const MAX = 1400;

function makeDotTexture() {
  const s = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv);
  return tex;
}

export class ParticleSystem {
  constructor(scene) {
    this.count = MAX;
    this.positions = new Float32Array(MAX * 3);
    this.colors = new Float32Array(MAX * 3);
    this.sizes = new Float32Array(MAX);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);      // remaining
    this.maxLife = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.drag = new Float32Array(MAX);
    this.baseSize = new Float32Array(MAX);
    this.head = 0;
    this.active = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));

    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: makeDotTexture() } },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (240.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map;
        varying vec3 vColor;
        void main() {
          vec4 tex = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(vColor, tex.a);
        }`,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    // park all particles far below
    for (let i = 0; i < MAX; i++) this.positions[i * 3 + 1] = -999;

    this._c = new THREE.Color();
  }

  spawn(x, y, z, opts = {}) {
    const i = this.head;
    this.head = (this.head + 1) % MAX;
    const i3 = i * 3;
    this.positions[i3] = x;
    this.positions[i3 + 1] = y;
    this.positions[i3 + 2] = z;
    const spread = opts.spread ?? 0.4;
    const speed = opts.speed ?? 3;
    this.vel[i3] = (opts.vx ?? 0) + (Math.random() - 0.5) * spread * speed;
    this.vel[i3 + 1] = (opts.vy ?? 0) + (Math.random() - 0.5) * spread * speed * 0.6;
    this.vel[i3 + 2] = (opts.vz ?? 0) + (Math.random() - 0.5) * spread * speed;
    const life = (opts.life ?? 1) * (0.6 + Math.random() * 0.7);
    this.life[i] = life;
    this.maxLife[i] = life;
    this.grav[i] = opts.gravity ?? 0;
    this.drag[i] = opts.drag ?? 1.5;
    this.baseSize[i] = (opts.size ?? 1.6) * (0.7 + Math.random() * 0.6);
    this._c.set(opts.color ?? 0x28e7ff);
    const b = opts.brightness ?? 1;
    this.colors[i3] = this._c.r * b;
    this.colors[i3 + 1] = this._c.g * b;
    this.colors[i3 + 2] = this._c.b * b;
  }

  burst(pos, n, opts = {}) {
    for (let k = 0; k < n; k++) this.spawn(pos.x, pos.y, pos.z, opts);
  }

  // radial ring burst (for echo pulse)
  ringBurst(pos, n, opts = {}) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.15;
      const sp = (opts.speed ?? 14) * (0.85 + Math.random() * 0.3);
      this.spawn(pos.x, pos.y + 0.4, pos.z, {
        ...opts,
        vx: Math.cos(a) * sp,
        vz: Math.sin(a) * sp,
        vy: (Math.random() - 0.2) * 1.5,
        spread: 0.05,
      });
    }
  }

  update(dt) {
    const p = this.positions, v = this.vel;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const i3 = i * 3;
      if (this.life[i] <= 0) {
        p[i3 + 1] = -999;
        this.sizes[i] = 0;
        continue;
      }
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      v[i3] *= dr; v[i3 + 2] *= dr;
      v[i3 + 1] = v[i3 + 1] * dr - this.grav[i] * dt;
      p[i3] += v[i3] * dt;
      p[i3 + 1] += v[i3 + 1] * dt;
      p[i3 + 2] += v[i3 + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.sizes[i] = this.baseSize[i] * (t < 0.7 ? t / 0.7 : 1);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.size.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
