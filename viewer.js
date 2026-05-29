/* SO-101 viewer: studio scene, lighting, orbit, render loop,
   joint smoothing, exploded view, screen-projected labels, poses, auto-rotate. */
window.SO101 = window.SO101 || {};
(function () {
  async function createViewer(canvas, labelLayer, THREE, onProgress) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;

    const scene = new THREE.Scene();

    // gradient studio backdrop
    function gradientTex(top, bottom) {
      const c = document.createElement('canvas'); c.width = 16; c.height = 256;
      const g = c.getContext('2d').createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, top); g.addColorStop(1, bottom);
      const ctx = c.getContext('2d'); ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 256);
      const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
    }
    let bgTop = '#0b0e18', bgBottom = '#020204';
    scene.background = gradientTex(bgTop, bgBottom);

    const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 2000);
    camera.position.set(74, 22, 64);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.055;
    controls.rotateSpeed = 0.72; controls.panSpeed = 0.6; controls.zoomSpeed = 0.9;
    controls.enablePan = true;
    controls.target.set(11, 17, 0);
    controls.minDistance = 16; controls.maxDistance = 220;
    controls.minPolarAngle = 0.05; controls.maxPolarAngle = Math.PI - 0.05;
    controls.autoRotate = true; controls.autoRotateSpeed = 0.5;
    let autoRotateEnabled = true, idleTimer = null;
    controls.addEventListener('start', () => { controls.autoRotate = false; if (idleTimer) clearTimeout(idleTimer); });
    controls.addEventListener('end', () => { if (autoRotateEnabled) idleTimer = setTimeout(() => { controls.autoRotate = true; }, 3500); });

    // ---- Lights (studio) ----
    scene.add(new THREE.HemisphereLight(0x40434f, 0x050506, 0.32));
    const key = new THREE.SpotLight(0xffffff, 1.35, 0, 0.62, 0.7, 1.0);
    key.position.set(34, 56, 30); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004;
    key.shadow.camera.near = 10; key.shadow.camera.far = 160;
    scene.add(key); scene.add(key.target);
    const fill = new THREE.DirectionalLight(0x6f86d8, 0.32); fill.position.set(-40, 20, 18); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffcf9a, 0.95); rim.position.set(-18, 32, -42); scene.add(rim);
    const rim2 = new THREE.DirectionalLight(0x6ea0ff, 0.5); rim2.position.set(30, -10, -36); scene.add(rim2);
    const front = new THREE.DirectionalLight(0xffffff, 0.18); front.position.set(0, 14, 60); scene.add(front);

    // ---- Starfield (floating in space, no ground) ----
    function makeStars(count, radius, size, opacity) {
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = radius * (0.55 + Math.random() * 0.45);
        const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
        pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
        pos[i * 3 + 2] = r * Math.cos(ph);
      }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({ color: 0xffffff, size: size, sizeAttenuation: true, transparent: true, opacity: opacity, depthWrite: false });
      return new THREE.Points(g, m);
    }
    const stars1 = makeStars(1400, 700, 1.7, 0.85);
    const stars2 = makeStars(900, 1100, 3.0, 0.45);
    scene.add(stars1, stars2);
    let grid = null;

    // ---- Arm (real STL model, fallback to procedural) ----
    let arm;
    try {
      arm = await window.SO101.buildReal(THREE, onProgress);
    } catch (e) {
      console.warn('Real STL model failed, using procedural fallback:', e && e.message);
      arm = window.SO101.build(THREE);
    }
    scene.add(arm.root);

    // ===== joint smoothing toward targets =====
    const targets = {};
    Object.keys(arm.joints).forEach(k => targets[k] = arm.joints[k].val);
    let gripTarget = arm.getGripper();
    let animSpeed = 0.14;
    function setJointTarget(name, v) {
      const j = arm.joints[name];
      targets[name] = Math.max(j.min, Math.min(j.max, v));
    }
    function setGripperTarget(v) { gripTarget = Math.max(0, Math.min(1, v)); }
    // direct drive - set both target and current value (used by the move engine so
    // the per-frame smoothing becomes a no-op and the engine fully controls motion)
    function driveJoint(name, v) {
      const j = arm.joints[name]; if (!j) return;
      const c = Math.max(j.min, Math.min(j.max, v));
      targets[name] = c; j.val = c;
    }
    function driveGripper(v) {
      const c = Math.max(0, Math.min(1, v));
      gripTarget = c; arm.setGripper(c);
    }
    function getJointVal(name) { return arm.joints[name] ? arm.joints[name].val : 0; }
    // snap all joints + gripper to their current targets (used for initial pose)
    function snapToTargets() {
      Object.keys(arm.joints).forEach(k => {
        const j = arm.joints[k]; j.val = targets[k]; j.apply(targets[k]);
      });
      arm.setGripper(gripTarget);
    }

    // ===== exploded view =====
    let explodeT = 0, explodeTarget = 0;
    function setExplode(t) { explodeTarget = Math.max(0, Math.min(1, t)); }

    // ===== labels =====
    let labelsOn = false;
    const labelEls = [];
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'label-lines');
    labelLayer.appendChild(svg);
    arm.labelAnchors.forEach((a, i) => {
      const el = document.createElement('div'); el.className = 'callout';
      el.innerHTML = '<span class="callout-dot"></span><span class="callout-txt">' + a.label + '</span>';
      labelLayer.appendChild(el);
      const line = document.createElementNS(svgNS, 'line'); line.setAttribute('class', 'callout-line'); svg.appendChild(line);
      // alternate sides
      const side = (i % 2 === 0) ? 1 : -1;
      labelEls.push({ a, el, line, side, off: 70 + (i % 3) * 26 });
    });
    function setLabels(on) {
      labelsOn = on;
      labelLayer.style.opacity = on ? '1' : '0';
      labelLayer.style.pointerEvents = on ? 'auto' : 'none';
    }
    setLabels(false);
    const _v = new THREE.Vector3();
    function updateLabels(w, h) {
      if (!labelsOn) return;
      labelEls.forEach(L => {
        L.a.obj.getWorldPosition(_v); _v.project(camera);
        const sx = (_v.x * 0.5 + 0.5) * w, sy = (-_v.y * 0.5 + 0.5) * h;
        const behind = _v.z > 1;
        const lx = sx + L.side * L.off, ly = sy - 40 - (L.off - 70);
        L.el.style.transform = 'translate(-50%,-50%) translate(' + lx + 'px,' + ly + 'px)';
        L.el.style.opacity = behind ? '0' : '1';
        L.line.setAttribute('x1', sx); L.line.setAttribute('y1', sy);
        L.line.setAttribute('x2', lx); L.line.setAttribute('y2', ly);
        L.line.style.opacity = behind ? '0' : '0.55';
      });
    }

    // ===== poses =====
    const poses = {
      rest:    { yaw: 0, shoulder: -1.222, elbow: 0.873, wristPitch: 1.309, wristRoll: 0, grip: 0.5 },
      home:    { yaw: 0, shoulder: -0.9, elbow: 1.0, wristPitch: 0.6, wristRoll: 0, grip: 0.45 },
      reach:   { yaw: -0.28, shoulder: -0.55, elbow: -0.35, wristPitch: 0.35, wristRoll: 0, grip: 0.5 },
      grasp:   { yaw: 0.2, shoulder: -0.5, elbow: 0.9, wristPitch: 0.75, wristRoll: 0, grip: 0.08 },
      lift:    { yaw: 0.45, shoulder: -1.1, elbow: 0.2, wristPitch: 0.45, wristRoll: 1.0, grip: 0.06 },
      tuck:    { yaw: 0, shoulder: 1.45, elbow: 1.3, wristPitch: 0.5, wristRoll: 0, grip: 0.3 },
    };
    function goPose(name, cb) {
      const p = poses[name]; if (!p) return;
      Object.keys(arm.joints).forEach(k => { if (k in p) setJointTarget(k, p[k]); });
      if ('grip' in p) setGripperTarget(p.grip);
      if (cb) cb();
    }

    // ===== auto-rotate (idle-resume aware) =====
    function setAutoRotate(on) { autoRotateEnabled = on; controls.autoRotate = on; if (!on && idleTimer) clearTimeout(idleTimer); }
    function getAutoRotate() { return autoRotateEnabled; }
    // suspend auto-rotate without changing the user's toggle preference
    function suspendAutoRotate() { controls.autoRotate = false; if (idleTimer) clearTimeout(idleTimer); }
    function resumeAutoRotate() { if (autoRotateEnabled) controls.autoRotate = true; }

    // ===== per-frame callbacks (interactions, choreography, focus) =====
    const frameCallbacks = [];
    function addFrameCallback(fn) { frameCallbacks.push(fn); }
    function setGrid(on) {
      if (on && !grid) {
        grid = new THREE.GridHelper(120, 40, 0x2a2c34, 0x191a1f);
        grid.position.y = 0.02; scene.add(grid);
      }
      if (grid) grid.visible = on;
    }

    function setBackground(top, bottom) {
      bgTop = top; bgBottom = bottom;
      scene.background = gradientTex(top, bottom);
    }

    // ===== resize =====
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      svg.setAttribute('width', w); svg.setAttribute('height', h);
    }

    // ===== loop =====
    let lastT = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    function step() {
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      let dt = (now - lastT) / 1000; lastT = now;
      if (dt > 0.1) dt = 0.1; // clamp after tab was backgrounded
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.floor(w * renderer.getPixelRatio())) resize();
      // interactions / choreography / focus run first so transforms are fresh
      for (let i = 0; i < frameCallbacks.length; i++) {
        try { frameCallbacks[i](dt, now); } catch (e) { console.error('frameCb error:', e && e.message); }
      }
      // smooth joints
      Object.keys(arm.joints).forEach(k => {
        const j = arm.joints[k];
        j.val += (targets[k] - j.val) * animSpeed;
        j.apply(j.val);
      });
      const gv = arm.getGripper() + (gripTarget - arm.getGripper()) * animSpeed;
      arm.setGripper(gv);
      explodeT += (explodeTarget - explodeT) * 0.12; arm.applyExplode(explodeT);
      stars1.rotation.y += 0.0003; stars2.rotation.y -= 0.0002;
      key.target.position.set(6, 18, 0);
      controls.update();
      renderer.render(scene, camera);
      updateLabels(w, h);
    }
    function tick() {
      try { step(); } catch (e) { console.error('TICK ERROR:', e && e.message, e && e.stack); }
      requestAnimationFrame(tick);
    }
    resize(); tick();
    window.addEventListener('resize', resize);

    return {
      arm, controls, camera, scene, canvas, THREE,
      setJointTarget, setGripperTarget, setExplode, setLabels, goPose, snapToTargets,
      driveJoint, driveGripper, getJointVal,
      setAutoRotate, getAutoRotate, suspendAutoRotate, resumeAutoRotate, addFrameCallback,
      setGrid, setColors: arm.setColors, setMode: arm.setMode,
      setBackground, getBackground: () => ({ top: bgTop, bottom: bgBottom }), getMode: arm.getMode,
      render: () => renderer.render(scene, camera),
      _step: () => step(),
      setAnimSpeed: s => { animSpeed = s; }, setAutoRotateSpeed: s => { controls.autoRotateSpeed = s; },
      resetView: () => { controls.target.set(11, 17, 0); camera.position.set(74, 22, 64); },
    };
  }
  window.SO101.createViewer = createViewer;
})();
