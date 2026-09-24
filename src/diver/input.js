// Keyboard and mouse input.
//
// "Pointer lock" hides the mouse cursor and reports raw movement instead of a screen position,
// so you can turn forever without the cursor hitting the screen edge. Browsers only grant it after
// a click, which is why the game starts with "Click to dive". Pressing Esc always releases the lock
// (the browser enforces this so a page can't trap your mouse), and we treat that as "pause".

// Windows browsers occasionally report a huge bogus jump in mouse movement right after locking.
// Ignoring any single report bigger than this keeps the view from suddenly spinning.
const MAX_MOUSE_STEP = 250;

export function createInput(canvas) {
  const keys = new Set();
  let mouseX = 0;
  let mouseY = 0;

  const isLocked = () => document.pointerLockElement === canvas;

  // event.code names the physical key ("KeyW"), so WASD works on any keyboard layout.
  window.addEventListener('keydown', (event) => {
    keys.add(event.code);
    if (event.code === 'Space') event.preventDefault(); // stop Space from clicking a focused button
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  // If the window loses focus mid-keypress we never hear the key go up, so forget everything.
  window.addEventListener('blur', () => keys.clear());

  document.addEventListener('mousemove', (event) => {
    if (!isLocked()) return;
    if (Math.abs(event.movementX) > MAX_MOUSE_STEP || Math.abs(event.movementY) > MAX_MOUSE_STEP) return;
    mouseX += event.movementX;
    mouseY += event.movementY;
  });

  return {
    isLocked,
    isDown: (code) => keys.has(code),

    // Mouse movement since the last call, in pixels. Reading it resets it to zero.
    consumeMouseDelta() {
      const delta = { x: mouseX, y: mouseY };
      mouseX = 0;
      mouseY = 0;
      return delta;
    },

    // Must be called from a click handler. Returns a promise in newer browsers, nothing in older ones.
    lock() {
      try {
        const result = canvas.requestPointerLock();
        if (result && result.catch) result.catch(() => {}); // failures also arrive as 'pointerlockerror'
      } catch {
        // same: reported through the error event
      }
    },

    onLockChange(callback) {
      document.addEventListener('pointerlockchange', () => {
        keys.clear();
        mouseX = 0;
        mouseY = 0;
        callback(isLocked());
      });
    },

    // Chrome refuses to re-lock for about a second after you press Esc; this tells us it happened.
    onLockError(callback) {
      document.addEventListener('pointerlockerror', callback);
    },
  };
}
