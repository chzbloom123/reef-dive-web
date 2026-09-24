// A seeded random number generator ("mulberry32").
// Math.random() gives a different reef every page load; a seed gives the same reef every time,
// which keeps screenshots comparable and lets you change one number to get a whole new layout.

export function createRandom(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next, // 0 (inclusive) to 1 (exclusive)
    range: (min, max) => min + (max - min) * next(),
    pick: (list) => list[Math.floor(next() * list.length)],
  };
}
