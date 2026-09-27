//
// strml.net: age of ai edition.
//
// Same idea as app.js: a stylesheet that types itself, one character at a time.
// The difference is that everything typed also feeds a pile of instruments
// (a specimen, a timeline, telemetry, a keyboard, an eye) that only become
// visible as the stylesheet reaches them.
//
import Markdown from 'markdown';
const md = Markdown.markdown.toHTML;
import workText from 'raw-loader!./work.txt';
import pgpText from 'raw-loader!./pgp.txt';
import headerHTML from 'raw-loader!./ai/header.html';
import preStyles from 'raw-loader!./ai/prestyles.css';
import replaceURLs from './lib/replaceURLs';
import {default as writeChar, writeSimpleChar, handleChar} from './lib/writeChar';

const styleText = [0, 1, 2, 3, 4, 5, 6].map((i) => require('raw-loader!./ai/styles' + i + '.css').default);

// Vars that will help us get er done
const params = new URLSearchParams(window.location.search);
const isDev = window.location.hostname === 'localhost';
const speed = params.has('speed') ? Number(params.get('speed')) : (isDev ? 0 : 14);
const today = new Date().toISOString().slice(0, 10);
const workIntro = 'strml@2026 ~\n❯ cat work.txt\n\n';

let style, styleEl, workEl, pgpEl, skipAnimationEl, pauseEl;
let animationSkipped = false, done = false, paused = false;
// Playback rate, from the 1x / 2x / 4x buttons.
let rate = 1;
// When the next keystroke is due. Keeping a schedule (instead of sleeping a
// fixed amount each time) means 4x really is 4x, even below the browser's
// minimum timer resolution.
let due = 0;

// The whole show, in order. Each chapter is one stop on the timeline.
const chapters = [
  {name: 'boot/',     el: 'style', text: styleText[0]},
  {name: 'grid/',     el: 'style', text: styleText[1]},
  {name: 'work.txt',  el: 'work',  text: workIntro + workText, after: renderWork},
  {name: 'specimen/', el: 'style', text: styleText[2]},
  {name: 'roots/',    el: 'style', text: styleText[3]},
  {name: 'hands/',    el: 'style', text: styleText[4]},
  {name: 'eye/',      el: 'style', text: styleText[5]},
  {name: 'pgp.asc',   el: 'pgp',   text: pgpText, perTick: 32},
  {name: 'fin',       el: 'style', text: styleText[6]},
];

// One keystroke = one tick = one point on the specimen.
let totalTicks = 0;
chapters.forEach((c) => {
  c.perTick = c.perTick || 1;
  c.startTick = totalTicks;
  totalTicks += Math.ceil(c.text.length / c.perTick);
});
const cursor = {chapter: 0, index: 0};

// Wait for load to get started.
document.addEventListener('DOMContentLoaded', function() {
  populateHeader();
  getEls();
  buildHUD();
  createEventHandlers();
  requestAnimationFrame(frame);
  startAnimation();
});

async function startAnimation() {
  try {
    for (let i = 0; i < chapters.length; i++) {
      cursor.chapter = i;
      cursor.index = 0;
      const c = chapters[i];
      await writeTo(elFor(c), c.text, c.el === 'style', c.perTick);
      if (c.after) c.after();
      await delay(c.el === 'style' ? 300 : 900);
    }
    telemetry.mode = 'idle';
    done = true;
  }
  // Flow control straight from the ghettos of Milwaukee. Still.
  catch(e) {
    if (e.message === 'SKIP IT') {
      surprisinglyShortAttentionSpan();
    } else {
      throw e;
    }
  }
}

// Skips all the animations.
async function surprisinglyShortAttentionSpan() {
  if (done) return;
  done = true;

  // Fast-forward the instruments through everything we didn't get to type.
  for (let i = cursor.chapter; i < chapters.length; i++) {
    const c = chapters[i];
    const from = i === cursor.chapter ? cursor.index : 0;
    for (let j = from; j < c.text.length; j += c.perTick) {
      onKeystroke(c.text.slice(j, j + c.perTick), c.el === 'style', true);
    }
  }
  telemetry.mode = 'idle';
  cursor.chapter = chapters.length - 1;

  pgpEl.textContent = pgpText;
  let txt = styleText.join('\n');
  style.textContent = txt;
  let styleHTML = '';
  for (let i = 0; i < txt.length; i++) {
    styleHTML = handleChar(styleHTML, txt[i]);
  }
  styleEl.innerHTML = styleHTML;
  renderWork();

  await delay(50);
  styleEl.scrollTop = pgpEl.scrollTop = 1e6;
}


/**
 * Helpers
 */

const endOfSentence = /[\.\?\!]\s$/;
const comma = /\D[\,]\s$/;
const endOfBlock = /[^\/]\n\n$/;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function elFor(chapter) {
  return {style: styleEl, work: workEl, pgp: pgpEl}[chapter.el];
}

async function writeTo(el, message, mirrorToStyle, charsPerInterval) {
  for (let index = 0; index < message.length;) {
    if (animationSkipped) {
      // Lol who needs proper flow control
      throw new Error('SKIP IT');
    }
    // Write a character or multiple characters to the buffer.
    let chars = message.slice(index, index + charsPerInterval);
    index += charsPerInterval;
    cursor.index = index;

    if (mirrorToStyle) {
      writeChar(el, chars, style);
    } else {
      writeSimpleChar(el, chars);
    }
    // Ensure we stay scrolled to the bottom.
    el.scrollTop = el.scrollHeight;
    onKeystroke(chars, mirrorToStyle, false);

    // Schedule another write. Humans pause to think; so does this.
    let thisInterval = speed;
    let thisSlice = message.slice(index - 2, index + 1);
    if (comma.test(thisSlice)) thisInterval = speed * 30;
    if (endOfBlock.test(thisSlice)) thisInterval = speed * 50;
    if (endOfSentence.test(thisSlice)) thisInterval = speed * 70;
    telemetry.mode = thisInterval > speed * 10 ? 'thinking' : 'typing';

    // With no delay at all, yield every so often so we can still paint.
    if (thisInterval === 0) {
      if (index % 40 === 0) await delay(0);
    } else {
      due = Math.max(due, performance.now() - 100) + thisInterval / rate;
      const wait = due - performance.now();
      if (wait > 0) await delay(wait);
    }
    while (paused) {
      await delay(50);
      due = performance.now();
    }
  }
}

//
// Put els into the module scope.
//
function getEls() {
  // We're cheating a bit on styles. Again.
  let preStyleEl = document.createElement('style');
  preStyleEl.textContent = preStyles;
  document.head.insertBefore(preStyleEl, document.getElementsByTagName('style')[0]);

  style = document.getElementById('style-tag');
  styleEl = document.getElementById('style-text');
  workEl = document.getElementById('work-text');
  pgpEl = document.getElementById('pgp-text');
  skipAnimationEl = document.getElementById('skip-animation');
  pauseEl = document.getElementById('pause-resume');
}

function populateHeader() {
  document.getElementById('top').innerHTML = headerHTML;
}

function createEventHandlers() {
  // Mirror user edits back to the style element.
  styleEl.addEventListener('input', function() {
    style.textContent = styleEl.textContent;
  });

  skipAnimationEl.addEventListener('click', function(e) {
    e.preventDefault();
    animationSkipped = true;
  });

  pauseEl.addEventListener('click', function(e) {
    e.preventDefault();
    paused = !paused;
    pauseEl.textContent = paused ? 'resume >>' : 'pause ||';
    if (paused) telemetry.mode = 'paused';
  });

  const rateEls = document.querySelectorAll('#top .rate');
  rateEls.forEach((el) => el.addEventListener('click', function(e) {
    e.preventDefault();
    rate = Number(el.dataset.rate);
    due = performance.now();
    rateEls.forEach((r) => r.classList.toggle('on', r === el));
  }));

  window.addEventListener('mousemove', function(e) {
    eye.x = e.clientX;
    eye.y = e.clientY;
    eye.last = performance.now();
  });
}

function renderWork() {
  workEl.innerHTML =
    '<span class="prompt">strml@2026 ~</span>\n❯ whoami --render\n' +
    '<div class="md">' + replaceURLs(md(workText)) + '</div>' +
    '<span class="prompt">strml@2026 ~</span>\n❯ <span class="caret">▌</span>';
  workEl.scrollTop = 0;
}


/**
 * Instruments.
 *
 * None of these are visible until the stylesheet says so; they just quietly
 * keep count from the very first keystroke.
 */

const telemetry = {
  ticks: 0, chars: 0, rules: 0, props: 0, selectors: 0, comments: 0, lines: 0,
  mode: 'idle', started: performance.now(), buckets: new Array(60).fill(0), lastChar: '',
};
const eye = {x: -1, y: -1, last: 0, px: 0, py: 0};
const els = {};

// Deterministic randomness, so the page grows the same way every time.
function rng(seed) {
  let s = seed >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fmt(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\'');
}

function palette() {
  const cs = getComputedStyle(document.documentElement);
  const get = (name, fallback) => (cs.getPropertyValue(name) || '').trim() || fallback;
  return {
    paper: get('--paper', '#0a0a09'),
    ink: get('--ink', '#d8d3c4'),
    dim: get('--dim', '#6f6b61'),
    line: get('--line', '#2b2a26'),
    hot: get('--hot', '#e5553b'),
    font: '9px "JetBrains Mono", ui-monospace, Menlo, monospace',
  };
}

//
// Keep a canvas sized to its box, at device resolution.
//
function sizeCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return null;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return {ctx, w, h};
}

//
// Specimen: a height field that every keystroke drops a point onto.
// The points aren't random: they're drawn from a mask of the word STRML,
// so the logo grows out of the noise as the page gets written.
//
const GW = 128, GH = 56, SECTION_ROW = 34;
const field = new Float32Array(GW * GH);
let smooth = new Float32Array(GW * GH);
let fieldDirty = true, lastDeposit = -1;
const mask = [];
const fieldRand = rng(2015);

function buildMask() {
  const c = document.createElement('canvas');
  c.width = GW; c.height = GH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = GH;
  do {
    ctx.font = '900 ' + size + 'px "Arial Black", Helvetica, Arial, sans-serif';
    size--;
  } while (ctx.measureText('STRML').width > GW * 0.86 && size > 8);
  ctx.fillText('STRML', GW / 2, GH * 0.56);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.strokeText('STRML', GW / 2, GH * 0.56);
  const data = ctx.getImageData(0, 0, GW, GH).data;
  for (let i = 0; i < GW * GH; i++) if (data[i * 4 + 3] > 128) mask.push(i);
  // Shuffle, deterministically.
  for (let i = mask.length - 1; i > 0; i--) {
    const j = Math.floor(fieldRand() * (i + 1));
    [mask[i], mask[j]] = [mask[j], mask[i]];
  }
}

const NOISE = 0.14;
function deposit(tick) {
  let i;
  if (!mask.length || fieldRand() < NOISE) i = Math.floor(fieldRand() * GW * GH);
  else i = mask[tick % mask.length];
  field[i] += 1;
  lastDeposit = i;
  fieldDirty = true;
}

function smoothField() {
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue;
          const wgt = (dx || dy) ? 1 : 4;
          sum += field[yy * GW + xx] * wgt;
          n += wgt;
        }
      }
      smooth[y * GW + x] = sum / n;
    }
  }
  fieldDirty = false;
}

function drawSpecimen(p) {
  const s = sizeCanvas(els.specimen);
  if (!s) return;
  const {ctx, w, h} = s;
  const L = 26, R = 14, T = 40, B = 22;
  const pw = w - L - R, ph = h - T - B;
  const rowGap = ph / (GH + 3);
  // Full height at the end of the show is a few rows of lift.
  const expected = Math.max(1, (totalTicks * (1 - NOISE)) / Math.max(1, mask.length));
  const amp = (rowGap * 1.7) / expected;
  const X = (x) => L + (x / (GW - 1)) * pw;
  const Y = (y, v) => T + (y + 3) * rowGap - v * amp;

  ctx.font = p.font;
  ctx.lineWidth = 1;

  // Titles
  ctx.fillStyle = p.ink;
  ctx.fillText('STRML', 4, 12);
  ctx.fillText('grown toward ' + fmt(totalTicks) + ' points', 44, 12);
  ctx.fillStyle = p.dim;
  ctx.fillText('1 point = 1 keystroke · 2015 → ' + today.slice(0, 4), 44, 23);

  // Frame + column ticks
  ctx.strokeStyle = p.line;
  ctx.strokeRect(L + 0.5, T - 8.5, pw, ph + 8);
  ctx.fillStyle = p.dim;
  for (let i = 1; i <= 8; i++) {
    const x = L + (i - 0.5) * (pw / 8);
    ctx.fillText(String(i), x - 2, h - 6);
  }

  // Dimension line across the top
  ctx.strokeStyle = p.dim;
  ctx.beginPath();
  ctx.moveTo(L + pw * 0.2, T - 2.5); ctx.lineTo(L + pw * 0.8, T - 2.5);
  ctx.moveTo(L + pw * 0.2 + 0.5, T - 6); ctx.lineTo(L + pw * 0.2 + 0.5, T + 1);
  ctx.moveTo(L + pw * 0.8 + 0.5, T - 6); ctx.lineTo(L + pw * 0.8 + 0.5, T + 1);
  ctx.stroke();
  const dimLabel = GW + ' × ' + GH + ' cells';
  const dlw = ctx.measureText(dimLabel).width;
  ctx.fillStyle = p.paper;
  ctx.fillRect(L + pw / 2 - dlw / 2 - 4, T - 8, dlw + 8, 10);
  ctx.fillStyle = p.dim;
  ctx.fillText(dimLabel, L + pw / 2 - dlw / 2, T);

  // Contours, back to front, each one occluding what's behind it.
  // Raised ground gets drawn brighter, so the shape reads.
  if (fieldDirty) smoothField();
  const raised = expected * (telemetry.ticks / totalTicks) * 0.35;
  let apex = 0, apexAt = 0;
  for (let y = 0; y < GH; y++) {
    const isSection = y === SECTION_ROW;
    ctx.beginPath();
    for (let x = 0; x < GW; x++) {
      const v = smooth[y * GW + x];
      if (field[y * GW + x] > apex) { apex = field[y * GW + x]; apexAt = y * GW + x; }
      const px = X(x), py = Y(y, v);
      if (x) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.lineTo(X(GW - 1), T + ph);
    ctx.lineTo(X(0), T + ph);
    ctx.closePath();
    ctx.fillStyle = p.paper;
    ctx.fill();
    ctx.strokeStyle = isSection ? p.hot : p.ink;
    ctx.globalAlpha = isSection ? 0.9 : 0.14 + 0.22 * (y / GH);
    ctx.stroke();

    // Second pass: just the raised stretches, bright.
    ctx.beginPath();
    let pen = false;
    for (let x = 0; x < GW; x++) {
      const v = smooth[y * GW + x];
      const px = X(x), py = Y(y, v);
      if (raised > 0 && v > raised) {
        if (pen) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        pen = true;
      } else {
        pen = false;
      }
    }
    ctx.globalAlpha = isSection ? 1 : 0.95;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Section markers
  const sy = T + (SECTION_ROW + 3) * rowGap;
  ctx.fillStyle = p.hot;
  ctx.fillText('A', L - 12, sy + 3);
  ctx.fillText('A', L + pw + 4, sy + 3);

  // Apex leader
  if (apex > 0) {
    const ax = X(apexAt % GW), ay = Y(Math.floor(apexAt / GW), smooth[apexAt]);
    const lx = Math.min(ax + 40, L + pw - 90), ly = Math.max(ay - 18, T + 8);
    ctx.strokeStyle = p.ink;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(lx, ly); ctx.lineTo(lx + 6, ly); ctx.stroke();
    ctx.fillStyle = p.paper;
    ctx.fillRect(lx + 7, ly - 7, ctx.measureText('apex ' + apex + ' steps').width + 4, 10);
    ctx.fillStyle = p.ink;
    ctx.fillText('apex ' + apex + ' steps', lx + 9, ly + 1);
  }

  // Where the latest keystroke landed.
  if (lastDeposit >= 0 && telemetry.mode === 'typing') {
    const x = X(lastDeposit % GW), y = Y(Math.floor(lastDeposit / GW), smooth[lastDeposit]);
    ctx.strokeStyle = p.hot;
    ctx.beginPath();
    ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y);
    ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6);
    ctx.stroke();
  }

  // Root line
  ctx.strokeStyle = p.dim;
  ctx.setLineDash([2, 3]);
  ctx.beginPath(); ctx.moveTo(L + 0.5, T + ph - 12); ctx.lineTo(L + pw, T + ph - 12); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = p.dim;
  ctx.fillText('root carries ' + fmt(telemetry.ticks), L + 6, T + ph - 3);
}

function drawSection(p) {
  const s = sizeCanvas(els.section);
  if (!s) return;
  const {ctx, w, h} = s;
  const row = smooth.subarray(SECTION_ROW * GW, SECTION_ROW * GW + GW);
  let max = 1;
  for (let i = 0; i < GW; i++) max = Math.max(max, row[i]);
  ctx.beginPath();
  ctx.moveTo(4, h - 6);
  for (let i = 0; i < GW; i++) ctx.lineTo(4 + (i / (GW - 1)) * (w - 8), h - 6 - (row[i] / max) * (h - 14));
  ctx.lineTo(w - 4, h - 6);
  ctx.closePath();
  ctx.fillStyle = p.dim;
  ctx.globalAlpha = 0.5;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = p.ink;
  ctx.stroke();
  ctx.strokeStyle = p.dim;
  ctx.beginPath(); ctx.moveTo(4, h - 5.5); ctx.lineTo(w - 4, h - 5.5); ctx.stroke();

  // Count contiguous lumps, just for the readout.
  let cuts = 0, inside = false;
  for (let i = 0; i < GW; i++) {
    const on = row[i] > max * 0.3;
    if (on && !inside) cuts++;
    inside = on;
  }
  els.cuts.textContent = 'cuts ' + cuts + ' members';
}

//
// Spine: the timeline arc, 2015 at the top, today at the bottom.
//
const clusters = [];

function spawnCluster(t, silent) {
  const r = rng(clusters.length * 7919 + 13);
  const segs = [];
  const grow = (x, y, ang, len, depth) => {
    if (depth > 4 || len < 1.5) return;
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    segs.push({x1: x, y1: y, x2, y2, depth});
    const kids = depth < 2 ? 2 + Math.floor(r() * 2) : 1 + Math.floor(r() * 2);
    for (let k = 0; k < kids; k++) grow(x2, y2, ang + (r() - 0.5) * 1.4, len * (0.5 + r() * 0.25), depth + 1);
  };
  // Angles are relative to the rim: 0 points out of the wheel, PI points in.
  // Mostly outward. Every so often, a big one.
  const big = r() < 0.18;
  const roots = 1 + Math.floor(r() * (big ? 4 : 2));
  for (let k = 0; k < roots; k++) {
    const inward = r() < 0.2;
    grow(0, 0, (inward ? Math.PI : 0) + (r() - 0.5) * 1.8, (big ? 10 : 4) + r() * (big ? 12 : 7), 0);
  }
  clusters.push({t, segs, born: silent ? performance.now() - r() * 900 : performance.now()});
}

function drawSpine(p, now) {
  const s = sizeCanvas(els.spine);
  if (!s) return;
  const {ctx, w, h} = s;
  const top = 30, bottom = h - 40;
  const half = (bottom - top) / 2;
  const R = half * 2.2;
  const thetaMax = Math.asin(half / R);
  const rimX = Math.min(64, w * 0.28);
  const cx = rimX + R, cy = top + half;
  const P = (t) => {
    const th = -thetaMax + 2 * thetaMax * t;
    // `out` is the angle pointing away from the hub.
    return {x: cx - R * Math.cos(th), y: cy + R * Math.sin(th), out: Math.atan2(Math.sin(th), -Math.cos(th))};
  };
  const progress = telemetry.ticks / totalTicks;
  ctx.font = p.font;

  // The rim: faint for the future, solid for what's been written.
  const arc = (t0, t1) => {
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const q = P(t0 + (t1 - t0) * (i / 80));
      if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
    }
    ctx.stroke();
  };
  ctx.strokeStyle = p.line;
  ctx.lineWidth = 1;
  arc(0, 1);
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = 2;
  arc(0, progress);
  ctx.lineWidth = 1;

  // Roots
  ctx.strokeStyle = p.ink;
  for (const c of clusters) {
    const base = P(c.t);
    const cos = Math.cos(base.out), sin = Math.sin(base.out);
    const g = Math.min(1, (now - c.born) / 1200);
    const shown = Math.ceil(c.segs.length * g);
    for (let i = 0; i < shown; i++) {
      const sg = c.segs[i];
      ctx.globalAlpha = 0.9 - sg.depth * 0.16;
      ctx.beginPath();
      ctx.moveTo(base.x + sg.x1 * cos - sg.y1 * sin, base.y + sg.x1 * sin + sg.y1 * cos);
      ctx.lineTo(base.x + sg.x2 * cos - sg.y2 * sin, base.y + sg.x2 * sin + sg.y2 * cos);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // Chapter stops, labelled on the inside of the rim.
  chapters.forEach((c, i) => {
    const q = P(c.startTick / totalTicks);
    const current = i === cursor.chapter && !done;
    const reached = telemetry.ticks >= c.startTick;
    const ix = -Math.cos(q.out), iy = -Math.sin(q.out);
    ctx.strokeStyle = reached ? p.ink : p.line;
    ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + ix * 10, q.y + iy * 10); ctx.stroke();
    const lx = q.x + ix * 16, ly = q.y + iy * 16 + 3;
    ctx.fillStyle = current ? p.hot : (reached ? p.ink : p.dim);
    ctx.fillText(c.name, lx, ly);
    if (current) {
      const tw = ctx.measureText(c.name).width;
      ctx.strokeStyle = p.hot;
      ctx.strokeRect(Math.round(lx) - 4.5, Math.round(ly) - 10.5, tw + 8, 14);
      ctx.fillText('▸', lx + tw + 8, ly);
    }
  });

  // Head of the timeline
  const head = P(progress);
  ctx.fillStyle = p.hot;
  ctx.globalAlpha = 0.25 + 0.2 * Math.sin(now / 180);
  ctx.beginPath(); ctx.arc(head.x, head.y, 7, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(head.x, head.y, 2.5, 0, Math.PI * 2); ctx.fill();

  // Dates
  const a = P(0), b = P(1);
  ctx.fillStyle = p.dim;
  ctx.fillText('2015-05', a.x + 4, a.y - 12);
  ctx.fillText(today, b.x + 4, b.y + 18);
  ctx.fillText('typed · one key at a time', rimX - 40 > 0 ? rimX - 40 : 4, h - 4);
}

function drawSpark(p) {
  const s = sizeCanvas(els.spark);
  if (!s) return;
  const {ctx, w, h} = s;
  const b = telemetry.buckets;
  const max = Math.max(10, ...b);
  const bw = w / b.length;
  ctx.fillStyle = p.ink;
  b.forEach((v, i) => {
    const bh = Math.max(1, (v / max) * (h - 2));
    ctx.globalAlpha = i === b.length - 1 ? 1 : 0.7;
    ctx.fillRect(i * bw, h - bh, Math.max(1, bw - 1), bh);
  });
  ctx.globalAlpha = 1;
}

//
// Keyboard. Lights up whatever's being typed.
//
const KEY_ROWS = [
  ['esc', '`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', '⌫'],
  ['tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
  ['caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', '\'', '↵'],
  ['⇧', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', '⇧ '],
  ['space'],
];
const SHIFTED = {
  '~': '`', '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8',
  '(': '9', ')': '0', '_': '-', '+': '=', '{': '[', '}': ']', '|': '\\', ':': ';', '"': '\'',
  '<': ',', '>': '.', '?': '/',
};
const keyEls = {};
const handRand = rng(42);

function buildKeyboard() {
  const wrap = document.getElementById('keys');
  KEY_ROWS.forEach((row, r) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'krow';
    row.forEach((k, c) => {
      const el = document.createElement('span');
      el.className = 'kc';
      el.textContent = k === 'space' ? '                                ' : k;
      // Which hand would reach for it, touch-typist style.
      el.dataset.hand = (r === 4 ? 'R' : (c < (r === 0 ? 7 : 6) ? 'L' : 'R'));
      keyEls[k] = keyEls[k] || [];
      keyEls[k].push(el);
      rowEl.appendChild(el);
    });
    wrap.appendChild(rowEl);
  });
  const hands = document.createElement('div');
  hands.innerHTML = '<span class="hand" id="hand-l"></span><span class="hand" id="hand-r"></span>';
  wrap.appendChild(hands);
  els.handL = document.getElementById('hand-l');
  els.handR = document.getElementById('hand-r');
  els.handL.textContent = '[\'hand0:l\'] 0.0000000';
  els.handR.textContent = '[\'hand1:r\'] 0.0000000';
}

function pressKey(ch) {
  let names = [];
  if (ch === '\n') names = ['↵'];
  else if (ch === ' ') names = ['space'];
  else if (SHIFTED[ch]) names = [SHIFTED[ch], '⇧'];
  else if (/[A-Z]/.test(ch)) names = [ch.toLowerCase(), '⇧'];
  else if (keyEls[ch]) names = [ch];
  names.forEach((n) => (keyEls[n] || []).forEach((el) => {
    el.classList.add('on');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('on'), 90);
  }));
  const primary = names[0] && keyEls[names[0]] && keyEls[names[0]][0];
  if (primary) {
    const conf = (0.35 + handRand() * 0.6).toFixed(7);
    if (primary.dataset.hand === 'L') els.handL.textContent = '[\'hand0:l\'] ' + conf + '  ' + JSON.stringify(ch);
    else els.handR.textContent = '[\'hand1:r\'] ' + conf + '  ' + JSON.stringify(ch);
  }
}

//
// Numeric twin + status bar.
//
const TWIN = [
  ['keystrokes', () => fmt(telemetry.ticks)],
  ['characters', () => fmt(telemetry.chars)],
  ['selectors', () => fmt(telemetry.selectors)],
  ['properties', () => fmt(telemetry.props)],
  ['rules', () => fmt(telemetry.rules)],
  ['comments', () => fmt(telemetry.comments)],
  ['elapsed', () => ((performance.now() - telemetry.started) / 1000).toFixed(1) + ' s'],
  ['reached', () => fmt(telemetry.ticks) + ' / ' + fmt(totalTicks)],
];

function buildHUD() {
  els.specimen = document.getElementById('specimen-canvas');
  els.section = document.getElementById('section-canvas');
  els.spine = document.getElementById('spine-canvas');
  els.spark = document.getElementById('spark-canvas');
  els.cuts = document.getElementById('cuts');
  els.echo = document.getElementById('echo');
  els.reticle = document.getElementById('reticle');
  els.pupil = document.getElementById('pupil');
  els.tether = document.querySelector('#tether line');
  els.stKeys = document.getElementById('st-keys');
  els.stRules = document.getElementById('st-rules');
  els.stRate = document.getElementById('st-rate');
  els.stMode = document.getElementById('st-mode');
  els.stEye = document.getElementById('st-eye');
  els.stChapter = document.getElementById('st-chapter');
  document.getElementById('card-date').textContent = '1:1 · ' + today.slice(5);
  document.getElementById('st-date').textContent = '→ ' + today.slice(5);

  const rows = document.getElementById('twin-rows');
  els.twin = TWIN.map(([label]) => {
    const row = document.createElement('div');
    row.className = 'twin-row';
    row.innerHTML = '<span>' + label + '</span><b></b>';
    rows.appendChild(row);
    return row.lastChild;
  });

  buildMask();
  buildKeyboard();
  setInterval(() => {
    telemetry.buckets.shift();
    telemetry.buckets.push(0);
  }, 1000);
}

let prevChar = '';
function onKeystroke(chars, isStyle, silent) {
  telemetry.ticks++;
  telemetry.chars += chars.length;
  telemetry.buckets[telemetry.buckets.length - 1]++;
  deposit(telemetry.ticks);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === '\n') telemetry.lines++;
    if (isStyle) {
      if (ch === '{') telemetry.selectors++;
      if (ch === ';') telemetry.props++;
      if (ch === '/' && prevChar === '*') telemetry.comments++;
      if (ch === '}') {
        telemetry.rules++;
        spawnCluster(telemetry.ticks / totalTicks, silent);
      }
    }
    prevChar = ch;
  }
  if (!silent) pressKey(chars[chars.length - 1 - Math.floor(handRand() * chars.length)]);
}

//
// The eye. Watches your cursor, lazily.
//
function trackEye(now) {
  const eyeBox = pgpEl.getBoundingClientRect();
  const cx = eyeBox.left + eyeBox.width / 2, cy = eyeBox.top + eyeBox.height / 2;
  const watching = eye.x >= 0 && now - eye.last < 2500;
  let nx = 0, ny = 0;
  if (watching) {
    const dx = eye.x - cx, dy = eye.y - cy;
    const d = Math.hypot(dx, dy) || 1;
    const reach = Math.min(1, d / 400);
    nx = (dx / d) * reach; ny = (dy / d) * reach;
  }
  const r = eyeBox.width * 0.3;
  els.pupil.style.left = (cx + nx * r) + 'px';
  els.pupil.style.top = (cy + ny * r) + 'px';

  if (eye.x >= 0) {
    els.reticle.style.left = eye.x + 'px';
    els.reticle.style.top = eye.y + 'px';
  }
  // The tether follows the elements themselves, so it lags along with them.
  const a = els.pupil.getBoundingClientRect(), b = els.reticle.getBoundingClientRect();
  els.tether.setAttribute('x1', a.left + a.width / 2);
  els.tether.setAttribute('y1', a.top + a.height / 2);
  els.tether.setAttribute('x2', b.left + b.width / 2);
  els.tether.setAttribute('y2', b.top + b.height / 2);
  els.tether.style.opacity = watching ? 1 : 0.25;

  const u = (v) => (0.5 + v / 2).toFixed(7);
  els.reticle.dataset.xy = '[\'pupil:u\'] ' + u(nx) + '\n' + u(ny) + '\n' + (watching ? 'lock' : 'None');
  els.stEye.textContent = watching ? 'tracking' : 'idle';
}

let lastTwin = 0;
function frame(now) {
  const p = palette();
  drawSpecimen(p);
  drawSection(p);
  drawSpine(p, now);
  drawSpark(p);
  trackEye(now);

  if (now - lastTwin > 100) {
    lastTwin = now;
    TWIN.forEach(([, fn], i) => (els.twin[i].textContent = fn()));
    const rate = telemetry.buckets.slice(-4, -1).reduce((a, b) => a + b, 0) / 3;
    els.stKeys.textContent = fmt(telemetry.ticks);
    els.stRules.textContent = fmt(telemetry.rules);
    els.stRate.textContent = rate.toFixed(0) + ' /s';
    const mode = paused ? 'paused' : telemetry.mode;
    els.stMode.textContent = (mode === 'typing' ? '● ' : '○ ') + mode;
    els.stMode.className = mode;
    els.stChapter.textContent = '/' + chapters[Math.min(cursor.chapter, chapters.length - 1)].name.replace(/\/$/, '') +
      '  [' + (cursor.chapter + 1) + '/' + chapters.length + ']';
    els.echo.textContent = mode === 'typing' ? 'echo typing' : 'echo at rest';
  }
  requestAnimationFrame(frame);
}
