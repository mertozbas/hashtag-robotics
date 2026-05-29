/* SO-101 dance groove: an original, royalty-free four-on-the-floor house loop
   synthesised entirely with the Web Audio API (no audio files, no copyrighted
   material). Starts on the "Dans Et" move, stops with it. Fires onBeat() on each
   quarter beat so the UI can pulse the background colours in time.
   API: window.SO101.groove = { start(), stop(), onBeat(cb), isPlaying() } */
window.SO101 = window.SO101 || {};
(function () {
  const BPM = 123;                 // matches the dance step cadence
  const stepDur = 60 / BPM / 4;    // 16th-note grid
  const LOOKAHEAD = 0.025;         // scheduler tick (s)
  const AHEAD = 0.14;              // schedule window (s)

  let ctx = null, master = null, noiseBuf = null;
  let playing = false, timer = null;
  let step = 0, nextTime = 0, beatNo = 0;
  const beatCbs = [];

  // --- groove pattern over one bar (16 steps) ---
  const KICK = [0, 4, 8, 12];
  const HAT = [2, 6, 10, 14];
  const OPENHAT = [14];
  const CLAP = [4, 12];
  // funky bassline (Hz), null = rest. A minor-ish, octave-bouncing disco feel.
  const A1 = 55.0, C2 = 65.41, D2 = 73.42, E2 = 82.41, G2 = 98.0, A2 = 110.0;
  const BASS = [A1, null, A2, null, A1, null, C2, null, E2, null, E2, D2, C2, null, A1, A2];
  // short chord stabs for the disco shimmer
  const STAB = { 0: [220.0, 261.63, 329.63], 10: [196.0, 246.94, 293.66] };

  function ensureCtx() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.0001;
      // gentle high cut so it sits softly behind the scene
      const cut = ctx.createBiquadFilter();
      cut.type = 'lowpass'; cut.frequency.value = 8000;
      master.connect(cut); cut.connect(ctx.destination);
      // white-noise buffer for hats / clap
      const n = ctx.sampleRate * 0.4;
      noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.22);
  }
  function hat(t, open) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    const g = ctx.createGain();
    const dur = open ? 0.13 : 0.035;
    g.gain.setValueAtTime(open ? 0.18 : 0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(hp); hp.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
  }
  function clap(t) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    s.connect(bp); bp.connect(g); g.connect(master); s.start(t); s.stop(t + 0.14);
  }
  function bass(t, freq) {
    const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = freq;
    lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 6;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.4, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 1.7);
    o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + stepDur * 1.9);
  }
  function stab(t, freqs) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    lp.connect(g); g.connect(master);
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (i - 1) * 6;
      o.connect(lp); o.start(t); o.stop(t + 0.24);
    });
  }

  function scheduleStep(s, t) {
    if (KICK.indexOf(s) !== -1) kick(t);
    if (HAT.indexOf(s) !== -1) hat(t, OPENHAT.indexOf(s) !== -1);
    if (CLAP.indexOf(s) !== -1) clap(t);
    if (BASS[s] != null) bass(t, BASS[s]);
    if (STAB[s]) stab(t, STAB[s]);
    // notify a quarter-beat for the visual pulse
    if (s % 4 === 0) {
      const b = beatNo++;
      const delay = Math.max(0, (t - ctx.currentTime) * 1000);
      setTimeout(() => { if (playing) beatCbs.forEach(cb => { try { cb(b); } catch (e) {} }); }, delay);
    }
  }

  function tick() {
    if (!playing) return;
    while (nextTime < ctx.currentTime + AHEAD) {
      scheduleStep(step, nextTime);
      nextTime += stepDur;
      step = (step + 1) % 16;
    }
    timer = setTimeout(tick, LOOKAHEAD * 1000);
  }

  function start() {
    if (playing || !ensureCtx()) return;
    playing = true; step = 0; beatNo = 0;
    nextTime = ctx.currentTime + 0.06;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.25);
    tick();
  }
  function stop() {
    if (!playing) return;
    playing = false;
    if (timer) { clearTimeout(timer); timer = null; }
    if (master && ctx) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    }
  }

  window.SO101.groove = {
    start, stop,
    onBeat: cb => beatCbs.push(cb),
    isPlaying: () => playing,
  };
})();
