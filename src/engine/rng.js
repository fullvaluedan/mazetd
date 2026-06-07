// =============================================================================
// rng.js — seeded random number generator.
//
// We use a tiny, fast, well-distributed generator (mulberry32). Seeding it means
// the same seed always produces the same map/obstacle layout and the same wave
// composition, which makes runs reproducible and balancing predictable.
// =============================================================================

export function makeRng(seed) {
  // mulberry32: a compact 32-bit PRNG. Good enough for a game, deterministic.
  let a = seed >>> 0;
  function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    // float in [0,1)
    next,
    // integer in [min, max] inclusive
    int(min, max) { return min + Math.floor(next() * (max - min + 1)); },
    // float in [min, max)
    range(min, max) { return min + next() * (max - min); },
    // pick a random element of an array
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    // true with probability p
    chance(p) { return next() < p; },
  };
}
