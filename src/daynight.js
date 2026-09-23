// ============ ECHO COURIER — day/night atmosphere system ============
import * as THREE from 'three';

// presets: everything lerps smoothly over ~6 seconds
export const PRESETS = {
  day: {
    horizon: [0.55, 0.70, 0.85], mid: [0.35, 0.55, 0.78], top: [0.15, 0.34, 0.62],
    glow: 0.15,
    fog: 0x9db8cc, fogNear: 60, fogFar: 280,
    ambient: 1.7, hemi: 1.1, sunI: 1.25, sunC: 0xfff2dd, sunPos: [50, 120, 30],
    emissive: 0.22, stars: 0.0, lamps: 0.12, exposure: 1.0,
  },
  sunset: {
    horizon: [0.95, 0.44, 0.28], mid: [0.42, 0.22, 0.42], top: [0.09, 0.07, 0.22],
    glow: 0.55,
    fog: 0x7a4256, fogNear: 45, fogFar: 230,
    ambient: 1.0, hemi: 0.7, sunI: 0.95, sunC: 0xff9a55, sunPos: [-90, 28, 60],
    emissive: 0.55, stars: 0.15, lamps: 0.55, exposure: 1.1,
  },
  night: {
    horizon: [0.10, 0.05, 0.16], mid: [0.03, 0.03, 0.09], top: [0.005, 0.008, 0.03],
    glow: 0.85,
    fog: 0x070a18, fogNear: 30, fogFar: 150,
    ambient: 1.15, hemi: 0.65, sunI: 0.5, sunC: 0x8fb8ff, sunPos: [-60, 120, 40],
    emissive: 0.78, stars: 0.7, lamps: 1.0, exposure: 1.25,
  },
  dawn: {
    horizon: [0.80, 0.62, 0.55], mid: [0.38, 0.44, 0.60], top: [0.10, 0.16, 0.38],
    glow: 0.35,
    fog: 0x5f6f8a, fogNear: 55, fogFar: 250,
    ambient: 1.35, hemi: 0.9, sunI: 0.85, sunC: 0xffd0a8, sunPos: [70, 40, -50],
    emissive: 0.5, stars: 0.25, lamps: 0.4, exposure: 1.1,
  },
};

export class DayNight {
  constructor(game) {
    this.game = game;
    const w = game.world;
    this.refs = {
      skyMat: w.skyMat,
      fog: game.scene.fog,
      ambient: w.ambient,
      hemi: w.hemi,
      sun: w.moon,
      stars: w.stars,
      lamps: w.lampMat,
    };
    this.current = null;
    this.target = PRESETS.night;
    this.blend = 1;                 // 1 = fully at target
    // working values (start at night)
    this.vals = this.snapshot(PRESETS.night);
    this.apply(this.vals);
    this.set('night', true);
  }

  snapshot(p) {
    const c = new THREE.Color();
    return {
      horizon: [...p.horizon], mid: [...p.mid], top: [...p.top],
      glow: p.glow,
      fog: c.setHex(p.fog).clone(),
      fogNear: p.fogNear, fogFar: p.fogFar,
      ambient: p.ambient, hemi: p.hemi,
      sunI: p.sunI, sunC: new THREE.Color(p.sunC).clone(), sunPos: [...p.sunPos],
      emissive: p.emissive, stars: p.stars, lamps: p.lamps, exposure: p.exposure,
    };
  }

  set(timeKey, instant = false) {
    const p = PRESETS[timeKey] || PRESETS.night;
    this.targetName = timeKey;
    this.target = p;
    if (instant || !this.current) {
      this.vals = this.snapshot(p);
      this.apply(this.vals);
      this.blend = 1;
      this.current = timeKey;
    } else {
      this.from = { ...this.vals, fog: this.vals.fog.clone(), sunC: this.vals.sunC.clone() };
      this.blend = 0;
      this.current = timeKey;
    }
  }

  lerpColorInto(a, b, t, out) { out.copy(a).lerp(b, t); return out; }

  update(dt) {
    if (this.blend >= 1) return;
    this.blend = Math.min(1, this.blend + dt / 6);
    const t = this.blend;
    const f = this.from, T = this.target, v = this.vals;
    for (let i = 0; i < 3; i++) {
      v.horizon[i] = f.horizon[i] + (T.horizon[i] - f.horizon[i]) * t;
      v.mid[i] = f.mid[i] + (T.mid[i] - f.mid[i]) * t;
      v.top[i] = f.top[i] + (T.top[i] - f.top[i]) * t;
      v.sunPos[i] = f.sunPos[i] + (T.sunPos[i] - f.sunPos[i]) * t;
    }
    v.glow = f.glow + (T.glow - f.glow) * t;
    v.fog.lerpColors(f.fog, new THREE.Color(T.fog), t);
    v.fogNear = f.fogNear + (T.fogNear - f.fogNear) * t; v.fogFar = f.fogFar + (T.fogFar - f.fogFar) * t;
    v.ambient = f.ambient + (T.ambient - f.ambient) * t;
    v.hemi = f.hemi + (T.hemi - f.hemi) * t;
    v.sunI = f.sunI + (T.sunI - f.sunI) * t;
    v.sunC.lerpColors(f.sunC, new THREE.Color(T.sunC), t);
    v.emissive = f.emissive + (T.emissive - f.emissive) * t;
    v.stars = f.stars + (T.stars - f.stars) * t;
    v.lamps = f.lamps + (T.lamps - f.lamps) * t;
    v.exposure = f.exposure + (T.exposure - f.exposure) * t;
    this.apply(v);
  }

  apply(v) {
    const r = this.refs, g = this.game;
    if (r.skyMat) {
      r.skyMat.uniforms.uHorizon.value.setRGB(...v.horizon);
      r.skyMat.uniforms.uMid.value.setRGB(...v.mid);
      r.skyMat.uniforms.uTop.value.setRGB(...v.top);
      r.skyMat.uniforms.uGlow.value = v.glow;
    }
    if (r.fog) { r.fog.color.copy(v.fog); r.fog.near = v.fogNear; r.fog.far = v.fogFar; }
    if (r.ambient) r.ambient.intensity = v.ambient;
    if (r.hemi) r.hemi.intensity = v.hemi;
    if (r.sun) { r.sun.intensity = v.sunI; r.sun.color.copy(v.sunC); r.sun.position.set(...v.sunPos); }
    if (r.stars) r.stars.material.opacity = v.stars;
    if (r.lamps) r.lamps.color.setRGB(0.75 * v.lamps, 0.91 * v.lamps, v.lamps);
    g.world.dayEmissive = v.emissive;
    g.renderer.toneMappingExposure = v.exposure;
  }
}
