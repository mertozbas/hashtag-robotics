/* SO-101 interactions layer:
   - click-to-select parts (raycast) with highlight + dim + camera focus
   - part explorer tour (prev/next through the chain)
   - cinematic "moves" (pick & place, wave, scan) driven by the render loop
   - a floating payload crate + holo rings for the pick-and-place routine
   Talks to the viewer API (V) and window.SO101.PARTS / PART_ORDER. */
window.SO101 = window.SO101 || {};
(function () {
  function initInteractions(V) {
    const THREE = V.THREE;
    const arm = V.arm;
    const PARTS = window.SO101.PARTS || {};
    const ORDER_F = (window.SO101.PART_ORDER_FOLLOWER || window.SO101.PART_ORDER || []).filter(id => PARTS[id]);
    const ORDER_L = (window.SO101.PART_ORDER_LEADER || []).filter(id => PARTS[id]);
    // the tour / part list follow the active mode (leader vs follower end-effector)
    function currentOrder() { return (arm.getMode && arm.getMode() === 'leader') ? ORDER_L : ORDER_F; }

    // follower parts + leader-only meshes (handle/trigger/wrist); leader meshes
    // are hidden in follower mode, so the raycast below filters by visibility.
    const selectable = [].concat(
      (arm.parts || []).map(p => p.obj),
      arm.leaderParts || []
    ).filter(Boolean);
    const accentColor = new THREE.Color(0xe08a3c);

    // ---------- selection state ----------
    let selectedId = null;
    let focusGoal = null;
    const changeCbs = [];
    const moveCbs = [];
    function onChange(cb) { changeCbs.push(cb); }
    function onMoveChange(cb) { moveCbs.push(cb); }
    function emitChange() { changeCbs.forEach(cb => cb(selectedId)); }
    function emitMove(n) { moveCbs.forEach(cb => cb(n)); }

    function meshesForId(id) { return selectable.filter(m => m.userData.partId === id); }

    function applyHighlight() {
      selectable.forEach(m => {
        const base = m.material.userData && m.material.userData.baseColor;
        if (!base) return;
        if (!selectedId) {
          m.material.color.copy(base);
          m.material.emissive.setRGB(0, 0, 0);
        } else if (m.userData.partId === selectedId) {
          m.material.color.copy(base);
        } else {
          m.material.color.copy(base).multiplyScalar(0.26);
          m.material.emissive.setRGB(0, 0, 0);
        }
      });
    }

    function worldCenterOf(id) {
      const box = new THREE.Box3();
      let any = false;
      meshesForId(id).forEach(m => {
        m.updateWorldMatrix(true, false);
        const b = new THREE.Box3().setFromObject(m);
        if (!b.isEmpty()) { box.union(b); any = true; }
      });
      if (!any) return null;
      return box.getCenter(new THREE.Vector3());
    }

    function select(id, opts) {
      opts = opts || {};
      if (!PARTS[id]) return;
      selectedId = id;
      applyHighlight();
      if (opts.focus !== false) {
        const c = worldCenterOf(id);
        if (c) focusGoal = c;
      }
      V.suspendAutoRotate();
      emitChange();
    }

    function deselect() {
      if (selectedId === null) return;
      selectedId = null;
      focusGoal = null;
      applyHighlight();
      V.resumeAutoRotate();
      emitChange();
    }

    // tour (follows the active mode's part order)
    function tourStep(dir) {
      const ORDER = currentOrder();
      if (!ORDER.length) return;
      let i = ORDER.indexOf(selectedId);
      i = (i < 0) ? (dir > 0 ? 0 : ORDER.length - 1) : (i + dir + ORDER.length) % ORDER.length;
      select(ORDER[i]);
    }

    // ---------- raycast click ----------
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const canvas = V.canvas;
    let downX = 0, downY = 0, downT = 0;
    canvas.addEventListener('pointerdown', e => { downX = e.clientX; downY = e.clientY; downT = performance.now(); });
    canvas.addEventListener('pointerup', e => {
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      const dt = performance.now() - downT;
      if (moved > 6 || dt > 400) return; // it was a drag, not a click
      const r = canvas.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, V.camera);
      const hits = ray.intersectObjects(selectable.filter(m => m.visible), false);
      if (hits.length && hits[0].object.userData.partId) {
        const id = hits[0].object.userData.partId;
        if (id === selectedId) deselect(); else select(id);
      } else {
        deselect();
      }
    });
    // pointer cursor feedback
    canvas.addEventListener('pointermove', e => {
      if (e.buttons) return;
      const r = canvas.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, V.camera);
      canvas.style.cursor = ray.intersectObjects(selectable.filter(m => m.visible), false).length ? 'pointer' : 'grab';
    });

    // =====================================================================
    //  MOVES (choreography) - driven by the render loop, all based on the
    //  natural S rest pose so gestures stay in that silhouette.
    // =====================================================================
    const POSE = {
      rest: { yaw: 0, shoulder: -1.222, elbow: 0.873, wristPitch: 1.309, wristRoll: 0 },
    };

    // wave = twist the wrist side-to-side while holding the S pose.
    // scan = pan the base left/right while holding the S pose.
    const ROUTINES = {
      wave: {
        loop: true, label: 'Selam Ver',
        steps: [
          { pose: { yaw: 0, shoulder: -1.222, elbow: 0, wristPitch: 0.785, wristRoll: 0.95 }, grip: 0.45, dur: 0.45 },
          { pose: { yaw: 0, shoulder: -1.222, elbow: 0, wristPitch: 0.785, wristRoll: -0.95 }, grip: 0.45, dur: 0.45 },
        ],
      },
      scan: {
        loop: true, label: 'Tarama',
        steps: [
          { pose: { yaw: 1.3, shoulder: 0.436, elbow: 0, wristPitch: -0.436, wristRoll: 0 }, grip: 0.4, dur: 2.4 },
          { pose: { yaw: -1.3, shoulder: 0.436, elbow: 0, wristPitch: -0.436, wristRoll: 0 }, grip: 0.4, dur: 2.4 },
        ],
      },
      dance: {
        loop: true, label: 'Dans Et',
        // groove between fully OPEN (sh 0, el -90, wp 0) and fully CLOSED S
        // (sh -90, el 90, wp 45), swaying the base + rolling the wrist on each beat.
        steps: [
          { pose: { yaw: 0.6,  shoulder: 0,      elbow: -1.571, wristPitch: 0,     wristRoll: 0.9 },  grip: 0.7, dur: 0.5 },
          { pose: { yaw: -0.6, shoulder: -0.7,   elbow: 0.35,   wristPitch: 0.4,   wristRoll: -0.9 }, grip: 0.2, dur: 0.45 },
          { pose: { yaw: 0,    shoulder: -1.571, elbow: 1.571,  wristPitch: 0.785, wristRoll: 0 },    grip: 0.7, dur: 0.5 },
          { pose: { yaw: 0.6,  shoulder: -0.5,   elbow: -0.5,   wristPitch: 0.2,   wristRoll: 0.9 },  grip: 0.2, dur: 0.45 },
          { pose: { yaw: -0.6, shoulder: 0,      elbow: -1.571, wristPitch: 0,     wristRoll: -0.9 }, grip: 0.7, dur: 0.5 },
          { pose: { yaw: 0,    shoulder: -1.571, elbow: 1.571,  wristPitch: 0.785, wristRoll: 0 },    grip: 0.2, dur: 0.55 },
        ],
      },
    };

    const JKEYS = ['yaw', 'shoulder', 'elbow', 'wristPitch', 'wristRoll'];
    function smoother(u) { u = Math.max(0, Math.min(1, u)); return u * u * u * (u * (u * 6 - 15) + 10); }

    let routine = null, stepIdx = 0, stepEl = 0, playing = false;
    const fromPose = {}; let fromGrip = 0;

    function snapshotFrom() {
      JKEYS.forEach(k => { fromPose[k] = V.getJointVal(k); });
      fromGrip = arm.getGripper();
    }
    function enterStep() {
      snapshotFrom();
      stepEl = 0;
    }
    function applyStep(u) {
      const s = routine.steps[stepIdx];
      const e = smoother(u);
      JKEYS.forEach(k => {
        const to = (k in s.pose) ? s.pose[k] : fromPose[k];
        V.driveJoint(k, fromPose[k] + (to - fromPose[k]) * e);
      });
      if ('grip' in s) V.driveGripper(fromGrip + (s.grip - fromGrip) * e);
    }
    function play(name) {
      const r = ROUTINES[name]; if (!r) return;
      deselect();
      routine = r; routine._name = name; stepIdx = 0; stepEl = 0; playing = true;
      V.suspendAutoRotate();
      enterStep();
      emitMove(name);
    }
    function stop() {
      playing = false; routine = null;
      V.resumeAutoRotate();
      emitMove(null);
    }
    function goHome() {
      stop();
      Object.keys(POSE.rest).forEach(k => V.setJointTarget(k, POSE.rest[k]));
      V.setGripperTarget(0.5);
    }

    // ---------- per-frame update ----------
    let pulse = 0;
    V.addFrameCallback((dt, now) => {
      // selection highlight pulse + focus
      if (selectedId) {
        pulse = 0.3 + 0.18 * Math.sin(now * 0.005);
        meshesForId(selectedId).forEach(m => {
          m.material.emissive.copy(accentColor);
          m.material.emissiveIntensity = pulse;
        });
      }
      if (focusGoal) {
        V.controls.target.lerp(focusGoal, Math.min(1, 5 * dt));
        const dist = V.camera.position.distanceTo(V.controls.target);
        const want = Math.max(28, Math.min(46, dist));
        if (Math.abs(dist - want) > 0.5) {
          const dir = V.camera.position.clone().sub(V.controls.target).normalize();
          const np = V.controls.target.clone().add(dir.multiplyScalar(dist + (want - dist) * Math.min(1, 3 * dt)));
          V.camera.position.copy(np);
        }
      }
      // choreography (eased keyframe engine)
      if (playing && routine) {
        const s = routine.steps[stepIdx];
        stepEl += dt;
        const u = s.dur > 0 ? stepEl / s.dur : 1;
        applyStep(Math.min(u, 1));
        if (u >= 1) {
          if (stepIdx < routine.steps.length - 1) {
            stepIdx++; enterStep();
          } else if (routine.loop) {
            stepIdx = 0; enterStep();
          } else {
            playing = false; V.resumeAutoRotate(); emitMove(null); routine = null;
          }
        }
      }
    });

    return {
      select, deselect, tourNext: () => tourStep(1), tourPrev: () => tourStep(-1),
      play, stop, goHome, onChange, onMoveChange,
      getOrder: () => currentOrder(), getParts: () => PARTS,
      getSelected: () => selectedId,
    };
  }
  window.SO101.initInteractions = initInteractions;
})();
