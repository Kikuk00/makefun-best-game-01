// The upgrade draft offered between waves: three cards, pick one (click it or press
// 1, 2 or 3). Each upgrade has a level cap; the draft never offers a maxed one, and
// always offers Lantern Mend when the lantern is badly hurt.

export const UPGRADES = [
  {
    id: 'damage',
    name: 'Bright Bolts',
    desc: '+1 bolt damage',
    max: 4,
    apply(mods) {
      mods.damage += 1;
    },
  },
  {
    id: 'rapid',
    name: 'Rapid Glow',
    desc: '+20% fire rate',
    max: 4,
    apply(mods) {
      mods.fireInterval *= 0.83;
    },
  },
  {
    id: 'twin',
    name: 'Twin Light',
    desc: '+1 bolt per shot',
    max: 2,
    apply(mods) {
      mods.projectiles += 1;
      mods.damage *= 0.9;
    },
  },
  {
    id: 'pierce',
    name: 'Piercing Rays',
    desc: 'Bolts pierce +1 foe',
    max: 3,
    apply(mods) {
      mods.pierce += 1;
    },
  },
  {
    id: 'swift',
    name: 'Swift Wings',
    desc: '+15% move speed',
    max: 3,
    apply(mods) {
      mods.speed *= 1.15;
    },
  },
  {
    id: 'heartwood',
    name: 'Heartwood',
    desc: '+1 max heart, heal 1',
    max: 3,
    apply(mods) {
      mods.maxHp += 1;
    },
  },
  {
    id: 'mend',
    name: 'Lantern Mend',
    desc: 'Repair the lantern +45',
    max: 99,
    apply() {},
  },
  {
    id: 'magnet',
    name: 'Ember Magnet',
    desc: '+130 ember pickup range',
    max: 3,
    apply(mods) {
      mods.pickupRadius += 130;
    },
  },
  {
    id: 'dash',
    name: 'Feather Dash',
    desc: 'Dash recharges 35% faster',
    max: 3,
    apply(mods) {
      mods.dashCooldown *= 0.65;
    },
  },
  {
    id: 'reach',
    name: 'Long Reach',
    desc: '+25% bolt speed and range',
    max: 3,
    apply(mods) {
      mods.bulletSpeed *= 1.25;
    },
  },
];

/** The three cards for the draft after `wave`, given the levels already taken. */
export function draftUpgrades(random, wave, levels, lanternHp, lanternMax) {
  const pool = UPGRADES.filter((u) => (levels[u.id] ?? 0) < u.max);
  const picks = [];
  // A hurting lantern always gets a Mend card on offer.
  if (lanternHp < lanternMax * 0.6) {
    const mend = UPGRADES.find((u) => u.id === 'mend');
    if (mend) picks.push(mend);
  }
  const rest = pool.filter((u) => !picks.includes(u));
  while (picks.length < 3 && rest.length > 0) {
    const index = Math.floor(random() * rest.length);
    picks.push(rest.splice(index, 1)[0]);
  }
  // Shuffle so the Mend card is not always first.
  for (let i = picks.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [picks[i], picks[j]] = [picks[j], picks[i]];
  }
  return picks.slice(0, 3);
}
