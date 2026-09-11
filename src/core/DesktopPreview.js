import * as THREE from 'three';

const KEY_MOVE = {
  KeyW: [0, 0, -1],
  KeyS: [0, 0, 1],
  KeyA: [-1, 0, 0],
  KeyD: [1, 0, 0]
};

/**
 * A no-headset fallback so the game (weapons, soldiers, VFX, HUD) can be
 * iterated on and screenshotted from an ordinary desktop/laptop browser -
 * there is obviously no real passthrough room here, just a plain floor
 * grid standing in for it. This does NOT touch WebXR at all; it drives
 * the same THREE.Camera manually from mouse-look + WASD and feeds the
 * same input `state` shape InputManager produces so WeaponSystem/HUD need
 * no changes to work against either input source.
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
    this.locked = false;

    this._keys = new Set();
    this._mouseButtons = new Set();

    this.dom.addEventListener('click', () => this.dom.requestPointerLock?.());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0025;
      this.pitch -= e.movementY * 0.0025;
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
    });
    document.addEventListener('mousedown', (e) => this._mouseButtons.add(e.button));
    document.addEventListener('mouseup', (e) => this._mouseButtons.delete(e.button));
    document.addEventListener('keydown', (e) => this._keys.add(e.code));
    document.addEventListener('keyup', (e) => this._keys.delete(e.code));
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

  /** Moves `camera` from WASD (yaw-relative) + mouse-look; call once per frame before reading input state. */
  updateCamera(camera, dt) {
    camera.rotation.set(0, 0, 0);
    camera.rotateY(this.yaw);
    camera.rotateX(this.pitch);

    const speed = (this.key('ShiftLeft') || this.key('ShiftRight') ? 2.2 : 1.1) * dt;
    const move = new THREE.Vector3();
    for (const [code, vec] of Object.entries(KEY_MOVE)) {
      if (this.key(code)) move.add(new THREE.Vector3(...vec));
    }
    if (move.lengthSq() > 0) {
      move.normalize().applyEuler(new THREE.Euler(0, this.yaw, 0));
      camera.position.addScaledVector(move, speed);
    }
    if (this.key('Space')) camera.position.y += speed;
    if (this.key('ControlLeft')) camera.position.y = Math.max(0.3, camera.position.y - speed);
  }

  update() {
    const prevRT = this.state.right.triggerDown;
    const prevLT = this.state.left.triggerDown;

    // Left mouse = gun-hand trigger, right mouse = off-hand trigger (so
    // both-mouse-buttons mirrors the real "hold both triggers" calibration
    // gesture). Keyboard covers cycling/reload/swap since there's no stick.
    this.state.right.triggerDown = this._mouseButtons.has(0);
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
