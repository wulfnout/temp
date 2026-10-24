import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, useColorScheme, Platform } from 'react-native';

// Same backend as the website, so the app and the browser share one Temp.
export const SB_URL = 'https://izrtdycmvgqpitohdeog.supabase.co';
export const SB_KEY = 'sb_publishable_zm6EuiQhiR7qQYVIFA2Nhg_TxpdUnSd';

export const sb = createClient(SB_URL, SB_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false,
    // Android: serialize auth calls so session restore can't stall on start-up (iPhone keeps its current setup)
    ...(Platform.OS === 'android' && require('@supabase/supabase-js').processLock ? { lock: require('@supabase/supabase-js').processLock } : {}) },
});
AppState.addEventListener('change', (st) => {
  if (st === 'active') sb.auth.startAutoRefresh();
  else sb.auth.stopAutoRefresh();
});

/* ---------- look ---------- */
const LIGHT = { bg: '#eeedeb', card: '#ffffff', soft: '#f4f3f1', ink: '#0a0a0a', muted: '#7c7671', line: '#e2dfdb', orange: '#ff5500', orange2: '#ff8a2b', onOrange: '#ffffff', scrim: 'rgba(10,10,10,.45)' };
const DARK = { bg: '#000000', card: '#111111', soft: '#1c1c1c', ink: '#ffffff', muted: '#8d8883', line: '#252525', orange: '#ff5c0a', orange2: '#ff8f33', onOrange: '#ffffff', scrim: 'rgba(0,0,0,.66)' };
export const THEMES = {
  ember: ['#ff5500', '#ff8a2b'], blackout: ['#0a0a0a', '#3a3a3a'], inferno: ['#ff1f1f', '#ff7a00'], solar: ['#ff9500', '#ffc400'], blush: ['#ff4d6d', '#ff9f7a'], neon: ['#ff2bd6', '#ff8a2b'],
  volcano: ['#c1121f', '#ff4d00'], toxic: ['#5fd400', '#d4ff3a'], ocean: ['#0077ff', '#00d4c8'], grape: ['#7c3aed', '#d946ef'], sunset: ['#ff5e62', '#ffb347'],
  cyber: ['#00d9ff', '#ff00d4'], rust: ['#a63c06', '#e07a2f'], bubblegum: ['#ff5fa2', '#ffb3d9'],
  // glowing themes: accents light up
  pumpkin: ['#ff7518', '#ffb347'], witch: ['#8b2cff', '#39ff14'], bloodmoon: ['#b3001b', '#ff4d4d'],
  glowember: ['#ff5500', '#ffb37a'], glowneon: ['#ff2bd6', '#8a5cff'], radioactive: ['#39ff14', '#d4ff3a'], glowice: ['#00e5ff', '#a5f3ff'], plasma: ['#8b5cff', '#00d9ff'], molten: ['#ff2d00', '#ffd27a'],
};
export const GLOW = { witch: 1, bloodmoon: 1, glowember: 1, glowneon: 1, radioactive: 1, glowice: 1, plasma: 1, molten: 1 };
// mode: 'system' follows the phone's setting; 'light' or 'dark' overrides it (same setting as the website)
export function useColors(theme, mode) {
  const sys = useColorScheme();
  const dark = mode === 'dark' ? true : mode === 'light' ? false : sys === 'dark';
  const base = dark ? DARK : LIGHT;
  const t = THEMES[theme] || THEMES.ember;
  // Blackout (free): every accent is black, or white when the phone is in dark mode — logo included
  if (theme === 'blackout') return { ...base, orange: dark ? '#ffffff' : '#0a0a0a', orange2: dark ? '#cfcfcf' : '#3a3a3a', onOrange: dark ? '#000000' : '#ffffff', dark, glow: false, mono: true };
  return { ...base, orange: t[0], orange2: t[1], dark, glow: !!GLOW[theme] };
}
export const F = { display: 'Unbounded_800ExtraBold', displayB: 'Unbounded_700Bold', body: 'Figtree_500Medium', bold: 'Figtree_700Bold', heavy: 'Figtree_800ExtraBold' };

/* ---------- helpers ---------- */
export const HOUR = 3600e3, DAY = 24 * HOUR;
export const hashStr = (s) => [...String(s)].reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 7);
const PALETTE = ['#ff5500', '#0a0a0a', '#c2410c', '#2b2b2b', '#ff7a33', '#9a3412', '#1a1a1a', '#ea580c'];
export const colorFor = (id) => PALETTE[Math.abs(hashStr(id || 'x')) % PALETTE.length];
export const hms = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
export const ago = (ms) => { const m = Math.floor(ms / 60e3); if (m < 1) return 'now'; if (m < 60) return m + 'm'; const h = Math.floor(m / 60); if (h < 24) return h + 'h'; const d = Math.floor(h / 24); if (d < 7) return d + 'd'; return Math.floor(d / 7) + 'w'; };
export const kfmt = (n) => { n = n || 0; return n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.0', '') + 'K' : String(n); };
export const tempOf = (w) => 32 + ((w && w.heat) || 0) * 6 + ((w && w.viral) || 0) * 20;
// past Molten the thermometer stays full and changes colour as the heat keeps climbing, all the way to Supernova
const LEVELS = [[50,'Frozen',null],[80,'Cool',null],[110,'Warm',null],[150,'Hot',null],[190,'Scorching',null],[400,'Molten',null],
  [700,'Inferno',['#7a0000','#d10f0f','#ff3b2f'],'#ff3b2f'],[1100,'Plasma',['#b0105e','#ff2d8a','#ff9ccf'],'#ff4fa0'],
  [1700,'Ultraviolet',['#4a0fa8','#8a2bff','#d29bff'],'#b06bff'],[2500,'Blue Flame',['#0b3dbf','#2f7bff','#8ae6ff'],'#4fa8ff'],
  [4000,'White Dwarf',['#9fc4ff','#e6f0ff','#ffffff'],'#dbe8ff'],[1e12,'Supernova',['#ff2bd6','#ffffff','#2fe8ff'],'#ff7af0']];
export const tierOf = (d) => LEVELS.find(([m]) => d < m);
export const levelOf = (d) => tierOf(d)[1];
export function nextWeekStart() { const d = new Date(); const day = (d.getUTCDay() + 6) % 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 7); }
// dropped or cancelled requests (phone switching apps or networks) — not worth an error message
export function isNetErr(e) {
  const m = (e && (e.message || e.error_description)) || String(e || '');
  return /Failed to fetch|fetch failed|Network request failed|cancelled|canceled|aborted|AbortError|timed out|UnexpectedException|NSURLErrorDomain|network connection was lost/i.test(m);
}
export function friendly(e) {
  const m = (e && (e.message || e.error_description)) || String(e || 'Something went wrong.');
  if (/duplicate key|already exists/i.test(m)) return 'Already done.';
  if (/row-level security/i.test(m)) return 'You can’t do that here.';
  if (isNetErr(e)) return 'No connection. Try again.';
  return m.replace(/^.*?ERROR:\s*/, '');
}
export async function ok(p) { const { data, error } = await p; if (error) throw new Error(friendly(error)); return data; }

/* ---------- uploads ---------- */
export async function upload(uid, asset) {
  const mime = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
  const ext = (asset.fileName && asset.fileName.split('.').pop()) || mime.split('/')[1] || 'bin';
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext.toLowerCase()}`;
  const body = await (await fetch(asset.uri)).arrayBuffer();
  await ok(sb.storage.from('media').upload(path, body, { contentType: mime, upsert: false }));
  return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
}

/* ---------- shop catalog (prices are enforced by the database) ---------- */
export const STICKER_PACKS = {
  basic: ['🔥', '🧊', '😂', '💀', '👀', '🙏'], spicy: ['🌶️', '🥵', '🧯', '🫠', '🚒', '♨️'], cold: ['🥶', '❄️', '⛄', '🌨️', '🫥', '🧤'],
  chaos: ['🤡', '💅', '🗿', '🫡', '😤', '🧨'], royal: ['👑', '💎', '🏆', '🥇', '✨', '🦁'],
  temp: ['T|TEMP|o', 'T|HOT TAKE|f', 'T|COLD TAKE|c', 'T|FROZEN 🧊|i', 'T|GONE IN 24H|o', 'T|STILL HERE|w'],
  roast: ['T|SKILL ISSUE|o', 'T|WHO ASKED?|i', 'T|MID|w', 'T|RATIO|f', 'T|TOUCH GRASS|y', 'T|COPE|i', 'T|L + BOZO|o', 'T|SIT DOWN|w'],
  thermo: ['T|212°F|f', 'T|ROOM TEMP IQ|i', 'T|LUKEWARM|w', 'T|ABSOLUTE ZERO|c', 'T|FREEZER BURN|c', 'T|TOO HOT 4 U|o'],
  receipts: ['T|SCREENSHOTTED 📸|o', 'T|BRB FREEZING IT|i', 'T|SAY IT LOUDER|y', 'T|THIS AGED BADLY|w', 'T|BOLD OF YOU|p', 'T|RECEIPTS|o'],
  // Halloween (limited)
  spooky: ['🎃', '👻', '🦇', '🕷️', '🕸️', '💀'],
  boo: ['T|BOO!|o', 'T|TRICK OR TAKE|i', 'T|SPOOKY TAKE|w', 'T|DEAD WRONG 💀|y', 'T|THIS TAKE IS CURSED|f', 'T|GHOSTED 👻|c']
};
export const STICKER_COLORS = { o: ['#ff5500', '#fff'], f: ['#ff4d1a', '#fff'], i: ['#0a0a0a', '#ff7a33'], w: ['#ffffff', '#0a0a0a'], c: ['#dfe6eb', '#0a0a0a'], y: ['#ffd60a', '#0a0a0a'], p: ['#ff2bd6', '#fff'] };
