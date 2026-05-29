/* SO-101 parametric arm builder.
   Builds a kinematic chain of named THREE.Groups + decorative servos/brackets.
   Returns an API for joints, gripper, exploded view, colors, labels, mode. */
window.SO101 = window.SO101 || {};
(function () {
  function build(THREE) {
    // ---- Materials (shared so colors can be live-updated) ----
    const mat = {
      printed: new THREE.MeshStandardMaterial({ color: 0x3b3c42, roughness: 0.6, metalness: 0.12 }),
      servo:   new THREE.MeshStandardMaterial({ color: 0x141417, roughness: 0.52, metalness: 0.28 }),
      servoTop:new THREE.MeshStandardMaterial({ color: 0x202026, roughness: 0.45, metalness: 0.32 }),
      horn:    new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.38, metalness: 0.55 }),
      metal:   new THREE.MeshStandardMaterial({ color: 0xa6a6ad, roughness: 0.28, metalness: 0.9 }),
      accent:  new THREE.MeshStandardMaterial({ color: 0xd98a3d, roughness: 0.4, metalness: 0.25 }),
      pad:     new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.9, metalness: 0.0 }),
    };

    const parts = [];     // { name, label, obj }
    const labelAnchors = []; // { name, label, obj }

    function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
    function cyl(rt, rb, h, m, seg) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 28), m); }

    // register a leaf part for exploded view / part-counting
    function reg(name, obj, explodeVec) {
      obj.userData.basePos = obj.position.clone();
      obj.userData.explode = explodeVec || new THREE.Vector3();
      parts.push({ name, obj });
      return obj;
    }

    // ---- Servo factory. Horn faces +Z; rotation axis = local +Z. ----
    function makeServo(opts) {
      opts = opts || {};
      const w = opts.w || 2.6, h = opts.h || 4.6, d = opts.d || 3.7;
      const g = new THREE.Group();
      const body = box(w, h, d, mat.servo);
      g.add(body);
      const cover = box(w * 1.04, h * 0.16, d * 1.04, mat.servoTop);
      cover.position.y = h * 0.34; g.add(cover);
      const cover2 = box(w * 1.04, h * 0.16, d * 1.04, mat.servoTop);
      cover2.position.y = -h * 0.34; g.add(cover2);
      // output horn on +Z
      const horn = cyl(w * 0.4, w * 0.4, 0.55, mat.horn, 26);
      horn.rotation.x = Math.PI / 2; horn.position.z = d / 2 + 0.22; g.add(horn);
      const hub = cyl(0.28, 0.28, 0.8, mat.metal, 14);
      hub.rotation.x = Math.PI / 2; hub.position.z = d / 2 + 0.4; g.add(hub);
      // screws on +Z face corners
      const sx = w * 0.32, sy = h * 0.36;
      [[-sx, sy], [sx, sy], [-sx, -sy], [sx, -sy]].forEach(p => {
        const s = cyl(0.16, 0.16, 0.5, mat.metal, 10);
        s.rotation.x = Math.PI / 2; s.position.set(p[0], p[1], d / 2 + 0.1); g.add(s);
      });
      g.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
      g.userData.horn = horn;
      return g;
    }

    // bracket side-plate pair forming an open printed link extending +Y
    function makeLink(len, width, opts) {
      opts = opts || {};
      const g = new THREE.Group();
      const t = opts.thick || 0.6;
      const left = box(t, len, opts.depth || 3.4, mat.printed);
      left.position.set(-width / 2, len / 2, 0);
      const right = box(t, len, opts.depth || 3.4, mat.printed);
      right.position.set(width / 2, len / 2, 0);
      g.add(left, right);
      // back rib for the printed look
      if (opts.rib !== false) {
        const rib = box(width, len * 0.78, 0.5, mat.printed);
        rib.position.set(0, len / 2, -(opts.depth || 3.4) / 2 + 0.25);
        g.add(rib);
      }
      g.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
      g.userData.plates = [left, right];
      return g;
    }

    // ===================== KINEMATIC CHAIN =====================
    const root = new THREE.Group();

    // dimensions
    const BASE_R = 6.6, BASE_H = 2.4;
    const YAW_SERVO_H = 4.6;
    const SH_PIVOT = 3.4;        // shoulder pivot above yaw top
    const UPPER_LEN = 11.5;
    const FORE_LEN = 9.5;
    const ROLL_LEN = 4.2;

    // ----- Base (static) -----
    const baseGroup = new THREE.Group(); root.add(baseGroup);
    const plate = cyl(BASE_R, BASE_R * 1.06, BASE_H, mat.printed, 48);
    plate.position.y = BASE_H / 2; plate.castShadow = plate.receiveShadow = true;
    reg('base_plate', plate);
    baseGroup.add(plate);
    const plateRing = cyl(BASE_R * 0.62, BASE_R * 0.62, 0.5, mat.servoTop, 40);
    plateRing.position.y = BASE_H + 0.2; baseGroup.add(plateRing);
    // yaw actuator servo (stands in base, horn up)
    const yawServo = makeServo({ w: 3.0, h: YAW_SERVO_H, d: 3.7 });
    yawServo.rotation.x = -Math.PI / 2;              // +Z (horn) -> +Y (up)
    yawServo.position.y = BASE_H + YAW_SERVO_H / 2;
    reg('servo_yaw', yawServo);
    baseGroup.add(yawServo);
    labelAnchors.push({ name: 'servo_yaw', label: 'Base servo · yaw', obj: yawServo });

    const yawTopY = BASE_H + YAW_SERVO_H + 0.2;

    // ----- Yaw group (joint 1: rotate about Y) -----
    const yawGroup = new THREE.Group(); yawGroup.position.y = yawTopY; root.add(yawGroup);

    // shoulder mount: U bracket
    const shMount = new THREE.Group(); yawGroup.add(shMount);
    const mountBase = box(6.4, 0.7, 4.0, mat.printed); mountBase.position.y = 0.35;
    const mountL = box(0.7, SH_PIVOT + 0.6, 4.0, mat.printed); mountL.position.set(-2.5, SH_PIVOT / 2 + 0.6, 0);
    const mountR = box(0.7, SH_PIVOT + 0.6, 4.0, mat.printed); mountR.position.set(2.5, SH_PIVOT / 2 + 0.6, 0);
    shMount.add(mountBase, mountL, mountR);
    shMount.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
    reg('shoulder_mount', shMount, new THREE.Vector3(0, -3.2, 0));

    // shoulder servo sits at pivot, horn -> world X
    const shPivotY = SH_PIVOT + 0.6;
    const shServo = makeServo({ w: 2.7, h: 5.0, d: 3.7 });
    shServo.rotation.y = -Math.PI / 2;     // +Z(horn) -> +X
    shServo.position.y = shPivotY;
    reg('servo_shoulder', shServo, new THREE.Vector3(0, 1.5, 5.0));
    yawGroup.add(shServo);
    labelAnchors.push({ name: 'servo_shoulder', label: 'Shoulder servo · pitch', obj: shServo });

    // ----- Shoulder group (joint 2: rotate about X) -----
    const shoulderGroup = new THREE.Group(); shoulderGroup.position.y = shPivotY; yawGroup.add(shoulderGroup);
    const upperArm = makeLink(UPPER_LEN, 4.0, { depth: 3.0, thick: 0.6 });
    upperArm.userData.plates.forEach((p, i) => reg('upperarm_' + (i ? 'r' : 'l'), p, new THREE.Vector3(i ? 5 : -5, 0, 0)));
    shoulderGroup.add(upperArm);
    labelAnchors.push({ name: 'upperarm_l', label: '3D-printed link', obj: upperArm.userData.plates[0] });

    // elbow servo at top of upper arm
    const elServo = makeServo({ w: 2.6, h: 4.6, d: 3.6 });
    elServo.rotation.y = -Math.PI / 2; elServo.position.y = UPPER_LEN;
    reg('servo_elbow', elServo, new THREE.Vector3(0, 1.5, 5.0));
    shoulderGroup.add(elServo);
    labelAnchors.push({ name: 'servo_elbow', label: 'Elbow servo · pitch', obj: elServo });

    // ----- Elbow group (joint 3) -----
    const elbowGroup = new THREE.Group(); elbowGroup.position.y = UPPER_LEN; shoulderGroup.add(elbowGroup);
    const foreArm = makeLink(FORE_LEN, 3.4, { depth: 2.7, thick: 0.55 });
    foreArm.userData.plates.forEach((p, i) => reg('forearm_' + (i ? 'r' : 'l'), p, new THREE.Vector3(i ? 4.5 : -4.5, 0, 0)));
    elbowGroup.add(foreArm);

    // wrist-pitch servo
    const wpServo = makeServo({ w: 2.4, h: 4.2, d: 3.3 });
    wpServo.rotation.y = -Math.PI / 2; wpServo.position.y = FORE_LEN;
    reg('servo_wristpitch', wpServo, new THREE.Vector3(0, 1.5, 4.5));
    elbowGroup.add(wpServo);
    labelAnchors.push({ name: 'servo_wristpitch', label: 'Wrist servo · pitch', obj: wpServo });

    // ----- Wrist pitch group (joint 4) -----
    const wristPitchGroup = new THREE.Group(); wristPitchGroup.position.y = FORE_LEN; elbowGroup.add(wristPitchGroup);
    // roll actuator extends +Y
    const rollServo = makeServo({ w: 2.3, h: ROLL_LEN, d: 3.1 });
    rollServo.rotation.x = -Math.PI / 2; // horn up along arm axis
    rollServo.position.y = ROLL_LEN / 2 + 0.4;
    reg('servo_wristroll', rollServo, new THREE.Vector3(0, 3.5, 0));
    wristPitchGroup.add(rollServo);
    labelAnchors.push({ name: 'servo_wristroll', label: 'Wrist servo · roll', obj: rollServo });

    // ----- Wrist roll group (joint 5: rotate about local Y) -----
    const wristRollGroup = new THREE.Group(); wristRollGroup.position.y = ROLL_LEN + 0.6; wristPitchGroup.add(wristRollGroup);

    // ===== END EFFECTORS =====
    // --- Follower gripper ---
    const gripFollower = new THREE.Group(); wristRollGroup.add(gripFollower);
    const gripBase = box(5.6, 2.4, 3.6, mat.printed); gripBase.position.y = 1.2;
    gripBase.castShadow = gripBase.receiveShadow = true;
    reg('gripper_base', gripBase, new THREE.Vector3(0, 2.5, 0));
    gripFollower.add(gripBase);
    // gripper servo on the base
    const grServo = makeServo({ w: 2.2, h: 3.4, d: 2.8 });
    grServo.rotation.y = -Math.PI / 2; grServo.position.set(0, 1.2, -0.2); grServo.scale.set(0.8, 0.8, 0.8);
    reg('servo_gripper', grServo, new THREE.Vector3(0, 0, -5));
    gripFollower.add(grServo);
    labelAnchors.push({ name: 'servo_gripper', label: 'Gripper servo', obj: gripBase });
    const FINGER = 5.2;
    // fixed jaw
    const jawFixed = new THREE.Group(); jawFixed.position.set(-1.4, 2.4, 0);
    const jfPlate = box(0.8, FINGER, 2.8, mat.printed); jfPlate.position.y = FINGER / 2;
    const jfPad = box(0.5, FINGER * 0.7, 2.4, mat.pad); jfPad.position.set(0.55, FINGER * 0.45, 0);
    jawFixed.add(jfPlate, jfPad); jawFixed.traverse(o => { o.castShadow = o.receiveShadow = true; });
    reg('jaw_fixed', jawFixed, new THREE.Vector3(-4, 1, 0));
    gripFollower.add(jawFixed);
    // moving jaw (pivots about Z)
    const jawMovingPivot = new THREE.Group(); jawMovingPivot.position.set(1.4, 2.4, 0);
    const jmPlate = box(0.8, FINGER, 2.8, mat.printed); jmPlate.position.y = FINGER / 2;
    const jmPad = box(0.5, FINGER * 0.7, 2.4, mat.pad); jmPad.position.set(-0.55, FINGER * 0.45, 0);
    jawMovingPivot.add(jmPlate, jmPad); jawMovingPivot.traverse(o => { o.castShadow = o.receiveShadow = true; });
    reg('jaw_moving', jawMovingPivot, new THREE.Vector3(4, 1, 0));
    gripFollower.add(jawMovingPivot);
    labelAnchors.push({ name: 'jaw_moving', label: 'Parallel jaw', obj: jawMovingPivot });

    // --- Leader handle (hidden by default) ---
    const gripLeader = new THREE.Group(); gripLeader.visible = false; wristRollGroup.add(gripLeader);
    const lhBase = box(4.4, 2.0, 3.2, mat.printed); lhBase.position.y = 1.0; gripLeader.add(lhBase);
    const handle = cyl(1.1, 1.1, 7.0, mat.printed, 24); handle.position.set(0, 5.0, 0); gripLeader.add(handle);
    const handleGrip = cyl(1.25, 1.25, 4.0, mat.pad, 24); handleGrip.position.set(0, 5.6, 0); gripLeader.add(handleGrip);
    // trigger
    const triggerPivot = new THREE.Group(); triggerPivot.position.set(1.1, 3.0, 0);
    const trig = box(0.6, 2.6, 1.6, mat.printed); trig.position.set(0.4, 1.0, 0); triggerPivot.add(trig);
    gripLeader.add(triggerPivot);
    gripLeader.traverse(o => { o.castShadow = o.receiveShadow = true; });

    // ===================== JOINT API =====================
    const joints = {
      yaw:        { group: yawGroup,        axis: 'y', min: -2.7,  max: 2.7,  val: 0 },
      shoulder:   { group: shoulderGroup,   axis: 'x', min: -1.4,  max: 1.6,  val: 0 },
      elbow:      { group: elbowGroup,      axis: 'x', min: -2.1,  max: 1.4,  val: 0 },
      wristPitch: { group: wristPitchGroup, axis: 'x', min: -1.7,  max: 1.7,  val: 0 },
      wristRoll:  { group: wristRollGroup,  axis: 'y', min: -2.9,  max: 2.9,  val: 0 },
    };
    Object.keys(joints).forEach(k => {
      const j = joints[k];
      j.apply = function (v) { j.group.rotation[j.axis] = v; };
    });
    function applyJoint(name) {
      const j = joints[name];
      j.group.rotation[j.axis] = j.val;
    }
    function setJoint(name, v) {
      const j = joints[name];
      j.val = Math.max(j.min, Math.min(j.max, v));
      applyJoint(name);
    }

    // gripper: 0 = closed, 1 = open
    let gripperVal = 0.35;
    function setGripper(t) {
      gripperVal = Math.max(0, Math.min(1, t));
      const ang = gripperVal * 0.7;
      jawMovingPivot.rotation.z = ang;
      jawFixed.rotation.z = -ang * 0.85;
      triggerPivot.rotation.z = -gripperVal * 0.5;
    }
    setGripper(gripperVal);

    // ===================== COLORS =====================
    function setColors(c) {
      if (c.printed) mat.printed.color.set(c.printed);
      if (c.servo) { mat.servo.color.set(c.servo); mat.servoTop.color.set(c.servo).offsetHSL(0, 0, 0.06); }
      if (c.accent) mat.accent.color.set(c.accent);
    }

    // ===================== MODE =====================
    let mode = 'follower';
    function setMode(m) {
      mode = m;
      gripFollower.visible = (m === 'follower');
      gripLeader.visible = (m === 'leader');
    }
    setMode('follower');

    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    function applyExplode(t) {
      const spread = 7.0;
      parts.forEach(p => {
        const b = p.obj.userData.basePos, e = p.obj.userData.explode;
        p.obj.position.set(b.x + e.x * t, b.y + e.y * t, b.z + e.z * t);
      });
    }

    return {
      root, joints, parts, labelAnchors, mat,
      setJoint, setGripper, setColors, setMode, applyExplode,
      getGripper: () => gripperVal, getMode: () => mode,
    };
  }

  window.SO101.build = build;
})();
