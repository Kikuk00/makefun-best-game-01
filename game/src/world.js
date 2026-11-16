// Emberkeep's rules and state, with no drawing and no browser in it: the keeper, the
// Heart Lantern, the shadow creatures, bolts, embers and particles, waves, combos and
// the Radiance nova. step() advances one fixed step and returns what happened as bit
// flags, so the caller can react (sound, announcements) without the world knowing
// about screens. Nothing here allocates after createWorld returns, except the small
// floating-text strings.
//
// Enemies hunt the lantern or the keeper: motes chase the keeper, glooms and brutes
// march on the lantern, spitters keep their distance and shoot dark orbs, and the
// Nightmaw (wave 10) does all of it at once. A wave ends when its whole spawn queue
// is out and every foe is gone; then the world waits for the upgrade pick.

import {
  COMBO_MAX,
  COMBO_WINDOW,
  ENEMY,
  FIELD,
  LANTERN,
  PLAYER,
  RADIANCE_MAX,
  RADIANCE_PER_EMBER,
  STEP,
  WAVES,
  WAVE_TABLE,
} from './config.js';
import { draftUpgrades, UPGRADES as UPGRADES_LIST } from './upgrades.js';

const UPGRADES_BY_ID = {};
for (const u of UPGRADES_LIST) UPGRADES_BY_ID[u.id] = u;

export const KIND_MOTE = 0;
export const KIND_GLOOM = 1;
export const KIND_SPITTER = 2;
export const KIND_BRUTE = 3;
export const KIND_BOSS = 4;

const KIND_DEFS = [ENEMY.mote, ENEMY.gloom, ENEMY.spitter, ENEMY.brute, ENEMY.boss];
const KIND_NAMES = ['mote', 'gloom', 'spitter', 'brute', 'boss'];

export const EVENT_HIT = 1;
export const EVENT_EMBER = 2;
export const EVENT_KILL = 4;
export const EVENT_WAVE_CLEAR = 8;
export const EVENT_OVER = 16;
export const EVENT_WIN = 32;
export const EVENT_NOVA_READY = 64;
export const EVENT_LANTERN_HIT = 128;

const MAX_ENEMIES = 48;
const MAX_BULLETS = 96;
const MAX_EBULLETS = 64;
const MAX_EMBERS = 120;
const MAX_PARTICLES = 220;
const MAX_TEXTS = 24;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2,
    y: FIELD.height / 2 + 150,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    angle: -Math.PI / 2,
    hp: PLAYER.maxHp,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    invulnerable: 0,
    alive: true,
  };
  const lantern = { hp: LANTERN.maxHp, flicker: 0 };
  const enemies = [];
  for (let i = 0; i < MAX_ENEMIES; i += 1) {
    enemies.push({ active: false, kind: KIND_MOTE, x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, speed: 0, radius: 0, shootTimer: 0, biteTimer: 0, wobble: 0, target: 0 });
  }
  const bullets = [];
  for (let i = 0; i < MAX_BULLETS; i += 1) {
    bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, damage: 1, pierce: 0, life: 0, hit: null });
  }
  const ebullets = [];
  for (let i = 0; i < MAX_EBULLETS; i += 1) {
    ebullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  }
  const embers = [];
  for (let i = 0; i < MAX_EMBERS; i += 1) {
    embers.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, value: 1 });
  }
  const particles = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff' });
  }
  const texts = [];
  for (let i = 0; i < MAX_TEXTS; i += 1) {
    texts.push({ active: false, x: 0, y: 0, life: 0, str: '', color: '#fff' });
  }
  // Fireflies drift over the grove forever; they are scenery, not gameplay.
  const fireflies = [];
  for (let i = 0; i < 26; i += 1) {
    fireflies.push({ x: random() * FIELD.width, y: random() * FIELD.height, phase: random() * 6.28, speed: 0.4 + random() * 0.8 });
  }

  const mods = {
    damage: PLAYER.bulletDamage,
    fireInterval: PLAYER.fireInterval,
    projectiles: 1,
    pierce: 0,
    speed: PLAYER.speed,
    maxHp: PLAYER.maxHp,
    pickupRadius: PLAYER.pickupRadius,
    dashCooldown: PLAYER.dashCooldown,
    bulletSpeed: PLAYER.bulletSpeed,
  };

  const state = {
    player,
    lantern,
    enemies,
    bullets,
    ebullets,
    embers,
    particles,
    texts,
    fireflies,
    mods,
    score: 0,
    best: 0,
    combo: 0,
    comboTimer: 0,
    embersCollected: 0,
    radiance: 0,
    kills: 0,
    wave: 0,
    waveState: 'title',
    spawnQueue: [],
    spawnTimer: 0,
    waveTimer: 0,
    bannerTimer: 0,
    draft: [],
    levels: {},
    shake: 0,
    time: 0,
    novaFlash: 0,
  };

  function spawnParticle(x, y, color, count, speed) {
    for (let n = 0; n < count; n += 1) {
      const p = particles.find((q) => !q.active);
      if (!p) return;
      const a = random() * Math.PI * 2;
      const s = speed * (0.4 + random() * 0.8);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.life = p.maxLife = 0.4 + random() * 0.5;
      p.size = 2 + random() * 3;
      p.color = color;
    }
  }

  function floatText(x, y, str, color) {
    const t = texts.find((q) => !q.active) ?? texts[0];
    t.active = true;
    t.x = x;
    t.y = y;
    t.life = 1;
    t.str = str;
    t.color = color;
  }

  function dropEmbers(x, y, count) {
    for (let n = 0; n < count; n += 1) {
      const e = embers.find((q) => !q.active);
      if (!e) return;
      const a = random() * Math.PI * 2;
      e.active = true;
      e.x = x;
      e.y = y;
      e.vx = Math.cos(a) * 90;
      e.vy = Math.sin(a) * 90;
      e.value = 1;
    }
  }

  function spawnEnemy(kind) {
    const e = enemies.find((q) => !q.active);
    if (!e) return;
    const def = KIND_DEFS[kind];
    // Spawn just outside a random edge, never on top of the keeper: if the spot
    // is too close to the player, try another edge.
    const margin = 30;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const side = Math.floor(random() * 4);
      if (side === 0) { e.x = random() * FIELD.width; e.y = -margin; }
      else if (side === 1) { e.x = FIELD.width + margin; e.y = random() * FIELD.height; }
      else if (side === 2) { e.x = random() * FIELD.width; e.y = FIELD.height + margin; }
      else { e.x = -margin; e.y = random() * FIELD.height; }
      if (Math.hypot(e.x - player.x, e.y - player.y) > 240) break;
    }
    e.active = true;
    e.kind = kind;
    e.hp = e.maxHp = def.hp + Math.floor((state.wave - 1) / 3);
    e.speed = def.speed * (1 + (state.wave - 1) * 0.03);
    e.radius = def.radius;
    e.shootTimer = 1.5 + random() * 1.5;
    e.biteTimer = 0;
    e.wobble = random() * Math.PI * 2;
    // Motes and spitters hunt the keeper; glooms, brutes and the boss hunt the lantern.
    e.target = kind === KIND_MOTE || kind === KIND_SPITTER ? 1 : 0;
    e.vx = 0;
    e.vy = 0;
  }

  function startWave(n) {
    state.wave = n;
    state.waveState = 'fight';
    state.spawnQueue = [];
    const table = WAVE_TABLE[n - 1];
    for (const name of Object.keys(table)) {
      const kind = KIND_NAMES.indexOf(name);
      for (let i = 0; i < table[name]; i += 1) state.spawnQueue.push(kind);
    }
    // Shuffle the queue so the wave arrives mixed, boss first on wave 10.
    for (let i = state.spawnQueue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [state.spawnQueue[i], state.spawnQueue[j]] = [state.spawnQueue[j], state.spawnQueue[i]];
    }
    if (n === WAVES) {
      state.spawnQueue.sort((a, b) => (a === KIND_BOSS ? -1 : b === KIND_BOSS ? 1 : 0));
    }
    state.spawnTimer = 0.8;
    state.bannerTimer = 2.2;
    state.waveTimer = 0;
  }

  function livingEnemies() {
    let count = 0;
    for (const e of enemies) if (e.active) count += 1;
    return count;
  }

  function killEnemy(e, events) {
    const def = KIND_DEFS[e.kind];
    e.active = false;
    state.kills += 1;
    state.combo = Math.min(state.combo + 1, COMBO_MAX);
    state.comboTimer = COMBO_WINDOW;
    const mult = state.combo;
    const gained = def.score * mult;
    state.score += gained;
    floatText(e.x, e.y - e.radius, `+${gained}`, mult > 1 ? '#ffd76a' : '#f2ead8');
    dropEmbers(e.x, e.y, def.ember);
    spawnParticle(e.x, e.y, '#b388ff', e.kind === KIND_BOSS ? 40 : 10, 160);
    if (e.kind === KIND_BOSS) {
      state.shake = Math.max(state.shake, 0.6);
      spawnParticle(e.x, e.y, '#ff6b9d', 40, 260);
    }
    return events | EVENT_KILL;
  }

  function hurtPlayer(events) {
    if (player.invulnerable > 0 || player.dashTimer > 0 || !player.alive) return events;
    player.hp -= 1;
    player.invulnerable = PLAYER.invulnerable;
    state.combo = 0;
    state.comboTimer = 0;
    state.shake = Math.max(state.shake, 0.45);
    spawnParticle(player.x, player.y, '#9be7ff', 16, 220);
    if (player.hp <= 0) {
      player.alive = false;
      spawnParticle(player.x, player.y, '#9be7ff', 40, 300);
      return events | EVENT_HIT | EVENT_OVER;
    }
    return events | EVENT_HIT;
  }

  function hurtLantern(amount, events) {
    lantern.hp = Math.max(0, lantern.hp - amount);
    lantern.flicker = 0.5;
    state.shake = Math.max(state.shake, 0.3);
    spawnParticle(LANTERN.x, LANTERN.y, '#ffb347', 12, 180);
    if (lantern.hp <= 0) return events | EVENT_LANTERN_HIT | EVENT_OVER;
    return events | EVENT_LANTERN_HIT;
  }

  function fireNova() {
    if (state.radiance < RADIANCE_MAX) return 0;
    state.radiance = 0;
    state.novaFlash = 0.5;
    state.shake = Math.max(state.shake, 0.5);
    let events = 0;
    for (const e of enemies) {
      if (!e.active) continue;
      e.hp -= 8;
      spawnParticle(e.x, e.y, '#ffe9a8', 8, 200);
      if (e.hp <= 0) events = killEnemy(e, events);
    }
    for (const b of ebullets) b.active = false;
    return events;
  }

  function applyUpgrade(id) {
    const def = UPGRADES_BY_ID[id];
    if (!def) return;
    state.levels[id] = (state.levels[id] ?? 0) + 1;
    if (id === 'mend') {
      lantern.hp = Math.min(LANTERN.maxHp, lantern.hp + 45);
    } else if (id === 'heartwood') {
      def.apply(mods);
      player.hp = Math.min(mods.maxHp, player.hp + 1);
    } else {
      def.apply(mods);
    }
    state.draft = [];
    state.waveState = 'banner';
    startWave(state.wave + 1);
  }

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2 + 150;
    player.vx = 0;
    player.vy = 0;
    player.angle = -Math.PI / 2;
    player.hp = PLAYER.maxHp;
    player.fireTimer = 0;
    player.dashTimer = 0;
    player.dashCooldown = 0;
    player.invulnerable = 0;
    player.alive = true;
    lantern.hp = LANTERN.maxHp;
    lantern.flicker = 0;
    for (const e of enemies) e.active = false;
    for (const b of bullets) b.active = false;
    for (const b of ebullets) b.active = false;
    for (const e of embers) e.active = false;
    for (const p of particles) p.active = false;
    for (const t of texts) t.active = false;
    mods.damage = PLAYER.bulletDamage;
    mods.fireInterval = PLAYER.fireInterval;
    mods.projectiles = 1;
    mods.pierce = 0;
    mods.speed = PLAYER.speed;
    mods.maxHp = PLAYER.maxHp;
    mods.pickupRadius = PLAYER.pickupRadius;
    mods.dashCooldown = PLAYER.dashCooldown;
    mods.bulletSpeed = PLAYER.bulletSpeed;
    state.score = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.embersCollected = 0;
    state.radiance = 0;
    state.kills = 0;
    state.wave = 0;
    state.waveState = 'title';
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.waveTimer = 0;
    state.bannerTimer = 0;
    state.draft = [];
    state.levels = {};
    state.shake = 0;
    state.time = 0;
    state.novaFlash = 0;
  }

  /**
   * Advance one fixed step. `input` is {mx, my, aimX, aimY, firing, dash, nova} in
   * field coordinates; `attract` steps the grove behind the title screen, where
   * nothing can hurt the lantern and the keeper never shoots.
   */
  function step(dt, input, attract) {
    let events = 0;
    state.time += dt;
    lantern.flicker = Math.max(0, lantern.flicker - dt);
    state.shake = Math.max(0, state.shake - dt * 1.4);
    state.novaFlash = Math.max(0, state.novaFlash - dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    for (const f of fireflies) {
      f.phase += dt * f.speed;
      f.x += Math.cos(f.phase * 0.7) * 12 * dt;
      f.y += Math.sin(f.phase) * 10 * dt;
    }
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
    for (const t of texts) {
      if (!t.active) continue;
      t.life -= dt * 0.8;
      t.y -= 28 * dt;
      if (t.life <= 0) t.active = false;
    }

    if (attract) {
      // A gentle demo: a few motes drift around the lantern for the title screen.
      if (state.spawnTimer <= 0 && livingEnemies() < 5) {
        spawnEnemy(KIND_MOTE);
        state.spawnTimer = 1.2;
      }
      state.spawnTimer -= dt;
      for (const e of enemies) {
        if (!e.active) continue;
        e.wobble += dt * 2;
        const dx = LANTERN.x - e.x;
        const dy = LANTERN.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        e.x += (dx / d) * e.speed * 0.35 * dt + Math.cos(e.wobble) * 14 * dt;
        e.y += (dy / d) * e.speed * 0.35 * dt + Math.sin(e.wobble) * 14 * dt;
        if (d < LANTERN.radius + e.radius + 26) {
          e.x = LANTERN.x - (dx / d) * (LANTERN.radius + e.radius + 26);
          e.y = LANTERN.y - (dy / d) * (LANTERN.radius + e.radius + 26);
        }
      }
      return events;
    }

    if (state.waveState === 'upgrade') return events;
    if (state.waveState !== 'fight') return events;

    state.waveTimer += dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;

    // Spawning: a steady trickle, faster in later waves.
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0 && livingEnemies() < 26) {
        spawnEnemy(state.spawnQueue.shift());
        state.spawnTimer = Math.max(0.3, 1.0 - state.wave * 0.07);
      }
    }

    // --- Keeper movement, dash and aim ---
    if (player.alive) {
      const speed = player.dashTimer > 0 ? PLAYER.dashSpeed : mods.speed;
      player.vx = input.mx * speed;
      player.vy = input.my * speed;
      player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + player.vx * dt));
      player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y + player.vy * dt));
      player.angle = Math.atan2(input.aimY - player.y, input.aimX - player.x);
      player.invulnerable = Math.max(0, player.invulnerable - dt);
      player.dashCooldown = Math.max(0, player.dashCooldown - dt);
      if (input.dash && player.dashCooldown <= 0 && player.dashTimer <= 0) {
        player.dashTimer = PLAYER.dashTime;
        player.dashCooldown = mods.dashCooldown;
        spawnParticle(player.x, player.y, '#9be7ff', 8, 140);
      }
      if (player.dashTimer > 0) player.dashTimer -= dt;

      player.fireTimer -= dt;
      if (input.firing && player.fireTimer <= 0) {
        player.fireTimer = mods.fireInterval;
        const count = mods.projectiles;
        const spread = 0.14;
        for (let i = 0; i < count; i += 1) {
          const b = bullets.find((q) => !q.active);
          if (!b) break;
          const off = (i - (count - 1) / 2) * spread;
          const a = player.angle + off;
          b.active = true;
          b.x = player.x + Math.cos(a) * (player.radius + 8);
          b.y = player.y + Math.sin(a) * (player.radius + 8);
          b.vx = Math.cos(a) * mods.bulletSpeed;
          b.vy = Math.sin(a) * mods.bulletSpeed;
          b.damage = mods.damage;
          b.pierce = mods.pierce;
          b.life = 0.8;
          b.hit = null;
        }
      }
      if (input.nova) events |= fireNova();
    }

    // --- Bolts ---
    for (const b of bullets) {
      if (!b.active) continue;
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        b.active = false;
        continue;
      }
      for (const e of enemies) {
        if (!e.active) continue;
        if (b.hit === e) continue;
        if (dist2(b.x, b.y, e.x, e.y) < (5 + e.radius) * (5 + e.radius)) {
          e.hp -= b.damage;
          spawnParticle(b.x, b.y, '#ffd76a', 3, 110);
          if (e.hp <= 0) events = killEnemy(e, events);
          if (b.pierce > 0) {
            b.pierce -= 1;
            b.hit = e;
          } else {
            b.active = false;
          }
          break;
        }
      }
    }

    // --- Enemies ---
    for (const e of enemies) {
      if (!e.active) continue;
      e.wobble += dt * 2;
      const tx = e.target === 1 && player.alive ? player.x : LANTERN.x;
      const ty = e.target === 1 && player.alive ? player.y : LANTERN.y;
      const dx = tx - e.x;
      const dy = ty - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d;
      const ny = dy / d;
      let mx = nx;
      let my = ny;
      if (e.kind === KIND_SPITTER && d < 200) {
        // Spitters hold their distance and strafe.
        mx = -nx * 0.4 + -ny * 0.6;
        my = -ny * 0.4 + nx * 0.6;
      } else if (e.kind === KIND_MOTE) {
        mx = nx + Math.cos(e.wobble) * 0.35;
        my = ny + Math.sin(e.wobble) * 0.35;
        const ml = Math.hypot(mx, my) || 1;
        mx /= ml;
        my /= ml;
      }
      e.x += mx * e.speed * dt;
      e.y += my * e.speed * dt;

      // Spitters and the boss shoot dark orbs.
      if (e.kind === KIND_SPITTER || e.kind === KIND_BOSS) {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && d < 520) {
          e.shootTimer = e.kind === KIND_BOSS ? 1.6 : 2.6;
          const ob = ebullets.find((q) => !q.active);
          if (ob) {
            const aimX = player.alive ? player.x : LANTERN.x;
            const aimY = player.alive ? player.y : LANTERN.y;
            const adx = aimX - e.x;
            const ady = aimY - e.y;
            const ad = Math.hypot(adx, ady) || 1;
            const spd = e.kind === KIND_BOSS ? 260 : 190;
            ob.active = true;
            ob.x = e.x;
            ob.y = e.y;
            ob.vx = (adx / ad) * spd;
            ob.vy = (ady / ad) * spd;
            ob.life = 4;
          }
        }
      }

      // Biting the lantern or the keeper.
      const lanternD = Math.hypot(e.x - LANTERN.x, e.y - LANTERN.y);
      if (lanternD < LANTERN.radius + e.radius) {
        e.biteTimer -= dt;
        if (e.biteTimer <= 0) {
          e.biteTimer = 0.9;
          events = hurtLantern(KIND_DEFS[e.kind].bite, events);
          spawnParticle(e.x, e.y, '#ffb347', 6, 140);
          if (events & EVENT_OVER) return events;
        }
        // Push the biter back out so it does not sit inside the lantern.
        e.x = LANTERN.x + ((e.x - LANTERN.x) / (lanternD || 1)) * (LANTERN.radius + e.radius + 2);
        e.y = LANTERN.y + ((e.y - LANTERN.y) / (lanternD || 1)) * (LANTERN.radius + e.radius + 2);
      }
      if (player.alive) {
        const pd = Math.hypot(e.x - player.x, e.y - player.y);
        if (pd < player.radius + e.radius) {
          events = hurtPlayer(events);
          // Knock the foe back so one touch is one hit.
          e.x = player.x + ((e.x - player.x) / (pd || 1)) * (player.radius + e.radius + 6);
          e.y = player.y + ((e.y - player.y) / (pd || 1)) * (player.radius + e.radius + 6);
          if (events & EVENT_OVER) return events;
        }
      }
    }

    // --- Dark orbs ---
    for (const ob of ebullets) {
      if (!ob.active) continue;
      ob.life -= dt;
      ob.x += ob.vx * dt;
      ob.y += ob.vy * dt;
      if (ob.life <= 0 || ob.x < -20 || ob.x > FIELD.width + 20 || ob.y < -20 || ob.y > FIELD.height + 20) {
        ob.active = false;
        continue;
      }
      if (player.alive && dist2(ob.x, ob.y, player.x, player.y) < (8 + player.radius) * (8 + player.radius)) {
        ob.active = false;
        events = hurtPlayer(events);
        if (events & EVENT_OVER) return events;
      } else if (dist2(ob.x, ob.y, LANTERN.x, LANTERN.y) < (8 + LANTERN.radius) * (8 + LANTERN.radius)) {
        ob.active = false;
        events = hurtLantern(6, events);
        if (events & EVENT_OVER) return events;
      }
    }

    // --- Embers drift to the keeper ---
    for (const em of embers) {
      if (!em.active) continue;
      const dx = player.x - em.x;
      const dy = player.y - em.y;
      const d = Math.hypot(dx, dy) || 1;
      if (player.alive && d < mods.pickupRadius + 60) {
        const pull = 420 * (1 - d / (mods.pickupRadius + 260));
        em.vx += (dx / d) * pull * dt * 4;
        em.vy += (dy / d) * pull * dt * 4;
      }
      em.x += em.vx * dt;
      em.y += em.vy * dt;
      em.vx *= 0.94;
      em.vy *= 0.94;
      if (player.alive && d < player.radius + 12) {
        em.active = false;
        state.embersCollected += 1;
        state.score += 10;
        const wasFull = state.radiance >= RADIANCE_MAX;
        state.radiance = Math.min(RADIANCE_MAX, state.radiance + RADIANCE_PER_EMBER);
        if (!wasFull && state.radiance >= RADIANCE_MAX) events |= EVENT_NOVA_READY;
        events |= EVENT_EMBER;
      }
    }

    // --- Wave cleared? ---
    if (state.spawnQueue.length === 0 && livingEnemies() === 0) {
      if (state.wave >= WAVES) {
        state.waveState = 'won';
        return events | EVENT_WIN;
      }
      state.waveState = 'upgrade';
      state.draft = draftUpgrades(random, state.wave, state.levels, lantern.hp, LANTERN.maxHp);
      return events | EVENT_WAVE_CLEAR;
    }

    return events;
  }

  return {
    state,
    reset,
    startWave,
    applyUpgrade,
    step,
    /** The upgrade definitions, for the renderer and the main loop. */
    upgrades() {
      return UPGRADES_LIST;
    },
  };
}
