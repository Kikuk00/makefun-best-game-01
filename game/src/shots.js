// The screenshot scenes behind ?shot=start|play|upgrade|victory. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot (aim at the most dangerous foe, keep your distance, chase embers,
// dash out of trouble), so the frame is what a real game looks like and the same
// seed always gives the same frame. The victory scene plays a whole run and picks
// the strongest blessing after every wave.

import { FIELD, LANTERN, STEP } from './config.js';
import { EVENT_OVER, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 79;
const SIM_LIMIT_SECONDS = 600;

/** The autopilot's input for one step: where to fly, where to aim, what to do. */
export function autopilot(world) {
  const s = world.state;
  const p = s.player;
  let nearest = null;
  let nearestD = Infinity;
  let threat = null;
  let threatD = Infinity;
  for (const e of s.enemies) {
    if (!e.active) continue;
    const dp = Math.hypot(e.x - p.x, e.y - p.y);
    if (dp < nearestD) {
      nearestD = dp;
      nearest = e;
    }
    const dl = Math.hypot(e.x - LANTERN.x, e.y - LANTERN.y);
    if (dl < threatD) {
      threatD = dl;
      threat = e;
    }
  }
  const input = { mx: 0, my: 0, aimX: p.x, aimY: p.y - 100, firing: false, dash: false, nova: false };
  if (!nearest) {
    // Nothing to shoot: drift back to a guard post beside the lantern.
    const gx = LANTERN.x + 190;
    const gy = LANTERN.y + 120;
    const dx = gx - p.x;
    const dy = gy - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 24) {
      input.mx = dx / d;
      input.my = dy / d;
    }
    return input;
  }
  // Aim at the foe nearest the lantern when one is closing in, else the nearest foe.
  const target = threatD < 320 ? threat : nearest;
  input.aimX = target.x;
  input.aimY = target.y;
  input.firing = true;
  // Move: flee the nearest foe when it is close, else drift toward the nearest ember,
  // else hold a guard orbit around the lantern.
  let mx = 0;
  let my = 0;
  if (nearestD < 130) {
    mx = (p.x - nearest.x) / nearestD;
    my = (p.y - nearest.y) / nearestD;
    if (nearestD < 70 && p.dashCooldown <= 0) input.dash = true;
  } else {
    let ember = null;
    let emberD = Infinity;
    for (const em of s.embers) {
      if (!em.active) continue;
      const d = Math.hypot(em.x - p.x, em.y - p.y);
      if (d < emberD) {
        emberD = d;
        ember = em;
      }
    }
    if (ember && emberD < 260) {
      mx = (ember.x - p.x) / emberD;
      my = (ember.y - p.y) / emberD;
    } else {
      // Guard orbit: circle the lantern at ~200px, slowly.
      const ang = Math.atan2(p.y - LANTERN.y, p.x - LANTERN.x) + 0.35;
      const gx = LANTERN.x + Math.cos(ang) * 200;
      const gy = LANTERN.y + Math.sin(ang) * 200;
      const dx = gx - p.x;
      const dy = gy - p.y;
      const d = Math.hypot(dx, dy) || 1;
      mx = dx / d;
      my = dy / d;
    }
  }
  // Never sit on top of the lantern.
  const ldx = p.x - LANTERN.x;
  const ldy = p.y - LANTERN.y;
  const ld = Math.hypot(ldx, ldy) || 1;
  if (ld < LANTERN.radius + 40) {
    mx += (ldx / ld) * 1.5;
    my += (ldy / ld) * 1.5;
  }
  const ml = Math.hypot(mx, my) || 1;
  input.mx = mx / ml;
  input.my = my / ml;
  // Nova when the meter is full and the field is crowded.
  let foes = 0;
  for (const e of s.enemies) if (e.active) foes += 1;
  if (s.radiance >= 100 && foes >= 4) input.nova = true;
  return input;
}

/** Which blessing the autopilot takes: damage first, then fire rate, then the rest. */
const PICK_ORDER = ['damage', 'rapid', 'twin', 'pierce', 'mend', 'heartwood', 'swift', 'magnet', 'dash', 'reach'];

function autoPick(world) {
  const draft = world.state.draft;
  if (draft.length === 0) return;
  let best = draft[0];
  for (const card of draft) {
    if (PICK_ORDER.indexOf(card.id) < PICK_ORDER.indexOf(best.id)) best = card;
  }
  // Mend only when the lantern actually needs it.
  if (best.id === 'mend' && world.state.lantern.hp > 60) {
    const other = draft.find((c) => c.id !== 'mend');
    if (other) best = other;
  }
  world.applyUpgrade(best.id);
}

/**
 * Set `world` to the named scene (start, play, upgrade or victory; any other name
 * is start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'upgrade' && name !== 'victory') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { mx: 0, my: 0, aimX: 640, aimY: 200, firing: false, dash: false, nova: false }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  world.startWave(1);
  let guard = 0;
  if (name === 'play') {
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      const events = world.step(STEP, autopilot(world), false);
      if (events & EVENT_OVER) break;
      if (world.state.waveState === 'upgrade') {
        // Play scene wants a fight, not the draft: take a blessing and carry on.
        autoPick(world);
      }
    }
    return { screen: world.state.player.alive ? SCREEN_PLAY : SCREEN_OVER, best: world.state.score };
  }
  if (name === 'upgrade') {
    for (let i = 0; i < SIM_LIMIT_SECONDS / STEP; i += 1) {
      const events = world.step(STEP, autopilot(world), false);
      if (events & EVENT_OVER) break;
      if (world.state.waveState === 'upgrade') return { screen: SCREEN_UPGRADE, best: world.state.score };
      if (events & EVENT_WAVE_CLEAR && world.state.waveState === 'upgrade') return { screen: SCREEN_UPGRADE, best: world.state.score };
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  // Victory: play the whole run, picking blessings, until the Nightmaw falls.
  for (let i = 0; i < SIM_LIMIT_SECONDS / STEP; i += 1) {
    guard += 1;
    const events = world.step(STEP, autopilot(world), false);
    if (events & EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
    if (events & EVENT_OVER) break;
    if (world.state.waveState === 'upgrade') autoPick(world);
    if (guard > SIM_LIMIT_SECONDS / STEP) break;
  }
  return { screen: world.state.waveState === 'won' ? SCREEN_WIN : SCREEN_OVER, best: world.state.score };
}
