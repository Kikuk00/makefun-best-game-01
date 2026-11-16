// A small seeded random number generator (mulberry32): the same seed gives the same
// game, which is what makes the screenshot scenes repeatable and the waves fair.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one element of `items` using `random`, weighted by `weightOf`. */
export function pickWeighted(random, items, weightOf) {
  let total = 0;
  for (const item of items) total += weightOf(item);
  let roll = random() * total;
  for (const item of items) {
    roll -= weightOf(item);
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}
