import * as THREE from 'three';

const KEY_MOVE = {
  KeyW: [0, 0, -1],
  KeyS: [0, 0, 1],
  KeyA: [-1, 0, 0],
  KeyD: [1, 0, 0]
};

const JOYSTICK_RADIUS = 46; // px, matches the CSS knob travel in index.html

/**
 * A no-headset fallback so the game (weapons, soldiers, VFX, HUD) can be
 * iterated on and screenshotted from an ordinary desktop/laptop/phone
 * browser - there is obviously no real passthrough room here, just a plain
 * floor grid standing in for it. This does NOT touch WebXR at all; it
 * drives the same THREE.Camera manually from touch/mouse-drag look +
 * WASD/joystick movement and feeds the same input `state` shape
 * InputManager produces so WeaponSystem/HUD need no changes to work
 * against either input source. On-screen buttons (index.html
 * #touch-controls) work identically on a touchscreen or with a mouse,
 * since everything here uses Pointer Events rather than touch- or
 * mouse-specific ones.
 */
export class DesktopInput {
  constructor(renderer) {
    this.dom = renderer.domElement;
    this.state = {
      left: this._blank(),
      right: this._blank()
    };
    this.yaw = 0;
    this.pitch = 0;

    this._keys = new Set();
    this._mouseButtons = new Set();
    this._joystick = { x: 0, y: 0 };
    this._verticalHeld = { up: false, down: false };
    this._fireHeld = false;

    this.dom.addEventListener('mousedown', (e) => this._mouseButtons.add(e.button));
    this.dom.addEventListener('mouseup', (e) => this._mouseButtons.delete(e.button));
    this.dom.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('keydown', (e) => this._keys.add(e.code));
    document.addEventListener('keyup', (e) => this._keys.delete(e.code));

    this._setupDragLook();
    this._setupJoystick();
    this._setupHoldButton('btn-fire', (held) => (this._fireHeld = held));
    this._setupHoldButton('btn-up', (held) => (this._verticalHeld.up = held));
    this._setupHoldButton('btn-down', (held) => (this._verticalHeld.down = held));
  }

  _blank() {
    return {
      trigger: 0,
      triggerDown: false,
      triggerPressed: false,
      triggerReleased: false,
      grip: 0,
      gripDown: false,
      gripPressed: false,
      gripReleased: false,
      thumbstick: { x: 0, y: 0 },
      thumbstickPressed: false,
      aPressed: false,
      bPressed: false
    };
  }

  key(code) {
    return this._keys.has(code);
  }

  /** Drag anywhere on the canvas (mouse or touch, via Pointer Events) to look around - no pointer-lock needed. */
  _setupDragLook() {
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    this.dom.style.touchAction = 'none';

    this.dom.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      this.dom.setPointerCapture?.(e.pointerId);
    });
    this.dom.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      this.yaw -= dx * 0.0045;
      this.pitch -= dy * 0.0045;
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
    });
    const stop = () => (dragging = false);
    this.dom.addEventListener('pointerup', stop);
    this.dom.addEventListener('pointercancel', stop);
    this.dom.addEventListener('pointerleave', stop);
  }

  /** Left-side on-screen joystick (#joystick / #joystick-knob in index.html) driving WASD-equivalent movement. */
  _setupJoystick() {
    const pad = document.getElementById('joystick');
    const knob = document.getElementById('joystick-knob');
    if (!pad || !knob) return;
    let active = false;
    let originX = 0;
    let originY = 0;

    const setKnob = (dx, dy) => {
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    pad.addEventListener('pointerdown', (e) => {
      active = true;
      const rect = pad.getBoundingClientRect();
      originX = rect.left + rect.width / 2;
      originY = rect.top + rect.height / 2;
      pad.setPointerCapture?.(e.pointerId);
    });
    pad.addEventListener('pointermove', (e) => {
      if (!active) return;
      let dx = e.clientX - originX;
      let dy = e.clientY - originY;
      const dist = Math.hypot(dx, dy);
      if (dist > JOYSTICK_RADIUS) {
        dx = (dx / dist) * JOYSTICK_RADIUS;
        dy = (dy / dist) * JOYSTICK_RADIUS;
      }
      setKnob(dx, dy);
      this._joystick.x = dx / JOYSTICK_RADIUS;
      this._joystick.y = dy / JOYSTICK_RADIUS;
    });
    const release = () => {
      active = false;
      this._joystick.x = 0;
      this._joystick.y = 0;
      setKnob(0, 0);
    };
    pad.addEventListener('pointerup', release);
    pad.addEventListener('pointercancel', release);
    pad.addEventListener('pointerleave', release);
  }

  /** A button that's "held" (fire, up, down): calls `onChange(true/false)` on press/release. */
  _setupHoldButton(id, onChange) {
    const el = document.getElementById(id);
    if (!el) return;
    const down = (e) => {
      e.preventDefault();
      onChange(true);
    };
    const up = () => onChange(false);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }

  /** Moves `camera` from WASD/joystick (yaw-relative) + drag-look; call once per frame before reading input state. */
  updateCamera(camera, dt) {
    camera.rotation.set(0, 0, 0);
    camera.rotateY(this.yaw);
    camera.rotateX(this.pitch);

    const speed = (this.key('ShiftLeft') || this.key('ShiftRight') ? 2.2 : 1.1) * dt;
    const move = new THREE.Vector3();
    for (const [code, vec] of Object.entries(KEY_MOVE)) {
      if (this.key(code)) move.add(new THREE.Vector3(...vec));
    }
    // Joystick forward/back is "up on the pad" = forward, matching KeyW's -Z.
    move.x += this._joystick.x;
    move.z += this._joystick.y;
    if (move.lengthSq() > 0.0001) {
      if (move.lengthSq() > 1) move.normalize();
      move.applyEuler(new THREE.Euler(0, this.yaw, 0));
      camera.position.addScaledVector(move, speed);
    }
    if (this.key('Space') || this._verticalHeld.up) camera.position.y += speed;
    if (this.key('ControlLeft') || this._verticalHeld.down) camera.position.y = Math.max(0.3, camera.position.y - speed);
  }

  update() {
    const prevRT = this.state.right.triggerDown;
    const prevLT = this.state.left.triggerDown;

    // Left mouse or the on-screen FIRE button = gun-hand trigger; right
    // mouse = off-hand trigger (so both together mirrors the real "hold
    // both triggers" calibration gesture). Keyboard covers cycling/reload/
    // swap since there's no physical stick; on-screen buttons for those
    // call WeaponSystem directly (see Game.startPreview) rather than
    // faking stick/button edges here.
    this.state.right.triggerDown = this._mouseButtons.has(0) || this._fireHeld;
    this.state.right.triggerPressed = this.state.right.triggerDown && !prevRT;
    this.state.right.triggerReleased = !this.state.right.triggerDown && prevRT;

    this.state.left.triggerDown = this._mouseButtons.has(2);
    this.state.left.triggerPressed = this.state.left.triggerDown && !prevLT;
    this.state.left.triggerReleased = !this.state.left.triggerDown && prevLT;

    this.state.left.thumbstick.x = (this.key('KeyE') ? 1 : 0) - (this.key('KeyQ') ? 1 : 0);
    this.state.left.thumbstick.y = (this.key('KeyT') ? 1 : 0) - (this.key('KeyG') ? 1 : 0);
    this.state.left.aPressed = this.key('KeyR');
    this.state.left.bPressed = this.key('KeyF');

    this.state.right.thumbstick.x = (this.key('ArrowRight') ? 1 : 0) - (this.key('ArrowLeft') ? 1 : 0);
    this.state.right.thumbstick.y = (this.key('ArrowUp') ? 1 : 0) - (this.key('ArrowDown') ? 1 : 0);
    this.state.right.aPressed = this.key('BracketLeft');
    this.state.right.bPressed = this.key('BracketRight');

    const swap = this.key('KeyH');
    this.state.left.thumbstickPressed = swap;
    this.state.right.thumbstickPressed = swap;
  }
}
