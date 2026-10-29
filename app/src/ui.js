import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, Animated, Easing, Modal, StyleSheet, KeyboardAvoidingView, Keyboard, Platform, ScrollView, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { F, hms, ago, kfmt, hashStr, STICKER_PACKS, STICKER_COLORS, tempOf, levelOf, tierOf, nextWeekStart, DAY, HOUR } from './lib';

export const Ctx = React.createContext(null);
export const useApp = () => React.useContext(Ctx);

export function useNow(ms = 1000) {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return n;
}

export function T({ style, b, h, d, muted, children, ...rest }) {
  const { C } = useApp();
  const fam = d ? F.display : h ? F.heavy : b ? F.bold : F.body;
  return <Text {...rest} style={[{ color: muted ? C.muted : C.ink, fontFamily: fam, fontSize: 15 }, style]}>{children}</Text>;
}

// shared slow clock for the buttons: a rounded-square squircle whose corners breathe ever so slightly (JS driver — corner radii can't run on the native driver)
let flowV = null;
function flowClock() {
  if (!flowV) { flowV = new Animated.Value(0); Animated.loop(Animated.timing(flowV, { toValue: 1, duration: 10000, easing: Easing.linear, useNativeDriver: false })).start(); }
  return flowV;
}
const FLOW_KEYS = [[15, 15, 15, 15], [17.4, 13.2, 16.5, 13.5], [15, 15, 15, 15], [13.2, 17.1, 13.5, 16.8], [15, 15, 15, 15]]; // squircle, barely breathing
const FLOW_NAMES = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'];
export function flowRadii(seed = 0) {
  const v = flowClock(); const ph = (Math.abs(seed) % 100) / 100; const out = {};
  FLOW_NAMES.forEach((n, ci) => { const inp = [], o = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; const u = (t + ph) % 1; const seg = Math.min(3, Math.floor(u * 4)); const f = u * 4 - seg; const e = (1 - Math.cos(f * Math.PI)) / 2;
      inp.push(t); o.push(FLOW_KEYS[seg][ci] + (FLOW_KEYS[seg + 1][ci] - FLOW_KEYS[seg][ci]) * e); }
    out[n] = v.interpolate({ inputRange: inp, outputRange: o }); });
  return out;
}
// a box whose squircle corners breathe ever so slightly (same motion as the buttons), at any corner size
export function FlowBox({ r = 15, style, children, ...rest }) {
  const flow = React.useMemo(() => { const f = flowRadii(Math.floor(Math.random() * 100)); const o = {}; Object.keys(f).forEach((k) => { o[k] = Animated.multiply(f[k], r / 15); }); return o; }, [r]);
  return <Animated.View {...rest} style={[style, flow]}>{children}</Animated.View>;
}
export function Btn({ title, onPress, kind = 'ink', small, disabled, style, icon }) {
  const { C } = useApp(); const [pressed, setPressed] = useState(false);
  const bg = kind === 'orange' ? (C.mono ? C.orange : '#ee5f1f') : kind === 'ghost' ? C.soft : C.ink;
  const glow = kind === 'orange' && C.glow && !disabled ? { shadowColor: C.orange, shadowOpacity: 0.85, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 8 } : null;
  const fg = kind === 'orange' ? C.onOrange : kind === 'ghost' ? C.ink : C.bg;
  const flow = React.useMemo(() => flowRadii(hashStr(title || '')), [title]);
  return (
    <Animated.View style={[glow, flow, { backgroundColor: bg, opacity: disabled ? 0.35 : pressed ? 0.8 : 1 }, style]}>
      {kind === 'orange' && !C.mono ? <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }, flow]}>
        <LinearGradient colors={['#ee5f1f', '#f58a3d', '#ffb36b', '#f7924a']} locations={[0, 0.42, 0.62, 1]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} /></Animated.View> : null}
      <Pressable onPress={onPress} disabled={disabled} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} accessibilityRole="button" accessibilityLabel={title}
        style={{ flexGrow: 1, paddingVertical: small ? 8 : 12, paddingHorizontal: small ? 14 : 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
        {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
        <Text style={{ color: fg, fontFamily: F.heavy, fontSize: small ? 13 : 14, textShadowColor: kind === 'orange' && !C.mono ? 'rgba(140,40,0,.35)' : 'transparent', textShadowRadius: 2 }}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function IconBtn({ name, onPress, size = 22, color, label, badge, style }) {
  const { C } = useApp();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={8} style={({ pressed }) => [{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 }, style]}>
      <Ionicons name={name} size={size} color={color || C.ink} />
      {badge ? <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
        <Text style={{ color: C.onOrange, fontSize: 11, fontFamily: F.heavy }}>{badge}</Text></View> : null}
    </Pressable>
  );
}

const RING_COLORS = { fire: ['#ff2d00', '#ffd27a'], ice: ['#ffffff', '#7f95a6'], gold: ['#ffd700', '#b98900'], morph: null, glitch: ['#ff2d55', '#00e5ff'], plus: ['#0a0a0a', '#ff5500'] };
import { FireRing, GlitchRing, MorphRing, SpinRing, jsClock, useClockKick } from './fx';
export function Avatar({ u, size = 40 }) {
  const { C } = useApp();
  if (!u) return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.soft }} />;
  const initials = (u.name || u.handle || '?').split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  const inner = (s) => u.avatar
    ? <Image source={{ uri: u.avatar }} style={{ width: s, height: s, borderRadius: s / 2 }} />
    : <View style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: u.color, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontFamily: F.heavy, fontSize: s * 0.38 }}>{initials}</Text></View>;
  if (!u.ring) return inner(size);
  if (u.ring === 'fire') return <FireRing size={size} bg={C.card}>{inner(size - 8)}</FireRing>;
  if (u.ring === 'morph') return <MorphRing size={size} bg={C.card}>{(s) => u.avatar ? <Image source={{ uri: u.avatar }} style={{ width: s, height: s }} />
    : <View style={{ width: s, height: s, backgroundColor: u.color, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontFamily: F.heavy, fontSize: s * 0.38 }}>{initials}</Text></View>}</MorphRing>;
  if (u.ring === 'glitch') return <GlitchRing size={size} bg={C.card}>{inner(size - 8)}</GlitchRing>;
  return (
    <SpinRing size={size} ring={u.ring} bg={C.card} accent={[C.orange, C.orange2]}>{inner(size - 8)}</SpinRing>
  );
}

export function Sticker({ v, size = 58, fit }) {
  if (!v) return null;
  if (v.startsWith('T|')) {
    // same as the website's .tsticker: heavy display type, uppercase, white die-cut border, hard + soft shadow, slight tilt
    const [, t, c] = v.split('|'); const [bg, fg] = STICKER_COLORS[c] || STICKER_COLORS.o; const rot = (Math.abs(hashStr(t)) % 9) - 4;
    const fs = Math.max(10, size * 0.27); const grad = c === 'f' ? ['#ff2d00', '#ffb347'] : c === 'c' ? ['#ffffff', '#b9c6d0'] : null;
    return <View style={{ maxWidth: fit ? '100%' : undefined, transform: [{ rotate: rot + 'deg' }], alignSelf: 'flex-start', borderRadius: fs * 0.75 + 3, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 5 }, elevation: 4 }}>
      <View style={{ backgroundColor: grad ? grad[0] : bg, borderColor: c === 'w' ? '#0a0a0a' : '#fff', borderWidth: 3, borderRadius: fs * 0.75 + 3, paddingVertical: fs * 0.45, paddingHorizontal: fs * 0.8, overflow: 'hidden' }}>
        {grad ? <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
        <Text numberOfLines={fit ? 1 : undefined} adjustsFontSizeToFit={!!fit} minimumFontScale={0.5} style={{ color: fg, fontFamily: F.display, fontSize: fs, lineHeight: fs * 1.15, letterSpacing: -0.02 * fs, textTransform: 'uppercase', ...(c === 'f' ? { textShadowColor: 'rgba(0,0,0,.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 } : null) }}>{t}</Text></View>
      <View pointerEvents="none" style={{ position: 'absolute', left: 2, right: 2, bottom: -3, height: 6, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: 'rgba(0,0,0,.14)', zIndex: -1 }} /></View>;
  }
  if (v.startsWith('G|')) return <Image source={{ uri: v.slice(2) }} style={{ width: 200, height: 160, borderRadius: 14 }} resizeMode="cover" accessibilityLabel="GIF" />;
  if (v.startsWith('I|')) return <Image source={{ uri: v.slice(2) }} style={{ width: size * 1.2, height: size * 1.2, borderRadius: size * 0.3, borderWidth: 3, borderColor: '#fff', transform: [{ rotate: '-4deg' }] }} />;
  // emoji: white die-cut outline + soft drop shadow, tilted, like the website
  return <View style={{ transform: [{ rotate: '-5deg' }], shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 6 } }}>
    <Text style={{ fontSize: size, lineHeight: size * 1.1, textShadowColor: '#fff', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 }}>{v}</Text></View>;
}
export const stickerLabel = (v) => (!v ? '' : v.startsWith('G|') ? 'a GIF' : v.startsWith('T|') ? '“' + v.split('|')[1] + '” sticker' : v.startsWith('I|') ? 'a sticker' : v + ' sticker');

export function StickerPicker({ onPick }) {
  const { s, C } = useApp();
  const owned = (s.priv.owned && s.priv.owned.stickers) || { basic: 1 };
  const packs = [...(s.priv.custom && s.priv.custom.length ? [['Yours', s.priv.custom]] : []), ...Object.keys(STICKER_PACKS).filter((k) => owned[k]).map((k) => [k, STICKER_PACKS[k]])];
  return (
    <ScrollView showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" style={{ maxHeight: 220, backgroundColor: C.soft, borderRadius: 18, marginTop: 8 }} contentContainerStyle={{ padding: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {packs.map(([name, items]) => (
        <React.Fragment key={name}>
          <T b muted style={{ width: '100%', fontSize: 12, textTransform: 'capitalize' }}>{name}</T>
          {items.map((e, i) => <Pressable key={name + i} onPress={() => onPick(e)} accessibilityLabel={'Send ' + stickerLabel(e)} style={{ padding: 4 }}><Sticker v={e} size={30} /></Pressable>)}
        </React.Fragment>
      ))}
    </ScrollView>
  );
}

export function Timer({ p }) {
  const { C } = useApp(); const now = useNow(1000);
  if (p.status === 'frozen') return <Pill bg={C.ink} fg={C.bg} icon="snow" text="Frozen" />;
  if (p.kept) return <Pill bg={C.orange} fg={C.onOrange} icon="flame" text={p.reposts > 0 || p.quoteOf ? 'Reflamed' : 'Survived'} />;
  return null;
}
function Pill({ bg, fg, icon, text }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, borderRadius: 15, paddingVertical: 5, paddingHorizontal: 10 }}>
    <Ionicons name={icon} size={13} color={fg} /><Text style={{ color: fg, fontFamily: F.heavy, fontSize: 12.5, fontVariant: ['tabular-nums'] }}>{text}</Text></View>;
}

/* morphing, spinning story orb */
// the story ring: the theme colour flowing round and round a round ring (same as the website's .orb)
export function GradRing({ size, ring = 5, gap = 3, seen, bg, children }) {
  const { C } = useApp();
  useClockKick();
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (seen) return;
    const a = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 3500, easing: Easing.linear, useNativeDriver: true }));
    a.start(); return () => a.stop();
  }, [seen]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  // the shape slowly moves like liquid, same as the website (7s, or 11s once watched)
  const r = jsClock(seen ? 11000 : 7000);
  const corner = (ph, w) => r.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 1, 2, 3, 4].map((i) => w * (0.5 + 0.12 * Math.sin((i / 4 + ph) * Math.PI * 2))) });
  const radii = (w) => ({ borderTopLeftRadius: corner(0, w), borderTopRightRadius: corner(0.27, w), borderBottomRightRadius: corner(0.55, w), borderBottomLeftRadius: corner(0.8, w) });
  const mid = size - ring * 2, pic = mid - gap * 2;
  return (
    <Animated.View style={[{ width: size, height: size, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: seen ? C.line : '#ff5500',
      ...(C.glow && !seen ? { shadowColor: C.orange, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } } : null) }, radii(size)]}>
      {!seen ? <Animated.View style={{ position: 'absolute', width: size * 1.42, height: size * 1.42, transform: [{ rotate }] }}>
        <LinearGradient colors={['#ff5500', '#ff7a1a', '#ffb04d', '#ffd27a', '#ffb04d', '#ff7a1a', '#ff5500']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
      </Animated.View> : null}
      <Animated.View style={[{ width: mid, height: mid, backgroundColor: bg || C.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, radii(mid)]}>
        <Animated.View style={[{ width: pic, height: pic, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, radii(pic)]}>{children(pic)}</Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

export function StoryOrb({ u, size = 74, seen, onPress, label, add, onAdd }) {
  const { C } = useApp();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={{ width: size + 4, alignItems: 'center', gap: 6 }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {u.ring && !seen ? <Avatar u={u} size={size} /> : <GradRing size={size} seen={seen}>{(sz) => <Avatar u={{ ...u, ring: null }} size={sz} />}</GradRing>}
        {add ? <Pressable onPress={onAdd} accessibilityLabel="Add to your story" style={{ position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 8, backgroundColor: C.orange, borderWidth: 3, borderColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={14} color={C.onOrange} /></Pressable> : null}
      </View>
    </Pressable>
  );
}

// same drawing as the website's thermometer (224x64 artboard, scaled to fit): tick marks, glass tube + bulb, glossy shine, rising bubbles
function ThermoBar({ frac, tier }) {
  const { C } = useApp(); const [W, setW] = useState(0); const k = W / 224;
  const fill = useRef(new Animated.Value(0)).current; const bub = useRef(new Animated.Value(0)).current;
  useEffect(() => { const t = setTimeout(() => Animated.timing(fill, { toValue: frac, duration: 1400, easing: Easing.bezier(0.2, 0.9, 0.3, 1), useNativeDriver: false }).start(), 80); return () => clearTimeout(t); }, [frac]);
  useEffect(() => { const l = Animated.loop(Animated.timing(bub, { toValue: 1, duration: 2600 * 3, easing: Easing.linear, useNativeDriver: true })); bub.setValue(0); l.start(); return () => l.stop(); }, []);
  const G = (tier && tier[2]) || (C.mono ? [C.orange, C.orange2, C.orange2] : ['#ff2d00', '#ff6a1a', '#ffd27a']); const nova = tier && tier[1] === 'Supernova';
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (!nova) return; const l = Animated.loop(Animated.sequence([Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: true }), Animated.timing(glow, { toValue: 0, duration: 1200, useNativeDriver: true })])); l.start(); return () => l.stop(); }, [nova]);
  const box = (x, y, w, h, extra) => ({ position: 'absolute', left: x * k, top: y * k, width: w * k, height: h * k, ...extra });
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 150, minWidth: 130, maxWidth: 260, aspectRatio: 224 / 64 }}>
      {W && tier && tier[2] ? <>
        {/* past Molten: the whole thermometer glows in its tier colour (Supernova pulses pink to cyan) */}
        <View style={{ position: 'absolute', left: 6 * k, top: 8 * k, width: 48 * k, height: 48 * k, borderRadius: 24 * k, backgroundColor: G[1], shadowColor: G[1], shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }} />
        <View style={{ position: 'absolute', left: 38 * k, top: 17 * k, width: 180 * k, height: 30 * k, borderRadius: 15 * k, backgroundColor: G[1], shadowColor: G[1], shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }} />
        {nova ? <Animated.View style={{ position: 'absolute', left: 6 * k, top: 8 * k, width: 48 * k, height: 48 * k, borderRadius: 24 * k, backgroundColor: G[2], shadowColor: G[2], shadowOpacity: 1, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, opacity: glow }} /> : null}
      </> : null}
      {W ? <>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const y1 = i % 2 ? 11 : 7; return <View key={i} style={box(65 + i * 20, y1, 2, 13 - y1, { borderRadius: k, backgroundColor: C.muted })} />; })}
        <View style={box(38, 17, 180, 30, { borderRadius: 15 * k, backgroundColor: C.card, borderWidth: 2 * k, borderColor: C.line })} />
        <View style={box(6, 8, 48, 48, { borderRadius: 24 * k, backgroundColor: C.card, borderWidth: 2 * k, borderColor: C.line })} />
        <Animated.View style={[box(42, 24, 0, 16, { borderRadius: 8 * k, overflow: 'hidden' }), { width: fill.interpolate({ inputRange: [0, 1], outputRange: [10 * k, 170 * k] }) }]}>
          <LinearGradient colors={G} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: 170 * k, height: 16 * k }} />
          {frac > 0.12 ? [0, 1, 2].map((i) => { const r = 1.4 + i * 0.4, a = i / 3, b = a + 1 / 3;
            return <Animated.View key={i} style={{ position: 'absolute', left: (2 - r) * k, top: (5 + i * 3 - r) * k, width: 2 * r * k, height: 2 * r * k, borderRadius: r * k, backgroundColor: '#fff',
              opacity: bub.interpolate({ inputRange: [0, a, a + 0.05, b, 1], outputRange: [0, 0, 0.85, 0, 0], extrapolate: 'clamp' }),
              transform: [{ translateX: bub.interpolate({ inputRange: [0, a, b, 1], outputRange: [0, 0, 140 * k * frac, 140 * k * frac], extrapolate: 'clamp' }) }] }} />; }) : null}
        </Animated.View>
        <View style={box(12, 14, 36, 36, { borderRadius: 18 * k, overflow: 'hidden' })}>
          <LinearGradient colors={G} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} /></View>
        <View style={box(46, 20.5, 164, 3.5, { borderRadius: 1.75 * k, backgroundColor: '#fff', opacity: 0.35 })} />
        <View style={box(19.5, 21.5, 9, 9, { borderRadius: 4.5 * k, backgroundColor: '#fff', opacity: 0.4 })} />
      </> : null}
    </View>
  );
}

export function Thermo({ w, isMe, stickers, onAddSticker, onRemoveSticker }) {
  const { C } = useApp();
  const deg = tempOf(w); const frac = Math.max(0, Math.min(1, (deg - 32) / 180));
  const left = nextWeekStart() - Date.now(); const d = Math.floor(left / DAY), h = Math.floor((left % DAY) / HOUR);
  return (
    <FlowBox r={22} style={{ backgroundColor: C.soft, padding: 14, marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
      <ThermoBar frac={frac} tier={tierOf(deg)} />
      <View>
        <T b muted style={{ fontSize: 12.5 }}>This week</T>
        <T d style={{ fontSize: 30, letterSpacing: -1.5 }}>{deg}°</T>
        <T h style={{ color: tierOf(deg)[3] || C.orange }}>{levelOf(deg)}</T>
        <T muted style={{ fontSize: 12.5, marginTop: 4 }}>Resets in {d}d {h}h</T>
        {isMe ? <T muted style={{ fontSize: 12.5 }}>{(w && w.viral) || 0} viral · +{kfmt((w && w.earned) || 0)} pts</T> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
        {(stickers || []).map((e, i) => isMe
          ? <Pressable key={i} onPress={() => onRemoveSticker(i)} accessibilityLabel={'Remove ' + stickerLabel(e)}><Sticker v={e} size={38} /></Pressable>
          : <View key={i}><Sticker v={e} size={38} /></View>)}
        {isMe && (stickers || []).length < 3 ? <Pressable onPress={onAddSticker} accessibilityLabel="Add a sticker to your profile"
          style={{ width: 62, height: 62, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={20} color={C.muted} /><T b muted style={{ fontSize: 11 }}>Sticker</T></Pressable> : null}
      </View>
    </FlowBox>
  );
}

// tap on any empty spot (not a button or field) to put the keyboard away
// only steps in while the keyboard is up, so it never competes with scrolling
export const tapAway = { onStartShouldSetResponder: () => Keyboard.isVisible(), onResponderRelease: () => Keyboard.dismiss() };

export function Sheet({ visible, onClose, title, right, children, full }) {
  const { C } = useApp(); const ins = useSafeAreaInsets();
  const [kb, setKb] = useState(false); // keyboard up: drop the home-bar padding so there's no gap above it
  useEffect(() => { const a = Keyboard.addListener('keyboardWillShow', () => setKb(true)), b = Keyboard.addListener('keyboardWillHide', () => setKb(false));
    const c = Keyboard.addListener('keyboardDidShow', () => setKb(true)), d = Keyboard.addListener('keyboardDidHide', () => setKb(false));
    return () => { a.remove(); b.remove(); c.remove(); d.remove(); }; }, []);
  // light, quick dim that fades in while the sheet springs up; drag the top of the sheet down to close
  const a = useRef(new Animated.Value(0)).current; const drag = useRef(new Animated.Value(0)).current; const closing = useRef(false);
  useEffect(() => { Animated.spring(a, { toValue: 1, damping: 22, stiffness: 240, mass: 0.9, useNativeDriver: true }).start(); }, []);
  const close = () => { if (closing.current) return; closing.current = true; Keyboard.dismiss();
    Animated.timing(a, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => onClose()); };
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (e, d) => d.dy > 6 && Math.abs(d.dy) > Math.abs(d.dx),
    onPanResponderMove: (e, d) => drag.setValue(Math.max(0, d.dy)),
    onPanResponderRelease: (e, d) => { if (d.dy > 90 || d.vy > 0.8) close(); else Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(); },
  })).current;
  const slide = Animated.add(a.interpolate({ inputRange: [0, 1], outputRange: [700, 0] }), drag);
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.dark ? 'rgba(0,0,0,.28)' : 'rgba(10,10,10,.14)', opacity: a }} />
      {/* the space above the sheet always closes it (and the keyboard) */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, minHeight: full ? '6%' : '12%' }} onPress={close} accessibilityLabel="Close" />
        <Animated.View {...tapAway} style={{ backgroundColor: C.card, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 18, paddingTop: 8, paddingBottom: kb ? 10 : ins.bottom + 16, flexShrink: 1,
          shadowColor: '#000', shadowOpacity: C.dark ? 0.5 : 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: -4 }, elevation: 16, transform: [{ translateY: slide }] }}>
          <View {...pan.panHandlers}>
            <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: C.line, alignSelf: 'center', marginBottom: 12 }} />
            {title ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
              <T d style={{ fontSize: 19, letterSpacing: -0.6 }}>{title}</T>{right}</View> : null}
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Pill tabs: tap a tab, or drag the white pill along the bar and let go on the one you want.
export function SegTabs({ items, value, onChange, size = 14, style }) {
  const { C } = useApp();
  const n = items.length; const idx = Math.max(0, items.findIndex(([k]) => k === value));
  const [w, setW] = useState(0); const seg = w ? (w - 8) / n : 0;
  const x = useRef(new Animated.Value(0)).current; const [hover, setHover] = useState(null); const bar = useRef(null);
  const st = useRef({}); st.current = { seg, idx, n, items, onChange, w };
  useEffect(() => { if (seg) Animated.spring(x, { toValue: idx * seg, damping: 20, stiffness: 260, useNativeDriver: true }).start(); }, [idx, seg]);
  const at = (px) => { const k = st.current; return Math.max(0, Math.min(k.n - 1, Math.floor((px - 4) / (k.seg || 1)))); };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: (e, d) => Math.abs(d.dx) > 6 && Math.abs(d.dx) > Math.abs(d.dy),
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => { const k = st.current; k.startPage = e.nativeEvent.pageX; k.moved = false; k.barX = null;
      try { bar.current.measureInWindow((bx) => { k.barX = bx; }); } catch (err) {} },
    onPanResponderMove: (e, d) => {
      const k = st.current; if (Math.abs(d.dx) > 4) k.moved = true; if (!k.moved) return;
      const pos = Math.max(0, Math.min((k.n - 1) * k.seg, k.idx * k.seg + d.dx)); x.setValue(pos);
      const h = Math.round(pos / (k.seg || 1)); if (h !== k.hover) { k.hover = h; setHover(h); }
    },
    onPanResponderRelease: (e, d) => {
      const k = st.current; let to;
      if (!k.moved) { if (k.barX == null) return; to = at(k.startPage - k.barX); } else to = Math.max(0, Math.min(k.n - 1, Math.round((k.idx * k.seg + d.dx) / (k.seg || 1))));
      k.hover = null; setHover(null);
      Animated.spring(x, { toValue: to * k.seg, damping: 20, stiffness: 260, useNativeDriver: true }).start();
      if (to !== k.idx) k.onChange(k.items[to][0]);
    },
  })).current;
  const on = hover != null ? hover : idx;
  return (
    <View ref={bar} {...pan.panHandlers} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist"
      style={[{ flexDirection: 'row', backgroundColor: C.card, borderRadius: 15, padding: 4 }, style]}>
      {seg ? <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 4, bottom: 4, left: 4, width: seg, borderRadius: 15, backgroundColor: C.ink, transform: [{ translateX: x }] }} /> : null}
      {items.map(([k, l], i) => (
        <View key={k} accessible accessibilityRole="tab" accessibilityLabel={l} accessibilityState={{ selected: i === idx }} style={{ flex: 1, paddingVertical: 9, alignItems: 'center' }}>
          <T h style={{ color: i === on ? C.bg : C.muted, fontSize: size }}>{l}</T></View>))}
    </View>
  );
}

export function Empty({ text }) { return <T b muted style={{ textAlign: 'center', paddingVertical: 48 }}>{text}</T>; }

export function Check({ u }) { return null; }

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
export { ago, kfmt };
