// Animated rings and headers. Everything runs off a few shared clocks on the native driver,
// so dozens of animated avatars in a feed cost almost nothing.
import React from 'react';
import { View, Text, Animated, Easing, StyleSheet, AppState } from 'react-native';
import { F } from './lib';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// Shared clocks. React Native stops a value's animation when the last view using it goes away
// (e.g. leaving the shop), so each clock notes when it stopped and gets restarted as soon as
// anything uses it again — on render, after mount, and by a light safety check every second.
const clocks = {};
function run(c, from = 0) {
  const id = (c.gen = (c.gen || 0) + 1); c.running = true; c.v.setValue(from);
  const loop = () => Animated.loop(Animated.timing(c.v, { toValue: 1, duration: c.ms, easing: Easing.linear, useNativeDriver: true })).start(() => { if (c.gen === id) c.running = false; });
  if (from <= 0.001) return loop();
  Animated.timing(c.v, { toValue: 1, duration: c.ms * (1 - from), easing: Easing.linear, useNativeDriver: true })
    .start(({ finished }) => { if (c.gen !== id) return; if (finished) { c.v.setValue(0); loop(); } else c.running = false; });
}
export function kickClocks() { Object.values(clocks).forEach((c) => { if (!c.running) { c.v.setValue(0); run(c); } }); }
// Views that mount while a native loop is already running can miss its updates (headers looked frozen
// after switching screens), so newly mounted effects restart every clock from where it is — no jump.
let lastForce = 0;
export function forceClocks() {
  const now = Date.now(); if (now - lastForce < 700) return; lastForce = now;
  Object.values(clocks).forEach((c) => c.v.stopAnimation((val) => run(c, typeof val === 'number' && val < 1 ? val : 0)));
}
setInterval(kickClocks, 1000);
AppState.addEventListener('change', (st) => { if (st === 'active') { lastForce = 0; setTimeout(forceClocks, 100); } });
const keepers = new Set(); const notify = () => keepers.forEach((f) => f());
export function clock(ms) {
  if (!clocks[ms]) { clocks[ms] = { v: new Animated.Value(0), ms, running: false }; run(clocks[ms]); setTimeout(notify, 0); }
  else if (!clocks[ms].running) run(clocks[ms]);
  return clocks[ms].v;
}
export function useClockKick() { React.useEffect(() => { const t = setTimeout(forceClocks, 60); return () => clearTimeout(t); }, []); }
// deterministic pseudo-random so effects look the same every render
function rng(seed) { let x = seed * 9301 + 49297; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; }

// value that runs from `a` to `b` once per clock cycle, offset by `ph` (0..1), wrapping around
function cycle(c, ph, a, b) {
  ph = Math.min(0.995, Math.max(0.005, ph));
  return c.interpolate({ inputRange: [0, 1 - ph, 1 - ph + 0.0001, 1], outputRange: [a + (b - a) * ph, b, a, a + (b - a) * ph] });
}
// jumpy random value: n steps per cycle between lo and hi
function jitter(c, seed, lo, hi, n = 10, hard) {
  const r = rng(seed); const inp = [], out = [];
  for (let i = 0; i <= n; i++) {
    const v = i === n ? out[0] : lo + (hi - lo) * r();
    if (hard && i > 0) { inp.push(i / n - 0.0001); out.push(out[out.length - 1]); }
    inp.push(i / n); out.push(v);
  }
  return c.interpolate({ inputRange: inp, outputRange: out });
}
const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
const clamp01 = (v) => v.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });

/* ---------------- rings ---------------- */
// value of fn(u) where u runs 0..1 once per clock cycle, shifted by phase ph (sampled, so any shape works)
function phased(c, ph, fn, steps = 16, unit) {
  const inp = [], out = [];
  for (let i = 0; i <= steps; i++) { const t = i / steps; inp.push(t); const v = fn((t + ph) % 1); out.push(unit ? v + unit : v); }
  return c.interpolate({ inputRange: inp, outputRange: out });
}
const lerp3 = (u, a, m, b, k = 0.55) => (u < k ? a + (m - a) * (u / k) : m + (b - m) * ((u - k) / (1 - k)));
// fire ring: soft glowing tongues of flame rise off the rim, burn out and are reborn, each on its own beat
export function FireRing({ size, children, bg }) {
  useClockKick();
  const cA = clock(1100), cB = clock(800), pulse = clock(1700), slow = clock(2400);
  const n = size < 40 ? 11 : size < 70 ? 15 : 20;
  const fs = Math.max(7, size * 0.27), r = size / 2 - fs * 0.12;
  const tongue = (k, i) => {
    const hot = k === 1; const c = hot ? cB : cA; const ph = ((i * 37 + k * 13) % 17) / 17;
    const ang = (360 / n) * (i + (hot ? 0.5 : 0)) + ((i * 53) % 7) - 3;
    const w = fs * (hot ? 0.8 : 1.2) * (0.8 + ((i * 29) % 10) / 25), h = w * 2.1; const sw = (((i * 11) % 5) - 2) * 2;
    const cols = hot ? ['rgba(255,45,0,0)', 'rgba(255,60,0,.8)', '#ff8a2b', '#ffd27a', '#fff6d6'] : ['rgba(150,10,0,0)', 'rgba(220,30,0,.8)', '#ff4a0a', '#ff6a1a', '#ffb347'];
    return (
      <View key={k + '-' + i} pointerEvents="none" style={{ position: 'absolute', left: size / 2 - w / 2, top: size / 2 - h / 2, width: w, height: h, transform: [{ rotate: ang + 'deg' }, { translateY: -(r + w * 1.15 - h / 2) }] }}>
        <Animated.View style={{ flex: 1, opacity: phased(c, ph, (u) => (u < 0.18 ? u / 0.18 : u < 0.55 ? 1 - (u - 0.18) * 0.13 : 0.95 * (1 - (u - 0.55) / 0.45))),
          transform: [{ translateY: phased(c, ph, (u) => lerp3(u, h * 0.25, -h * 0.08, -h * 0.42)) },
            { scaleX: phased(c, ph, (u) => lerp3(u, 0.5, 1, 0.35)) }, { scaleY: phased(c, ph, (u) => lerp3(u, 0.35, 1, 0.75)) },
            { rotate: phased(c, ph, (u) => lerp3(u, 0, sw, -sw * 2), 16, 'deg') }] }}>
          <View style={{ flex: 1, borderTopLeftRadius: w / 2, borderTopRightRadius: w / 2, borderBottomLeftRadius: w * 0.3, borderBottomRightRadius: w * 0.3, overflow: 'hidden', opacity: hot ? 0.95 : 0.85 }}>
            <LinearGradient colors={cols} locations={[0, 0.3, 0.55, 0.8, 1]} style={{ flex: 1 }} />
          </View>
        </Animated.View>
      </View>
    );
  };
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* soft breathing glow */}
      <Animated.View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: '#ff3d00',
        shadowColor: '#ff4a00', shadowOpacity: 0.85, shadowRadius: size * 0.18, shadowOffset: { width: 0, height: 0 },
        opacity: phased(pulse, 0, (u) => 0.7 + 0.3 * Math.sin(u * Math.PI * 2) ** 2), transform: [{ scale: phased(pulse, 0, (u) => 1 + 0.04 * Math.sin(u * Math.PI * 2)) }] }} />
      {Array.from({ length: n }).map((_, i) => tongue(0, i))}
      {Array.from({ length: n }).map((_, i) => tongue(1, i))}
      {/* hot rim */}
      <Animated.View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, overflow: 'hidden',
        transform: [{ rotate: slow.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
        <LinearGradient colors={['#ff2d00', '#ffd27a', '#ff8a2b', '#ff2d00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
      </Animated.View>
      <View style={{ padding: 1, borderRadius: size, backgroundColor: bg }}>{children}</View>
    </View>
  );
}

export function GlitchRing({ size, children, bg }) {
  useClockKick();
  const c = clock(1100), c2 = clock(1700);
  const bw = Math.max(2, size * 0.06);
  const ring = (color, dx, dy, op) => <Animated.View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: bw, borderColor: color, opacity: op,
    transform: [{ translateX: dx }, { translateY: dy }] }} />;
  const bars = size < 40 ? 2 : 4;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <LinearGradient colors={['#ff2d55', '#0a0a0a', '#00e5ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2 }} />
      <View style={{ padding: 1, borderRadius: size, backgroundColor: bg }}>{children}</View>
      {/* split color channels jumping around */}
      {ring('#00e5ff', jitter(c, 11, -size * 0.06, size * 0.06, 12, true), jitter(c, 12, -size * 0.03, size * 0.03, 12, true), jitter(c, 21, 0.4, 0.95, 12, true))}
      {ring('#ff2d55', jitter(c2, 31, -size * 0.06, size * 0.06, 12, true), jitter(c2, 32, -size * 0.03, size * 0.03, 12, true), jitter(c2, 41, 0.4, 0.95, 12, true))}
      {/* torn scanline slices */}
      {Array.from({ length: bars }).map((_, i) => {
        const r = rng(i * 17 + 3);
        return <Animated.View key={i} pointerEvents="none" style={{ position: 'absolute', left: -size * 0.06, top: size * (0.1 + r() * 0.8), width: size * (0.5 + r() * 0.6), height: Math.max(1.5, size * (0.03 + r() * 0.05)),
          backgroundColor: ['#00e5ff', '#ff2d55', '#ffffff', '#00e5ff'][i % 4],
          opacity: clamp01(jitter(i % 2 ? c : c2, i * 7 + 50, -1.2, 0.9, 14, true)),
          transform: [{ translateX: jitter(i % 2 ? c2 : c, i * 9 + 60, 0, size * 0.55, 14, true) }] }} />;
      })}
    </View>
  );
}

// Mounted once at the app root: holds an invisible view on every animation clock, so leaving a screen
// (like Fire Sale) never stops the shared clocks and headers/rings never come back frozen.
export function ClockKeeper() {
  const [, bump] = React.useState(0);
  React.useEffect(() => { const f = () => bump((x) => x + 1); keepers.add(f); f(); return () => keepers.delete(f); }, []);
  return <View pointerEvents="none" style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}>
    {Object.values(clocks).map((c) => <Animated.View key={'n' + c.ms} style={{ width: 0, height: 0, opacity: c.v.interpolate({ inputRange: [0, 1], outputRange: [0, 0] }) }} />)}
    {Object.entries(jsClocks).map(([ms, v]) => <Animated.View key={'j' + ms} style={{ width: 0, height: 0, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 0] }) }} />)}
  </View>;
}

// Ice, Gold, Temp+ and other rings: a multi-colour band that keeps spinning, like the website
const SPIN = { ice: ['#ffffff', '#cfd8de', '#7f95a6', '#ffffff'], gold: ['#ffd700', '#fff4b0', '#b98900', '#ffd700'], plus: ['#0a0a0a', '#ff5500', '#0a0a0a', '#ff5500'] };
export function SpinRing({ size, ring, bg, accent, children }) {
  useClockKick();
  const c = clock(ring === 'ice' ? 4000 : 3000);
  const cols = SPIN[ring] || [accent[0], accent[1], '#ffd27a', accent[0]];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: size * 1.45, height: size * 1.45, transform: [{ rotate: c.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
        <LinearGradient colors={cols} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
      </Animated.View>
      <View style={{ padding: 1, borderRadius: size, backgroundColor: bg }}>{children}</View>
    </View>
  );
}

/* ---- Morph ring: the whole picture moves like liquid, like the story circles ---- */
const jsClocks = {};
export function jsClock(ms) { // corner shapes can't run on the native driver, so this one ticks in JS
  if (!jsClocks[ms]) { const v = new Animated.Value(0); jsClocks[ms] = v; setTimeout(notify, 0); Animated.loop(Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: false })).start(); }
  return jsClocks[ms];
}
export function MorphRing({ size, bg, children }) {
  useClockKick();
  const c = clock(3600), r = jsClock(6000);
  const corner = (ph, k) => r.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 1, 2, 3, 4].map((i) => size * k * (0.5 + 0.13 * Math.sin((i / 4 + ph) * Math.PI * 2))) });
  const radii = (k) => ({ borderTopLeftRadius: corner(0, k), borderTopRightRadius: corner(0.27, k), borderBottomRightRadius: corner(0.55, k), borderBottomLeftRadius: corner(0.8, k) });
  const inner = size - 6;
  return (
    <Animated.View style={{ width: size, height: size, transform: [
      { scaleX: c.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 1.06, 0.97, 1.03, 1] }) },
      { scaleY: c.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 0.95, 1.05, 0.98, 1] }) },
      { rotate: c.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-4deg', '4deg', '-4deg'] }) }] }}>
      <Animated.View style={[{ width: size, height: size, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, radii(1)]}>
        <Animated.View style={{ position: 'absolute', width: size * 1.5, height: size * 1.5, transform: [{ rotate: c.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
          <LinearGradient colors={['#ff5500', '#ff8a2b', '#ffd27a', '#ff2d55']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
        </Animated.View>
        <Animated.View style={[{ width: size - 4, height: size - 4, backgroundColor: bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, radii((size - 4) / size)]}>
          <Animated.View style={[{ width: inner, height: inner, overflow: 'hidden' }, radii(inner / size)]}>{children(inner)}</Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/* ---------------- headers ---------------- */
// colours for every header; the ones listed in ANIM also get motion
export const HEADER_FX = { lava: ['#ffd27a', '#ff2d00', '#0a0a0a'], aurora: ['#0a0a0a', '#ff5500', '#ffd27a'], static: ['#151515', '#ff5500'], embers: ['#0a0a0a', '#3a1204'],
  templogo: ['#0a0a0a', '#1a0a03'], hazard: ['#ff5500', '#0a0a0a'], sunburst: ['#ffd27a', '#ff5500'], snow: ['#1b2430', '#6c8194'], thermal: ['#2b00a8', '#c4007a', '#ff5500', '#ffe14d'], disco: ['#2a1206', '#ff2bd6', '#0a0a0a'],
  checker: ['#ff5500', '#0a0a0a'], synth: ['#14002e', '#4a0060', '#ff2bd6'], rain: ['#0a0a0a', '#ff5500'],
  wildfire: ['#0a0a0a', '#3a0d02', '#ff3d00'], heatwave: ['#ff2d00', '#ff8a2b', '#ffd27a'], blizzard: ['#0e1620', '#3b5163', '#9fb4c4'], glitchtv: ['#050505', '#141414'],
  starfield: ['#03010a', '#14002e', '#3a0a4a'], lavalamp: ['#1a0303', '#3a0a02', '#0a0a0a'] };

function Pan({ cols }) { // oversized gradient sliding back and forth
  const c = clock(9000);
  return <Animated.View style={{ position: 'absolute', top: -20, bottom: -20, left: '-60%', width: '220%', transform: [{ translateX: c.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-60, 60, -60] }) }] }}>
    <LinearGradient colors={[...cols, ...cols.slice().reverse()]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} /></Animated.View>;
}
function Particles({ n, seed, ms, color, w, h, rise, drift = 0, len = 0, round = true, glow }) {
  const c = clock(ms);
  return Array.from({ length: n }).map((_, i) => {
    const r = rng(seed + i * 31); const x = r() * 100, ph = r(), sz = w * (0.5 + r());
    const y = rise ? cycle(c, ph, 280, -30) : cycle(c, ph, -30, 280);
    return <Animated.View key={i} pointerEvents="none" style={{ position: 'absolute', left: x + '%', top: 0, width: sz, height: len ? sz * len : sz, borderRadius: round ? sz : 1, backgroundColor: Array.isArray(color) ? color[i % color.length] : color,
      opacity: 0.35 + r() * 0.6, shadowColor: glow, shadowOpacity: glow ? 1 : 0, shadowRadius: glow ? 6 : 0,
      transform: [{ translateY: y }, { translateX: drift ? cycle(c, ph, -drift / 2, drift / 2) : 0 }] }} />;
  });
}
function Flames({ seed }) {
  const c = clock(800);
  return <>{Array.from({ length: 13 }).map((_, i) => { const r = rng(seed + i * 7); const sz = 60 + r() * 70;
    return <Animated.View key={i} pointerEvents="none" style={{ position: 'absolute', bottom: -sz * 0.18, left: (i / 12) * 100 - 8 + '%', opacity: jitter(c, i * 3 + 1, 0.6, 1, 6),
      transform: [{ scaleY: jitter(c, i * 5 + 2, 0.75, 1.3, 6) }, { translateY: jitter(c, i * 11 + 4, 0, -12, 6) }] }}>
      <Ionicons name="flame" size={sz} color={['#ff2d00', '#ff8a2b', '#ffd27a', '#ff5500'][i % 4]} /></Animated.View>; })}</>;
}
function Twinkle({ n, seed, color = '#fff' }) {
  const c = clock(2600);
  return Array.from({ length: n }).map((_, i) => { const r = rng(seed + i * 13); const sz = 1.5 + r() * 2.5;
    return <Animated.View key={i} pointerEvents="none" style={{ position: 'absolute', left: r() * 100 + '%', top: r() * 100 + '%', width: sz, height: sz, borderRadius: sz, backgroundColor: color,
      opacity: jitter(c, i * 5 + seed, 0.1, 1, 5) }} />; });
}
function GlitchBars({ seed }) {
  const c = clock(1300), c2 = clock(700);
  return <>{Array.from({ length: 9 }).map((_, i) => { const r = rng(seed + i * 19);
    return <Animated.View key={i} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: r() * 100 + '%', height: 3 + r() * 16,
      backgroundColor: ['#00e5ff', '#ff2d55', '#ffffff', '#ff5500', '#00e5ff'][i % 5], opacity: clamp01(jitter(i % 2 ? c : c2, i * 7, -1, 0.85, 12, true)),
      transform: [{ translateX: jitter(i % 2 ? c2 : c, i * 3 + 1, -80, 80, 12, true) }] }} />; })}
    {Array.from({ length: 30 }).map((_, i) => <View key={'s' + i} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: i * 8, height: 1, backgroundColor: 'rgba(255,255,255,.05)' }} />)}</>;
}
function Blobs({ seed }) {
  const c = clock(14000);
  return Array.from({ length: 6 }).map((_, i) => { const r = rng(seed + i * 23); const sz = 70 + r() * 90; const ph = r();
    return <Animated.View key={i} pointerEvents="none" style={{ position: 'absolute', left: r() * 85 + '%', top: 0, width: sz, height: sz, borderRadius: sz / 2,
      backgroundColor: ['#ff3d00', '#ff8a2b', '#ff2d55', '#ffb347'][i % 4], opacity: 0.85,
      transform: [{ translateY: cycle(c, ph, 280, -sz) }, { scaleX: jitter(clock(3000), i + 3, 0.85, 1.15, 4) }, { scaleY: jitter(clock(3000), i + 9, 0.85, 1.15, 4) }] }} />; });
}
function Waves() {
  const c = clock(3200);
  return Array.from({ length: 7 }).map((_, i) => <Animated.View key={i} pointerEvents="none" style={{ position: 'absolute', left: '-20%', width: '140%', top: 0, height: 26, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,.16)', transform: [{ translateY: cycle(c, i / 7, 280, -40) }, { translateX: cycle(clock(1600), (i * 0.37) % 1, -20, 20) }, { skewY: '-4deg' }] }} />);
}

/* ---- drawn headers (match the website's art) ---- */
const spin = (c) => c.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
// wedges fanning out from a point (sunburst rays, disco beams)
function Rays({ cx = '50%', cy = '50%', list, len = 700, c }) {
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', left: cx, top: cy, width: 0, height: 0, transform: c ? [{ rotate: spin(c) }] : [] }}>
    {list.map(([ang, deg, color], i) => { const half = Math.tan((deg / 2) * Math.PI / 180) * len;
      return <View key={i} style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, transform: [{ rotate: ang + 'deg' }] }}>
        <View style={{ position: 'absolute', left: -half, top: 0, width: 0, height: 0, borderLeftWidth: half, borderRightWidth: half, borderBottomWidth: len,
          borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }} /></View>; })}
  </Animated.View>;
}
function Hazard() {
  const c = clock(1100);
  return <View style={[fill, { backgroundColor: '#0a0a0a', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }]}>
    <Animated.View style={{ width: 1100, height: 1100, flexDirection: 'row', transform: [{ rotate: '-45deg' }, { translateX: c.interpolate({ inputRange: [0, 1], outputRange: [0, -44] }) }] }}>
      {Array.from({ length: 26 }).map((_, i) => <View key={i} style={{ width: 22, marginRight: 22, backgroundColor: '#ff5500' }} />)}
    </Animated.View></View>;
}
function Checker() {
  const c = clock(1600); const q = 20;
  return <View style={[fill, { backgroundColor: '#ff5500', overflow: 'hidden' }]}>
    <Animated.View style={{ position: 'absolute', left: -2 * q, top: -2 * q, transform: [{ translateX: c.interpolate({ inputRange: [0, 1], outputRange: [0, 2 * q] }) }, { translateY: c.interpolate({ inputRange: [0, 1], outputRange: [0, 2 * q] }) }] }}>
      {Array.from({ length: 18 }).map((_, r) => <View key={r} style={{ flexDirection: 'row', marginLeft: r % 2 ? q : 0 }}>
        {Array.from({ length: 16 }).map((_, k) => <View key={k} style={{ width: q, height: q, marginRight: q, backgroundColor: '#0a0a0a' }} />)}</View>)}
    </Animated.View></View>;
}
function Sunburst() {
  const rays = Array.from({ length: 20 }, (_, i) => [i * 18, 9, '#ffd27a']);
  return <View style={[fill, { backgroundColor: '#ff5500', overflow: 'hidden' }]}><Rays list={rays} c={clock(14000)} /></View>;
}
function Disco() {
  const beams = [[22, 8, 'rgba(255,85,0,.7)'], [82, 8, 'rgba(255,210,122,.6)'], [154, 8, 'rgba(255,43,214,.55)'], [226, 8, 'rgba(0,229,255,.5)'], [296, 8, 'rgba(255,255,255,.55)']];
  return <View style={[fill, { overflow: 'hidden' }]}>
    <LinearGradient colors={['#2a1206', '#0a0a0a']} start={{ x: 0.5, y: 0.2 }} end={{ x: 0.5, y: 1 }} style={fill} />
    <Rays cy="30%" list={beams} c={clock(5000)} />
    <View style={{ position: 'absolute', left: '50%', top: '30%', width: 14, height: 14, marginLeft: -7, marginTop: -7, borderRadius: 7, backgroundColor: '#fff', shadowColor: '#fff', shadowOpacity: 1, shadowRadius: 8 }} />
    <Twinkle n={22} seed={8} color="#ffd27a" /></View>;
}
function Synth() {
  const c = clock(800); const [h, setH] = React.useState(180); const sz = Math.round(Math.min(96, h * 0.42)); const bars = [[0.58, 0.05], [0.72, 0.06], [0.86, 0.06]];
  const lines = [-7, -5, -3.5, -2, -1, 0, 1, 2, 3.5, 5, 7];
  return <View onLayout={(e) => setH(e.nativeEvent.layout.height)} style={[fill, { backgroundColor: '#14002e', overflow: 'hidden' }]}>
    <LinearGradient colors={['#14002e', '#4a0060']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '52%' }} />
    <View style={{ position: 'absolute', top: h * 0.52 - sz * 0.92, left: '50%', marginLeft: -sz / 2, width: sz, height: sz, borderRadius: sz / 2, overflow: 'hidden' }}>
      <LinearGradient colors={['#ffd27a', '#ff5500', '#ff2bd6']} locations={[0, 0.55, 1]} style={{ flex: 1 }} />
      {bars.map(([y, bh], i) => <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: y * sz, height: bh * sz, backgroundColor: '#3a0050' }} />)}
    </View>
    <View style={{ position: 'absolute', left: 0, right: 0, top: '52%', bottom: 0, overflow: 'hidden', backgroundColor: '#14002e' }}>
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: -18, bottom: 0, transform: [{ translateY: c.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }) }] }}>
        {Array.from({ length: 12 }).map((_, i) => <View key={i} style={{ height: 1.5, marginBottom: 16.5, backgroundColor: '#ff2bd6', opacity: 0.35 + i * 0.06 }} />)}
      </Animated.View>
      {lines.map((k, i) => <View key={'v' + i} style={{ position: 'absolute', left: '50%', top: 0, width: 1.5, height: 260, marginLeft: k * 26, backgroundColor: '#ff2bd6', opacity: 0.8,
        transform: [{ translateX: 0 }, { rotate: (-k * 8) + 'deg' }], transformOrigin: 'top' }} />)}
    </View>
    <View style={{ position: 'absolute', left: 0, right: 0, top: '52%', height: 2, backgroundColor: '#ff2bd6' }} />
    <Twinkle n={16} seed={5} color="#ff9cf2" /></View>;
}
function Thermal() {
  const c = clock(4500);
  const rings = ['#000000', '#14004a', '#2b00a8', '#6a0096', '#c4007a', '#e8204a', '#ff5500', '#ff9a2a', '#ffe14d', '#fff6c2', '#ffffff'];
  return <View style={[fill, { backgroundColor: '#000', overflow: 'hidden' }]}>
    <Animated.View style={{ position: 'absolute', left: '30%', top: '55%', width: 0, height: 0,
      transform: [{ translateX: c.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-30, 40, -30] }) }, { translateY: c.interpolate({ inputRange: [0, 0.5, 1], outputRange: [10, -20, 10] }) },
        { scale: c.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 1] }) }] }}>
      {rings.map((col, i) => { const r = 520 * Math.pow(1 - i / rings.length, 1.6) + 6; return <View key={i} style={{ position: 'absolute', left: -r, top: -r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: col, opacity: i ? 0.9 : 1 }} />; })}
    </Animated.View></View>;
}

/* ---- headers, round 2 ---- */
const useBox = () => { const [b, setB] = React.useState({ w: 360, h: 200 }); return [b, (e) => { const { width, height } = e.nativeEvent.layout; if (width && height && (Math.abs(width - b.w) > 1 || Math.abs(height - b.h) > 1)) setB({ w: width, h: height }); }]; };
const sway = (c, ph, amp) => c.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1].map((x) => x), outputRange: [0, 1, 0, -1, 0].map((k, i) => amp * Math.sin(((i / 4) + ph) * Math.PI * 2)) });

// Disco Inferno: a mirror ball hangs from the top and throws spinning coloured beams and light spots around a dark club
function Disco2() {
  const [b, onL] = useBox(); const c = clock(6000), c2 = clock(2600);
  const cols = ['#ff5500', '#ff2bd6', '#00e5ff', '#ffd27a', '#ffffff', '#ff2d55', '#8a5cff', '#22ff88'];
  const cx = b.w / 2, cy = b.h * 0.3;
  return <View onLayout={onL} style={[fill, { overflow: 'hidden', backgroundColor: '#07030c' }]}>
    <LinearGradient colors={['#1a0820', '#07030c', '#2a0d05']} style={fill} />
    {/* coloured spots sweeping over the walls */}
    {Array.from({ length: 10 }).map((_, i) => { const r = rng(90 + i); const s = 30 + r() * 40; const ph = r();
      return <Animated.View key={'s' + i} style={{ position: 'absolute', left: 0, top: 0, width: s, height: s * 0.6, borderRadius: s, backgroundColor: cols[i % cols.length], opacity: 0.35,
        transform: [{ translateX: cycle(c, ph, -60, b.w + 20) }, { translateY: b.h * (0.15 + r() * 0.75) }] }} />; })}
    {/* beams */}
    <Animated.View style={{ position: 'absolute', left: cx, top: cy, width: 0, height: 0, transform: [{ rotate: spin(c) }] }}>
      {cols.map((col, i) => <View key={i} style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, transform: [{ rotate: (i * 45 + 10) + 'deg' }] }}>
        <LinearGradient colors={[col, 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', left: 0, top: -7, width: Math.max(b.w, 400), height: 14, opacity: 0.55 }} /></View>)}
    </Animated.View>
    {/* the ball */}
    <View style={{ position: 'absolute', left: cx - 1, top: 0, width: 2, height: cy - 16, backgroundColor: '#555' }} />
    <View style={{ position: 'absolute', left: cx - 17, top: cy - 17, width: 34, height: 34, borderRadius: 17, overflow: 'hidden', backgroundColor: '#cfcfcf', shadowColor: '#fff', shadowOpacity: 0.9, shadowRadius: 12 }}>
      <Animated.View style={{ position: 'absolute', left: -34, top: 0, flexDirection: 'row', transform: [{ translateX: c2.interpolate({ inputRange: [0, 1], outputRange: [0, 34] }) }] }}>
        {Array.from({ length: 12 }).map((_, i) => <View key={i}>{Array.from({ length: 6 }).map((_, k) => <View key={k} style={{ width: 6, height: 6, margin: 0.4, backgroundColor: (i + k) % 3 ? '#e9e9e9' : (i + k) % 2 ? '#8a8a8a' : '#ffffff' }} />)}</View>)}
      </Animated.View>
    </View>
    <Twinkle n={26} seed={8} color="#ffffff" />
  </View>;
}

// Night Drive: a car rolling along a road at eye level, hills and a big moon behind it
function NightDrive() {
  const [b, onL] = useBox(); const road = clock(900), hills = clock(16000), bob = clock(700), wheel = clock(500);
  const gy = b.h * 0.78; const carW = Math.min(150, b.w * 0.42), carX = b.w * 0.3;
  return <View onLayout={onL} style={[fill, { overflow: 'hidden' }]}>
    <LinearGradient colors={['#03010d', '#0d1030', '#1d1640']} style={fill} />
    <Twinkle n={45} seed={15} />
    {/* moon */}
    <View style={{ position: 'absolute', right: b.w * 0.12, top: b.h * 0.1, width: b.h * 0.42, height: b.h * 0.42, borderRadius: b.h, backgroundColor: '#f4f0dc', shadowColor: '#fff6d0', shadowOpacity: 0.9, shadowRadius: 28 }}>
      {[[0.25, 0.3, 0.16], [0.55, 0.5, 0.12], [0.4, 0.68, 0.09]].map(([x, y, s], i) => <View key={i} style={{ position: 'absolute', left: x * b.h * 0.42, top: y * b.h * 0.42, width: s * b.h, height: s * b.h, borderRadius: b.h, backgroundColor: '#dcd6bd' }} />)}
    </View>
    {/* hills drifting slowly */}
    <Animated.View style={{ position: 'absolute', left: 0, top: gy - b.h * 0.22, flexDirection: 'row', transform: [{ translateX: hills.interpolate({ inputRange: [0, 1], outputRange: [0, -b.w] }) }] }}>
      {Array.from({ length: 8 }).map((_, i) => <View key={i} style={{ width: b.w / 3, height: b.h * 0.22 + (i % 2) * 14, marginTop: (i % 2) ? -14 : 0, borderTopLeftRadius: b.w / 4, borderTopRightRadius: b.w / 5, backgroundColor: '#0b0920', marginRight: -b.w / 12 }} />)}
    </Animated.View>
    {/* road with lane dashes sliding past */}
    <View style={{ position: 'absolute', left: 0, right: 0, top: gy, bottom: 0, backgroundColor: '#15131c' }} />
    <Animated.View style={{ position: 'absolute', left: 0, top: gy + (b.h - gy) / 2 - 1.5, flexDirection: 'row', transform: [{ translateX: road.interpolate({ inputRange: [0, 1], outputRange: [0, -60] }) }] }}>
      {Array.from({ length: Math.ceil(b.w / 60) + 2 }).map((_, i) => <View key={i} style={{ width: 30, height: 3, marginRight: 30, backgroundColor: '#ffd27a', opacity: 0.8 }} />)}
    </Animated.View>
    {/* the car */}
    <Animated.View style={{ position: 'absolute', left: carX, top: gy - carW * 0.36, width: carW, height: carW * 0.4, transform: [{ translateY: bob.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -1.5, 0] }) }] }}>
      <LinearGradient colors={['rgba(255,240,180,.45)', 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', left: carW * 0.95, top: carW * 0.12, width: carW * 0.9, height: carW * 0.14, borderRadius: 20 }} />
      <View style={{ position: 'absolute', left: carW * 0.22, top: 0, width: carW * 0.5, height: carW * 0.2, borderTopLeftRadius: carW * 0.14, borderTopRightRadius: carW * 0.1, backgroundColor: '#ff5500' }}>
        <View style={{ position: 'absolute', left: carW * 0.05, top: carW * 0.04, width: carW * 0.17, height: carW * 0.12, borderTopLeftRadius: carW * 0.08, backgroundColor: '#7fb2ff', opacity: 0.85 }} />
        <View style={{ position: 'absolute', left: carW * 0.25, top: carW * 0.04, width: carW * 0.19, height: carW * 0.12, borderTopRightRadius: carW * 0.07, backgroundColor: '#7fb2ff', opacity: 0.85 }} />
      </View>
      <View style={{ position: 'absolute', left: 0, top: carW * 0.17, width: carW, height: carW * 0.15, borderRadius: carW * 0.06, borderTopRightRadius: carW * 0.12, backgroundColor: '#ff5500' }}>
        <View style={{ position: 'absolute', right: 2, top: carW * 0.03, width: carW * 0.06, height: carW * 0.04, borderRadius: 3, backgroundColor: '#fff6c2', shadowColor: '#fff6c2', shadowOpacity: 1, shadowRadius: 8 }} />
        <View style={{ position: 'absolute', left: 1, top: carW * 0.03, width: carW * 0.04, height: carW * 0.04, borderRadius: 2, backgroundColor: '#ff2d2d', shadowColor: '#ff2d2d', shadowOpacity: 1, shadowRadius: 6 }} />
      </View>
      {[0.2, 0.78].map((x, i) => <Animated.View key={i} style={{ position: 'absolute', left: carW * x - carW * 0.09, top: carW * 0.24, width: carW * 0.18, height: carW * 0.18, borderRadius: carW, backgroundColor: '#111', borderWidth: 3, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: spin(wheel) }] }}>
        <View style={{ width: '70%', height: 2, backgroundColor: '#888' }} /><View style={{ position: 'absolute', width: 2, height: '70%', backgroundColor: '#888' }} /></Animated.View>)}
    </Animated.View>
  </View>;
}

// Blizzard: masses of tiny flakes blowing sideways in gusts
function Blizzard() {
  const [b, onL] = useBox(); const c = clock(1700), g = clock(4200);
  return <View onLayout={onL} style={[fill, { overflow: 'hidden' }]}>
    <LinearGradient colors={['#0e1620', '#3b5163', '#9fb4c4']} style={fill} />
    <Animated.View style={[fill, { transform: [{ translateX: sway(g, 0, 18) }] }]}>
      {Array.from({ length: 140 }).map((_, i) => { const r = rng(300 + i); const s = 1.2 + r() * 2.4; const ph = r(); const x = r() * (b.w + 120) - 20;
        return <Animated.View key={i} style={{ position: 'absolute', left: 0, top: 0, width: s, height: s, borderRadius: s, backgroundColor: '#fff', opacity: 0.5 + r() * 0.5,
          transform: [{ translateX: cycle(c, ph, x, x - 110) }, { translateY: cycle(c, ph, -10, b.h + 10) }] }} />; })}
    </Animated.View>
  </View>;
}

// Snowstorm: flakes of every size and shape falling over the whole header
function Snowstorm() {
  const [b, onL] = useBox(); const c = clock(7000), w = clock(3000);
  return <View onLayout={onL} style={[fill, { overflow: 'hidden' }]}>
    <LinearGradient colors={['#1b2430', '#3e5266', '#6c8194']} style={fill} />
    {Array.from({ length: 64 }).map((_, i) => { const r = rng(500 + i); const kind = i % 4; const s = kind === 0 ? 10 + r() * 14 : kind === 1 ? 4 + r() * 5 : 2 + r() * 3; const ph = r(); const x = r() * b.w;
      const spd = 0.6 + r() * 0.8;
      return <Animated.View key={i} style={{ position: 'absolute', left: x, top: 0, opacity: 0.6 + r() * 0.4,
        transform: [{ translateY: cycle(clock(Math.round(7000 / spd / 100) * 100), ph, -30, b.h + 20) }, { translateX: sway(w, r(), 6 + r() * 10) }, { rotate: spin(c) }] }}>
        {kind === 0 ? <Ionicons name="snow" size={s} color="#ffffff" /> : <View style={{ width: s, height: kind === 3 ? s * 0.7 : s, borderRadius: s, backgroundColor: '#fff' }} />}</Animated.View>; })}
  </View>;
}

// Lava Lamp: blobs that rise, stretch, wobble and sink back like real lamp wax
function LavaLamp() {
  const [b, onL] = useBox();
  return <View onLayout={onL} style={[fill, { overflow: 'hidden' }]}>
    <LinearGradient colors={['#2b0a3d', '#5a0b2a', '#2a0505']} style={fill} />
    <LinearGradient colors={['rgba(255,140,40,.35)', 'transparent']} start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0.3 }} style={fill} />
    {Array.from({ length: 7 }).map((_, i) => { const r = rng(700 + i); const s = 38 + r() * 46; const up = clock(15000 + i * 2500); const wob = clock(3600 + i * 400); const ph = r(); const x = (0.08 + 0.13 * i + r() * 0.05) * b.w;
      const y = up.interpolate({ inputRange: [0, 0.5, 1], outputRange: [b.h - s * 0.4, -s * 0.3, b.h - s * 0.4] });
      return <Animated.View key={i} style={{ position: 'absolute', left: x, top: 0, width: s, height: s, borderRadius: s, backgroundColor: ['#ff5a1a', '#ff2d55', '#ff8a2b', '#ff3d6e'][i % 4],
        shadowColor: '#ff5500', shadowOpacity: 0.8, shadowRadius: 14,
        transform: [{ translateY: y }, { translateX: sway(wob, ph, 10) },
          { scaleY: up.interpolate({ inputRange: [0, 0.12, 0.25, 0.5, 0.62, 0.75, 1], outputRange: [0.8, 1.45, 1.1, 0.85, 1.4, 1.05, 0.8] }) },
          { scaleX: wob.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1.1, 0.85, 1.1] }) }] }}>
        <View style={{ position: 'absolute', left: s * 0.18, top: s * 0.14, width: s * 0.28, height: s * 0.2, borderRadius: s, backgroundColor: 'rgba(255,230,180,.45)' }} /></Animated.View>; })}
  </View>;
}

// Rain: straight lines of rain all falling together
function Rain() {
  const [b, onL] = useBox(); const c = clock(520); const cell = 60;
  const cols = Math.ceil((b.w + 80) / 12);
  return <View onLayout={onL} style={[fill, { overflow: 'hidden' }]}>
    <LinearGradient colors={['#0b1220', '#1a2638', '#2b3a4f']} style={fill} />
    <Animated.View style={{ position: 'absolute', left: -40, top: -cell, transform: [{ translateY: c.interpolate({ inputRange: [0, 1], outputRange: [0, cell] }) }, { translateX: c.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }] }}>
      <View style={{ flexDirection: 'row', transform: [{ skewX: '-10deg' }] }}>
        {Array.from({ length: cols }).map((_, i) => { const off = (i * 23) % cell;
          return <View key={i} style={{ width: 12 }}>{Array.from({ length: Math.ceil(b.h / cell) + 2 }).map((_, k) => <View key={k} style={{ width: 1.4, height: 16, marginTop: k ? cell - 16 : off, backgroundColor: 'rgba(200,225,255,.55)' }} />)}</View>; })}
      </View>
    </Animated.View>
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 6, backgroundColor: 'rgba(160,190,230,.25)' }} />
  </View>;
}

// Thermal Cam: a still heat-camera frame with a warm figure, scale bar and viewfinder
function Thermal2() {
  const [b, onL] = useBox();
  const blob = (cx, cy, rx, ry, k) => ['#2b00a8', '#7a00a0', '#c4007a', '#ff2d2d', '#ff7a00', '#ffd400', '#fff7b0'].map((col, i) => { const f = 1 - i * 0.13;
    return <View key={k + i} style={{ position: 'absolute', left: cx - rx * f, top: cy - ry * f, width: rx * 2 * f, height: ry * 2 * f, borderRadius: rx * 2, backgroundColor: col, opacity: 0.92 }} />; });
  const cx = b.w * 0.4;
  return <View onLayout={onL} style={[fill, { overflow: 'hidden', backgroundColor: '#0a0030' }]}>
    <LinearGradient colors={['#05001f', '#14006a', '#2a0080']} style={fill} />
    {blob(cx, b.h * 0.95, b.w * 0.2, b.h * 0.45, 'body')}
    {blob(cx, b.h * 0.36, b.h * 0.17, b.h * 0.2, 'head')}
    {blob(b.w * 0.82, b.h * 0.8, b.w * 0.09, b.h * 0.14, 'cup')}
    {Array.from({ length: Math.ceil(b.h / 4) }).map((_, i) => <View key={'l' + i} style={{ position: 'absolute', left: 0, right: 0, top: i * 4, height: 1, backgroundColor: 'rgba(0,0,0,.18)' }} />)}
    <View style={{ position: 'absolute', left: cx - 18, top: b.h * 0.36 - 18, width: 36, height: 36, borderWidth: 1.5, borderColor: 'rgba(255,255,255,.8)' }} />
    <Text style={{ position: 'absolute', left: cx + 22, top: b.h * 0.36 - 18, color: '#fff', fontSize: 11, fontWeight: '800' }}>98.6°F</Text>
    <LinearGradient colors={['#fff7b0', '#ffd400', '#ff7a00', '#ff2d2d', '#c4007a', '#2b00a8']} style={{ position: 'absolute', right: 10, top: 14, width: 7, height: b.h * 0.5, borderRadius: 4 }} />
    <View style={{ position: 'absolute', left: 10, top: 10, width: 14, height: 14, borderLeftWidth: 2, borderTopWidth: 2, borderColor: '#fff' }} />
    <View style={{ position: 'absolute', right: 26, bottom: 10, width: 14, height: 14, borderRightWidth: 2, borderBottomWidth: 2, borderColor: '#fff' }} />
  </View>;
}

// Sunburst: a cool sun in shades grins, swells up and bursts into a shower of logo t's, then comes back
// free header: the Temp logo, big, with a softly breathing orange dot and glow
function TempLogoHeader() {
  const [b, onL] = useBox(); const c = clock(3200); const fs = Math.min(b.h * 0.42, b.w * 0.2);
  return <View onLayout={onL} style={[fill, { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }]}>
    <LinearGradient colors={['#0a0a0a', '#1a0a03', '#2a0f04']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={fill} />
    <Animated.View style={{ position: 'absolute', width: b.w * 0.9, height: b.w * 0.9, borderRadius: b.w, backgroundColor: '#ff5500', opacity: c.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.12, 0.22, 0.12] }), transform: [{ scale: c.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.9, 1.05, 0.9] }) }] }} />
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: fs * 0.2 }}>
      <Text style={{ fontFamily: F.display, fontSize: fs, color: '#ffffff', letterSpacing: -fs * 0.05 }}>temp</Text>
      <Animated.View style={{ width: fs * 0.22, height: fs * 0.22, borderRadius: fs * 0.06, backgroundColor: '#ff5500', marginLeft: fs * 0.04, marginBottom: fs * 0.2,
        shadowColor: '#ff5500', shadowOpacity: 1, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, transform: [{ scale: c.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 1] }) }] }} />
    </View>
  </View>;
}
function SunPop() {
  const [b, onL] = useBox(); const c = clock(5200);
  const cx = b.w / 2, cy = b.h * 0.52, R = Math.min(b.h * 0.3, 60);
  const sunScale = c.interpolate({ inputRange: [0, 0.08, 0.55, 0.66, 0.7, 0.9, 1], outputRange: [0.2, 1, 1.05, 1.35, 0, 0, 0.2] });
  const sunOp = c.interpolate({ inputRange: [0, 0.04, 0.68, 0.7, 0.96, 1], outputRange: [0, 1, 1, 0, 0, 0] });
  return <View onLayout={onL} style={[fill, { overflow: 'hidden' }]}>
    <LinearGradient colors={['#ffb347', '#ff7a1a', '#ff5500']} style={fill} />
    <Animated.View style={{ position: 'absolute', left: cx, top: cy, width: 0, height: 0, opacity: sunOp, transform: [{ scale: sunScale }, { rotate: c.interpolate({ inputRange: [0, 0.55, 0.66, 0.7], outputRange: ['-6deg', '6deg', '-10deg', '10deg'], extrapolate: 'clamp' }) }] }}>
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, transform: [{ rotate: spin(clock(9000)) }] }}>
        {Array.from({ length: 12 }).map((_, i) => <View key={i} style={{ position: 'absolute', left: 0, top: 0, transform: [{ rotate: i * 30 + 'deg' }] }}>
          <View style={{ position: 'absolute', left: -5, top: -R * 1.55, width: 10, height: R * 0.4, borderRadius: 5, backgroundColor: '#ffe14d' }} /></View>)}
      </Animated.View>
      <View style={{ position: 'absolute', left: -R, top: -R, width: R * 2, height: R * 2, borderRadius: R, backgroundColor: '#ffd21a', borderWidth: 3, borderColor: '#ffe873' }}>
        {/* shades */}
        <View style={{ position: 'absolute', left: R * 0.22, top: R * 0.62, width: R * 0.68, height: R * 0.42, borderRadius: R * 0.14, borderBottomLeftRadius: R * 0.3, borderBottomRightRadius: R * 0.3, backgroundColor: '#111' }} />
        <View style={{ position: 'absolute', right: R * 0.22, top: R * 0.62, width: R * 0.68, height: R * 0.42, borderRadius: R * 0.14, borderBottomLeftRadius: R * 0.3, borderBottomRightRadius: R * 0.3, backgroundColor: '#111' }} />
        <View style={{ position: 'absolute', left: R * 0.85, top: R * 0.68, width: R * 0.3, height: R * 0.07, backgroundColor: '#111' }} />
        <View style={{ position: 'absolute', left: R * 0.3, top: R * 0.68, width: R * 0.2, height: R * 0.08, borderRadius: R, backgroundColor: 'rgba(255,255,255,.5)' }} />
        {/* grin */}
        <View style={{ position: 'absolute', left: R * 0.55, top: R * 1.05, width: R * 0.9, height: R * 0.5, borderBottomLeftRadius: R, borderBottomRightRadius: R, borderWidth: R * 0.08, borderTopWidth: 0, borderColor: '#7a2b00' }} />
      </View>
    </Animated.View>
    {/* the burst of t's */}
    {Array.from({ length: 18 }).map((_, i) => { const r = rng(900 + i); const ang = (i / 18) * Math.PI * 2 + r() * 0.3; const dist = (0.6 + r() * 0.6) * Math.max(b.w, b.h) * 0.6;
      const sz = 18 + r() * 22;
      return <Animated.Text key={i} style={{ position: 'absolute', left: cx - sz * 0.3, top: cy - sz * 0.7, fontFamily: F.display, fontSize: sz, color: i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#0a0a0a' : '#ffe14d',
        opacity: c.interpolate({ inputRange: [0, 0.67, 0.69, 0.88, 1], outputRange: [0, 0, 1, 0, 0] }),
        transform: [{ translateX: c.interpolate({ inputRange: [0, 0.68, 0.9, 1], outputRange: [0, 0, Math.cos(ang) * dist, Math.cos(ang) * dist] }) },
          { translateY: c.interpolate({ inputRange: [0, 0.68, 0.9, 1], outputRange: [0, 0, Math.sin(ang) * dist + 30, Math.sin(ang) * dist + 30] }) },
          { rotate: c.interpolate({ inputRange: [0, 0.68, 0.9, 1], outputRange: ['0deg', '0deg', (r() * 720 - 360) + 'deg', '0deg'] }) },
          { scale: c.interpolate({ inputRange: [0, 0.68, 0.72, 0.9, 1], outputRange: [0.2, 0.2, 1.2, 0.9, 0.2] }) }] }}>t</Animated.Text>; })}
    <Animated.View pointerEvents="none" style={[fill, { backgroundColor: '#fff', opacity: c.interpolate({ inputRange: [0, 0.68, 0.7, 0.76, 1], outputRange: [0, 0, 0.7, 0, 0] }) }]} />
  </View>;
}

// Embers: glowing sparks drifting up off a fire below, swaying and burning out as they rise
function Embers2() {
  const [b, onL] = useBox();
  return <View onLayout={onL} style={[fill, { overflow: 'hidden' }]}>
    <LinearGradient colors={['#050302', '#1a0702', '#5a1a04']} style={fill} />
    <LinearGradient colors={['rgba(255,110,20,.55)', 'transparent']} start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0.45 }} style={fill} />
    {Array.from({ length: 48 }).map((_, i) => { const r = rng(1100 + i); const s = 1.5 + r() * 3.2; const ph = r(); const life = clock(Math.round((3200 + r() * 3800) / 100) * 100); const w = clock(Math.round((1400 + r() * 1600) / 100) * 100);
      const x = r() * b.w; const col = ['#ffd27a', '#ff8a2b', '#ff5500', '#fff1c4'][i % 4];
      return <Animated.View key={i} style={{ position: 'absolute', left: x, top: 0, width: s, height: s, borderRadius: s, backgroundColor: col, shadowColor: '#ff6a00', shadowOpacity: 1, shadowRadius: 5,
        opacity: Animated.multiply(cycle(life, ph, 1, 0), jitter(clock(400), i * 7 + 3, 0.55, 1, 8)),
        transform: [{ translateY: cycle(life, ph, b.h + 6, b.h * 0.05) }, { translateX: sway(w, r(), 6 + r() * 14) }, { scale: cycle(life, ph, 1.2, 0.4) }] }} />; })}
  </View>;
}

// Lava: molten rock welling up from the ground on the left and pouring off to the right
function LavaFlow() {
  const [b, onL] = useBox(); const c = clock(3200), slow = clock(5200), pop = clock(1600);
  const top = b.h * 0.5;
  return <View onLayout={onL} style={[fill, { overflow: 'hidden' }]}>
    <LinearGradient colors={['#0b0505', '#1f0a06', '#3a1206']} style={fill} />
    <LinearGradient colors={['transparent', 'rgba(255,90,0,.35)']} start={{ x: 0.5, y: 0.35 }} end={{ x: 0.5, y: 1 }} style={fill} />
    {/* rocky ground */}
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: b.h * 0.18, backgroundColor: '#140806' }} />
    {/* the flow: a sloped channel filled with moving molten bands */}
    <View style={{ position: 'absolute', left: -20, top, width: b.w + 40, height: b.h - top + 20, overflow: 'hidden', borderTopLeftRadius: b.h * 0.5, borderTopRightRadius: 30, transform: [{ skewY: '6deg' }] }}>
      <LinearGradient colors={['#ffd27a', '#ff8a2b', '#ff3d00', '#a01800']} style={fill} />
      <Animated.View style={{ position: 'absolute', left: -b.w, top: 0, bottom: 0, flexDirection: 'row', transform: [{ translateX: c.interpolate({ inputRange: [0, 1], outputRange: [0, b.w / 2] }) }] }}>
        {Array.from({ length: 24 }).map((_, i) => { const r = rng(1300 + i); return <View key={i} style={{ width: b.w / 8, marginRight: -b.w / 40, marginTop: r() * 20, height: 26 + r() * 30, borderRadius: 30, backgroundColor: ['rgba(255,240,180,.55)', 'rgba(120,20,0,.45)', 'rgba(255,200,80,.5)'][i % 3] }} />; })}
      </Animated.View>
      <Animated.View style={{ position: 'absolute', left: -b.w, top: 22, bottom: 0, flexDirection: 'row', transform: [{ translateX: slow.interpolate({ inputRange: [0, 1], outputRange: [0, b.w / 2] }) }] }}>
        {Array.from({ length: 20 }).map((_, i) => <View key={i} style={{ width: b.w / 10, marginRight: b.w / 30, height: 14, marginTop: (i % 3) * 14, borderRadius: 10, backgroundColor: i % 2 ? 'rgba(60,10,0,.5)' : 'rgba(255,255,200,.35)' }} />)}
      </Animated.View>
    </View>
    {/* source welling up from the ground */}
    <Animated.View style={{ position: 'absolute', left: b.w * 0.02, top: top - 26, width: 70, height: 46, borderRadius: 40, backgroundColor: '#ff8a2b', shadowColor: '#ff5500', shadowOpacity: 1, shadowRadius: 18,
      transform: [{ scaleY: pop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.85, 1.15, 0.85] }) }] }} />
    {/* bubbles popping along the flow */}
    {Array.from({ length: 6 }).map((_, i) => { const r = rng(1500 + i); const ph = r(); const x = b.w * (0.15 + r() * 0.8);
      return <Animated.View key={'b' + i} style={{ position: 'absolute', left: x, top: top + 10 + (x / b.w) * 30 + r() * 20, width: 10, height: 10, borderRadius: 10, borderWidth: 2, borderColor: '#ffe7a0',
        opacity: cycle(pop, ph, 1, 0), transform: [{ scale: cycle(pop, ph, 0.3, 1.6) }] }} />; })}
  </View>;
}

// Lava: a volcano slowly spewing lava — glowing crater, blobs arcing out and falling, lava trickling down the slopes, smoke drifting up
function Volcano() {
  const [b, onL] = useBox(); const glow = clock(2600);
  const baseW = b.w * 0.9, peakW = b.w * 0.16, H = b.h * 0.55; const cx = b.w / 2, topY = b.h - H;
  const side = (baseW - peakW) / 2;
  return <View onLayout={onL} style={[fill, { overflow: 'hidden' }]}>
    <LinearGradient colors={['#12060a', '#2a0b08', '#4a1606']} style={fill} />
    <Animated.View style={{ position: 'absolute', left: cx - b.w * 0.35, top: topY - b.h * 0.3, width: b.w * 0.7, height: b.h * 0.6, borderRadius: b.w, backgroundColor: '#ff5500',
      opacity: glow.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.12, 0.24, 0.12] }) }} />
    {/* smoke */}
    {Array.from({ length: 7 }).map((_, i) => { const r = rng(1700 + i); const c = clock(Math.round((7000 + r() * 4000) / 100) * 100); const ph = r(); const s = 30 + r() * 40;
      return <Animated.View key={'k' + i} style={{ position: 'absolute', left: cx - s / 2, top: 0, width: s, height: s, borderRadius: s, backgroundColor: '#3a3036',
        opacity: cycle(c, ph, 0.55, 0), transform: [{ translateY: cycle(c, ph, topY - s / 2, -s) }, { translateX: cycle(c, ph, 0, (r() - 0.3) * 80) }, { scale: cycle(c, ph, 0.6, 2.2) }] }} />; })}
    {/* lava blobs arcing out of the crater */}
    {Array.from({ length: 9 }).map((_, i) => { const r = rng(1900 + i); const c = clock(Math.round((3400 + r() * 2200) / 100) * 100); const ph = r();
      const dx = (r() - 0.5) * b.w * 0.55, peak = b.h * (0.15 + r() * 0.3), s = 5 + r() * 7;
      const t = (k) => cycle(c, ph, 0, 1).interpolate({ inputRange: [0, 0.5, 1], outputRange: k });
      return <Animated.View key={'l' + i} style={{ position: 'absolute', left: cx - s / 2, top: topY - s / 2, width: s, height: s, borderRadius: s, backgroundColor: ['#ffd27a', '#ff8a2b', '#ff5500'][i % 3],
        shadowColor: '#ff5500', shadowOpacity: 1, shadowRadius: 6,
        opacity: t([1, 1, 0]), transform: [{ translateX: t([0, dx / 2, dx]) }, { translateY: t([0, -peak, b.h * 0.25]) }] }} />; })}
    {/* the mountain */}
    <View style={{ position: 'absolute', left: cx - baseW / 2, top: topY, width: 0, height: 0, borderLeftWidth: side, borderRightWidth: side, borderBottomWidth: H, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#1c0e0a' }} />
    <View style={{ position: 'absolute', left: cx - baseW / 2 + side, top: topY, width: peakW, height: H, backgroundColor: '#1c0e0a' }} />
    {/* lava running down the slopes */}
    {[-1, 1].map((d, i) => <View key={'r' + i} style={{ position: 'absolute', left: cx + d * peakW * 0.25 - 4, top: topY + 2, width: 8, height: H * 0.85, overflow: 'hidden', borderRadius: 4,
      transform: [{ rotate: (-d * Math.atan(side / H) * 180 / Math.PI * 0.8) + 'deg' }], transformOrigin: 'top' }}>
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: -H, height: H * 2, transform: [{ translateY: clock(2400).interpolate({ inputRange: [0, 1], outputRange: [0, H / 2] }) }] }}>
        <LinearGradient colors={['#ffd27a', '#ff5500', '#a01800', '#ff8a2b', '#ffd27a', '#ff5500', '#a01800', '#ff8a2b']} style={{ flex: 1 }} /></Animated.View></View>)}
    {/* crater glow */}
    <Animated.View style={{ position: 'absolute', left: cx - peakW * 0.42, top: topY - 6, width: peakW * 0.84, height: 12, borderRadius: 10, backgroundColor: '#ffb347', shadowColor: '#ff5500', shadowOpacity: 1, shadowRadius: 16,
      transform: [{ scaleX: glow.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.9, 1.1, 0.9] }) }] }} />
  </View>;
}

/* ---- Halloween headers (limited) ---- */
function Bat({ size, color = '#0a0510' }) {
  return <View style={{ width: size * 2.2, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ position: 'absolute', left: 0, top: size * 0.15, width: size * 0.95, height: size * 0.55, borderTopLeftRadius: size, borderBottomRightRadius: size * 0.4, backgroundColor: color, transform: [{ rotate: '-12deg' }] }} />
    <View style={{ position: 'absolute', right: 0, top: size * 0.15, width: size * 0.95, height: size * 0.55, borderTopRightRadius: size, borderBottomLeftRadius: size * 0.4, backgroundColor: color, transform: [{ rotate: '12deg' }] }} />
    <View style={{ width: size * 0.42, height: size * 0.6, borderRadius: size, backgroundColor: color }} />
  </View>;
}
// Haunted House: a crooked house on a hill under a huge moon, lit windows flickering, bats flapping across
function Haunted() {
  const [b, onL] = useBox(); const fl = clock(900), flap = clock(260);
  return <View onLayout={onL} style={[fill, { overflow: 'hidden' }]}>
    <LinearGradient colors={['#12061f', '#2a0f3d', '#4a1a2a']} style={fill} />
    <Twinkle n={30} seed={33} />
    <View style={{ position: 'absolute', right: b.w * 0.14, top: b.h * 0.08, width: b.h * 0.5, height: b.h * 0.5, borderRadius: b.h, backgroundColor: '#ffe7a8', shadowColor: '#ffcf6b', shadowOpacity: 0.9, shadowRadius: 30 }} />
    <View style={{ position: 'absolute', left: -b.w * 0.1, right: -b.w * 0.1, bottom: -b.h * 0.25, height: b.h * 0.5, borderRadius: b.w, backgroundColor: '#0a0510' }} />
    <View style={{ position: 'absolute', left: b.w * 0.18, bottom: b.h * 0.18, width: b.h * 0.55, height: b.h * 0.45, backgroundColor: '#0a0510' }}>
      <View style={{ position: 'absolute', left: -b.h * 0.06, top: -b.h * 0.2, width: 0, height: 0, borderLeftWidth: b.h * 0.335, borderRightWidth: b.h * 0.335, borderBottomWidth: b.h * 0.22, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#0a0510', transform: [{ rotate: '-3deg' }] }} />
      <View style={{ position: 'absolute', right: -b.h * 0.12, top: -b.h * 0.34, width: b.h * 0.14, height: b.h * 0.5, backgroundColor: '#0a0510' }} />
      {[[0.15, 0.25], [0.6, 0.25], [0.38, 0.6]].map(([x, y], i) => <Animated.View key={i} style={{ position: 'absolute', left: x * b.h * 0.55, top: y * b.h * 0.45, width: b.h * 0.1, height: b.h * 0.12, backgroundColor: '#ffb347',
        opacity: jitter(fl, 70 + i, 0.4, 1, 6), shadowColor: '#ff8a2b', shadowOpacity: 1, shadowRadius: 6 }} />)}
    </View>
    {Array.from({ length: 5 }).map((_, i) => { const r = rng(2100 + i); const c = clock(Math.round((7000 + r() * 5000) / 100) * 100); const ph = r(); const y = b.h * (0.1 + r() * 0.45); const s = 8 + r() * 8;
      return <Animated.View key={i} style={{ position: 'absolute', left: 0, top: y, transform: [{ translateX: cycle(c, ph, -40, b.w + 40) }, { translateY: sway(c, r(), 10) }, { scaleY: flap.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.35, 1] }) }] }}>
        <Bat size={s} /></Animated.View>; })}
  </View>;
}
// Pumpkin Patch: a row of glowing jack-o'-lanterns flickering on a dark field, with fireflies
function Jack({ s, k }) {
  const fl = clock(700);
  return <View style={{ width: s * 1.25, height: s, alignItems: 'center' }}>
    <View style={{ position: 'absolute', top: -s * 0.14, width: s * 0.12, height: s * 0.22, borderRadius: 3, backgroundColor: '#3b6b1f' }} />
    <View style={{ width: s * 1.25, height: s, borderRadius: s * 0.5, backgroundColor: '#ff7518', overflow: 'hidden', alignItems: 'center' }}>
      {[0.18, 0.5, 0.82].map((x, i) => <View key={i} style={{ position: 'absolute', left: x * s * 1.25 - s * 0.15, top: 0, width: s * 0.3, height: s, borderRadius: s, backgroundColor: 'rgba(160,50,0,.25)' }} />)}
      <Animated.View style={{ position: 'absolute', top: s * 0.28, flexDirection: 'row', gap: s * 0.22, opacity: jitter(fl, k, 0.55, 1, 6) }}>
        {[0, 1].map((i) => <View key={i} style={{ width: 0, height: 0, borderLeftWidth: s * 0.11, borderRightWidth: s * 0.11, borderBottomWidth: s * 0.2, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#ffe14d' }} />)}
      </Animated.View>
      <Animated.View style={{ position: 'absolute', top: s * 0.58, width: s * 0.62, height: s * 0.2, borderBottomLeftRadius: s, borderBottomRightRadius: s, backgroundColor: '#ffe14d', opacity: jitter(fl, k + 9, 0.55, 1, 6) }} />
    </View>
  </View>;
}
function PumpkinPatch() {
  const [b, onL] = useBox();
  return <View onLayout={onL} style={[fill, { overflow: 'hidden' }]}>
    <LinearGradient colors={['#0b0614', '#1d0f26', '#2e1405']} style={fill} />
    <Particles n={14} seed={77} ms={9000} color="#d9ff66" w={3} rise drift={50} glow="#d9ff66" />
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: b.h * 0.3, backgroundColor: '#140a06' }} />
    {[[0.08, 0.36], [0.33, 0.48], [0.6, 0.4], [0.82, 0.3]].map(([x, k], i) => <View key={i} style={{ position: 'absolute', left: b.w * x, bottom: b.h * 0.1 + (i % 2) * 6 }}><Jack s={b.h * k} k={i * 5 + 1} /></View>)}
  </View>;
}
// Ghost Town: little ghosts drifting and bobbing through purple fog
function Ghost({ s }) {
  return <View style={{ width: s, height: s * 1.25, alignItems: 'center' }}>
    <View style={{ width: s, height: s * 1.1, borderTopLeftRadius: s, borderTopRightRadius: s, backgroundColor: 'rgba(255,255,255,.92)' }}>
      <View style={{ position: 'absolute', left: s * 0.28, top: s * 0.36, width: s * 0.14, height: s * 0.2, borderRadius: s, backgroundColor: '#1a1030' }} />
      <View style={{ position: 'absolute', right: s * 0.28, top: s * 0.36, width: s * 0.14, height: s * 0.2, borderRadius: s, backgroundColor: '#1a1030' }} />
      <View style={{ position: 'absolute', left: s * 0.42, top: s * 0.64, width: s * 0.16, height: s * 0.14, borderRadius: s, backgroundColor: '#1a1030' }} />
    </View>
    <View style={{ flexDirection: 'row', marginTop: -s * 0.12 }}>{[0, 1, 2].map((i) => <View key={i} style={{ width: s / 3, height: s * 0.24, borderBottomLeftRadius: s, borderBottomRightRadius: s, backgroundColor: 'rgba(255,255,255,.92)' }} />)}</View>
  </View>;
}
function GhostTown() {
  const [b, onL] = useBox(); const fog = clock(12000);
  return <View onLayout={onL} style={[fill, { overflow: 'hidden' }]}>
    <LinearGradient colors={['#160b2e', '#2c1652', '#4a2a6a']} style={fill} />
    {Array.from({ length: 6 }).map((_, i) => { const r = rng(2300 + i); const c = clock(Math.round((9000 + r() * 7000) / 100) * 100); const bob = clock(Math.round((1800 + r() * 1400) / 100) * 100); const ph = r(); const s = 24 + r() * 26;
      return <Animated.View key={i} style={{ position: 'absolute', left: 0, top: b.h * (0.12 + r() * 0.5), opacity: 0.85,
        transform: [{ translateX: cycle(c, ph, -60, b.w + 20) }, { translateY: sway(bob, r(), 8) }, { rotate: bob.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-6deg', '6deg', '-6deg'] }) }] }}><Ghost s={s} /></Animated.View>; })}
    <Animated.View style={{ position: 'absolute', left: -b.w, bottom: -10, width: b.w * 3, height: b.h * 0.4, flexDirection: 'row', transform: [{ translateX: fog.interpolate({ inputRange: [0, 1], outputRange: [0, b.w] }) }] }}>
      {Array.from({ length: 9 }).map((_, i) => <View key={i} style={{ width: b.w / 2.4, height: b.h * 0.3 + (i % 3) * 10, marginRight: -b.w / 10, borderRadius: b.w, backgroundColor: 'rgba(220,200,255,.18)' }} />)}
    </Animated.View>
  </View>;
}

export function HeaderFx({ id, fallback }) {
  useClockKick();
  const cols = HEADER_FX[id] || fallback;
  const base = <LinearGradient colors={cols} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={fill} />;
  let fx = null;
  switch (id) {
    case 'aurora': return <View style={[fill, { overflow: 'hidden' }]}><Pan cols={cols} /></View>;
    case 'lava': return <Volcano />;
    case 'haunted': return <Haunted />;
    case 'pumpkinpatch': return <PumpkinPatch />;
    case 'ghosts': return <GhostTown />;
    case 'hazard': return <Hazard />;
    case 'checker': return <Checker />;
    case 'sunburst': return <SunPop />;
    case 'templogo': return <TempLogoHeader />;
    case 'disco': return <Disco2 />;
    case 'synth': return <Synth />;
    case 'thermal': return <Thermal2 />;
    case 'starfield': return <NightDrive />;
    case 'blizzard': return <Blizzard />;
    case 'snow': return <Snowstorm />;
    case 'lavalamp': return <LavaLamp />;
    case 'rain': return <Rain />;
    case 'embers': return <Embers2 />;
    case 'embers': fx = <Particles n={26} seed={3} ms={7000} color={['#ff8a2b', '#ffd27a', '#ff3d00']} w={4} rise drift={30} glow="#ff5500" />; break;
    case 'rain': fx = <Particles n={34} seed={9} ms={1800} color="#ff7a33" w={2} len={9} round={false} />; break;
    case 'snow': fx = <Particles n={36} seed={4} ms={8000} color="#ffffff" w={4} drift={40} />; break;
    case 'static': fx = <GlitchBars seed={2} />; break;
    case 'wildfire': fx = <><Flames seed={1} /><Particles n={22} seed={6} ms={4200} color={['#ffd27a', '#ff8a2b']} w={3} rise drift={40} glow="#ff5500" /></>; break;
    case 'heatwave': fx = <Waves />; break;
    case 'blizzard': fx = <Particles n={60} seed={12} ms={2600} color="#ffffff" w={4} drift={120} />; break;
    case 'glitchtv': fx = <><GlitchBars seed={7} /><Twinkle n={60} seed={14} color="#9a9a9a" /></>; break;
    case 'starfield': fx = <><Twinkle n={70} seed={15} /><Particles n={3} seed={44} ms={5000} color="#ffffff" w={2} len={14} round={false} /></>; break;
    case 'lavalamp': fx = <Blobs seed={10} />; break;
  }
  return <View style={[fill, { overflow: 'hidden' }]}>{base}{fx}</View>;
}
