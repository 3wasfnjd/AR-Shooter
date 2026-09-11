import * as THREE from 'three';

/**
 * Bootstraps the WebXR immersive-ar session: renderer, scene, camera rig,
 * controller tracking (grip + ray spaces, resolved to left/right by
 * XRInputSource.handedness) and haptics. Everything else in the game
 * subscribes to `onUpdate` and reads `controllers.left` / `controllers.right`.
 */
export class XRApp {
  constructor({ container }) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.updateCallbacks = [];
    this.sessionStartCallbacks = [];
    this.sessionEndCallbacks = [];

    this.scene = new THREE.Scene();
    // No background/fog: passthrough camera feed shows through automatically
    // once the XR session's alpha framebuffer is composited by the OS.
    this.scene.background = null;

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType('local-floor');
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    // A subtle hemisphere + directional light: not physically driven by the
    // real room (WebXR light estimation is inconsistent across runtimes),
    // but tuned to sit well against typical indoor passthrough exposure.
    this.scene.add(new THREE.HemisphereLight(0xddeeff, 0x1a1410, 0.9));
    const key = new THREE.DirectionalLight(0xfff2df, 1.1);
    key.position.set(1.5, 3, 1);
    this.scene.add(key);

    this.cameraRig = new THREE.Group();
    this.cameraRig.add(this.camera);
    this.scene.add(this.cameraRig);

    this.controllers = {
      left: this._makeControllerSlot(),
      right: this._makeControllerSlot()
    };
    this._setupControllers();

    window.addEventListener('resize', () => this._onResize());
  }

  _makeControllerSlot() {
    return { grip: null, ray: null, inputSource: null, connected: false, index: -1 };
  }

  _setupControllers() {
    for (let i = 0; i < 2; i++) {
      const ray = this.renderer.xr.getController(i);
      const grip = this.renderer.xr.getControllerGrip(i);
      this.scene.add(ray, grip);

      ray.addEventListener('connected', (evt) => {
        const handedness = evt.data.handedness === 'left' ? 'left' : 'right';
        const slot = this.controllers[handedness];
        slot.ray = ray;
        slot.grip = grip;
        slot.inputSource = evt.data;
        slot.connected = true;
        slot.index = i;
        ray.userData.handedness = handedness;
      });
      ray.addEventListener('disconnected', () => {
        const handedness = ray.userData.handedness;
        if (handedness && this.controllers[handedness]) {
          this.controllers[handedness].connected = false;
          this.controllers[handedness].inputSource = null;
        }
      });
    }
  }

  onUpdate(fn) {
    this.updateCallbacks.push(fn);
    return () => {
      this.updateCallbacks = this.updateCallbacks.filter((f) => f !== fn);
    };
  }

  onSessionStart(fn) {
    this.sessionStartCallbacks.push(fn);
  }

  onSessionEnd(fn) {
    this.sessionEndCallbacks.push(fn);
  }

  isSupported() {
    return !!(navigator.xr && navigator.xr.isSessionSupported);
  }

  async checkArSupport() {
    if (!navigator.xr) return false;
    try {
      return await navigator.xr.isSessionSupported('immersive-ar');
    } catch {
      return false;
    }
  }

  /** Starts the immersive-ar session against a DOM overlay root element. */
  async enterAR(overlayRoot) {
    const sessionInit = {
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['bounded-floor', 'hand-tracking', 'dom-overlay', 'hit-test', 'plane-detection']
    };
    if (overlayRoot) {
      sessionInit.optionalFeatures.push('dom-overlay');
      sessionInit.domOverlay = { root: overlayRoot };
    }
    const session = await navigator.xr.requestSession('immersive-ar', sessionInit);
    await this.renderer.xr.setSession(session);
    this.session = session;

    session.addEventListener('end', () => {
      this.session = null;
      for (const cb of this.sessionEndCallbacks) cb();
    });

    this.renderer.setAnimationLoop((time, frame) => this._tick(time, frame));
    for (const cb of this.sessionStartCallbacks) cb(session);
    return session;
  }

  _tick(_time, frame) {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.frame = frame;
    for (const cb of this.updateCallbacks) cb(dt, frame);
    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /** Triggers a haptic pulse on a controller if the runtime exposes a gamepad hapticActuator. */
  pulse(handedness, intensity = 0.6, durationMs = 40) {
    const slot = this.controllers[handedness];
    const gamepad = slot?.inputSource?.gamepad;
    const actuator = gamepad?.hapticActuators?.[0];
    if (actuator && actuator.pulse) {
      actuator.pulse(clampIntensity(intensity), durationMs);
    }
  }
}

function clampIntensity(v) {
  return Math.max(0, Math.min(1, v));
}
