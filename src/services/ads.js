// =============================================================================
// ads.js — rewarded-ads service with a pluggable provider.
//
// Today the provider is SIMULATED: a fullscreen fake 'video' overlay with a
// countdown; the close button only appears once it finishes, then the reward
// is granted. When the game ships through Capacitor, an AdMobProvider with
// the same ready()/show() shape replaces it and nothing else changes.
//
// Grants are wired ONLY in the UI layer (main.js actions + the defeat
// screen); the sim never imports this module, so headless runs can't earn.
// Cooldown for FREE_GOLD needs BOTH gates: waves elapsed this run (carried in
// the save snapshot) AND wall-clock minutes (localStorage, survives restarts).
// =============================================================================

import { CONFIG } from '../config.js';

const LS_KEY = 'mazecore_ads_v1';

function readLs() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch { return {}; }
}
function writeLs(obj) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch { /* private mode */ }
}

class SimulatedAdProvider {
  ready() { return typeof document !== 'undefined' && !!document.body; }

  // Resolves { completed: true } once the fake spot finishes and is closed.
  show(seconds) {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'ad-overlay';
      el.innerHTML = `
        <div class="ad-spot">
          <div class="ad-label">Ad</div>
          <div class="ad-creative">
            <div class="ad-fake-title">YOUR AD HERE</div>
            <div class="ad-fake-sub">simulated rewarded video</div>
          </div>
          <div class="ad-progress"><div class="ad-bar"></div></div>
          <button class="ad-close hidden">Claim reward ✓</button>
          <div class="ad-count">${seconds}</div>
        </div>`;
      document.body.appendChild(el);
      const bar = el.querySelector('.ad-bar');
      const count = el.querySelector('.ad-count');
      const close = el.querySelector('.ad-close');
      let left = seconds;
      bar.style.transition = `width ${seconds}s linear`;
      requestAnimationFrame(() => { bar.style.width = '100%'; });
      const iv = setInterval(() => {
        left -= 1;
        if (left > 0) { count.textContent = left; return; }
        clearInterval(iv);
        count.classList.add('hidden');
        close.classList.remove('hidden');
      }, 1000);
      close.addEventListener('click', () => {
        clearInterval(iv);
        el.remove();
        resolve({ completed: true });
      });
    });
  }
}

let provider = new SimulatedAdProvider();
export function setProvider(p) { provider = p; }   // AdMob swap-in point

export function providerReady() { return !!(provider && provider.ready()); }

export function grantAmount(key, state) {
  if (key === 'FREE_GOLD') {
    const c = CONFIG.ADS.FREE_GOLD;
    return Math.floor(c.base + c.perWave * state.wave);
  }
  return 0;
}

// FREE_GOLD readiness: both the wave gate and the wall-clock gate must pass.
export function isReady(key, state) {
  if (!providerReady()) return false;
  if (key === 'FREE_GOLD') {
    const c = CONFIG.ADS.FREE_GOLD;
    const wavesOk = (state.wave - (state.adFreeGoldWave ?? -999)) >= c.cooldownWaves;
    const at = readLs().freeGoldAt || 0;
    const clockOk = (Date.now() - at) >= c.cooldownMinutes * 60000;
    return wavesOk && clockOk;
  }
  if (key === 'REVIVE') return !state.reviveUsed;
  return false;
}

// Which gate is blocking, as player-facing text ('' when ready).
export function cooldownText(key, state) {
  if (key !== 'FREE_GOLD' || isReady(key, state)) return '';
  const c = CONFIG.ADS.FREE_GOLD;
  const wavesLeft = c.cooldownWaves - (state.wave - (state.adFreeGoldWave ?? -999));
  if (wavesLeft > 0) return `${wavesLeft} wave${wavesLeft === 1 ? '' : 's'}`;
  const msLeft = (readLs().freeGoldAt || 0) + c.cooldownMinutes * 60000 - Date.now();
  const s = Math.max(0, Math.ceil(msLeft / 1000));
  return `${(s / 60) | 0}:${String(s % 60).padStart(2, '0')}`;
}

// Play the ad; resolve { granted } and stamp the cooldown on completion.
export async function show(key, state) {
  if (!isReady(key, state)) return { granted: false };
  const res = await provider.show(CONFIG.ADS.SIM_SECONDS);
  if (!res || !res.completed) return { granted: false };
  if (key === 'FREE_GOLD') {
    state.adFreeGoldWave = state.wave;
    const ls = readLs();
    ls.freeGoldAt = Date.now();
    writeLs(ls);
  }
  return { granted: true };
}
