/* SO-101 product page interactions: scroll reveal, reservation modal, form validation. */
(function () {
  'use strict';

  // ===================================================================
  //  TALEP FORMU AYARI — Google Form bağlantısı
  //  ----------------------------------------------------------------
  //  Aşağıdaki FORM_URL'e Google Form'unun PAYLAŞIM LİNKİNİ yapıştır
  //  (Gönder → bağlantı simgesi → kopyalanan link, ör. https://forms.gle/XXXX).
  //  Dolu olduğunda tüm "Talep bırak" butonları formu yeni sekmede açar.
  //  Boş bırakılırsa site içindeki yedek form (modal) çalışır.
  // ===================================================================
  const FORM_URL = ''; // <-- GOOGLE FORM LİNKİNİ BURAYA YAPIŞTIR, ör: 'https://forms.gle/XXXXXXXX'
  const FORM_POST = ''; // e.g. 'https://docs.google.com/forms/d/e/FORM_ID/formResponse'
  const ENTRY = { name: '', email: '', country: '', use: '', config: '', qty: '', note: '' };

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  // ---------- scroll reveal (progressive enhancement) ----------
  document.documentElement.classList.add('reveal-on');
  const revealEls = $$('.reveal');
  revealEls.forEach((el, i) => { el.style.transitionDelay = (Math.min(i % 4, 3) * 0.06) + 's'; });
  function revealInView() {
    const h = window.innerHeight || 800;
    revealEls.forEach(el => { if (el.getBoundingClientRect().top < h * 0.92) el.classList.add('in'); });
  }
  revealInView();
  window.addEventListener('scroll', revealInView, { passive: true });
  window.addEventListener('resize', revealInView);
  // safety net: never leave content stuck hidden
  setTimeout(() => revealEls.forEach(el => el.classList.add('in')), 1800);

  // ---------- modal ----------
  const modal = $('#modal');
  function openModal() {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    $('.modal-form').classList.remove('hide');
    $('.modal-success').classList.remove('show');
    setTimeout(() => { const f = $('#f-name'); if (f) f.focus(); }, 100);
  }
  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
  $$('[data-reserve]').forEach(b => b.addEventListener('click', (e) => {
    e.preventDefault();
    if (FORM_URL) { window.open(FORM_URL, '_blank'); return; }
    openModal();
  }));
  $('#modal .scrim').addEventListener('click', closeModal);
  $('#modal .close').addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });

  // ---------- segmented radio groups ----------
  $$('.seg-choice').forEach(group => {
    group.addEventListener('click', e => {
      const lbl = e.target.closest('label'); if (!lbl) return;
      group.querySelectorAll('label').forEach(l => l.classList.remove('sel'));
      lbl.classList.add('sel');
      const input = lbl.querySelector('input') || document.getElementById(lbl.htmlFor);
      if (input) input.checked = true;
    });
  });

  // ---------- validation ----------
  function setErr(fieldId, on) {
    const field = document.getElementById(fieldId).closest('.field');
    field.classList.toggle('show-err', on);
    document.getElementById(fieldId).classList.toggle('err', on);
  }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  const form = $('#reserve-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    const name = $('#f-name').value.trim();
    const email = $('#f-email').value.trim();
    if (!name) { setErr('f-name', true); ok = false; } else setErr('f-name', false);
    if (!validEmail(email)) { setErr('f-email', true); ok = false; } else setErr('f-email', false);
    if (!ok) return;

    // gather data
    const data = {
      name, email,
      country: $('#f-country').value.trim(),
      use: (form.querySelector('input[name="use"]:checked') || {}).value || '',
      config: (form.querySelector('input[name="config"]:checked') || {}).value || '',
      qty: $('#f-qty').value,
      note: $('#f-note').value.trim(),
    };

    // Option B: POST to a real Google Form if configured (fire-and-forget).
    if (FORM_POST && ENTRY.email) {
      const fd = new FormData();
      Object.keys(ENTRY).forEach(k => { if (ENTRY[k]) fd.append(ENTRY[k], data[k] || ''); });
      fetch(FORM_POST, { method: 'POST', mode: 'no-cors', body: fd }).catch(() => {});
    }

    // success state
    $('.modal-form').classList.add('hide');
    $('.modal-success').classList.add('show');
    $('#success-name').textContent = name.split(' ')[0] || '';
  });

  // ---------- subtle parallax on hero glow ----------
  const glow = $('.glow-ring');
  if (glow) {
    window.addEventListener('mousemove', (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 14;
      const y = (e.clientY / window.innerHeight - 0.5) * 14;
      glow.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    });
  }

  // ---------- year ----------
  const yr = $('#year'); if (yr) yr.textContent = new Date().getFullYear();
})();
