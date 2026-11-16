// All drawing, in one place: the grove, the lantern's glow, every creature, the
// keeper, the HUD and the title / pause / upgrade / victory / game-over screens.
// The canvas is scaled to fit the window; toField() maps a pointer position back
// to the 1280x720 field so clicks land where the player aimed.

import { FIELD, FONT, LANTERN, PALETTE, RADIANCE_MAX } from './config.js';
import { KIND_BOSS, KIND_BRUTE, KIND_GLOOM, KIND_MOTE, KIND_SPITTER } from './world.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_UPGRADE = 4;
export const SCREEN_WIN = 5;

/** Deterministic pseudo-random from an integer, for scenery that never changes. */
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    scale = Math.min(w / FIELD.width, h / FIELD.height) * dpr;
    offsetX = (canvas.width - FIELD.width * scale) / 2;
    offsetY = (canvas.height - FIELD.height * scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  function toField(cssX, cssY) {
    return { x: (cssX * dpr - offsetX) / scale, y: (cssY * dpr - offsetY) / scale };
  }

  function drawBackground(state) {
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, '#0a0f1e');
    g.addColorStop(0.55, PALETTE.groveDeep);
    g.addColorStop(1, PALETTE.groveFloor);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Stars.
    ctx.fillStyle = '#cdd8ff';
    for (let i = 0; i < 70; i += 1) {
      const x = hash(i) * FIELD.width;
      const y = hash(i + 1000) * 300;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(state.time * 0.8 + i));
      ctx.globalAlpha = 0.25 + 0.45 * tw;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
    // Distant pine silhouettes along the top and bottom edges.
    ctx.fillStyle = '#0d1626';
    for (let i = 0; i < 22; i += 1) {
      const x = hash(i + 500) * FIELD.width;
      const hgt = 60 + hash(i + 700) * 110;
      const wdt = 26 + hash(i + 900) * 30;
      ctx.beginPath();
      ctx.moveTo(x - wdt / 2, 0);
      ctx.lineTo(x, -hgt * 0.4);
      ctx.lineTo(x + wdt / 2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - wdt / 2, FIELD.height);
      ctx.lineTo(x, FIELD.height + hgt * 0.4);
      ctx.lineTo(x + wdt / 2, FIELD.height);
      ctx.closePath();
      ctx.fill();
    }
    // Soft ground glow around the lantern.
    const glow = ctx.createRadialGradient(LANTERN.x, LANTERN.y, 10, LANTERN.x, LANTERN.y, 340);
    const flick = 0.16 + 0.05 * Math.sin(state.time * 7) + (state.lantern.flicker > 0 ? 0.12 : 0);
    glow.addColorStop(0, `rgba(255, 179, 71, ${flick + 0.1})`);
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawLantern(state) {
    const { x, y, radius } = LANTERN;
    const hpFrac = state.lantern.hp / 100;
    const pulse = 1 + 0.06 * Math.sin(state.time * 2.4);
    const glowR = (150 + 60 * hpFrac) * pulse;
    const glow = ctx.createRadialGradient(x, y, 8, x, y, glowR);
    glow.addColorStop(0, 'rgba(255, 233, 168, 0.85)');
    glow.addColorStop(0.35, `rgba(255, 179, 71, ${0.35 + 0.3 * hpFrac})`);
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, Math.PI * 2);
    ctx.fill();
    // Stone base, iron frame, glass core.
    ctx.fillStyle = '#2c3550';
    ctx.beginPath();
    ctx.ellipse(x, y + radius + 6, radius + 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a4a72';
    roundRect(ctx, x - radius * 0.62, y - radius, radius * 1.24, radius * 2, 10);
    ctx.fill();
    const core = ctx.createRadialGradient(x, y, 2, x, y, radius * 0.8);
    core.addColorStop(0, '#fff6cf');
    core.addColorStop(0.6, hpFrac > 0.35 ? '#ffb347' : '#ff7a5c');
    core.addColorStop(1, hpFrac > 0.35 ? '#e07b1f' : '#a33d2e');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.62, 0, Math.PI * 2);
    ctx.fill();
    // Flame.
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.ellipse(x, y - 4, 7, 12 + 3 * Math.sin(state.time * 9), 0, 0, Math.PI * 2);
    ctx.fill();
    // Health ring.
    ctx.strokeStyle = 'rgba(242, 234, 216, 0.85)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, radius + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpFrac);
    ctx.stroke();
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('HEART LANTERN', x, y + radius + 30);
  }

  function drawEnemy(e, state) {
    const wob = Math.sin(e.wobble * 3) * 2;
    ctx.save();
    ctx.translate(e.x, e.y + wob);
    if (e.kind === KIND_MOTE) {
      ctx.fillStyle = PALETTE.mote;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e9dcff';
      ctx.beginPath();
      ctx.arc(-4, -2, 2.5, 0, Math.PI * 2);
      ctx.arc(4, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a1a4d';
      ctx.beginPath();
      ctx.arc(-4, -2, 1.2, 0, Math.PI * 2);
      ctx.arc(4, -2, 1.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === KIND_GLOOM) {
      ctx.fillStyle = PALETTE.gloom;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6a4fb0';
      ctx.beginPath();
      ctx.arc(0, e.radius * 0.45, e.radius * 0.55, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.arc(-6, -3, 2.5, 0, Math.PI * 2);
      ctx.arc(6, -3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === KIND_SPITTER) {
      ctx.rotate(Math.sin(e.wobble) * 0.2);
      ctx.fillStyle = PALETTE.spitter;
      ctx.beginPath();
      ctx.moveTo(0, -e.radius);
      ctx.lineTo(e.radius, 0);
      ctx.lineTo(0, e.radius);
      ctx.lineTo(-e.radius, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2a1030';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === KIND_BRUTE) {
      ctx.fillStyle = PALETTE.brute;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        const px = Math.cos(a) * e.radius;
        const py = Math.sin(a) * e.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#c9a6ff';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#ff5c5c';
      ctx.beginPath();
      ctx.arc(-8, -4, 3, 0, Math.PI * 2);
      ctx.arc(8, -4, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === KIND_BOSS) {
      // The Nightmaw: a large spiked shadow with a glowing maw.
      ctx.fillStyle = PALETTE.boss;
      ctx.beginPath();
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2;
        const r = i % 2 === 0 ? e.radius + 10 : e.radius - 6;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2a0a1a';
      ctx.beginPath();
      ctx.ellipse(0, 6, 22, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(-14, -12, 4, 0, Math.PI * 2);
      ctx.arc(14, -12, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Health bar for tough foes.
    if (e.maxHp > 2 && e.hp < e.maxHp) {
      const w = e.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * (e.hp / e.maxHp), 5);
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (!p.alive) return;
    const blink = p.invulnerable > 0 && Math.floor(state.time * 14) % 2 === 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (blink) ctx.globalAlpha = 0.35;
    // Wings, flapping.
    const flap = Math.sin(state.time * 16) * 0.5;
    ctx.fillStyle = PALETTE.playerWing;
    ctx.globalAlpha *= 1;
    ctx.save();
    ctx.rotate(-0.7 - flap * 0.25);
    ctx.beginPath();
    ctx.ellipse(-12, -6, 13, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.rotate(0.7 + flap * 0.25);
    ctx.beginPath();
    ctx.ellipse(12, -6, 13, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Body and head, facing the aim.
    ctx.rotate(p.angle);
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b1020';
    ctx.beginPath();
    ctx.arc(6, -3, 1.8, 0, Math.PI * 2);
    ctx.arc(6, 3, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Little lantern staff pointing at the aim.
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(24, 0);
    ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(26, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Dash cooldown ring.
    if (p.dashCooldown > 0) {
      ctx.strokeStyle = 'rgba(155, 231, 255, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.dashCooldown / 2.4));
      ctx.stroke();
    }
  }

  function drawHud(state, screen) {
    const p = state.player;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Top bar.
    ctx.fillStyle = 'rgba(10, 15, 30, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, 56);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(`SCORE  ${state.score}`, 18, 37);
    ctx.font = `600 18px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`BEST  ${Math.max(state.best, state.score)}`, 250, 36);
    // Hearts.
    for (let i = 0; i < state.mods.maxHp; i += 1) {
      const x = 430 + i * 30;
      ctx.fillStyle = i < p.hp ? '#ff6b81' : 'rgba(255,107,129,0.25)';
      ctx.beginPath();
      ctx.arc(x, 26, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = i < p.hp ? '#ffd7de' : 'rgba(255,215,222,0.3)';
      ctx.beginPath();
      ctx.arc(x - 3, 23, 3, 0, Math.PI * 2);
      ctx.arc(x + 3, 23, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Wave.
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(state.wave === 0 ? 'THE GROVE' : `WAVE  ${state.wave} / 10`, FIELD.width / 2, 36);
    // Lantern HP bar.
    const barX = FIELD.width - 330;
    ctx.textAlign = 'left';
    ctx.font = `600 14px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('LANTERN', barX, 22);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, barX, 28, 180, 12, 6);
    ctx.fill();
    ctx.fillStyle = state.lantern.hp > 35 ? '#ffb347' : '#ff6b6b';
    roundRect(ctx, barX, 28, 180 * Math.max(0, state.lantern.hp / 100), 12, 6);
    ctx.fill();
    // Combo.
    if (state.combo > 1) {
      ctx.fillStyle = '#ffd76a';
      ctx.font = `800 22px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(`COMBO x${state.combo}`, FIELD.width - 18, 84);
    }
    // Radiance meter, bottom centre.
    const rw = 260;
    const rx = (FIELD.width - rw) / 2;
    const ry = FIELD.height - 34;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, rx, ry, rw, 12, 6);
    ctx.fill();
    const ready = state.radiance >= RADIANCE_MAX;
    ctx.fillStyle = ready ? '#ffe9a8' : '#c9a227';
    roundRect(ctx, rx, ry, rw * (state.radiance / RADIANCE_MAX), 12, 6);
    ctx.fill();
    ctx.fillStyle = ready ? '#ffe9a8' : PALETTE.muted;
    ctx.font = `700 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(ready ? 'RADIANCE READY — press E for the Nova!' : 'RADIANCE', FIELD.width / 2, ry - 6);
    // Wave banner.
    if (state.bannerTimer > 0 && screen === SCREEN_PLAY) {
      const a = Math.min(1, state.bannerTimer);
      ctx.globalAlpha = a;
      ctx.fillStyle = PALETTE.text;
      ctx.font = `800 44px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(state.wave === 10 ? 'THE NIGHTMAW AWAKENS' : `WAVE ${state.wave}`, FIELD.width / 2, 150);
      ctx.font = `600 20px ${FONT}`;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(state.wave === 10 ? 'Defeat it, and the grove endures.' : 'Defend the Heart Lantern!', FIELD.width / 2, 182);
      ctx.globalAlpha = 1;
    }
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(16, 22, 44, 0.92)';
    roundRect(ctx, x, y, w, h, 16);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(6, 9, 20, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(290, 92, 700, 470);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.lanternCore;
    ctx.font = `800 58px ${FONT}`;
    ctx.fillText('EMBERKEEP', FIELD.width / 2, 168);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText('Lantern of the Last Grove', FIELD.width / 2, 202);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `400 19px ${FONT}`;
    ctx.fillText('Shadow creatures crawl from the dark to snuff out', FIELD.width / 2, 252);
    ctx.fillText('the Heart Lantern. You are its last keeper.', FIELD.width / 2, 278);
    ctx.font = `600 18px ${FONT}`;
    ctx.fillStyle = '#cfe3ff';
    ctx.fillText('WASD / arrows — fly      Mouse — aim      Click / Space — shoot', FIELD.width / 2, 326);
    ctx.fillText('Shift — dash      E — Radiance Nova when the meter is full', FIELD.width / 2, 352);
    ctx.fillText('Survive all 10 waves. Pick a blessing between waves.', FIELD.width / 2, 378);
    ctx.fillStyle = PALETTE.ember;
    ctx.font = `800 24px ${FONT}`;
    ctx.fillText(best > 0 ? `BEST SCORE  ${best}` : 'PRESS SPACE OR CLICK TO BEGIN', FIELD.width / 2, 436);
    if (best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 18px ${FONT}`;
      ctx.fillText('Press Space or click to begin', FIELD.width / 2, 470);
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `400 15px ${FONT}`;
    ctx.fillText('P pauses · M mutes · your best score stays in this browser', FIELD.width / 2, 524);
  }

  function drawUpgrade(state) {
    ctx.fillStyle = 'rgba(6, 9, 20, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.good;
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText(`WAVE ${state.wave} CLEARED`, FIELD.width / 2, 130);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText('Choose a blessing — click a card or press 1, 2 or 3', FIELD.width / 2, 168);
    const cards = state.draft;
    const cw = 260;
    const ch = 210;
    const gap = 30;
    const total = cards.length * cw + (cards.length - 1) * gap;
    const x0 = (FIELD.width - total) / 2;
    const y0 = 230;
    cards.forEach((card, i) => {
      const x = x0 + i * (cw + gap);
      panel(x, y0, cw, ch);
      ctx.fillStyle = PALETTE.ember;
      ctx.font = `800 15px ${FONT}`;
      ctx.fillText(`BLESSING ${i + 1}`, x + cw / 2, y0 + 36);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `700 24px ${FONT}`;
      ctx.fillText(card.name, x + cw / 2, y0 + 84);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `400 18px ${FONT}`;
      ctx.fillText(card.desc, x + cw / 2, y0 + 118);
      ctx.fillStyle = '#cfe3ff';
      ctx.font = `600 15px ${FONT}`;
      ctx.fillText(`press ${i + 1} or click`, x + cw / 2, y0 + 168);
    });
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `400 16px ${FONT}`;
    ctx.fillText(`Score ${state.score} · Lantern ${Math.max(0, Math.round(state.lantern.hp))} · Hearts ${state.player.hp}`, FIELD.width / 2, 500);
  }

  function starsFor(state) {
    let stars = 1;
    if (state.lantern.hp >= 50) stars = 2;
    if (state.lantern.hp >= 80 && state.player.hp >= 2) stars = 3;
    return stars;
  }

  function drawEnd(state, best, won) {
    ctx.fillStyle = won ? 'rgba(20, 30, 10, 0.55)' : 'rgba(20, 6, 12, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(340, 110, 600, 440);
    ctx.textAlign = 'center';
    ctx.fillStyle = won ? PALETTE.good : PALETTE.bad;
    ctx.font = `800 46px ${FONT}`;
    ctx.fillText(won ? 'THE GROVE ENDURES' : 'THE LIGHT FADES', FIELD.width / 2, 186);
    if (won) {
      const stars = starsFor(state);
      ctx.fillStyle = PALETTE.ember;
      ctx.font = `400 44px ${FONT}`;
      ctx.fillText('★'.repeat(stars) + '☆'.repeat(3 - stars), FIELD.width / 2, 240);
    }
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 21px ${FONT}`;
    ctx.fillText(won ? 'The Nightmaw is gone. Dawn returns to the grove.' : 'The shadows took the lantern — or its keeper.', FIELD.width / 2, 292);
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(`SCORE  ${state.score}`, FIELD.width / 2, 344);
    ctx.font = `600 19px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Best  ${Math.max(best, state.score)}   ·   Waves cleared  ${won ? 10 : Math.max(0, state.wave - 1)}   ·   Foes felled  ${state.kills}`, FIELD.width / 2, 380);
    ctx.fillText(`Embers gathered  ${state.embersCollected}`, FIELD.width / 2, 410);
    ctx.fillStyle = PALETTE.ember;
    ctx.font = `800 22px ${FONT}`;
    ctx.fillText('PRESS SPACE OR CLICK TO PLAY AGAIN', FIELD.width / 2, 474);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(6, 9, 20, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(440, 250, 400, 180);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 38px ${FONT}`;
    ctx.fillText('PAUSED', FIELD.width / 2, 322);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 18px ${FONT}`;
    ctx.fillText('Press P or Space to keep playing', FIELD.width / 2, 362);
  }

  /** The upgrade cards' rectangles in field coordinates, for click picking. */
  function cardRects(count) {
    const cw = 260;
    const ch = 210;
    const gap = 30;
    const total = count * cw + (count - 1) * gap;
    const x0 = (FIELD.width - total) / 2;
    const rects = [];
    for (let i = 0; i < count; i += 1) {
      rects.push({ x: x0 + i * (cw + gap), y: 230, width: cw, height: ch });
    }
    return rects;
  }

  function draw(state, screen, best) {
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    // Screen shake.
    if (state.shake > 0) {
      const s = state.shake * 10;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    drawBackground(state);
    // Fireflies.
    for (const f of state.fireflies) {
      const a = 0.25 + 0.55 * Math.abs(Math.sin(f.phase));
      ctx.fillStyle = `rgba(255, 240, 160, ${a})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    drawLantern(state);
    // Embers.
    for (const em of state.embers) {
      if (!em.active) continue;
      const bob = Math.sin(state.time * 5 + em.x) * 2;
      ctx.fillStyle = PALETTE.ember;
      ctx.beginPath();
      ctx.arc(em.x, em.y + bob, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(em.x - 1.5, em.y + bob - 1.5, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const e of state.enemies) if (e.active) drawEnemy(e, state);
    // Dark orbs.
    for (const ob of state.ebullets) {
      if (!ob.active) continue;
      ctx.fillStyle = '#5b2a86';
      ctx.beginPath();
      ctx.arc(ob.x, ob.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c9a6ff';
      ctx.beginPath();
      ctx.arc(ob.x, ob.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Bolts.
    for (const b of state.bullets) {
      if (!b.active) continue;
      ctx.strokeStyle = PALETTE.bolt;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    drawPlayer(state);
    // Particles.
    for (const p of state.particles) {
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Floating texts.
    ctx.textAlign = 'center';
    for (const t of state.texts) {
      if (!t.active) continue;
      ctx.globalAlpha = Math.max(0, t.life);
      ctx.fillStyle = t.color;
      ctx.font = `700 16px ${FONT}`;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    // Nova flash.
    if (state.novaFlash > 0) {
      ctx.fillStyle = `rgba(255, 233, 168, ${state.novaFlash * 0.5})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (screen !== SCREEN_TITLE) drawHud(state, screen);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_UPGRADE) drawUpgrade(state);
    else if (screen === SCREEN_OVER) drawEnd(state, best, false);
    else if (screen === SCREEN_WIN) drawEnd(state, best, true);
    else if (screen === SCREEN_PAUSED) drawPaused();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { draw, toField, cardRects };
}
