// Keyboard and pointer input. Held keys give a movement vector; one-shot presses
// (start, restart, pause, nova, mute, upgrade picks) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost and never counted twice.
// The mouse aims: the loop converts the pointer's screen position to field coordinates.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_NOVA = 4;
export const ACTION_MUTE = 8;
export const ACTION_DASH = 16;
export const ACTION_PICK_1 = 32;
export const ACTION_PICK_2 = 64;
export const ACTION_PICK_3 = 128;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const NOVA = new Set(['KeyE']);
const MUTE = new Set(['KeyM']);
const DASH = new Set(['ShiftLeft', 'ShiftRight', 'KeyK']);
const FIRE_KEY = new Set(['KeyJ']);

export function createInput(canvas) {
  const keys = { up: false, down: false, left: false, right: false };
  let actions = 0;
  let firing = false;
  let mouseX = 640;
  let mouseY = 300;
  let mouseDown = false;

  function codeOf(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    const code = codeOf(event);
    if (UP.has(code)) keys.up = true;
    else if (DOWN.has(code)) keys.down = true;
    else if (LEFT.has(code)) keys.left = true;
    else if (RIGHT.has(code)) keys.right = true;
    else if (CONFIRM.has(code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (NOVA.has(code)) {
      if (!event.repeat) actions |= ACTION_NOVA;
    } else if (MUTE.has(code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (DASH.has(code)) {
      if (!event.repeat) actions |= ACTION_DASH;
    } else if (FIRE_KEY.has(code)) {
      firing = true;
    } else if (code === 'Digit1') {
      if (!event.repeat) actions |= ACTION_PICK_1;
    } else if (code === 'Digit2') {
      if (!event.repeat) actions |= ACTION_PICK_2;
    } else if (code === 'Digit3') {
      if (!event.repeat) actions |= ACTION_PICK_3;
    } else return;
    event.preventDefault();
  });

  window.addEventListener('keyup', (event) => {
    const code = codeOf(event);
    if (UP.has(code)) keys.up = false;
    else if (DOWN.has(code)) keys.down = false;
    else if (LEFT.has(code)) keys.left = false;
    else if (RIGHT.has(code)) keys.right = false;
    else if (FIRE_KEY.has(code)) firing = false;
  });

  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = false;
    firing = false;
    mouseDown = false;
  });

  function trackPointer(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  }

  canvas.addEventListener('pointermove', trackPointer);
  canvas.addEventListener('pointerdown', (event) => {
    trackPointer(event);
    mouseDown = true;
    // A click is also a confirm (start / restart / pick a card by clicking it).
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Normalised movement vector from the held keys. */
    move() {
      const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    /** Pointer position in canvas CSS pixels (the renderer maps it to the field). */
    pointer() {
      return { x: mouseX, y: mouseY };
    },
    get firing() {
      return firing || mouseDown;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
