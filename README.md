# ECHO COURIER

*The city remembers every sound.*

A cinematic cyberpunk browser game. You are a futuristic courier on a neon hover-bike.
The city's communication network is failing — deliver energy capsules to four dormant
Signal Towers before the network goes silent. Use your **Echo Pulse** to reveal hidden
bridges, guide paths, dormant platforms, towers, and energy fragments in the dark.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run preview  # serve the production build
```

## Controls

| Input | Action |
| --- | --- |
| WASD / Arrow keys | Ride |
| Shift | Boost |
| Space / E | Echo Pulse / Deliver capsule (contextual) |
| Esc | Pause |
| M | Mute |

On touch devices a virtual joystick, PULSE and BOOST buttons appear automatically.

## Gameplay loop

1. Ride to an amber **CHARGE station** to refill Echo Energy and pick up a capsule.
2. Fire **Echo Pulses** (25 energy) to reveal hidden guide paths, bridges over the
   canals, and Signal Towers.
3. Deliver the capsule at a tower (E / Space when prompted) — network restoration
   climbs 25% per tower. Deliveries and stations restore energy; Echo Fragments
   scattered around the city give +18.
4. Activate all 4 towers → NETWORK RESTORED 100%.

Falling into a canal costs energy and reroutes you to safe ground.

## Tech

- Vite + Three.js (no other runtime deps)
- All audio is procedurally synthesized with the Web Audio API (music, ambience,
  engine, pulse, UI) — starts after the first user gesture per autoplay policy
- Instanced building/streetlight rendering, pooled GPU particle system,
  capped pixel ratio for performance
