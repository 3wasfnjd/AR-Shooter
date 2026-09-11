/**
 * Polls the XR gamepads each frame and exposes edge-detected button state
 * (justPressed / justReleased) plus axes, per hand. Standard XR "gamepad"
 * mapping: buttons[0]=trigger, buttons[1]=grip/squeeze, buttons[3]=thumbstick
 * click, buttons[4]/[5]=A/X and B/Y face buttons; axes[2]/[3]=thumbstick.
 */
export class InputManager {
  constructor(xrApp) {
    this.xrApp = xrApp;
    this.state = {
      left: this._blankState(),
      right: this._blankState()
    };
  }

  _blankState() {
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

  update() {
    for (const hand of ['left', 'right']) {
      const slot = this.xrApp.controllers[hand];
      const s = this.state[hand];
      const gamepad = slot?.inputSource?.gamepad;
      const prevTrigger = s.triggerDown;
      const prevGrip = s.gripDown;

      if (!gamepad) {
        Object.assign(s, this._blankState());
        continue;
      }

      const trigger = gamepad.buttons[0];
      const grip = gamepad.buttons[1];
      const stickClick = gamepad.buttons[3];
      const aBtn = gamepad.buttons[4];
      const bBtn = gamepad.buttons[5];

      s.trigger = trigger ? trigger.value : 0;
      s.triggerDown = !!trigger && (trigger.pressed || trigger.value > 0.65);
      s.triggerPressed = s.triggerDown && !prevTrigger;
      s.triggerReleased = !s.triggerDown && prevTrigger;

      s.grip = grip ? grip.value : 0;
      s.gripDown = !!grip && (grip.pressed || grip.value > 0.65);
      s.gripPressed = s.gripDown && !prevGrip;
      s.gripReleased = !s.gripDown && prevGrip;

      s.thumbstickPressed = !!stickClick?.pressed;
      s.aPressed = !!aBtn?.pressed;
      s.bPressed = !!bBtn?.pressed;

      const axes = gamepad.axes || [];
      // Most runtimes report thumbstick on axes[2]/axes[3] (axes[0]/[1] are touchpad/legacy).
      s.thumbstick.x = axes.length >= 4 ? axes[2] : axes[0] || 0;
      s.thumbstick.y = axes.length >= 4 ? axes[3] : axes[1] || 0;
    }
  }
}
