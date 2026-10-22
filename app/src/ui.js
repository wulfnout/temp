import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, Animated, Easing, Modal, StyleSheet, KeyboardAvoidingView, Keyboard, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { F, hms, ago, kfmt, hashStr, STICKER_PACKS, STICKER_COLORS, tempOf, levelOf, nextWeekStart, DAY, HOUR } from './lib';

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

export function Btn({ title, onPress, kind = 'ink', small, disabled, style, icon }) {
  const { C } = useApp();
  const bg = kind === 'orange' ? C.orange : kind === 'ghost' ? C.soft : C.ink;
  const glow = kind === 'orange' && C.glow && !disabled ? { shadowColor: C.orange, shadowOpacity: 0.85, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 8 } : null;
  const fg = kind === 'orange' ? C.onOrange : kind === 'ghost' ? C.ink : C.bg;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={title}
      style={({ pressed }) => [glow, { backgroundColor: bg, borderRadius: 999, paddingVertical: small ? 8 : 12, paddingHorizontal: small ? 14 : 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: disabled ? 0.35 : pressed ? 0.8 : 1 }, style]}>
      {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
      <Text style={{ color: fg, fontFamily: F.heavy, fontSize: small ? 13 : 14 }}>{title}</Text>
    </Pressable>
  );
}

export function IconBtn({ name, onPress, size = 22, color, label, badge, style }) {
  const { C } = useApp();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={8} style={({ pressed }) => [{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 }, style]}>
      <Ionicons name={name} size={size} color={color || C.ink} />
      {badge ? <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
        <Text style={{ color: '#fff', fontSize: 11, fontFamily: F.heavy }}>{badge}</Text></View> : null}
    </Pressable>
  );
}

const RING_COLORS = { fire: ['#ff2d00', '#ffd27a'], ice: ['#ffffff', '#7f95a6'], gold: ['#ffd700', '#b98900'], morph: null, glitch: ['#ff2d55', '#00e5ff'], plus: ['#0a0a0a', '#ff5500'] };
import { FireRing, GlitchRing } from './fx';
export function Avatar({ u, size = 40 }) {
  const { C } = useApp();
  if (!u) return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.soft }} />;
  const initials = (u.name || u.handle || '?').split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  const inner = (s) => u.avatar
    ? <Image source={{ uri: u.avatar }} style={{ width: s, height: s, borderRadius: s / 2 }} />
    : <View style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: u.color, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontFamily: F.heavy, fontSize: s * 0.38 }}>{initials}</Text></View>;
  if (!u.ring) return inner(size);
  if (u.ring === 'fire') return <FireRing size={size} bg={C.card}>{inner(size - 8)}</FireRing>;
  if (u.ring === 'glitch') return <GlitchRing size={size} bg={C.card}>{inner(size - 8)}</GlitchRing>;
  const cols = RING_COLORS[u.ring] || [C.orange, C.orange2];
  return (
    <LinearGradient colors={cols || [C.orange, C.orange2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ padding: 2, borderRadius: size, backgroundColor: C.card }}>{inner(size - 8)}</View>
    </LinearGradient>
  );
}

export function Sticker({ v, size = 58, fit }) {
  if (!v) return null;
  if (v.startsWith('T|')) {
    const [, t, c] = v.split('|'); const [bg, fg] = STICKER_COLORS[c] || STICKER_COLORS.o; const rot = (Math.abs(hashStr(t)) % 9) - 4;
    return <View style={{ maxWidth: fit ? '100%' : undefined, transform: [{ rotate: rot + 'deg' }], backgroundColor: bg, borderColor: '#fff', borderWidth: 3, borderRadius: 12, paddingVertical: size * 0.1, paddingHorizontal: size * 0.2, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3, alignSelf: 'flex-start' }}>
      <Text numberOfLines={fit ? 1 : undefined} adjustsFontSizeToFit={!!fit} minimumFontScale={0.5} style={{ color: fg, fontFamily: F.display, fontSize: Math.max(10, size * 0.26) }}>{t}</Text></View>;
  }
  if (v.startsWith('G|')) return <Image source={{ uri: v.slice(2) }} style={{ width: 200, height: 160, borderRadius: 14 }} resizeMode="cover" accessibilityLabel="GIF" />;
  if (v.startsWith('I|')) return <Image source={{ uri: v.slice(2) }} style={{ width: size * 1.2, height: size * 1.2, borderRadius: size * 0.3, borderWidth: 3, borderColor: '#fff', transform: [{ rotate: '-4deg' }] }} />;
  return <Text style={{ fontSize: size * 0.9 }}>{v}</Text>;
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
  return null;
}
function Pill({ bg, fg, icon, text }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 }}>
    <Ionicons name={icon} size={13} color={fg} /><Text style={{ color: fg, fontFamily: F.heavy, fontSize: 12.5, fontVariant: ['tabular-nums'] }}>{text}</Text></View>;
}

/* morphing, spinning story orb */
export function StoryOrb({ u, size = 74, seen, onPress, label, add, onAdd }) {
  const { C } = useApp();
  const spin = useRef(new Animated.Value(0)).current, breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(spin, { toValue: 1, duration: seen ? 9000 : 3500, easing: Easing.linear, useNativeDriver: true }));
    const b = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true })]));
    a.start(); b.start(); return () => { a.stop(); b.stop(); };
  }, [seen]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const sx = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }), sy = breathe.interpolate({ inputRange: [0, 1], outputRange: [1.04, 0.97] });
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={{ width: size + 4, alignItems: 'center', gap: 6 }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ position: 'absolute', width: size, height: size, borderRadius: size * 0.48, borderWidth: 3.5,
          borderColor: seen ? C.line : C.orange, borderTopColor: seen ? C.line : '#ffd27a', borderRightColor: seen ? C.line : C.orange2,
          ...(C.glow && !seen ? { shadowColor: C.orange, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } } : null),
          transform: [{ rotate }, { scaleX: sx }, { scaleY: sy }] }} />
        <Avatar u={{ ...u, ring: null }} size={size - 12} />
        {add ? <Pressable onPress={onAdd} accessibilityLabel="Add to your story" style={{ position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 8, backgroundColor: C.orange, borderWidth: 3, borderColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={14} color="#fff" /></Pressable> : null}
      </View>
    </Pressable>
  );
}

export function Thermo({ w, isMe, stickers, onAddSticker, onRemoveSticker }) {
  const { C } = useApp();
  const deg = tempOf(w); const frac = Math.max(0, Math.min(1, (deg - 32) / 180));
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fill, { toValue: frac, duration: 1300, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [frac]);
  const left = nextWeekStart() - Date.now(); const d = Math.floor(left / DAY), h = Math.floor((left % DAY) / HOUR);
  return (
    <View style={{ backgroundColor: C.soft, borderRadius: 22, padding: 14, marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexGrow: 1, flexBasis: 140, maxWidth: 230 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, borderWidth: 2, borderColor: C.line, alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
          <LinearGradient colors={['#ff2d00', '#ff6a1a']} style={{ width: 28, height: 28, borderRadius: 14 }} />
        </View>
        <View style={{ flex: 1, height: 22, marginLeft: -6, borderRadius: 11, backgroundColor: C.card, borderWidth: 2, borderColor: C.line, overflow: 'hidden', justifyContent: 'center' }}>
          <Animated.View style={{ height: 12, marginLeft: 4, borderRadius: 6, overflow: 'hidden', width: fill.interpolate({ inputRange: [0, 1], outputRange: ['4%', '96%'] }) }}>
            <LinearGradient colors={['#ff2d00', '#ff6a1a', '#ffd27a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
          </Animated.View>
        </View>
      </View>
      <View>
        <T b muted style={{ fontSize: 12.5 }}>This week</T>
        <T d style={{ fontSize: 30, letterSpacing: -1.5 }}>{deg}°</T>
        <T h style={{ color: C.orange }}>{levelOf(deg)}</T>
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
    </View>
  );
}

// tap on any empty spot (not a button or field) to put the keyboard away
export const tapAway = { onStartShouldSetResponder: () => true, onResponderRelease: () => Keyboard.dismiss() };

export function Sheet({ visible, onClose, title, right, children, full }) {
  const { C } = useApp(); const ins = useSafeAreaInsets();
  const [kb, setKb] = useState(false); // keyboard up: drop the home-bar padding so there's no gap above it
  useEffect(() => { const a = Keyboard.addListener('keyboardWillShow', () => setKb(true)), b = Keyboard.addListener('keyboardWillHide', () => setKb(false));
    const c = Keyboard.addListener('keyboardDidShow', () => setKb(true)), d = Keyboard.addListener('keyboardDidHide', () => setKb(false));
    return () => { a.remove(); b.remove(); c.remove(); d.remove(); }; }, []);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* the dimmed area above the sheet always fills whatever space is left, so a tap there closes it (and the keyboard) */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.scrim }}>
        <Pressable style={{ flex: 1, minHeight: full ? '6%' : '12%' }} onPress={() => { Keyboard.dismiss(); onClose(); }} accessibilityLabel="Close" />
        <View {...tapAway} style={{ backgroundColor: C.card, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 18, paddingTop: 8, paddingBottom: kb ? 10 : ins.bottom + 16, flexShrink: 1 }}>
          <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: C.line, alignSelf: 'center', marginBottom: 12 }} />
          {title ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
            <T d style={{ fontSize: 19, letterSpacing: -0.6 }}>{title}</T>{right}</View> : null}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Empty({ text }) { return <T b muted style={{ textAlign: 'center', paddingVertical: 48 }}>{text}</T>; }

export function Check({ u }) { return null; }

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
export { ago, kfmt };
