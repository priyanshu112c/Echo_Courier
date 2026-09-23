// ============ ECHO COURIER — 20-level configuration ============
// Objective types:
//   deliver:   activate N signal towers (capsule from CHARGE station)
//   fragments: collect N echo fragments
//   reveal:    reveal N hidden signals with Echo Pulse
//   destroy:   destroy N hostile drones
//   reach:     reach a location {x, z, label}
//   boss:      defeat the final villain
//
// Enemy roster: { scout, hunter, tank, elite } — total pool for the level,
// spawned in capped waves at spawn zones away from the player.

export const TIMES = { DAY: 'day', SUNSET: 'sunset', NIGHT: 'night', DAWN: 'dawn' };

const L = (id, name, time, objectives, enemies, opts = {}) => ({
  id, name, time, objectives, enemies,
  difficulty: 1 + (id - 1) * 0.16,      // global hp/damage scaling
  hint: opts.hint || '',
  boss: opts.boss || null,
  intro: opts.intro || null,
});

export const LEVELS = [
  L(1, 'FIRST DELIVERY', TIMES.DAY, [
    { type: 'reveal', count: 3, label: 'Reveal 3 hidden signals with Echo Pulse' },
    { type: 'fragments', count: 3, label: 'Collect 3 Echo Fragments' },
    { type: 'deliver', count: 2, label: 'Energize 2 Signal Towers' },
  ], { scout: 0, hunter: 0, tank: 0, elite: 0 },
  { hint: 'Learn the city. SPACE fires an Echo Pulse — it reveals what the dark hides.' }),

  L(2, 'STATIC IN THE ALLEYS', TIMES.DAY, [
    { type: 'destroy', count: 3, label: 'Destroy 3 Scout Drones' },
    { type: 'deliver', count: 1, label: 'Energize 1 Signal Tower' },
  ], { scout: 5, hunter: 0, tank: 0, elite: 0 },
  { hint: 'Hostile drones patrol the streets. HOLD LEFT MOUSE BUTTON to fire your laser.' }),

  L(3, 'CROSSED SIGNALS', TIMES.SUNSET, [
    { type: 'destroy', count: 5, label: 'Destroy 5 hostile drones' },
    { type: 'deliver', count: 2, label: 'Energize 2 Signal Towers' },
  ], { scout: 5, hunter: 2, tank: 0, elite: 0 }),

  L(4, 'NIGHT SHIFT', TIMES.NIGHT, [
    { type: 'fragments', count: 5, label: 'Collect 5 Echo Fragments' },
    { type: 'destroy', count: 4, label: 'Destroy 4 hostile drones' },
    { type: 'deliver', count: 2, label: 'Energize 2 Signal Towers' },
  ], { scout: 5, hunter: 2, tank: 0, elite: 0 }),

  L(5, 'DARK CHANNELS', TIMES.NIGHT, [
    { type: 'destroy', count: 6, label: 'Destroy 6 hostile drones' },
    { type: 'deliver', count: 3, label: 'Energize 3 Signal Towers' },
  ], { scout: 6, hunter: 3, tank: 0, elite: 0 },
  { hint: 'Hunters fire back. Keep moving.' }),

  L(6, 'DAWN PATROL', TIMES.DAWN, [
    { type: 'reveal', count: 6, label: 'Reveal 6 hidden signals' },
    { type: 'fragments', count: 8, label: 'Collect 8 Echo Fragments' },
    { type: 'destroy', count: 5, label: 'Destroy 5 hostile drones' },
  ], { scout: 5, hunter: 3, tank: 0, elite: 0 }),

  L(7, 'HEAVY METAL', TIMES.SUNSET, [
    { type: 'destroy', count: 6, label: 'Destroy 6 hostile drones' },
    { type: 'deliver', count: 2, label: 'Energize 2 Signal Towers' },
  ], { scout: 4, hunter: 2, tank: 2, elite: 0 },
  { hint: 'Tank drones are slow but armored. Aim for sustained laser fire.' }),

  L(8, 'CROSSTOWN TRAFFIC', TIMES.NIGHT, [
    { type: 'destroy', count: 8, label: 'Destroy 8 hostile drones' },
    { type: 'deliver', count: 3, label: 'Energize 3 Signal Towers' },
  ], { scout: 6, hunter: 4, tank: 2, elite: 0 }),

  L(9, 'RELAY RACE', TIMES.NIGHT, [
    { type: 'reach', x: 0, z: 40, r: 7, label: 'Reach the Central Plaza' },
    { type: 'deliver', count: 4, label: 'Energize all 4 Signal Towers' },
    { type: 'destroy', count: 6, label: 'Destroy 6 hostile drones' },
  ], { scout: 6, hunter: 4, tank: 1, elite: 0 }),

  L(10, 'GATEKEEPER', TIMES.NIGHT, [
    { type: 'destroy', count: 7, label: 'Break the blockade (7 drones)' },
    { type: 'deliver', count: 2, label: 'Energize 2 Signal Towers' },
  ], { scout: 4, hunter: 3, tank: 1, elite: 1 },
  { hint: 'An Elite drone leads this blockade. It shields itself — pulse to expose it.' }),

  L(11, 'STORM LINES', TIMES.DAWN, [
    { type: 'destroy', count: 10, label: 'Destroy 10 hostile drones' },
    { type: 'fragments', count: 6, label: 'Collect 6 Echo Fragments' },
  ], { scout: 7, hunter: 4, tank: 2, elite: 0 }),

  L(12, 'ECHO MAPPING', TIMES.SUNSET, [
    { type: 'reveal', count: 10, label: 'Reveal 10 hidden signals' },
    { type: 'fragments', count: 8, label: 'Collect 8 Echo Fragments' },
    { type: 'deliver', count: 2, label: 'Energize 2 Signal Towers' },
  ], { scout: 5, hunter: 3, tank: 1, elite: 1 }),

  L(13, 'BLACKOUT PROTOCOL', TIMES.NIGHT, [
    { type: 'deliver', count: 4, label: 'Energize all 4 Signal Towers' },
    { type: 'destroy', count: 8, label: 'Destroy 8 hostile drones' },
  ], { scout: 6, hunter: 4, tank: 2, elite: 1 }),

  L(14, 'IRON DISTRICT', TIMES.NIGHT, [
    { type: 'destroy', count: 12, label: 'Destroy 12 hostile drones' },
  ], { scout: 5, hunter: 4, tank: 4, elite: 1 }),

  L(15, 'ELITE HUNT', TIMES.NIGHT, [
    { type: 'destroy', count: 9, label: 'Destroy 9 hostile drones' },
    { type: 'deliver', count: 2, label: 'Energize 2 Signal Towers' },
  ], { scout: 4, hunter: 4, tank: 2, elite: 3 },
  { hint: 'Multiple Elites active. Use Echo Pulse to strip their stealth.' }),

  L(16, 'SIEGE', TIMES.NIGHT, [
    { type: 'destroy', count: 14, label: 'Break the siege (14 drones)' },
    { type: 'fragments', count: 5, label: 'Collect 5 Echo Fragments' },
  ], { scout: 7, hunter: 5, tank: 3, elite: 2 }),

  L(17, 'OVERDRIVE', TIMES.NIGHT, [
    { type: 'deliver', count: 4, label: 'Energize all 4 Signal Towers' },
    { type: 'destroy', count: 12, label: 'Destroy 12 hostile drones' },
  ], { scout: 7, hunter: 5, tank: 3, elite: 2 }),

  L(18, 'LAST MILE', TIMES.NIGHT, [
    { type: 'reach', x: -62, z: -62, r: 9, label: 'Scout the NW rooftop relay' },
    { type: 'reach', x: 60, z: 62, r: 9, label: 'Scout the SE rooftop relay' },
    { type: 'destroy', count: 10, label: 'Destroy 10 hostile drones' },
    { type: 'deliver', count: 2, label: 'Energize 2 Signal Towers' },
  ], { scout: 6, hunter: 5, tank: 3, elite: 2 }),

  L(19, 'FINAL PREPARATION', TIMES.DAWN, [
    { type: 'fragments', count: 10, label: 'Charge up: collect 10 Echo Fragments' },
    { type: 'destroy', count: 12, label: 'Destroy 12 hostile drones' },
    { type: 'deliver', count: 3, label: 'Energize 3 Signal Towers' },
  ], { scout: 7, hunter: 5, tank: 3, elite: 3 },
  { hint: 'Something enormous is broadcasting from the Central Plaza. Be ready.' }),

  L(20, 'THE SIGNAL WARDEN', TIMES.NIGHT, [
    { type: 'boss', label: 'Defeat THE SIGNAL WARDEN' },
  ], { scout: 4, hunter: 2, tank: 0, elite: 0 },
  {
    boss: { name: 'THE SIGNAL WARDEN', hp: 1600 },
    intro: 'WARNING — MASSIVE SIGNAL SOURCE DETECTED AT CENTRAL PLAZA',
  }),
];

export function getLevel(id) {
  return LEVELS[Math.min(20, Math.max(1, id)) - 1];
}

// spawn zones spread across the city quadrants (away from spawn plaza)
export const SPAWN_ZONES = [
  { x: -62, z: -62 }, { x: 62, z: -58 }, { x: -60, z: 60 }, { x: 60, z: 62 },
  { x: -51, z: 0 }, { x: 51, z: 0 }, { x: 0, z: -51 }, { x: -17, z: 68 },
  { x: 17, z: -68 }, { x: 51, z: 34 }, { x: -51, z: -34 },
];

