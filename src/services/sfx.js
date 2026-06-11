// =============================================================================
// sfx.js — tiny zero-dependency WebAudio synth (zzfx-spirited, hand-rolled).
//
// Every sound is described by a handful of params (freq, pitch slide, noise
// mix, decay) and rendered ONCE into a cached AudioBuffer on first play.
// UI-layer only: the sim communicates via the plain-data state.events queue
// (drained in main.js draw) and never imports this module, so headless runs
// stay silent and dependency-free. Mobile: call initAudio() from the first
// user gesture to unlock the context.
// =============================================================================

const MUTE_KEY = 'mazecore_sfx_muted_v1';
const VOICE_CAP = 8;          // simultaneous sounds
const NAME_THROTTLE_MS = 40;  // same sound can't restart faster than this

let actx = null;
let master = null;
let voices = 0;
let muted = false;
const buffers = new Map();
const lastAt = new Map();

try { muted = !!localStorage.getItem(MUTE_KEY); } catch { /* private mode */ }

// name -> synth params: f=start freq, slide=octaves/sec pitch slide,
// dur=seconds, nz=noise mix 0..1, vol=gain, curve=decay sharpness
const SFX = {
  shot_pierce: { f: 950, slide: -6, dur: 0.07, nz: 0.15, vol: 0.18, curve: 3 },
  shot_siege:  { f: 130, slide: -3, dur: 0.22, nz: 0.55, vol: 0.4,  curve: 4 },
  shot_magic:  { f: 620, slide: 3,  dur: 0.12, nz: 0.05, vol: 0.16, curve: 3 },
  shot_poison: { f: 330, slide: -2, dur: 0.1,  nz: 0.3,  vol: 0.16, curve: 3 },
  death:       { f: 400, slide: -5, dur: 0.22, nz: 0.45, vol: 0.24, curve: 4 },
  leak:        { f: 190, slide: -2, dur: 0.5,  nz: 0.2,  vol: 0.45, curve: 2 },
  build:       { f: 480, slide: 1.5, dur: 0.13, nz: 0.25, vol: 0.3, curve: 3 },
  sell:        { f: 740, slide: -3, dur: 0.16, nz: 0.05, vol: 0.24, curve: 3 },
  upgrade:     { f: 440, slide: 4,  dur: 0.22, nz: 0,    vol: 0.28, curve: 3 },
  horn:        { f: 196, slide: 0.6, dur: 0.55, nz: 0.04, vol: 0.4, curve: 2 },
  alarm:       { f: 320, slide: -0.5, dur: 0.4, nz: 0.15, vol: 0.42, curve: 1.6 },
  wallhit:     { f: 120, slide: -1, dur: 0.08, nz: 0.7,  vol: 0.2,  curve: 3 },
  walldown:    { f: 95,  slide: -2.5, dur: 0.45, nz: 0.8, vol: 0.5, curve: 3 },
  click:       { f: 1050, slide: -2, dur: 0.035, nz: 0.1, vol: 0.12, curve: 2 },
  cast:        { f: 520, slide: 5,  dur: 0.25, nz: 0.1,  vol: 0.3,  curve: 3 },
  win:         { f: 523, slide: 2,  dur: 0.7,  nz: 0,    vol: 0.4,  curve: 1.6 },
  lose:        { f: 233, slide: -3, dur: 0.9,  nz: 0.1,  vol: 0.4,  curve: 1.6 },
  reward:      { f: 880, slide: 1.8, dur: 0.35, nz: 0,   vol: 0.34, curve: 2 },
  levelup:     { f: 660, slide: 2.5, dur: 0.3,  nz: 0,   vol: 0.3,  curve: 2 },
};

function ensureCtx() {
  if (actx) return true;
  const AC = (typeof AudioContext !== 'undefined' && AudioContext) ||
    (typeof webkitAudioContext !== 'undefined' && webkitAudioContext) || null;
  if (!AC) return false;                       // headless / very old browser
  try {
    actx = new AC();
    master = actx.createGain();
    master.gain.value = 0.6;
    master.connect(actx.destination);
    return true;
  } catch { actx = null; return false; }
}

// Render a param set into a mono buffer (cached).
function bufferFor(name) {
  let b = buffers.get(name);
  if (b) return b;
  const p = SFX[name];
  if (!p) return null;
  const sr = actx.sampleRate;
  const n = Math.max(1, (p.dur * sr) | 0);
  b = actx.createBuffer(1, n, sr);
  const d = b.getChannelData(0);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = p.f * Math.pow(2, p.slide * t);
    phase += (2 * Math.PI * f) / sr;
    const tone = Math.sin(phase);
    const nz = p.nz ? (Math.random() * 2 - 1) : 0;
    const env = Math.pow(1 - i / n, p.curve);
    d[i] = (tone * (1 - p.nz) + nz * p.nz) * env * p.vol;
  }
  buffers.set(name, b);
  return b;
}

// Unlock/resume on the first user gesture (iOS requires this inside the
// gesture handler). Safe to call repeatedly.
export function initAudio() {
  if (!ensureCtx()) return;
  if (actx.state === 'suspended') actx.resume().catch(() => {});
}

export function play(name) {
  if (muted || voices >= VOICE_CAP) return;
  if (!ensureCtx() || actx.state !== 'running') return;
  const now = (typeof performance !== 'undefined' ? performance.now() : 0);
  if (now - (lastAt.get(name) || -1e9) < NAME_THROTTLE_MS) return;
  const buf = bufferFor(name);
  if (!buf) return;
  lastAt.set(name, now);
  const src = actx.createBufferSource();
  src.buffer = buf;
  src.connect(master);
  voices++;
  src.onended = () => { voices = Math.max(0, voices - 1); };
  try { src.start(); } catch { voices = Math.max(0, voices - 1); }
}

export function isMuted() { return muted; }
export function setMuted(b) {
  muted = !!b;
  try { muted ? localStorage.setItem(MUTE_KEY, '1') : localStorage.removeItem(MUTE_KEY); } catch { /* private mode */ }
}
export function toggleMuted() { setMuted(!muted); return muted; }
