/* SO-101 REAL model builder.
   Loads the actual onshape-exported STL meshes (via jsDelivr CDN, from the
   TheRobotStudio/SO-ARM100 repo) and assembles them into the exact kinematic
   chain described by the MuJoCo model so101_new_calib.xml.
   Returns the same API shape as arm.js so the viewer/UI work unchanged. */
window.SO101 = window.SO101 || {};
(function () {
  const MESH_BASE = 'https://cdn.jsdelivr.net/gh/TheRobotStudio/SO-ARM100@main/Simulation/SO101/assets/';

  // MuJoCo quat is (w,x,y,z); THREE.Quaternion is (x,y,z,w).
  function quat(THREE, q) { return new THREE.Quaternion(q[1], q[2], q[3], q[0]); }

  // ---- Body / geom spec, transcribed from so101_new_calib.xml ----
  const SERVO = ['sts3215_03a_v1', 'sts3215_03a_no_horn_v1'];
  const SPEC = {
    name: 'base', pos: [0, 0, 0], quat: [1, 0, 0, 0],
    geoms: [
      { m: 'base_motor_holder_so101_v1', pos: [-0.00636471, -9.94414e-05, -0.0024], quat: [0.5, 0.5, 0.5, 0.5] },
      { m: 'base_so101_v2', pos: [-0.00636471, 0, -0.0024], quat: [0.5, 0.5, 0.5, 0.5] },
      { m: 'sts3215_03a_v1', pos: [0.0263353, 0, 0.0437], quat: [1, 0, 0, 0] },
      { m: 'waveshare_mounting_plate_so101_v2', pos: [-0.0309827, -0.000199441, 0.0474], quat: [0.5, 0.5, 0.5, 0.5] },
    ],
    children: [{
      name: 'shoulder', joint: 'yaw', pos: [0.0388353, 0, 0.0624], quat: [0, 0, -1, 0],
      range: [-1.91986, 1.91986],
      geoms: [
        { m: 'sts3215_03a_v1', pos: [-0.0303992, 0.000422241, -0.0417], quat: [0.5, 0.5, 0.5, -0.5] },
        { m: 'motor_holder_so101_base_v1', pos: [-0.0675992, -0.000177759, 0.0158499], quat: [0.5, 0.5, -0.5, 0.5] },
        { m: 'rotation_pitch_so101_v1', pos: [0.0122008, 2.22413e-05, 0.0464], quat: [0.707107, -0.707107, 0, 0] },
      ],
      children: [{
        name: 'upper_arm', joint: 'shoulder', pos: [-0.0303992, -0.0182778, -0.0542], quat: [0.5, -0.5, -0.5, -0.5],
        range: [-1.74533, 1.74533],
        geoms: [
          { m: 'sts3215_03a_v1', pos: [-0.11257, -0.0155, 0.0187], quat: [0, -0.707107, 0.707107, 0] },
          { m: 'upper_arm_so101_v1', pos: [-0.065085, 0.012, 0.0182], quat: [0, 1, 0, 0] },
        ],
        children: [{
          name: 'lower_arm', joint: 'elbow', pos: [-0.11257, -0.028, 0], quat: [0.707107, 0, 0, 0.707107],
          range: [-1.69, 1.69],
          geoms: [
            { m: 'under_arm_so101_v1', pos: [-0.0648499, -0.032, 0.0182], quat: [0, 1, 0, 0] },
            { m: 'motor_holder_so101_wrist_v1', pos: [-0.0648499, -0.032, 0.018], quat: [0, -1, 0, 0] },
            { m: 'sts3215_03a_v1', pos: [-0.1224, 0.0052, 0.0187], quat: [0, 0, 1, 0] },
          ],
          children: [{
            name: 'wrist', joint: 'wristPitch', pos: [-0.1349, 0.0052, 0], quat: [0.707107, 0, 0, -0.707107],
            range: [-1.65806, 1.65806],
            geoms: [
              { m: 'sts3215_03a_no_horn_v1', pos: [0, -0.0424, 0.0306], quat: [0.5, 0.5, 0.5, -0.5] },
              { m: 'wrist_roll_pitch_so101_v2', pos: [0, -0.028, 0.0181], quat: [0.5, -0.5, -0.5, -0.5] },
            ],
            children: [{
              name: 'gripper', joint: 'wristRoll', pos: [0, -0.0611, 0.0181], quat: [0.0172091, -0.0172091, 0.706897, 0.706897],
              range: [-2.74385, 2.84121],
              geoms: [
                { m: 'sts3215_03a_v1', pos: [0.0077, 0.0001, -0.0234], quat: [0.707107, -0.707107, 0, 0] },
                { m: 'wrist_roll_follower_so101_v1', pos: [0, -0.000218214, 0.000949706], quat: [0, 1, 0, 0], tag: 'follower_flange' },
              ],
              children: [{
                name: 'moving_jaw', joint: 'gripper', pos: [0.0202, 0.0188, -0.0234], quat: [0.707107, 0.707107, 0, 0],
                range: [-0.17453, 1.74533],
                geoms: [
                  { m: 'moving_jaw_so101_v1', pos: [0, 0, 0.0189], quat: [1, 0, 0, 0], tag: 'jaw' },
                ],
                children: [],
              }],
            }],
          }],
        }],
      }],
    }],
  };

  function collectMeshNames(spec, set) {
    spec.geoms.forEach(g => set.add(g.m));
    (spec.children || []).forEach(c => collectMeshNames(c, set));
    return set;
  }

  async function buildReal(THREE, onProgress) {
    if (!THREE.STLLoader) throw new Error('STLLoader missing');
    const names = Array.from(collectMeshNames(SPEC, new Set()));
    const loader = new THREE.STLLoader();
    const geos = {};
    let done = 0;
    function loadOne(name, tries) {
      return new Promise(resolve => {
        const attempt = left => {
          loader.load(MESH_BASE + name + '.stl',
            g => { geos[name] = g; done++; if (onProgress) onProgress(done, names.length); resolve(); },
            undefined,
            () => {
              if (left > 0) { setTimeout(() => attempt(left - 1), 500); }
              else { console.warn('mesh failed (placeholder):', name); geos[name] = new THREE.BufferGeometry(); done++; if (onProgress) onProgress(done, names.length); resolve(); }
            });
        };
        attempt(tries);
      });
    }
    // limited concurrency so a background tab doesn't choke on 13 parallel fetches
    let idx = 0;
    async function worker() { while (idx < names.length) { const n = names[idx++]; await loadOne(n, 3); } }
    await Promise.all([worker(), worker(), worker(), worker()]);

    // materials
    const mat = {
      printed: new THREE.MeshStandardMaterial({ color: 0x3b3c42, roughness: 0.5, metalness: 0.2 }),
      servo: new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.55, metalness: 0.35 }),
      accent: new THREE.MeshStandardMaterial({ color: 0xd98a3d, roughness: 0.4, metalness: 0.25 }),
    };

    const joints = {};
    const parts = [];      // { obj, baseLocal, kind, mat } leaf meshes
    const frames = [];     // { obj, basePos } body frames for link separation
    const labelAnchors = [];
    const tagged = {};

    function buildBody(spec, parentPivot, depth) {
      const frame = new THREE.Group();
      frame.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      frame.quaternion.copy(quat(THREE, spec.quat));
      parentPivot.add(frame);
      if (spec.name !== 'base') frames.push({ obj: frame, basePos: frame.position.clone(), depth: depth });

      const pivot = new THREE.Group();
      frame.add(pivot);

      spec.geoms.forEach(g => {
        const isServo = SERVO.indexOf(g.m) !== -1;
        const kind = isServo ? 'servo' : 'printed';
        // per-mesh material clone so we can highlight / dim each part independently
        const meshMat = (isServo ? mat.servo : mat.printed).clone();
        meshMat.userData = { baseColor: meshMat.color.clone() };
        const mesh = new THREE.Mesh(geos[g.m], meshMat);
        mesh.position.set(g.pos[0], g.pos[1], g.pos[2]);
        mesh.quaternion.copy(quat(THREE, g.quat));
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.userData.isServo = isServo;
        mesh.userData.partId = g.m;
        mesh.userData.kind = kind;
        pivot.add(mesh);
        parts.push({ obj: mesh, baseLocal: mesh.position.clone(), kind: kind, mat: meshMat });
        if (g.tag) tagged[g.tag] = mesh;
      });

      if (spec.joint) {
        joints[spec.joint] = {
          pivot: pivot, min: spec.range[0], max: spec.range[1], val: 0,
          apply(v) { pivot.rotation.z = v; },
        };
      }

      (spec.children || []).forEach(c => buildBody(c, pivot, depth + 1));
      return { frame, pivot };
    }

    const armRoot = new THREE.Group();
    buildBody(SPEC, armRoot, 0);

    // label anchors - one per leaf mesh, named from the parts metadata so EVERY
    // part gets a callout. Repeated servos are numbered (Servo 1..6).
    const PARTMETA = (window.SO101 && window.SO101.PARTS) || {};
    const servoSeq = {};
    parts.forEach(p => {
      const id = p.obj.userData.partId;
      const meta = PARTMETA[id];
      let label = meta ? meta.name : id;
      // number repeated parts (the STS3215 appears 6×)
      const count = parts.filter(q => q.obj.userData.partId === id).length;
      if (count > 1) {
        servoSeq[id] = (servoSeq[id] || 0) + 1;
        label = label + ' ' + servoSeq[id];
      }
      labelAnchors.push({ name: id, label: label, obj: p.obj });
    });

    // Leader vs Follower: kinematically identical; only the end-effector differs
    // (follower = parallel gripper, leader = hand-held control handle + trigger).
    // Build a credible leader handle parented to the wrist so it moves with the arm.
    const leaderHandle = new THREE.Group();
    (function buildHandle() {
      const hMat = mat.printed.clone(); hMat.userData = { baseColor: hMat.color.clone() };
      const padMat = new THREE.MeshStandardMaterial({ color: 0x141417, roughness: 0.82, metalness: 0.1 });
      const metalMat = new THREE.MeshStandardMaterial({ color: 0xb7b8bd, roughness: 0.3, metalness: 0.85 });
      // built along +Z; the whole group is then rotated so +Z points outward
      // (the direction the gripper jaws extend) so it reads as a held control grip.
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.02, 24), hMat);
      collar.rotation.x = Math.PI / 2; collar.position.set(0, 0, 0.012);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.10, 24), hMat);
      shaft.rotation.x = Math.PI / 2; shaft.position.set(0, 0, 0.075);
      // T crossbar grip the operator holds
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.15, 28), padMat);
      grip.rotation.z = Math.PI / 2; grip.position.set(0, 0, 0.135);
      const cap1 = new THREE.Mesh(new THREE.SphereGeometry(0.021, 18, 14), hMat); cap1.position.set(0.075, 0, 0.135);
      const cap2 = new THREE.Mesh(new THREE.SphereGeometry(0.021, 18, 14), hMat); cap2.position.set(-0.075, 0, 0.135);
      // trigger lever
      const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.026, 0.011), metalMat);
      trigger.position.set(0, -0.026, 0.10); trigger.rotation.x = 0.35;
      leaderHandle.add(collar, shaft, grip, cap1, cap2, trigger);
      leaderHandle.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      // orient +Z toward where the jaws extend (in the gripper pivot's local frame)
      const dir = new THREE.Vector3(0.0202, 0.0188, -0.0234).normalize();
      leaderHandle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      leaderHandle.visible = false;
    })();
    if (joints.wristRoll) joints.wristRoll.pivot.add(leaderHandle);

    // ---- public API ----
    function setJoint(name, v) { const j = joints[name]; if (!j) return; j.val = Math.max(j.min, Math.min(j.max, v)); j.apply(j.val); }

    let gripperVal = 0.4;
    const gJoint = joints.gripper;
    function setGripper(t) {
      gripperVal = Math.max(0, Math.min(1, t));
      // closed -> open across the joint's usable range
      const a = -0.1 + gripperVal * 1.05;
      if (gJoint) { gJoint.val = a; gJoint.apply(a); }
    }
    setGripper(gripperVal);

    function setColors(c) {
      if (c.printed) mat.printed.color.set(c.printed);
      if (c.servo) mat.servo.color.set(c.servo);
      if (c.accent) mat.accent.color.set(c.accent);
      // propagate to per-mesh clones + refresh their stored base color
      parts.forEach(p => {
        if (c[p.kind]) {
          p.mat.color.set(c[p.kind]);
          p.mat.userData.baseColor = p.mat.color.clone();
        }
      });
    }

    let mode = 'follower';
    function setMode(m) {
      mode = m;
      const lead = (m === 'leader');
      leaderHandle.visible = lead;
      if (tagged.jaw) tagged.jaw.visible = !lead;
      if (tagged.follower_flange) tagged.follower_flange.visible = !lead;
    }

    function applyExplode(t) {
      const kLink = 0.62, spread = 0.045;
      frames.forEach(f => {
        const s = 1 + t * kLink;
        f.obj.position.set(f.basePos.x * s, f.basePos.y * s, f.basePos.z * s);
      });
      parts.forEach(p => {
        const b = p.baseLocal; const len = b.length() || 1e-6;
        const k = 1 + (t * spread) / len;
        p.obj.position.set(b.x * k, b.y * k, b.z * k);
      });
    }

    // orient Z-up (MuJoCo) -> Y-up (three) and scale to scene units
    const root = new THREE.Group();
    armRoot.rotation.x = -Math.PI / 2;
    root.add(armRoot);
    const S = 90;
    root.scale.set(S, S, S);

    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    return {
      root, joints, parts, labelAnchors, mat, tagged, leaderHandle,
      setJoint, setGripper, setColors, setMode, applyExplode,
      getGripper: () => gripperVal, getMode: () => mode,
      isReal: true,
    };
  }

  window.SO101.buildReal = buildReal;
})();
