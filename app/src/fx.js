// Animated rings and headers. Everything runs off a few shared clocks on the native driver,
// so dozens of animated avatars in a feed cost almost nothing.
import React from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// Shared clocks. React Native stops a value's animation when the last view using it goes away
// (e.g. leaving the shop), so each clock notes when it stopped and gets restarted as soon as
// anything uses it again — on render, after mount, and by a light safety check every second.
const clocks = {};
function run(c) {
  const id = (c.gen = (c.gen || 0) + 1); c.running = true;
  Animated.loop(Animated.timing(c.v, { toValue: 1, duration: c.ms, easing: Easing.linear, useNativeDriver: true })).start(() => { if (c.gen === id) c.running = false; });
}
export function kickClocks() { Object.values(clocks).forEach((c) => { if (!c.running) { c.v.setValue(0); run(c); } }); }
setInterval(kickClocks, 1000);
export function clock(ms) {
  if (!clocks[ms]) { clocks[ms] = { v: new Animated.Value(0), ms, running: false }; run(clocks[ms]); }
  else if (!clocks[ms].running) run(clocks[ms]);
  return clocks[ms].v;
}
export function useClockKick() { React.useEffect(() => { const t = setTimeout(kickClocks, 50); return () => clearTimeout(t); }, []); }
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
  useClockKick();
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
  useClockKick();
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

export function HeaderFx({ id, fallback }) {
  useClockKick();
  const cols = HEADER_FX[id] || fallback;
  const base = <LinearGradient colors={cols} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={fill} />;
  let fx = null;
  switch (id) {
    case 'lava': case 'aurora': return <View style={[fill, { overflow: 'hidden' }]}><Pan cols={cols} />{id === 'lava' ? <Blobs seed={21} /> : null}</View>;
    case 'hazard': return <Hazard />;
    case 'checker': return <Checker />;
    case 'sunburst': return <Sunburst />;
    case 'disco': return <Disco />;
    case 'synth': return <Synth />;
    case 'thermal': return <Thermal />;
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
