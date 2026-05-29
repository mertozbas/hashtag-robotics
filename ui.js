/* Wire DOM controls to the viewer + interactions layer. */
(async function () {
  const THREE = window.THREE;
  const canvas = document.getElementById('scene');
  const labelLayer = document.getElementById('label-layer');
  const overlay = document.getElementById('loading');
  const loadBar = document.getElementById('load-bar');
  const loadTxt = document.getElementById('load-txt');
  function onProgress(done, total) {
    if (loadBar) loadBar.style.width = Math.round(done / total * 100) + '%';
    if (loadTxt) loadTxt.textContent = 'Mesh yükleniyor ' + done + '/' + total;
  }
  const V = await window.SO101.createViewer(canvas, labelLayer, THREE, onProgress);
  window.SO101.viewer = V;
  if (overlay) { overlay.style.opacity = '0'; setTimeout(() => overlay.style.display = 'none', 500); }

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  // ---------- tabs ----------
  $$('#tabs button').forEach(b => b.addEventListener('click', () => {
    $$('#tabs button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    $$('.panel').forEach(p => p.classList.toggle('on', p.dataset.panel === b.dataset.tab));
  }));

  // ---------- mode ----------
  $$('#mode-seg button').forEach(b => b.addEventListener('click', () => {
    $$('#mode-seg button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    const m = b.dataset.mode;
    V.setMode(m);
    $('#product-title').textContent = m === 'follower' ? 'SO-101 Follower Arm' : 'SO-101 Leader Arm';
    $('#product-desc').textContent = m === 'follower'
      ? '5 eksenli, tutuculu açık kaynak masaüstü robot kol. Bir parçaya dokun, hareketleri izle. Hazır hissedersen kendine bir tane ayırt.'
      : 'Operatörün elle yönlendirdiği kontrolcü kol; çalışan kola birebir hareket aktarır. İkisini birden mi istersin? Ön siparişte belirt.';
  }));

  // ---------- gripper ----------
  function updateGripLabel(v) {
    $('#grip-val').textContent = v < 10 ? 'kapalı' : v > 90 ? 'tam açık' : 'açık ' + v + '%';
  }
  $('#grip-slider').addEventListener('input', e => {
    const v = +e.target.value; V.setGripperTarget(v / 100); updateGripLabel(v);
  });

  // ---------- joints ----------
  const jointMeta = [
    { key: 'yaw', label: 'Taban · yaw' },
    { key: 'shoulder', label: 'Omuz · pitch' },
    { key: 'elbow', label: 'Dirsek · pitch' },
    { key: 'wristPitch', label: 'Bilek · pitch' },
    { key: 'wristRoll', label: 'Bilek · roll' },
  ];
  const jointSliders = {};
  const rows = $('#joint-rows');
  jointMeta.forEach(jm => {
    const j = V.arm.joints[jm.key];
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = '<div class="lab"><span>' + jm.label + '</span><span class="val" id="jv-' + jm.key + '">0°</span></div>'
      + '<input type="range" min="' + Math.round(j.min * 57.3) + '" max="' + Math.round(j.max * 57.3) + '" value="0" />';
    rows.appendChild(row);
    const slider = row.querySelector('input');
    jointSliders[jm.key] = slider;
    slider.addEventListener('input', e => {
      const deg = +e.target.value;
      V.setJointTarget(jm.key, deg / 57.3);
      $('#jv-' + jm.key).textContent = deg + '°';
    });
  });

  // ---------- poses ----------
  const poseTable = {
    rest: { yaw: 0, shoulder: -1.222, elbow: 0.873, wristPitch: 1.309, wristRoll: 0, grip: 50 },
    home: { yaw: 0, shoulder: -0.9, elbow: 1.0, wristPitch: 0.6, wristRoll: 0, grip: 45 },
    reach: { yaw: -0.28, shoulder: -0.55, elbow: -0.35, wristPitch: 0.35, wristRoll: 0, grip: 50 },
    grasp: { yaw: 0.2, shoulder: -0.5, elbow: 0.9, wristPitch: 0.75, wristRoll: 0, grip: 8 },
    lift: { yaw: 0.45, shoulder: -1.1, elbow: 0.2, wristPitch: 0.45, wristRoll: 1.0, grip: 6 },
  };
  function selectPose(name, instant) {
    if (window.SO101.ix) window.SO101.ix.stop();
    V.goPose(name);
    if (instant && V.snapToTargets) V.snapToTargets();
    const p = poseTable[name]; if (!p) return;
    jointMeta.forEach(jm => {
      if (jm.key in p) {
        const deg = Math.round(p[jm.key] * 57.3);
        if (jointSliders[jm.key]) jointSliders[jm.key].value = deg;
        const el = $('#jv-' + jm.key); if (el) el.textContent = deg + '°';
      }
    });
    if ('grip' in p) { $('#grip-slider').value = p.grip; updateGripLabel(p.grip); }
  }
  $$('#pose-grid button').forEach(b => b.addEventListener('click', () => selectPose(b.dataset.pose)));

  // initial articulated pose
  selectPose('rest', true);

  // ---------- view toggles ----------
  function toggle(btn, on, onText) {
    btn.classList.toggle('on', on);
    btn.querySelector('.state').textContent = on ? (onText || 'on') : 'off';
  }
  let explodeOn = false;
  $('#explode-btn').addEventListener('click', () => {
    explodeOn = !explodeOn; toggle($('#explode-btn'), explodeOn);
    V.setExplode(explodeOn ? 1 : 0);
    $('#explode-slider').value = explodeOn ? 100 : 0;
  });
  $('#explode-slider').addEventListener('input', e => {
    const v = +e.target.value / 100; V.setExplode(v);
    explodeOn = v > 0.02; toggle($('#explode-btn'), explodeOn);
  });
  let labelsOn = false;
  $('#labels-btn').addEventListener('click', () => {
    labelsOn = !labelsOn; toggle($('#labels-btn'), labelsOn); V.setLabels(labelsOn);
  });
  $('#reset-btn').addEventListener('click', () => V.resetView());
  let autoOn = true;
  toggle($('#auto-btn'), true);
  $('#auto-btn').addEventListener('click', () => {
    autoOn = !autoOn; toggle($('#auto-btn'), autoOn); V.setAutoRotate(autoOn);
  });

  // ---------- colors ----------
  const printedColors = ['#3b3c42', '#1b1c20', '#6a6c74', '#d7d8dc', '#c4622d', '#2f5e8c'];
  const accentColors = ['#e08a3c', '#4f9bff', '#46c08a', '#d24f6e', '#c9b15a', '#ffffff'];
  const bgPairs = [
    ['#0b0e18', '#020204'], ['#000000', '#000000'],
    ['#0e1424', '#03040a'], ['#1a1020', '#070309'], ['#0a1612', '#02060a'],
  ];
  function buildSwatches(container, items, getColor, onPick, initial) {
    items.forEach((it, i) => {
      const s = document.createElement('div'); s.className = 'swatch';
      s.style.background = getColor(it);
      if (i === initial) s.classList.add('on');
      s.addEventListener('click', () => {
        container.querySelectorAll('.swatch').forEach(x => x.classList.remove('on'));
        s.classList.add('on'); onPick(it);
      });
      container.appendChild(s);
    });
  }
  buildSwatches($('#printed-swatches'), printedColors, c => c, c => { if (window.SO101.ix) window.SO101.ix.deselect(); V.setColors({ printed: c }); }, 0);
  buildSwatches($('#accent-swatches'), accentColors, c => c, c => {
    V.setColors({ accent: c });
    document.documentElement.style.setProperty('--accent', c);
    document.documentElement.style.setProperty('--accent-soft', c + '28');
  }, 0);
  buildSwatches($('#bg-swatches'), bgPairs,
    p => 'linear-gradient(135deg,' + p[0] + ',' + p[1] + ')',
    p => V.setBackground(p[0], p[1]), 0);

  // ====================================================================
  //  INTERACTIONS - selection, part tour, moves
  // ====================================================================
  const ix = window.SO101.initInteractions(V);
  window.SO101.ix = ix;
  const PARTS = ix.getParts();
  const ORDER = ix.getOrder();

  // build part list
  const partList = $('#part-list');
  ORDER.forEach((id, i) => {
    const meta = PARTS[id];
    const row = document.createElement('button');
    row.className = 'part-row'; row.dataset.id = id;
    row.innerHTML =
      '<span class="pr-idx">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<span class="pr-body"><span class="pr-name">' + meta.name + '</span>' +
      '<span class="pr-type">' + meta.type + '</span></span>' +
      '<span class="pr-qty">' + meta.qty + '</span>';
    row.addEventListener('click', () => ix.select(id));
    partList.appendChild(row);
  });

  // moves
  $$('.move-btn').forEach(b => b.addEventListener('click', () => ix.play(b.dataset.move)));
  $('#stop-btn').addEventListener('click', () => { ix.goHome(); });

  // inspector elements
  const insp = $('#inspector');
  function showInspector(id) {
    const meta = PARTS[id]; if (!meta) return;
    $('#insp-type').textContent = meta.type;
    $('#insp-name').textContent = meta.name;
    $('#insp-desc').textContent = meta.desc;
    $('#insp-mat').textContent = meta.material;
    $('#insp-qty').textContent = meta.qty;
    const tags = $('#insp-tags'); tags.innerHTML = '';
    (meta.tags || []).forEach(t => { const s = document.createElement('span'); s.className = 'insp-tag'; s.textContent = t; tags.appendChild(s); });
    const idx = ORDER.indexOf(id);
    $('#insp-count').textContent = (idx + 1) + ' / ' + ORDER.length;
    insp.classList.add('open');
    document.getElementById('product').classList.add('hidden');
  }
  function hideInspector() {
    insp.classList.remove('open');
    document.getElementById('product').classList.remove('hidden');
  }
  $('#insp-close').addEventListener('click', () => ix.deselect());
  $('#insp-prev').addEventListener('click', () => ix.tourPrev());
  $('#insp-next').addEventListener('click', () => ix.tourNext());

  ix.onChange(id => {
    $$('.part-row').forEach(r => r.classList.toggle('on', r.dataset.id === id));
    if (id) {
      showInspector(id);
      const active = partList.querySelector('.part-row.on');
      if (active && active.scrollIntoView) {
        // keep selection visible in the list without scrolling the page
        const top = active.offsetTop - partList.offsetTop - 60;
        partList.scrollTop = Math.max(0, top);
      }
    } else {
      hideInspector();
    }
  });

  ix.onMoveChange(name => {
    $$('.move-btn').forEach(b => b.classList.toggle('playing', b.dataset.move === name));
    const st = $('#stop-btn').querySelector('.state');
    st.textContent = name ? 'oynuyor' : 'hazır';
    $('#stop-btn').classList.toggle('on', !!name);
  });

  // ---------- hint: fade slightly after a while ----------
  setTimeout(() => { const h = $('#hint'); if (h) h.classList.add('dim'); }, 9000);
})();
