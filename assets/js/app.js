/* Elevara — Sky Residences. Scroll film engine + interactions. No build step.
   Content lives in PHASES, ROOMS and RESIDENCES below. */
(() => {
'use strict';

/* ================= CONTENT ================= */
const PHASES = [
  { q:'Q1 2023', t:'Ground broken', d:'A 1.2-acre sea-facing plot is surveyed and excavated fourteen metres into Worli basalt.' },
  { q:'Q4 2023', t:'The foundation', d:'A 3.2-metre raft is cast in one continuous 72-hour pour. The core begins to climb.' },
  { q:'Q3 2024', t:'The frame', d:'A new floor every six days. The jump-form core leads, the slabs follow, the crane climbs with them.' },
  { q:'Q2 2025', t:'The facade', d:'3,840 unitised glass panels and hand-finished bronze fins close the skin from the ground up.' },
  { q:'Q1 2026', t:'Complete', d:'The crane comes down, the sky pool is filled and a landscaped acre replaces the site.' },
  { q:'Q4 2026', t:'First light', d:'One hundred and seven homes switch on for the first time above the Arabian Sea.' }
];
const PHASE_AT = [0, .1, .3, .5, .7, .86];                       // rise progress where each phase starts
const LEVEL_KEYS = [[0,0],[.08,0],[.2,3],[.4,30],[.6,62],[1,62]]; // rise progress → level under construction
const M_PER_LEVEL = 212.4 / 62;

const ROOMS = [
  { at:0,   n:'00', t:'Approach',        d:'Level 52 · 178 m above the sea', plan:[] },
  { at:.3,  n:'01', t:'The Living Room', d:'28′ × 22′ · 11′ ceilings · 270° of glass', plan:['LIVING'] },
  { at:.55, n:'02', t:'Dine & Gather',   d:'Twelve-seat dining · chef’s kitchen · wine wall', plan:['DINING','KITCHEN'] },
  { at:.8,  n:'03', t:'Master Suite',    d:'24′ × 18′ · corner glazing · dressing room', plan:['MASTER'] }
];

const RATE = L => 55000 + (L - 12) * 900;            // indicative ₹ per sq ft by level
const RESIDENCES = [
  { name:'Sky Residence',    type:'3 BHK', levels:[12,27], area:2650,  perFloor:4, bath:4, plan:'sky' },
  { name:'Corner Residence', type:'4 BHK', levels:[28,39], area:3480,  perFloor:2, bath:5, plan:'corner' },
  { name:'Sea Residence',    type:'4 BHK', levels:[41,57], area:4850,  perFloor:1, bath:5, plan:'sea' },
  { name:'Sky Duplex',       type:'5 BHK', levels:[58,59], area:7200,  perFloor:1, bath:6, plan:'duplex' },
  { name:'The Penthouse',    type:'6 BHK', levels:[60,61], area:11400, perFloor:1, bath:7, plan:'ph', por:true }
];

/* ================= HELPERS ================= */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const clamp = (v, a=0, b=1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const range = (p, a, b) => clamp((p - a) / (b - a));
const ease = t => 1 - Math.pow(1 - t, 3);
const inr = n => Math.round(n).toLocaleString('en-IN');
const cr = rupees => (rupees / 1e7).toFixed(1);
const isMobile = () => innerWidth < 860;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGSAP = typeof window.gsap !== 'undefined' && !!window.ScrollTrigger;
if (hasGSAP) gsap.registerPlugin(ScrollTrigger);
const conn = navigator.connection || {};
const saveData = !!conn.saveData || /2g/.test(conn.effectiveType || '');
const piece = (keys, p) => { for (let i = 1; i < keys.length; i++) if (p <= keys[i][0]) return lerp(keys[i-1][1], keys[i][1], range(p, keys[i-1][0], keys[i][0])); return keys[keys.length-1][1]; };

/* ================= SMOOTH SCROLL ================= */
let lenis = null;
if (!reduce && window.Lenis) {
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
  if (hasGSAP) { lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); }
  else { const r = t => { lenis.raf(t); requestAnimationFrame(r); }; requestAnimationFrame(r); }
}
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const id = a.getAttribute('href'); if (id.length < 2) return; const el = $(id); if (!el) return;
  e.preventDefault(); toggleMenu(false);
  lenis ? lenis.scrollTo(el, { duration: 2 }) : el.scrollIntoView({ behavior: 'smooth' });
}));

/* ================= IMAGE-SEQUENCE FILM =================
   WebP stills drawn on a <canvas>; no video decoding, so scrubbing is smooth both
   ways. Coarse-to-fine loading (every 16th frame, then 8th, 4th, 2nd, 1st) makes
   the film scrubbable almost at once. Off-screen films wait until ~1.5 screens away.
   Frames around the playhead are pre-decoded so drawImage never blocks. */
class SeqFilm {
  constructor(sec, hooks = {}) {
    this.sec = sec; this.hooks = hooks;
    this.cv = $('canvas[data-seq]', sec); this.ctx = this.cv.getContext('2d', { alpha: false });
    this.count = +this.cv.dataset.count;
    this.mobile = isMobile();
    this.base = this.cv.dataset.seq + (this.mobile ? 'm/' : 'd/');
    this.vh = +sec.dataset.vh || 300;
    sec.style.height = `calc(${this.vh}vh + 100vh)`;
    this.imgs = new Array(this.count); this.ok = new Uint8Array(this.count); this.dec = new Uint8Array(this.count);
    this.cur = 0; this.drawn = -1; this.p = 0; this.loaded = 0; this.started = false; this.rect = null;
    const order = [], seen = new Set();
    [16, 8, 4, 2, 1].forEach(s => { for (let i = 0; i < this.count; i += s) if (!seen.has(i)) { seen.add(i); order.push(i); } });
    if (!seen.has(this.count - 1)) order.splice(1, 0, this.count - 1);
    if (saveData) order.length = Math.ceil(this.count / 2);
    this.order = order; this.q = 0;
    this.firstPass = Math.ceil(this.count / 16) + 1;
    this.ready = new Promise(r => this._res = r);
    this.resize(); addEventListener('resize', () => { this.resize(); this.drawn = -1; });
    if (this.cv.hasAttribute('data-eager')) this.start();
    else new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { this.start(); o.disconnect(); } }), { rootMargin: '150% 0px' }).observe(sec);
  }
  start() { if (this.started) return; this.started = true; for (let k = 0; k < 6; k++) this.next(); }
  next() {
    if (this.q >= this.order.length) return;
    const i = this.order[this.q++], im = new Image(); im.decoding = 'async';
    im.onload = () => { this.ok[i] = 1; this.loaded++; if (this.loaded >= this.firstPass) this._res();
      if (Math.abs(i - this.cur) < 20) this.drawn = -1; this.next(); };
    im.onerror = () => { this.loaded++; if (this.loaded >= this.firstPass) this._res(); this.next(); };
    im.src = this.base + String(i + 1).padStart(3, '0') + '.webp'; this.imgs[i] = im;
  }
  resize() { const d = Math.min(devicePixelRatio || 1, 1.5); this.cv.width = Math.round(this.cv.clientWidth * d); this.cv.height = Math.round(this.cv.clientHeight * d); }
  nearest(f) { for (let o = 0; o < this.count; o++) { if (f - o >= 0 && this.ok[f - o]) return f - o; if (f + o < this.count && this.ok[f + o]) return f + o; } return -1; }
  prefetch(f) {
    for (let o = -4; o <= 8; o++) { const i = f + o; if (i < 0 || i >= this.count || !this.ok[i] || this.dec[i]) continue;
      this.dec[i] = 1; this.imgs[i].decode && this.imgs[i].decode().catch(() => {}); }
  }
  draw(f) {
    const i = this.nearest(f); if (i < 0 || i === this.drawn) return; const im = this.imgs[i];
    const cw = this.cv.width, ch = this.cv.height;
    const s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight);
    const w = im.naturalWidth * s, h = im.naturalHeight * s, x = (cw - w) / 2, y = (ch - h) / 2;
    this.ctx.drawImage(im, x, y, w, h); this.drawn = i; this.rect = { x, y, w, h };
  }
  tick() {
    const r = this.sec.getBoundingClientRect(); const total = this.sec.offsetHeight - innerHeight;
    if (!(r.bottom > -100 && r.top < innerHeight + 100)) return false;
    this.p = clamp(-r.top / total);
    const target = this.p * (this.count - 1);
    this.cur = Math.abs(target - this.cur) < 0.05 ? target : lerp(this.cur, target, 0.15);
    const f = Math.round(this.cur); this.prefetch(f); this.draw(f);
    this.hooks.onProgress && this.hooks.onProgress(this.cur / (this.count - 1));
    return true;
  }
}
const films = [];

/* ================= 1. THE RISE ================= */
const hdrAlt = $('#hdrAlt');
const riseIntro = $('#riseIntro'), hint = $('#hint'), lvlEl = $('#lvl'), phaseEl = $('#phase');
const phaseQ = $('#phaseQ'), phaseT = $('#phaseT'), phaseD = $('#phaseD');
const ledger = $('.ledger'), lgC = $('#lgC'), lgS = $('#lgS'), lgG = $('#lgG');
const tl = $('#timeline'), tlItems = $$('li', tl), riseEnd = $('#riseEnd');
const altiMark = $('#altiMark'), altiVal = $('#altiVal'), altiScale = $('#altiScale');
for (let m = 0; m <= 220; m += 10) { const i = document.createElement('i'); i.style.bottom = (m / 220 * 100) + '%';
  if (m % 50 === 0) { i.className = 'maj'; i.innerHTML = `<b>${m}</b>`; } altiScale.appendChild(i); }

let phaseIdx = -1, curAlt = 0;
function setPhase(i) {
  if (i === phaseIdx) return; phaseIdx = i; const ph = PHASES[i];
  phaseQ.textContent = ph.q; phaseT.textContent = ph.t; phaseD.textContent = ph.d;
  phaseEl.classList.remove('swap'); void phaseEl.offsetWidth; phaseEl.classList.add('swap');
  tlItems.forEach((li, k) => li.classList.toggle('on', k <= i));
}

/* Blueprint overlay: the tower is drawn as a technical elevation over the empty
   plot; a brass "current level" line tracks the build; the drawing fades as the
   real tower takes over. TOWER bounds are fractions of the 16:9 film frame. */
const bp = $('#bp'), bctx = bp.getContext('2d');
const TOWER = { l:.432, r:.556, top:.035, base:.885 };
let bpIntro = 0, bpLast = '';
function bpResize() { const d = Math.min(devicePixelRatio || 1, 1.5); bp.width = bp.clientWidth * d; bp.height = bp.clientHeight * d; bpLast = ''; }
bpResize(); addEventListener('resize', bpResize);
function drawBlueprint(p, film) {
  const R = film.rect; if (!R) return;
  const fade = 1 - range(p, .3, .48);
  const lvlLine = range(p, .08, .12) * (1 - range(p, .58, .64));
  const key = [p.toFixed(4), bpIntro.toFixed(3), R.w, R.h, bp.width].join();
  if (key === bpLast) return; bpLast = key;
  bctx.clearRect(0, 0, bp.width, bp.height);
  if (fade <= 0 && lvlLine <= 0) return;
  // film rect is in canvas pixels of the film canvas; bp canvas has the same size
  const crop = film.mobile ? .3375 : 1, off = (1 - crop) / 2;   // mobile frames are a centre crop
  const X = fx => R.x + ((fx - off) / crop) * R.w, Y = fy => R.y + fy * R.h;
  const d = Math.min(devicePixelRatio || 1, 1.5);
  const L = X(TOWER.l), Rr = X(TOWER.r), T = Y(TOWER.top), B = Y(TOWER.base), W = Rr - L, H = B - T;
  const t = ease(bpIntro);
  const seg = (x1, y1, x2, y2, k) => { if (k <= 0) return; k = clamp(k); bctx.beginPath(); bctx.moveTo(x1, y1); bctx.lineTo(lerp(x1, x2, k), lerp(y1, y2, k)); bctx.stroke(); };
  if (fade > 0) {
    bctx.globalAlpha = fade;
    bctx.strokeStyle = 'rgba(170,210,245,.9)'; bctx.lineWidth = 1.2 * d;
    seg(L - W * 1.4, B, Rr + W * 1.4, B, t * 1.6);
    seg(L, B, L + W * .04, T, t * 1.3 - .15); seg(Rr, B, Rr - W * .04, T, t * 1.3 - .15);
    seg(L + W * .04, T, Rr - W * .04, T, t * 2 - 1);
    bctx.lineWidth = .6 * d; bctx.strokeStyle = 'rgba(170,210,245,.42)';
    for (let f = 4; f < 62; f += 4) { const y = B - (f / 62) * H, k = t * 1.4 - (f / 62) * .6, inset = W * .04 * (f / 62); seg(L + inset, y, Rr - inset, y, k * 2); }
    bctx.lineWidth = 1 * d; bctx.strokeStyle = 'rgba(170,210,245,.75)';
    [[.07,-1],[.28,1],[.45,-1],[.6,1],[.78,-1]].forEach(([fy, side], n) => {
      const y = B - fy * H, x0 = side < 0 ? L : Rr, x1 = x0 + side * W * .28, k = t * 2 - .6 - n * .12;
      seg(x0, y, x1, y, k * 2); seg(x1, y, x1, y - H * .02, k * 2 - 1); });
    bctx.setLineDash([10 * d, 4 * d, 2 * d, 4 * d]); bctx.strokeStyle = 'rgba(196,160,106,.6)';
    seg((L + Rr) / 2, B + 20 * d, (L + Rr) / 2, T - 30 * d, t * 1.2 - .1); bctx.setLineDash([]);
    const dx = Rr + W * .75; bctx.strokeStyle = 'rgba(214,180,120,.95)'; bctx.lineWidth = .9 * d;
    seg(dx, B, dx, T, t * 1.5 - .4); seg(dx - 6 * d, B, dx + 6 * d, B, t * 3 - 1); seg(dx - 6 * d, T, dx + 6 * d, T, t * 2 - 1);
    if (t > .7) { bctx.save(); bctx.globalAlpha = fade * range(t, .7, 1); bctx.fillStyle = '#e2c99a';
      bctx.font = `${10 * d}px "JetBrains Mono", monospace`; bctx.translate(dx + 14 * d, (T + B) / 2); bctx.rotate(-Math.PI / 2);
      bctx.textAlign = 'center'; bctx.fillText('212.4 M · 62 LEVELS', 0, 0); bctx.restore(); }
    bctx.globalAlpha = 1;
  }
  if (lvlLine > 0) {
    const lv = piece(LEVEL_KEYS, p), y = B - (lv / 62) * H;
    bctx.globalAlpha = lvlLine; bctx.strokeStyle = '#f0d39c'; bctx.lineWidth = 1.6 * d; bctx.shadowColor = 'rgba(0,0,0,.5)'; bctx.shadowBlur = 6 * d; bctx.setLineDash([6 * d, 5 * d]);
    bctx.beginPath(); bctx.moveTo(L - W * 1.1, y); bctx.lineTo(Rr + W * .5, y); bctx.stroke(); bctx.setLineDash([]);
    bctx.fillStyle = '#e2c99a'; bctx.font = `${10 * d}px "JetBrains Mono", monospace`; bctx.textAlign = 'right';
    bctx.font = `500 ${11 * d}px "JetBrains Mono", monospace`; bctx.fillText(`L${String(Math.round(lv)).padStart(2, '0')} · ${(lv * M_PER_LEVEL).toFixed(1)} M`, L - W * 1.15, y + 4 * d);
    bctx.globalAlpha = 1; bctx.shadowBlur = 0;
  }
}

const rise = new SeqFilm($('#rise'), {
  onProgress(p) {
    const a = range(p, .012, .07);
    riseIntro.style.opacity = 1 - a;
    riseIntro.style.transform = isMobile() ? `translate3d(0,${-a * 60}px,0)` : `translate3d(0,calc(-50% - ${a * 80}px),0)`;
    hint.style.opacity = 1 - range(p, 0, .04);
    const lv = piece(LEVEL_KEYS, p); curAlt = lv * M_PER_LEVEL;
    lvlEl.textContent = String(Math.round(lv)).padStart(2, '0');
    altiMark.style.transform = `translate3d(0,${-(curAlt / 220) * altiScale.clientHeight}px,0)`;
    altiVal.textContent = curAlt.toFixed(1) + ' m';
    let i = 0; PHASE_AT.forEach((s, k) => { if (p >= s) i = k; }); setPhase(i);
    phaseEl.style.opacity = range(p, .05, .09) * (1 - range(p, .88, .93));
    ledger.style.opacity = range(p, .06, .1) * (1 - range(p, .88, .93));
    lgC.textContent = inr(48600 * ease(range(p, .08, .6)));
    lgS.textContent = inr(9240 * ease(range(p, .1, .62)));
    lgG.textContent = inr(3840 * range(p, .42, .72));
    tl.style.setProperty('--tp', p);
    const e = range(p, .91, .97); riseEnd.style.opacity = e; riseEnd.style.transform = `translate3d(0,${(1 - e) * 30}px,0)`;
    drawBlueprint(p, rise);
  }
});
films.push(rise);

/* ================= 2. MANIFESTO word fill ================= */
const fill = $('#fillText');
fill.innerHTML = fill.textContent.trim().split(/\s+/).map(w => `<span>${w}</span>`).join(' ');
const fillWords = $$('span', fill); let fillN = -1;
function fillTick() {
  const r = fill.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
  const n = Math.round(range(innerHeight * .85 - r.top, 0, r.height + innerHeight * .3) * fillWords.length);
  if (n === fillN) return; fillN = n; fillWords.forEach((w, k) => w.classList.toggle('on', k < n));
}

/* ================= 3. THE TOUR ================= */
const tourHead = $('#tourHead'), roomEl = $('#room'), roomN = $('#roomN'), roomT = $('#roomT'), roomD = $('#roomD');
const plan = $('.plan'), planPath = $('#planPath'), planDot = $('#planDot'), planTexts = $$('#planSvg text'), tourBar = $('#tourBar');
const planLen = planPath.getTotalLength();
const PLAN_KEYS = [[0,0],[.22,0],[.32,.2],[.5,.3],[.6,.56],[.75,.64],[.86,.92],[1,1]]; // tour progress → path fraction (living, dining, master)
let roomIdx = -1;
function setRoom(i) {
  if (i === roomIdx) return; roomIdx = i; const r = ROOMS[i];
  roomN.textContent = r.n; roomT.textContent = r.t; roomD.textContent = r.d;
  roomEl.classList.remove('swap'); void roomEl.offsetWidth; roomEl.classList.add('swap');
  planTexts.forEach(t => t.classList.toggle('on', r.plan.includes(t.textContent)));
}
const tour = new SeqFilm($('#tour'), {
  onProgress(p) {
    tourHead.style.opacity = range(p, 0, .03) * (1 - range(p, .14, .2));
    tourHead.style.transform = `translate3d(0,${-range(p, .1, .2) * 40}px,0)`;
    let i = 0; ROOMS.forEach((r, k) => { if (p >= r.at) i = k; }); setRoom(i);
    roomEl.style.opacity = range(p, .2, .25);
    plan.classList.toggle('on', p > .24);
    const pt = planPath.getPointAtLength(planLen * piece(PLAN_KEYS, p));
    planDot.setAttribute('cx', pt.x.toFixed(1)); planDot.setAttribute('cy', pt.y.toFixed(1));
    tourBar.style.transform = `scaleX(${p})`;
  }
});
films.push(tour);

/* ================= 4. RESIDENCES ================= */
const PLANS = {
  sky:   '<rect x="10" y="10" width="180" height="120"/><path d="M10 70H100V130M100 10V70M100 95H150V130M150 70V10M150 95H190"/><path class="gl" d="M10 20V120M20 10H180"/>',
  corner:'<rect x="10" y="10" width="180" height="120"/><path d="M10 60H80V130M80 10V60M80 90H130V130M130 60H190M130 10V60"/><path class="gl" d="M10 20V120M20 10H180M190 20V120"/>',
  sea:   '<rect x="10" y="10" width="180" height="120"/><path d="M10 70H92V130M92 10V70M92 92H130V130M130 70V10M130 92H190"/><path class="gl" d="M10 18V122M18 10H182M190 18V60"/>',
  duplex:'<rect x="10" y="10" width="85" height="120"/><rect x="105" y="10" width="85" height="120"/><path d="M10 60H95M50 60V130M105 70H190M150 10V70M150 95H190"/><path class="gl" d="M10 20V120M20 10H85M115 10H180"/><path d="M60 25H80V45"/>',
  ph:    '<rect x="10" y="10" width="180" height="120"/><path d="M10 55H70V130M70 10V55M70 85H120V130M120 55V10M120 85H190M150 10V55H190"/><rect x="130" y="95" width="50" height="25"/><path class="gl" d="M10 18V122M18 10H182M190 18V122M18 130H182"/>'
};
const track = $('#resTrack'); let unit = 'ft';
const priceFrom = r => r.por ? 'Price on request' : `From ₹ ${cr(r.area * RATE(r.levels[0]))} Cr`;
const area = r => unit === 'ft' ? `${inr(r.area)} sq ft` : `${inr(r.area * 0.0929)} m²`;
track.innerHTML = RESIDENCES.map((r, i) => `
  <article class="res-card" data-i="${i}">
    <div class="res-top"><span class="mono">${String(i + 1).padStart(2, '0')} / ${String(RESIDENCES.length).padStart(2, '0')}</span><span class="mono">Levels ${r.levels[0]}–${r.levels[1]}</span></div>
    <h3>${r.name}</h3>
    <div class="res-plan"><svg viewBox="0 0 200 140" aria-hidden="true">${PLANS[r.plan]}</svg></div>
    <dl class="res-spec">
      <div><dt>Type</dt><dd>${r.type}</dd></div><div><dt>Carpet</dt><dd class="ar">${area(r)}</dd></div>
      <div><dt>Bathrooms</dt><dd>${r.bath}</dd></div><div><dt>Per floor</dt><dd>${r.perFloor === 1 ? 'Full floor' : r.perFloor + ' homes'}</dd></div>
    </dl>
    <div class="res-foot"><b>${priceFrom(r)}</b><a href="#enquire">Request plan</a></div>
  </article>`).join('');
$$('.res-plan path, .res-plan rect', track).forEach(el => el.style.setProperty('--len', Math.ceil(el.getTotalLength())));
const cardIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('drawn'); cardIO.unobserve(e.target); } }), { threshold: .35 });
$$('.res-card', track).forEach(c => cardIO.observe(c));
$$('.res-card a', track).forEach(a => a.addEventListener('click', e => { e.preventDefault(); lenis ? lenis.scrollTo('#enquire', { duration: 2 }) : $('#enquire').scrollIntoView({ behavior: 'smooth' }); }));
$$('.unit-toggle button').forEach(b => b.addEventListener('click', () => {
  unit = b.dataset.u; $$('.unit-toggle button').forEach(x => x.classList.toggle('on', x === b));
  $$('.res-card', track).forEach(c => { $('.ar', c).textContent = area(RESIDENCES[+c.dataset.i]); });
}));
if (hasGSAP) {
  ScrollTrigger.matchMedia({
    '(min-width: 860px)': () => {
      const shift = () => Math.max(0, track.scrollWidth - (innerWidth - $('.res-intro').offsetWidth));
      gsap.to(track, { x: () => -shift(), ease: 'none',
        scrollTrigger: { trigger: '#residences', pin: '.res-pin', start: 'top top', end: () => '+=' + shift() * 1.1, scrub: 0.6, invalidateOnRefresh: true } });
    }
  });
}

/* ================= 5. CHOOSE YOUR VIEW ================= */
const vRange = $('#vRange'), viewImg = $('#viewImg'), viewHaze = $('#viewHaze');
function setView() {
  const L = +vRange.value, t = (L - 12) / 49, h = L * M_PER_LEVEL;
  $('#vLvl').textContent = L; $('#vAlt').textContent = Math.round(h);
  $('#vSea').textContent = Math.round(3.57 * Math.sqrt(h));
  const r = RESIDENCES.find(x => L >= x.levels[0] && L <= x.levels[1]) || RESIDENCES[2];
  $('#vPrice').textContent = cr(r.area * RATE(L));
  viewImg.style.transform = `translate3d(0,${-(1 - t) * 30}%,0) scale(${1.18 - t * .18})`;
  viewImg.style.filter = `blur(${((1 - t) * 1.6).toFixed(2)}px) brightness(${(.72 + t * .3).toFixed(2)}) saturate(${(.8 + t * .3).toFixed(2)})`;
  viewHaze.style.opacity = 1 - t * .45;
}
vRange.addEventListener('input', setView); setView();

/* ================= 6. CLUB stacking cards ================= */
const cards = $$('.card-s');
function clubTick() {
  for (let i = 0; i < cards.length - 1; i++) {
    const n = cards[i + 1].getBoundingClientRect();
    if (n.top > innerHeight * 1.2 || n.bottom < 0) continue;
    const p = range(innerHeight - n.top, 0, innerHeight * .8);
    cards[i].style.transform = `scale(${(1 - p * .06).toFixed(4)})`; cards[i].firstElementChild.style.opacity = (1 - p * .5).toFixed(3);
  }
}

/* ================= 7. LOCATION ================= */
new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { $('.map').classList.add('in'); o.disconnect(); } }), { threshold: .3 }).observe($('.map'));
$$('#locList li').forEach(li => {
  const pin = $(`.pin[data-pin="${li.dataset.pin}"]`);
  li.addEventListener('mouseenter', () => { pin.classList.add('on'); li.classList.add('on'); });
  li.addEventListener('mouseleave', () => { pin.classList.remove('on'); li.classList.remove('on'); });
});

/* ================= 8. EMI CALCULATOR ================= */
const cV = $('#cV'), cD = $('#cD'), cT = $('#cT'), cR = $('#cR'), emiEl = $('#emi');
let emiShown = 0, emiTarget = 0;
function calc() {
  const V = +cV.value * 1e6, D = +cD.value / 100, n = +cT.value * 12, r = +cR.value / 1200, P = V * (1 - D);
  emiTarget = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  $('#oV').textContent = `₹ ${(V / 1e7).toFixed(1)} Cr`; $('#oD').textContent = cD.value + '%';
  $('#oT').textContent = cT.value + ' yrs'; $('#oR').textContent = (+cR.value).toFixed(1) + '%';
  $('#loanAmt').textContent = `Loan ₹ ${(P / 1e7).toFixed(2)} Cr · ${n} instalments`;
  [cV, cD, cT, cR].forEach(i => i.style.setProperty('--f', ((i.value - i.min) / (i.max - i.min) * 100) + '%'));
}
[cV, cD, cT, cR].forEach(i => i.addEventListener('input', calc)); calc();
function emiTick() {
  if (Math.abs(emiTarget - emiShown) < 1) { if (emiShown !== emiTarget) { emiShown = emiTarget; emiEl.textContent = inr(emiShown); } return; }
  emiShown = lerp(emiShown, emiTarget, .12); emiEl.textContent = inr(emiShown);
}

/* ================= 9. ENQUIRE ================= */
const toastEl = $('#toast'); let toastT;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 3600); }
$('#enqForm').addEventListener('submit', e => {
  e.preventDefault(); const f = e.target; let ok = true;
  [f.elements.name, f.elements.phone].forEach(i => { const bad = !i.value.trim() || (i.name === 'phone' && !/^[+\d\s-]{8,}$/.test(i.value)); i.classList.toggle('err', bad); if (bad) ok = false; });
  if (!ok) return toast('Please add your name and a valid mobile number.');
  toast(`Thank you, ${f.elements.name.value.trim().split(' ')[0]}. Our team will call to confirm your visit.`); f.reset();
});
const enqImg = $('#enqImg');
function parallaxTick() {
  const r = enqImg.parentElement.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
  enqImg.style.transform = `translate3d(0,${((r.top / innerHeight) * -6).toFixed(2)}%,0)`;
}

/* ================= HEADER ================= */
const hdr = $('#hdr'), riseSec = $('#rise'), tourSec = $('#tour'); let lastY = 0, riseEndY = 0;
const measure = () => { riseEndY = riseSec.offsetTop + riseSec.offsetHeight - innerHeight; };
measure(); addEventListener('resize', measure); addEventListener('load', measure);
const lightSecs = $$('[data-theme="light"]');
let menuOpen = false;
function headerTick() {
  const y = scrollY, dir = y > lastY + 2 ? 1 : y < lastY - 2 ? -1 : 0; lastY = y;
  if (dir === 1 && y > 200 && !menuOpen) hdr.classList.add('hide'); else if (dir === -1) hdr.classList.remove('hide');
  hdr.classList.toggle('solid', y > riseEndY);
  hdr.classList.toggle('light', lightSecs.some(s => { const r = s.getBoundingClientRect(); return r.top <= 40 && r.bottom > 40; }));
  const tr = tourSec.getBoundingClientRect();
  const alt = tr.top < innerHeight * .5 && tr.bottom > 0 ? 178 : curAlt;
  hdrAlt.textContent = alt.toFixed(1).padStart(5, '0');
}

/* ================= MENU ================= */
const menu = $('#menu'), menuBtn = $('#menuBtn');
function toggleMenu(v = !menuOpen) { menuOpen = v; menu.classList.toggle('open', v); menu.setAttribute('aria-hidden', String(!v)); menuBtn.setAttribute('aria-expanded', String(v)); if (lenis) v ? lenis.stop() : lenis.start(); }
menuBtn.addEventListener('click', () => toggleMenu());
addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen) toggleMenu(false); });

/* ================= REVEALS + COUNTERS + SPLIT ================= */
function split(el) { el.innerHTML = el.innerHTML.split(/(<br>)/).map(part => part === '<br>' ? part :
  part.replace(/(<em>.*?<\/em>|[^\s<]+)/g, m => `<span class="w"><span>${m}</span></span>`)).join(''); }
$$('.split').forEach(split);
$$('#manifesto h2, #residences h2, #views h2, #club h2, #location h2, #calc h2, #enquire h2, .facts, .loc-list, .calc, #enqForm, .res-intro .unit-toggle').forEach(el => el.classList.add('rv'));
const rvIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rvIO.unobserve(e.target); } }), { threshold: .15 });
$$('.rv').forEach(el => rvIO.observe(el));
function countTo(el, to, dur = 1600) { const t0 = performance.now(); const step = t => { const k = ease(clamp((t - t0) / dur)); el.textContent = Math.round(to * k); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
const cIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { countTo(e.target, +e.target.dataset.count); cIO.unobserve(e.target); } }), { threshold: .6 });
$$('b[data-count]').forEach(el => cIO.observe(el));
new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { $('.tour-head .split').classList.add('in'); o.disconnect(); } }), { threshold: .01 }).observe(tourSec);

const ftrWord = $('.ftr-word');
function footTick() { const r = ftrWord.getBoundingClientRect(); if (r.top > innerHeight) return; ftrWord.style.setProperty('--fw', (range(innerHeight - r.top, 0, innerHeight * .7) * 100).toFixed(1) + '%'); }

/* ================= CURSOR ================= */
const cur = $('#cursor'); let cx = -50, cy = -50, tx = -50, ty = -50;
const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
if (fine) {
  addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; }, { passive: true });
  $$('a, button, input, select, .res-card').forEach(el => { el.addEventListener('mouseenter', () => cur.classList.add('big')); el.addEventListener('mouseleave', () => cur.classList.remove('big')); });
}

/* ================= LOOP ================= */
function loop() {
  films.forEach(f => f.tick());
  fillTick(); clubTick(); emiTick(); parallaxTick(); headerTick(); footTick();
  if (fine) { cx = lerp(cx, tx, .2); cy = lerp(cy, ty, .2); cur.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`; }
  requestAnimationFrame(loop);
}

/* ================= PRELOADER ================= */
const loader = $('#loader'), ldNum = $('#ldNum'), ldTxt = $('#ldTxt'), ldPaths = $$('.ld-bp path');
document.body.classList.add('locked'); if (lenis) lenis.stop();
const t0 = performance.now(); let shown = 0, done = false;
const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
Promise.all([rise.ready, fontsReady]).then(() => { done = true; });
setTimeout(() => { done = true; }, 9000); // never block the page on a slow network
(function lt() {
  const real = done ? 1 : Math.min(.95, rise.loaded / rise.firstPass);
  const timeCap = clamp((performance.now() - t0) / 1400);
  shown = lerp(shown, Math.min(real, timeCap), .08); if (done && timeCap >= 1 && shown > .985) shown = 1;
  ldNum.textContent = String(Math.round(shown * 62)).padStart(2, '0');
  ldPaths.forEach((p, i) => p.style.setProperty('--d', 1 - clamp(shown * 1.4 - i * .12)));
  ldTxt.textContent = shown < .4 ? 'Drawing the plans' : shown < .8 ? 'Pouring the core' : 'Opening the doors';
  if (shown < 1) return requestAnimationFrame(lt);
  loader.classList.add('open'); document.body.classList.remove('locked'); if (lenis) lenis.start();
  setTimeout(() => loader.classList.add('gone'), 1300);
  setTimeout(() => $('.rise-intro .split').classList.add('in'), 350);
  const b0 = performance.now(); (function bpA() { bpIntro = clamp((performance.now() - b0) / 2600); if (bpIntro < 1) requestAnimationFrame(bpA); })();
})();
requestAnimationFrame(loop);
if (hasGSAP) addEventListener('load', () => ScrollTrigger.refresh());
})();
