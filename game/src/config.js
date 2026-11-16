// Emberkeep — every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. All art is drawn in code; there are no image or sound assets.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberkeep.best';

/** The Heart Lantern stands at the centre of the grove and must not go out. */
export const LANTERN = { x: 640, y: 360, radius: 34, maxHp: 100 };

export const PLAYER = {
  radius: 14,
  speed: 300,
  maxHp: 3,
  fireInterval: 0.24,
  bulletSpeed: 640,
  bulletDamage: 1,
  bulletRadius: 5,
  dashSpeed: 920,
  dashTime: 0.18,
  dashCooldown: 2.4,
  invulnerable: 1.4,
  pickupRadius: 90,
};

export const RADIANCE_MAX = 100;
/** Embers needed, on average, to fill the Radiance meter once. */
export const RADIANCE_PER_EMBER = 4;

/** Waves: the last wave is the boss, the Nightmaw. */
export const WAVES = 10;

/** Enemy kinds, by the number the world uses for them. */
export const ENEMY = {
  mote: { hp: 1, speed: 118, radius: 11, score: 50, bite: 6, ember: 1 },
  gloom: { hp: 3, speed: 62, radius: 17, score: 100, bite: 12, ember: 2 },
  spitter: { hp: 2, speed: 48, radius: 14, score: 150, bite: 8, ember: 2 },
  brute: { hp: 14, speed: 34, radius: 26, score: 300, bite: 20, ember: 4 },
  boss: { hp: 150, speed: 28, radius: 44, score: 2000, bite: 30, ember: 12 },
};

/** How many of each kind a wave fields, before the wave's size bonus. */
export const WAVE_TABLE = [
  { mote: 10 },
  { mote: 12, gloom: 3 },
  { mote: 14, gloom: 5, spitter: 2 },
  { mote: 14, gloom: 6, spitter: 3, brute: 1 },
  { mote: 16, gloom: 7, spitter: 4, brute: 2 },
  { mote: 16, gloom: 8, spitter: 5, brute: 2 },
  { mote: 18, gloom: 9, spitter: 6, brute: 3 },
  { mote: 18, gloom: 10, spitter: 6, brute: 4 },
  { mote: 20, gloom: 11, spitter: 7, brute: 4 },
  { boss: 1, mote: 8, spitter: 2 },
];

export const COMBO_WINDOW = 3;
/** Combo multiplier caps at x5. */
export const COMBO_MAX = 5;

export const PALETTE = {
  backdrop: '#0b1020',
  groveDeep: '#101a2e',
  groveFloor: '#16233a',
  lanternGlow: '#ffb347',
  lanternCore: '#ffe9a8',
  player: '#9be7ff',
  playerWing: '#e6f7ff',
  bolt: '#ffd76a',
  mote: '#b388ff',
  gloom: '#8e6fd8',
  spitter: '#d870c8',
  brute: '#7a4fd0',
  boss: '#e0407a',
  ember: '#ffcf5c',
  text: '#f2ead8',
  muted: '#9aa7bd',
  panel: '#1a2440',
  panelEdge: '#3a4a72',
  good: '#7be495',
  bad: '#ff6b6b',
};

export const FONT = '"Trebuchet MS", system-ui, -apple-system, "Segoe UI", sans-serif';
