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

/* ---------- launch intro: logo fades in, then burns to ash ---------- */
export function Intro({ onDone }) {
  const t = useRef(new Animated.Value(0)).current;      // native: fades, motion
  const burn = useRef(new Animated.Value(0)).current;   // JS: letter colour
  const out = useRef(new Animated.Value(1)).current;
  const letters = ['t', 'e', 'm', 'p'];
  useEffect(() => {
    Animated.sequence([
      Animated.timing(t, { toValue: 0.25, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(350),
      Animated.parallel([
        Animated.timing(t, { toValue: 1, duration: 1700, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(burn, { toValue: 1, duration: 1700, easing: Easing.linear, useNativeDriver: false })]),
      Animated.timing(out, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => onDone && onDone());
  }, []);
  // each letter (and the dot) burns a little after the one before it
  const step = (i) => { const a = 0.25 + i * 0.1; return [a, a + 0.1, a + 0.25]; };
  const piece = (i, child) => { const [a, b, c] = step(i);
    return <Animated.View key={i} style={{ opacity: t.interpolate({ inputRange: [0, 0.25, b, c], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' }),
      transform: [{ translateY: t.interpolate({ inputRange: [0, 0.25, b, c], outputRange: [8, 0, 0, -18], extrapolate: 'clamp' }) },
        { scale: t.interpolate({ inputRange: [0, b, c], outputRange: [1, 1, 0.82], extrapolate: 'clamp' }) }] }}>{child}</Animated.View>; };
  const col = (i) => { const [a, b] = step(i); return burn.interpolate({ inputRange: [0, Math.max(0, (a - 0.25) / 0.75), (b - 0.25) / 0.75 - 0.05, (b - 0.25) / 0.75], outputRange: ['#ffffff', '#ffffff', '#ff6a1a', '#3a3a3a'], extrapolate: 'clamp' }); };
  return (
    <Animated.View pointerEvents="none" style={[fill, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', zIndex: 100, opacity: out }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        {letters.map((l, i) => piece(i, <Animated.Text style={{ fontFamily: F.display, fontSize: 64, letterSpacing: -3, color: col(i),
          textShadowColor: '#ff5500', textShadowRadius: 18 }}>{l}</Animated.Text>))}
        {piece(4, <Animated.View style={{ width: 17, height: 17, borderRadius: 4, marginLeft: 5, marginBottom: 12, backgroundColor: col(4) }} />)}
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: 200, height: 80 }}>
          <Flakes t={t} n={46} seed={7} w={200} h={80} from={0.3} />
        </View>
      </View>
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
