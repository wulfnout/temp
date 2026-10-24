// Story photos like Instagram: the picture sits fitted on a blurred copy of itself; pinch to zoom,
// drag to move, tap Fit/Fill to switch. The same layout is used when people watch the story.
import React, { useRef, useState } from 'react';
import { View, Image, PanResponder, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from './ui';

// layout: { s: zoom (1 = fitted), x, y: offset as a fraction of the screen }
export function StoryPhoto({ uri, layout, style }) {
  const L = layout || { s: 1, x: 0, y: 0, fill: true }; const { width: W, height: H } = Dimensions.get('window');
  return (
    <View style={[{ flex: 1, backgroundColor: '#000', overflow: 'hidden' }, style]}>
      <Image source={{ uri }} style={{ position: 'absolute', top: -40, left: -40, right: -40, bottom: -40, opacity: 0.55 }} blurRadius={40} resizeMode="cover" />
      <Image source={{ uri }} resizeMode={L.fill ? 'cover' : 'contain'} style={{ position: 'absolute', top: 0, left: 0, width: W, height: '100%',
        transform: [{ translateX: (L.x || 0) * W }, { translateY: (L.y || 0) * H }, { scale: L.s || 1 }] }} />
    </View>
  );
}

export function StoryPhotoEditor({ uri, layout, onChange }) {
  const { width: W, height: H } = Dimensions.get('window');
  const [L, setL] = useState(layout || { s: 1, x: 0, y: 0, fill: false });
  const g = useRef({}); const cur = useRef(L); cur.current = L;
  const set = (n) => { setL(n); onChange && onChange(n); };
  const dist = (t) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => { g.current = { start: { ...cur.current }, d0: 0, base: null }; },
    onPanResponderMove: (e, d) => {
      const t = e.nativeEvent.touches; const st = g.current.start;
      if (t.length >= 2) {
        const dd = dist(t); if (!g.current.d0) { g.current.d0 = dd; g.current.base = { ...cur.current, dx: d.dx, dy: d.dy }; return; }
        const b = g.current.base; const s = Math.max(0.5, Math.min(5, b.s * dd / g.current.d0));
        set({ ...b, s, x: b.x + (d.dx - b.dx) / W, y: b.y + (d.dy - b.dy) / H });
      } else if (!g.current.d0) set({ ...st, x: st.x + d.dx / W, y: st.y + d.dy / H });
    },
    onPanResponderRelease: () => { g.current = {}; },
  })).current;
  return (
    <View style={{ flex: 1 }}>
      <View {...pan.panHandlers} style={{ flex: 1 }}><StoryPhoto uri={uri} layout={L} /></View>
      <Pressable onPress={() => set({ s: 1, x: 0, y: 0, fill: !L.fill })} accessibilityLabel={L.fill ? 'Fit the whole photo' : 'Fill the screen'}
        style={{ position: 'absolute', right: 16, top: H * 0.16, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,.5)', borderTopLeftRadius: 26, borderTopRightRadius: 17, borderBottomRightRadius: 28, borderBottomLeftRadius: 15, paddingHorizontal: 12, paddingVertical: 7 }}>
        <Ionicons name={L.fill ? 'contract-outline' : 'expand-outline'} size={16} color="#fff" /><T h style={{ color: '#fff', fontSize: 13 }}>{L.fill ? 'Fit' : 'Fill'}</T></Pressable>
    </View>
  );
}
