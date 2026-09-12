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
    this.renderer.toneMappingExposure = 1.3;
    container.appendChild(this.renderer.domElement);

    // Not physically driven by the real room (WebXR light estimation is
    // inconsistent across runtimes), so tuned to sit well against typical
    // indoor passthrough exposure - and tuned generously bright rather than
    // "reasonable-looking on a black test background", since materials
    // that lean on real PBR shading (e.g. swat_elite_quest.glb's
    // MeshPhysicalMaterials - metalness/roughness workflow, no baked-in
    // brightness) read as a near-featureless dark silhouette once
    // hemisphere+key intensity is on the low side, reported on-device as
    // looking like "no material, solid black". A second, dimmer fill light
    // from roughly the opposite side keeps the unlit side of a character
    // from going fully black (approximating the bounce light a real room
    // would provide, which a single directional light can't).
    this.scene.add(new THREE.HemisphereLight(0xddeeff, 0x2a241c, 1.7));
    const key = new THREE.DirectionalLight(0xfff2df, 2.1);
    key.position.set(1.5, 3, 1);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xcfe0ff, 0.7);
    fill.position.set(-1.8, 1.6, -1.2);
    this.scene.add(fill);

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

  /**
   * No-headset fallback render loop for desktop iteration (see
   * DesktopPreview.js): skips WebXR entirely, drives the camera and a pair
   * of fake controller-grip anchors manually instead of from real XR pose
   * data, and renders via requestAnimationFrame. A floor grid + a few
   * boxes stand in for a real passthrough room so scale is still readable.
   */
  startDesktopPreview() {
    this.camera.position.set(0, 1.6, 0);
    this.camera.rotation.set(0, 0, 0);

    const grid = new THREE.GridHelper(10, 20, 0x88aacc, 0x334455);
    this.scene.add(grid);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x11161c, transparent: true, opacity: 0.35 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const boxMat = new THREE.MeshStandardMaterial({ color: 0x5a4632 });
    const furniture = [
      { size: [1.2, 0.45, 0.6], pos: [-1.4, 0.225, -0.8] }, // "coffee table"
      { size: [1.8, 0.85, 0.9], pos: [1.6, 0.425, -1.6] } // "sofa"
    ];
    for (const f of furniture) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...f.size), boxMat);
      mesh.position.set(...f.pos);
      this.scene.add(mesh);
    }

    const anchors = {
      right: new THREE.Object3D(),
      left: new THREE.Object3D()
    };
    anchors.right.position.set(0.22, -0.22, -0.4);
    anchors.right.rotation.set(-0.15, 0, 0);
    anchors.left.position.set(-0.2, -0.25, -0.35);
    this.camera.add(anchors.right, anchors.left);
    this.controllers.right.grip = anchors.right;
    this.controllers.left.grip = anchors.left;

    const animate = (time) => {
      requestAnimationFrame(animate);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      for (const cb of this.updateCallbacks) cb(dt, null);
      this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(animate);
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
