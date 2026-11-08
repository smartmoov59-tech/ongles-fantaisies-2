/* ==========================================================================
   Ongles Fantaisies 2 — comportement du site
   Site 100 % statique : aucun serveur, aucune base de données, aucun abonnement.
   La « réservation » prépare une demande (SMS / appel / agenda .ics), le salon confirme.
   ========================================================================== */
(() => {
  'use strict';

  /* ===== Réglages du salon : à modifier ici si besoin ===== */
  const SALON = {
    name: 'Ongles Fantaisies 2',
    phoneLabel: '04 42 67 37 72',
    tel: '+33442673772',
    // Numéro PORTABLE du salon (ex. '+33612345678') : active le bouton « Envoyer par SMS ».
    // Laissé vide, le bouton est masqué (un SMS ne peut pas être reçu sur le fixe 04 42 67 37 72 dans tous les cas).
    smsNumber: '',
    address: '5 Rue Agathe, 13510 Éguilles',
    openDays: [2, 3, 4, 5, 6],      // 0 = dimanche … 6 = samedi
    openFrom: 10, openTo: 19,
    firstSlot: 10 * 60, lastSlot: 18 * 60, slotStep: 30,
    daysAhead: 30
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const pad = n => String(n).padStart(2, '0');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safe = (name, fn) => { try { fn(); } catch (e) { console.warn('[' + name + ']', e); } };

  let lenis = null;

  /* ------------------------------------------------------------------ */
  /* Défilement vers une ancre (compatible Lenis)                        */
  /* ------------------------------------------------------------------ */
  function scrollToTarget(target, offset = 0) {
    if (!target) return;
    if (lenis) lenis.scrollTo(target, { offset, duration: 1.7, easing: t => 1 - Math.pow(1 - t, 4) });
    else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  /* ------------------------------------------------------------------ */
  /* Gouttes de vernis (séparateurs de sections)                         */
  /* ------------------------------------------------------------------ */
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function dripPath(seed) {
    const r = mulberry(seed), W = 1440, base = 20, f = 12;
    let x = W - r() * 30;
    let d = `M0 0H${W}V${base}L${x} ${base}`;
    while (x > 120) {
      const w = 18 + r() * 24, s = w * .34, L = 22 + r() * 72, c = x - w;
      d += `C${c + w * .5} ${base} ${c + s} ${base + f * .25} ${c + s} ${base + f}V${base + L}A${s} ${s} 0 0 1 ${c - s} ${base + L}V${base + f}C${c - s} ${base + f * .25} ${c - w * .5} ${base} ${c - w} ${base}`;
      x = c - w - 10 - r() * 105;
      d += `L${Math.max(x, 0)} ${base}`;
    }
    return d + `L0 ${base}Z`;
  }
  function initDrips() {
    $$('svg.drip').forEach(svg => {
      const p = $('path', svg);
      p.setAttribute('d', dripPath(+svg.dataset.seed || 1));
      p.setAttribute('fill', svg.dataset.drip || '#fff');
    });
  }

  /* ------------------------------------------------------------------ */
  /* Découpage du texte (masque qui monte)                               */
  /* ------------------------------------------------------------------ */
  function splitText(el, mode) {
    const label = el.textContent.trim().replace(/\s+/g, ' ');
    const walk = node => {
      Array.from(node.childNodes).forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
            const pieces = mode === 'chars' ? Array.from(part) : [part];
            pieces.forEach(ch => { const c = document.createElement('span'); c.className = 'c'; c.textContent = ch; w.appendChild(c); });
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    if (/^H[1-6]$/.test(el.tagName)) el.setAttribute('aria-label', label);
    return $$('.c', el);
  }

  /* ------------------------------------------------------------------ */
  /* Statut d'ouverture + tableau des horaires                            */
  /* ------------------------------------------------------------------ */
  function parisNow() {
    try { return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' })); } catch (e) { return new Date(); }
  }
  function initHours() {
    const now = parisNow(), day = now.getDay(), mins = now.getHours() * 60 + now.getMinutes();
    const row = $(`#hoursBody tr[data-d="${day}"]`); if (row) row.classList.add('today');
    const box = $('#openNow'); if (!box) return;
    const names = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const isOpenDay = SALON.openDays.includes(day);
    const open = isOpenDay && mins >= SALON.openFrom * 60 && mins < SALON.openTo * 60;
    let txt;
    if (open) txt = `Ouvert · ferme à ${SALON.openTo}h`;
    else {
      let add = 0;
      if (isOpenDay && mins < SALON.openFrom * 60) txt = `Fermé · ouvre aujourd’hui à ${SALON.openFrom}h`;
      else {
        do { add++; } while (!SALON.openDays.includes((day + add) % 7));
        txt = add === 1 ? `Fermé · ouvre demain à ${SALON.openFrom}h` : `Fermé · ouvre ${names[(day + add) % 7]} à ${SALON.openFrom}h`;
      }
    }
    box.classList.toggle('is-closed', !open);
    $('span', box).textContent = txt;
  }

  /* ------------------------------------------------------------------ */
  /* Carrousel d'avis                                                    */
  /* ------------------------------------------------------------------ */
  function initReviews() {
    const track = $('#revTrack'); if (!track) return;
    const cards = $$('.rcard', track), dots = $('#revDots');
    dots.innerHTML = cards.map(() => '<i></i>').join('');
    const dot = $$('i', dots);
    const pitch = () => cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth;
    const index = () => Math.max(0, Math.min(cards.length - 1, Math.round(track.scrollLeft / pitch())));
    const sync = () => { const i = index(); dot.forEach((d, k) => d.classList.toggle('is-on', k === i)); };
    const go = i => track.scrollTo({ left: Math.max(0, Math.min(cards.length - 1, i)) * pitch(), behavior: reduce ? 'auto' : 'smooth' });
    track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
    $('#revPrev').addEventListener('click', () => go(index() - 1));
    $('#revNext').addEventListener('click', () => go(index() + 1));
    sync();
    if (reduce) return;
    let paused = false, inView = false;
    ['pointerenter', 'focusin', 'pointerdown'].forEach(e => track.addEventListener(e, () => { paused = true; }));
    ['pointerleave', 'focusout'].forEach(e => track.addEventListener(e, () => { paused = false; }));
    new IntersectionObserver(en => { inView = en[0].isIntersecting; }, { threshold: .4 }).observe(track);
    setInterval(() => { if (paused || !inView || document.hidden) return; const i = index(); go(i >= cards.length - 1 ? 0 : i + 1); }, 5200);
  }

  /* ------------------------------------------------------------------ */
  /* « Composez votre fantaisie »                                        */
  /* ------------------------------------------------------------------ */
  const mix = { text: 'Framboise · Brillant', touched: false };
  function initComposer() {
    const svg = $('#nailsSvg'); if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';
    const COLORS = [
      ['Framboise', '#D81E5B'], ['Rose poudré', '#F4B8C8'], ['Nude', '#E7C3A8'], ['Lilas', '#B9A3F0'], ['Bleu glacier', '#9CD3F0'],
      ['Pistache', '#B5DDB0'], ['Cerise', '#B8102E'], ['Bordeaux', '#5A1030'], ['Noir velours', '#1B1320'], ['Or', '#D8A94A']
    ];
    const FINISHES = [['brillant', 'Brillant'], ['mat', 'Mat'], ['paillete', 'Pailleté'], ['chrome', 'Chromé']];
    const NAILS = [
      { x: 64, y: 312, r: -50, s: 1, n: 'Pouce' }, { x: 172, y: 272, r: -14, s: 1.08, n: 'Index' }, { x: 278, y: 256, r: 0, s: 1.2, n: 'Majeur' },
      { x: 384, y: 272, r: 14, s: 1.08, n: 'Annulaire' }, { x: 466, y: 312, r: 36, s: .88, n: 'Auriculaire' }
    ];
    const D = 'M0 -128C22 -128 38 -84 40 -34C41 -10 26 0 0 0C-26 0 -41 -10 -40 -34C-38 -84 -22 -128 0 -128Z';
    const state = NAILS.map(() => ({ c: 0, f: 'brillant' }));
    let sel = 'all';

    svg.innerHTML = `
      <defs>
        <pattern id="glit" width="30" height="30" patternUnits="userSpaceOnUse">
          <circle cx="5" cy="6" r="1.7" fill="#fff"/><circle cx="19" cy="13" r="1.3" fill="#FFE9A8"/><circle cx="10" cy="23" r="1.5" fill="#fff"/>
          <path d="M24 3l1.1 2.7 2.7 1.1-2.7 1.1-1.1 2.7-1.1-2.7-2.7-1.1 2.7-1.1z" fill="#FFE9A8"/><circle cx="27" cy="22" r="1.2" fill="#fff"/>
        </pattern>
        <linearGradient id="chr" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/>
          <stop offset=".62" stop-color="#1a0a1d" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity=".75"/>
        </linearGradient>
        <filter id="sh" x="-30%" y="-20%" width="160%" height="160%"><feDropShadow dx="0" dy="12" stdDeviation="9" flood-color="#2B0F2E" flood-opacity=".3"/></filter>
      </defs>
      <ellipse cx="260" cy="338" rx="230" ry="12" fill="#2B0F2E" opacity=".1"/>` +
      NAILS.map((n, i) => `
      <g transform="translate(${n.x} ${n.y}) rotate(${n.r}) scale(${n.s})">
        <g class="nail" data-i="${i}" role="button" tabindex="0" aria-label="${n.n}" filter="url(#sh)">
          <path class="nail__body" d="${D}" fill="${COLORS[0][1]}"/>
          <path class="nail__fx" d="${D}" fill="url(#glit)" opacity="0"/>
          <path class="nail__gloss" d="M-24 -92C-29 -66 -29 -40 -25 -22" stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none" opacity=".55"/>
          <path d="M-31 -16Q0 4 31 -16" stroke="#000" stroke-opacity=".12" stroke-width="3" fill="none"/>
          <path class="nail__ring" d="${D}" transform="translate(0 -64) scale(1.14) translate(0 64)"/>
        </g>
      </g>`).join('');

    const nails = $$('.nail', svg);
    const swWrap = $('#swatches'), finWrap = $('#finishes');
    swWrap.innerHTML = COLORS.map((c, i) => `<button type="button" class="sw" role="radio" aria-checked="${i === 0}" data-c="${i}" style="--c:${c[1]}"><i></i><span>${c[0]}</span></button>`).join('');
    finWrap.innerHTML = FINISHES.map((f, i) => `<button type="button" class="chip${i === 0 ? ' is-on' : ''}" role="radio" aria-checked="${i === 0}" data-f="${f[0]}">${f[1]}</button>`).join('');

    function paint(i) {
      const el = nails[i], s = state[i], f = s.f;
      $('.nail__body', el).setAttribute('fill', COLORS[s.c][1]);
      const fx = $('.nail__fx', el), gl = $('.nail__gloss', el);
      if (f === 'paillete') { fx.setAttribute('fill', 'url(#glit)'); fx.setAttribute('opacity', '1'); gl.setAttribute('opacity', '.35'); }
      else if (f === 'chrome') { fx.setAttribute('fill', 'url(#chr)'); fx.setAttribute('opacity', '.8'); gl.setAttribute('opacity', '.85'); }
      else if (f === 'mat') { fx.setAttribute('fill', '#fff'); fx.setAttribute('opacity', '.16'); gl.setAttribute('opacity', '0'); }
      else { fx.setAttribute('opacity', '0'); gl.setAttribute('opacity', '.55'); }
      el.classList.toggle('is-sel', sel === i);
    }
    function targets() { return sel === 'all' ? NAILS.map((_, i) => i) : [sel]; }
    function summary() {
      const uniq = [...new Set(state.map(s => COLORS[s.c][0] + ' · ' + FINISHES.find(f => f[0] === s.f)[1]))];
      mix.text = uniq.length === 1 ? uniq[0] : uniq.join(' + ');
      $('#mixText').textContent = mix.text;
      const cur = sel === 'all' ? state[0] : state[sel];
      const sameAll = sel !== 'all' || state.every(s => s.c === state[0].c);
      $$('.sw', swWrap).forEach((b, k) => b.setAttribute('aria-checked', String(sameAll && +b.dataset.c === cur.c)));
      const sameF = sel !== 'all' || state.every(s => s.f === state[0].f);
      $$('.chip[data-f]', finWrap).forEach(b => { const on = sameF && b.dataset.f === cur.f; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', String(on)); });
      $$('.chip[data-target]').forEach(b => b.classList.toggle('is-on', b.dataset.target === 'all' && sel === 'all'));
    }
    function pop(i) {
      if (!hasGSAP || reduce) return;
      gsap.fromTo(nails[i], { scale: .9 }, { scale: 1, duration: .8, ease: 'elastic.out(1,.45)', overwrite: false });
    }
    function refresh(animate) { nails.forEach((_, i) => paint(i)); summary(); if (animate) targets().forEach(pop); }

    swWrap.addEventListener('click', e => {
      const b = e.target.closest('.sw'); if (!b) return;
      targets().forEach(i => { state[i].c = +b.dataset.c; }); mix.touched = true; refresh(true);
    });
    finWrap.addEventListener('click', e => {
      const b = e.target.closest('[data-f]'); if (!b) return;
      targets().forEach(i => { state[i].f = b.dataset.f; }); mix.touched = true; refresh(true);
    });
    $$('.chip[data-target]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.target === 'all') sel = 'all';
      else { state.forEach(s => { s.c = 0; s.f = 'brillant'; }); sel = 'all'; mix.touched = false; }
      refresh(true);
    }));
    nails.forEach((el, i) => {
      const pick = () => { sel = i; refresh(false); pop(i); };
      el.addEventListener('click', pick);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
    $('#mixBook').addEventListener('click', () => {
      window.OFbook({ message: 'Inspiration : ' + mix.text + '.', service: 'Nail art', onlyIfEmpty: true });
    });
    refresh(false);

    if (hasGSAP && !reduce) {
      gsap.to(nails, { y: -7, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: { each: .3, from: 'center' } });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Réservation (sans back-end : SMS / appel / presse-papier / .ics)     */
  /* ------------------------------------------------------------------ */
  function initBooking() {
    const form = $('#bookForm'); if (!form) return;
    const chipsEl = $('#serviceChips'), dateEl = $('#dateStrip'), slotEl = $('#slotGrid');
    const stepDate = $('#stepDate'), stepTime = $('#stepTime'), stepInfo = $('#stepInfo');
    const fName = $('#fName'), fPhone = $('#fPhone'), fMsg = $('#fMsg');
    const recapText = $('#recapText'), recapNote = $('#recapNote');
    const aSms = $('#actSms'), aCall = $('#actCall'), bCopy = $('#actCopy'), bIcs = $('#actIcs');
    const st = { date: null, time: null };

    const names = $$('.card[data-service]').map(c => c.dataset.service).concat('Je ne sais pas encore');
    chipsEl.innerHTML = names.map(n => `<label><input type="checkbox" name="svc" value="${esc(n)}"><span>${esc(n)}</span></label>`).join('');

    // Jours : mardi → samedi, sur les prochaines semaines
    const now = new Date(), days = [];
    for (let i = 0; i <= SALON.daysAhead; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      if (!SALON.openDays.includes(d.getDay())) continue;
      if (i === 0 && now.getHours() * 60 + now.getMinutes() > SALON.lastSlot - 90) continue;
      days.push(d);
    }
    const dow = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });
    const mon = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
    const longDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const monthYear = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
    const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    dateEl.innerHTML = days.map(d => `<label><input type="radio" name="day" value="${iso(d)}"><span><b class="dow">${dow.format(d).replace('.', '')}</b><b class="num">${d.getDate()}</b><b class="mon">${mon.format(d).replace('.', '')}</b></span></label>`).join('');
    $('#monthLabel').textContent = days.length ? monthYear.format(days[0]) : '';

    const hm = m => `${Math.floor(m / 60)}h${pad(m % 60)}`;
    function renderSlots() {
      const isToday = st.date && iso(st.date) === iso(now);
      const nowMin = now.getHours() * 60 + now.getMinutes() + 90;
      let html = '', last = '';
      for (let m = SALON.firstSlot; m <= SALON.lastSlot; m += SALON.slotStep) {
        const g = m < 12 * 60 ? 'Matin' : 'Après-midi';
        if (g !== last) { html += `<span class="grp">${g}</span>`; last = g; }
        const off = isToday && m < nowMin;
        html += `<label class="${off ? 'is-off' : ''}"><input type="radio" name="slot" value="${m}" ${off ? 'disabled' : ''}><span>${hm(m)}</span></label>`;
      }
      slotEl.innerHTML = html; st.time = null;
    }
    renderSlots();

    const selected = () => $$('input[name="svc"]:checked', chipsEl).map(i => i.value);
    const phoneOk = () => fPhone.value.replace(/\D/g, '').length >= 10;
    const timeLabel = () => st.time === null ? '' : hm(st.time);
    const dateLabel = () => st.date ? longDate.format(st.date) : '';

    function message() {
      const msg = fMsg.value.trim();
      return `Bonjour, je souhaite prendre rendez-vous chez ${SALON.name} pour : ${selected().join(', ')}. ` +
        `Créneau souhaité : ${dateLabel()} à ${timeLabel()}. ` + (msg ? `Précisions : ${msg} ` : '') +
        `Je m’appelle ${fName.value.trim()}, mon numéro : ${fPhone.value.trim()}. Merci de me confirmer le créneau !`;
    }

    function update() {
      const svc = selected(), name = fName.value.trim();
      stepDate.disabled = !svc.length;
      stepTime.disabled = !(svc.length && st.date);
      stepInfo.disabled = !(svc.length && st.date && st.time !== null);
      const done = svc.length && st.date && st.time !== null && name && phoneOk();

      if (!svc.length) recapText.textContent = 'Choisissez une prestation pour commencer.';
      else {
        const parts = [svc.join(' + ')];
        if (st.date) parts.push(dateLabel() + (st.time !== null ? ' à ' + timeLabel() : ''));
        if (name) parts.push(name + (phoneOk() ? ' · ' + fPhone.value.trim() : ''));
        recapText.textContent = parts.join(' — ');
      }
      [bCopy, bIcs].forEach(b => { b.disabled = !done; });
      if (SALON.smsNumber) {
        aSms.hidden = false;
        aSms.classList.toggle('is-disabled', !done); aSms.setAttribute('aria-disabled', String(!done));
        const sep = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? '&' : '?';
        aSms.href = done ? `sms:${SALON.smsNumber}${sep}body=${encodeURIComponent(message())}` : '#';
        recapNote.textContent = 'Envoyez le SMS pré-rempli : le salon vous confirme le créneau en retour. Ce n’est pas une réservation ferme tant que le salon n’a pas répondu.';
      } else {
        recapNote.textContent = done
          ? 'Votre demande est prête. Copiez-la et envoyez-la au salon, ou appelez pour confirmer le créneau. Ce n’est pas une réservation ferme tant que le salon n’a pas répondu.'
          : 'Votre demande n’est pas une réservation ferme : elle est confirmée par le salon.';
      }
    }

    chipsEl.addEventListener('change', update);
    dateEl.addEventListener('change', e => {
      const [y, m, d] = e.target.value.split('-').map(Number);
      st.date = new Date(y, m - 1, d); $('#monthLabel').textContent = monthYear.format(st.date);
      renderSlots(); update();
    });
    slotEl.addEventListener('change', e => { st.time = +e.target.value; update(); });
    [fName, fPhone, fMsg].forEach(i => i.addEventListener('input', () => { i.classList.remove('is-bad'); update(); }));
    fPhone.addEventListener('blur', () => { if (fPhone.value && !phoneOk()) fPhone.classList.add('is-bad'); });
    form.addEventListener('submit', e => e.preventDefault());

    aCall.classList.remove('is-disabled'); aCall.removeAttribute('aria-disabled');
    aSms.addEventListener('click', e => { if (aSms.classList.contains('is-disabled')) e.preventDefault(); });

    bCopy.addEventListener('click', async () => {
      const text = message(), lab = $('span', bCopy);
      try { await navigator.clipboard.writeText(text); }
      catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (_) {} t.remove(); }
      lab.textContent = 'Copié ✓'; setTimeout(() => { lab.textContent = 'Copier ma demande'; }, 2200);
    });

    bIcs.addEventListener('click', () => {
      const h = Math.floor(st.time / 60), m = st.time % 60;
      const s = new Date(st.date.getFullYear(), st.date.getMonth(), st.date.getDate(), h, m);
      const e = new Date(s.getTime() + 60 * 60000);
      const f = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
      const t = x => x.replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
      const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ongles Fantaisies 2//Demande de RDV//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
        `UID:${Date.now()}@ongles-fantaisies-2`, `DTSTAMP:${stamp}`, `DTSTART:${f(s)}`, `DTEND:${f(e)}`,
        `SUMMARY:${t('RDV à confirmer — ' + SALON.name)}`, `LOCATION:${t(SALON.address)}`,
        `DESCRIPTION:${t(selected().join(', ') + ' — demande à confirmer par le salon : ' + SALON.phoneLabel)}`, 'END:VEVENT', 'END:VCALENDAR'];
      const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rdv-ongles-fantaisies-2.ics';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });

    // API : préremplir depuis une carte de prestation ou le composeur
    window.OFbook = ({ service, message: note, onlyIfEmpty } = {}) => {
      const boxes = $$('input[name="svc"]', chipsEl);
      if (service) {
        const hit = boxes.find(b => b.value === service);
        if (hit && !(onlyIfEmpty && selected().length)) hit.checked = true;
      }
      if (note) fMsg.value = note;
      update();
      scrollToTarget($('#reserver'), 0);
    };
    update();
  }

  /* ------------------------------------------------------------------ */
  /* Menu mobile + liens d'ancre                                          */
  /* ------------------------------------------------------------------ */
  function initNavUI() {
    const burger = $('#burger'), menu = $('#menu');
    const setMenu = open => {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      menu.classList.toggle('is-open', open); menu.setAttribute('aria-hidden', String(!open));
      document.documentElement.classList.toggle('menu-open', open);
      if (open) { const nav = $('#nav'); nav.dataset.hidden = ''; if (hasGSAP) gsap.to(nav, { yPercent: 0, duration: .3, overwrite: true }); }
      if (lenis) open ? lenis.stop() : lenis.start();
    };
    burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]'); if (!a) return;
      const id = a.getAttribute('href'); if (id.length < 2) return;
      const target = id === '#top' ? document.body : $(id); if (!target) return;
      e.preventDefault();
      const wasOpen = menu.classList.contains('is-open'); if (wasOpen) setMenu(false);
      setTimeout(() => (id === '#top' ? (lenis ? lenis.scrollTo(0, { duration: 1.6 }) : window.scrollTo({ top: 0, behavior: 'smooth' })) : scrollToTarget(target, 0)), wasOpen ? 450 : 0);
    });
    $$('[data-book]').forEach(b => b.addEventListener('click', () => window.OFbook({ service: b.dataset.book })));
  }

  /* ------------------------------------------------------------------ */
  /* Vidéo du hero                                                       */
  /* ------------------------------------------------------------------ */
  function setupVideo() {
    const v = $('.hero__video'); if (!v) return Promise.resolve();
    const conn = navigator.connection || {};
    const heavyOk = matchMedia('(min-width: 900px)').matches && !conn.saveData && !/(^|-)2g$/.test(conn.effectiveType || '');
    if (reduce) { v.removeAttribute('autoplay'); return Promise.resolve(); }
    v.src = heavyOk ? 'assets/video/hero-uhd.mp4' : 'assets/video/hero-sd.mp4';
    const p = v.play(); if (p && p.catch) p.catch(() => {});
    return new Promise(res => {
      if (v.readyState >= 2) return res();
      v.addEventListener('loadeddata', res, { once: true });
      v.addEventListener('error', res, { once: true });
      setTimeout(res, 4500);
    });
  }

  /* ================================================================== */
  /* MOUVEMENT                                                           */
  /* ================================================================== */
  function initMotion(videoReady) {
    gsap.registerPlugin(ScrollTrigger);
    const root = document.documentElement;
    root.classList.add('has-motion');

    // --- Défilement fluide ---
    if (typeof Lenis !== 'undefined') {
      lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      lenis.stop();
    }
    root.classList.add('is-loading');

    // --- États initiaux (le préchargeur masque la page) ---
    $$('.card img, .story__img').forEach(i => { i.loading = 'eager'; });
    const heroChars = $$('.hero__line').flatMap(l => splitText(l, 'chars'));
    const titles = $$('[data-split="words"]').map(h => ({ h, c: splitText(h, 'words') }));
    const giant = $('[data-foot-giant]');
    const giantChars = giant ? splitText(giant, 'chars') : [];
    gsap.set(heroChars, { yPercent: 118 });
    titles.forEach(t => gsap.set(t.c, { yPercent: 118 }));
    gsap.set(giantChars, { yPercent: 118 });
    gsap.set(['.hero__eyebrow', '.hero__lead', '.hero__actions .btn'], { opacity: 0, y: 28 });
    gsap.set('.hero__arch', { clipPath: 'circle(0% at 50% 100%)' });
    gsap.set('.hero__badge', { scale: 0, rotation: -140 });
    gsap.set('.nav', { yPercent: -100 });
    gsap.set('.loader__liquid', { scaleY: 0, transformOrigin: '50% 100%' });

    heroSparks();

    // --- Préchargeur ---
    const fonts = (document.fonts && document.fonts.ready) || Promise.resolve();
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const prog = { v: 0 };
    const num = $('#loadNum');
    const render = () => { num.textContent = Math.round(prog.v * 100); gsap.set('.loader__liquid', { scaleY: prog.v }); };
    const crawl = gsap.to(prog, { v: .88, duration: 2.2, ease: 'power2.out', onUpdate: render });
    Promise.all([Promise.race([Promise.all([fonts, videoReady]), wait(5500)]), wait(1900)]).then(() => {
      crawl.kill();
      gsap.to(prog, { v: 1, duration: .6, ease: 'power2.inOut', onUpdate: render, onComplete: exitLoader });
    });

    buildScrollAnimations();

    function exitLoader() {
      const panels = $$('.loader__panel');
      const tl = gsap.timeline();
      tl.to('.loader__center', { opacity: 0, y: -30, duration: .5, ease: 'power3.in' })
        .set('.loader', { backgroundColor: 'transparent' })
        .to($$('.loader__panel i'), { opacity: 1, duration: .45, stagger: .06, ease: 'power2.out' }, '<')
        .to(panels, { yPercent: -102, duration: 1.25, stagger: .09, ease: 'expo.inOut' }, '>-.05')
        .add(heroIntro, '>-0.9')
        .set('.loader', { display: 'none' })
        .add(() => {
          root.classList.remove('is-loading');
          if (lenis) lenis.start();
          ScrollTrigger.refresh();
        });
    }

    function heroIntro() {
      const t = gsap.timeline({ defaults: { ease: 'expo.out' } });
      t.fromTo('.hero__video', { scale: 1.22 }, { scale: 1.04, duration: 2.6 }, 0)
        .to('.hero__eyebrow', { opacity: 1, y: 0, duration: 1.1 }, .15)
        .to(heroChars, { yPercent: 0, duration: 1.5, stagger: .045 }, .1)
        .to('.hero__lead', { opacity: 1, y: 0, duration: 1.2 }, .65)
        .to('.hero__actions .btn', { opacity: 1, y: 0, duration: 1.1, stagger: .1 }, .8)
        .to('.hero__arch', { clipPath: 'circle(150% at 50% 100%)', duration: 1.7, stagger: .15, ease: 'power3.inOut' }, .5)
        .to('.hero__badge', { scale: 1, rotation: 0, duration: 1.6, ease: 'elastic.out(1,.55)' }, .9)
        .to('.nav', { yPercent: 0, duration: 1 }, .6);
    }

    /* Étincelles dorées (plan intermédiaire du parallax) */
    function heroSparks() {
      const box = $('[data-hero-sparks]'); if (!box) return;
      const n = matchMedia('(max-width: 899px)').matches ? 8 : 18;
      const r = mulberry(7);
      for (let i = 0; i < n; i++) {
        const s = document.createElement('span');
        const size = 8 + r() * 22;
        s.style.cssText = `--s:${size}px;left:${r() * 96}%;top:${8 + r() * 80}%`;
        s.innerHTML = '<svg viewBox="0 0 24 24"><use href="#i-spark"/></svg>';
        box.appendChild(s);
        gsap.fromTo(s, { opacity: 0, scale: 0 }, { opacity: .3 + r() * .7, scale: 1, duration: 1.2, delay: 2.4 + r() * 1.6, ease: 'back.out(2)' });
        gsap.to(s, { y: (r() - .5) * 50, rotation: 90 + r() * 180, duration: 3 + r() * 3, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: r() * 2 });
      }
    }

    function buildScrollAnimations() {
      // Barre de progression de lecture
      gsap.to('.progress span', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .2 } });

      // Navigation : se cache en descendant, revient en remontant
      const nav = $('#nav');
      ScrollTrigger.create({
        start: 0, end: 'max',
        onUpdate: self => {
          const y = self.scroll(), hidden = nav.dataset.hidden === '1';
          nav.classList.toggle('nav--solid', y > 80);
          if (root.classList.contains('menu-open') || root.classList.contains('is-loading')) return;
          if (self.direction === 1 && y > 260 && !hidden) { nav.dataset.hidden = '1'; gsap.to(nav, { yPercent: -100, duration: .55, ease: 'power3.out', overwrite: true }); }
          else if ((self.direction === -1 || y <= 260) && hidden) { nav.dataset.hidden = ''; gsap.to(nav, { yPercent: 0, duration: .55, ease: 'power3.out', overwrite: true }); }
        }
      });

      // Parallax multicouche du hero
      const heroST = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
      gsap.to('[data-hero-media]', { yPercent: 14, ease: 'none', scrollTrigger: heroST });
      gsap.to('.hero__video', { scale: 1.18, ease: 'none', scrollTrigger: heroST });
      gsap.to('[data-hero-sparks]', { yPercent: -28, ease: 'none', scrollTrigger: heroST });
      gsap.to('.hero__content', { yPercent: -9, opacity: .15, ease: 'none', scrollTrigger: { ...heroST, end: 'bottom 30%' } });
      gsap.to('[data-hero-float="1"]', { yPercent: -24, ease: 'none', scrollTrigger: heroST });
      gsap.to('[data-hero-float="2"]', { yPercent: -42, ease: 'none', scrollTrigger: heroST });

      // Titres de section : mots qui montent
      titles.forEach(({ h, c }) => ScrollTrigger.create({
        trigger: h, start: 'top 86%', once: true,
        onEnter: () => gsap.to(c, { yPercent: 0, duration: 1.2, stagger: .07, ease: 'expo.out' })
      }));

      // Apparitions douces
      const sel = ['.eyebrow', '.lede', '.stat', '.stats__note', '.rcard', '.rev__ctrl', '.bform', '.book__facts', '.book__call', '.mix__stage', '.mix__panel > *:not(h2)', '.find__info > *:not(h2)', '.find__map', '.gallery__note', '.cta__sub', '.reviews__score', '.foot__top > div']
        .flatMap(s => $$(s)).filter(el => !el.closest('[data-track]') && !el.closest('.story__pin') && !el.closest('.hero'));
      gsap.set(sel, { opacity: 0, y: 36 });
      ScrollTrigger.batch(sel, {
        start: 'top 90%', once: true,
        onEnter: b => gsap.to(b, { opacity: 1, y: 0, duration: 1.1, stagger: .08, ease: 'power3.out', overwrite: true })
      });

      // Gouttes : elles coulent à l'entrée de la section
      $$('svg.drip').forEach(d => {
        gsap.set(d, { scaleY: 0 });
        ScrollTrigger.create({ trigger: d.parentElement, start: 'top 92%', once: true, onEnter: () => gsap.to(d, { scaleY: 1, duration: 1.6, ease: 'elastic.out(1,.55)' }) });
      });

      // Chiffres animés
      $$('[data-count]').forEach(el => {
        const end = parseFloat(el.dataset.count), dec = +el.dataset.dec || 0, o = { v: 0 };
        ScrollTrigger.create({
          trigger: el, start: 'top 88%', once: true,
          onEnter: () => gsap.to(o, { v: end, duration: 2.2, ease: 'power3.out', onUpdate: () => { el.textContent = o.v.toFixed(dec).replace('.', ','); } })
        });
      });

      // Étoiles des avis
      gsap.set('.rcard .stars svg, .reviews__score .stars svg', { scale: 0, rotation: -70 });
      ScrollTrigger.create({ trigger: '#avis', start: 'top 65%', once: true, onEnter: () => gsap.to('.rcard .stars svg, .reviews__score .stars svg', { scale: 1, rotation: 0, duration: .7, stagger: .035, ease: 'back.out(2.4)' }) });

      // Galerie : rideau + zoom + parallax interne
      $$('.g').forEach(g => {
        const veil = $('.g__veil', g), img = $('img', g);
        gsap.set(img, { scale: 1.25 });
        ScrollTrigger.create({
          trigger: g, start: 'top 90%', once: true,
          onEnter: () => { gsap.to(veil, { scaleY: 0, duration: 1.3, ease: 'expo.inOut' }); gsap.to(img, { scale: 1, duration: 2, ease: 'expo.out' }); }
        });
        gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: g, start: 'top bottom', end: 'bottom top', scrub: true } });
      });

      // Pied de page : le grand nom
      if (giantChars.length) ScrollTrigger.create({ trigger: giant, start: 'top 95%', once: true, onEnter: () => gsap.to(giantChars, { yPercent: 0, duration: 1.5, stagger: .04, ease: 'expo.out' }) });

      marquees();

      const mm = gsap.matchMedia();
      mm.add('(min-width: 900px)', () => { storyPin(); servicesHorizontal(); });
      mm.add('(max-width: 899px)', () => {
        $$('.step__fig').forEach(f => {
          gsap.set(f, { clipPath: 'inset(100% 0% 0% 0%)' });
          ScrollTrigger.create({ trigger: f, start: 'top 88%', once: true, onEnter: () => gsap.to(f, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut' }) });
        });
        $$('.card__img img').forEach(i => gsap.set(i, { clearProps: 'all' }));
      });

      window.addEventListener('load', () => ScrollTrigger.refresh());
    }

    /* Bandeaux défilants : vitesse et sens réagissent au scroll */
    function marquees() {
      $$('[data-marquee] .marquee__row').forEach(row => {
        const track = $('.marquee__track', row), dir = +row.dataset.dir || -1;
        track.innerHTML += track.innerHTML;
        const speed = 90; let w = 0, pos = 0, active = false;
        const state = { v: 1 };
        const measure = () => { w = track.scrollWidth / 2; };
        measure(); fonts.then(measure); window.addEventListener('resize', measure);
        const wrap = x => ((x % w) + w) % w;
        gsap.ticker.add((_, dt) => {
          if (!active || !w) return;
          pos += dir * state.v * speed * dt / 1000;
          gsap.set(track, { x: dir < 0 ? -wrap(-pos) : -w + wrap(pos) });
        });
        ScrollTrigger.create({
          trigger: row, start: 'top bottom', end: 'bottom top',
          onToggle: s => { active = s.isActive; },
          onUpdate: s => {
            const boost = 1 + Math.min(Math.abs(s.getVelocity()) / 220, 7);
            gsap.killTweensOf(state);
            gsap.timeline().to(state, { v: -s.direction * boost * -1, duration: .25, ease: 'power2.out' }).to(state, { v: s.direction || 1, duration: 1.4, ease: 'power2.out' });
          }
        });
      });
    }

    /* Savoir-faire : section pinnée, 4 étapes pilotées par le scroll */
    function storyPin() {
      const steps = $$('.story .step'), imgs = $$('.story__img'), stage = $('.story__big');
      if (!steps.length || !imgs.length || !stage) return;
      stage.innerHTML = steps.map((_, i) => `<span>${pad(i + 1)}</span>`).join('');
      const nums = $$('span', stage);
      gsap.set(steps, { autoAlpha: 0, y: 36 }); gsap.set(steps[0], { autoAlpha: 1, y: 0 });
      gsap.set(imgs.slice(1), { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.2 });
      gsap.set(nums.slice(1), { yPercent: 100 });
      const tl = gsap.timeline({ defaults: { ease: 'power3.inOut' }, scrollTrigger: { trigger: '.story__pin', start: 'top top', end: '+=330%', pin: true, scrub: .7, anticipatePin: 1, refreshPriority: 2 } });
      for (let i = 1; i < steps.length; i++) {
        const at = i * 1.2;
        tl.to(steps[i - 1], { autoAlpha: 0, y: -36, duration: .5 }, at - .1)
          .to(steps[i], { autoAlpha: 1, y: 0, duration: .6 }, at + .15)
          .to(imgs[i], { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: .9 }, at - .1)
          .to(imgs[i - 1], { scale: 1.12, duration: .9 }, at - .1)
          .to(nums[i - 1], { yPercent: -100, duration: .5 }, at - .1)
          .to(nums[i], { yPercent: 0, duration: .6 }, at + .1);
      }
      tl.to({}, { duration: .5 });
      tl.fromTo('.story__bar span', { scaleX: 0 }, { scaleX: 1, ease: 'none', duration: tl.duration() }, 0);
    }

    /* Prestations : défilement horizontal piloté par le scroll vertical */
    function servicesHorizontal() {
      const track = $('[data-track]'); if (!track) return;
      const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
      const move = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: '.svc__pin', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: .6, invalidateOnRefresh: true, anticipatePin: 1, refreshPriority: 1 }
      });
      $$('.card__img img').forEach(img => gsap.fromTo(img, { xPercent: -7 }, {
        xPercent: 7, ease: 'none',
        scrollTrigger: { trigger: img.closest('.card'), containerAnimation: move, start: 'left right', end: 'right left', scrub: true }
      }));
    }

    /* Finesses pour les appareils à pointeur précis */
    if (fine) pointerFX();
  }

  /* ------------------------------------------------------------------ */
  /* Curseur, boutons magnétiques, inclinaison 3D                         */
  /* ------------------------------------------------------------------ */
  function pointerFX() {
    // Curseur
    const cur = $('.cursor');
    if (cur) {
      const qx = gsap.quickTo(cur, 'x', { duration: .45, ease: 'power3' }), qy = gsap.quickTo(cur, 'y', { duration: .45, ease: 'power3' });
      window.addEventListener('pointermove', e => { qx(e.clientX); qy(e.clientY); cur.classList.add('is-on'); }, { passive: true });
      document.addEventListener('pointerleave', () => cur.classList.remove('is-on'));
      document.addEventListener('pointerover', e => cur.classList.toggle('is-hover', !!e.target.closest('a, button, [data-tilt], .nail, label')));
    }

    // Boutons magnétiques
    $$('[data-magnetic]').forEach(el => {
      const inner = $('span', el), strong = el.hasAttribute('data-big') ? .18 : .32;
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        gsap.to(el, { x: dx * strong, y: dy * strong, duration: .5, ease: 'power3.out', overwrite: 'auto' });
        if (inner) gsap.to(inner, { x: dx * strong * .5, y: dy * strong * .5, duration: .5, ease: 'power3.out', overwrite: 'auto' });
      });
      el.addEventListener('pointerleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1,.4)', overwrite: 'auto' });
        if (inner) gsap.to(inner, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1,.4)', overwrite: 'auto' });
      });
    });

    // Inclinaison 3D + reflet qui suit la souris
    $$('[data-tilt]').forEach(el => {
      const max = el.hasAttribute('data-tilt-soft') ? 4 : 9;
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        gsap.to(el, { rotationY: (px - .5) * max * 2, rotationX: -(py - .5) * max * 2, transformPerspective: 900, duration: .5, ease: 'power3.out', overwrite: 'auto' });
        el.style.setProperty('--mx', (px * 100).toFixed(1) + '%'); el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      });
      el.addEventListener('pointerleave', () => gsap.to(el, { rotationX: 0, rotationY: 0, duration: .9, ease: 'elastic.out(1,.5)', overwrite: 'auto' }));
    });

    // Parallax souris sur le hero
    const hero = $('.hero');
    const floats = $$('[data-hero-float]');
    if (hero && floats.length) {
      const setters = floats.map((f, i) => ({ x: gsap.quickTo(f, 'x', { duration: 1.2, ease: 'power3' }), y: gsap.quickTo(f, 'y', { duration: 1.2, ease: 'power3' }), k: i ? -46 : 30 }));
      hero.addEventListener('pointermove', e => {
        const nx = e.clientX / innerWidth - .5, ny = e.clientY / innerHeight - .5;
        setters.forEach(s => { s.x(nx * s.k); s.y(ny * s.k); });
      });
    }

    // Grand nom du pied de page : vague au survol
    const giant = $('[data-foot-giant]');
    if (giant) {
      const chars = $$('.c', giant);
      giant.addEventListener('pointermove', e => {
        chars.forEach(c => { const r = c.getBoundingClientRect(), d = Math.abs(e.clientX - (r.left + r.width / 2)); gsap.to(c, { yPercent: -16 * Math.max(0, 1 - d / 260), duration: .5, ease: 'power3.out', overwrite: 'auto' }); });
      });
      giant.addEventListener('pointerleave', () => gsap.to(chars, { yPercent: 0, duration: .8, ease: 'elastic.out(1,.5)', overwrite: 'auto' }));
    }
  }

  /* ------------------------------------------------------------------ */
  /* Démarrage                                                           */
  /* ------------------------------------------------------------------ */
  safe('drips', initDrips);
  safe('hours', initHours);
  safe('composer', initComposer);
  safe('booking', initBooking);
  safe('reviews', initReviews);

  const motion = hasGSAP && !reduce;
  const videoReady = setupVideo();
  if (motion) safe('motion', () => initMotion(videoReady));
  else {
    // Version allégée : tout est visible, compteurs à leur valeur finale
    $$('[data-count]').forEach(el => { el.textContent = (+el.dataset.count).toFixed(+el.dataset.dec || 0).replace('.', ','); });
    const loader = $('.loader'); if (loader) loader.style.display = 'none';
    $$('.marquee__track').forEach(t => { t.innerHTML += t.innerHTML; });
  }
  safe('nav', initNavUI);
})();
