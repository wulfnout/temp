// Animated rings and headers. Everything runs off a few shared clocks on the native driver,
// so dozens of animated avatars in a feed cost almost nothing.
import React from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const clocks = {};
export function clock(ms) {
  if (!clocks[ms]) {
    const v = new Animated.Value(0);
    Animated.loop(Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: true })).start();
    clocks[ms] = v;
  }
  return clocks[ms];
}
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
export function FireRing({ size, children, bg }) {
  const c = clock(900), slow = clock(2400);
  const n = size < 40 ? 7 : size < 70 ? 10 : 14;
  const fs = Math.max(8, size * 0.26), r = size / 2 - fs * 0.32;
  const cols = ['#ff2d00', '#ff8a2b', '#ffd27a', '#ff5500'];
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* glow */}
      <Animated.View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: '#ff3d00',
        shadowColor: '#ff5500', shadowOpacity: 0.9, shadowRadius: size * 0.16, shadowOffset: { width: 0, height: 0 },
        opacity: jitter(c, 3, 0.55, 1, 8) }} />
      {/* licking flames around the edge */}
      {Array.from({ length: n }).map((_, i) => {
        const ang = (360 / n) * i; const rad = (ang - 90) * Math.PI / 180;
        return <Animated.View key={i} pointerEvents="none" style={{ position: 'absolute', left: size / 2 + Math.cos(rad) * r - fs / 2, top: size / 2 + Math.sin(rad) * r - fs / 2, width: fs, height: fs,
          opacity: jitter(c, i * 7 + 1, 0.55, 1, 6),
          transform: [{ rotate: ang + 'deg' }, { translateY: jitter(c, i * 13 + 5, -fs * 0.28, 0, 6) }, { scaleY: jitter(c, i * 5 + 2, 0.75, 1.35, 6) }, { scaleX: jitter(c, i * 3 + 9, 0.85, 1.1, 6) }] }}>
          <Ionicons name="flame" size={fs} color={cols[i % cols.length]} />
        </Animated.View>;
      })}
      {/* hot spinning core */}
      <Animated.View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, overflow: 'hidden',
        transform: [{ rotate: slow.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
        <LinearGradient colors={['#ff2d00', '#ffd27a', '#ff8a2b', '#ff2d00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
      </Animated.View>
      <View style={{ padding: 2, borderRadius: size, backgroundColor: bg }}>{children}</View>
    </View>
  );
}

export function GlitchRing({ size, children, bg }) {
  const c = clock(1100), c2 = clock(1700);
  const bw = Math.max(2, size * 0.06);
  const ring = (color, dx, dy, op) => <Animated.View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: bw, borderColor: color, opacity: op,
    transform: [{ translateX: dx }, { translateY: dy }] }} />;
  const bars = size < 40 ? 2 : 4;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <LinearGradient colors={['#ff2d55', '#0a0a0a', '#00e5ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2 }} />
      <View style={{ padding: 2, borderRadius: size, backgroundColor: bg }}>{children}</View>
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

/* ---------------- headers ---------------- */
// colours for every header; the ones listed in ANIM also get motion
export const HEADER_FX = { lava: ['#ffd27a', '#ff2d00', '#0a0a0a'], aurora: ['#0a0a0a', '#ff5500', '#ffd27a'], static: ['#151515', '#ff5500'], embers: ['#0a0a0a', '#3a1204'],
  hazard: ['#ff5500', '#0a0a0a'], sunburst: ['#ffd27a', '#ff5500'], snow: ['#1b2430', '#6c8194'], thermal: ['#2b00a8', '#c4007a', '#ff5500', '#ffe14d'], disco: ['#2a1206', '#ff2bd6', '#0a0a0a'],
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

export function HeaderFx({ id, fallback }) {
  const cols = HEADER_FX[id] || fallback;
  const base = <LinearGradient colors={cols} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={fill} />;
  let fx = null;
  switch (id) {
    case 'lava': case 'aurora': case 'thermal': case 'sunburst': case 'synth': return <View style={[fill, { overflow: 'hidden' }]}><Pan cols={cols} />{id === 'synth' ? <Twinkle n={20} seed={5} color="#ff9cf2" /> : null}</View>;
    case 'embers': fx = <Particles n={26} seed={3} ms={7000} color={['#ff8a2b', '#ffd27a', '#ff3d00']} w={4} rise drift={30} glow="#ff5500" />; break;
    case 'rain': fx = <Particles n={34} seed={9} ms={1800} color="#ff7a33" w={2} len={9} round={false} />; break;
    case 'snow': fx = <Particles n={36} seed={4} ms={8000} color="#ffffff" w={4} drift={40} />; break;
    case 'static': fx = <GlitchBars seed={2} />; break;
    case 'disco': fx = <Twinkle n={40} seed={8} color="#ffd27a" />; break;
    case 'wildfire': fx = <><Flames seed={1} /><Particles n={22} seed={6} ms={4200} color={['#ffd27a', '#ff8a2b']} w={3} rise drift={40} glow="#ff5500" /></>; break;
    case 'heatwave': fx = <Waves />; break;
    case 'blizzard': fx = <Particles n={60} seed={12} ms={2600} color="#ffffff" w={4} drift={120} />; break;
    case 'glitchtv': fx = <><GlitchBars seed={7} /><Twinkle n={60} seed={14} color="#9a9a9a" /></>; break;
    case 'starfield': fx = <><Twinkle n={70} seed={15} /><Particles n={3} seed={44} ms={5000} color="#ffffff" w={2} len={14} round={false} /></>; break;
    case 'lavalamp': fx = <Blobs seed={10} />; break;
  }
  return <View style={[fill, { overflow: 'hidden' }]}>{base}{fx}</View>;
}
