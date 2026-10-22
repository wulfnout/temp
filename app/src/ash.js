// Burn-to-ash effects: the launch intro and the "Ash" post animation.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { F } from './lib';

function rng(seed) { let x = seed * 9301 + 49297; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; }
const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

// flakes of ash and embers lifting off. t runs 0..1 (native driver)
function Flakes({ t, n, seed, w, h, from = 0, embers = 0.35 }) {
  const r = rng(seed);
  return Array.from({ length: n }).map((_, i) => {
    const x = r() * w, y = h * (0.15 + r() * 0.8), start = from + r() * (0.85 - from) * 0.8, sz = 2 + r() * 5;
    const ember = r() < embers; const dx = (r() - 0.3) * 60, dy = -(40 + r() * 120);
    const a = Math.min(0.98, start), b = Math.min(0.999, a + 0.02);
    return <Animated.View key={i} pointerEvents="none" style={{ position: 'absolute', left: x, top: y, width: sz, height: sz * (ember ? 1 : 0.7), borderRadius: ember ? sz : 1,
      backgroundColor: ember ? (i % 2 ? '#ff8a2b' : '#ffd27a') : ['#6b6b6b', '#3d3d3d', '#9a9a9a'][i % 3],
      opacity: t.interpolate({ inputRange: [0, a, b, 1], outputRange: [0, 0, 1, 0], extrapolate: 'clamp' }),
      transform: [{ translateX: t.interpolate({ inputRange: [0, a, 1], outputRange: [0, 0, dx], extrapolate: 'clamp' }) },
        { translateY: t.interpolate({ inputRange: [0, a, 1], outputRange: [0, 0, dy], extrapolate: 'clamp' }) },
        { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', (r() * 540 - 270) + 'deg'] }) }] }} />;
  });
}

/* ---------- launch intro (same as the website): letters fade up, heat to glowing orange with flames licking off,
   char to gray, then crumble away as ash and embers lift off. ---------- */
const TOTAL = 3.35; // seconds
export function Intro({ onDone }) {
  const tN = useRef(new Animated.Value(0)).current; // native: motion + fades
  const tJ = useRef(new Animated.Value(0)).current; // JS: letter colour
  const flick = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const lin = (v, nd) => Animated.timing(v, { toValue: TOTAL, duration: TOTAL * 1000, easing: Easing.linear, useNativeDriver: nd });
    const f = Animated.loop(Animated.sequence([Animated.timing(flick, { toValue: 1, duration: 180, useNativeDriver: true }), Animated.timing(flick, { toValue: 0, duration: 180, useNativeDriver: true })]));
    f.start(); Animated.parallel([lin(tN, true), lin(tJ, false)]).start(() => { f.stop(); onDone && onDone(); });
  }, []);
  // interpolate on seconds, clamped
  const at = (v, inp, out) => v.interpolate({ inputRange: inp, outputRange: out, extrapolate: 'clamp' });
  const r = rng(11);
  const piece = (ch, i) => {
    const inS = i * 0.08, b = 1.0 + i * 0.16;
    const body = ch
      ? <View>
          <Animated.Text style={{ fontFamily: F.display, fontSize: 64, letterSpacing: -3, color: at(tJ, [0, b, b + 0.22, b + 0.45, b + 0.7], ['#ffffff', '#ffffff', '#ffe7b0', '#ff7a1a', '#2e2e2e']) }}>{ch}</Animated.Text>
          <Animated.Text style={{ position: 'absolute', left: 0, top: 0, fontFamily: F.display, fontSize: 64, letterSpacing: -3, color: '#ff8a2b', textShadowColor: '#ff2d00', textShadowRadius: 22,
            opacity: at(tN, [0, b, b + 0.3, b + 0.55, b + 0.72], [0, 0, 0.95, 0.95, 0]) }}>{ch}</Animated.Text>
        </View>
      : <View style={{ marginLeft: 5, marginBottom: 12 }}>
          <Animated.View style={{ width: 17, height: 17, borderRadius: 4, backgroundColor: at(tJ, [0, b, b + 0.22, b + 0.45, b + 0.7], ['#ff5500', '#ff5500', '#ffd27a', '#ff7a1a', '#2e2e2e']) }} />
          <Animated.View style={{ position: 'absolute', left: -4, top: -4, width: 25, height: 25, borderRadius: 7, backgroundColor: '#ff5500', shadowColor: '#ff2d00', shadowOpacity: 1, shadowRadius: 14,
            opacity: at(tN, [0, b, b + 0.3, b + 0.55, b + 0.72], [0, 0, 0.6, 0.6, 0]) }} />
        </View>;
    const flames = [0, 1, 2].map((k) => { const s0 = b + 0.05 + k * 0.06;
      return <Animated.View key={k} pointerEvents="none" style={{ position: 'absolute', bottom: ch ? 40 : 12, left: (ch ? 6 : -2) + k * (ch ? 11 : 6),
        opacity: at(tN, [0, s0, s0 + 0.15, s0 + 0.42, s0 + 0.6], [0, 0, 1, 0.9, 0]),
        transform: [{ translateY: at(tN, [s0, s0 + 0.6], [0, -14]) }, { scale: at(tN, [s0, s0 + 0.15, s0 + 0.6], [0.3, 1.1, 0.5]) },
          { scaleY: flick.interpolate({ inputRange: [0, 1], outputRange: k % 2 ? [0.85, 1.25] : [1.2, 0.9] }) }] }}>
        <Ionicons name="flame" size={ch ? 20 : 12} color={['#ff5500', '#ffd27a', '#ff2d00'][k]} style={{ textShadowColor: '#ff5500', textShadowRadius: 6 }} /></Animated.View>; });
    const flakes = Array.from({ length: 16 }).map((_, k) => {
      const e = r() < 0.3; const st = b + 0.5 + r() * 0.35; const dx = (r() - 0.35) * 70, dy = -(50 + r() * 110), rot = r() * 600 - 300;
      const w = 2 + r() * 4.5, hh = 1.5 + r() * 3.5;
      return <Animated.View key={'a' + k} pointerEvents="none" style={{ position: 'absolute', left: (10 + r() * 80) + '%', top: (15 + r() * 75) + '%', width: w, height: e ? w : hh, borderRadius: e ? w : 1,
        backgroundColor: e ? (k % 2 ? '#ff8a2b' : '#ffd27a') : ['#5c5c5c', '#3a3a3a', '#8a8a8a'][k % 3],
        opacity: at(tN, [0, st, st + 0.13, st + 1.3], [0, 0, 1, 0]),
        transform: [{ translateX: at(tN, [st, st + 1.3], [0, dx]) }, { translateY: at(tN, [st, st + 1.3], [0, dy]) }, { rotate: at(tN, [st, st + 1.3], ['0deg', rot + 'deg']) }] }} />; });
    return <View key={i}>
      <Animated.View style={{ opacity: at(tN, [0, inS, inS + 0.6, b + 0.55, b + 1.15], [0, 0, 1, 1, 0]),
        transform: [{ translateY: at(tN, [inS, inS + 0.6, b + 0.55, b + 1.15], [10, 0, 0, -16]) }, { scale: at(tN, [b + 0.55, b + 1.15], [1, 0.86]) }, { skewX: at(tN, [b + 0.55, b + 1.15], ['0deg', '-6deg']) }] }}>{body}</Animated.View>
      {flames}{flakes}
    </View>;
  };
  return (
    <Animated.View pointerEvents="none" style={[fill, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', zIndex: 100, opacity: at(tN, [0, 2.95, 3.35], [1, 1, 0]) }]}>
      {/* soft heat glow swelling behind the logo */}
      <Animated.View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center', opacity: at(tN, [0, 0.9, 1.34, 2.22, 3.1], [0, 0, 1, 0.8, 0]),
        transform: [{ scale: at(tN, [0.9, 1.34, 3.1], [1, 1.05, 1.25]) }] }}>
        {[[420, 220, 0.07], [330, 170, 0.08], [240, 120, 0.1], [160, 80, 0.12]].map(([w, h, o], k) => <View key={k} style={{ position: 'absolute', width: w, height: h, borderRadius: h, backgroundColor: k > 1 ? '#ff5500' : '#ff2d00', opacity: o }} />)}
      </Animated.View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>{['t', 'e', 'm', 'p', null].map(piece)}</View>
    </Animated.View>
  );
}

/* ---------- ashing a post: a burn line sweeps up, flames ride it, ash lifts off ---------- */
export function AshBurn({ onDone }) {
  const [box, setBox] = useState(null);
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!box) return;
    Animated.timing(t, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start(() => onDone && onDone());
  }, [box]);
  const H = box ? box.h : 0, W = box ? box.w : 0;
  const front = t.interpolate({ inputRange: [0, 0.75, 1], outputRange: [H, -H * 0.15, -H * 0.15], extrapolate: 'clamp' });
  const n = Math.max(6, Math.round(W / 34));
  return (
    <View pointerEvents="none" style={[fill, { zIndex: 20 }]} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {box ? <>
        {/* charred area grows up behind the burn line */}
        <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: H * 1.4, transform: [{ translateY: front }] }}>
          <LinearGradient colors={['rgba(255,210,122,0)', '#ffd27a', '#ff5500', '#5a1a04', '#1c1c1c', '#141414']} locations={[0, 0.04, 0.09, 0.16, 0.3, 1]} style={{ flex: 1 }} />
          {Array.from({ length: n }).map((_, i) => <Animated.View key={i} style={{ position: 'absolute', top: -22, left: (i / (n - 1)) * W - 14,
            opacity: t.interpolate({ inputRange: [0, 0.05, 0.8, 0.95], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' }),
            transform: [{ scaleY: t.interpolate({ inputRange: Array.from({ length: 13 }, (_, k) => k / 12), outputRange: Array.from({ length: 13 }, (_, k) => 0.7 + ((i * 7 + k * 5) % 6) / 10), extrapolate: 'clamp' }) }] }}>
            <Ionicons name="flame" size={30} color={['#ff2d00', '#ff8a2b', '#ffd27a'][i % 3]} /></Animated.View>)}
        </Animated.View>
        {/* ash crumbles away at the end */}
        <Animated.View style={[fill, { backgroundColor: '#141414', opacity: t.interpolate({ inputRange: [0, 0.78, 0.9, 1], outputRange: [0, 0, 1, 1], extrapolate: 'clamp' }) }]} />
        <Flakes t={t} n={Math.round(W * H / 900)} seed={3} w={W} h={H} from={0.15} embers={0.25} />
      </> : null}
    </View>
  );
}
