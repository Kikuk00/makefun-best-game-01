// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, paused, upgrade draft,
// victory and game over.
//
// ?seed=N fixes the wave patterns. ?shot=start|play|upgrade|victory (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_EMBER, EVENT_HIT, EVENT_KILL, EVENT_LANTERN_HIT, EVENT_NOVA_READY, EVENT_OVER, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_NOVA, ACTION_PAUSE, ACTION_PICK_1, ACTION_PICK_2, ACTION_PICK_3, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let novaQueued = false;
  let dashQueued = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    world.startWave(1);
    audio.waveHorn();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Defend the Heart Lantern through 10 waves.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) audio.victory();
    else audio.gameOver();
    announce(won ? `Victory! Score ${world.state.score}. Best ${best}.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function pickCard(index) {
    const draft = world.state.draft;
    if (index < 0 || index >= draft.length) return;
    const card = draft[index];
    audio.upgrade();
    announce(`Blessing chosen: ${card.name}. Wave ${world.state.wave + 1} begins.`);
    world.applyUpgrade(card.id);
    screen = SCREEN_PLAY;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      if (actions & ACTION_PICK_1) pickCard(0);
      else if (actions & ACTION_PICK_2) pickCard(1);
      else if (actions & ACTION_PICK_3) pickCard(2);
      else if (actions & ACTION_CONFIRM) {
        // A click on a card picks it: find which card the pointer is over.
        const pointer = renderer.toField(input.pointer().x, input.pointer().y);
        const rects = renderer.cardRects(world.state.draft.length);
        for (let i = 0; i < rects.length; i += 1) {
          const r = rects[i];
          if (pointer.x >= r.x && pointer.x <= r.x + r.width && pointer.y >= r.y && pointer.y <= r.y + r.height) {
            pickCard(i);
            return;
          }
        }
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (actions & ACTION_NOVA) {
        novaQueued = true;
      }
      if (actions & ACTION_DASH) dashQueued = true;
    }
  }

  function stepWorld() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { mx: 0, my: 0, aimX: 640, aimY: 200, firing: false, dash: false, nova: false }, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const pointer = renderer.toField(input.pointer().x, input.pointer().y);
    const move = input.move();
    const events = world.step(STEP, {
      mx: move.x,
      my: move.y,
      aimX: pointer.x,
      aimY: pointer.y,
      firing: input.firing,
      dash: dashQueued,
      nova: novaQueued,
    }, false);
    novaQueued = false;
    dashQueued = false;
    if (events & EVENT_NOVA_READY) announce('Radiance ready! Press E for the Nova.');
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_WAVE_CLEAR) {
      screen = SCREEN_UPGRADE;
      audio.waveHorn();
      announce(`Wave ${world.state.wave} cleared. Choose a blessing.`);
    }
    if (events & EVENT_HIT) {
      audio.hurt();
      // On the killing hit endGame already announced the ending; do not
      // overwrite it with a hit message.
      if (!(events & (EVENT_OVER | EVENT_WIN))) {
        announce(world.state.player.hp === 1 ? 'Hit. 1 heart left.' : `Hit. ${world.state.player.hp} hearts left.`);
      }
    }
    if (events & EVENT_LANTERN_HIT) audio.lanternHit();
    if (events & EVENT_KILL) audio.enemyDie();
    if (events & EVENT_EMBER) audio.ember();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        stepWorld();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting shadows feed unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberkeep. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
