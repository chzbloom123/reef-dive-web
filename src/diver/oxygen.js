// The diver's air supply. It never kills or resets you (CLAUDE.md: no fail state); it just
// gives the dive a gentle rhythm of "go explore, come up for air".
//
//   drain per second = base rate × (1 + depth / 10) × (1.5 if kicking hard)
//
// That middle term is real physics: every 10 m of seawater adds one atmosphere of pressure, and a
// regulator delivers air at the surrounding pressure, so each breath at 10 m uses twice the air of a
// breath at the surface. That's why real divers' tanks run out faster when they go deeper.

const FULL_TANK_MINUTES_AT_10M = 8; // a full tank lasts about 8 minutes of swimming at 10 m
const BASE_RATE = 1 / (FULL_TANK_MINUTES_AT_10M * 60 * 2);
const REFILL_SECONDS = 6; // time at the surface to refill from empty
const SURFACE_DEPTH = 0.6; // within this far of the surface counts as "at the surface"

export function createOxygen() {
  let level = 1;
  let lastDepth = 0;
  return {
    get level() {
      return level;
    },
    get atSurface() {
      return lastDepth < SURFACE_DEPTH;
    },
    update(dt, depth, kicking) {
      lastDepth = depth;
      if (depth < SURFACE_DEPTH) level = Math.min(1, level + dt / REFILL_SECONDS);
      else level = Math.max(0, level - dt * BASE_RATE * (1 + depth / 10) * (kicking ? 1.5 : 1));
    },
  };
}
