// ============ ECHO COURIER — tuning constants ============
export const CONFIG = {
  // world
  WORLD_SIZE: 170,            // half-extent of playable city
  FOG_COLOR: 0x070a18,
  FOG_NEAR: 30,
  FOG_FAR: 150,

  // player movement
  ACCEL: 26,
  BRAKE: 34,
  FRICTION: 5.2,
  MAX_SPEED: 15,
  BOOST_SPEED: 27,
  BOOST_ACCEL: 42,
  TURN_RATE: 2.6,             // rad/s at full lock
  PLAYER_RADIUS: 1.1,
  HOVER_HEIGHT: 0.55,

  // echo pulse
  PULSE_COST: 25,
  PULSE_COOLDOWN: 3.2,
  PULSE_RADIUS: 46,
  PULSE_DURATION: 1.6,        // visual wave lifetime
  REVEAL_DURATION: 14,        // how long hidden things stay lit

  // energy
  ENERGY_MAX: 100,
  ENERGY_REGEN: 1.6,          // passive regen per second
  FRAGMENT_ENERGY: 18,
  STATION_ENERGY_RATE: 30,    // per second while in station radius

  // delivery
  TOWER_COUNT: 4,
  DELIVER_RADIUS: 6.5,
  STATION_RADIUS: 5.5,
  FRAGMENT_RADIUS: 2.6,

  // camera
  CAM_DIST: 9.5,
  CAM_HEIGHT: 4.6,
  CAM_BOOST_DIST: 7.6,
  CAM_LAG: 4.2,               // follow smoothing
  CAM_FOV: 62,
  CAM_BOOST_FOV: 72,

  // fall / respawn
  FALL_Y: -2.2,
  RESPAWN_ENERGY_PENALTY: 12,

  // player health
  HP_MAX: 100,
  HP_REGEN_STATION: 22,       // per second at charge station
  CONTACT_INVULN: 0.7,        // seconds of invulnerability after a hit

  // laser
  LASER_DPS: 34,
  LASER_RANGE: 42,
  LASER_TICK: 0.09,           // damage tick interval while held

  // enemies
  ENEMY_MAX_ACTIVE: 6,
  ENEMY_SPAWN_MIN_DIST: 26,   // never spawn closer than this
  ENEMY_PROJECTILE_SPEED: 22,
};
